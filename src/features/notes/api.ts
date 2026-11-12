import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import { matchesNoteQuery } from '../../lib/search'
import type {
  ClientRow,
  PropertyRow,
  VisitNoteInsert,
  VisitNoteRow,
  VisitNoteStatus,
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

export type NoteWithClientAndProperty = VisitNoteRow & {
  clients: Pick<ClientRow, 'full_name'> | null
  properties: Pick<PropertyRow, 'reference'> | null
}

export type ListNotesOptions = {
  status?: VisitNoteStatus | 'todas'
  query?: string
  /** Posición desde la que devolver notas (paginación de 25 en 25). */
  offset?: number
}

export type ListNotesResult = {
  notes: NoteWithClientAndProperty[]
  hasMore: boolean
  total: number
}

const NOTES_PAGE_SIZE = 25

async function fetchNotesWithClientAndProperty(
  statuses?: VisitNoteStatus[],
): Promise<NoteWithClientAndProperty[]> {
  const client = requireSupabase()
  let query = client
    .from('visit_notes')
    .select('*, clients(full_name), properties(reference)')
    .order('created_at', { ascending: false })
  if (statuses !== undefined && statuses.length > 0) {
    query = query.in('status', statuses)
  }
  const { data, error } = await query
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return (data ?? []) as unknown as NoteWithClientAndProperty[]
}

/**
 * Lista las notas del agente, las más recientes primero, con cliente
 * e inmueble. Filtra por estado y busca por cliente o referencia (sin
 * tildes) en el cliente, como en Clientes e Inmuebles, y pagina de 25
 * en 25 («Cargar más»).
 */
export async function listNotes(
  options: ListNotesOptions = {},
): Promise<ListNotesResult> {
  const { status = 'todas', query = '', offset = 0 } = options
  const all = await fetchNotesWithClientAndProperty(
    status === 'todas' ? undefined : [status],
  )
  const filtered = all.filter((note) =>
    matchesNoteQuery(
      {
        clientName: note.clients?.full_name ?? '',
        propertyReference: note.properties?.reference ?? '',
      },
      query,
    ),
  )
  return {
    notes: filtered.slice(offset, offset + NOTES_PAGE_SIZE),
    hasMore: offset + NOTES_PAGE_SIZE < filtered.length,
    total: filtered.length,
  }
}

/** Notas del agente en unos estados dados (bandeja de pendientes). */
export async function listNotesByStatus(
  statuses: VisitNoteStatus[],
): Promise<NoteWithClientAndProperty[]> {
  return fetchNotesWithClientAndProperty(statuses)
}

/** Notas del agente por id, con cliente e inmueble (bandeja de pendientes). */
export async function getNotesByIds(
  ids: string[],
): Promise<NoteWithClientAndProperty[]> {
  if (ids.length === 0) {
    return []
  }
  const client = requireSupabase()
  const { data, error } = await client
    .from('visit_notes')
    .select('*, clients(full_name), properties(reference)')
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return (data ?? []) as unknown as NoteWithClientAndProperty[]
}
