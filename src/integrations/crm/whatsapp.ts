import type { CrmAdapter, CrmExportResult, VisitNoteExportPayload } from './types'

export const whatsappAdapter: CrmAdapter = {
  target: 'whatsapp',
  label: 'WhatsApp',
  exportVisitNote(_payload: VisitNoteExportPayload): Promise<CrmExportResult> {
    return Promise.resolve({
      ok: false,
      error: 'No implementado en Fase 1',
    })
  },
}
