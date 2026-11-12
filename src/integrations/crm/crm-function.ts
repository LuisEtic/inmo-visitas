import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { CrmExportResult } from './types'

/**
 * Llamada común a la Edge Function `crm-export` para Inmovilla y Witei
 * (Fase 7). La función construye su propio JSON (no confía en el que
 * mande el navegador) y responde `{ export, simulated,
 * already_exported }`. Los 400/409/502 traen un mensaje en español
 * propio de la función que se muestra tal cual; el resto (401, 404,
 * red) se queda en el mensaje genérico.
 */

const CRM_EXPORT_ERROR =
  'No se ha podido exportar la ficha. Inténtalo de nuevo.'

export type CrmFunctionResponse = {
  export: {
    id: string
    status: string
    external_id: string | null
    exported_at: string | null
  }
  simulated: boolean
  already_exported: boolean
}

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

export async function invokeCrmExport(
  target: 'inmovilla' | 'witei',
  visitNoteId: string,
): Promise<CrmExportResult> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('crm-export', {
    body: { visit_note_id: visitNoteId, target },
  })
  if (error !== null) {
    return {
      ok: false,
      status: 'error',
      error: await crmExportErrorMessage(error),
    }
  }
  const result = data as CrmFunctionResponse | null
  if (
    result === null ||
    typeof result.export !== 'object' ||
    result.export === null ||
    typeof result.export.id !== 'string'
  ) {
    return { ok: false, status: 'error', error: CRM_EXPORT_ERROR }
  }
  return {
    ok: true,
    status: 'enviado',
    exportId: result.export.id,
    externalId: result.export.external_id ?? undefined,
    simulated: result.simulated,
  }
}

async function crmExportErrorMessage(error: unknown): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) {
    return CRM_EXPORT_ERROR
  }
  const response: unknown = error.context
  if (!(response instanceof Response)) {
    return CRM_EXPORT_ERROR
  }
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error !== ''
    ) {
      return body.error
    }
  } catch {
    // Cuerpo no JSON: mensaje genérico.
  }
  return CRM_EXPORT_ERROR
}
