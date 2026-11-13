import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import { allowedOrigins } from './cors.ts'
import {
  DAILY_LIMIT_MESSAGE,
  madridDayStart,
  parseDailyLimit,
} from './limit.ts'
import {
  budgetValuesOf,
  buyerFacts,
  firstName,
  ownerFacts,
  parseBuyerResponse,
  parseOwnerResponse,
  requiredTasks,
  validateDraft,
  type DraftAudience,
  type FactInput,
  type PlaceholderValues,
} from './rules.ts'

/**
 * Edge Function `drafts` (Fase 6): prepara el seguimiento de una nota
 * aprobada — un borrador para el comprador, otro para el propietario
 * y las tareas propuestas — con un modelo de lenguaje por la API de
 * chat compatible con OpenAI (en pruebas, Gemini Flash).
 *
 * - Autenticación: Supabase verifica el JWT por defecto. Dentro, el
 *   cliente se crea con la clave anon y la cabecera `Authorization` de
 *   la petición, así todas las lecturas y escrituras pasan por RLS
 *   como ese agente. NUNCA `service_role`.
 * - Proveedor configurable por secrets: `DRAFT_API_URL`,
 *   `DRAFT_MODEL` y `DRAFT_API_KEY`, con fallback a los `EXTRACT_*`
 *   equivalentes si falta alguno. Sin valores por defecto en el
 *   código.
 * - Minimización de datos (RGPD): al modelo solo se envían la
 *   categoría, el nombre y el valor de los datos no descartados, más
 *   la referencia del inmueble. Ni nombres, ni teléfonos, ni la
 *   dirección, ni el precio. El borrador al propietario sale de una
 *   llamada aparte SIN presupuesto ni finanzas (`ownerFacts`).
 * - Las reglas mandan sobre la IA (`rules.ts`): el borrador al
 *   propietario nunca filtra presupuesto ni el nombre del cliente,
 *   ningún borrador da por confirmada una cita ni inventa una hora, y
 *   cada cita pendiente tiene su tarea de confirmar. Un borrador
 *   rechazado se reintenta UNA vez; si vuelve a fallar → 422 y ese
 *   borrador no se guarda (el otro, si pasó, sí se guarda).
 * - Nunca se devuelven al cliente los mensajes del proveedor ni se
 *   escriben en los logs los datos, los borradores, la respuesta del
 *   modelo ni la clave.
 */

/**
 * Orígenes CORS (Fase 8, B-9): salen del secret `ALLOWED_ORIGINS`
 * (lista separada por comas); si falta, los tres actuales.
 */
const ALLOWED_ORIGINS = allowedOrigins((name) => Deno.env.get(name))

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'

/** Tiempo máximo de cada llamada al proveedor. */
const PROVIDER_TIMEOUT_MS = 60000

const DRAFTS_ERROR =
  'No se ha podido preparar el seguimiento. Inténtalo de nuevo.'

const DRAFTS_RULES_ERROR =
  'El borrador no ha pasado los controles. Vuelve a generarlo o escríbelo tú.'

const SYSTEM_PROMPT_BUYER =
  'Eres un asistente que redacta el mensaje que un agente inmobiliario envía a un comprador tras una visita. ' +
  'Escribe en español, con tuteo, cercano y profesional, entre 60 y 140 palabras. ' +
  'Empieza por «Hola {nombre},» y firma con «{agente}». ' +
  'Escribe los marcadores {nombre}, {inmueble} y {agente} tal cual, sin sustituirlos por ningún nombre. ' +
  'Usa {inmueble} para referirte al inmueble. ' +
  'Responde a lo que el cliente pidió o a sus objeciones sin prometer nada que no esté en los datos. ' +
  'Si hay una cita pendiente, NUNCA la des por confirmada: propón confirmarla y pregunta qué falta (por ejemplo, la hora). ' +
  'No menciones el presupuesto ni la financiación. ' +
  'No inventes ningún dato. ' +
  'No afirmes nada del inmueble, del barrio ni del edificio que no esté en los datos. ' +
  'Devuelve SOLO un objeto JSON {"draft": "...", "tasks": [{"description": "...", "fact_index": n}]} ' +
  'con las tareas que el agente debería hacer a partir de los datos (máximo 10, descripción breve de 3 a 200 caracteres, fact_index es la posición del dato en la lista enviada, empezando en 0).'

