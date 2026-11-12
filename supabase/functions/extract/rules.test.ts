import { describe, expect, it } from 'vitest'
import {
  applyExtractionRules,
  hasEvidence,
  isSensitiveFact,
  isSensitiveField,
  isSensitiveValue,
  normalizeForEvidence,
  parseModelResponse,
  type ModelFact,
} from './rules'
import { hasEvidence as frontendHasEvidence } from '../../../src/features/extraction/evidence'

const NOTE =
  'Ana ha visitado V-18 con su pareja. Le preocupa el ruido de la calle Alcalá por la noche. Quiere volver el viernes, falta confirmar la hora. Dice que su presupuesto es de 230.000 euros y pide que le mandemos los gastos de comunidad e IBI.'

function fact(overrides: Partial<ModelFact> = {}): ModelFact {
  return {
    category: 'objecion',
    field_name: 'ruido_nocturno',
    value: 'ruido nocturno de la calle',
    evidence_quote: 'Le preocupa el ruido de la calle Alcalá por la noche',
    confidence: 0.9,
    ...overrides,
  }
}

describe('normalizeForEvidence', () => {
  it('minúsculas, sin comillas y con espacios colapsados', () => {
    expect(normalizeForEvidence('  «Le  preocupa»  el RUIDO ')).toBe(
      'le preocupa el ruido',
    )
    expect(normalizeForEvidence('«Quiere volver»')).toBe('quiere volver')
  })
})

describe('hasEvidence', () => {
  it('la cita literal está en el texto', () => {
    expect(
      hasEvidence('Le preocupa el ruido de la calle Alcalá por la noche', NOTE),
    ).toBe(true)
    expect(hasEvidence('Quiere volver el viernes', NOTE)).toBe(true)
  })

  it('tolera mayúsculas, comillas y espacios distintos', () => {
    expect(
      hasEvidence('«le preocupa el ruido de la calle Alcalá por la noche»', NOTE),
    ).toBe(true)
    expect(hasEvidence('  su   presupuesto  es de 230.000 euros ', NOTE)).toBe(true)
  })

  it('una cita que no está en el texto no es evidencia', () => {
    expect(hasEvidence('La casa tiene piscina', NOTE)).toBe(false)
    expect(hasEvidence('', NOTE)).toBe(false)
    expect(hasEvidence('   ', NOTE)).toBe(false)
  })
})

describe('isSensitiveField', () => {
  it('detecta los campos sensibles del art. 9 RGPD', () => {
    for (const field of [
      'estado_salud',
      'enfermedad_cronica',
      'religion',
      'etnia',
      'origen_etnico',
      'nacionalidad',
      'orientacion_sexual',
      'ideologia',
      'afiliacion_politica',
      'embarazo',
      'discapacidad',
    ]) {
      expect(isSensitiveField(field), field).toBe(true)
    }
  })

  it('no marca los campos normales', () => {
    for (const field of [
      'ruido_nocturno',
      'segunda_visita',
      'presupuesto_declarado',
      'gastos_comunidad',
    ]) {
      expect(isSensitiveField(field), field).toBe(false)
    }
  })
})

describe('parseModelResponse', () => {
  it('valida una respuesta correcta y redondea la confianza', () => {
    const parsed = parseModelResponse(
      JSON.stringify({ facts: [fact({ confidence: 0.876 })] }),
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.facts).toHaveLength(1)
      expect(parsed.facts[0].confidence).toBe(0.88)
    }
  })

  it('acepta una respuesta sin datos', () => {
    const parsed = parseModelResponse(JSON.stringify({ facts: [] }))
    expect(parsed.ok).toBe(true)
  })

  it('rechaza JSON no válido y esquemas no válidos', () => {
    expect(parseModelResponse('no es json')).toEqual({ ok: false })
    expect(parseModelResponse(JSON.stringify({ datos: [] }))).toEqual({
      ok: false,
    })
    expect(
      parseModelResponse(
        JSON.stringify({ facts: [fact({ category: 'invento' })] }),
      ),
    ).toEqual({ ok: false })
    expect(
      parseModelResponse(
        JSON.stringify({ facts: [fact({ field_name: 'Ruido Nocturno' })] }),
      ),
    ).toEqual({ ok: false })
    expect(
      parseModelResponse(JSON.stringify({ facts: [fact({ confidence: 1.5 })] })),
    ).toEqual({ ok: false })
    expect(
      parseModelResponse(
        JSON.stringify({
          facts: Array.from({ length: 31 }, () => fact()),
        }),
      ),
    ).toEqual({ ok: false })
  })
})

