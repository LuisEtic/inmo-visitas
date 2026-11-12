import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { NOTE_STATUS_LABELS } from '../features/extraction/labels'
import {
  listNotes,
  type NoteWithClientAndProperty,
} from '../features/notes/api'
import { listDraftedNoteIds } from '../features/tasks/api'
import { useAuth } from '../lib/auth-context'
import { APP_PHASE_LABEL } from '../lib/app-label'
import type { VisitNoteStatus } from '../lib/database.types'

const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })

const STATUS_OPTIONS: Array<VisitNoteStatus | 'todas'> = [
  'todas',
  'draft',
  'transcribed',
  'extracted',
  'reviewed',
  'approved',
]

function statusLabel(status: VisitNoteStatus | 'todas'): string {
  return status === 'todas' ? 'Todas' : NOTE_STATUS_LABELS[status]
}

/**
 * /notas (privada, Fase 6): todas las notas del agente, las más
 * recientes primero, con fecha, cliente, referencia, tipo (texto o
 * voz), estado y, si está aprobada, si el seguimiento está preparado.
 * Filtro por estado, búsqueda por cliente o referencia (sin tildes) y
 * paginación de 25 en 25 («Cargar más»).
 */
export default function Notes() {
  const { supabaseConfigured } = useAuth()
  const [notes, setNotes] = useState<NoteWithClientAndProperty[]>([])
  const [draftedIds, setDraftedIds] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<VisitNoteStatus | 'todas'>('todas')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const offsetRef = useRef(0)

  // La búsqueda espera 300 ms desde la última tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      setLoadError(null)
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }
    let mounted = true
    offsetRef.current = 0
    Promise.all([
      listNotes({ status, query: debouncedQuery, offset: 0 }),
      listDraftedNoteIds(),
    ])
      .then(([result, drafted]) => {
        if (!mounted) return
        setNotes(result.notes)
        setHasMore(result.hasMore)
        setTotal(result.total)
        setDraftedIds(drafted)
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
  }, [supabaseConfigured, status, debouncedQuery])

  async function handleLoadMore() {
    const nextOffset = offsetRef.current + 25
    setLoadingMore(true)
    setLoadError(null)
    try {
      const result = await listNotes({
        status,
        query: debouncedQuery,
        offset: nextOffset,
      })
      offsetRef.current = nextOffset
      setNotes((previous) => [...previous, ...result.notes])
      setHasMore(result.hasMore)
      setTotal(result.total)
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
    } finally {
      setLoadingMore(false)
    }
  }

  const countLabel = total === 1 ? '1 nota' : `${total} notas`

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-8 text-text-primary">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-text-secondary">{APP_PHASE_LABEL}</p>
            <h1 className="mt-2 text-2xl">Notas</h1>
            <p className="mt-1 text-sm text-text-secondary">{countLabel}</p>
          </div>
          <Button asChild size="lg">
            <Link to="/capturar">Nueva nota</Link>
          </Button>
        </div>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="notas-buscar">Buscar</Label>
            <Input
              id="notas-buscar"
              className="min-h-11"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por cliente o referencia"
              aria-label="Buscar notas por cliente o referencia"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notas-estado">Estado</Label>
            <select
              id="notas-estado"
              value={status}
              onChange={(event) => {
                setLoading(true)
                setLoadError(null)
                setStatus(event.target.value as VisitNoteStatus | 'todas')
              }}
              className="flex min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {statusLabel(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && loadError === null && notes.length === 0 && (
          <div className="mt-6 rounded-md border border-border bg-surface px-4 py-8 text-center">
            <p className="text-base">
              {debouncedQuery.trim() === '' && status === 'todas'
                ? 'Todavía no tienes notas'
                : 'Ninguna nota coincide con la búsqueda'}
            </p>
            <Button asChild size="lg" className="mt-4">
              <Link to="/capturar">Nueva nota</Link>
            </Button>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Link
                to={`/notas/${note.id}`}
                className="block min-h-11 rounded-md border border-border bg-bg px-4 py-3 hover:bg-surface"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold break-words">
                    {note.clients?.full_name ?? 'Sin cliente'}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {dateFormatter.format(new Date(note.created_at))}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-text-secondary">
                  {note.properties?.reference ?? ''} ·{' '}
                  {note.input_type === 'audio' ? 'Voz' : 'Texto'} ·{' '}
                  {NOTE_STATUS_LABELS[note.status]}
                </span>
                {note.status === 'approved' && (
                  <span className="mt-1 block text-sm text-text-secondary">
                    Seguimiento:{' '}
                    {draftedIds.has(note.id) ? 'preparado' : 'sin preparar'}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {hasMore && (
          <div className="mt-6">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void handleLoadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? 'Cargando…' : 'Cargar más'}
            </Button>
          </div>
        )}
      </main>
    </>
  )
}
