import type { CrmAdapter, CrmExportResult, VisitNoteExportPayload } from './types'

export const inmovillaAdapter: CrmAdapter = {
  target: 'inmovilla',
  label: 'Inmovilla',
  exportVisitNote(_payload: VisitNoteExportPayload): Promise<CrmExportResult> {
    return Promise.resolve({
      ok: false,
      error: 'No implementado en Fase 1',
    })
  },
}
