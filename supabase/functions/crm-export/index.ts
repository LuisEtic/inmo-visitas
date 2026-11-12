import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import {
  buildSummary,
  inmovillaPayloadSchema,
  mapToInmovilla,
  mapToWitei,
  signBody,
  witeiPayloadSchema,
  type SummaryDataInput,
} from './mappers.ts'

/**
 * Edge Function `crm-export` (Fase 7): exporta la ficha de una nota
 * aprobada al CRM de la agencia (Inmovilla o Witei) en un formato
 * PROPIO («inmo-visitas v1», NO la API real de esos CRM, cuyo acceso
 * está sin confirmar).
 *
 * - Autenticación: Supabase verifica el JWT por defecto. Dentro, el
 *   cliente se crea con la clave anon y la cabecera `Authorization` de
 *   la petición, así todas las lecturas y escrituras pasan por RLS
 *   como ese agente. NUNCA `service_role`.
 * - La función construye su propio JSON (no confía en el que mande el
 *   navegador): lee la nota, el cliente, el inmueble, el agente, los
 *   datos no descartados y las tareas `pendiente`, y los mapea con
 *   `mappers.ts`. A la ficha (y al CRM) NO van la transcripción, el
 *   texto de la nota, el audio (ni su ruta), las citas literales, los
 *   datos descartados ni los borradores.
 * - Solo admite notas en `approved` (otro estado → 409). Si ya hay
 *   una fila `enviado` de esa nota y ese `target`, responde 200 con
 *   ella sin volver a llamar al CRM (`already_exported: true`).
 * - Modo simulado (falta `CRM_WEBHOOK_URL`): valida el *payload* con
 *   el esquema Zod de ese CRM y actualiza la fila a `enviado` con
 *   `external_id = 'SIM-' + <8 primeros del id>` y
 *   `payload.simulated = true`. NO SALE NADA de Supabase.
 * - Modo webhook (hay `CRM_WEBHOOK_URL`): POST del *payload* con
 *   `Idempotency-Key` (el id de la fila) y, si hay
 *   `CRM_WEBHOOK_SECRET`, `X-InmoVisitas-Signature` (HMAC-SHA256 del
 *   cuerpo). *Timeout* de 15 s y UN reintento con la misma clave ante
 *   *timeout* o 5xx. 2xx → `enviado` (con el `external_id` de la
 *   respuesta, si viene); otro caso → `error` con un mensaje genérico
 *   en español y la función responde 502.
 * - Cada intento es una fila nueva: reintentar crea otra fila
 *   `pendiente` (el guard no deja cambiar una fila cerrada).
 * - Ni el *payload* ni la respuesta del CRM aparecen en los logs ni
 *   en las respuestas de error.
 */

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'https://luisetic.github.io',
])

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'

/** Tiempo máximo de cada intento al webhook del CRM. */
const WEBHOOK_TIMEOUT_MS = 15000

const CRM_EXPORT_ERROR =
  'No se ha podido exportar la ficha. Inténtalo de nuevo.'

const bodySchema = z.object({
  visit_note_id: z.string().uuid(),
  target: z.enum(['inmovilla', 'witei']),
})

type CrmTarget = z.infer<typeof bodySchema>['target']

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin !== null && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
    },
  })
}

type ExportRow = {
  id: string
  status: string
  external_id: string | null
  exported_at: string | null
  payload: Record<string, unknown> | null
}

function exportResponse(
  row: ExportRow,
  simulated: boolean,
  alreadyExported: boolean,
): Record<string, unknown> {
  return {
    export: {
      id: row.id,
      status: row.status,
      external_id: row.external_id,
      exported_at: row.exported_at,
    },
    simulated,
    already_exported: alreadyExported,
  }
}

/** `id` o `external_id` de la respuesta del CRM, si viene como texto. */
function responseExternalId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  for (const key of ['id', 'external_id']) {
    const value = (body as Record<string, unknown>)[key]
    if (typeof value === 'string' && value !== '') {
      return value
    }
  }
  return null
}

type WebhookAttempt =
  | { outcome: 'sent'; status: number; body: unknown }
  | { outcome: 'timeout' }
  | { outcome: 'network' }

