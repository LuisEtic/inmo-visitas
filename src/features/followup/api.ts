import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import type {
  DraftAudience,
  DraftInsert,
  DraftRow,
  DraftUpdate,
} from '../../lib/database.types'
import {
  acceptTask,
  createTask,
  discardTask,
  editTask,
  listNoteTasks,
  restoreTask,
} from '../tasks/api'

export {
  acceptTask,
  createTask,
  discardTask,
  editTask,
  listNoteTasks,
  restoreTask,
}

/**
 * Capa de datos del seguimiento (Fase 6): borradores duales y tareas
 * de una nota aprobada. Las tareas viven en `tasks/api.ts`; aquí se
 * reexportan las de la nota para que la pantalla no importe de dos
 * sitios. Todas las consultas pasan por RLS.
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

export type PrepareFollowUpResult = {
  drafts: DraftAudience[]
  tasks_proposed: number
  tasks_by_rule: number
  retries: number
}

const DRAFTS_ERROR =
  'No se ha podido preparar el seguimiento. Inténtalo de nuevo.'

/** Mensaje de la función cuando un borrador no pasó los controles (422). */
export const DRAFTS_RULES_ERROR =
  'El borrador no ha pasado los controles. Vuelve a generarlo o escríbelo tú.'

/** Error que marca un 422, para que la pantalla ofrezca «Escribir yo». */
export class DraftsRulesError extends Error {
  constructor() {
    super(DRAFTS_RULES_ERROR)
    this.name = 'DraftsRulesError'
  }
}

/**
 * Llama a la Edge Function `drafts`: sin `audience` prepara los dos
 * borradores y las tareas propuestas; con `audience` solo regenera
 * ese borrador («Volver a generar»). Los 400/409/422 traen un mensaje
 * en español propio de la función que se muestra tal cual; el resto
 * (401, 404, 502, red) se queda en el mensaje genérico.
 */
export async function prepareFollowUp(
  noteId: string,
  audience?: DraftAudience,
): Promise<PrepareFollowUpResult> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('drafts', {
    body:
      audience === undefined
        ? { visit_note_id: noteId }
        : { visit_note_id: noteId, audience },
  })
  if (error !== null) {
    throw await prepareFollowUpError(error)
  }
  const result = data as PrepareFollowUpResult | null
  if (
    result === null ||
    !Array.isArray(result.drafts) ||
    typeof result.tasks_proposed !== 'number' ||
    typeof result.tasks_by_rule !== 'number' ||
    typeof result.retries !== 'number'
  ) {
    throw new Error(DRAFTS_ERROR)
  }
  return result
}

async function prepareFollowUpError(error: unknown): Promise<Error> {
  if (!(error instanceof FunctionsHttpError)) {
    return new Error(DRAFTS_ERROR)
  }
  const response: unknown = error.context
  if (!(response instanceof Response)) {
    return new Error(DRAFTS_ERROR)
  }
  if (response.status === 422) {
    return new DraftsRulesError()
  }
  if (response.status !== 400 && response.status !== 409) {
    return new Error(DRAFTS_ERROR)
  }
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error !== ''
    ) {
      return new Error(body.error)
    }
  } catch {
    // Cuerpo no JSON: mensaje genérico.
  }
  return new Error(DRAFTS_ERROR)
}

/** Borradores de una nota, comprador primero y propietario después. */
export async function listDrafts(noteId: string): Promise<DraftRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('drafts')
    .select('*')
    .eq('visit_note_id', noteId)
    .order('created_at', { ascending: true })
  if (error !== null) {
    throw new Error(translateDbError(error, { drafts: true }))
  }
  return (data ?? []).sort((a, b) =>
    a.audience === b.audience
      ? 0
      : a.audience === 'comprador'
        ? -1
        : 1,
  )
}

/**
 * Guardar los cambios de un borrador editado (1–1500 caracteres).
 * El guard guarda el texto anterior en `original_content` la primera
 * vez y rechaza cambiar un borrador aprobado (`borrador_aprobado`).
 */
export async function saveDraft(
  id: string,
  content: string,
): Promise<DraftRow> {
  const client = requireSupabase()
  const update: DraftUpdate = { content }
  const { data, error } = await client
    .from('drafts')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error, { drafts: true }))
  }
  return data
}

/**
 * Aprobar un borrador: queda en `aprobado` y ya no se puede cambiar.
 * La base pone `approved_at`.
 */
export async function approveDraft(id: string): Promise<DraftRow> {
  const client = requireSupabase()
  const update: DraftUpdate = { status: 'aprobado' }
  const { data, error } = await client
    .from('drafts')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error, { drafts: true }))
  }
  return data
}

/**
 * Crear un borrador a mano («Escribir yo» tras un 422): 1–1500
 * caracteres, `is_sensitive_filtered = true`. Si ya hay un borrador
 * para ese destinatario, la base devuelve 23505 («Ya hay un borrador
 * para este destinatario; vuelve a generarlo»).
 */
export async function createManualDraft(
  noteId: string,
  audience: DraftAudience,
  content: string,
): Promise<DraftRow> {
  const client = requireSupabase()
  const insert: DraftInsert = {
    visit_note_id: noteId,
    audience,
    content,
    is_sensitive_filtered: true,
    status: 'borrador',
  }
  const { data, error } = await client
    .from('drafts')
    .insert(insert)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error, { drafts: true }))
  }
  return data
}
