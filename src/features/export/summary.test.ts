import { describe, expect, it } from 'vitest'
import {
  buildVisitSummary,
  SUMMARY_MAX_CHARS,
  type VisitSummaryInput,
} from './summary'

/**
 * Datos de la nota de ejemplo (Ana García + V-18, aprobada): los
 * cinco datos no descartados de `drafts/rules.test.ts`, con cliente,
 * inmueble y agente. La transcripción, el texto de la nota, la ruta
 * del audio y las citas NO entran en la ficha (minimización RGPD):
 * por eso la entrada no los lleva.
 */
function exampleInput(overrides: Partial<VisitSummaryInput> = {}): VisitSummaryInput {
  return {
    note: {
      id: 'e0782f7c-8409-4e23-a2b0-5972521fed0a',
      created_at: '2026-11-12T17:40:00Z',
      approved_at: '2026-11-12T13:32:00Z',
    },
    client: {
      full_name: 'Ana García',
      phone: '+34611100200',
      email: 'ana.garcia@example.com',
      is_temporary: false,
    },
    property: {
      reference: 'V-18',
      address: 'Calle de Alcalá 120',
      city: 'Madrid',
    },
    agent: { full_name: 'Agente A Prueba' },
    facts: [
      {
        category: 'objecion',
        field_name: 'ruido_calle',
        value: 'Ruido de la calle Alcalá por la noche',
      },
      {
        category: 'cita_pendiente',
        field_name: 'proxima_visita',
        value: 'Viernes, hora por confirmar',
      },
      {
        category: 'desconocido',
        field_name: 'hora_cita',
        value: 'Hora de la segunda visita por confirmar',
      },
      {
        category: 'presupuesto',
        field_name: 'presupuesto',
        value: '230.000 euros',
      },
      {
        category: 'hecho_declarado',
        field_name: 'informacion_solicitada',
        value: 'Gastos de comunidad e IBI',
      },
    ],
    tasks: [
      {
        description: 'Confirmar día y hora: Viernes, hora por confirmar',
        due_date: null,
      },
      {
        description: 'Enviar gastos de comunidad e IBI',
        due_date: '2026-11-13',
      },
    ],
    ...overrides,
  }
}

