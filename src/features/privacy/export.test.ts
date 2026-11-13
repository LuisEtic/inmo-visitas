import { describe, expect, it } from 'vitest'
import type {
  CrmExportRow,
  DraftRow,
  ExtractedFactRow,
  TaskRow,
} from '../../lib/database.types'
import { buildClientDataExport } from './export'

function fact(overrides: Partial<ExtractedFactRow> = {}): ExtractedFactRow {
  return {
    id: 'fact-1',
    visit_note_id: 'note-1',
    category: 'hecho_declarado',
    field_name: 'acompanante_visita',
    value: 'Su pareja',
    evidence_quote: 'con su pareja',
    confidence: 0.9,
    origin: 'ia',
    review_status: 'aceptado',
    original_value: null,
    reviewed_at: '2026-11-12T10:00:00Z',
    created_at: '2026-11-12T10:00:00Z',
    ...overrides,
  }
}

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 'task-1',
    visit_note_id: 'note-1',
    agent_id: 'agent-1',
    description: 'Enviar los gastos de comunidad',
    due_date: null,
    status: 'pendiente',
    origin: 'ia',
    source_fact_id: 'fact-1',
    original_description: null,
    completed_at: null,
    updated_at: null,
    created_at: '2026-11-12T10:00:00Z',
    ...overrides,
  }
}

function draft(overrides: Partial<DraftRow> = {}): DraftRow {
  return {
    id: 'draft-1',
    visit_note_id: 'note-1',
    audience: 'comprador',
    content: 'Hola Ana, gracias por visitar V-18.',
    is_sensitive_filtered: true,
    status: 'aprobado',
    original_content: null,
    generated_at: '2026-11-12T10:00:00Z',
    edited_at: null,
    approved_at: '2026-11-12T11:00:00Z',
    created_at: '2026-11-12T10:00:00Z',
    ...overrides,
  }
}

function crmExport(overrides: Partial<CrmExportRow> = {}): CrmExportRow {
  return {
    id: 'export-1',
    visit_note_id: 'note-1',
    target: 'manual',
    kind: 'nota',
    draft_id: null,
    audience: null,
    payload: { simulated: true, secreto: 'no debe salir' },
    status: 'entregado',
    external_id: null,
    error_message: null,
    exported_at: '2026-11-12T12:00:00Z',
    created_at: '2026-11-12T12:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

const input = {
  client: {
    full_name: 'Ana García',
    phone: '+34612345678',
    email: 'ana.garcia@gmail.com',
    is_temporary: false,
    created_at: '2026-11-11T09:00:00Z',
  },
  notes: [
    {
      note: {
        input_type: 'audio' as const,
        audio_url: 'agent-1/note-1.webm',
        raw_text: null,
        transcript: 'Ana visitó V-18 con su pareja.',
        status: 'approved' as const,
        created_at: '2026-11-11T17:22:00Z',
      },
      propertyReference: 'V-18',
      facts: [fact()],
      tasks: [task()],
      drafts: [draft()],
      exports: [crmExport()],
    },
  ],
}

describe('buildClientDataExport', () => {
  it('construye el JSON con el esquema pedido', () => {
    const output = buildClientDataExport(input)
    expect(output.schema).toBe('inmo-visitas.datos-cliente.v1')
    expect(output.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(output.client.full_name).toBe('Ana García')
    expect(output.notes).toHaveLength(1)
    const note = output.notes[0]
    expect(note?.property_reference).toBe('V-18')
    expect(note?.input_type).toBe('audio')
    expect(note?.status).toBe('approved')
    expect(note?.transcript).toBe('Ana visitó V-18 con su pareja.')
    expect(note?.facts[0]?.field_name).toBe('acompanante_visita')
    expect(note?.facts[0]?.evidence_quote).toBe('con su pareja')
    expect(note?.tasks[0]?.description).toBe('Enviar los gastos de comunidad')
    expect(note?.drafts[0]?.audience).toBe('comprador')
    expect(note?.exports[0]?.target).toBe('manual')
    expect(note?.exports[0]?.status).toBe('entregado')
  })

  it('no incluye rutas de audio ni `payload`', () => {
    const output = buildClientDataExport(input)
    const text = JSON.stringify(output)
    expect(text).not.toContain('audio_url')
    expect(text).not.toContain('agent-1/note-1.webm')
    expect(text).not.toContain('payload')
    expect(text).not.toContain('secreto')
  })

  it('no añade nada que no venga en la entrada (sin datos de otros clientes)', () => {
    const output = buildClientDataExport({
      client: input.client,
      notes: [],
    })
    expect(output.notes).toEqual([])
    expect(Object.keys(output)).toEqual([
      'schema',
      'generated_at',
      'client',
      'notes',
    ])
  })
})
