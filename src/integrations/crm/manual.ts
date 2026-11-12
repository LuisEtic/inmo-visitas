import { recordDelivery } from '../../features/export/deliveries'
import type { CrmAdapter, CrmExportResult, VisitNoteExportInput } from './types'

/**
 * Adaptador manual (Fase 7): copia la ficha al portapapeles y registra
 * la entrega (`manual` / `nota` / `entregado`). Si el portapapeles
 * falla, devuelve `ok: false` para que la UI muestre la ficha y el
 * agente la copie a mano; en ese caso NO se registra la entrega,
 * porque la ficha no llegó al agente.
 */
export const manualAdapter: CrmAdapter = {
  target: 'manual',
  label: 'Manual',
  async exportVisitNote(input: VisitNoteExportInput): Promise<CrmExportResult> {
    try {
      await navigator.clipboard.writeText(input.summary.text)
    } catch {
      return {
        ok: false,
        error:
          'No se ha podido copiar la ficha. Cópiala a mano del texto de abajo.',
      }
    }
    try {
      const row = await recordDelivery({
        noteId: input.visitNoteId,
        target: 'manual',
        kind: 'nota',
      })
      return { ok: true, status: 'entregado', exportId: row.id }
    } catch (error: unknown) {
      return {
        ok: false,
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'No se ha podido registrar la copia.',
      }
    }
  },
}
