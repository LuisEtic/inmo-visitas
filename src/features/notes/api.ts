import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import type {
  VisitNoteInsert,
  VisitNoteRow,
  VisitNoteUpdate,
} from '../../lib/database.types'

/**
 * Capa de datos de notas de visita (Fase 4). Todas las consultas pasan
 * por RLS: cada agente solo ve y modifica sus propias notas.
 * El `agent_id` NO se envía desde el frontend: lo pone la base con
 * `default auth.uid()` y RLS lo comprueba. La única excepción es la
 * ruta del audio en Storage (`<agent_id>/<visit_note_id>.<ext>`), que
 * usa el id de la sesión solo como segmento de la ruta.
 */

const AUDIO_BUCKET = 'visit-audio'

/** La transcripción solo se escucha con URL firmada de 5 minutos. */
const SIGNED_URL_SECONDS = 300

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

export async function getNote(id: string): Promise<VisitNoteRow | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('visit_notes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data
}

function toInsert(values: VisitNoteInsert): VisitNoteInsert {
  return values
}

/** Nota de texto: queda en estado `transcribed` (texto listo). */
export async function createTextNote(
  clientId: string,
  propertyId: string,
  rawText: string,
): Promise<VisitNoteRow> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('visit_notes')
    .insert(
      toInsert({
        client_id: clientId,
        property_id: propertyId,
        input_type: 'text',
        raw_text: rawText,
        audio_url: null,
        transcript: null,
        status: 'transcribed',
      }),
    )
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data
}

/** Nota de voz sin audio todavía: estado `draft`, `audio_url` null. */
export async function createAudioDraftNote(
  clientId: string,
  propertyId: string,
): Promise<VisitNoteRow> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('visit_notes')
    .insert(
      toInsert({
        client_id: clientId,
        property_id: propertyId,
        input_type: 'audio',
        raw_text: null,
        audio_url: null,
        transcript: null,
        status: 'draft',
      }),
    )
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data
}

/** Sube el audio grabado a `visit-audio/<agent_id>/<nota>.<ext>`. */
export async function uploadAudio(
  agentId: string,
  noteId: string,
  blob: Blob,
  extension: string,
): Promise<string> {
  const client = requireSupabase()
  const path = `${agentId}/${noteId}.${extension}`
  const { error } = await client.storage
    .from(AUDIO_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false })
  if (error !== null) {
    throw new Error(
      'No se ha podido subir el audio. Revisa la conexión y vuelve a intentarlo.',
    )
  }
  return path
}

/** Guarda la ruta del audio en la nota (nunca una URL pública). */
export async function setAudioUrl(noteId: string, path: string): Promise<void> {
  const client = requireSupabase()
  const update: VisitNoteUpdate = { audio_url: path }
  const { error } = await client
    .from('visit_notes')
    .update(update)
    .eq('id', noteId)
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
}

/** URL firmada de 5 minutos para escuchar el audio. */
export async function getSignedAudioUrl(path: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error !== null || data === null) {
    throw new Error('No se ha podido cargar el audio. Inténtalo de nuevo.')
  }
  return data.signedUrl
}

/** Corrige a mano la transcripción (audio) o el texto (nota de texto). */
export async function updateNoteText(
  noteId: string,
  field: 'transcript' | 'raw_text',
  value: string,
): Promise<void> {
  const client = requireSupabase()
  const update: VisitNoteUpdate = { [field]: value }
  const { error } = await client
    .from('visit_notes')
    .update(update)
    .eq('id', noteId)
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
}

/**
 * Llama a la Edge Function `transcribe` para una nota de voz.
 * Devuelve la transcripción. Si la función falla (502, nota de otro
 * agente, sin JWT), el mensaje es el mismo en español y la nota se
 * queda en `draft`; el detalle del proveedor nunca llega al cliente.
 */
export async function transcribeNote(noteId: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('transcribe', {
    body: { visit_note_id: noteId },
  })
  if (error !== null) {
    throw new Error('No se ha podido transcribir. Inténtalo de nuevo.')
  }
  const transcript = (data as { transcript?: unknown } | null)?.transcript
  if (typeof transcript !== 'string' || transcript === '') {
    throw new Error('No se ha podido transcribir. Inténtalo de nuevo.')
  }
  return transcript
}
