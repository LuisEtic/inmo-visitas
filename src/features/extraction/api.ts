import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { translateDbError, translateLimitError } from '../../lib/db-errors'
import type {
  ExtractedFactInsert,
  ExtractedFactRow,
  ExtractedFactUpdate,
  FactCategory,
} from '../../lib/database.types'

/**
 * Capa de datos de extracción (Fase 5). Todas las consultas pasan por
 * RLS: cada agente solo ve y modifica sus propios datos.
 * La extracción en sí la hace la Edge Function `extract`; aquí solo se
 * leen y revisan los datos que ya están en `extracted_facts`.
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

export type ExtractResult = {
  facts_inserted: number
  discarded_no_evidence: number
  discarded_sensitive: number
}

export async function listFacts(noteId: string): Promise<ExtractedFactRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('extracted_facts')
    .select('*')
    .eq('visit_note_id', noteId)
    .order('created_at', { ascending: true })
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data ?? []
}

/**
 * Llama a la Edge Function `extract` para una nota transcrita.
 * Devuelve cuántos datos se insertaron y cuántos se descartaron.
 * Si la función falla (502, nota de otro agente, sin JWT), el mensaje
 * es el mismo en español y la nota no cambia.
 */
export async function extractNote(noteId: string): Promise<ExtractResult> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('extract', {
    body: { visit_note_id: noteId },
  })
  if (error !== null) {
    throw new Error(await extractErrorMessage(error))
  }
  const result = data as ExtractResult | null
  if (
    result === null ||
    typeof result.facts_inserted !== 'number' ||
    typeof result.discarded_no_evidence !== 'number' ||
    typeof result.discarded_sensitive !== 'number'
  ) {
    throw new Error(EXTRACT_ERROR)
  }
  return result
}

const EXTRACT_ERROR = 'No se han podido extraer los datos. Inténtalo de nuevo.'

/**
 * Mensaje para el agente cuando falla `extract`. Los 400 («La nota no
 * tiene texto para extraer») y 409 («La nota ya está en revisión») traen
 * un mensaje en español propio de la función que se muestra tal cual;
 * el 429 del límite diario muestra su mensaje en español; el resto
 * (401, 404, 502, red) se queda en el mensaje genérico.
 */
async function extractErrorMessage(error: unknown): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) {
    return EXTRACT_ERROR
  }
  const response: unknown = error.context
  if (!(response instanceof Response)) {
    return EXTRACT_ERROR
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Cuerpo no JSON: mensaje genérico (o límite sin texto).
  }
  if (response.status === 429) {
    return translateLimitError(body)
  }
  if (response.status !== 400 && response.status !== 409) {
    return EXTRACT_ERROR
  }
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string' &&
    body.error !== ''
  ) {
    return body.error
  }
  return EXTRACT_ERROR
}

export type ReviewAction = 'aceptar' | 'editar' | 'descartar' | 'recuperar'

/**
 * Pasa la nota a `reviewed` si estaba en `extracted`: la primera
 * acción de revisión (aceptar, editar, descartar, añadir) marca la
 * nota como en revisión. No falla si la nota ya está en otro estado.
 */
async function markNoteReviewed(noteId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('visit_notes')
    .update({ status: 'reviewed' })
    .eq('id', noteId)
    .eq('status', 'extracted')
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
}

/**
 * Revisa un dato: aceptar, editar (guarda `original_value` la primera
 * vez), descartar (no se borra) o recuperar (vuelve a `propuesto`).
 * Cada acción pone `reviewed_at = now()`.
 */
export async function reviewFact(
  id: string,
  action: ReviewAction,
  value?: string,
): Promise<ExtractedFactRow> {
  const client = requireSupabase()
  let update: ExtractedFactUpdate
  if (action === 'editar') {
    if (value === undefined) {
      throw new Error('Falta el valor editado.')
    }
    const { data: current, error: readError } = await client
      .from('extracted_facts')
      .select('value, original_value, visit_note_id')
      .eq('id', id)
      .maybeSingle()
    if (readError !== null || current === null) {
      throw new Error(
        readError !== null
          ? translateDbError(readError)
          : 'No se ha podido revisar el dato.',
      )
    }
    update = {
      value,
      review_status: 'editado',
      original_value: current.original_value ?? current.value,
      reviewed_at: new Date().toISOString(),
    }
  } else {
    const reviewStatus =
      action === 'aceptar'
        ? 'aceptado'
        : action === 'descartar'
          ? 'descartado'
          : 'propuesto'
    update = {
      review_status: reviewStatus,
      reviewed_at: new Date().toISOString(),
    }
  }
  const { data, error } = await client
    .from('extracted_facts')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  await markNoteReviewed(data.visit_note_id)
  return data
}

/**
 * Añade un dato a mano: `origin = 'agente'`, `review_status =
 * 'aceptado'` y `confidence` null. La cita es opcional.
 */
export async function addFact(
  noteId: string,
  input: {
    category: FactCategory
    field_name: string
    value: string
    evidence_quote?: string | null
  },
): Promise<ExtractedFactRow> {
  const client = requireSupabase()
  const insert: ExtractedFactInsert = {
    visit_note_id: noteId,
    category: input.category,
    field_name: input.field_name,
    value: input.value,
    evidence_quote: input.evidence_quote ?? null,
    confidence: null,
    origin: 'agente',
    review_status: 'aceptado',
    reviewed_at: new Date().toISOString(),
  }
  const { data, error } = await client
    .from('extracted_facts')
    .insert(insert)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  await markNoteReviewed(noteId)
  return data
}

/**
 * Aprueba la nota (`status = 'approved'`). La base pone `approved_at`
 * y bloquea aprobar con datos `propuesto` (error `datos_sin_revisar`,
 * traducido a español).
 */
export async function approveNote(noteId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('visit_notes')
    .update({ status: 'approved' })
    .eq('id', noteId)
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
}
