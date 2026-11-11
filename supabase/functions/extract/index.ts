import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import { applyExtractionRules, parseModelResponse } from './rules.ts'

/**
 * Edge Function `extract` (Fase 5): extrae datos estructurados de una
 * nota de visita con un modelo de lenguaje por la API de chat compatible
 * con OpenAI (en pruebas, Gemini Flash).
 *
 * - Autenticación: Supabase verifica el JWT por defecto. Dentro, el
 *   cliente se crea con la clave anon y la cabecera `Authorization` de
 *   la petición, así todas las lecturas y escrituras pasan por RLS
 *   como ese agente. NUNCA `service_role`.
 * - Proveedor configurable por secrets: `EXTRACT_API_URL`,
 *   `EXTRACT_MODEL` y `EXTRACT_API_KEY`. Sin valores por defecto en el
 *   código: cambiar de proveedor es cambiar los secrets, sin tocar la
 *   función.
 * - Minimización de datos (RGPD): al modelo solo se envía el texto de
 *   la nota (`transcript ?? raw_text`). Ni teléfonos, ni emails, ni el
 *   nombre del propietario, ni el precio del inmueble.
 * - Las reglas mandan sobre la IA (`rules.ts`): se descarta todo dato
 *   cuya cita no aparezca literalmente en el texto y todo campo
 *   sensible del art. 9 RGPD.
 * - Nunca se devuelven al cliente los mensajes del proveedor ni se
 *   escriben en los logs el texto de la nota, los datos extraídos, la
 *   respuesta del modelo ni la clave.
 */

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'https://luisetic.github.io',
])

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'

/** Tiempo máximo de la llamada al proveedor de extracción. */
const PROVIDER_TIMEOUT_MS = 60000

const EXTRACT_ERROR = 'No se han podido extraer los datos. Inténtalo de nuevo.'

const SYSTEM_PROMPT =
  'Eres un asistente que extrae datos de la nota de un agente inmobiliario tras una visita. ' +
  'Devuelve SOLO un objeto JSON {"facts": [...]}. ' +
  'Cada dato: category, field_name (snake_case en español), value (breve), ' +
  'evidence_quote (fragmento COPIADO LITERALMENTE de la nota, sin cambiar ninguna palabra) ' +
  'y confidence (0 a 1). ' +
  'Categorías: hecho_declarado (lo que el cliente dijo o pidió; dato declarado, no comprobado), ' +
  'observacion (lo que el agente observó u opina), ' +
  'objecion (preocupaciones o pegas del cliente), ' +
  'presupuesto (cifra que el cliente declaró; es un presupuesto DECLARADO, nunca solvencia, financiación ni capacidad de pago acreditada), ' +
  'cita_pendiente (visitas o llamadas futuras; NUNCA las des por confirmadas salvo que la nota diga que están confirmadas con día y hora), ' +
  'desconocido (datos que faltan o están sin confirmar). ' +
  'No inventes nada que no esté en la nota. ' +
  'No extraigas datos de salud, origen, religión, ideología, orientación sexual ni otros datos especialmente protegidos. ' +
  'Si no hay datos, devuelve {"facts": []}.'

const bodySchema = z.object({
  visit_note_id: z.string().uuid(),
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
    .select('id, transcript, raw_text, status')
    .eq('id', visitNoteId)
    .maybeSingle()
  if (noteError !== null || note === null) {
    return jsonResponse({ error: 'No encontrado' }, 404, origin)
  }

  // 2. Solo `transcribed`, o `extracted` sin datos revisados
  //    («Volver a extraer»). Cualquier otro estado → 409.
  if (note.status !== 'transcribed' && note.status !== 'extracted') {
    return jsonResponse({ error: 'La nota ya está en revisión' }, 409, origin)
  }
  if (note.status === 'extracted') {
    const { data: facts, error: factsError } = await supabase
      .from('extracted_facts')
      .select('review_status')
      .eq('visit_note_id', visitNoteId)
    if (factsError !== null) {
      return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
    }
    const hasReviewed = (facts ?? []).some(
      (fact) => fact.review_status !== 'propuesto',
    )
    if (hasReviewed) {
      return jsonResponse({ error: 'La nota ya está en revisión' }, 409, origin)
    }
  }

  // 3. Texto fuente: solo el texto de la nota, recortado.
  const sourceText = (note.transcript ?? note.raw_text ?? '').trim()
  if (sourceText === '') {
    return jsonResponse({ error: 'La nota no tiene texto para extraer' }, 400, origin)
  }

  // 4. Llamar al proveedor (API de chat compatible con OpenAI).
  const apiUrl = Deno.env.get('EXTRACT_API_URL')
  const model = Deno.env.get('EXTRACT_MODEL')
  const apiKey = Deno.env.get('EXTRACT_API_KEY')
  if (apiUrl === undefined || model === undefined || apiKey === undefined) {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }

  let providerResponse: Response
  try {
    providerResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: sourceText },
        ],
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
  } catch {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }
  if (!providerResponse.ok) {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }

  // 5. Parsear y validar la respuesta del modelo (reglas en rules.ts).
  let providerJson: unknown
  try {
    providerJson = await providerResponse.json()
  } catch {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }
  const content = (providerJson as { choices?: Array<{ message?: { content?: unknown } }> } | null)
    ?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }
  const parsedResponse = parseModelResponse(content)
  if (!parsedResponse.ok) {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }
  const { kept, discardedNoEvidence, discardedSensitive } =
    applyExtractionRules(parsedResponse.facts, sourceText)

  // 6. Sustituir los datos propuestos por la IA (solo hay previos en
  //    «Volver a extraer»), insertar los nuevos y marcar la nota.
  const { error: deleteError } = await supabase
    .from('extracted_facts')
    .delete()
    .eq('visit_note_id', visitNoteId)
    .eq('origin', 'ia')
  if (deleteError !== null) {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }
  if (kept.length > 0) {
    const { error: insertError } = await supabase
      .from('extracted_facts')
      .insert(
        kept.map((fact) => ({
          visit_note_id: visitNoteId,
          category: fact.category,
          field_name: fact.field_name,
          value: fact.value,
          evidence_quote: fact.evidence_quote,
          confidence: fact.confidence,
          origin: 'ia',
          review_status: 'propuesto',
        })),
      )
    if (insertError !== null) {
      return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
    }
  }
  const { error: updateError } = await supabase
    .from('visit_notes')
    .update({ status: 'extracted', extracted_at: new Date().toISOString() })
    .eq('id', visitNoteId)
  if (updateError !== null) {
    return jsonResponse({ error: EXTRACT_ERROR }, 502, origin)
  }

  return jsonResponse(
    {
      facts_inserted: kept.length,
      discarded_no_evidence: discardedNoEvidence,
      discarded_sensitive: discardedSensitive,
    },
    200,
    origin,
  )
})
