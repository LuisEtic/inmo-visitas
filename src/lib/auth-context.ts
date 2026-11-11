import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  /** Sesión activa de Supabase Auth, o null si no hay sesión. */
  session: Session | null
  /** Usuario autenticado, o null si no hay sesión. */
  user: User | null
  /** true mientras se comprueba la sesión inicial (sin parpadeo de /login). */
  loading: boolean
  /** false si faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env). */
  supabaseConfigured: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
