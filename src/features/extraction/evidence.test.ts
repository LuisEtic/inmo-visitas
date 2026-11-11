import { describe, expect, it } from 'vitest'
import { findEvidenceRange, hasEvidence } from './evidence'

const NOTE =
  'Ana ha visitado V-18 con su pareja. Le preocupa el ruido de la calle Alcalá por la noche. Quiere volver el viernes, falta confirmar la hora.'

describe('hasEvidence (copia de rules.ts)', () => {
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
  })

  it('una cita que no está en el texto no es evidencia', () => {
    expect(hasEvidence('La casa tiene piscina', NOTE)).toBe(false)
    expect(hasEvidence('', NOTE)).toBe(false)
  })
})

describe('findEvidenceRange', () => {
  it('localiza la cita literal', () => {
    const range = findEvidenceRange(
      NOTE,
      'Le preocupa el ruido de la calle Alcalá por la noche',
    )
    expect(range).not.toBe(null)
    if (range !== null) {
      expect(NOTE.slice(range.start, range.end)).toBe(
        'Le preocupa el ruido de la calle Alcalá por la noche',
      )
    }
  })

  it('localiza la cita sin distinguir mayúsculas', () => {
    const range = findEvidenceRange(
      NOTE,
      'LE PREOCUPA EL RUIDO DE LA CALLE ALCALÁ POR LA NOCHE',
    )
    expect(range).not.toBe(null)
    if (range !== null) {
      expect(NOTE.slice(range.start, range.end)).toBe(
        'Le preocupa el ruido de la calle Alcalá por la noche',
      )
    }
  })

  it('localiza la cita con comillas y espacios distintos', () => {
    const range = findEvidenceRange(
      NOTE,
      '«le preocupa el ruido  de la calle Alcalá por la noche»',
    )
    expect(range).not.toBe(null)
    if (range !== null) {
      expect(NOTE.slice(range.start, range.end)).toBe(
        'Le preocupa el ruido de la calle Alcalá por la noche',
      )
    }
  })

  it('devuelve null si la cita no está en el texto', () => {
    expect(findEvidenceRange(NOTE, 'La casa tiene piscina')).toBe(null)
    expect(findEvidenceRange(NOTE, '')).toBe(null)
    expect(findEvidenceRange(NOTE, '   ')).toBe(null)
  })
})