describe('buildVisitSummary', () => {
  it('construye el texto con el formato del prompt, en hora de Madrid', () => {
    const { text } = buildVisitSummary(exampleInput())
    expect(text).toBe(
      [
        'Visita V-18 · Calle de Alcalá 120, Madrid',
        '12 nov 2026, 18:40 · Agente: Agente A Prueba',
        'Cliente: Ana García · 611 10 02 00 · ana.garcia@example.com',
        'Hechos declarados:',
        // Las etiquetas son las mismas que en «Revisar» (`fieldLabel`):
        // mecánicas, sin tildes ni artículos.
        '- Informacion solicitada: Gastos de comunidad e IBI',
        'Objeciones:',
        '- Ruido calle: Ruido de la calle Alcalá por la noche',
        'Presupuesto declarado:',
        '- Presupuesto (declarado): 230.000 euros',
        'Citas pendientes (sin confirmar):',
        '- Proxima visita: Viernes, hora por confirmar',
        'Por confirmar:',
        '- Hora cita: Hora de la segunda visita por confirmar',
        'Tareas:',
        '- Confirmar día y hora: Viernes, hora por confirmar (sin fecha)',
        '- Enviar gastos de comunidad e IBI (13 nov 2026)',
      ].join('\n'),
    )
  })

  it('el presupuesto sale siempre como «(declarado)»', () => {
    const { text, json } = buildVisitSummary(exampleInput())
    expect(text).toContain('Presupuesto (declarado): 230.000 euros')
    expect(text).not.toContain('solvencia')
    expect(json.groups.flatMap((group) => group.facts)).toContainEqual(
      expect.objectContaining({ category: 'presupuesto' }),
    )
  })

  it('no repite «declarado» si el campo ya lo dice (revisión de la Fase 7)', () => {
    const { text } = buildVisitSummary(
      exampleInput({
        facts: [
          {
            category: 'presupuesto',
            field_name: 'presupuesto_declarado',
            value: '230.000 euros',
          },
        ],
      }),
    )
    expect(text).toContain('- Presupuesto declarado: 230.000 euros')
    expect(text).not.toContain('(declarado)')
  })

  it('los grupos vacíos no salen y el orden es el de la especificación', () => {
    const { text } = buildVisitSummary(
      exampleInput({
        facts: [
          {
            category: 'observacion',
            field_name: 'luz',
            value: 'Mucha luz natural',
          },
        ],
        tasks: [],
      }),
    )
    expect(text).toContain('Observaciones:\n- Luz: Mucha luz natural')
    expect(text).not.toContain('Hechos declarados')
    expect(text).not.toContain('Tareas:')
  })

  it('cliente provisional con «(provisional)» y sin teléfono ni email', () => {
    const { text } = buildVisitSummary(
      exampleInput({
        client: {
          full_name: 'Marta',
          phone: null,
          email: null,
          is_temporary: true,
        },
      }),
    )
    expect(text).toContain('Cliente: Marta (provisional)')
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
  })

  it('la fecha de la visita es la de Madrid en el cambio de día', () => {
    // 23:30 UTC del 12 es ya el 13 a las 00:30 en Madrid.
    const { text } = buildVisitSummary(
      exampleInput({
        note: {
          id: 'e0782f7c-8409-4e23-a2b0-5972521fed0a',
          created_at: '2026-11-12T23:30:00Z',
          approved_at: null,
        },
      }),
    )
    expect(text).toContain('13 nov 2026, 00:30 · Agente:')
  })

  it('el JSON lleva el mismo contenido, con schema inmo-visitas.v1', () => {
    const { json } = buildVisitSummary(exampleInput())
    expect(json.schema).toBe('inmo-visitas.v1')
    expect(json.visit_note_id).toBe('e0782f7c-8409-4e23-a2b0-5972521fed0a')
    expect(json.reference).toBe('V-18')
    expect(json.agent).toBe('Agente A Prueba')
    expect(json.client).toEqual({
      name: 'Ana García',
      phone: '+34611100200',
      email: 'ana.garcia@example.com',
      provisional: false,
    })
    expect(json.groups.map((group) => group.title)).toEqual([
      'Hechos declarados',
      'Objeciones',
      'Presupuesto declarado',
      'Citas pendientes (sin confirmar)',
      'Por confirmar',
    ])
    expect(json.tasks).toHaveLength(2)
    // Nada de lo que no debe salir: ni transcripción, ni texto de la
    // nota, ni audio, ni citas, ni datos descartados.
    const serialized = JSON.stringify(json)
    expect(serialized).not.toContain('transcript')
    expect(serialized).not.toContain('audio')
    expect(serialized).not.toContain('evidence_quote')
    expect(serialized).not.toContain('descartado')
  })

  it('recorta las tareas si el texto pasa de 3000 caracteres, con «…»', () => {
    const longTask = (n: number) => ({
      description: `Tarea número ${n} `.padEnd(120, 'x'),
      due_date: null,
    })
    const { text } = buildVisitSummary(
      exampleInput({ tasks: Array.from({ length: 40 }, (_, i) => longTask(i + 1)) }),
    )
    expect(text.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS)
    expect(text).toContain('Tareas:')
    expect(text.endsWith('…')).toBe(true)
    // La cabecera y los grupos siguen enteros.
    expect(text).toContain('Visita V-18 · Calle de Alcalá 120, Madrid')
    expect(text).toContain('Presupuesto (declarado): 230.000 euros')
    // Solo caben las primeras tareas: la última no está.
    expect(text).not.toContain('Tarea número 40')
  })

  it('si no cabe ni una tarea, la ficha queda sin tareas y con «…»', () => {
    const hugeFact = {
      category: 'hecho_declarado' as const,
      field_name: 'resumen',
      value: 'x'.repeat(2900),
    }
    const { text } = buildVisitSummary(
      exampleInput({ facts: [hugeFact] }),
    )
    expect(text.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS)
    expect(text.endsWith('…')).toBe(true)
    expect(text).not.toContain('Tareas:')
  })
})
