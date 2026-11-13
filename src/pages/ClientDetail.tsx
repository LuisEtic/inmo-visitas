import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { ContactButtons, PhoneText } from '../components/ContactButtons'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import type { ClientRow } from '../lib/database.types'
import { useAuth } from '../lib/auth-context'
import { ClientForm } from '../features/clients/ClientForm'
import {
  createClient,
  getClient,
  updateClient,
} from '../features/clients/api'
import {
  countClientNotes,
  downloadClientData,
  eraseClient,
} from '../features/privacy/api'
import type { ClientFormValues } from '../features/clients/schema'
import { matchesConfirmName } from '../features/privacy/confirm'
import { APP_PHASE_LABEL } from '../lib/app-label'

/**
 * /clientes/nuevo y /clientes/:id (privadas): el mismo formulario para
 * crear y editar. En la ficha: modo ver (con botones de contacto, cada uno
 * solo si hay dato) y botón «Editar»; «Borrar» con confirmación.
 * Un id inexistente o de otro agente muestra «No encontrado»: RLS devuelve
 * 0 filas y no se distingue entre los dos casos.
 */
export default function ClientDetail() {
  // /clientes/nuevo es una ruta estática sin `:id`: ahí `id` es undefined.
  // La `key` fuerza un montaje nuevo al pasar de «nuevo» a la ficha creada
  // (o de una ficha a otra), para no arrastrar el estado anterior.
  const { id } = useParams<{ id: string }>()
  return <ClientDetailView key={id ?? 'nuevo'} id={id} />
}

function ClientDetailView({ id }: { id: string | undefined }) {
  const { supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const isNew = id === undefined

  const [client, setClient] = useState<ClientRow | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(isNew)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Fase 8: cuántas notas tiene el cliente (para la confirmación de
  // borrado). null mientras carga.
  const [noteCount, setNoteCount] = useState<number | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (id === undefined) {
      return
    }
    let mounted = true
    getClient(id)
      .then((row) => {
        if (!mounted) return
        setClient(row)
        setLoading(false)
        if (row !== null) {
          countClientNotes(row.id)
            .then((count) => {
              if (mounted) setNoteCount(count)
            })
            .catch(() => {
              if (mounted) setNoteCount(0)
            })
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setLoadError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [id, isNew])

  async function handleSubmit(values: ClientFormValues) {
    setFormError(null)
    setSubmitting(true)
    try {
      if (isNew) {
        const created = await createClient(values)
        navigate(`/clientes/${created.id}`, { replace: true })
        return
      }
      if (client === null) return
      const updated = await updateClient(client.id, values)
      setClient(updated)
      setEditing(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (client === null) return
    setFormError(null)
    setDeleting(true)
    try {
      // Fase 8: borra el cliente con todas sus notas (datos, tareas,
      // borradores, exportaciones y audios) y registra
      // `cliente_borrado`. Sin notas, igual: queda el registro.
      await eraseClient(client.id)
      navigate('/clientes', { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  async function handleDownloadData() {
    if (client === null) return
    setDownloadError(null)
    setDownloading(true)
    try {
      await downloadClientData(client.id)
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : 'No se han podido descargar los datos.',
      )
    } finally {
      setDownloading(false)
    }
  }

  function handleCancel() {
    if (isNew) {
      navigate('/clientes')
      return
    }
    setEditing(false)
    setFormError(null)
  }

  return (
    <>
      <PrivateNav />
      <main className="mx-auto max-w-md bg-bg px-4 py-8 text-text-primary">
        <p className="font-mono text-xs text-text-secondary">{APP_PHASE_LABEL}</p>
        <h1 className="mt-2 text-2xl">
          {isNew ? 'Nuevo cliente' : (client?.full_name ?? 'Cliente')}
        </h1>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && !isNew && client === null && loadError === null && (
          <div className="mt-6">
            <p className="text-base">No encontrado</p>
            <p className="mt-2 text-sm text-text-secondary">
              Este cliente no existe o no es tuyo.
            </p>
            <Button asChild variant="secondary" size="lg" className="mt-4">
              <Link to="/clientes">Volver a clientes</Link>
            </Button>
          </div>
        )}

        {(isNew || editing) && (isNew || client !== null) && (
          <ClientForm
            initial={isNew ? null : client}
            submitLabel={isNew ? 'Crear cliente' : 'Guardar cambios'}
            submitting={submitting}
            formError={formError}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}

        {!isNew && !editing && client !== null && (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm text-text-secondary">Teléfono</p>
              <p className="mt-1 text-base">
                {client.phone !== null && client.phone !== '' ? (
                  <PhoneText phone={client.phone} />
                ) : (
                  <span className="text-text-secondary">Sin teléfono</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Email</p>
              <p className="mt-1 break-words text-base">
                {client.email !== null && client.email !== '' ? (
                  client.email
                ) : (
                  <span className="text-text-secondary">Sin email</span>
                )}
              </p>
            </div>
            {client.is_temporary && (
              <div>
                <Badge variant="neutral">Provisional</Badge>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm text-text-secondary">Contacto</p>
              <ContactButtons phone={client.phone} email={client.email} />
              {client.phone === null && client.email === null && (
                <p className="text-sm text-text-secondary">
                  Sin datos de contacto: añade un teléfono o un email para contactar.
                </p>
              )}
            </div>

            {formError !== null && <p className="text-sm text-error">{formError}</p>}

            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => void handleDownloadData()}
                disabled={downloading}
              >
                {downloading ? 'Descargando…' : 'Descargar sus datos'}
              </Button>
              {!confirmingDelete && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="border-error text-error"
                  onClick={() => {
                    setConfirmName('')
                    setConfirmingDelete(true)
                  }}
                >
                  Borrar
                </Button>
              )}
            </div>

            {downloadError !== null && (
              <p className="text-sm text-error">{downloadError}</p>
            )}

            {confirmingDelete && (
              <div className="rounded-md border border-error bg-bg px-4 py-4">
                <p className="font-semibold">
                  ¿Borrar a {client.full_name}?
                </p>
                {noteCount === null && (
                  <p className="mt-1 text-sm text-text-secondary">
                    Cargando…
                  </p>
                )}
                {noteCount !== null && noteCount > 0 && (
                  <>
                    <p className="mt-1 text-sm text-text-secondary">
                      Se borrarán {client.full_name} y sus {noteCount}{' '}
                      {noteCount === 1 ? 'nota' : 'notas'} con sus datos,
                      tareas, borradores y exportaciones. Lo que ya
                      enviaste por WhatsApp o exportaste al CRM hay que
                      borrarlo allí.
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Para confirmar, escribe el nombre del cliente.
                    </p>
                    <div className="mt-3">
                      <Label htmlFor="confirmar-nombre">
                        Nombre del cliente
                      </Label>
                      <Input
                        id="confirmar-nombre"
                        value={confirmName}
                        onChange={(event) =>
                          setConfirmName(event.target.value)
                        }
                        autoComplete="off"
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                {noteCount === 0 && (
                  <p className="mt-1 text-sm text-text-secondary">
                    Se borrarán sus datos. Esta acción no se puede
                    deshacer.
                  </p>
                )}
                {noteCount !== null && noteCount > 0 && (
                  <p className="mt-1 text-sm text-text-secondary">
                    Esta acción no se puede deshacer.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="border-error text-error"
                    onClick={handleDelete}
                    disabled={
                      deleting ||
                      noteCount === null ||
                      (noteCount > 0 &&
                        !matchesConfirmName(confirmName, client.full_name))
                    }
                  >
                    {deleting ? 'Borrando…' : 'Borrar'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
