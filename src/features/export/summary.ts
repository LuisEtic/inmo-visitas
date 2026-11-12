import { CATEGORY_TITLES, fieldLabel } from '../extraction/labels'
import { formatPhone } from '../../lib/contact'
import type { FactCategory } from '../../lib/database.types'

/**
 * Ficha de la visita (Fase 7): texto y JSON a partir de una nota
 * aprobada. Función pura: recibe la entrada ya filtrada (datos no
 * descartados, tareas `pendiente`) y no toca la red ni la base.
 *
 * Minimización (RGPD, decidido por Claude): a la ficha NO van la
 * transcripción, el texto de la nota, el audio (ni su ruta), las citas
 * literales, los datos descartados ni los borradores. Van los datos
 * revisados (categoría, nombre legible y valor), las tareas abiertas,
 * el cliente (nombre, teléfono, email), la referencia y la dirección
 * del inmueble, el nombre del agente y la fecha de la visita. El
 * presupuesto va siempre como «(declarado)»: es lo que el cliente
 * dijo, no una solvencia acreditada.
 */

/** La ficha no pasa de 3000 caracteres (cabe en un mensaje). */
export const SUMMARY_MAX_CHARS = 3000

export type SummaryFactInput = {
  category: FactCategory
  field_name: string
  value: string
}

export type SummaryTaskInput = {
  description: string
  due_date: string | null
}

export type VisitSummaryInput = {
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

export type VisitSummary = {
  text: string
  json: VisitSummaryJson
}

/**
 * Orden de los grupos en la ficha: el de la especificación de la
 * Fase 7 (hechos, observaciones, objeciones, presupuesto, citas y
 * pendiente de saber), distinto del orden de «Revisar»
 * (`CATEGORY_ORDER` en `labels.ts`).
 */
const SUMMARY_CATEGORY_ORDER: FactCategory[] = [
  'hecho_declarado',
  'observacion',
  'objecion',
  'presupuesto',
  'cita_pendiente',
  'desconocido',
]

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

function formatVisitDate(iso: string): string {
  return visitDateFormatter.format(new Date(iso))
}

function formatDueDate(date: string): string {
  return dueDateFormatter.format(new Date(date))
}

function factLine(fact: VisitSummaryFactJson): string {
  const declared = fact.category === 'presupuesto' ? ' (declarado)' : ''
  return `- ${fact.label}${declared}: ${fact.value}`
}

function taskLine(task: SummaryTaskInput): string {
  const due =
    task.due_date !== null ? formatDueDate(task.due_date) : 'sin fecha'
  return `- ${task.description} (${due})`
}

/**
 * Construye la ficha: el mismo contenido en texto (para copiar o
 * WhatsApp) y en JSON estructurado (para los CRM, `schema:
 * 'inmo-visitas.v1'`). Los grupos vacíos no salen. Si el texto pasa
 * de 3000 caracteres, se recortan las tareas (las últimas primero) y
 * se añade «…»; si ni sin tareas cabe, se trunca el texto a 3000 con
 * «…» al final.
 */
export function buildVisitSummary(input: VisitSummaryInput): VisitSummary {
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

  const json: VisitSummaryJson = {
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

  const headerLines = [
    `Visita ${property.reference} · ${property.address}, ${property.city}`,
    `${formatVisitDate(note.created_at)} · Agente: ${agent.full_name}`,
    [
      `Cliente: ${client.full_name}${client.is_temporary ? ' (provisional)' : ''}`,
      client.phone !== null && client.phone !== ''
        ? formatPhone(client.phone)
        : null,
      client.email !== null && client.email !== '' ? client.email : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · '),
  ]

  const groupLines: string[] = []
  for (const group of groups) {
    groupLines.push(`${group.title}:`)
    for (const fact of group.facts) {
      groupLines.push(factLine(fact))
    }
  }

  const base = [...headerLines, ...groupLines].join('\n')
  const taskLines = tasks.map((task) => taskLine(task))

  // Sin tareas, la ficha es la cabecera y los grupos.
  if (taskLines.length === 0) {
    return { text: trimToLimit(base), json }
  }

  const withAllTasks = `${base}\nTareas:\n${taskLines.join('\n')}`
  if (withAllTasks.length <= SUMMARY_MAX_CHARS) {
    return { text: withAllTasks, json }
  }

  // Recortar tareas (las últimas primero) hasta caber, reservando la
  // línea «…» que marca el recorte.
  const kept: string[] = []
  for (const line of taskLines) {
    const candidate = `${base}\nTareas:\n${[...kept, line].join('\n')}\n…`
    if (candidate.length > SUMMARY_MAX_CHARS) {
      break
    }
    kept.push(line)
  }
  if (kept.length > 0) {
    return { text: `${base}\nTareas:\n${kept.join('\n')}\n…`, json }
  }
  // Ni una tarea cabe: la ficha queda sin tareas y con «…».
  return { text: trimToLimit(`${base}\n…`), json }
}

/** Recorta un texto a 3000 caracteres, con «…» si se cortó algo. */
function trimToLimit(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) {
    return text
  }
  return `${text.slice(0, SUMMARY_MAX_CHARS - 1)}…`
}
