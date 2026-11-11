import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { formatPhone, formatPricePlain, parsePriceEs } from '../../lib/contact'
import type { PropertyRow } from '../../lib/database.types'
import { PROPERTY_STATUSES, propertyFormSchema, type PropertyFormValues } from './schema'

type FieldErrors = Record<string, string>

const inputClass = 'min-h-11'

const STATUS_LABELS: Record<string, string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
}

/**
 * Formulario de inmueble (Fase 3). Se usa igual para crear y para editar:
 * los valores se validan con Zod al guardar (referencia en mayúsculas,
 * precio en formato español, teléfono del propietario normalizado a E.164)
 * y solo se llama a `onSubmit` con los valores normalizados.
 */
export function PropertyForm({
  initial,
  suggestedReference,
  submitLabel,
  submitting,
  formError,
  onSubmit,
  onCancel,
}: {
  initial?: PropertyRow | null
  /** Solo al crear: la siguiente referencia libre (V-54 si existe hasta V-53). */
  suggestedReference?: string
  submitLabel: string
  submitting: boolean
  formError: string | null
  onSubmit: (values: PropertyFormValues) => void
  onCancel: () => void
}) {
  const [reference, setReference] = useState(
    initial?.reference ?? suggestedReference ?? '',
  )
  const [address, setAddress] = useState(initial?.address ?? '')
  const [city, setCity] = useState(initial?.city ?? 'Madrid')
  const [price, setPrice] = useState(
    initial?.price === undefined
      ? ''
      : initial.price.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
  )
  const [ownerName, setOwnerName] = useState(initial?.owner_name ?? '')
  const [ownerPhone, setOwnerPhone] = useState(
    initial?.owner_phone === null || initial?.owner_phone === undefined
      ? ''
      : formatPhone(initial.owner_phone),
  )
  const [status, setStatus] = useState<string>(initial?.status ?? 'disponible')
  const [errors, setErrors] = useState<FieldErrors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = propertyFormSchema.safeParse({
      reference,
      address,
      city,
      price,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      status,
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="property-reference">Referencia</Label>
        <Input
          id="property-reference"
          className={`${inputClass} font-mono`}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          autoComplete="off"
          placeholder="V-52"
        />
        {errors['reference'] !== undefined && (
          <p className="text-sm text-error">{errors['reference']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="property-address">Dirección</Label>
        <Input
          id="property-address"
          className={inputClass}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          autoComplete="street-address"
        />
        {errors['address'] !== undefined && (
          <p className="text-sm text-error">{errors['address']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="property-city">Ciudad</Label>
        <Input
          id="property-city"
          className={inputClass}
          value={city}
          onChange={(event) => setCity(event.target.value)}
          autoComplete="address-level2"
        />
        {errors['city'] !== undefined && (
          <p className="text-sm text-error">{errors['city']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="property-price">Precio (€)</Label>
        <Input
          id="property-price"
          className={inputClass}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          onBlur={() => {
            try {
              setPrice(formatPricePlain(parsePriceEs(price)))
            } catch {
              // Se deja como está: la validación al guardar explica el error.
            }
          }}
          inputMode="decimal"
          placeholder="285.000"
        />
        {errors['price'] !== undefined && (
          <p className="text-sm text-error">{errors['price']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="property-owner-name">Nombre del propietario</Label>
        <Input
          id="property-owner-name"
          className={inputClass}
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          autoComplete="name"
        />
        {errors['owner_name'] !== undefined && (
          <p className="text-sm text-error">{errors['owner_name']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="property-owner-phone">Teléfono del propietario (opcional)</Label>
        <Input
          id="property-owner-phone"
          className={inputClass}
          value={ownerPhone}
          onChange={(event) => setOwnerPhone(event.target.value)}
          autoComplete="tel"
          inputMode="tel"
          placeholder="699 11 22 33"
        />
        {errors['owner_phone'] !== undefined && (
          <p className="text-sm text-error">{errors['owner_phone']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="property-status">Estado</Label>
        <select
          id="property-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="flex min-h-11 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
        >
          {PROPERTY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        {errors['status'] !== undefined && (
          <p className="text-sm text-error">{errors['status']}</p>
        )}
      </div>

      {formError !== null && <p className="text-sm text-error">{formError}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? 'Guardando…' : submitLabel}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
