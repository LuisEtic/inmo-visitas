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
  removeProperty,
  updateProperty,
} from '../features/properties/api'
import type { PropertyFormValues } from '../features/properties/schema'

const STATUS_LABELS: Record<string, string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
}

/**
 * /inmuebles/nuevo y /inmuebles/:id (privadas): el mismo formulario para
 * crear y editar. En la ficha: modo ver (con el bloque «Propietario» y sus
 * botones «Llamar» y «WhatsApp», cada uno solo si hay teléfono) y botón
 * «Editar»; «Borrar» con confirmación. Un id inexistente o de otro agente
 * muestra «No encontrado»: RLS devuelve 0 filas y no se distingue entre
 * los dos casos.
 */
export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>()
  const { supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const isNew = id === 'nuevo'

  const [property, setProperty] = useState<PropertyRow | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(isNew)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (isNew || id === undefined) {
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
      setFormError(error instanceof Error ? error.message : 'Ha ocurrido un error.')
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
        <p className="font-mono text-xs text-text-secondary">inmo-visitas · Fase 3</p>
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
        {loadError !== null && <p className="mt-6 text-sm text-error">{loadError}</p>}

        {!loading && !isNew && property === null && loadError === null && (
          <div className="mt-6">
            <p className="text-base">No encontrado</p>
            <p className="mt-2 text-sm text-text-secondary">
              Este inmueble no existe o no es tuyo.
            </p>
            <Link to="/inmuebles" className="mt-4 inline-block">
              <Button variant="secondary" size="lg">
                Volver a inmuebles
              </Button>
            </Link>
          </div>
        )}

        {(isNew || editing) && (isNew || property !== null) && (
          <PropertyForm
            initial={isNew ? null : property}
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
                <Badge variant={property.status}>{STATUS_LABELS[property.status]}</Badge>
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
