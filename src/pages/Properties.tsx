import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { formatPriceEs } from '../lib/contact'
import type { PropertyRow, PropertyStatus } from '../lib/database.types'
import { useAuth } from '../lib/auth-context'
import { matchesPropertyQuery } from '../lib/search'
import { listProperties } from '../features/properties/api'
import { PROPERTY_STATUS_LABELS } from '../features/properties/schema'

type StatusFilter = 'todos' | PropertyStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'vendido', label: 'Vendido' },
]

/**
 * /inmuebles (privada): lista de inmuebles del agente con buscador
 * (referencia, dirección, ciudad, propietario) y filtro por estado,
 * contador y alta. Las tarjetas enlazan a la ficha del inmueble.
 */
export default function Properties() {
  const { supabaseConfigured } = useAuth()
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  // Sin Supabase no hay nada que cargar: el estado inicial ya es el final
  // (evita el setState en efecto que señala oxlint).
  const [loading, setLoading] = useState(supabaseConfigured)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }
    let mounted = true
    listProperties()
      .then((rows) => {
        if (!mounted) return
        setProperties(rows)
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
    () =>
      properties.filter(
        (property) =>
          (statusFilter === 'todos' || property.status === statusFilter) &&
          matchesPropertyQuery(property, query),
      ),
    [properties, query, statusFilter],
  )

  const countLabel =
    filtered.length === 1 ? '1 inmueble' : `${filtered.length} inmuebles`

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-8 text-text-primary">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-text-secondary">inmo-visitas · Fase 3</p>
            <h1 className="mt-2 text-2xl">Inmuebles</h1>
            <p className="mt-1 text-sm text-text-secondary">{countLabel}</p>
          </div>
          <Button asChild size="lg">
            <Link to="/inmuebles/nuevo">Nuevo inmueble</Link>
          </Button>
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
            placeholder="Buscar por referencia, dirección, ciudad o propietario"
            aria-label="Buscar inmuebles"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'primary' : 'secondary'}
              size="sm"
              className="min-h-11"
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && loadError === null && filtered.length === 0 && (
          <div className="mt-6 rounded-md border border-border bg-surface px-4 py-8 text-center">
            <p className="text-base">
              {query.trim() === '' && statusFilter === 'todos'
                ? 'Todavía no tienes inmuebles'
                : 'Ningún inmueble coincide con la búsqueda'}
            </p>
            {query.trim() === '' && statusFilter === 'todos' && (
              <Button asChild size="lg" className="mt-4">
                <Link to="/inmuebles/nuevo">Nuevo inmueble</Link>
              </Button>
            )}
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {filtered.map((property) => (
            <li key={property.id}>
              <Link
                to={`/inmuebles/${property.id}`}
                className="block min-h-11 rounded-md border border-border bg-bg px-4 py-3 hover:bg-surface"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{property.reference}</span>
                  <Badge variant={property.status}>
                    {PROPERTY_STATUS_LABELS[property.status]}
                  </Badge>
                </span>
                <span className="mt-1 block break-words text-sm text-text-secondary">
                  {property.address}, {property.city}
                </span>
                <span className="mt-1 block text-base font-semibold">
                  {formatPriceEs(property.price)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
