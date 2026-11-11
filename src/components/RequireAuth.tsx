import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../lib/auth-context'

/**
 * Guarda de rutas privadas: mientras se comprueba la sesión inicial no
 * redirige (sin parpadeo de /login). Sin sesión, redirige a /login
 * guardando la ruta pedida para volver a ella tras entrar.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main className="mx-auto max-w-md bg-bg px-4 py-12 text-text-primary">
        <p className="text-sm text-text-secondary">Cargando…</p>
      </main>
    )
  }

  if (session === null) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
