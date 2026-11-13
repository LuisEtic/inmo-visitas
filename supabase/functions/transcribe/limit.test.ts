import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DAILY_LIMIT,
  madridDayStart,
  parseDailyLimit,
} from './limit'

describe('madridDayStart', () => {
  it('invierno: la medianoche de Madrid son las 23:00 UTC del día anterior', () => {
    expect(
      madridDayStart(new Date('2026-01-15T12:00:00Z')).toISOString(),
    ).toBe('2026-01-14T23:00:00.000Z')
  })

  it('verano: la medianoche de Madrid son las 22:00 UTC del día anterior', () => {
    expect(
      madridDayStart(new Date('2026-07-15T12:00:00Z')).toISOString(),
    ).toBe('2026-07-14T22:00:00.000Z')
  })

  it('de madrugada en UTC, el día es el de Madrid', () => {
    // 00:30 UTC = 01:30 en Madrid (invierno): el día empezó la noche anterior.
    expect(
      madridDayStart(new Date('2026-01-15T00:30:00Z')).toISOString(),
    ).toBe('2026-01-14T23:00:00.000Z')
    // 22:30 UTC = 23:30 en Madrid: el mismo día.
    expect(
      madridDayStart(new Date('2026-01-14T22:30:00Z')).toISOString(),
    ).toBe('2026-01-13T23:00:00.000Z')
  })

  it('cambio de hora de primavera (29 mar 2026)', () => {
    // La medianoche del 29 es antes del cambio (02:00 → 03:00): +1.
    expect(
      madridDayStart(new Date('2026-03-29T12:00:00Z')).toISOString(),
    ).toBe('2026-03-28T23:00:00.000Z')
    // El 30 ya es horario de verano: +2.
    expect(
      madridDayStart(new Date('2026-03-30T12:00:00Z')).toISOString(),
    ).toBe('2026-03-29T22:00:00.000Z')
  })

  it('cambio de hora de otoño (25 oct 2026)', () => {
    // La medianoche del 25 es antes del cambio (03:00 → 02:00): +2.
    expect(
      madridDayStart(new Date('2026-10-25T12:00:00Z')).toISOString(),
    ).toBe('2026-10-24T22:00:00.000Z')
    // El 26 ya es horario de invierno: +1.
    expect(
      madridDayStart(new Date('2026-10-26T12:00:00Z')).toISOString(),
    ).toBe('2026-10-25T23:00:00.000Z')
  })
})

describe('parseDailyLimit', () => {
  it('sin secret: 150', () => {
    expect(parseDailyLimit(undefined)).toBe(DEFAULT_DAILY_LIMIT)
    expect(parseDailyLimit(undefined)).toBe(150)
  })

  it('número válido, con espacios', () => {
    expect(parseDailyLimit('2')).toBe(2)
    expect(parseDailyLimit(' 25 ')).toBe(25)
  })

  it('inválido o menor que 1: 150', () => {
    expect(parseDailyLimit('')).toBe(150)
    expect(parseDailyLimit('muchos')).toBe(150)
    expect(parseDailyLimit('0')).toBe(150)
    expect(parseDailyLimit('-5')).toBe(150)
  })
})
