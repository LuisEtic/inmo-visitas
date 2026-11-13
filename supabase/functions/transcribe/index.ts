import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import { allowedOrigins } from './cors.ts'
import {
  DAILY_LIMIT_MESSAGE,
  madridDayStart,
  parseDailyLimit,
} from './limit.ts'

/**
 * Edge Function `transcribe` (Fase 4): transcribe el audio de una nota
 * de visita con Whisper (en pruebas, Groq `whisper-large-v3-turbo`).
 *
 * - Autenticación: Supabase verifica el JWT por defecto. Dentro, el
 *   cliente se crea con la clave anon y la cabecera `Authorization` de
 *   la petición, así todas las lecturas y escrituras pasan por RLS
 *   como ese agente. NUNCA `service_role`.
 * - Proveedor configurable por secrets: `TRANSCRIBE_API_URL`,
 *   `TRANSCRIBE_MODEL` y `TRANSCRIBE_API_KEY`. Sin valores por
 *   defecto en el código: cambiar de proveedor es cambiar los
 *   secrets, sin tocar la función.
 * - Nunca se devuelven al cliente los mensajes del proveedor ni se
 *   escriben en los logs la transcripción, el audio o la clave.
 */

/**
 * Orígenes CORS (Fase 8, B-9): salen del secret `ALLOWED_ORIGINS`
 * (lista separada por comas); si falta, los tres actuales.
 */
const ALLOWED_ORIGINS = allowedOrigins((name) => Deno.env.get(name))

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type'

/** Tamaño máximo de audio que se transcribe: 10 MB (igual que el bucket). */
const MAX_AUDIO_BYTES = 10485760

/** Tiempo máximo de la llamada al proveedor de transcripción. */
const PROVIDER_TIMEOUT_MS = 60000

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
    .eq('fn', 'transcribe')
    .gte('created_at', dayStart.toISOString())
  if (error !== null) {
    return jsonResponse(
      { error: 'No se ha podido transcribir. Inténtalo de nuevo.' },
      502,
      origin,
    )
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
    .insert({ fn: 'transcribe' })
  if (insertError !== null) {
    return jsonResponse(
      { error: 'No se ha podido transcribir. Inténtalo de nuevo.' },
      502,
      origin,
    )
  }
  return null
}

function extensionOf(path: string): string {
  const last = path.split('/').at(-1) ?? ''
  const dot = last.lastIndexOf('.')
  return dot === -1 ? '' : last.slice(dot + 1).toLowerCase()
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
    .select('id, input_type, audio_url, transcript, status')
    .eq('id', visitNoteId)
    .maybeSingle()
  if (noteError !== null || note === null) {
    return jsonResponse({ error: 'No encontrado' }, 404, origin)
  }

  // 2. Solo notas de voz con audio. Si ya está transcrita, no gastar
  //    otra llamada al proveedor.
  if (note.input_type !== 'audio' || note.audio_url === null) {
    return jsonResponse({ error: 'La nota no tiene audio para transcribir' }, 400, origin)
  }
  if (note.status === 'transcribed' && typeof note.transcript === 'string') {
    return jsonResponse({ transcript: note.transcript }, 200, origin)
  }

  // 3. Descargar el audio de Storage con ese mismo cliente (RLS).
  const { data: audio, error: downloadError } = await supabase.storage
    .from('visit-audio')
    .download(note.audio_url)
  if (downloadError !== null || audio === null) {
    return jsonResponse({ error: 'No se ha podido transcribir. Inténtalo de nuevo.' }, 502, origin)
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonResponse({ error: 'El audio es demasiado grande' }, 413, origin)
  }

  // 3b. Límite diario de IA (Fase 8): antes de llamar al proveedor.
  //      Una respuesta ya guardada no cuenta (arriba, paso 2).
  const limitResponse = await checkDailyLimit(supabase, origin)
  if (limitResponse !== null) {
    return limitResponse
  }

  // 4. Llamar al proveedor (API compatible con OpenAI).
  const apiUrl = Deno.env.get('TRANSCRIBE_API_URL')
  const model = Deno.env.get('TRANSCRIBE_MODEL')
  const apiKey = Deno.env.get('TRANSCRIBE_API_KEY')
  if (apiUrl === undefined || model === undefined || apiKey === undefined) {
    return jsonResponse({ error: 'No se ha podido transcribir. Inténtalo de nuevo.' }, 502, origin)
  }

  const extension = extensionOf(note.audio_url)
  const form = new FormData()
  form.append(
    'file',
    audio,
    `audio.${extension === '' ? 'webm' : extension}`,
  )
  form.append('model', model)
  form.append('language', 'es')
  form.append('response_format', 'json')

  let providerResponse: Response
  try {
    providerResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
  } catch {
    return jsonResponse({ error: 'No se ha podido transcribir. Inténtalo de nuevo.' }, 502, origin)
  }
  if (!providerResponse.ok) {
    return jsonResponse({ error: 'No se ha podido transcribir. Inténtalo de nuevo.' }, 502, origin)
  }

  let providerJson: unknown
  try {
    providerJson = await providerResponse.json()
  } catch {
    return jsonResponse({ error: 'No se ha podido transcribir. Inténtalo de nuevo.' }, 502, origin)
  }
  const transcript = (providerJson as { text?: unknown } | null)?.text
  if (typeof transcript !== 'string' || transcript.trim() === '') {
    return jsonResponse({ error: 'No se ha podido transcribir. Inténtalo de nuevo.' }, 502, origin)
  }

  // 5. Guardar la transcripción (RLS) y 6. responder.
  const { error: updateError } = await supabase
    .from('visit_notes')
    .update({ transcript, status: 'transcribed' })
    .eq('id', visitNoteId)
  if (updateError !== null) {
    return jsonResponse({ error: 'No se ha podido transcribir. Inténtalo de nuevo.' }, 502, origin)
  }

  return jsonResponse({ transcript }, 200, origin)
})
