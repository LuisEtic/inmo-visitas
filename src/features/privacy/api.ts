import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import type { AuditEventRow } from '../../lib/database.types'
import { getClient } from '../clients/api'
import { listFacts } from '../extraction/api'
import { listNoteExports } from '../export/deliveries'
import { listDrafts } from '../followup/api'
import { getProperty } from '../properties/api'
import { listNoteTasks } from '../tasks/api'
import { flushAudioCleanup } from './audio-cleanup'
import { buildClientDataExport } from './export'

/**
 * Capa de datos de privacidad (Fase 8, migración 0012). Todas las
 * consultas pasan por RLS: cada agente solo ve y borra lo suyo.
 *
 * - Borrar un cliente va por la RPC `erase_client` (borra sus notas
 *   con todo lo que cuelga de ellas y registra `cliente_borrado`).
 * - Borrar los datos del propietario va por la RPC
 *   `erase_property_owner` (anonimiza nombre y teléfono).
 * - Borrar una nota es un `delete` directo: el trigger de borrado
 *   encola su audio y registra `nota_borrada`.
 * - La entrega de datos descarga un JSON y registra
 *   `datos_entregados`.
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

/** Acciones de privacidad del agente, las más recientes primero. */
export async function listAuditEvents(): Promise<AuditEventRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('audit_events')
    .select('id, agent_id, action, entity_id, created_at')
    .order('created_at', { ascending: false })
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data ?? []
}

/** Cuántas notas tiene un cliente (para la confirmación de borrado). */
export async function countClientNotes(clientId: string): Promise<number> {
  const client = requireSupabase()
  const { count, error } = await client
    .from('visit_notes')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return count ?? 0
}

/**
 * Borra un cliente y todas sus notas (con sus datos, tareas,
 * borradores y exportaciones) y vacía la cola de audios. Un cliente
 * de otro agente → `no_encontrado` (la RPC no lo ve por RLS).
 */
export async function eraseClient(clientId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('erase_client', {
    p_client_id: clientId,
  })
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  await flushAudioCleanup()
}

/** Borra los datos del propietario de un inmueble (lo anonimiza). */
export async function erasePropertyOwner(propertyId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('erase_property_owner', {
    p_property_id: propertyId,
  })
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
}

/**
 * Descarga los datos de un cliente en un archivo JSON
 * (`datos-cliente-<YYYY-MM-DD>.json`, sin el nombre en el nombre del
 * archivo) y registra `datos_entregados`. Sin audio: se entrega
 * aparte si lo piden y aún existe.
 */
export async function downloadClientData(clientId: string): Promise<string> {
  const client = requireSupabase()
  const clientRow = await getClient(clientId)
  if (clientRow === null) {
    throw new Error('No se ha encontrado el cliente.')
  }
  const { data: noteRows, error: notesError } = await client
    .from('visit_notes')
    .select(
      'id, input_type, raw_text, transcript, status, created_at, property_id',
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (notesError !== null || noteRows === null) {
    throw new Error(
      notesError !== null
        ? translateDbError(notesError)
        : 'No se han podido cargar los datos.',
    )
  }
  const notes = await Promise.all(
    noteRows.map(async (note) => {
      const [propertyRow, facts, tasks, drafts, exports] = await Promise.all([
        getProperty(note.property_id),
        listFacts(note.id),
        listNoteTasks(note.id),
        listDrafts(note.id),
        listNoteExports(note.id),
      ])
      if (propertyRow === null) {
        throw new Error('No se han podido cargar los datos.')
      }
      return {
        note: {
          input_type: note.input_type,
          audio_url: null,
          raw_text: note.raw_text,
          transcript: note.transcript,
          status: note.status,
          created_at: note.created_at,
        },
        propertyReference: propertyRow.reference,
        facts,
        tasks,
        drafts,
        exports,
      }
    }),
  )
  const exportData = buildClientDataExport({
    client: {
      full_name: clientRow.full_name,
      phone: clientRow.phone,
      email: clientRow.email,
      is_temporary: clientRow.is_temporary,
      created_at: clientRow.created_at,
    },
    notes,
  })
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
  }).format(new Date())
  const fileName = `datos-cliente-${today}.json`
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revisión de la Fase 8: la URL se libera un poco después. Liberarla
  // en el mismo instante del clic puede cancelar la descarga en Safari
  // de iPhone.
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  // La descarga ya se lanzó; si el registro falla, se avisa (el
  // archivo está descargado, pero la acción no quedó registrada).
  const { error: auditError } = await client.from('audit_events').insert({
    action: 'datos_entregados',
    entity_id: clientId,
  })
  if (auditError !== null) {
    throw new Error(
      'Los datos se descargaron, pero la entrega no quedó registrada. Inténtalo de nuevo.',
    )
  }
  return fileName
}
