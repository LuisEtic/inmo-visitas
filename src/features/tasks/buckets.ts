/**
 * Agrupación de tareas pendientes por fecha (Fase 6). Funciones puras:
 * la fecha «hoy» es la de Europa/Madrid, no la del dispositivo.
 * Una tarea vencida ayer a las 23:30 UTC es «hoy» si en Madrid ya es
 * el día siguiente.
 */

export type TaskBucket = 'vencidas' | 'hoy' | 'proximos' | 'sin-fecha'

export const BUCKET_LABELS: Record<TaskBucket, string> = {
  vencidas: 'Vencidas',
  hoy: 'Hoy',
  proximos: 'Próximos días',
  'sin-fecha': 'Sin fecha',
}

/** Fecha local (YYYY-MM-DD) en Europe/Madrid para un instante dado. */
export function todayInMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** A qué grupo pertenece una fecha de vencimiento (o null). */
export function bucketForDueDate(
  dueDate: string | null,
  today: string,
): TaskBucket {
  if (dueDate === null) {
    return 'sin-fecha'
  }
  if (dueDate < today) {
    return 'vencidas'
  }
  if (dueDate === today) {
    return 'hoy'
  }
  return 'proximos'
}

/**
 * Agrupa las tareas en vencidas / hoy / próximos días / sin fecha,
 * manteniendo el orden dentro de cada grupo.
 */
export function groupTasksByBucket<T extends { due_date: string | null }>(
  tasks: readonly T[],
  now: Date = new Date(),
): Record<TaskBucket, T[]> {
  const today = todayInMadrid(now)
  const groups: Record<TaskBucket, T[]> = {
    vencidas: [],
    hoy: [],
    proximos: [],
    'sin-fecha': [],
  }
  for (const task of tasks) {
    groups[bucketForDueDate(task.due_date, today)].push(task)
  }
  return groups
}
