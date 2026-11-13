/**
 * Caducidad de exportaciones pendientes (Fase 9, B-7). Función pura:
 * la importa `index.ts` y se prueba con Vitest.
 *
 * Una fila `pendiente` es una exportación interrumpida (el navegador
 * se cerró o la red cayó antes de que el CRM respondiera) y no se va
 * a cerrar sola. Antes de insertar un nuevo intento, las propias de
 * esa nota y ese target con más de 10 minutos pasan a `error` con
 * «Sin respuesta (interrumpida)». No hay datos personales aquí: solo
 * id y fecha de creación.
 */

/** Una `pendiente` con más de 10 minutos se da por interrumpida. */
export const STALE_PENDING_MINUTES = 10

/** Mensaje de cierre de una exportación interrumpida. */
export const STALE_PENDING_MESSAGE = 'Sin respuesta (interrumpida)'

export type PendingExportRow = {
  id: string
  created_at: string
}

/**
 * Filas `pendiente` caducadas: las creadas hace más de
 * `STALE_PENDING_MINUTES` minutos (estrictamente más de 10: a los 10
 * minutos exactos aún no caduca). `now` es el instante de la
 * comprobación, en milisegundos desde la época.
 */
export function stalePendingExports(
  rows: PendingExportRow[],
  now: number,
): PendingExportRow[] {
  const cutoff = now - STALE_PENDING_MINUTES * 60_000
  return rows.filter((row) => Date.parse(row.created_at) < cutoff)
}
