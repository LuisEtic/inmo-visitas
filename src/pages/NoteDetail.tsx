import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { getClient } from '../features/clients/api'
import { getProperty } from '../features/properties/api'
import { validateNoteText } from '../features/capture/audio'
import {
  addFact,
  approveNote,
  extractNote,
  listFacts,
  reviewFact,
  type ReviewAction,
} from '../features/extraction/api'
import { findEvidenceRange, hasEvidence } from '../features/extraction/evidence'
import {
  CATEGORY_ORDER,
  CATEGORY_TITLES,
  NOTE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  confidenceText,
  fieldLabel,
  toFieldName,
} from '../features/extraction/labels'
import {
  getNote,
  getSignedAudioUrl,
  transcribeNote,
  updateNoteText,
} from '../features/notes/api'
import { formatPhone } from '../lib/contact'
import type {
  ClientRow,
  ExtractedFactRow,
  FactCategory,
  PropertyRow,
  VisitNoteRow,
} from '../lib/database.types'
import { useAuth } from '../lib/auth-context'

const noteDateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function countText(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * /notas/:id (privada): ficha de la nota de visita (Fases 4 y 5).
 * - Cabecera: cliente (con enlace y badge «Provisional»), inmueble
 *   (referencia + dirección, con enlace), fecha y estado.
 * - Audio: reproductor con URL firmada de 5 minutos. Si la nota es
 *   `draft` con audio, lanza la transcripción al abrir una sola vez.
 * - Texto: la transcripción (o `raw_text`) en modo lectura, con botón
 *   «Corregir» (máx. 5.000 caracteres, estado `draft` o `transcribed`).
 * - Extracción (Fase 5): «Extraer datos» en `transcribed`; cada dato
 *   junto a su cita resaltada en el texto; aceptar, editar, descartar,
 *   recuperar y añadir; «Volver a extraer» y «Aprobar nota». Tras
 *   aprobar, todo queda en solo lectura (también «Corregir»).
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

  const [facts, setFacts] = useState<ExtractedFactRow[] | null>(null)
  const [factsError, setFactsError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractNotice, setExtractNotice] = useState<string | null>(null)
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null)
  const [editingFactId, setEditingFactId] = useState<string | null>(null)
  const [editFactValue, setEditFactValue] = useState('')
  const [editFactError, setEditFactError] = useState<string | null>(null)
  const [savingFact, setSavingFact] = useState(false)
  const [factActionError, setFactActionError] = useState<string | null>(null)
  const [showAddFact, setShowAddFact] = useState(false)
  const [addCategory, setAddCategory] = useState<FactCategory>('hecho_declarado')
  const [addName, setAddName] = useState('')
  const [addValue, setAddValue] = useState('')
  const [addQuote, setAddQuote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addingFact, setAddingFact] = useState(false)
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [showReextractConfirm, setShowReextractConfirm] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const markRef = useRef<HTMLElement | null>(null)

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
        listFacts(row.id)
          .then((rows) => {
            if (mounted) {
              setFacts(rows)
            }
          })
          .catch((error: unknown) => {
            if (!mounted) return
            setFactsError(
              error instanceof Error
                ? error.message
                : 'No se han podido cargar los datos.',
            )
          })
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

  // Al elegir un dato, desplaza el texto hasta su cita resaltada.
  useEffect(() => {
    if (selectedFactId !== null) {
      markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedFactId])

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

  async function handleExtract() {
    if (note === null) {
      return
    }
    setExtracting(true)
    setExtractError(null)
    setExtractNotice(null)
    setShowReextractConfirm(false)
    try {
      const result = await extractNote(note.id)
      if (result.discarded_no_evidence > 0) {
        setExtractNotice(
          `La IA propuso ${countText(result.discarded_no_evidence, 'dato', 'datos')} sin cita en el texto y se han descartado.`,
        )
      }
      const rows = await listFacts(note.id)
      setFacts(rows)
      setNote((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              status: 'extracted',
              extracted_at: new Date().toISOString(),
            },
      )
    } catch (error: unknown) {
      setExtractError(
        error instanceof Error
          ? error.message
          : 'No se han podido extraer los datos. Inténtalo de nuevo.',
      )
    } finally {
      setExtracting(false)
    }
  }

  async function handleReview(id: string, action: ReviewAction, value?: string) {
    if (note === null) {
      return
    }
    setFactActionError(null)
    setSavingFact(true)
    try {
      const updated = await reviewFact(id, action, value)
      setFacts((previous) =>
        previous === null
          ? previous
          : previous.map((fact) => (fact.id === id ? updated : fact)),
      )
      setNote((previous) =>
        previous !== null && previous.status === 'extracted'
          ? { ...previous, status: 'reviewed' }
          : previous,
      )
      if (action === 'editar') {
        setEditingFactId(null)
        setEditFactValue('')
        setEditFactError(null)
      }
    } catch (error: unknown) {
      setFactActionError(
        error instanceof Error ? error.message : 'No se ha podido revisar el dato.',
      )
    } finally {
      setSavingFact(false)
    }
  }

  function handleStartEditFact(fact: ExtractedFactRow) {
    setEditingFactId(fact.id)
    setEditFactValue(fact.value)
    setEditFactError(null)
    setFactActionError(null)
  }

  async function handleSaveEditFact(id: string) {
    const value = editFactValue.trim()
    if (value.length < 1 || value.length > 300) {
      setEditFactError('El valor tiene que tener entre 1 y 300 caracteres.')
      return
    }
    setEditFactError(null)
    await handleReview(id, 'editar', value)
  }

  async function handleAddFact() {
    if (note === null) {
      return
    }
    const fieldName = toFieldName(addName)
    if (fieldName === '' || fieldName.length > 40) {
      setAddError('Escribe un nombre para el dato (letras y números).')
      return
    }
    const value = addValue.trim()
    if (value.length < 1 || value.length > 300) {
      setAddError('El valor tiene que tener entre 1 y 300 caracteres.')
      return
    }
    const quote = addQuote.trim()
    if (quote !== '' && !hasEvidence(quote, displayText)) {
      setAddError('La cita tiene que estar en el texto de la nota.')
      return
    }
    setAddError(null)
    setAddingFact(true)
    try {
      const created = await addFact(note.id, {
        category: addCategory,
        field_name: fieldName,
        value,
        evidence_quote: quote === '' ? null : quote,
      })
      setFacts((previous) => [...(previous ?? []), created])
      setNote((previous) =>
        previous !== null && previous.status === 'extracted'
          ? { ...previous, status: 'reviewed' }
          : previous,
      )
      setShowAddFact(false)
      setAddName('')
      setAddValue('')
      setAddQuote('')
    } catch (error: unknown) {
      setAddError(
        error instanceof Error ? error.message : 'No se ha podido añadir el dato.',
      )
    } finally {
      setAddingFact(false)
    }
  }

  async function handleApprove() {
    if (note === null) {
      return
    }
    setApproving(true)
    setApproveError(null)
    try {
      await approveNote(note.id)
      setNote((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              status: 'approved',
              approved_at: new Date().toISOString(),
            },
      )
      setShowApproveConfirm(false)
    } catch (error: unknown) {
      setApproveError(
        error instanceof Error ? error.message : 'No se ha podido aprobar la nota.',
      )
    } finally {
      setApproving(false)
    }
  }

  const displayText = note?.transcript ?? note?.raw_text ?? ''
  const normalizedDisplayText = displayText.normalize('NFC')
  const canEdit =
    note !== null && (note.status === 'draft' || note.status === 'transcribed')

  const factsList = facts ?? []
  const isApproved = note?.status === 'approved'
  const proposedCount = factsList.filter(
    (fact) => fact.review_status === 'propuesto',
  ).length
  const acceptedCount = factsList.filter(
    (fact) => fact.review_status === 'aceptado',
  ).length
  const editedCount = factsList.filter(
    (fact) => fact.review_status === 'editado',
  ).length
  const discardedFacts = factsList.filter(
    (fact) => fact.review_status === 'descartado',
  )
  const addedCount = factsList.filter((fact) => fact.origin === 'agente').length
  const canReextract =
    note?.status === 'extracted' &&
    facts !== null &&
    factsList.every((fact) => fact.review_status === 'propuesto')
  const canApprove =
    !isApproved &&
    factsList.length > 0 &&
    proposedCount === 0 &&
    factsList.some((fact) => fact.review_status !== 'descartado')

  const selectedFact =
    factsList.find((fact) => fact.id === selectedFactId) ?? null
  const highlightRange =
    selectedFact?.evidence_quote !== null &&
    selectedFact?.evidence_quote !== undefined
      ? findEvidenceRange(normalizedDisplayText, selectedFact.evidence_quote)
      : null

  function renderFactCard(fact: ExtractedFactRow) {
    const selected = fact.id === selectedFactId
    const hasQuote =
      fact.evidence_quote !== null &&
      fact.evidence_quote !== '' &&
      findEvidenceRange(normalizedDisplayText, fact.evidence_quote) !== null
    const confidence = confidenceText(fact.confidence)
    return (
      <article
        key={fact.id}
        className={`rounded-md border px-4 py-3 ${
          selected ? 'border-accent' : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">{fieldLabel(fact.field_name)}</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {REVIEW_STATUS_LABELS[fact.review_status]}
            </Badge>
            <Badge variant="neutral">
              {fact.origin === 'ia' ? 'IA' : 'Añadido por ti'}
            </Badge>
          </div>
        </div>
        <p className="mt-2 break-words text-base">{fact.value}</p>
        {fact.evidence_quote !== null && fact.evidence_quote !== '' && (
          <p className="mt-1 break-words text-sm text-text-secondary">
            «{fact.evidence_quote}»
          </p>
        )}
        {confidence !== null && (
          <p className="mt-1 text-sm text-text-secondary">{confidence}</p>
        )}
        {fact.original_value !== null && fact.original_value !== fact.value && (
          <p className="mt-1 break-words text-sm text-text-secondary">
            Valor de la IA: {fact.original_value}
          </p>
        )}
        {editingFactId === fact.id ? (
          <div className="mt-3">
            <Label htmlFor={`dato-editar-${fact.id}`}>Valor</Label>
            <textarea
              id={`dato-editar-${fact.id}`}
              value={editFactValue}
              onChange={(event) => {
                setEditFactValue(event.target.value)
                setEditFactError(null)
              }}
              rows={3}
              maxLength={300}
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
            />
            <p className="mt-1 text-right font-mono text-xs text-text-secondary">
              {editFactValue.length} / 300
            </p>
            {editFactError !== null && (
              <p className="mt-1 text-sm text-error">{editFactError}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => void handleSaveEditFact(fact.id)}
                disabled={savingFact}
              >
                {savingFact ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setEditingFactId(null)
                  setEditFactError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {hasQuote && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() =>
                  setSelectedFactId(selected ? null : fact.id)
                }
              >
                {selected ? 'Quitar resaltado' : 'Ver cita'}
              </Button>
            )}
            {!isApproved && fact.review_status !== 'descartado' && (
              <>
                {fact.review_status === 'propuesto' && (
                  <Button
                    size="lg"
                    onClick={() => void handleReview(fact.id, 'aceptar')}
                    disabled={savingFact}
                  >
                    Aceptar
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleStartEditFact(fact)}
                  disabled={savingFact}
                >
                  Editar
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => void handleReview(fact.id, 'descartar')}
                  disabled={savingFact}
                >
                  Descartar
                </Button>
              </>
            )}
            {!isApproved && fact.review_status === 'descartado' && (
              <Button
                size="lg"
                onClick={() => void handleReview(fact.id, 'recuperar')}
                disabled={savingFact}
              >
                Recuperar
              </Button>
            )}
          </div>
        )}
      </article>
    )
  }

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
                Estado:{' '}
                <span className="font-semibold">
                  {NOTE_STATUS_LABELS[note.status]}
                </span>
              </p>
              {isApproved && note.approved_at !== null && (
                <p className="text-text-secondary">
                  Aprobada el{' '}
                  {noteDateFormatter.format(new Date(note.approved_at))}
                </p>
              )}
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
                    {highlightRange === null ? (
                      normalizedDisplayText
                    ) : (
                      <>
                        {normalizedDisplayText.slice(0, highlightRange.start)}
                        <mark ref={markRef} className="bg-surface underline">
                          {normalizedDisplayText.slice(
                            highlightRange.start,
                            highlightRange.end,
                          )}
                        </mark>
                        {normalizedDisplayText.slice(highlightRange.end)}
                      </>
                    )}
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

            {note.status !== 'draft' && (
              <section className="mt-8" aria-labelledby="nota-datos">
                <h2 id="nota-datos" className="text-lg font-semibold">
                  Datos extraídos
                </h2>

                {note.status === 'transcribed' && (
                  <div className="mt-3">
                    <Button
                      size="lg"
                      onClick={() => void handleExtract()}
                      disabled={extracting}
                    >
                      {extracting ? 'Extrayendo…' : 'Extraer datos'}
                    </Button>
                    {extractError !== null && (
                      <p className="mt-3 text-sm text-error">{extractError}</p>
                    )}
                  </div>
                )}

                {extractNotice !== null && (
                  <p className="mt-3 text-sm text-text-secondary">
                    {extractNotice}
                  </p>
                )}
                {factsError !== null && (
                  <p className="mt-3 text-sm text-error">{factsError}</p>
                )}
                {factActionError !== null && (
                  <p className="mt-3 text-sm text-error">{factActionError}</p>
                )}

                {facts !== null && factsList.length > 0 && (
                  <p className="mt-4 text-sm text-text-secondary">
                    IA: {countText(proposedCount, 'propuesto', 'propuestos')} ·{' '}
                    {countText(acceptedCount, 'aceptado', 'aceptados')} ·{' '}
                    {countText(editedCount, 'editado', 'editados')} ·{' '}
                    {countText(discardedFacts.length, 'descartado', 'descartados')}{' '}
                    · {countText(addedCount, 'añadido por ti', 'añadidos por ti')}
                  </p>
                )}

                {facts !== null &&
                  factsList.length === 0 &&
                  note.status !== 'transcribed' && (
                    <p className="mt-3 text-sm text-text-secondary">
                      No se extrajo ningún dato de esta nota.
                    </p>
                  )}

                {facts !== null &&
                  CATEGORY_ORDER.map((category) => {
                    const group = factsList.filter(
                      (fact) =>
                        fact.category === category &&
                        fact.review_status !== 'descartado',
                    )
                    if (group.length === 0) {
                      return null
                    }
                    return (
                      <div key={category} className="mt-6">
                        <h3 className="text-base font-semibold">
                          {CATEGORY_TITLES[category]}
                        </h3>
                        <div className="mt-3 space-y-3">
                          {group.map((fact) => renderFactCard(fact))}
                        </div>
                      </div>
                    )
                  })}

                {facts !== null && discardedFacts.length > 0 && (
                  <div className="mt-6">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => setShowDiscarded((value) => !value)}
                      aria-expanded={showDiscarded}
                    >
                      Descartados ({discardedFacts.length})
                    </Button>
                    {showDiscarded && (
                      <div className="mt-3 space-y-3">
                        {discardedFacts.map((fact) => renderFactCard(fact))}
                      </div>
                    )}
                  </div>
                )}

                {!isApproved && (
                  <div className="mt-6">
                    {!showAddFact && (
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => {
                          setShowAddFact(true)
                          setAddError(null)
                        }}
                      >
                        Añadir dato
                      </Button>
                    )}
                    {showAddFact && (
                      <div className="mt-3 space-y-5 rounded-md border border-border px-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="dato-categoria">Categoría</Label>
                          <select
                            id="dato-categoria"
                            value={addCategory}
                            onChange={(event) =>
                              setAddCategory(event.target.value as FactCategory)
                            }
                            className="flex min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
                          >
                            {CATEGORY_ORDER.map((category) => (
                              <option key={category} value={category}>
                                {CATEGORY_TITLES[category]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dato-nombre">Nombre del dato</Label>
                          <Input
                            id="dato-nombre"
                            className="min-h-11"
                            value={addName}
                            onChange={(event) => {
                              setAddName(event.target.value)
                              setAddError(null)
                            }}
                            autoComplete="off"
                            placeholder="segunda_visita"
                          />
                          <p className="text-xs text-text-secondary">
                            Se convierte a minúsculas y guiones bajos.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dato-valor">Valor</Label>
                          <Input
                            id="dato-valor"
                            className="min-h-11"
                            value={addValue}
                            onChange={(event) => {
                              setAddValue(event.target.value)
                              setAddError(null)
                            }}
                            autoComplete="off"
                            maxLength={300}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dato-cita">Cita (opcional)</Label>
                          <Input
                            id="dato-cita"
                            className="min-h-11"
                            value={addQuote}
                            onChange={(event) => {
                              setAddQuote(event.target.value)
                              setAddError(null)
                            }}
                            autoComplete="off"
                            placeholder="Fragmento literal de la nota"
                          />
                        </div>
                        {addError !== null && (
                          <p className="text-sm text-error">{addError}</p>
                        )}
                        <div className="flex flex-wrap gap-3">
                          <Button
                            size="lg"
                            onClick={() => void handleAddFact()}
                            disabled={addingFact}
                          >
                            {addingFact ? 'Añadiendo…' : 'Añadir dato'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => {
                              setShowAddFact(false)
                              setAddError(null)
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canReextract && (
                  <div className="mt-6">
                    {!showReextractConfirm && (
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => setShowReextractConfirm(true)}
                        disabled={extracting}
                      >
                        Volver a extraer
                      </Button>
                    )}
                    {showReextractConfirm && (
                      <div className="mt-3 rounded-md border border-border bg-bg px-4 py-4">
                        <p className="font-semibold">
                          Se sustituirán los datos propuestos por la IA.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            size="lg"
                            onClick={() => void handleExtract()}
                            disabled={extracting}
                          >
                            {extracting ? 'Extrayendo…' : 'Volver a extraer'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={() => setShowReextractConfirm(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                    {extractError !== null && (
                      <p className="mt-3 text-sm text-error">{extractError}</p>
                    )}
                  </div>
                )}

                {!isApproved && factsList.length > 0 && (
                  <div className="mt-6">
                    {canApprove ? (
                      <>
                        {!showApproveConfirm && (
                          <Button
                            size="lg"
                            onClick={() => setShowApproveConfirm(true)}
                          >
                            Aprobar nota
                          </Button>
                        )}
                        {showApproveConfirm && (
                          <div className="mt-3 rounded-md border border-border bg-bg px-4 py-4">
                            <p className="font-semibold">
                              Una vez aprobada, la nota y sus datos no se
                              podrán cambiar.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <Button
                                size="lg"
                                onClick={() => void handleApprove()}
                                disabled={approving}
                              >
                                {approving ? 'Aprobando…' : 'Aprobar'}
                              </Button>
                              <Button
                                variant="secondary"
                                size="lg"
                                onClick={() => setShowApproveConfirm(false)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-text-secondary">
                        {proposedCount > 0
                          ? 'Revisa todos los datos propuestos antes de aprobar.'
                          : 'Añade al menos un dato para aprobar la nota.'}
                      </p>
                    )}
                    {approveError !== null && (
                      <p className="mt-3 text-sm text-error">{approveError}</p>
                    )}
                  </div>
                )}
              </section>
            )}

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
