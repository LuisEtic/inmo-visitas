import { NavLink, useNavigate } from 'react-router'
import { Button } from './ui/button'
import { useAuth } from '../lib/auth-context'

/**
 * Barra de navegación de las rutas privadas (Fase 3, «Capturar» en
 * Fase 4): Inicio, Capturar, Clientes, Inmuebles y Perfil, más el
 * cierre de sesión. Objetivos táctiles de 44 px como mínimo; en móvil
 * los enlaces pasan a dos filas si hace falta.
 */
export function PrivateNav() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-border bg-bg">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-1 gap-y-0 px-4 py-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              isActive ? 'text-text-primary underline' : 'text-text-secondary'
            }`
          }
        >
          Inicio
        </NavLink>
        <NavLink
          to="/capturar"
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              isActive ? 'text-text-primary underline' : 'text-text-secondary'
            }`
          }
        >
          Capturar
        </NavLink>
        <NavLink
          to="/clientes"
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              isActive ? 'text-text-primary underline' : 'text-text-secondary'
            }`
          }
        >
          Clientes
        </NavLink>
        <NavLink
          to="/inmuebles"
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              isActive ? 'text-text-primary underline' : 'text-text-secondary'
            }`
          }
        >
          Inmuebles
        </NavLink>
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              isActive ? 'text-text-primary underline' : 'text-text-secondary'
            }`
          }
        >
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