const SYSTEM_PROMPT_OWNER =
  'Eres un asistente que redacta el mensaje que un agente inmobiliario envía al propietario de un inmueble tras una visita. ' +
  'Escribe en español, con usted, entre 50 y 120 palabras. ' +
  'Empieza por «Hola {propietario},» y firma con «{agente}». ' +
  'Escribe los marcadores {propietario}, {inmueble} y {agente} tal cual, sin sustituirlos por ningún nombre. ' +
  'Usa {inmueble} para referirte al inmueble. ' +
  'Al cliente llámalo «el cliente» o «la persona interesada», nunca por su nombre. ' +
  'No menciones el presupuesto, ofertas ni la situación económica del comprador. ' +
  'Si hay una cita pendiente, NUNCA la des por confirmada. ' +
  'No inventes ningún dato. ' +
  'No afirmes nada del inmueble, del barrio ni del edificio que no esté en los datos. ' +
  'Devuelve SOLO un objeto JSON {"draft": "..."}.'

const bodySchema = z.object({
  visit_note_id: z.string().uuid(),
  audience: z.enum(['comprador', 'propietario']).optional(),
})

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

/**
 * Límite diario de IA (Fase 8): cuenta las filas de `ai_calls` de
 * este agente desde las 00:00 de Europe/Madrid; si llega al límite
 * (secret `AI_DAILY_LIMIT`, 150 por defecto), devuelve la respuesta
 * 429 y no llama al proveedor. Si no, inserta su fila y sigue. Los
 * reintentos internos de una misma llamada cuentan como una (una
 * sola fila por invocación). Si la base falla, 502 genérico.
 */
async function checkDailyLimit(
  supabase: ReturnType<typeof createClient>,
  origin: string | null,
): Promise<Response | null> {
  const limit = parseDailyLimit(Deno.env.get('AI_DAILY_LIMIT'))
  const dayStart = madridDayStart(new Date())
  const { count, error } = await supabase
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('fn', 'drafts')
    .gte('created_at', dayStart.toISOString())
  if (error !== null) {
    return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
  }
  if ((count ?? 0) >= limit) {
    return jsonResponse(
      { error: 'limite_diario_ia', message: DAILY_LIMIT_MESSAGE },
      429,
      origin,
    )
  }
  const { error: insertError } = await supabase
    .from('ai_calls')
    .insert({ fn: 'drafts' })
  if (insertError !== null) {
    return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
  }
  return null
}

type ProviderConfig = {
  apiUrl: string
  model: string
  apiKey: string
}

/** Una llamada al modelo: 502 si falla la red, el proveedor o el JSON. */
async function callModel(
  config: ProviderConfig,
  systemPrompt: string,
  userContent: string,
): Promise<{ ok: true; content: string } | { ok: false }> {
  let providerResponse: Response
  try {
    providerResponse = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
  } catch {
    return { ok: false }
  }
  if (!providerResponse.ok) {
    return { ok: false }
  }
  let providerJson: unknown
  try {
    providerJson = await providerResponse.json()
  } catch {
    return { ok: false }
  }
  const content = (
    providerJson as {
      choices?: Array<{ message?: { content?: unknown } }>
    } | null
  )?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    return { ok: false }
  }
  return { ok: true, content }
}

type DraftOutcome =
  | { ok: true; text: string; retries: number; tasks: { description: string; fact_index: number }[] }
  | { ok: false; failed: 'provider' }
  | { ok: false; failed: 'rules' }

/**
 * Genera un borrador: llama al modelo, valida con las reglas y, si
 * el borrador no pasa, repite la llamada UNA vez con el motivo
 * añadido al mensaje del sistema. `tasks` solo se piden (y se
 * devuelven) en la llamada del comprador sin `audience`.
 */
