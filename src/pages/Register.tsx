import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { useAuth } from '../lib/auth-context'
import { APP_PHASE_LABEL } from '../lib/app-label'
import { mapAuthErrorMessage } from '../lib/auth-errors'
import { supabase } from '../lib/supabase'

const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Introduce tu nombre completo.'),
  email: z.string().email('Introduce un email válido.'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.'),
})

type FieldErrors = Record<string, string>

/**
 * /registro: nombre completo, email y contraseña (mínimo 8 caracteres).
 * El nombre viaja en options.data.full_name: el trigger de la migración
 * 0003 lo usa para crear la fila en public.agents.
 * Si la confirmación de email está activa en Supabase, el registro no
 * inicia sesión directamente: se muestra «Revisa tu correo para confirmar
 * la cuenta». (Por defecto, Supabase permite 2 emails/hora.)
 */
export default function Register() {
  const { supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setNeedsConfirmation(false)
    const parsed = registerSchema.safeParse({ fullName, email, password })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    if (supabase === null) return
    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        // Sin emailRedirectTo, el correo de confirmación vuelve a la
        // Site URL (localhost) aunque el registro se haga desde Pages.
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
    setSubmitting(false)
    if (error !== null) {
      setFormError(mapAuthErrorMessage(error.message))
      return
    }
    if (data.session !== null) {
      navigate('/', { replace: true })
      return
    }
    setNeedsConfirmation(true)
  }

  return (
    <main className="mx-auto max-w-md bg-bg px-4 py-12 text-text-primary">
      <p className="font-mono text-xs text-text-secondary">
        {APP_PHASE_LABEL}
      </p>
      <h1 className="mt-2 text-2xl">Crear cuenta de agente</h1>
      <p className="mt-2 text-base text-text-secondary">
        Una cuenta por agente. Tu nombre y tu email identifican tus visitas.
      </p>

      {!supabaseConfigured ? (
        <div className="mt-6">
          <SupabaseMissingNotice />
        </div>
      ) : needsConfirmation ? (
        <p className="mt-6 rounded-md border border-success bg-success/10 px-3 py-2 text-sm text-success">
          Revisa tu correo para confirmar la cuenta. Cuando confirmes, podrás
          entrar con tu email y tu contraseña.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="register-name">Nombre completo</Label>
            <Input
              id="register-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
            {errors['fullName'] !== undefined && (
              <p className="text-xs text-error">{errors['fullName']}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors['email'] !== undefined && (
              <p className="text-xs text-error">{errors['email']}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password">Contraseña</Label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors['password'] !== undefined && (
              <p className="text-xs text-error">{errors['password']}</p>
            )}
            <p className="text-xs text-text-secondary">
              Mínimo 8 caracteres.
            </p>
          </div>
          {formError !== null && (
            <p className="rounded-md border border-error bg-error/10 px-3 py-2 text-sm text-error">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
          <p className="text-center text-sm text-text-secondary">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-text-primary underline underline-offset-2">
              Entra
            </Link>
          </p>
        </form>
      )}
    </main>
  )
}
