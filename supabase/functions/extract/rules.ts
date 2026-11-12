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
 * Longitud mínima de una cita (revisión de la Fase 5): al menos
 * `MIN_QUOTE_WORDS` palabras y `MIN_QUOTE_CHARS` caracteres, ya
 * normalizada. Una cita como «a» o «el» aparece en casi cualquier texto
 * y no respalda nada.
 */
export const MIN_QUOTE_WORDS = 2
export const MIN_QUOTE_CHARS = 8

/**
 * La cita debe tener la longitud mínima y aparecer en el texto
 * comparando ambos normalizados. Una cita vacía o trivial nunca cuenta
 * como evidencia.
 */
export function hasEvidence(quote: string, text: string): boolean {
  const normalizedQuote = normalizeForEvidence(quote)
  if (
    normalizedQuote.length < MIN_QUOTE_CHARS ||
    normalizedQuote.split(' ').length < MIN_QUOTE_WORDS
  ) {
    return false
  }
  return normalizeForEvidence(text).includes(normalizedQuote)
}

/** Un campo es sensible si su nombre contiene alguna de las subcadenas. */
export function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase()
  return SENSITIVE_FIELDS.some((word) => lower.includes(word))
}

/**
 * Patrones que marcan un VALOR como categoría especial (art. 9 RGPD),
 * sobre el texto en minúsculas y sin tildes, con límite de palabra
 * (`terraza` no es `raza`, `saludo` no es `salud`). Es más corta que
 * `SENSITIVE_FIELDS`: «origen» o «política» son habituales en notas
 * inmobiliarias («el origen del ruido», «política de mascotas») y en el
 * valor darían falsos positivos.
 */
export const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /\bsalud\b/,
  /\benferm(o|a|os|as|edad|edades)\b/,
  /\bdiagnostic/,
  /\breligi(on|osa|oso|osas|osos)\b/,
  /\betni(a|as|co|ca|cos|cas)\b/,
  /\braza\b/,
  /\bnacionalidad\b/,
  /\borientacion sexual\b/,
  /\b(homo|hetero|bi)sexual/,
  /\bideologia\b/,
  /\bafiliacion politica\b/,
  /\bsindica(to|tos|l)\b/,
  /\bembaraz(o|ada)\b/,
  /\bdiscapacidad\b/,
]

/** Minúsculas y sin tildes, para comparar con `SENSITIVE_VALUE_PATTERNS`. */
function foldAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Un valor es sensible si coincide con alguno de los patrones. */
export function isSensitiveValue(value: string): boolean {
  const folded = foldAccents(value)
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(folded))
}

/**
 * Un dato es sensible si lo es su nombre o su valor. La cita no se
 * mira: puede contener contexto legítimo junto a otra cosa.
 */
export function isSensitiveFact(fact: { field_name: string; value: string }): boolean {
  return isSensitiveField(fact.field_name) || isSensitiveValue(fact.value)
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
 * sensibles (por nombre o por valor), descarta los sin evidencia y, entre duplicados (misma
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
    if (isSensitiveFact(fact)) {
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
