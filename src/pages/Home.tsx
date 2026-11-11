import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../components/ui/button'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

/**
 * / (privada, inicio provisional de la Fase 2): saludo al agente y enlaces
 * a /perfil y a /design-system. Las pantallas de trabajo (captura, revisión,
 * pendientes) llegan en fases posteriores.
 */
export default function Home() {
  const { user, supabaseConfigured, signOut } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState<string | null>(null)
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
    <main className="mx-auto max-w-4xl bg-bg px-4 py-12 text-text-primary">
      <p className="font-mono text-xs text-text-secondary">
        inmo-visitas · Fase 2
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
          to="/perfil"
          className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Mi perfil
        </Link>
        <Link
          to="/design-system"
          className="inline-block rounded-md border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary"
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
        Fase 2 — Acceso de agentes + RLS por agente. La captura de notas
        llega en la Fase 4.
      </p>
    </main>
  )
}