async function attemptWebhook(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<WebhookAttempt> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
  } catch (error) {
    return {
      outcome:
        error instanceof DOMException && error.name === 'TimeoutError'
          ? 'timeout'
          : 'network',
    }
  }
  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    // Respuesta sin JSON: no hace falta para decidir.
  }
  return { outcome: 'sent', status: response.status, body: parsed }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405, origin)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Cuerpo no válido' }, 400, origin)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonResponse({ error: 'Cuerpo no válido' }, 400, origin)
  }
  const visitNoteId = parsed.data.visit_note_id
  const target: CrmTarget = parsed.data.target

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = req.headers.get('Authorization')
  if (
    supabaseUrl === undefined ||
    supabaseAnonKey === undefined ||
    authorization === null
  ) {
    return jsonResponse({ error: 'No autorizado' }, 401, origin)
  }

  // Cliente como el agente que llama: RLS se aplica en cada consulta.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Leer la nota (RLS: de otro agente o inexistente → 0 filas).
  const { data: note, error: noteError } = await supabase
    .from('visit_notes')
    .select('id, client_id, property_id, agent_id, status, created_at, approved_at')
    .eq('id', visitNoteId)
    .maybeSingle()
  if (noteError !== null || note === null) {
    return jsonResponse({ error: 'No encontrado' }, 404, origin)
  }

  // 2. Solo una nota aprobada se exporta.
  if (note.status !== 'approved') {
    return jsonResponse(
      { error: 'Aprueba la nota antes de exportarla.' },
      409,
      origin,
    )
  }

  // 3. Si ya hay una fila `enviado` de esa nota y ese `target`, no se
  //    vuelve a llamar al CRM: se devuelve la misma fila.
  const { data: existing, error: existingError } = await supabase
    .from('crm_exports')
    .select('id, status, external_id, exported_at, payload')
    .eq('visit_note_id', visitNoteId)
    .eq('target', target)
    .eq('kind', 'nota')
    .eq('status', 'enviado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingError !== null) {
    return jsonResponse({ error: CRM_EXPORT_ERROR }, 502, origin)
  }
  if (existing !== null) {
    const row = existing as ExportRow
    const simulated =
      typeof row.payload === 'object' &&
      row.payload !== null &&
      (row.payload as Record<string, unknown>)['simulated'] === true
    return jsonResponse(exportResponse(row, simulated, true), 200, origin)
  }

  // 4. Datos para la ficha: solo los no descartados y las tareas
  //    `pendiente`. Ni transcripción, ni texto de la nota, ni audio,
  //    ni citas.
  const { data: factRows, error: factsError } = await supabase
    .from('extracted_facts')
    .select('category, field_name, value')
    .eq('visit_note_id', visitNoteId)
    .neq('review_status', 'descartado')
    .order('created_at', { ascending: true })
  const { data: taskRows, error: tasksError } = await supabase
    .from('tasks')
    .select('description, due_date')
    .eq('visit_note_id', visitNoteId)
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true })
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('full_name, phone, email, is_temporary')
    .eq('id', note.client_id)
    .maybeSingle()
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('reference, address, city')
    .eq('id', note.property_id)
    .maybeSingle()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: agent, error: agentError } =
    user === null
      ? { data: null, error: { message: 'sin usuario' } }
      : await supabase
          .from('agents')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
  if (
    factsError !== null ||
    tasksError !== null ||
    clientError !== null ||
    propertyError !== null ||
    agentError !== null ||
    client === null ||
    property === null ||
    agent === null
  ) {
    return jsonResponse({ error: CRM_EXPORT_ERROR }, 502, origin)
  }

  const summaryInput: SummaryDataInput = {
    note: {
      id: note.id as string,
      created_at: note.created_at as string,
      approved_at: note.approved_at as string | null,
    },
    client: {
      full_name: client.full_name as string,
      phone: client.phone as string | null,
      email: client.email as string | null,
      is_temporary: client.is_temporary as boolean,
    },
    property: {
      reference: property.reference as string,
      address: property.address as string,
      city: property.city as string,
    },
    agent: { full_name: agent.full_name as string },
    facts: (factRows ?? []) as SummaryDataInput['facts'],
    tasks: (taskRows ?? []) as SummaryDataInput['tasks'],
  }
  const summary = buildSummary(summaryInput)
  const payload =
    target === 'inmovilla'
      ? mapToInmovilla(summary)
      : mapToWitei(summary)
  const schema =
    target === 'inmovilla' ? inmovillaPayloadSchema : witeiPayloadSchema
  if (!schema.safeParse(payload).success) {
    return jsonResponse({ error: CRM_EXPORT_ERROR }, 502, origin)
  }

  // 5. La fila nace `pendiente` (el guard la exige para este target).
  const { data: inserted, error: insertError } = await supabase
    .from('crm_exports')
    .insert({
      visit_note_id: visitNoteId,
      target,
      kind: 'nota',
      payload,
      status: 'pendiente',
    })
    .select('id, status, external_id, exported_at, payload')
    .single()
  if (insertError !== null || inserted === null) {
    // La nota dejó de estar aprobada entre la lectura y la inserción.
    const message = (insertError as { message?: unknown } | null)?.message
    if (insertError !== null && insertError.code === 'P0001' && message === 'nota_no_aprobada') {
      return jsonResponse(
        { error: 'Aprueba la nota antes de exportarla.' },
        409,
        origin,
      )
    }
    return jsonResponse({ error: CRM_EXPORT_ERROR }, 502, origin)
  }
  const row = inserted as ExportRow

  // 6. Modo simulado: sin `CRM_WEBHOOK_URL` no sale nada de Supabase.
  const webhookUrl = Deno.env.get('CRM_WEBHOOK_URL')
  if (webhookUrl === undefined || webhookUrl === '') {
    const externalId = `SIM-${row.id.slice(0, 8)}`
    const { data: updated, error: updateError } = await supabase
      .from('crm_exports')
      .update({
        status: 'enviado',
        external_id: externalId,
        payload: { ...payload, simulated: true },
      })
      .eq('id', row.id)
      .select('id, status, external_id, exported_at, payload')
      .single()
    if (updateError !== null || updated === null) {
      return jsonResponse({ error: CRM_EXPORT_ERROR }, 502, origin)
    }
    return jsonResponse(exportResponse(updated as ExportRow, true, false), 200, origin)
  }

  // 7. Modo webhook: POST con `Idempotency-Key` y firma HMAC opcional.
  const webhookSecret = Deno.env.get('CRM_WEBHOOK_SECRET')
  const bodyText = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Idempotency-Key': row.id,
  }
  if (webhookSecret !== undefined && webhookSecret !== '') {
    headers['X-InmoVisitas-Signature'] =
      `sha256=${await signBody(webhookSecret, bodyText)}`
  }
  let attempt = await attemptWebhook(webhookUrl, bodyText, headers)
  const retryable =
    attempt.outcome === 'timeout' ||
    attempt.outcome === 'network' ||
    (attempt.outcome === 'sent' && attempt.status >= 500)
  if (retryable) {
    // Un reintento, con la misma `Idempotency-Key`.
    attempt = await attemptWebhook(webhookUrl, bodyText, headers)
  }

  if (attempt.outcome === 'sent' && attempt.status >= 200 && attempt.status < 300) {
    const externalId = responseExternalId(attempt.body)
    const { data: updated, error: updateError } = await supabase
      .from('crm_exports')
      .update({ status: 'enviado', external_id: externalId })
      .eq('id', row.id)
      .select('id, status, external_id, exported_at, payload')
      .single()
    if (updateError !== null || updated === null) {
      return jsonResponse({ error: CRM_EXPORT_ERROR }, 502, origin)
    }
    return jsonResponse(exportResponse(updated as ExportRow, false, false), 200, origin)
  }

  // El CRM no respondió o rechazó la ficha: fila `error` y 502 con un
  // mensaje genérico en español, sin datos de la ficha ni del CRM.
  const errorMessage =
    attempt.outcome === 'sent'
      ? `El CRM rechazó la ficha (código ${attempt.status})`
      : 'El CRM no respondió'
  await supabase
    .from('crm_exports')
    .update({ status: 'error', error_message: errorMessage })
    .eq('id', row.id)
  return jsonResponse({ error: errorMessage }, 502, origin)
})
