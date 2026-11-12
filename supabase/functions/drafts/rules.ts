import { z } from 'npm:zod@4'

/**
 * Reglas de los borradores duales (Fase 6). Funciones puras, sin APIs
 * de Deno: las importa `index.ts` y se prueban con Vitest.
 *
 * Las reglas mandan sobre la IA: el borrador al propietario nunca
 * recibe ni revela presupuesto ni finanzas del comprador, ningún
 * borrador da por confirmada una cita ni inventa una hora, y cada
 * cita pendiente tiene su tarea de confirmar. Aquí no se escribe en
 * ningún log el texto de la nota, los datos, los borradores ni la
 * respuesta del modelo.
 */

export type DraftAudience = 'comprador' | 'propietario'

/** Dato no descartado tal como se envía al modelo (sin id ni cita). */
export type FactInput = {
  category: string
  field_name: string
  value: string
}

/** Tarea que propone la IA en la llamada del comprador. */
export type AiTask = {
  description: string
  fact_index: number
}

/**
 * Términos económicos: un dato cuyo nombre o valor los contenga no va
 * a la llamada del propietario, y un borrador al propietario que los
 * contenga se rechaza. Se comparan en minúsculas y sin tildes.
 */
export const FINANCE_TERMS = [
  'presupuesto',
  'financ',
  'hipoteca',
  'banco',
  'prestamo',
  'préstamo',
  'ingresos',
  'nomina',
  'nómina',
  'ahorro',
  'entrada',
  'solvencia',
  'tasacion',
  'aval',
] as const

/** Minúsculas y sin tildes, para comparar términos y valores. */
export function foldAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Una cifra de dinero: `230.000 €`, `230000 eur`, `230 mil`… */
export const MONEY_FIGURE_PATTERN = /\d[\d.]*\s*(€|eur|euros|mil)/i

export function containsMoneyFigure(text: string): boolean {
  return MONEY_FIGURE_PATTERN.test(text)
}

/** Un texto contiene alguno de los términos económicos. */
export function matchesFinanceTerm(text: string): boolean {
  const folded = foldAccents(text)
  return FINANCE_TERMS.some((term) => folded.includes(foldAccents(term)))
}

/**
 * Datos para la llamada del comprador: todos los no descartados, tal
 * cual (categoría, nombre y valor). No se envían nombres, teléfonos,
 * dirección, precio ni citas.
 */
export function buyerFacts(facts: FactInput[]): FactInput[] {
  return facts.map((fact) => ({
    category: fact.category,
    field_name: fact.field_name,
    value: fact.value,
  }))
}

/**
 * Valores de los datos `presupuesto` de la nota (de TODOS los no
 * descartados, no de `ownerFacts`, que ya no los lleva): con ellos se
 * comprueba que el borrador al propietario no revela el presupuesto.
 */
export function budgetValuesOf(facts: FactInput[]): string[] {
  return facts
    .filter((fact) => fact.category === 'presupuesto')
    .map((fact) => fact.value)
}

function isFinanceFact(fact: FactInput): boolean {
  return (
    matchesFinanceTerm(fact.field_name) ||
    matchesFinanceTerm(fact.value) ||
    containsMoneyFigure(fact.value)
  )
}

/**
 * Datos para la llamada del propietario: sin la categoría
 * `presupuesto` y sin ningún dato cuyo nombre o valor sea económico
 * o contenga una cifra de dinero. La llamada aparte es lo que
 * garantiza que el modelo no ve el presupuesto: no basta con
 * pedírselo.
 */
export function ownerFacts(facts: FactInput[]): FactInput[] {
  return facts
    .filter((fact) => fact.category !== 'presupuesto' && !isFinanceFact(fact))
    .map((fact) => ({
      category: fact.category,
      field_name: fact.field_name,
      value: fact.value,
    }))
}

