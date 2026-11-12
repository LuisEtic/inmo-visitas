import { invokeCrmExport } from './crm-function'
import type { CrmAdapter, CrmExportResult, VisitNoteExportInput } from './types'

/**
 * Adaptador de Inmovilla (Fase 7): llama a la Edge Function
 * `crm-export`, que envía la ficha en el formato propio
 * «inmo-visitas v1» (NO la API real de Inmovilla, sin confirmar) en
 * modo simulado mientras no haya `CRM_WEBHOOK_URL`.
 */
export const inmovillaAdapter: CrmAdapter = {
  target: 'inmovilla',
  label: 'Inmovilla',
  exportVisitNote(input: VisitNoteExportInput): Promise<CrmExportResult> {
    return invokeCrmExport('inmovilla', input.visitNoteId)
  },
}
