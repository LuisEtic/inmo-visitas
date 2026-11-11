/**
 * Evidencia en el frontend (Fase 5). Copia de `normalizeForEvidence` y
 * `hasEvidence` de `supabase/functions/extract/rules.ts` (el frontend no
 * importa de `supabase/functions`): hay que mantener ambas iguales.
 * Además, `findEvidenceRange` localiza la cita en el texto para
 * resaltarla con <mark> al tocar un dato.
 */

const QUOTE_CHARS = /[«»"“”„‚'‘’`´]/g
const QUOTE_CHAR = /[«»"“”„‚'‘’`´]/

/**
 * Normaliza un texto para comparar citas: NFC, minúsculas, sin
 * comillas y con los espacios colapsados.
 */
export function normalizeForEvidence(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(QUOTE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * La cita debe aparecer en el texto comparando ambos normalizados.
 * Una cita vacía nunca cuenta como evidencia.
 */
export function hasEvidence(quote: string, text: string): boolean {
  const normalizedQuote = normalizeForEvidence(quote)
  if (normalizedQuote === '') {
    return false
  }
  return normalizeForEvidence(text).includes(normalizedQuote)
}

type NormalizedMap = {
  normalized: string
  indexMap: number[]
  length: number
}

/**
 * Normaliza el texto y recuerda, para cada carácter normalizado, su
 * posición en el texto NFC original (para resaltar la cita).
 */
function normalizeWithMap(text: string): NormalizedMap {
  const nfc = text.normalize('NFC')
  let normalized = ''
  const indexMap: number[] = []
  let previousWasSpace = true
  for (let i = 0; i < nfc.length; i++) {
    const ch = nfc[i]
    if (QUOTE_CHAR.test(ch)) {
      continue
    }
    if (/\s/.test(ch)) {
      if (!previousWasSpace) {
        normalized += ' '
        indexMap.push(i)
        previousWasSpace = true
      }
      continue
    }
    normalized += ch.toLowerCase()
    indexMap.push(i)
    previousWasSpace = false
  }
  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1)
    indexMap.pop()
  }
  return { normalized, indexMap, length: nfc.length }
}

/**
 * Localiza la cita en el texto (primera aparición) y devuelve el rango
 * [start, end) para resaltarlo. Prueba en orden: literal, sin distinguir
 * mayúsculas y, por último, comparando ambos normalizados. Null si la
 * cita no está en el texto.
 */
export function findEvidenceRange(
  text: string,
  quote: string,
): { start: number; end: number } | null {
  if (quote.trim() === '') {
    return null
  }
  const direct = text.indexOf(quote)
  if (direct !== -1) {
    return { start: direct, end: direct + quote.length }
  }
  const lowerText = text.toLowerCase()
  const lowerQuote = quote.toLowerCase()
  const caseInsensitive = lowerText.indexOf(lowerQuote)
  if (caseInsensitive !== -1) {
    return { start: caseInsensitive, end: caseInsensitive + quote.length }
  }
  const { normalized, indexMap, length } = normalizeWithMap(text)
  const normalizedQuote = normalizeForEvidence(quote)
  if (normalizedQuote === '') {
    return null
  }
  const found = normalized.indexOf(normalizedQuote)
  if (found === -1) {
    return null
  }
  const start = indexMap[found]
  const endPosition = found + normalizedQuote.length
  const end = endPosition < indexMap.length ? indexMap[endPosition] : length
  return { start, end }
}
