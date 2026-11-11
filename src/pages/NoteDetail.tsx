import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { getClient } from '../features/clients/api'
import { getProperty } from '../features/properties/api'
import { validateNoteText } from '../features/capture/audio'
import {
  getNote,
  getSignedAudioUrl,
  transcribeNote,
  updateNoteText,
} from '../features/notes/api'
import { formatPhone } from '../lib/contact'
import type {
  ClientRow,
  PropertyRow,
  VisitNoteRow,
} from '../lib/database.types'
import { useAuth } from '../lib/auth-context'

const noteDateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * /notas/:id (privada): ficha mínima de la nota de visita (Fase 4).
 * - Cabecera: cliente (con enlace y badge «Provisional»), inmueble
 *   (referencia + dirección, con enlace), fecha y estado.
 * - Audio: reproductor con URL firmada de 5 minutos. Si la nota es
 *   `draft` con audio, lanza la transcripción al abrir una sola vez.
 * - Texto: la transcripción (o `raw_text`) en modo lectura, con botón
 *   «Corregir» (máx. 5.000 caracteres, estado `draft` o `transcribed`).
 * - Id inexistente o de otro agente → «No encontrado» (RLS).
 */
export default function NoteDetail() {
  // La `key` fuerza un montaje nuevo al pasar de una ficha a otra, para
  // no arrastrar el estado anterior (lección de la Fase 3).
  const { id } = useParams<{ id: string }>()
  return <NoteDetailView key={id ?? 'sin-id'} id={id} />
}

