import type { CrmAdapter, CrmExportResult, VisitNoteExportPayload } from './types'

export const witeiAdapter: CrmAdapter = {
  target: 'witei',
  label: 'Witei',
  exportVisitNote(_payload: VisitNoteExportPayload): Promise<CrmExportResult> {
    return Promise.resolve({
      ok: false,
      error: 'No implementado en Fase 1',
    })
  },
}
