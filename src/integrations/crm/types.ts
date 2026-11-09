import { z } from 'zod'
import type { CrmTarget } from '../../config/client'

/** Destinos de exportación de una nota de visita (tabla `crm_exports`). */
export const crmTargetSchema = z.enum(['inmovilla', 'witei', 'whatsapp', 'manual'])

export const visitNoteExportPayloadSchema = z.object({
  visitNoteId: z.string().uuid(),
  clientName: z.string().min(1),
  propertyReference: z.string().min(1),
  summary: z.string(),
})

export type VisitNoteExportPayload = z.infer<typeof visitNoteExportPayloadSchema>

export interface CrmExportResult {
  ok: boolean
  externalId?: string
  error?: string
}

/**
 * Interfaz común de todos los adaptadores CRM.
 * Añadir un CRM = añadir un archivo con esta interfaz, sin tocar el resto.
 * En la Fase 1 todos los adaptadores son stubs: devuelven
 * `ok: false` con "No implementado en Fase 1". La lógica real llega
 * en la fase de exportación.
 */
export interface CrmAdapter {
  readonly target: CrmTarget
  readonly label: string
  exportVisitNote(payload: VisitNoteExportPayload): Promise<CrmExportResult>
}
