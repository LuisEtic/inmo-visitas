import { supabase } from '../../lib/supabase'
import { translateDbError } from '../../lib/db-errors'
import type {
  PropertyInsert,
  PropertyRow,
  PropertyUpdate,
} from '../../lib/database.types'
import type { PropertyFormValues } from './schema'

/**
 * Capa de datos de inmuebles (Fase 3). Todas las consultas pasan por RLS:
 * cada agente solo ve y modifica sus propios inmuebles.
 * El `agent_id` NO se envía desde el frontend: lo pone la base con
 * `default auth.uid()` y RLS lo comprueba. La referencia es única por
 * agente (migración 0005, `properties_agent_reference_key`).
 */

function requireSupabase() {
  if (supabase === null) {
    throw new Error('Falta configurar Supabase (.env)')
  }
  return supabase
}

function toInsert(values: PropertyFormValues): PropertyInsert {
  return {
    reference: values.reference,
    address: values.address,
    city: values.city,
    price: values.price,
    owner_name: values.owner_name,
    owner_phone: values.owner_phone,
    status: values.status,
  }
}

function toUpdate(values: PropertyFormValues): PropertyUpdate {
  return toInsert(values)
}

export async function listProperties(): Promise<PropertyRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('properties')
    .select('*')
    .order('reference', { ascending: true })
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data ?? []
}

export async function getProperty(id: string): Promise<PropertyRow | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
  return data
}

export async function createProperty(values: PropertyFormValues): Promise<PropertyRow> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('properties')
    .insert(toInsert(values))
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error, { reference: values.reference }))
  }
  return data
}

export async function updateProperty(
  id: string,
  values: PropertyFormValues,
): Promise<PropertyRow> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('properties')
    .update(toUpdate(values))
    .eq('id', id)
    .select()
    .single()
  if (error !== null) {
    throw new Error(translateDbError(error, { reference: values.reference }))
  }
  return data
}

export async function removeProperty(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('properties').delete().eq('id', id)
  if (error !== null) {
    throw new Error(translateDbError(error))
  }
}