const buyerResponseSchema = z.object({
  draft: z.string().min(1).max(1500),
  tasks: z
    .array(
      z.object({
        description: z.string().min(3).max(200),
        fact_index: z.number().int().min(0),
      }),
    )
    .max(10)
    .optional()
    .default([]),
})

const ownerResponseSchema = z.object({
  draft: z.string().min(1).max(1500),
})

export type BuyerResponse = z.output<typeof buyerResponseSchema>
export type OwnerResponse = z.output<typeof ownerResponseSchema>

export type ParsedBuyerResponse =
  | { ok: true; data: BuyerResponse }
  | { ok: false }

export type ParsedOwnerResponse =
  | { ok: true; data: OwnerResponse }
  | { ok: false }

/**
 * Parsea y valida con Zod el JSON que devuelve el modelo para el
 * comprador. JSON no válido o esquema no válido → `{ ok: false }`.
 * `tasks` es opcional (sin `audience` la IA las propone; con
 * `audience` no se piden).
 */
export function parseBuyerResponse(content: string): ParsedBuyerResponse {
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    return { ok: false }
  }
  const parsed = buyerResponseSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false }
  }
  return { ok: true, data: parsed.data }
}

/** Igual que `parseBuyerResponse`, para el borrador al propietario. */
export function parseOwnerResponse(content: string): ParsedOwnerResponse {
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    return { ok: false }
  }
  const parsed = ownerResponseSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false }
  }
  return { ok: true, data: parsed.data }
}

/** Marcadores que admite cada borrador. */
export const ALLOWED_PLACEHOLDERS: Record<DraftAudience, readonly string[]> = {
  comprador: ['{nombre}', '{inmueble}', '{agente}'],
  propietario: ['{propietario}', '{inmueble}', '{agente}'],
}

export type PlaceholderCheck =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Comprueba que el borrador solo usa los marcadores de su
 * destinatario. Cualquier otro `{...}` (en especial `{nombre}` en el
 * del propietario) → rechazo con el marcador que lo causó.
 */
export function checkPlaceholders(
  text: string,
  audience: DraftAudience,
): PlaceholderCheck {
  const allowed = ALLOWED_PLACEHOLDERS[audience]
  const found = text.match(/\{[^}]*\}/g) ?? []
  for (const marker of found) {
    const normalized = `{${marker.slice(1, -1).trim()}}`
    if (!allowed.includes(normalized)) {
      return {
        ok: false,
        reason: `usa el marcador ${marker}, que no está permitido para el ${audience}`,
      }
    }
  }
  return { ok: true }
}

/** Primera palabra de un nombre completo («Ana García» → «Ana»). */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

export type PlaceholderValues = {
  /** Nombre de pila del cliente; null si es provisional. */
  clientFirstName: string | null
  /** El cliente es provisional: el saludo va sin nombre. */
  isProvisional: boolean
  ownerFirstName: string
  /** Referencia + dirección, p. ej. `V-18 (calle Alcalá 120)`. */
  inmueble: string
  agente: string
}

/**
 * Sustituye los marcadores por sus valores. `{nombre}` es solo el
 * nombre de pila del cliente; si es provisional, se quita y el
 * saludo queda en «Hola,» (se limpia el espacio antes de la coma).
 * `{inmueble}` es la referencia con la dirección entre paréntesis.
 */
export function fillPlaceholders(
  text: string,
  values: PlaceholderValues,
): string {
  const replaced = text
    .replace(
      /\{\s*nombre\s*\}/g,
      values.isProvisional || values.clientFirstName === null
        ? ''
        : values.clientFirstName,
    )
    .replace(/\{\s*propietario\s*\}/g, values.ownerFirstName)
    .replace(/\{\s*inmueble\s*\}/g, values.inmueble)
    .replace(/\{\s*agente\s*\}/g, values.agente)
  return replaced
    .replace(/\s+,/g, ',')
    .replace(/ {2,}/g, ' ')
}

