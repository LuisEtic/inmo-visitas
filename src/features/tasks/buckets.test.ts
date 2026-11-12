import { describe, expect, it } from 'vitest'
import {
  bucketForDueDate,
  groupTasksByBucket,
  todayInMadrid,
} from './buckets'

describe('todayInMadrid', () => {
  it('usa la fecha de Madrid, no la UTC', () => {
    // 00:30 en Madrid es 23:30 UTC del día anterior.
    expect(todayInMadrid(new Date('2026-11-11T23:30:00.000Z'))).toBe(
      '2026-11-12',
    )
    // 22:30 en Madrid es 21:30 UTC del mismo día.
    expect(todayInMadrid(new Date('2026-11-12T21:30:00.000Z'))).toBe(
      '2026-11-12',
    )
  })

  it('cambia de día con el cambio de hora de marzo', () => {
    // 29-mar-2026: a las 02:00 el reloj salta a las 03:00 (+02:00).
    // 00:30 UTC = 01:30 Madrid (+01:00, antes del cambio).
    expect(todayInMadrid(new Date('2026-03-29T00:30:00.000Z'))).toBe(
      '2026-03-29',
    )
    // 01:30 UTC = 03:30 Madrid (+02:00, después del cambio).
    expect(todayInMadrid(new Date('2026-03-29T01:30:00.000Z'))).toBe(
      '2026-03-29',
    )
  })

  it('cambia de día con el cambio de hora de octubre', () => {
    // 25-oct-2026: a las 03:00 el reloj vuelve a las 02:00 (+01:00).
    // 00:30 UTC = 02:30 Madrid (+02:00, antes del cambio).
    expect(todayInMadrid(new Date('2026-10-25T00:30:00.000Z'))).toBe(
      '2026-10-25',
    )
    // 01:30 UTC = 02:30 Madrid (+01:00, después del cambio).
    expect(todayInMadrid(new Date('2026-10-25T01:30:00.000Z'))).toBe(
      '2026-10-25',
    )
  })
})

describe('bucketForDueDate', () => {
  const today = '2026-11-12'

  it('clasifica vencidas, hoy, próximos días y sin fecha', () => {
    expect(bucketForDueDate('2026-11-11', today)).toBe('vencidas')
    expect(bucketForDueDate('2026-11-12', today)).toBe('hoy')
    expect(bucketForDueDate('2026-11-13', today)).toBe('proximos')
    expect(bucketForDueDate('2026-12-01', today)).toBe('proximos')
    expect(bucketForDueDate(null, today)).toBe('sin-fecha')
  })
})

describe('groupTasksByBucket', () => {
  it('agrupa manteniendo el orden dentro de cada grupo', () => {
    const tasks = [
      { id: '1', due_date: '2026-11-13' },
      { id: '2', due_date: null },
      { id: '3', due_date: '2026-11-11' },
      { id: '4', due_date: '2026-11-12' },
      { id: '5', due_date: '2026-11-14' },
    ]
    const groups = groupTasksByBucket(
      tasks,
      new Date('2026-11-12T10:00:00.000Z'),
    )
    expect(groups.vencidas.map((task) => task.id)).toEqual(['3'])
    expect(groups.hoy.map((task) => task.id)).toEqual(['4'])
    expect(groups.proximos.map((task) => task.id)).toEqual(['1', '5'])
    expect(groups['sin-fecha'].map((task) => task.id)).toEqual(['2'])
  })

  it('una tarea de las 00:30 en Madrid cuenta como «hoy»', () => {
    const tasks = [{ id: '1', due_date: '2026-11-12' }]
    const groups = groupTasksByBucket(
      tasks,
      new Date('2026-11-11T23:30:00.000Z'),
    )
    expect(groups.hoy.map((task) => task.id)).toEqual(['1'])
    expect(groups.vencidas).toEqual([])
  })
})
