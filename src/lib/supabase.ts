import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clientConfig } from '../config/client'
import type { Database } from './database.types'

/**
 * Cliente Supabase, tipado con los tipos escritos a mano de
 * `database.types.ts` (tablas clients, properties y agents).
 *
 * Si no hay variables de entorno configuradas, el cliente es `null`
 * en lugar de crearse con claves falsas.
 */
export const supabase: SupabaseClient<Database> | null =
  clientConfig.supabaseUrl !== '' && clientConfig.supabaseAnonKey !== ''
    ? createClient<Database>(clientConfig.supabaseUrl, clientConfig.supabaseAnonKey)
    : null