/** Escapa un nombre para usarlo en una expresión regular. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** ¿El texto menciona este nombre como palabra completa? */
export function containsName(text: string, name: string): boolean {
  if (name.trim() === '') {
    return false
  }
  return new RegExp(`\\b${escapeRegExp(foldAccents(name))}\\b`).test(
    foldAccents(text),
  )
}

export type RequiredNamesCheck = { ok: true } | { ok: false; reason: string }

/**
 * Saludo del borrador: el texto hasta la primera coma, dos puntos,
 * exclamación o salto de línea («Hola Ana,» → «Hola Ana»).
 */
export function greetingOf(text: string): string {
  return text.trim().split(/[,:;!\n]/)[0] ?? ''
}

/**
 * El borrador final debe saludar a su destinatario por su nombre de
 * pila (en el saludo, no en cualquier parte del texto) y firmar con el
 * nombre completo del agente. El del comprador, además, no puede
 * nombrar al propietario. Si el modelo sustituye los marcadores por
 * nombres inventados (p. ej. «Hola Carlos» en el del comprador), se
 * rechaza aunque el nombre real aparezca en otro sitio.
 */
export function requiredNames(
  text: string,
  audience: DraftAudience,
  values: PlaceholderValues,
): RequiredNamesCheck {
  const greeting = greetingOf(text)
  if (audience === 'comprador') {
    if (
      values.clientFirstName !== null &&
      !containsName(greeting, values.clientFirstName)
    ) {
      return { ok: false, reason: 'no saluda al cliente por su nombre' }
    }
    const owner = values.ownerFirstName
    if (
      owner.length >= 3 &&
      foldAccents(owner) !== foldAccents(values.clientFirstName ?? '') &&
      !containsName(values.agente, owner) &&
      containsName(text, owner)
    ) {
      return {
        ok: false,
        reason: 'menciona al propietario por su nombre en el borrador al comprador',
      }
    }
  } else if (
    values.ownerFirstName !== '' &&
    !containsName(greeting, values.ownerFirstName)
  ) {
    return { ok: false, reason: 'no saluda al propietario por su nombre' }
  }
  if (values.agente !== '' && !containsName(text, values.agente)) {
    return { ok: false, reason: 'no firma con el nombre del agente' }
  }
  return { ok: true }
}

/** Quita los separadores de miles: «230.000» y «230 000» → «230000». */
export function joinThousands(text: string): string {
  return text.replace(/(\d)[. \u00a0](?=\d{3}(?!\d))/g, '$1')
}

/**
 * Cifras de un valor de presupuesto, sin separadores, de 4 dígitos o
 * más («230.000 euros» → «230000»). Las de menos dígitos («230 mil»)
 * ya las atrapa el patrón de cifras de dinero.
 */
export function budgetFigures(value: string): string[] {
  return (joinThousands(value).match(/\d+/g) ?? []).filter(
    (figure) => figure.length >= 4,
  )
}

export type OwnerLeakCheck =
  | { leaks: false }
  | { leaks: true; reason: string }

/**
 * Comprueba, DESPUÉS de sustituir los marcadores, que el borrador al
 * propietario no filtra nada del comprador: ni términos económicos,
 * ni cifras de dinero, ni el valor de ningún dato `presupuesto`
 * (también sin puntos: `230000`), ni el nombre o los apellidos del
 * cliente.
 */
