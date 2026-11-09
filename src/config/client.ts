import { z } from 'zod'

/**
 * Todo lo que cambia por cliente vive aquí y se lee de variables VITE_*.
 * Ningún componente debe leer import.meta.env directamente ni hardcodear
 * datos de cliente.
 */
const clientEnvSchema = z.object({
  VITE_CLIENT_NAME: z.string().min(1).default('Inmo Visitas'),
  VITE_CLIENT_LOGO_URL: z.string().default(''),
  VITE_CLIENT_PRIMARY_COLOR: z.string().default('#111111'),
  VITE_CLIENT_CRM_TARGET: z
    .enum(['inmovilla', 'witei', 'whatsapp', 'manual'])
    .default('manual'),
  VITE_SUPABASE_URL: z.string().default(''),
  VITE_SUPABASE_ANON_KEY: z.string().default(''),
})

export type CrmTarget = z.infer<typeof clientEnvSchema>['VITE_CLIENT_CRM_TARGET']

export interface ClientConfig {
  name: string
  logoUrl: string
  primaryColor: string
  crmTarget: CrmTarget
  supabaseUrl: string
  supabaseAnonKey: string
}

function loadClientConfig(): ClientConfig {
  const parsed = clientEnvSchema.parse(import.meta.env)
  return {
    name: parsed.VITE_CLIENT_NAME,
    logoUrl: parsed.VITE_CLIENT_LOGO_URL,
    primaryColor: parsed.VITE_CLIENT_PRIMARY_COLOR,
    crmTarget: parsed.VITE_CLIENT_CRM_TARGET,
    supabaseUrl: parsed.VITE_SUPABASE_URL,
    supabaseAnonKey: parsed.VITE_SUPABASE_ANON_KEY,
  }
}

export const clientConfig: ClientConfig = loadClientConfig()
