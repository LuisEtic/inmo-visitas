import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clientConfig } from '../config/client'

/**
 * Cliente Supabase. En la Fase 1 no se usa: no hay autenticación, ni
 * consultas, ni RLS. Existe para que las fases posteriores solo tengan
 * que importar este módulo.
 *
 * Si no hay variables de entorno configuradas, el cliente es `null`
 * en lugar de crearse con claves falsas.
 */
export const supabase: SupabaseClient | null =
  clientConfig.supabaseUrl !== '' && clientConfig.supabaseAnonKey !== ''
    ? createClient(clientConfig.supabaseUrl, clientConfig.supabaseAnonKey)
    : null
