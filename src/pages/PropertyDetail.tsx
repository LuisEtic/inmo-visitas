import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ContactButtons, PhoneText } from '../components/ContactButtons'
import { PrivateNav } from '../components/PrivateNav'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { formatPriceEs } from '../lib/contact'
import type { PropertyRow } from '../lib/database.types'
import { useAuth } from '../lib/auth-context'
import { PropertyForm } from '../features/properties/PropertyForm'
import {
  createProperty,
  getProperty,
  listProperties,
  removeProperty,
  updateProperty,
} from '../features/properties/api'
import { erasePropertyOwner } from '../features/privacy/api'
import { nextFreeReference } from '../features/properties/reference'
import {
  PROPERTY_STATUS_LABELS,
  type PropertyFormValues,
} from '../features/properties/schema'
import { APP_PHASE_LABEL } from '../lib/app-label'

/**
 * /inmuebles/nuevo y /inmuebles/:id (privadas): el mismo formulario para
 * crear y editar. En la ficha: modo ver (con el bloque «Propietario» y sus
 * botones «Llamar» y «WhatsApp», cada uno solo si hay teléfono) y botón
 * «Editar»; «Borrar» con confirmación. Un id inexistente o de otro agente
 * muestra «No encontrado»: RLS devuelve 0 filas y no se distingue entre
 * los dos casos.
 */
export default function PropertyDetail() {
  // /inmuebles/nuevo es una ruta estática sin `:id`: ahí `id` es undefined.
  // La `key` fuerza un montaje nuevo al pasar de «nuevo» a la ficha creada
  // (o de una ficha a otra), para no arrastrar el estado anterior.
  const { id } = useParams<{ id: string }>()
  return <PropertyDetailView key={id ?? 'nuevo'} id={id} />
}

