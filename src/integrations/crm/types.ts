import { z } from 'zod'
import type { CrmTarget } from '../../config/client'
import type { VisitSummary } from '../../features/export/summary'
import type { CrmExportRow } from '../../lib/database.types'

/** Destinos de exportación de una nota de visita (tabla `crm_exports`). */
export const crmTargetSchema = z.enum(['inmovilla', 'witei', 'whatsapp', 'manual'])

/** Entrada de una exportación: la nota y su ficha ya construida. */
export type VisitNoteExportInput = {
  visitNoteId: string
  summary: VisitSummary
}

export interface CrmExportResult {
  ok: boolean
  status?: 'enviado' | 'entregado' | 'error'
  exportId?: string
  externalId?: string
  simulated?: boolean
  /** Enlace a abrir (WhatsApp) cuando la entrega es por enlace. */
  href?: string
  /**
   * Fila registrada (`manual` y `whatsapp`), para que la UI la muestre
   * al momento sin esperar a recargar el historial.
   */
  row?: CrmExportRow
  error?: string
}

/**
 * Interfaz común de todos los adaptadores CRM.
 * Añadir un CRM = añadir un archivo con esta interfaz, sin tocar el resto.
 * Desde la Fase 7 ya no son *stubs*: `inmovilla` y `witei` llaman a la
 * Edge Function `crm-export` (modo simulado mientras no haya acceso real
 * a sus API); `manual` copia la ficha y `whatsapp` la comparte, y ambos
 * registran la entrega en `crm_exports`.
 */
export interface CrmAdapter {
  readonly target: CrmTarget
  readonly label: string
  exportVisitNote(input: VisitNoteExportInput): Promise<CrmExportResult>
}