async function generateDraft(
  audience: DraftAudience,
  config: ProviderConfig,
  systemPrompt: string,
  userContent: string,
  facts: FactInput[],
  placeholders: PlaceholderValues,
  clientFullName: string,
  budgetValues: string[],
  wantTasks: boolean,
): Promise<DraftOutcome> {
  let retries = 0
  let system = systemPrompt
  for (let attempt = 0; attempt < 2; attempt++) {
    const called = await callModel(config, system, userContent)
    if (!called.ok) {
      return { ok: false, failed: 'provider' }
    }
    if (audience === 'comprador') {
      const parsed = parseBuyerResponse(called.content)
      if (!parsed.ok) {
        return { ok: false, failed: 'provider' }
      }
      const checked = validateDraft(parsed.data.draft, audience, {
        facts,
        budgetValues,
        clientFullName,
        placeholders,
      })
      if (checked.ok) {
        return {
          ok: true,
          text: checked.text,
          retries,
          tasks: wantTasks ? parsed.data.tasks : [],
        }
      }
      if (attempt === 0) {
        retries = 1
        system = `${systemPrompt} El borrador anterior fue rechazado porque ${checked.reason}. Corrige solo eso, sin cambiar nada más.`
        continue
      }
      return { ok: false, failed: 'rules' }
    }
    const parsed = parseOwnerResponse(called.content)
    if (!parsed.ok) {
      return { ok: false, failed: 'provider' }
    }
    const checked = validateDraft(parsed.data.draft, audience, {
      facts,
      budgetValues,
      clientFullName,
      placeholders,
    })
    if (checked.ok) {
      return { ok: true, text: checked.text, retries, tasks: [] }
    }
    if (attempt === 0) {
      retries = 1
      system = `${systemPrompt} El borrador anterior fue rechazado porque ${checked.reason}. Corrige solo eso, sin cambiar nada más.`
      continue
    }
    return { ok: false, failed: 'rules' }
  }
  return { ok: false, failed: 'rules' }
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
  const audience = parsed.data.audience

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
    .select('id, client_id, property_id, status')
    .eq('id', visitNoteId)
    .maybeSingle()
  if (noteError !== null || note === null) {
    return jsonResponse({ error: 'No encontrado' }, 404, origin)
  }

  // 2. Solo una nota aprobada tiene seguimiento.
  if (note.status !== 'approved') {
    return jsonResponse(
      { error: 'Aprueba la nota antes de preparar el seguimiento' },
      409,
      origin,
    )
  }

  // 3. Datos no descartados, en orden, con su id (para source_fact_id).
  const { data: factRows, error: factsError } = await supabase
    .from('extracted_facts')
    .select('id, category, field_name, value')
    .eq('visit_note_id', visitNoteId)
    .neq('review_status', 'descartado')
    .order('created_at', { ascending: true })
  if (factsError !== null) {
    return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
  }
  const facts = (factRows ?? []) as Array<{
    id: string
    category: string
    field_name: string
    value: string
  }>
  if (facts.length === 0) {
    return jsonResponse(
      { error: 'La nota no tiene datos para preparar el seguimiento' },
      400,
      origin,
    )
  }

  // 4. Cliente, inmueble y agente: los nombres y la dirección se
  //    quedan en la función, no se envían al modelo.
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('full_name, is_temporary')
    .eq('id', note.client_id)
    .maybeSingle()
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('reference, address, owner_name')
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
    clientError !== null ||
    propertyError !== null ||
    agentError !== null ||
    client === null ||
    property === null ||
    agent === null
  ) {
    return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
  }

  // 5. Si el borrador pedido ya está aprobado, no se regenera.
  const audiences: DraftAudience[] =
    audience === undefined ? ['comprador', 'propietario'] : [audience]
  const { data: existingDrafts, error: existingError } = await supabase
    .from('drafts')
    .select('audience, status')
    .eq('visit_note_id', visitNoteId)
    .in('audience', audiences)
  if (existingError !== null) {
    return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
  }
  const alreadyApproved = (existingDrafts ?? []).some(
    (draft) => draft.status === 'aprobado',
  )
  if (alreadyApproved) {
    return jsonResponse({ error: 'El borrador ya está aprobado' }, 409, origin)
  }

  // 6. Proveedor: `DRAFT_*` con fallback a `EXTRACT_*`.
  const apiUrl = Deno.env.get('DRAFT_API_URL') ?? Deno.env.get('EXTRACT_API_URL')
  const model = Deno.env.get('DRAFT_MODEL') ?? Deno.env.get('EXTRACT_MODEL')
  const apiKey =
    Deno.env.get('DRAFT_API_KEY') ?? Deno.env.get('EXTRACT_API_KEY')
  if (apiUrl === undefined || model === undefined || apiKey === undefined) {
    return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
  }
  const config: ProviderConfig = { apiUrl, model, apiKey }

  // 6b. Límite diario de IA (Fase 8): antes de llamar al proveedor.
  //      Una invocación cuenta como un uso aunque haga dos llamadas
  //      al modelo (los dos borradores) o reintente.
  const limitResponse = await checkDailyLimit(supabase, origin)
  if (limitResponse !== null) {
    return limitResponse
  }

  // 7. Datos para el modelo: solo categoría, nombre y valor.
  const buyerData = buyerFacts(facts)
  const ownerData = ownerFacts(facts)
  const userContent = (data: FactInput[]): string =>
    JSON.stringify({ inmueble: property.reference, datos: data })

  // Cliente provisional (`is_temporary`, creado rápido en la captura):
  // el saludo va sin nombre («Hola,»).
  const isProvisional = client.is_temporary === true
  // El valor del presupuesto se comprueba con TODOS los datos: los del
  // propietario (`ownerData`) ya no lo llevan.
  const budgetValues = budgetValuesOf(facts)
  const placeholders: PlaceholderValues = {
    clientFirstName: isProvisional ? null : firstName(client.full_name),
    isProvisional,
    ownerFirstName: firstName(property.owner_name ?? ''),
    inmueble: `${property.reference} (${property.address ?? ''})`,
    agente: agent.full_name,
  }

  // 8. Llamadas al modelo en paralelo. Con `audience` solo la pedida;
  //    con `audience='comprador'` no se piden tareas.
  const wantTasks = audience === undefined
  const buyerSystem = wantTasks
    ? SYSTEM_PROMPT_BUYER
    : `${SYSTEM_PROMPT_BUYER} No incluyas tareas en la respuesta.`
  const outcomes = await Promise.all(
    audiences.map((aud) =>
      aud === 'comprador'
        ? generateDraft(
            aud,
            config,
            buyerSystem,
            userContent(buyerData),
            buyerData,
            placeholders,
            client.full_name,
            budgetValues,
            wantTasks,
          )
        : generateDraft(
            aud,
            config,
            SYSTEM_PROMPT_OWNER,
            userContent(ownerData),
            ownerData,
            placeholders,
            client.full_name,
            budgetValues,
            false,
          ),
    ),
  )

  // 9. Fallo del proveedor o del JSON → 502 y nada escrito.
  if (outcomes.some((outcome) => !outcome.ok && outcome.failed === 'provider')) {
    return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
  }

  // 10. Tareas definitivas (solo sin `audience`): las de la IA más
  //     las de regla que falten. Si el borrador del comprador dio
  //     422, las tareas de regla se generan igual (sin las de la IA):
  //     las citas pendientes necesitan su tarea aunque el borrador
  //     no pasara los controles.
  const buyerOutcome = outcomes[audiences.indexOf('comprador')]
  const tasks = wantTasks
    ? requiredTasks(
        buyerData,
        buyerOutcome !== undefined && buyerOutcome.ok
          ? buyerOutcome.tasks
          : [],
      )
    : []
  const tasksByRule = tasks.filter((task) => task.origin === 'regla').length

  // 11. Guardar lo que pasó. El borrador que falló las reglas no se
  //     guarda; el otro, sí.
  let retries = 0
  const savedAudiences: DraftAudience[] = []
  for (let i = 0; i < audiences.length; i++) {
    const aud = audiences[i]
    const outcome = outcomes[i]
    if (outcome === undefined || !outcome.ok) {
      continue
    }
    retries += outcome.retries
    const { error: deleteError } = await supabase
      .from('drafts')
      .delete()
      .eq('visit_note_id', visitNoteId)
      .eq('audience', aud)
      .eq('status', 'borrador')
    if (deleteError !== null) {
      return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
    }
    const { error: insertError } = await supabase.from('drafts').insert({
      visit_note_id: visitNoteId,
      audience: aud,
      content: outcome.text,
      is_sensitive_filtered: true,
      status: 'borrador',
    })
    if (insertError !== null) {
      return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
    }
    savedAudiences.push(aud)
  }

  if (wantTasks && tasks.length > 0) {
    const { error: deleteTasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('visit_note_id', visitNoteId)
      .in('status', ['propuesta', 'descartada'])
      .in('origin', ['ia', 'regla'])
    if (deleteTasksError !== null) {
      return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
    }
    const { error: insertTasksError } = await supabase.from('tasks').insert(
      tasks.map((task) => ({
        visit_note_id: visitNoteId,
        description: task.description,
        status: 'propuesta' as const,
        origin: task.origin,
        source_fact_id: facts[task.fact_index]?.id ?? null,
      })),
    )
    if (insertTasksError !== null) {
      return jsonResponse({ error: DRAFTS_ERROR }, 502, origin)
    }
  }

  // 12. Si algún borrador no pasó los controles, 422 (lo demás ya
  //     está guardado).
  if (outcomes.some((outcome) => !outcome.ok && outcome.failed === 'rules')) {
    return jsonResponse({ error: DRAFTS_RULES_ERROR }, 422, origin)
  }

  return jsonResponse(
    {
      drafts: savedAudiences,
      tasks_proposed: tasks.length,
      tasks_by_rule: tasksByRule,
      retries,
    },
    200,
    origin,
  )
})