export function ownerLeaks(
  text: string,
  ctx: { budgetValues: string[]; clientFullName: string },
): OwnerLeakCheck {
  const folded = foldAccents(text)

  if (matchesFinanceTerm(text)) {
    return {
      leaks: true,
      reason: 'menciona datos económicos del comprador',
    }
  }
  if (containsMoneyFigure(text)) {
    return { leaks: true, reason: 'contiene una cifra de dinero' }
  }
  // Cifras del texto sin separadores de miles: «230.000» → «230000».
  const foldedDigits = joinThousands(folded)
  for (const value of ctx.budgetValues) {
    const foldedValue = foldAccents(value).trim()
    if (foldedValue !== '' && folded.includes(foldedValue)) {
      return { leaks: true, reason: 'revela el presupuesto del comprador' }
    }
    for (const figure of budgetFigures(value)) {
      if (new RegExp(`(?<!\\d)${figure}(?!\\d)`).test(foldedDigits)) {
        return { leaks: true, reason: 'revela el presupuesto del comprador' }
      }
    }
  }
  const nameParts = ctx.clientFullName
    .split(/\s+/)
    .map((part) => foldAccents(part))
    .filter((part) => part.length >= 3)
  for (const part of nameParts) {
    if (new RegExp(`\\b${part}\\b`).test(folded)) {
      return { leaks: true, reason: 'menciona el nombre del cliente' }
    }
  }
  return { leaks: false }
}

/** Formas de decir que una cita está confirmada. */
const CONFIRMED_PATTERNS: readonly RegExp[] = [
  /confirmad[oa]/,
  /confirmo|confirmamos/,
  /queda(mos)? (para|el)/,
  /nos vemos/,
  /te esperamos/,
  /hemos quedado/,
]

/**
 * Horas: `18:00`, `18.00`, `18h00`, `18h`, `18 h` y `a las 6`. Se
 * buscan TODAS las del texto (no solo la primera).
 */
const HOUR_PATTERNS: readonly RegExp[] = [
  /(?<![\d.,])(\d{1,2})[:.h](\d{2})(?![\d.,]?\d)/g,
  /\ba las (\d{1,2})(?:[:.h](\d{2}))?(?![\d.,]?\d)/g,
  /(?<![\d.,])(\d{1,2}) ?h\b/g,
]

/**
 * Hora encontrada: `key` normalizada `H:MM` en formato de 12 horas
 * (17:00 y 5:00 son la misma) y `raw`, el trozo tal como aparece.
 */
export type ClockTime = { key: string; raw: string }

/** Todas las horas de un texto, normalizadas. */
export function hoursIn(text: string): ClockTime[] {
  const folded = foldAccents(text)
  const found = new Map<string, ClockTime>()
  for (const pattern of HOUR_PATTERNS) {
    for (const match of folded.matchAll(pattern)) {
      const hour = Number(match[1])
      const minute = match[2] === undefined ? 0 : Number(match[2])
      if (hour > 23 || minute > 59) {
        continue
      }
      const key = `${hour % 12}:${String(minute).padStart(2, '0')}`
      if (!found.has(key)) {
        found.set(key, { key, raw: match[0].trim() })
      }
    }
  }
  return [...found.values()]
}

/**
 * Un dato dice que una cita está confirmada. «No confirmada», «sin
 * confirmar», «por confirmar» o «pendiente de confirmar» NO cuentan.
 */
export function factConfirms(fact: FactInput): boolean {
  const folded = foldAccents(fact.value)
  if (/\b(no|sin|por|falta|pendiente)\b[^.;]{0,20}confirm/.test(folded)) {
    return false
  }
  return /confirmad[oa]/.test(folded)
}

/**
 * Rechazo si el borrador da por confirmada una cita (salvo que un
 * dato no descartado diga que está confirmada) o si menciona alguna
 * hora que no está en ningún `value` de los datos.
 */
export function confirmsAppointment(
  text: string,
  facts: FactInput[],
): { confirmed: false } | { confirmed: true; reason: string } {
  const folded = foldAccents(text)
  const hasConfirmedFact = facts.some((fact) => factConfirms(fact))
  if (!hasConfirmedFact) {
    for (const pattern of CONFIRMED_PATTERNS) {
      if (pattern.test(folded)) {
        return {
          confirmed: true,
          reason: 'da por confirmada una cita que está pendiente',
        }
      }
    }
  }
  const factHours = new Set(
    facts.flatMap((fact) => hoursIn(fact.value).map((hour) => hour.key)),
  )
  for (const hour of hoursIn(text)) {
    if (!factHours.has(hour.key)) {
      return {
        confirmed: true,
        reason: `menciona la hora ${hour.raw}, que no está en los datos`,
      }
    }
  }
  return { confirmed: false }
}

