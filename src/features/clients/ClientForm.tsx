import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { formatPhone } from '../../lib/contact'
import type { ClientRow } from '../../lib/database.types'
import { clientFormSchema, type ClientFormValues } from './schema'

type FieldErrors = Record<string, string>

const inputClass = 'min-h-11'

/**
 * Formulario de cliente (Fase 3). Se usa igual para crear y para editar:
 * los valores se validan con Zod al guardar (teléfono normalizado a E.164,
 * email en minúsculas) y solo se llama a `onSubmit` con los valores
 * normalizados. El teléfono y el email son opcionales.
 */
export function ClientForm({
  initial,
  submitLabel,
  submitting,
  formError,
  onSubmit,
  onCancel,
}: {
  initial?: ClientRow | null
  submitLabel: string
  submitting: boolean
  formError: string | null
  onSubmit: (values: ClientFormValues) => void
  onCancel: () => void
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [phone, setPhone] = useState(
    initial?.phone === null || initial?.phone === undefined ? '' : formatPhone(initial.phone),
  )
  const [email, setEmail] = useState(initial?.email ?? '')
  const [isTemporary, setIsTemporary] = useState(initial?.is_temporary ?? false)
  const [errors, setErrors] = useState<FieldErrors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = clientFormSchema.safeParse({
      full_name: fullName,
      phone,
      email,
      is_temporary: isTemporary,
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
        <Label htmlFor="client-full-name">Nombre completo</Label>
        <Input
          id="client-full-name"
          className={inputClass}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
        />
        {errors['full_name'] !== undefined && (
          <p className="text-sm text-error">{errors['full_name']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-phone">Teléfono (opcional)</Label>
        <Input
          id="client-phone"
          className={inputClass}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
          inputMode="tel"
          placeholder="612 34 56 78"
        />
        {errors['phone'] !== undefined && (
          <p className="text-sm text-error">{errors['phone']}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="client-email">Email (opcional)</Label>
        <Input
          id="client-email"
          className={inputClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          placeholder="nombre@email.com"
        />
        {errors['email'] !== undefined && (
          <p className="text-sm text-error">{errors['email']}</p>
        )}
      </div>

      <div className="flex min-h-11 items-center gap-3">
        <input
          id="client-temporary"
          type="checkbox"
          checked={isTemporary}
          onChange={(event) => setIsTemporary(event.target.checked)}
          className="h-5 w-5 shrink-0 accent-text-primary"
        />
        <Label htmlFor="client-temporary" className="leading-snug">
          Cliente provisional (faltan datos)
        </Label>
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
