import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { useAuth } from '../lib/auth-context'
import { mapAuthErrorMessage } from '../lib/auth-errors'
import { supabase } from '../lib/supabase'
import { APP_PHASE_LABEL } from '../lib/app-label'

const loginSchema = z.object({
  email: z.string().email('Introduce un email válido.'),
  password: z.string().min(1, 'Introduce tu contraseña.'),
})

const magicLinkSchema = z.object({
  email: z.string().email('Introduce un email válido.'),
})

type FieldErrors = Record<string, string>

function fieldError(errors: FieldErrors, field: string): string | null {
  return errors[field] ?? null
}

/**
 * /login: entrada con email + contraseña, o con enlace mágico (solo email).
 * Sin sesión, las rutas privadas redirigen aquí y, tras entrar, se vuelve
 * a la ruta que se pidió (location.state.from).
 */
export default function Login() {
  const { supabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? '/'

  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setInfo(null)
    const parsed = loginSchema.safeParse({ email, password })
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
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })
    setSubmitting(false)
    if (error !== null) {
      setFormError(mapAuthErrorMessage(error.message))
      return
    }
    navigate(from, { replace: true })
  }

  async function handleMagicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setInfo(null)
    const parsed = magicLinkSchema.safeParse({ email })
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
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        // Sin emailRedirectTo, Supabase vuelve a la Site URL (localhost)
        // aunque el enlace se abra desde Pages. La redirección debe ser
        // la base donde se sirve la app (local o /inmo-visitas/).
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
    setSubmitting(false)
    if (error !== null) {
      setFormError(mapAuthErrorMessage(error.message))
      return
    }
    setInfo('Enlace enviado. Revisa tu correo para entrar.')
  }

  return (
    <main className="mx-auto max-w-md bg-bg px-4 py-12 text-text-primary">
      <p className="font-mono text-xs text-text-secondary">
        {APP_PHASE_LABEL}
      </p>
      <h1 className="mt-2 text-2xl">Entrar</h1>
      <p className="mt-2 text-base text-text-secondary">
        Accede con tu cuenta de agente para ver tus visitas.
      </p>

      {!supabaseConfigured ? (
        <div className="mt-6">
          <SupabaseMissingNotice />
        </div>
      ) : mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {fieldError(errors, 'email') !== null && (
              <p className="text-xs text-error">{fieldError(errors, 'email')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {fieldError(errors, 'password') !== null && (
              <p className="text-xs text-error">{fieldError(errors, 'password')}</p>
            )}
          </div>
          {formError !== null && (
            <p className="rounded-md border border-error bg-error/10 px-3 py-2 text-sm text-error">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
          <p className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('magic')
                setFormError(null)
                setErrors({})
              }}
              className="text-sm font-semibold text-text-primary underline underline-offset-2"
            >
              Entrar con enlace mágico
            </button>
          </p>
          <p className="text-center text-sm text-text-secondary">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-text-primary underline underline-offset-2">
              Regístrate
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleMagicSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="magic-email">Email</Label>
            <Input
              id="magic-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {fieldError(errors, 'email') !== null && (
              <p className="text-xs text-error">{fieldError(errors, 'email')}</p>
            )}
          </div>
          {formError !== null && (
            <p className="rounded-md border border-error bg-error/10 px-3 py-2 text-sm text-error">
              {formError}
            </p>
          )}
          {info !== null && (
            <p className="rounded-md border border-success bg-success/10 px-3 py-2 text-sm text-success">
              {info}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar enlace mágico'}
          </Button>
          <p className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('password')
                setFormError(null)
                setInfo(null)
                setErrors({})
              }}
              className="text-sm font-semibold text-text-primary underline underline-offset-2"
            >
              Entrar con contraseña
            </button>
          </p>
          <p className="text-center text-sm text-text-secondary">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-text-primary underline underline-offset-2">
              Regístrate
            </Link>
          </p>
        </form>
      )}
    </main>
  )
}
