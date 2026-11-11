import { describe, expect, it } from 'vitest'
import { nextFreeReference, normalizeReference } from './reference'

describe('normalizeReference', () => {
  it('mayúsculas y sin espacios', () => {
    expect(normalizeReference('v-52')).toBe('V-52')
    expect(normalizeReference(' v-52 ')).toBe('V-52')
    expect(normalizeReference('V 52')).toBe('V52')
  })

  it('guiones del teclado móvil → `-`', () => {
    expect(normalizeReference('V–52')).toBe('V-52')
    expect(normalizeReference('V—52')).toBe('V-52')
    expect(normalizeReference('V−52')).toBe('V-52')
  })
})

describe('nextFreeReference', () => {
  it('sin referencias previas → V-01', () => {
    expect(nextFreeReference([])).toBe('V-01')
  })

  it('la siguiente al mayor V-NN', () => {
    expect(nextFreeReference(['V-01', 'V-02', 'V-52'])).toBe('V-53')
    expect(nextFreeReference(['V-07', 'V-09'])).toBe('V-10')
    expect(nextFreeReference(['V-99'])).toBe('V-100')
  })

  it('ignora las que no tienen forma V-NN', () => {
    expect(nextFreeReference(['A-1', 'V-3', 'PISO'])).toBe('V-04')
    expect(nextFreeReference(['v-5'])).toBe('V-06')
  })
})