function NoteDetailView({ id }: { id: string | undefined }) {
  const { supabaseConfigured } = useAuth()

  const [note, setNote] = useState<VisitNoteRow | null>(null)
  const [client, setClient] = useState<ClientRow | null>(null)
  const [property, setProperty] = useState<PropertyRow | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const transcribeStartedRef = useRef(false)

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured || id === undefined) {
      return
    }
    let mounted = true
    getNote(id)
      .then(async (row) => {
        if (!mounted) return
        if (row === null) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setNote(row)
        const [clientRow, propertyRow] = await Promise.all([
          getClient(row.client_id),
          getProperty(row.property_id),
        ])
        if (!mounted) return
        setClient(clientRow)
        setProperty(propertyRow)
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
  }, [id, supabaseConfigured])

  // URL firmada para el audio (solo si la nota tiene audio).
  useEffect(() => {
    if (note === null || note.audio_url === null) {
      return
    }
    let mounted = true
    getSignedAudioUrl(note.audio_url)
      .then((url) => {
        if (mounted) {
          setAudioUrl(url)
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setAudioError(
          error instanceof Error ? error.message : 'No se ha podido cargar el audio.',
        )
      })
    return () => {
      mounted = false
    }
  }, [note])

  // Transcripción automática una sola vez, al abrir una nota `draft`
  // con audio (no en cada render).
  useEffect(() => {
    if (
      note === null ||
      note.status !== 'draft' ||
      note.audio_url === null ||
      transcribeStartedRef.current
    ) {
      return
    }
    transcribeStartedRef.current = true
    let mounted = true
    setTranscribing(true)
    setTranscribeError(null)
    transcribeNote(note.id)
      .then((transcript) => {
        if (!mounted) return
        setNote((previous) =>
          previous === null
            ? previous
            : { ...previous, transcript, status: 'transcribed' },
        )
        setTranscribing(false)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setTranscribeError(
          error instanceof Error
            ? error.message
            : 'No se ha podido transcribir. Inténtalo de nuevo.',
        )
        setTranscribing(false)
      })
    return () => {
      mounted = false
    }
  }, [note])

  async function handleRetryTranscription() {
    if (note === null) {
      return
    }
    setTranscribing(true)
    setTranscribeError(null)
    try {
      const transcript = await transcribeNote(note.id)
      setNote((previous) =>
        previous === null
          ? previous
          : { ...previous, transcript, status: 'transcribed' },
      )
    } catch (error: unknown) {
      setTranscribeError(
        error instanceof Error
          ? error.message
          : 'No se ha podido transcribir. Inténtalo de nuevo.',
      )
    } finally {
      setTranscribing(false)
    }
  }

  function handleStartEdit() {
    if (note === null) {
      return
    }
    setEditText(note.transcript ?? note.raw_text ?? '')
    setEditError(null)
    setEditing(true)
  }

  async function handleSaveEdit() {
    if (note === null) {
      return
    }
    const validation = validateNoteText(editText)
    if (!validation.ok) {
      setEditError(validation.error)
      return
    }
    const field = note.input_type === 'audio' ? 'transcript' : 'raw_text'
    setEditError(null)
    setSavingEdit(true)
    try {
      await updateNoteText(note.id, field, validation.value)
      setNote((previous) =>
        previous === null ? previous : { ...previous, [field]: validation.value },
      )
      setEditing(false)
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
    } finally {
      setSavingEdit(false)
    }
  }

  const displayText = note?.transcript ?? note?.raw_text ?? ''
  const canEdit =
    note !== null && (note.status === 'draft' || note.status === 'transcribed')
  const statusLabel =
    note === null
      ? ''
      : note.status === 'draft'
        ? 'Pendiente de transcribir'
        : note.status === 'transcribed'
          ? 'Transcrita'
          : note.status

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-8 text-text-primary">
        <p className="font-mono text-xs text-text-secondary">inmo-visitas · Fase 4</p>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && loadError === null && notFound && (
          <div className="mt-6">
            <h1 className="text-2xl">No encontrado</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Esta nota no existe o no tienes permiso para verla.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link to="/capturar">Nueva captura</Link>
            </Button>
          </div>
        )}

        {!loading && loadError === null && !notFound && note !== null && (
          <>
            <h1 className="mt-2 text-2xl">Nota de visita</h1>
            <div className="mt-3 space-y-1 text-sm">
              {client !== null && (
                <p>
                  Cliente:{' '}
                  <Link
                    to={`/clientes/${client.id}`}
                    className="font-semibold underline"
                  >
                    {client.full_name}
                  </Link>{' '}
                  {client.is_temporary && <Badge variant="neutral">Provisional</Badge>}
                  {client.phone !== null && client.phone !== '' && (
                    <span className="text-text-secondary">
                      {' '}
                      · {formatPhone(client.phone)}
                    </span>
                  )}
                </p>
              )}
              {property !== null && (
                <p>
                  Inmueble:{' '}
                  <Link
                    to={`/inmuebles/${property.id}`}
                    className="font-semibold underline"
                  >
                    <span className="font-mono">{property.reference}</span> ·{' '}
                    {property.address}
                  </Link>
                </p>
              )}
              <p className="text-text-secondary">
                {noteDateFormatter.format(new Date(note.created_at))}
              </p>
              <p>
                Estado: <span className="font-semibold">{statusLabel}</span>
              </p>
            </div>

            {note.audio_url !== null && (
              <section className="mt-8" aria-labelledby="nota-audio">
                <h2 id="nota-audio" className="text-lg font-semibold">
                  Audio
                </h2>
                {audioUrl !== null && (
                  <audio controls src={audioUrl} className="mt-3 w-full" />
                )}
                {audioError !== null && (
                  <p className="mt-3 text-sm text-error">{audioError}</p>
                )}
                {transcribing && (
                  <p className="mt-3 text-sm text-text-secondary">Transcribiendo…</p>
                )}
                {transcribeError !== null && (
                  <div className="mt-3">
                    <p className="text-sm text-error">{transcribeError}</p>
                    <Button
                      variant="secondary"
                      size="lg"
                      className="mt-3"
                      onClick={() => void handleRetryTranscription()}
                      disabled={transcribing}
                    >
                      Reintentar transcripción
                    </Button>
                  </div>
                )}
              </section>
            )}

            <section className="mt-8" aria-labelledby="nota-texto">
              <h2 id="nota-texto" className="text-lg font-semibold">
                {note.input_type === 'audio' ? 'Transcripción' : 'Nota'}
              </h2>
              {!editing && (
                <>
                  <p className="mt-3 whitespace-pre-wrap break-words text-base">
                    {displayText}
                  </p>
                  {canEdit && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="mt-4"
                      onClick={handleStartEdit}
                    >
                      Corregir
                    </Button>
                  )}
                </>
              )}
              {editing && (
                <div className="mt-3">
                  <Label htmlFor="nota-correccion">Corrige el texto</Label>
                  <textarea
                    id="nota-correccion"
                    value={editText}
                    onChange={(event) => {
                      setEditText(event.target.value)
                      setEditError(null)
                    }}
                    rows={6}
                    maxLength={5000}
                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
                  />
                  <p className="mt-1 text-right font-mono text-xs text-text-secondary">
                    {editText.length} / 5.000
                  </p>
                  {editError !== null && (
                    <p className="mt-1 text-sm text-error">{editError}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      onClick={() => void handleSaveEdit()}
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'Guardando…' : 'Guardar corrección'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setEditing(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <div className="mt-8 border-t border-border pt-6">
              <Button asChild size="lg">
                <Link to="/capturar">Nueva captura</Link>
              </Button>
            </div>
          </>
        )}
      </main>
    </>
  )
}
