import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { formatPhone } from '../lib/contact'
import type { ClientRow } from '../lib/database.types'
import { useAuth } from '../lib/auth-context'
import { matchesClientQuery } from '../lib/search'
import { listClients } from '../features/clients/api'

/**
 * /clientes (privada): lista de clientes del agente con buscador
 * (nombre, teléfono y email, sin distinguir mayúsculas ni tildes),
 * contador y alta. Las tarjetas enlazan a la ficha del cliente.
 */
export default function Clients() {
  const { supabaseConfigured } = useAuth()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [query, setQuery] = useState('')
  // Sin Supabase no hay nada que cargar: el estado inicial ya es el final
  // (evita el setState en efecto que señala oxlint).
  const [loading, setLoading] = useState(supabaseConfigured)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }
    let mounted = true
    listClients()
      .then((rows) => {
        if (!mounted) return
        setClients(rows)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setLoadError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [supabaseConfigured])

  const filtered = useMemo(
    () => clients.filter((client) => matchesClientQuery(client, query)),
    [clients, query],
  )

  const countLabel =
    filtered.length === 1 ? '1 cliente' : `${filtered.length} clientes`

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-8 text-text-primary">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-text-secondary">inmo-visitas · Fase 3</p>
            <h1 className="mt-2 text-2xl">Clientes</h1>
            <p className="mt-1 text-sm text-text-secondary">{countLabel}</p>
          </div>
          <Link to="/clientes/nuevo">
            <Button size="lg">Nuevo cliente</Button>
          </Link>
        </div>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        <div className="mt-6">
          <Input
            className="min-h-11"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, teléfono o email"
            aria-label="Buscar clientes"
          />
        </div>

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && loadError === null && filtered.length === 0 && (
          <div className="mt-6 rounded-md border border-border bg-surface px-4 py-8 text-center">
            <p className="text-base">
              {query.trim() === ''
                ? 'Todavía no tienes clientes'
                : 'Ningún cliente coincide con la búsqueda'}
            </p>
            {query.trim() === '' && (
              <Link to="/clientes/nuevo" className="mt-4 inline-block">
                <Button size="lg">Nuevo cliente</Button>
              </Link>
            )}
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {filtered.map((client) => (
            <li key={client.id}>
              <Link
                to={`/clientes/${client.id}`}
                className="block min-h-11 rounded-md border border-border bg-bg px-4 py-3 hover:bg-surface"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold break-words">{client.full_name}</span>
                  {client.is_temporary && <Badge variant="neutral">Provisional</Badge>}
                </span>
                {client.phone !== null && client.phone !== '' && (
                  <span className="mt-1 block text-sm text-text-secondary">
                    {formatPhone(client.phone)}
                  </span>
                )}
                {client.email !== null && client.email !== '' && (
                  <span className="mt-1 block break-words text-sm text-text-secondary">
                    {client.email}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