export type DraftValidationContext = {
  /** Datos no descartados (los mismos que se enviaron al modelo). */
  facts: FactInput[]
  /**
   * Valores de TODOS los datos `presupuesto` no descartados de la nota.
   * Van aparte porque los datos del propietario (`ownerFacts`) ya no
   * los llevan: sin esto, el control del presupuesto no veía nada.
   */
  budgetValues: string[]
  clientFullName: string
  placeholders: PlaceholderValues
}

export type DraftCheck =
  | { ok: true; text: string }
  | { ok: false; reason: string }

/**
 * Valida un borrador del modelo: primero los marcadores sobre el
 * texto tal como viene (antes de sustituir) y después, ya sustituido,
 * que se dirija a su destinatario por su nombre y firme con el del
 * agente, (propietario) sin filtraciones del comprador y sin citas
 * confirmadas ni horas inventadas. Si pasa, devuelve el texto con
 * los marcadores sustituidos, listo para guardar. El motivo es lo que
 * se le añade al mensaje del sistema en el único reintento.
 */
export function validateDraft(
  rawText: string,
  audience: DraftAudience,
  ctx: DraftValidationContext,
): DraftCheck {
  const placeholders = checkPlaceholders(rawText, audience)
  if (!placeholders.ok) {
    return placeholders
  }
  const text = fillPlaceholders(rawText, ctx.placeholders)
  const names = requiredNames(text, audience, ctx.placeholders)
  if (!names.ok) {
    return names
  }
  if (audience === 'propietario') {
    const leak = ownerLeaks(text, {
      budgetValues: ctx.budgetValues,
      clientFullName: ctx.clientFullName,
    })
    if (leak.leaks) {
      return { ok: false, reason: leak.reason }
    }
  }
  const appointment = confirmsAppointment(text, ctx.facts)
  if (appointment.confirmed) {
    return { ok: false, reason: appointment.reason }
  }
  return { ok: true, text }
}

/** Normaliza una descripción para comparar tareas duplicadas. */
export function normalizeDescription(description: string): string {
  return description
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.¡!¿?]+$/g, '')
    .trim()
}

export type RequiredTask = {
  description: string
  fact_index: number
  origin: 'ia' | 'regla'
}

/**
 * Tareas definitivas a proponer: las de la IA con `fact_index`
 * válido (posición en la lista enviada) y sin duplicados (misma
 * descripción normalizada, se queda la primera), más una tarea de
 * regla por cada dato `cita_pendiente` que la IA no cubrió:
 * «Confirmar día y hora: <valor>».
 */
export function requiredTasks(
  facts: FactInput[],
  aiTasks: AiTask[],
): RequiredTask[] {
  const kept: RequiredTask[] = []
  const seen = new Set<string>()
  for (const task of aiTasks) {
    if (
      !Number.isInteger(task.fact_index) ||
      task.fact_index < 0 ||
      task.fact_index >= facts.length
    ) {
      continue
    }
    const description = task.description.trim()
    if (description.length < 3 || description.length > 200) {
      continue
    }
    const key = normalizeDescription(description)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    kept.push({ description, fact_index: task.fact_index, origin: 'ia' })
  }
  facts.forEach((fact, index) => {
    if (fact.category !== 'cita_pendiente') {
      return
    }
    const covered = kept.some((task) => task.fact_index === index)
    if (covered) {
      return
    }
    const description = `Confirmar día y hora: ${fact.value}`
    const key = normalizeDescription(description)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    kept.push({ description, fact_index: index, origin: 'regla' })
  })
  return kept
}
