import { describe, expect, it } from 'vitest'
import { matchesConfirmName } from './confirm'

describe('matchesConfirmName', () => {
  it('acepta el nombre exacto', () => {
    expect(matchesConfirmName('Ana García', 'Ana García')).toBe(true)
  })

  it('ignora espacios en los extremos y repetidos (teclado del móvil)', () => {
    expect(matchesConfirmName('  Ana   García ', 'Ana García')).toBe(true)
  })

  it('ignora mayúsculas y minúsculas', () => {
    expect(matchesConfirmName('ana garcía', 'Ana García')).toBe(true)
  })

  it('las tildes sí cuentan', () => {
    expect(matchesConfirmName('Ana Garcia', 'Ana García')).toBe(false)
  })

  it('rechaza un nombre distinto o incompleto', () => {
    expect(matchesConfirmName('Ana', 'Ana García')).toBe(false)
    expect(matchesConfirmName('', 'Ana García')).toBe(false)
  })

  it('un nombre vacío nunca confirma', () => {
    expect(matchesConfirmName('', '   ')).toBe(false)
  })
})
