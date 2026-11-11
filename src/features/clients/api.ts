import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import type { ClientInsert, ClientRow, ClientUpdate } from '../../lib/database.types'
import type { ClientFormValues } from './schema'

/**
 * Capa de datos de clientes (Fase 3). Todas las consultas pasan por RLS:
 * cada agente solo ve y modifica sus propios clientes.
 * El `agent_id` NO se envía desde el frontend: lo pone la base con
 * `default auth.uid()` y RLS lo comprueba.
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

function toInsert(values: ClientFormValues): ClientInsert {
  return {
    full_name: values.full_name,
    phone: values.phone,
    email: values.email,
    is_temporary: values.is_temporary,
  }
}

function toUpdate(values: ClientFormValues): ClientUpdate {
  return toInsert(values)
}

export async function listClients(): Promise<ClientRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true })
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data ?? []
}

export async function getClient(id: string): Promise<ClientRow | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('clients').select('*').eq('id', id).maybeSingle()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data
}

export async function createClient(values: ClientFormValues): Promise<ClientRow> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('clients')
    .insert(toInsert(values))
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data
}

export async function updateClient(id: string, values: ClientFormValues): Promise<ClientRow> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('clients')
    .update(toUpdate(values))
    .eq('id', id)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data
}

export async function removeClient(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('clients').delete().eq('id', id)
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
}
