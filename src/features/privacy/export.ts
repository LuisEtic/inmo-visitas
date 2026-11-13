import type {
  CrmExportRow,
  DraftRow,
  ExtractedFactRow,
  TaskRow,
  VisitNoteRow,
} from '../../lib/database.types'

/**
 * Entrega de datos de un cliente (Fase 8, arts. 15 y 20 RGPD): un
 * archivo JSON con el cliente y todas sus notas. Función pura: recibe
 * las filas ya cargadas (solo de ese cliente, por RLS) y no toca la
 * red ni la base.
 *
 * Minimización: por nota van la fecha, el inmueble por referencia, el
 * tipo, el estado, el texto y la transcripción; por nota, los datos
 * (categoría, campo, valor, cita y estado de revisión), las tareas,
 * los borradores y las exportaciones (destino, tipo, estado y fechas).
 * NO van las rutas de audio (`audio_url` se descarta aquí aunque venga
 * en la fila) ni el `payload` de las exportaciones. Sin audio: se
 * entrega aparte si lo piden y aún existe.
 */

export type ClientDataExport = {
  schema: 'inmo-visitas.datos-cliente.v1'
  generated_at: string
  client: {
    full_name: string
    phone: string | null
    email: string | null
    is_temporary: boolean
    created_at: string
  }
  notes: Array<{
    created_at: string
    property_reference: string
    input_type: VisitNoteRow['input_type']
    status: VisitNoteRow['status']
    raw_text: string | null
    transcript: string | null
    facts: Array<{
      category: ExtractedFactRow['category']
      field_name: string
      value: string
      evidence_quote: string | null
      review_status: ExtractedFactRow['review_status']
    }>
    tasks: Array<{
      description: string
      status: TaskRow['status']
      due_date: string | null
      completed_at: string | null
    }>
    drafts: Array<{
      audience: DraftRow['audience']
      content: string
      status: DraftRow['status']
      generated_at: string
      approved_at: string | null
    }>
    exports: Array<{
      target: CrmExportRow['target']
      kind: CrmExportRow['kind']
      status: CrmExportRow['status']
      exported_at: string | null
      created_at: string
    }>
  }>
}

export type ClientDataExportInput = {
  client: {
    full_name: string
    phone: string | null
    email: string | null
    is_temporary: boolean
    created_at: string
  }
  notes: Array<{
    note: Pick<
      VisitNoteRow,
      | 'input_type'
      | 'audio_url'
      | 'raw_text'
      | 'transcript'
      | 'status'
      | 'created_at'
    >
    propertyReference: string
    facts: ExtractedFactRow[]
    tasks: TaskRow[]
    drafts: DraftRow[]
    exports: CrmExportRow[]
  }>
}

export function buildClientDataExport(
  input: ClientDataExportInput,
): ClientDataExport {
  return {
    schema: 'inmo-visitas.datos-cliente.v1',
    generated_at: new Date().toISOString(),
    client: {
      full_name: input.client.full_name,
      phone: input.client.phone,
      email: input.client.email,
      is_temporary: input.client.is_temporary,
      created_at: input.client.created_at,
    },
    notes: input.notes.map(({ note, propertyReference, facts, tasks, drafts, exports }) => ({
      created_at: note.created_at,
      property_reference: propertyReference,
      input_type: note.input_type,
      status: note.status,
      raw_text: note.raw_text,
      transcript: note.transcript,
      facts: facts.map((fact) => ({
        category: fact.category,
        field_name: fact.field_name,
        value: fact.value,
        evidence_quote: fact.evidence_quote,
        review_status: fact.review_status,
      })),
      tasks: tasks.map((task) => ({
        description: task.description,
        status: task.status,
        due_date: task.due_date,
        completed_at: task.completed_at,
      })),
      drafts: drafts.map((draft) => ({
        audience: draft.audience,
        content: draft.content,
        status: draft.status,
        generated_at: draft.generated_at,
        approved_at: draft.approved_at,
      })),
      exports: exports.map((row) => ({
        target: row.target,
        kind: row.kind,
        status: row.status,
        exported_at: row.exported_at,
        created_at: row.created_at,
      })),
    })),
  }
}
