import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { createClient, listClients } from '../features/clients/api'
import { clientFormSchema } from '../features/clients/schema'
import { listProperties } from '../features/properties/api'
import { PROPERTY_STATUS_LABELS } from '../features/properties/schema'
import { extensionForMimeType, validateNoteText } from '../features/capture/audio'
import { useRecorder } from '../features/capture/useRecorder'
import {
  createAudioDraftNote,
  createTextNote,
  setAudioUrl,
  uploadAudio,
} from '../features/notes/api'
import { formatPhone } from '../lib/contact'
import type { ClientRow, PropertyRow } from '../lib/database.types'
import { useAuth } from '../lib/auth-context'
import { matchesClientQuery, matchesPropertyQuery } from '../lib/search'
import { APP_PHASE_LABEL } from '../lib/app-label'

/**
 * /capturar (privada): elegir cliente e inmueble y crear una nota de
 * visita por texto o por voz (Fase 4).
 * - Cliente: buscador sobre los clientes del agente, o cliente
 *   provisional rápido (nombre + teléfono opcional, is_temporary).
 * - Inmueble: buscador; solo disponible o reservado, con casilla para
 *   mostrar también los vendidos.
 * - Nota: pestañas «Voz» (por defecto si el navegador graba) y «Texto».
 * - Voz: insert de la nota en `draft` → subida del audio a Storage →
 *   `audio_url` con la ruta → /notas/:id, que lanza la transcripción.
 *   Si la subida falla, la grabación se conserva y se reintenta sobre
 *   la misma nota (no se crea una segunda).
 */
