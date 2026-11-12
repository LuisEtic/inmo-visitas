import { invokeCrmExport } from './crm-function'
import type { CrmAdapter, CrmExportResult, VisitNoteExportInput } from './types'

/**
 * Adaptador de Witei (Fase 7): llama a la Edge Function `crm-export`,
 * que envía la ficha en el formato propio «inmo-visitas v1» (NO la
 * API real de Witei, sin confirmar) en modo simulado mientras no haya
 * `CRM_WEBHOOK_URL`.
 */
export const witeiAdapter: CrmAdapter = {
  target: 'witei',
  label: 'Witei',
  exportVisitNote(input: VisitNoteExportInput): Promise<CrmExportResult> {
    return invokeCrmExport('witei', input.visitNoteId)
  },
}
