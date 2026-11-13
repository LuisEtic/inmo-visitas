import { z } from 'npm:zod@4'

/**
 * Mapeadores de la ficha de la visita a cada CRM (Fase 7). Funciones
 * puras, sin APIs de Deno: las importa `index.ts` y se prueban con
 * Vitest.
 *
 * Formato PROPIO («inmo-visitas v1»): NO es la API real de Inmovilla
 * ni la de Witei (su acceso real está sin confirmar). Cuando haya
 * acceso, solo cambiará este archivo y los *secrets* `CRM_*`.
 *
 * Minimización (RGPD): al CRM solo va la ficha (datos revisados,
 * tareas abiertas, cliente, inmueble, agente y fecha). NUNCA la
 * transcripción, el texto de la nota, el audio (ni su ruta), las citas
 * literales, los datos descartados ni los borradores. El presupuesto
 * va siempre como «(declarado)».
 *
 * `buildSummary` es una copia mínima de
 * `src/features/export/summary.ts`: la función no puede importar de
 * `src/`. Si cambia el formato de la ficha, hay que cambiarlo aquí
 * también; el test compara ambas salidas con la nota de ejemplo.
 */

export type FactCategory =
  | 'hecho_declarado'
  | 'observacion'
  | 'objecion'
  | 'presupuesto'
  | 'cita_pendiente'
  | 'desconocido'

export type SummaryFactInput = {
  category: FactCategory
  field_name: string
  value: string
}

export type SummaryTaskInput = {
  description: string
  due_date: string | null
}

export type SummaryDataInput = {
  note: { id: string; created_at: string; approved_at: string | null }
  client: {
    full_name: string
    phone: string | null
    email: string | null
    is_temporary: boolean
  }
  property: { reference: string; address: string; city: string }
  agent: { full_name: string }
  facts: SummaryFactInput[]
  tasks: SummaryTaskInput[]
}

export type VisitSummaryFactJson = {
  category: FactCategory
  field: string
  label: string
  value: string
}

export type VisitSummaryGroupJson = {
  category: FactCategory
  title: string
  facts: VisitSummaryFactJson[]
}

export type VisitSummaryJson = {
  schema: 'inmo-visitas.v1'
  visit_note_id: string
  reference: string
  address: string
  city: string
  visited_at: string
  approved_at: string | null
  agent: string
  client: {
    name: string
    phone: string | null
    email: string | null
    provisional: boolean
  }
  groups: VisitSummaryGroupJson[]
  tasks: SummaryTaskInput[]
}

export type SummaryInput = {
  text: string
  json: VisitSummaryJson
}

/** La ficha no pasa de 3000 caracteres (igual que en `summary.ts`). */
export const SUMMARY_MAX_CHARS = 3000

const SUMMARY_CATEGORY_ORDER: FactCategory[] = [
  'hecho_declarado',
  'observacion',
  'objecion',
  'presupuesto',
  'cita_pendiente',
  'desconocido',
]

const CATEGORY_TITLES: Record<FactCategory, string> = {
  objecion: 'Objeciones',
  presupuesto: 'Presupuesto declarado',
  cita_pendiente: 'Citas pendientes (sin confirmar)',
  desconocido: 'Por confirmar',
  hecho_declarado: 'Hechos declarados',
  observacion: 'Observaciones',
}

