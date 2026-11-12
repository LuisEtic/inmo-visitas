import { recordDelivery } from '../../features/export/deliveries'
import { whatsappShareHref } from '../../lib/contact'
import type { CrmAdapter, CrmExportResult, VisitNoteExportInput } from './types'

/**
 * Adaptador de WhatsApp (Fase 7): devuelve el enlace `wa.me` sin
 * número con la ficha ya escrita, para que la UI lo abra y el agente
 * elija el chat, y registra la entrega (`whatsapp` / `nota` /
 * `entregado`). La app no envía nada: el agente pulsa «Enviar» en
 * WhatsApp.
 */
export const whatsappAdapter: CrmAdapter = {
  target: 'whatsapp',
  label: 'WhatsApp',
  async exportVisitNote(input: VisitNoteExportInput): Promise<CrmExportResult> {
    const href = whatsappShareHref(input.summary.text)
    try {
      const row = await recordDelivery({
        noteId: input.visitNoteId,
        target: 'whatsapp',
        kind: 'nota',
      })
      return { ok: true, status: 'entregado', exportId: row.id, href }
    } catch (error: unknown) {
      return {
        ok: false,
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'No se ha podido registrar el envío.',
      }
    }
  },
}
