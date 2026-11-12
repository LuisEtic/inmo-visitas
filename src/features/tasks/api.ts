import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import type {
  DraftRow,
  ExtractedFactRow,
  TaskInsert,
  TaskRow,
  TaskUpdate,
  VisitNoteRow,
} from '../../lib/database.types'

/**
 * Capa de datos de tareas y borradores (Fase 6). Todas las consultas
 * pasan por RLS: cada agente solo ve y modifica sus propios datos.
 * Los borradores no tienen `agent_id`: se ven a través de su nota.
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

function taskError(error: PostgrestError): Error {
  return new Error(translateDbError(error, { task: true }))
}

/** Tareas `pendiente` del agente, con fecha primero y sin fecha al final. */
export async function listPendingTasks(): Promise<TaskRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('status', 'pendiente')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error !== null) {
    throw taskError(error)
  }
  return data ?? []
}

/** Tareas `completada` de los últimos 7 días, las más recientes primero. */
export async function listRecentCompletedTasks(): Promise<TaskRow[]> {
  const client = requireSupabase()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('status', 'completada')
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
  if (error !== null) {
    throw taskError(error)
  }
  return data ?? []
}

/** Tareas de una nota, en el orden en que se propusieron. */
export async function listNoteTasks(noteId: string): Promise<TaskRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('visit_note_id', noteId)
    .order('created_at', { ascending: true })
  if (error !== null) {
    throw taskError(error)
  }
  return data ?? []
}

/** Tareas `propuesta` del agente (sin revisar) con su nota. */
export async function listProposedTasks(): Promise<TaskRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('status', 'propuesta')
    .order('created_at', { ascending: true })
  if (error !== null) {
    throw taskError(error)
  }
  return data ?? []
}

/** Cuántas tareas `pendiente` tiene el agente (insignia de la barra). */
export async function countPendingTasks(): Promise<number> {
  const client = requireSupabase()
  const { count, error } = await client
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendiente')
  if (error !== null) {
    throw taskError(error)
  }
  return count ?? 0
}

/** Notas con al menos un borrador (para «Seguimiento: preparado»). */
export async function listDraftedNoteIds(): Promise<Set<string>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('drafts')
    .select('visit_note_id')
  if (error !== null) {
    throw new Error(translateDbError(error, { drafts: true }))
  }
  return new Set((data ?? []).map((row) => row.visit_note_id))
}

export type UnapprovedDraft = DraftRow & {
  note: Pick<VisitNoteRow, 'id' | 'client_id' | 'property_id'> & {
    clients: { full_name: string } | null
    properties: { reference: string } | null
  }
}

/** Borradores en `borrador` (por aprobar) con su nota, cliente e inmueble. */
export async function listUnapprovedDrafts(): Promise<UnapprovedDraft[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('drafts')
    .select(
      '*, note:visit_notes!inner(id, client_id, property_id, clients(full_name), properties(reference))',
    )
    .eq('status', 'borrador')
    .order('generated_at', { ascending: false })
  if (error !== null) {
    throw new Error(translateDbError(error, { drafts: true }))
  }
  return (data ?? []) as unknown as UnapprovedDraft[]
}

/** Datos de origen de unas tareas, para mostrar la cita («…»). */
export async function listSourceFacts(
  factIds: string[],
): Promise<ExtractedFactRow[]> {
  if (factIds.length === 0) {
    return []
  }
  const client = requireSupabase()
  const { data, error } = await client
    .from('extracted_facts')
    .select('*')
    .in('id', factIds)
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data ?? []
}

async function updateTask(
  id: string,
  update: TaskUpdate,
): Promise<TaskRow> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error !== null) {
    throw taskError(error)
  }
  return data
}

/**
 * Aceptar una tarea propuesta: pasa a `pendiente`, con la fecha que
 * elija el agente (opcional). La base de datos rechaza aceptar una
 * tarea que no esté en `propuesta` (`transicion_no_valida`).
 */
export async function acceptTask(
  id: string,
  dueDate?: string | null,
): Promise<TaskRow> {
  return updateTask(id, { status: 'pendiente', due_date: dueDate ?? null })
}

/** Descartar una tarea propuesta o pendiente. */
export async function discardTask(id: string): Promise<TaskRow> {
  return updateTask(id, { status: 'descartada' })
}

/**
 * Recuperar una tarea descartada: vuelve a `propuesta` (solo si no es
 * a mano: el guard lo rechaza para `origin = 'agente'`).
 */
export async function restoreTask(id: string): Promise<TaskRow> {
  return updateTask(id, { status: 'propuesta' })
}

/** Completar una tarea pendiente (un toque). */
export async function completeTask(id: string): Promise<TaskRow> {
  return updateTask(id, { status: 'completada' })
}

/** Reabrir una tarea completada: vuelve a `pendiente`. */
export async function reopenTask(id: string): Promise<TaskRow> {
  return updateTask(id, { status: 'pendiente' })
}

/** Cambiar la fecha de una tarea pendiente. */
export async function changeTaskDueDate(
  id: string,
  dueDate: string | null,
): Promise<TaskRow> {
  return updateTask(id, { due_date: dueDate })
}

/**
 * Editar una tarea: descripción y/o fecha. El guard guarda la
 * descripción anterior en `original_description` la primera vez
 * (salvo en las tareas a mano).
 */
export async function editTask(
  id: string,
  input: { description: string; due_date?: string | null },
): Promise<TaskRow> {
  return updateTask(id, {
    description: input.description,
    due_date: input.due_date ?? null,
  })
}

/**
 * Crear una tarea a mano: nace `pendiente`, con `origin = 'agente'`.
 * Con nota, la nota tiene que estar aprobada (si no,
 * `nota_no_aprobada`). Sin nota, es una tarea suelta de /pendientes.
 */
export async function createTask(input: {
  visit_note_id?: string | null
  description: string
  due_date?: string | null
}): Promise<TaskRow> {
  const client = requireSupabase()
  const insert: TaskInsert = {
    visit_note_id: input.visit_note_id ?? null,
    description: input.description,
    due_date: input.due_date ?? null,
    status: 'pendiente',
    origin: 'agente',
  }
  const { data, error } = await client
    .from('tasks')
    .insert(insert)
    .select()
    .single()
  if (error !== null) {
    throw taskError(error)
  }
  return data
}
