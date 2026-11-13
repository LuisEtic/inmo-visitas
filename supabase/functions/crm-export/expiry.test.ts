import { describe, expect, it } from 'vitest'
import {
  STALE_PENDING_MESSAGE,
  STALE_PENDING_MINUTES,
  stalePendingExports,
  type PendingExportRow,
} from './expiry'

const NOW = Date.parse('2026-11-13T14:00:00.000Z')

function row(minutesAgo: number): PendingExportRow {
  return {
    id: `fila-${minutesAgo}`,
    created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
  }
}

describe('stalePendingExports (caducidad B-7)', () => {
  it('el límite es 10 minutos y el mensaje es «Sin respuesta (interrumpida)»', () => {
    expect(STALE_PENDING_MINUTES).toBe(10)
    expect(STALE_PENDING_MESSAGE).toBe('Sin respuesta (interrumpida)')
  })

  it('caduca una pendiente de hace 11 minutos', () => {
    expect(stalePendingExports([row(11)], NOW)).toEqual([row(11)])
  })

  it('no caduca una pendiente de hace 9 minutos', () => {
    expect(stalePendingExports([row(9)], NOW)).toEqual([])
  })

  it('no caduca una pendiente de hace exactamente 10 minutos', () => {
    expect(stalePendingExports([row(10)], NOW)).toEqual([])
  })

  it('en una lista mixta caduca solo las de más de 10 minutos', () => {
    const rows = [row(25), row(11), row(10), row(9), row(2)]
    expect(stalePendingExports(rows, NOW)).toEqual([row(25), row(11)])
  })

  it('sin filas no caduca nada', () => {
    expect(stalePendingExports([], NOW)).toEqual([])
  })
})
