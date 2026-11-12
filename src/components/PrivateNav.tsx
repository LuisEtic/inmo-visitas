import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { Button } from './ui/button'
import { useAuth } from '../lib/auth-context'
import { countPendingTasks } from '../features/tasks/api'

/**
 * Barra de navegación de las rutas privadas (Fase 3, «Capturar» en
 * Fase 4, «Notas» y «Pendientes» en Fase 6): Inicio, Capturar,
 * Clientes, Inmuebles, Notas, Pendientes y Perfil, más el cierre de
 * sesión. Objetivos táctiles de 44 px como mínimo; en móvil los
 * enlaces pasan a dos filas si hace falta. «Pendientes» muestra el
 * número de tareas pendientes cuando hay alguna.
 */
export function PrivateNav() {
  const { signOut, supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }
    let mounted = true
    countPendingTasks()
      .then((count) => {
        if (mounted) {
          setPendingCount(count)
        }
      })
      .catch(() => {
        // Sin contador no se bloquea la navegación.
      })
    return () => {
      mounted = false
    }
  }, [supabaseConfigured])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
      isActive ? 'text-text-primary underline' : 'text-text-secondary'
    }`

  return (
    <header className="border-b border-border bg-bg">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-1 gap-y-0 px-4 py-2">
        <NavLink to="/" end className={linkClass}>
          Inicio
        </NavLink>
        <NavLink to="/capturar" className={linkClass}>
          Capturar
        </NavLink>
        <NavLink to="/clientes" className={linkClass}>
          Clientes
        </NavLink>
        <NavLink to="/inmuebles" className={linkClass}>
          Inmuebles
        </NavLink>
        <NavLink to="/notas" className={linkClass}>
          Notas
        </NavLink>
        <NavLink to="/pendientes" className={linkClass}>
          Pendientes{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </NavLink>
        <NavLink to="/perfil" className={linkClass}>
          Perfil
        </NavLink>
        <span className="grow" />
        <Button variant="secondary" size="sm" className="min-h-11" onClick={handleSignOut}>
          Cerrar sesión
        </Button>
      </nav>
    </header>
  )
}
