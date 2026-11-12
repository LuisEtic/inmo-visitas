import type { CrmTarget } from '../../config/client'
import { inmovillaAdapter } from './inmovilla'
import { manualAdapter } from './manual'
import type { CrmAdapter } from './types'
import { whatsappAdapter } from './whatsapp'
import { witeiAdapter } from './witei'

const adapters: Record<CrmTarget, CrmAdapter> = {
  inmovilla: inmovillaAdapter,
  witei: witeiAdapter,
  whatsapp: whatsappAdapter,
  manual: manualAdapter,
}

export function getCrmAdapter(target: CrmTarget): CrmAdapter {
  return adapters[target]
}

export { crmTargetSchema } from './types'
export type { CrmAdapter, CrmExportResult, VisitNoteExportInput } from './types'
