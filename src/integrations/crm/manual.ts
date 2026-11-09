import type { CrmAdapter, CrmExportResult, VisitNoteExportPayload } from './types'

export const manualAdapter: CrmAdapter = {
  target: 'manual',
  label: 'Manual',
  exportVisitNote(_payload: VisitNoteExportPayload): Promise<CrmExportResult> {
    return Promise.resolve({
      ok: false,
      error: 'No implementado en Fase 1',
    })
  },
}
