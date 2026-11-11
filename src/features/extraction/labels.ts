import type {
  FactCategory,
  FactReviewStatus,
  VisitNoteStatus,
} from '../../lib/database.types'

/**
 * Etiquetas de la extracción (Fase 5): títulos de categoría, etiqueta de
 * `field_name`, nivel de confianza y estado de la nota.
 */

/** Orden en que se agrupan los datos en `/notas/:id`. */
export const CATEGORY_ORDER: FactCategory[] = [
  'objecion',
  'presupuesto',
  'cita_pendiente',
  'desconocido',
  'hecho_declarado',
  'observacion',
]

export const CATEGORY_TITLES: Record<FactCategory, string> = {
  objecion: 'Objeciones',
  presupuesto: 'Presupuesto declarado',
  cita_pendiente: 'Citas pendientes (sin confirmar)',
  desconocido: 'Por confirmar',
  hecho_declarado: 'Hechos declarados',
  observacion: 'Observaciones',
}

export const REVIEW_STATUS_LABELS: Record<FactReviewStatus, string> = {
  propuesto: 'Propuesto',
  aceptado: 'Aceptado',
  editado: 'Editado',
  descartado: 'Descartado',
}

export const NOTE_STATUS_LABELS: Record<VisitNoteStatus, string> = {
  draft: 'Pendiente de transcribir',
  transcribed: 'Transcrita',
  extracted: 'Datos extraídos',
  reviewed: 'En revisión',
  approved: 'Aprobada',
}

/** `segunda_visita` → «Segunda visita». */
export function fieldLabel(fieldName: string): string {
  const label = fieldName.split('_').join(' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export type ConfidenceLevel = 'alta' | 'media' | 'baja'

/** Confianza alta ≥ 0,8 · media ≥ 0,5 · baja < 0,5. Sin confianza → null. */
export function confidenceLevel(confidence: number | null): ConfidenceLevel | null {
  if (confidence === null) {
    return null
  }
  if (confidence >= 0.8) {
    return 'alta'
  }
  if (confidence >= 0.5) {
    return 'media'
  }
  return 'baja'
}

/** «Confianza alta» / «Confianza media» / «Confianza baja» / null. */
export function confidenceText(confidence: number | null): string | null {
  const level = confidenceLevel(confidence)
  return level === null ? null : `Confianza ${level}`
}

/**
 * Nombre de dato a `snake_case`: «Segunda visita» → `segunda_visita`.
 * Quita acentos y convierte cualquier racha de no alfanuméricos en `_`.
 */
export function toFieldName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
