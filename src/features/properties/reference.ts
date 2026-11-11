/**
 * Referencias de inmuebles (parche de la Fase 3).
 * La referencia se escribe a mano y en el móvil salen guiones parecidos
 * o espacios: se normaliza antes de validar. La siguiente libre se
 * calcula sobre las referencias que ya tiene el agente.
 */

/** Guiones que el teclado del móvil puede producir en lugar de `-`. */
const DASH_LIKE = /[‐‑‒–—―−]/g

/**
 * Normaliza una referencia: mayúsculas, guiones parecidos → `-` y sin
 * espacios. `v–52` → `V-52`; `V 52` → `V52`.
 */
export function normalizeReference(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(DASH_LIKE, '-')
    .replace(/\s+/g, '')
}

/**
 * Siguiente referencia libre con forma `V-NN`: el mayor número entre las
 * referencias `V-<n>` que ya existen, más uno, con al menos 2 dígitos.
 * Sin referencias `V-NN` previas → `V-01`. Las que no tienen forma
 * `V-<n>` se ignoran.
 */
export function nextFreeReference(references: string[]): string {
  let max = 0
  for (const reference of references) {
    const match = /^V-(\d+)$/i.exec(reference.trim())
    if (match !== null) {
      max = Math.max(max, Number(match[1]))
    }
  }
  return `V-${String(max + 1).padStart(2, '0')}`
}