function PropertyDetailView({ id }: { id: string | undefined }) {
  const { supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const isNew = id === undefined

  const [property, setProperty] = useState<PropertyRow | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(isNew)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Fase 8: borrar los datos del propietario (lo anonimiza, sin
  // borrar el inmueble ni las notas).
  const [confirmingEraseOwner, setConfirmingEraseOwner] = useState(false)
  const [erasingOwner, setErasingOwner] = useState(false)
  const [eraseOwnerError, setEraseOwnerError] = useState<string | null>(null)
  // Solo al crear: la siguiente referencia libre (V-54 si existe hasta
  // V-53). null mientras carga; si falla la lista, se usa V-01.
  const [suggestedReference, setSuggestedReference] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (id === undefined) {
      return
    }
    let mounted = true
    getProperty(id)
      .then((row) => {
        if (!mounted) return
        setProperty(row)
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
  }, [id, isNew])

  useEffect(() => {
    if (!isNew) {
      return
    }
    let mounted = true
    listProperties()
      .then((rows) => {
        if (!mounted) return
        setSuggestedReference(
          nextFreeReference(rows.map((row) => row.reference)),
        )
      })
      .catch(() => {
        if (!mounted) return
        setSuggestedReference('V-01')
      })
    return () => {
      mounted = false
    }
  }, [isNew])

  async function handleSubmit(values: PropertyFormValues) {
    setFormError(null)
    setSubmitting(true)
    try {
      if (isNew) {
        const created = await createProperty(values)
        navigate(`/inmuebles/${created.id}`, { replace: true })
        return
      }
      if (property === null) return
      const updated = await updateProperty(property.id, values)
      setProperty(updated)
      setEditing(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ha ocurrido un error.'
      setFormError(
        isNew &&
          message.startsWith('Ya tienes un inmueble con la referencia') &&
          suggestedReference !== null
          ? `${message}. La siguiente libre es ${suggestedReference}.`
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (property === null) return
    setFormError(null)
    setDeleting(true)
    try {
      await removeProperty(property.id)
      navigate('/inmuebles', { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  async function handleEraseOwner() {
    if (property === null) return
    setEraseOwnerError(null)
    setErasingOwner(true)
    try {
      await erasePropertyOwner(property.id)
      setProperty((previous) =>
        previous === null
          ? previous
          : {
              ...previous,
              owner_name: 'Propietario borrado',
              owner_phone: null,
            },
      )
      setConfirmingEraseOwner(false)
    } catch (error) {
      setEraseOwnerError(
        error instanceof Error
          ? error.message
          : 'No se han podido borrar los datos del propietario.',
      )
    } finally {
      setErasingOwner(false)
    }
  }

  function handleCancel() {
    if (isNew) {
      navigate('/inmuebles')
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
          {isNew ? (
            'Nuevo inmueble'
          ) : (
            <span className="font-mono">{property?.reference ?? 'Inmueble'}</span>
          )}
        </h1>

        {!supabaseConfigured && (
          <div className="mt-6">
            <SupabaseMissingNotice />
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-text-secondary">Cargando…</p>}
        {isNew && suggestedReference === null && (
          <p className="mt-6 text-sm text-text-secondary">Cargando…</p>
        )}
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && !isNew && property === null && loadError === null && (
          <div className="mt-6">
            <p className="text-base">No encontrado</p>
            <p className="mt-2 text-sm text-text-secondary">
              Este inmueble no existe o no es tuyo.
            </p>
            <Button asChild variant="secondary" size="lg" className="mt-4">
              <Link to="/inmuebles">Volver a inmuebles</Link>
            </Button>
          </div>
        )}

        {(isNew || editing) &&
          (isNew ? suggestedReference !== null : property !== null) && (
            <PropertyForm
              initial={isNew ? null : property}
              suggestedReference={isNew ? suggestedReference ?? undefined : undefined}
              submitLabel={isNew ? 'Crear inmueble' : 'Guardar cambios'}
              submitting={submitting}
              formError={formError}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          )}

        {!isNew && !editing && property !== null && (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm text-text-secondary">Dirección</p>
              <p className="mt-1 break-words text-base">
                {property.address}, {property.city}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Precio</p>
              <p className="mt-1 text-base font-semibold">{formatPriceEs(property.price)}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Estado</p>
              <p className="mt-1">
                <Badge variant={property.status}>{PROPERTY_STATUS_LABELS[property.status]}</Badge>
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Propietario</p>
              <p className="mt-1 break-words text-base">{property.owner_name}</p>
              <p className="mt-1 text-base">
                {property.owner_phone !== null && property.owner_phone !== '' ? (
                  <PhoneText phone={property.owner_phone} />
                ) : (
                  <span className="text-text-secondary">Sin teléfono</span>
                )}
              </p>
              <div className="mt-2">
                <ContactButtons phone={property.owner_phone} />
              </div>
              {property.owner_name !== 'Propietario borrado' && (
                <div className="mt-4">
                  {!confirmingEraseOwner && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="border-error text-error"
                      onClick={() => setConfirmingEraseOwner(true)}
                    >
                      Borrar datos del propietario
                    </Button>
                  )}
                  {confirmingEraseOwner && (
                    <div className="rounded-md border border-error bg-bg px-4 py-4">
                      <p className="font-semibold">
                        ¿Borrar los datos del propietario?
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Se borrarán su nombre y su teléfono. El inmueble y
                        sus notas se quedan.
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Los textos de las notas pueden nombrar al
                        propietario: revísalos o bórralos si lo pide.
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Esta acción no se puede deshacer.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          variant="secondary"
                          size="lg"
                          className="border-error text-error"
                          onClick={() => void handleEraseOwner()}
                          disabled={erasingOwner}
                        >
                          {erasingOwner
                            ? 'Borrando…'
                            : 'Borrar datos del propietario'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() => setConfirmingEraseOwner(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  {eraseOwnerError !== null && (
                    <p className="mt-3 text-sm text-error">
                      {eraseOwnerError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {formError !== null && <p className="text-sm text-error">{formError}</p>}

            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setEditing(true)}>
                Editar
              </Button>
              {!confirmingDelete && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="border-error text-error"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Borrar
                </Button>
              )}
            </div>

            {confirmingDelete && (
              <div className="rounded-md border border-error bg-bg px-4 py-4">
                <p className="font-semibold">
                  ¿Borrar el inmueble {property.reference}?
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Esta acción no se puede deshacer.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="border-error text-error"
                    onClick={handleDelete}
                    disabled={deleting}
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
