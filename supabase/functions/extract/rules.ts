import { z } from 'npm:zod@4'

/**
 * Reglas de la extracción (Fase 5). Funciones puras, sin APIs de Deno:
 * las importa `index.ts` y se prueban con Vitest.
 *
 * Las reglas mandan sobre la IA: un dato sin cita literal en el texto
 * se descarta, los campos sensibles (art. 9 RGPD) se descartan y los
 * duplicados se quedan con la mayor confianza. Aquí no se escribe en
 * ningún log el texto de la nota ni los datos.
 */

/** Categorías de `extracted_facts` (check de la migración 0001). */
export const FACT_CATEGORIES = [
  'hecho_declarado',
  'observacion',
  'desconocido',
  'objecion',
  'presupuesto',
  'cita_pendiente',
] as const

/**
 * Subcadenas que marcan un campo como categoría especial de datos
 * (art. 9 RGPD): nunca se extraen, aunque aparezcan en el texto.
 */
export const SENSITIVE_FIELDS = [
  'salud',
  'enfermedad',
  'religion',
  'etnia',
  'origen',
  'nacionalidad',
  'orientacion',
  'ideologia',
  'politica',
  'embarazo',
  'discapacidad',
] as const

const factSchema = z.object({
  category: z.enum(FACT_CATEGORIES),
  field_name: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  value: z.string().min(1).max(300),
  evidence_quote: z.string().min(1).max(300),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .transform((value) => Math.round(value * 100) / 100),
})

export const modelResponseSchema = z.object({
  facts: z.array(factSchema).max(30),
})

export type ModelFact = z.output<typeof factSchema>
export type ModelResponse = z.output<typeof modelResponseSchema>

export type ParsedModelResponse =
  | { ok: true; facts: ModelFact[] }
  | { ok: false }

/**
 * Parsea y valida con Zod el contenido JSON que devuelve el modelo.
 * JSON no válido o esquema no válido → `{ ok: false }`.
 */
export function parseModelResponse(content: string): ParsedModelResponse {
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    return { ok: false }
  }
  const parsed = modelResponseSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false }
  }
  return { ok: true, facts: parsed.data.facts }
}

/** Comillas tipográficas que se quitan al comparar citas con el texto. */
const QUOTE_CHARS = /[«»"“”„‚'‘’`´]/g

/**
 * Normaliza un texto para comparar citas: NFC, minúsculas, sin
 * comillas y con los espacios colapsados. Dos fragmentos que solo se
 * diferencian en comillas, mayúsculas o espacios se consideran iguales.
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

/** Un campo es sensible si su nombre contiene alguna de las subcadenas. */
export function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase()
  return SENSITIVE_FIELDS.some((word) => lower.includes(word))
}

export type AppliedRules = {
  kept: ModelFact[]
  discardedNoEvidence: number
  discardedSensitive: number
}

function dedupeKey(fact: ModelFact): string {
  return `${fact.category}|${fact.field_name}|${normalizeForEvidence(fact.value)}`
}

/**
 * Aplica las reglas a los datos del modelo, en este orden: descarta los
 * sensibles, descarta los sin evidencia y, entre duplicados (misma
 * categoría + campo + valor normalizado), se queda el de mayor confianza.
 */
export function applyExtractionRules(
  facts: ModelFact[],
  text: string,
): AppliedRules {
  const kept: ModelFact[] = []
  const keptIndex = new Map<string, number>()
  let discardedNoEvidence = 0
  let discardedSensitive = 0

  for (const fact of facts) {
    if (isSensitiveField(fact.field_name)) {
      discardedSensitive += 1
      continue
    }
    if (!hasEvidence(fact.evidence_quote, text)) {
      discardedNoEvidence += 1
      continue
    }
    const key = dedupeKey(fact)
    const existing = keptIndex.get(key)
    if (existing === undefined) {
      keptIndex.set(key, kept.length)
      kept.push(fact)
    } else if (fact.confidence > kept[existing].confidence) {
      kept[existing] = fact
    }
  }

  return { kept, discardedNoEvidence, discardedSensitive }
}