export default function Capture() {
  const { supabaseConfigured, user } = useAuth()
  const navigate = useNavigate()
  const recorder = useRecorder()

  const [clients, setClients] = useState<ClientRow[]>([])
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(supabaseConfigured)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [clientQuery, setClientQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null)
  const [propertyQuery, setPropertyQuery] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null)
  const [showSold, setShowSold] = useState(false)

  const [showProvisional, setShowProvisional] = useState(false)
  const [provisionalName, setProvisionalName] = useState('')
  const [provisionalPhone, setProvisionalPhone] = useState('')
  const [provisionalError, setProvisionalError] = useState<string | null>(null)
  const [creatingProvisional, setCreatingProvisional] = useState(false)

  const voiceSupported =
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined
  const [tab, setTab] = useState<'voice' | 'text'>(voiceSupported ? 'voice' : 'text')
  const [text, setText] = useState('')
  const [textError, setTextError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Nota en `draft` ya creada para el audio: el reintento de subida
  // reutiliza su id (no se crea una segunda nota).
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }
    let mounted = true
    Promise.all([listClients(), listProperties()])
      .then(([clientRows, propertyRows]) => {
        if (!mounted) return
        setClients(clientRows)
        setProperties(propertyRows)
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

  const filteredClients = useMemo(
    () => clients.filter((client) => matchesClientQuery(client, clientQuery)),
    [clients, clientQuery],
  )

  const filteredProperties = useMemo(
    () =>
      properties.filter(
        (property) =>
          (showSold || property.status !== 'vendido') &&
          matchesPropertyQuery(property, propertyQuery),
      ),
    [properties, propertyQuery, showSold],
  )

  const blobUrl = useMemo(() => {
    if (recorder.blob === null) {
      return null
    }
    return URL.createObjectURL(recorder.blob)
  }, [recorder.blob])

  useEffect(
    () => () => {
      if (blobUrl !== null) {
        URL.revokeObjectURL(blobUrl)
      }
    },
    [blobUrl],
  )

  async function handleCreateProvisional() {
    setProvisionalError(null)
    const parsed = clientFormSchema.safeParse({
      full_name: provisionalName,
      phone: provisionalPhone,
      email: '',
      is_temporary: true,
    })
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      setProvisionalError(
        flat.full_name?.[0] ?? flat.phone?.[0] ?? 'Revisa los datos del cliente.',
      )
      return
    }
    setCreatingProvisional(true)
    try {
      const created = await createClient(parsed.data)
      setClients((previous) =>
        [...previous, created].sort((a, b) => a.full_name.localeCompare(b.full_name)),
      )
      setSelectedClient(created)
      setShowProvisional(false)
      setProvisionalName('')
      setProvisionalPhone('')
    } catch (error: unknown) {
      setProvisionalError(
        error instanceof Error ? error.message : 'Ha ocurrido un error.',
      )
    } finally {
      setCreatingProvisional(false)
    }
  }

  async function handleSaveText() {
    if (selectedClient === null || selectedProperty === null) {
      return
    }
    const validation = validateNoteText(text)
    if (!validation.ok) {
      setTextError(validation.error)
      return
    }
    setTextError(null)
    setSaveError(null)
    setSaving(true)
    try {
      const note = await createTextNote(
        selectedClient.id,
        selectedProperty.id,
        validation.value,
      )
      navigate(`/notas/${note.id}`)
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
      setSaving(false)
    }
  }

  async function handleSaveAudio() {
    if (
      selectedClient === null ||
      selectedProperty === null ||
      recorder.blob === null ||
      recorder.mimeType === null ||
      user === null
    ) {
      return
    }
    const extension = extensionForMimeType(recorder.mimeType)
    if (extension === null) {
      setSaveError('El formato de audio grabado no es válido.')
      return
    }
    setSaveError(null)
    setUploadError(null)
    setSaving(true)
    let noteId = pendingNoteId
    try {
      if (noteId === null) {
        const note = await createAudioDraftNote(selectedClient.id, selectedProperty.id)
        noteId = note.id
        setPendingNoteId(noteId)
      }
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
      setSaving(false)
      return
    }
    try {
      const path = await uploadAudio(user.id, noteId, recorder.blob, extension)
      await setAudioUrl(noteId, path)
    } catch (error: unknown) {
      setUploadError(
        error instanceof Error ? error.message : 'Ha ocurrido un error.',
      )
      setSaving(false)
      return
    }
    navigate(`/notas/${noteId}`)
  }

  const textValidation = validateNoteText(text)
  const canSaveText =
    selectedClient !== null && selectedProperty !== null && textValidation.ok
  const canSaveAudio =
    selectedClient !== null &&
    selectedProperty !== null &&
    recorder.state === 'stopped' &&
    recorder.blob !== null

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-4xl bg-bg px-4 py-8 text-text-primary">
        <p className="font-mono text-xs text-text-secondary">{APP_PHASE_LABEL}</p>
        <h1 className="mt-2 text-2xl">Capturar visita</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Elige cliente e inmueble y deja la nota por voz o por texto.
        </p>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && loadError === null && (
          <>
            <section className="mt-8" aria-labelledby="capturar-cliente">
              <h2 id="capturar-cliente" className="text-lg font-semibold">
                Cliente
              </h2>
              <div className="mt-3">
                <Input
                  className="min-h-11"
                  type="search"
                  value={clientQuery}
                  onChange={(event) => setClientQuery(event.target.value)}
                  placeholder="Buscar por nombre, teléfono o email"
                  aria-label="Buscar clientes"
                />
              </div>
              <ul className="mt-3 space-y-2">
                {filteredClients.map((client) => {
                  const selected = selectedClient?.id === client.id
                  return (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedClient(client)}
                        aria-pressed={selected}
                        className={`block min-h-11 w-full rounded-md border px-4 py-3 text-left ${
                          selected
                            ? 'border-text-primary bg-surface'
                            : 'border-border bg-bg hover:bg-surface'
                        }`}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold break-words">
                            {client.full_name}
                          </span>
                          {client.is_temporary && (
                            <Badge variant="neutral">Provisional</Badge>
                          )}
                          {selected && <Badge variant="neutral">Seleccionado</Badge>}
                        </span>
                        {client.phone !== null && client.phone !== '' && (
                          <span className="mt-1 block text-sm text-text-secondary">
                            {formatPhone(client.phone)}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {filteredClients.length === 0 && (
                <p className="mt-3 text-sm text-text-secondary">
                  Ningún cliente coincide con la búsqueda.
                </p>
              )}
              <div className="mt-4">
                {!showProvisional ? (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setShowProvisional(true)}
                  >
                    Cliente nuevo (provisional)
                  </Button>
                ) : (
                  <div className="rounded-md border border-border bg-surface px-4 py-4">
                    <div>
                      <Label htmlFor="provisional-nombre">Nombre completo</Label>
                      <Input
                        id="provisional-nombre"
                        className="mt-1 min-h-11 bg-bg"
                        value={provisionalName}
                        onChange={(event) => setProvisionalName(event.target.value)}
                        placeholder="Ej.: Marta (la del lunes)"
                        autoComplete="off"
                      />
                    </div>
                    <div className="mt-3">
                      <Label htmlFor="provisional-telefono">
                        Teléfono (opcional)
                      </Label>
                      <Input
                        id="provisional-telefono"
                        className="mt-1 min-h-11 bg-bg"
                        type="tel"
                        value={provisionalPhone}
                        onChange={(event) => setProvisionalPhone(event.target.value)}
                        placeholder="Ej.: 612 34 56 78"
                        autoComplete="off"
                      />
                    </div>
                    {provisionalError !== null && (
                      <p className="mt-3 text-sm text-error">{provisionalError}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        size="lg"
                        onClick={handleCreateProvisional}
                        disabled={creatingProvisional}
                      >
                        {creatingProvisional ? 'Creando…' : 'Crear y seleccionar'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => {
                          setShowProvisional(false)
                          setProvisionalError(null)
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-8" aria-labelledby="capturar-inmueble">
              <h2 id="capturar-inmueble" className="text-lg font-semibold">
                Inmueble
              </h2>
              <div className="mt-3">
                <Input
                  className="min-h-11"
                  type="search"
                  value={propertyQuery}
                  onChange={(event) => setPropertyQuery(event.target.value)}
                  placeholder="Buscar por referencia, dirección, ciudad o propietario"
                  aria-label="Buscar inmuebles"
                />
              </div>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showSold}
                  onChange={(event) => setShowSold(event.target.checked)}
                  className="h-5 w-5 accent-black"
                />
                Mostrar vendidos
              </label>
              <ul className="mt-3 space-y-2">
                {filteredProperties.map((property) => {
                  const selected = selectedProperty?.id === property.id
                  return (
                    <li key={property.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedProperty(property)}
                        aria-pressed={selected}
                        className={`block min-h-11 w-full rounded-md border px-4 py-3 text-left ${
                          selected
                            ? 'border-text-primary bg-surface'
                            : 'border-border bg-bg hover:bg-surface'
                        }`}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold">
                            {property.reference}
                          </span>
                          <Badge variant="neutral">
                            {PROPERTY_STATUS_LABELS[property.status]}
                          </Badge>
                          {selected && <Badge variant="neutral">Seleccionado</Badge>}
                        </span>
                        <span className="mt-1 block text-sm text-text-secondary">
                          {property.address}, {property.city}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {filteredProperties.length === 0 && (
                <p className="mt-3 text-sm text-text-secondary">
                  Ningún inmueble coincide con la búsqueda.
                </p>
              )}
            </section>

            <section className="mt-8" aria-labelledby="capturar-nota">
              <h2 id="capturar-nota" className="text-lg font-semibold">
                Nota
              </h2>
              <div className="mt-3 flex gap-2" role="tablist" aria-label="Tipo de nota">
                {voiceSupported && (
                  <Button
                    role="tab"
                    aria-selected={tab === 'voice'}
                    variant={tab === 'voice' ? 'primary' : 'secondary'}
                    size="lg"
                    onClick={() => setTab('voice')}
                  >
                    Voz
                  </Button>
                )}
                <Button
                  role="tab"
                  aria-selected={tab === 'text'}
                  variant={tab === 'text' ? 'primary' : 'secondary'}
                  size="lg"
                  onClick={() => setTab('text')}
                >
                  Texto
                </Button>
              </div>

              {tab === 'voice' && voiceSupported && (
                <div className="mt-4">
                  <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
                    Graba tu resumen al salir de la visita, no la conversación
                    con el cliente.
                  </p>
                  {recorder.state === 'idle' && (
                    <Button size="lg" className="mt-4" onClick={() => void recorder.start()}>
                      Grabar
                    </Button>
                  )}
                  {recorder.state === 'recording' && (
                    <div className="mt-4">
                      <p className="font-mono text-lg" aria-live="polite">
                        {recorder.elapsedLabel}
                      </p>
                      <Button
                        size="lg"
                        className="mt-3"
                        onClick={recorder.stop}
                      >
                        Parar
                      </Button>
                    </div>
                  )}
                  {recorder.state === 'stopped' && blobUrl !== null && (
                    <div className="mt-4">
                      <audio controls src={blobUrl} className="w-full" />
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Button variant="secondary" size="lg" onClick={recorder.reset}>
                          Volver a grabar
                        </Button>
                      </div>
                    </div>
                  )}
                  {recorder.error !== null && (
                    <p className="mt-4 text-sm text-error">{recorder.error}</p>
                  )}
                </div>
              )}

              {tab === 'text' && (
                <div className="mt-4">
                  <Label htmlFor="nota-texto">Escribe lo ocurrido en la visita</Label>
                  <textarea
                    id="nota-texto"
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value)
                      setTextError(null)
                    }}
                    rows={6}
                    maxLength={5000}
                    placeholder="Ej.: Ana ha visitado V-18 con su pareja…"
                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-2 focus-visible:outline-info"
                  />
                  <p className="mt-1 text-right font-mono text-xs text-text-secondary">
                    {text.length} / 5.000
                  </p>
                  {textError !== null && (
                    <p className="mt-1 text-sm text-error">{textError}</p>
                  )}
                </div>
              )}
            </section>

            <div className="mt-8 border-t border-border pt-6">
              {tab === 'text' ? (
                <Button
                  size="lg"
                  onClick={() => void handleSaveText()}
                  disabled={!canSaveText || saving}
                >
                  {saving ? 'Guardando…' : 'Guardar nota'}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => void handleSaveAudio()}
                  disabled={!canSaveAudio || saving}
                >
                  {saving ? 'Guardando…' : 'Guardar nota'}
                </Button>
              )}
              {selectedClient === null || selectedProperty === null ? (
                <p className="mt-3 text-sm text-text-secondary">
                  Elige un cliente y un inmueble para guardar la nota.
                </p>
              ) : null}
              {saveError !== null && (
                <p className="mt-3 text-sm text-error">{saveError}</p>
              )}
              {uploadError !== null && (
                <div className="mt-3">
                  <p className="text-sm text-error">{uploadError}</p>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="mt-3"
                    onClick={() => void handleSaveAudio()}
                    disabled={saving}
                  >
                    Reintentar subida
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  )
}
