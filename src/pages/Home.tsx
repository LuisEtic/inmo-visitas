import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../components/ui/button'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { countPendingTasks } from '../features/tasks/api'
import { APP_PHASE_LABEL } from '../lib/app-label'

/**
 * / (privada, inicio): saludo al agente y enlaces a las secciones de
 * trabajo: Capturar, Clientes, Inmuebles, Notas, Pendientes, Perfil y
 * sistema de diseño. La captura de notas llega en la Fase 4; los
 * borradores duales y la bandeja de pendientes, en la Fase 6; la
 * exportación al CRM y WhatsApp, en la Fase 7.
 */
export default function Home() {
  const { user, supabaseConfigured, signOut } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (supabase === null || user === null) return
    let mounted = true
    supabase
      .from('agents')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!mounted) return
        if (data !== null) {
          setDisplayName((data as { full_name: string }).full_name)
        }
      })
    countPendingTasks()
      .then((count) => {
        if (mounted) {
          setPendingCount(count)
        }
      })
      .catch(() => {
        // Sin contador no se bloquea la portada.
      })
    return () => {
      mounted = false
    }
  }, [user])

  const fallbackName =
    typeof user?.user_metadata?.['full_name'] === 'string'
      ? (user.user_metadata['full_name'] as string)
      : (user?.email?.split('@')[0] ?? 'agente')

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-12 text-text-primary">
        <p className="font-mono text-xs text-text-secondary">
          {APP_PHASE_LABEL}
        </p>
        <h1 className="mt-2 text-2xl">Hola, {displayName ?? fallbackName}</h1>
        <p className="mt-2 text-base text-text-secondary">
          Notas de visita por voz o texto para agentes inmobiliarios.
        </p>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            to="/capturar"
            className="inline-block min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Capturar visita
          </Link>
          <Link
            to="/clientes"
            className="inline-block min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Clientes
          </Link>
          <Link
            to="/inmuebles"
            className="inline-block min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Inmuebles
          </Link>
          <Link
            to="/notas"
            className="inline-block min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Notas
          </Link>
          <Link
            to="/pendientes"
            className="inline-block min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Pendientes{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Link>
          <Link
            to="/perfil"
            className="inline-block min-h-11 rounded-md border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary"
          >
            Mi perfil
          </Link>
          <Link
            to="/design-system"
            className="inline-block min-h-11 rounded-md border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary"
          >
            Ver sistema de diseño
          </Link>
          <Button
            variant="secondary"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </div>

        <p className="mt-6 text-sm text-text-secondary">
          Fase 9 — Pulido: móvil y resiliencia.
        </p>
      </main>
    </>
  )
}
