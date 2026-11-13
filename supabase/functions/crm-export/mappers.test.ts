import { describe, expect, it } from 'vitest'
import {
  buildSummary,
  inmovillaPayloadSchema,
  mapToInmovilla,
  mapToWitei,
  signBody,
  witeiPayloadSchema,
  type SummaryDataInput,
} from './mappers'
import { buildVisitSummary } from '../../../src/features/export/summary'

/**
 * Datos de la nota de ejemplo (Ana García + V-18, aprobada): los
 * cinco datos no descartados, como en `summary.test.ts` y
 * `drafts/rules.test.ts`. La transcripción, el texto de la nota, la
 * ruta del audio y las citas NO entran en la ficha: por eso la
 * entrada no los lleva.
 */
const INPUT: SummaryDataInput = {
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
}

describe('buildSummary (copia de summary.ts)', () => {
  it('el texto y el JSON coinciden con los del frontend', () => {
    const fromMappers = buildSummary(INPUT)
    const fromFrontend = buildVisitSummary(INPUT)
    expect(fromMappers.text).toBe(fromFrontend.text)
    expect(fromMappers.json).toEqual(fromFrontend.json)
  })
})

describe('mapToInmovilla', () => {
  it('pasa su esquema con la nota de ejemplo', () => {
    const payload = mapToInmovilla(buildSummary(INPUT))
    expect(inmovillaPayloadSchema.safeParse(payload).success).toBe(true)
    expect(payload.schema).toBe('inmo-visitas.v1')
    expect(payload.referencia).toBe('V-18')
    expect(payload.cliente).toEqual({
      nombre: 'Ana García',
      telefono: '+34611100200',
      email: 'ana.garcia@example.com',
    })
    expect(payload.visita).toEqual({
      fecha: '2026-11-12T17:40:00Z',
      agente: 'Agente A Prueba',
    })
    expect(payload.comentarios).toContain('Visita V-18 · Calle de Alcalá 120, Madrid')
    expect(payload.datos).toHaveLength(5)
    expect(payload.tareas).toHaveLength(2)
  })

  it('no lleva transcripción, citas, audio ni datos descartados', () => {
    const payload = mapToInmovilla(buildSummary(INPUT))
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('transcript')
    expect(serialized).not.toContain('raw_text')
    expect(serialized).not.toContain('audio')
    expect(serialized).not.toContain('evidence_quote')
    expect(serialized).not.toContain('descartado')
  })

  it('el presupuesto va como declarado', () => {
    const payload = mapToInmovilla(buildSummary(INPUT))
    const budget = payload.datos.find((fact) => fact.category === 'presupuesto')
    expect(budget).toBeDefined()
    expect(budget?.label).toBe('Presupuesto (declarado)')
    expect(budget?.value).toBe('230.000 euros')
  })

  it('no repite «declarado» si el campo ya lo dice (revisión de la Fase 7)', () => {
    const summary = buildSummary({
      ...INPUT,
      facts: [
        {
          category: 'presupuesto',
          field_name: 'presupuesto_declarado',
          value: '230.000 euros',
        },
      ],
    })
    const inmovilla = mapToInmovilla(summary)
    const witei = mapToWitei(summary)
    expect(inmovilla.datos[0]?.label).toBe('Presupuesto declarado')
    expect(witei.facts[0]?.label).toBe('Presupuesto declarado')
    expect(inmovilla.comentarios).toContain('- Presupuesto declarado: 230.000 euros')
    expect(inmovilla.comentarios).not.toContain('(declarado)')
  })

  it('un payload incompleto no pasa el esquema', () => {
    const payload = mapToInmovilla(buildSummary(INPUT))
    const { referencia: _removed, ...withoutReference } = payload
    expect(inmovillaPayloadSchema.safeParse(withoutReference).success).toBe(
      false,
    )
    expect(
      inmovillaPayloadSchema.safeParse({ ...payload, schema: 'otra-v1' })
        .success,
    ).toBe(false)
  })
})

describe('mapToWitei', () => {
  it('pasa su esquema con la nota de ejemplo', () => {
    const payload = mapToWitei(buildSummary(INPUT))
    expect(witeiPayloadSchema.safeParse(payload).success).toBe(true)
    expect(payload.schema).toBe('inmo-visitas.v1')
    expect(payload.property_reference).toBe('V-18')
    expect(payload.contact).toEqual({
      name: 'Ana García',
      phone: '+34611100200',
      email: 'ana.garcia@example.com',
    })
    expect(payload.visit).toEqual({
      date: '2026-11-12T17:40:00Z',
      agent: 'Agente A Prueba',
    })
    expect(payload.notes).toContain('Visita V-18 · Calle de Alcalá 120, Madrid')
    expect(payload.facts).toHaveLength(5)
    expect(payload.tasks).toHaveLength(2)
  })

  it('no lleva transcripción, citas, audio ni datos descartados', () => {
    const payload = mapToWitei(buildSummary(INPUT))
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('transcript')
    expect(serialized).not.toContain('raw_text')
    expect(serialized).not.toContain('audio')
    expect(serialized).not.toContain('evidence_quote')
    expect(serialized).not.toContain('descartado')
  })

  it('el presupuesto va como declarado', () => {
    const payload = mapToWitei(buildSummary(INPUT))
    const budget = payload.facts.find((fact) => fact.category === 'presupuesto')
    expect(budget).toBeDefined()
    expect(budget?.label).toBe('Presupuesto (declarado)')
  })

  it('un payload incompleto no pasa el esquema', () => {
    const payload = mapToWitei(buildSummary(INPUT))
    const { contact: _removed, ...withoutContact } = payload
    expect(witeiPayloadSchema.safeParse(withoutContact).success).toBe(false)
  })
})

describe('signBody', () => {
  it('da el HMAC-SHA256 esperado de un vector fijo', async () => {
    await expect(
      signBody('secreto-de-prueba', '{"schema":"inmo-visitas.v1"}'),
    ).resolves.toBe(
      '71bf464257c481bf643afd8e53793ac00c6fbd98ba61e46b565e7d60dc0c4461',
    )
  })

  it('cambia con el secreto y con el cuerpo', async () => {
    const base = await signBody('secreto-de-prueba', '{"a":1}')
    const otherSecret = await signBody('otro-secreto', '{"a":1}')
    const otherBody = await signBody('secreto-de-prueba', '{"a":2}')
    expect(otherSecret).not.toBe(base)
    expect(otherBody).not.toBe(base)
    expect(base).toMatch(/^[0-9a-f]{64}$/)
  })
})