/** `segunda_visita` → «Segunda visita» (copia de `labels.ts`). */
function fieldLabel(fieldName: string): string {
  const label = fieldName.split('_').join(' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * `+34612345678` → `612 34 56 78` (copia mínima de `contact.ts`:
 * acepta también los teléfonos del seed, `+34 611 100 200`).
 */
function formatPhone(phone: string): string {
  const cleaned = phone.trim().replace(/[\s.\-()]/g, '')
  const match = /^\+34([6789]\d{8})$/.exec(cleaned)
  if (match === null) {
    return phone.trim()
  }
  const digits = match[1]
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`
}

const visitDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
})

const dueDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
})

/**
 * Etiqueta de un dato de presupuesto: siempre «declarado», sin
 * repetirlo si el nombre del campo ya lo dice (`presupuesto_declarado`
 * → «Presupuesto declarado», no «Presupuesto declarado (declarado)»).
 */
function budgetLabel(label: string): string {
  return /declarad/i.test(label) ? label : `${label} (declarado)`
}

function factLine(fact: VisitSummaryFactJson): string {
  const label =
    fact.category === 'presupuesto' ? budgetLabel(fact.label) : fact.label
  return `- ${label}: ${fact.value}`
}

function taskLine(task: SummaryTaskInput): string {
  const due =
    task.due_date !== null
      ? dueDateFormatter.format(new Date(task.due_date))
      : 'sin fecha'
  return `- ${task.description} (${due})`
}

/** Recorta un texto a 3000 caracteres, con «…» si se cortó algo. */
function trimToLimit(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) {
    return text
  }
  return `${text.slice(0, SUMMARY_MAX_CHARS - 1)}…`
}

/** El JSON estructurado de la ficha, con los grupos en orden. */
export function buildSummaryJson(input: SummaryDataInput): VisitSummaryJson {
  const { note, client, property, agent, facts, tasks } = input
  const groups: VisitSummaryGroupJson[] = SUMMARY_CATEGORY_ORDER.map(
    (category) => ({
      category,
      title: CATEGORY_TITLES[category],
      facts: facts
        .filter((fact) => fact.category === category)
        .map((fact) => ({
          category: fact.category,
          field: fact.field_name,
          label: fieldLabel(fact.field_name),
          value: fact.value,
        })),
    }),
  ).filter((group) => group.facts.length > 0)
  return {
    schema: 'inmo-visitas.v1',
    visit_note_id: note.id,
    reference: property.reference,
    address: property.address,
    city: property.city,
    visited_at: note.created_at,
    approved_at: note.approved_at,
    agent: agent.full_name,
    client: {
      name: client.full_name,
      phone: client.phone,
      email: client.email,
      provisional: client.is_temporary,
    },
    groups,
    tasks: tasks.map((task) => ({
      description: task.description,
      due_date: task.due_date,
    })),
  }
}

/** El texto de la ficha, a partir de su JSON (mismo formato que `summary.ts`). */
export function buildSummaryText(json: VisitSummaryJson): string {
  const headerLines = [
    `Visita ${json.reference} · ${json.address}, ${json.city}`,
    `${visitDateFormatter.format(new Date(json.visited_at))} · Agente: ${json.agent}`,
    [
      `Cliente: ${json.client.name}${json.client.provisional ? ' (provisional)' : ''}`,
      json.client.phone !== null && json.client.phone !== ''
        ? formatPhone(json.client.phone)
        : null,
      json.client.email !== null && json.client.email !== ''
        ? json.client.email
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · '),
  ]
  const groupLines: string[] = []
  for (const group of json.groups) {
    groupLines.push(`${group.title}:`)
    for (const fact of group.facts) {
      groupLines.push(factLine(fact))
    }
  }
  const base = [...headerLines, ...groupLines].join('\n')
  const taskLines = json.tasks.map((task) => taskLine(task))
  if (taskLines.length === 0) {
    return trimToLimit(base)
  }
  const withAllTasks = `${base}\nTareas:\n${taskLines.join('\n')}`
  if (withAllTasks.length <= SUMMARY_MAX_CHARS) {
    return withAllTasks
  }
  const kept: string[] = []
  for (const line of taskLines) {
    const candidate = `${base}\nTareas:\n${[...kept, line].join('\n')}\n…`
    if (candidate.length > SUMMARY_MAX_CHARS) {
      break
    }
    kept.push(line)
  }
  if (kept.length > 0) {
    return `${base}\nTareas:\n${kept.join('\n')}\n…`
  }
  return trimToLimit(`${base}\n…`)
}

/** La ficha completa (texto + JSON) a partir de los datos ya filtrados. */
export function buildSummary(input: SummaryDataInput): SummaryInput {
  const json = buildSummaryJson(input)
  return { text: buildSummaryText(json), json }
}

// ---------------------------------------------------------------------------
// Formatos propios de cada CRM («inmo-visitas v1», NO la API real).
// ---------------------------------------------------------------------------

const summaryFactSchema = z.object({
  category: z.enum([
    'hecho_declarado',
    'observacion',
    'objecion',
    'presupuesto',
    'cita_pendiente',
    'desconocido',
  ]),
  field: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
})

const summaryTaskSchema = z.object({
  description: z.string().min(1),
  due_date: z.string().nullable(),
})

export const inmovillaPayloadSchema = z.object({
  schema: z.literal('inmo-visitas.v1'),
  referencia: z.string().min(1),
  cliente: z.object({
    nombre: z.string().min(1),
    telefono: z.string().nullable(),
    email: z.string().nullable(),
  }),
  visita: z.object({
    fecha: z.string().min(1),
    agente: z.string().min(1),
  }),
  comentarios: z.string().min(1),
  datos: z.array(summaryFactSchema),
  tareas: z.array(summaryTaskSchema),
})

export const witeiPayloadSchema = z.object({
  schema: z.literal('inmo-visitas.v1'),
  property_reference: z.string().min(1),
  contact: z.object({
    name: z.string().min(1),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  visit: z.object({
    date: z.string().min(1),
    agent: z.string().min(1),
  }),
  notes: z.string().min(1),
  facts: z.array(summaryFactSchema),
  tasks: z.array(summaryTaskSchema),
})

export type InmovillaPayload = z.infer<typeof inmovillaPayloadSchema>
export type WiteiPayload = z.infer<typeof witeiPayloadSchema>

/** Datos de la ficha, en orden de grupo. El presupuesto va como declarado. */
function summaryFacts(json: VisitSummaryJson): VisitSummaryFactJson[] {
  return json.groups.flatMap((group) =>
    group.facts.map((fact) =>
      fact.category === 'presupuesto'
        ? { ...fact, label: budgetLabel(fact.label) }
        : fact,
    ),
  )
}

/**
 * Ficha → formato propio de Inmovilla («inmo-visitas v1», no su API
 * real). `comentarios` es el texto de la ficha.
 */
export function mapToInmovilla(summary: SummaryInput): InmovillaPayload {
  const { json } = summary
  return {
    schema: 'inmo-visitas.v1',
    referencia: json.reference,
    cliente: {
      nombre: json.client.name,
      telefono: json.client.phone,
      email: json.client.email,
    },
    visita: { fecha: json.visited_at, agente: json.agent },
    comentarios: summary.text,
    datos: summaryFacts(json),
    tareas: json.tasks,
  }
}

/**
 * Ficha → formato propio de Witei («inmo-visitas v1», no su API real).
 * `notes` es el texto de la ficha.
 */
export function mapToWitei(summary: SummaryInput): WiteiPayload {
  const { json } = summary
  return {
    schema: 'inmo-visitas.v1',
    property_reference: json.reference,
    contact: {
      name: json.client.name,
      phone: json.client.phone,
      email: json.client.email,
    },
    visit: { date: json.visited_at, agent: json.agent },
    notes: summary.text,
    facts: summaryFacts(json),
    tasks: json.tasks,
  }
}

/**
 * Firma HMAC-SHA256 del cuerpo (Web Crypto) para
 * `X-InmoVisitas-Signature: sha256=<hex>`. Devuelve el hex en
 * minúsculas.
 */
export async function signBody(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body),
  )
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
