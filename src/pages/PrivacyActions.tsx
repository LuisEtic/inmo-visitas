import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { listAuditEvents } from '../features/privacy/api'
import { useAuth } from '../lib/auth-context'
import { APP_PHASE_LABEL } from '../lib/app-label'
import type { AuditEventAction, AuditEventRow } from '../lib/database.types'

const ACTION_LABELS: Record<AuditEventAction, string> = {
  nota_borrada: 'Nota borrada',
  cliente_borrado: 'Cliente borrado con sus notas',
  propietario_borrado: 'Datos del propietario borrados',
  datos_entregados: 'Datos del cliente entregados',
}

const actionFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * /perfil/acciones (privada, Fase 8): las acciones de privacidad del
 * agente (borrados y entregas de datos), las más recientes primero.
 * No se muestran nombres: solo la acción y la fecha.
 */
export default function PrivacyActions() {
  const { supabaseConfigured } = useAuth()
  const [events, setEvents] = useState<AuditEventRow[] | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listAuditEvents()
      .then((rows) => {
        if (!mounted) return
        setEvents(rows)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setLoadError(
          error instanceof Error
            ? error.message
            : 'No se han podido cargar tus acciones.',
        )
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-md bg-bg px-4 py-8 text-text-primary">
        <p className="font-mono text-xs text-text-secondary">
          {APP_PHASE_LABEL}
        </p>
        <h1 className="mt-2 text-2xl">Mis acciones de privacidad</h1>
        <p className="mt-2 text-base text-text-secondary">
          Borrados y entregas de datos que has hecho. Solo tú ves esta
          lista.
        </p>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        {loading && (
          <p className="mt-6 text-sm text-text-secondary">Cargando…</p>
        )}
        {loadError !== null && (
          <p className="mt-6 text-sm text-error">{loadError}</p>
        )}

        {!loading && loadError === null && events !== null && (
          <>
            {events.length === 0 ? (
              <p className="mt-6 text-base text-text-secondary">
                Todavía no hay acciones de privacidad.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-md border border-border px-4 py-3"
                  >
                    <p className="font-semibold">
                      {ACTION_LABELS[event.action]}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {actionFormatter.format(new Date(event.created_at))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8">
              <Link
                to="/perfil"
                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2"
              >
                Volver a mi perfil
              </Link>
            </div>
          </>
        )}
      </main>
    </>
  )
}
