import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import type {
  CrmExportInsert,
  CrmExportRow,
  CrmExportTarget,
  DraftAudience,
} from '../../lib/database.types'

/**
 * Consultas directas a `crm_exports` (Fase 7). Todas pasan por RLS:
 * cada agente solo ve e inserta las exportaciones de sus propias
 * notas. Este archivo no importa de `src/integrations/crm/`: los
 * adaptadores `manual` y `whatsapp` lo usan para registrar la
 * entrega, y `api.ts` lo reexporta; así no hay importación circular.
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

export type RecordDeliveryInput = {
  noteId: string
  target: CrmExportTarget
  kind: 'nota' | 'borrador'
  draftId?: string
  audience?: DraftAudience
}

/**
 * Registra una entrega al agente (`whatsapp` o `manual`): la fila
 * nace `entregado` y el guard pone `exported_at`. La base rechaza la
 * fila si la nota no está aprobada (`nota_no_aprobada`) o si el
 * borrador no está aprobado o no es de esa nota y ese destinatario
 * (`borrador_no_aprobado`).
 */
export async function recordDelivery(
  input: RecordDeliveryInput,
): Promise<CrmExportRow> {
  const client = requireSupabase()
  const insert: CrmExportInsert = {
    visit_note_id: input.noteId,
    target: input.target,
    kind: input.kind,
    draft_id: input.kind === 'borrador' ? (input.draftId ?? null) : null,
    audience: input.kind === 'borrador' ? (input.audience ?? null) : null,
    status: 'entregado',
  }
  const { data, error } = await client
    .from('crm_exports')
    .insert(insert)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error, { exports: true }))
  }
  return data
}

/** Historial de exportaciones de una nota, las más recientes primero. */
export async function listNoteExports(noteId: string): Promise<CrmExportRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('crm_exports')
    .select('*')
    .eq('visit_note_id', noteId)
    .order('created_at', { ascending: false })
  if (error !== null) {
    throw new Error(translateDbError(error, { exports: true }))
  }
  return data ?? []
}

/**
 * Ids de notas con al menos una fila `enviado` o `entregado` de
 * `kind = 'nota'` (la ficha ya salió de la app).
 */
export async function listExportedNoteIds(): Promise<Set<string>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('crm_exports')
    .select('visit_note_id')
    .eq('kind', 'nota')
    .in('status', ['enviado', 'entregado'])
  if (error !== null) {
    throw new Error(translateDbError(error, { exports: true }))
  }
  return new Set((data ?? []).map((row) => row.visit_note_id))
}
