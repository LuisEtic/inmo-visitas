import { supabase } from '../../lib/supabase'
import { getCrmAdapter } from '../../integrations/crm'
import type {
  CrmExportResult,
  VisitNoteExportInput,
} from '../../integrations/crm/types'
import type { CrmTarget } from '../../config/client'
import { getClient } from '../clients/api'
import { listFacts } from '../extraction/api'
import { getNote, listNotesByStatus, type NoteWithClientAndProperty } from '../notes/api'
import { getProperty } from '../properties/api'
import { listNoteTasks } from '../tasks/api'
import { buildVisitSummary, type VisitSummary } from './summary'
import { listExportedNoteIds } from './deliveries'

export { listNoteExports, recordDelivery } from './deliveries'
export type { RecordDeliveryInput } from './deliveries'

/**
 * Capa de datos de la exportación (Fase 7): la ficha de la visita y
 * la llamada al adaptador del CRM. Todas las consultas pasan por RLS.
 *
 * `recordDelivery` y `listNoteExports` viven en `deliveries.ts` y se
 * reexportan aquí: los adaptadores `manual` y `whatsapp` importan de
 * allí para no crear una importación circular (`api.ts` importa de
 * `src/integrations/crm/` y los adaptadores importan de aquí).
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

export type ExportContext = {
  summary: VisitSummary
}

/**
 * Lo necesario para la ficha de una nota aprobada, en pocas consultas
 * en paralelo: nota, cliente, inmueble, nombre del agente, datos no
 * descartados y tareas `pendiente`. Ni transcripción, ni texto de la
 * nota, ni audio, ni citas, ni datos descartados.
 */
export async function loadExportContext(noteId: string): Promise<ExportContext> {
  const client = requireSupabase()
  const note = await getNote(noteId)
  if (note === null) {
    throw new Error('No se ha encontrado la nota.')
  }
  const [{ data: userData }, facts, tasks] = await Promise.all([
    client.auth.getUser(),
    listFacts(noteId),
    listNoteTasks(noteId),
  ])
  const user = userData.user
  const [clientRow, propertyRow, agentRow] = await Promise.all([
    getClient(note.client_id),
    getProperty(note.property_id),
    user === null
      ? Promise.resolve(null)
      : client
          .from('agents')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => data as { full_name: string } | null),
  ])
  if (clientRow === null || propertyRow === null) {
    throw new Error('No se ha podido cargar la ficha.')
  }
  const agentName =
    agentRow?.full_name ??
    (typeof user?.user_metadata?.['full_name'] === 'string'
      ? (user.user_metadata['full_name'] as string)
      : (user?.email?.split('@')[0] ?? 'agente'))
  const summary = buildVisitSummary({
    note: {
      id: note.id,
      created_at: note.created_at,
      approved_at: note.approved_at,
    },
    client: {
      full_name: clientRow.full_name,
      phone: clientRow.phone,
      email: clientRow.email,
      is_temporary: clientRow.is_temporary,
    },
    property: {
      reference: propertyRow.reference,
      address: propertyRow.address,
      city: propertyRow.city,
    },
    agent: { full_name: agentName },
    facts: facts
      .filter((fact) => fact.review_status !== 'descartado')
      .map((fact) => ({
        category: fact.category,
        field_name: fact.field_name,
        value: fact.value,
      })),
    tasks: tasks
      .filter((task) => task.status === 'pendiente')
      .map((task) => ({
        description: task.description,
        due_date: task.due_date,
      })),
  })
  return { summary }
}

/**
 * Exporta la ficha de una nota al CRM configurado (o la copia, o la
 * comparte por WhatsApp). La ficha se construye aquí; los adaptadores
 * de Inmovilla y Witei no la usan (la función construye la suya), pero
 * `manual` y `whatsapp` sí.
 */
export async function exportToCrm(
  noteId: string,
  target: CrmTarget,
): Promise<CrmExportResult> {
  const { summary } = await loadExportContext(noteId)
  const input: VisitNoteExportInput = { visitNoteId: noteId, summary }
  return getCrmAdapter(target).exportVisitNote(input)
}

/**
 * Notas aprobadas cuya ficha aún no ha salido de la app (grupo «Por
 * exportar» de /pendientes): sin ninguna fila `enviado` ni `entregado`
 * de `kind = 'nota'`.
 */
export async function listNotesToExport(): Promise<NoteWithClientAndProperty[]> {
  const [approved, exported] = await Promise.all([
    listNotesByStatus(['approved']),
    listExportedNoteIds(),
  ])
  return approved.filter((note) => !exported.has(note.id))
}