describe('applyExtractionRules', () => {
  it('con la nota de ejemplo se quedan los 5 datos esperados', () => {
    const facts = [
      fact(),
      fact({
        category: 'cita_pendiente',
        field_name: 'segunda_visita',
        value: 'segunda visita el viernes, sin confirmar',
        evidence_quote: 'Quiere volver el viernes',
        confidence: 0.85,
      }),
      fact({
        category: 'desconocido',
        field_name: 'hora_segunda_visita',
        value: 'hora de la segunda visita',
        evidence_quote: 'falta confirmar la hora',
        confidence: 0.8,
      }),
      fact({
        category: 'presupuesto',
        field_name: 'presupuesto_declarado',
        value: '230.000 €',
        evidence_quote: 'su presupuesto es de 230.000 euros',
        confidence: 0.95,
      }),
      fact({
        category: 'hecho_declarado',
        field_name: 'pide_gastos',
        value: 'pide gastos de comunidad e IBI',
        evidence_quote: 'pide que le mandemos los gastos de comunidad e IBI',
        confidence: 0.9,
      }),
    ]
    const result = applyExtractionRules(facts, NOTE)
    expect(result.kept).toHaveLength(5)
    expect(result.discardedNoEvidence).toBe(0)
    expect(result.discardedSensitive).toBe(0)
  })

  it('descarta el dato sin cita y cuenta los descartes', () => {
    const result = applyExtractionRules(
      [
        fact(),
        fact({
          field_name: 'tiene_piscina',
          value: 'tiene piscina',
          evidence_quote: 'La casa tiene piscina',
          confidence: 0.7,
        }),
        fact({
          field_name: 'estado_salud',
          value: 'tiene asma',
          evidence_quote: 'Le preocupa el ruido de la calle Alcalá por la noche',
          confidence: 0.9,
        }),
      ],
      NOTE,
    )
    expect(result.kept).toHaveLength(1)
    expect(result.discardedNoEvidence).toBe(1)
    expect(result.discardedSensitive).toBe(1)
  })

  it('entre duplicados se queda el de mayor confianza', () => {
    const result = applyExtractionRules(
      [
        fact({ confidence: 0.6 }),
        fact({ confidence: 0.9 }),
        fact({
          confidence: 0.7,
          value: 'RUIDO NOCTURNO DE LA CALLE',
        }),
      ],
      NOTE,
    )
    expect(result.kept).toHaveLength(1)
    expect(result.kept[0].confidence).toBe(0.9)
  })
})

// Revisión de la Fase 5 (Claude): cita mínima y datos sensibles por valor.
describe('hasEvidence: cita mínima', () => {
  it('una cita trivial (una palabra o muy corta) no es evidencia', () => {
    expect(hasEvidence('a', NOTE)).toBe(false)
    expect(hasEvidence('el', NOTE)).toBe(false)
    expect(hasEvidence('ruido', NOTE)).toBe(false)
    expect(hasEvidence('su pareja', NOTE)).toBe(true)
    expect(hasEvidence('Quiere volver el viernes', NOTE)).toBe(true)
  })

  it('las mismas respuestas que la copia del frontend', () => {
    const quotes = [
      '',
      'a',
      'el',
      'ruido',
      'de la',
      'su pareja',
      '«Quiere  volver»',
      'falta confirmar la hora',
      'cita inventada que no está',
    ]
    for (const quote of quotes) {
      expect(frontendHasEvidence(quote, NOTE)).toBe(hasEvidence(quote, NOTE))
    }
  })
})

describe('isSensitiveValue / isSensitiveFact', () => {
  it('detecta categorías especiales en el valor, con o sin tildes', () => {
    expect(isSensitiveValue('Tiene una enfermedad crónica')).toBe(true)
    expect(isSensitiveValue('Le preocupa su salud')).toBe(true)
    expect(isSensitiveValue('Es muy religiosa')).toBe(true)
    expect(isSensitiveValue('Está embarazada')).toBe(true)
    expect(isSensitiveValue('Religión católica')).toBe(true)
  })

  it('no da falsos positivos habituales en notas inmobiliarias', () => {
    expect(isSensitiveValue('Quiere terraza')).toBe(false)
    expect(isSensitiveValue('Mandó saludos al propietario')).toBe(false)
    expect(isSensitiveValue('el origen del ruido es la calle')).toBe(false)
    expect(isSensitiveValue('política de mascotas de la comunidad')).toBe(false)
    expect(isSensitiveValue('230.000 €')).toBe(false)
  })

  it('un dato con nombre neutro pero valor sensible se descarta', () => {
    expect(
      isSensitiveFact({ field_name: 'preocupacion', value: 'su salud' }),
    ).toBe(true)
    const result = applyExtractionRules(
      [
        fact(),
        fact({
          field_name: 'preocupacion',
          value: 'Le preocupa su salud',
          evidence_quote: 'Le preocupa el ruido',
        }),
      ],
      NOTE,
    )
    expect(result.kept).toHaveLength(1)
    expect(result.discardedSensitive).toBe(1)
  })
})
