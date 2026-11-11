import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { SupabaseMissingNotice } from '../components/SupabaseMissingNotice'
import { useAuth } from '../lib/auth-context'
import { mapAuthErrorMessage } from '../lib/auth-errors'
import { supabase } from '../lib/supabase'

const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Introduce tu nombre completo.'),
  phone: z.string().trim().optional(),
})

interface AgentProfile {
  full_name: string
  email: string
  phone: string | null
}

/**
 * /perfil (privada): ver y editar el perfil del agente. El email es de
 * solo lectura. La fila en public.agents la crea el trigger de la
 * migración 0003 al registrarse; aquí solo se edita full_name y phone.
 */
export default function Profile() {
  const { user, supabaseConfigured, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  // La página es privada: tras RequireAuth hay usuario y, si hay cliente,
  // hay perfil que cargar. Sin cliente no hay nada que cargar.
  const [loading, setLoading] = useState(supabase !== null && user !== null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (supabase === null || user === null) {
      return
    }
    let mounted = true
    supabase
      .from('agents')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error !== null || data === null) {
          setLoadError(
            'No se encontró tu perfil de agente. Si acabas de registrarte, espera unos segundos y recarga.',
          )
          setLoading(false)
          return
        }
        const row = data as AgentProfile
        setProfile(row)
        setFullName(row.full_name)
        setPhone(row.phone ?? '')
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [user])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSaved(false)
    const parsed = profileSchema.safeParse({ fullName, phone })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    if (supabase === null || user === null) return
    setSaving(true)
    const { error } = await supabase
      .from('agents')
      .update({
        full_name: parsed.data.fullName,
        phone: parsed.data.phone === '' ? null : parsed.data.phone,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error !== null) {
      setFormError(mapAuthErrorMessage(error.message))
      return
    }
    setSaved(true)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="mx-auto max-w-md bg-bg px-4 py-12 text-text-primary">
      <p className="font-mono text-xs text-text-secondary">
        inmo-visitas · Fase 2
      </p>
      <h1 className="mt-2 text-2xl">Mi perfil</h1>
      <p className="mt-2 text-base text-text-secondary">
        Tu identidad como agente. Solo tú ves y editas estos datos.
      </p>

      {!supabaseConfigured ? (
        <div className="mt-6">
          <SupabaseMissingNotice />
        </div>
      ) : loading ? (
        <p className="mt-6 text-sm text-text-secondary">Cargando perfil…</p>
      ) : loadError !== null || profile === null ? (
        <p className="mt-6 rounded-md border border-error bg-error/10 px-3 py-2 text-sm text-error">
          {loadError ?? 'No se encontró tu perfil de agente.'}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nombre completo</Label>
            <Input
              id="profile-name"
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
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={profile.email}
              disabled
              readOnly
            />
            <p className="text-xs text-text-secondary">
              El email no se puede cambiar desde aquí.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Teléfono</Label>
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            {errors['phone'] !== undefined && (
              <p className="text-xs text-error">{errors['phone']}</p>
            )}
          </div>
          {formError !== null && (
            <p className="rounded-md border border-error bg-error/10 px-3 py-2 text-sm text-error">
              {formError}
            </p>
          )}
          {saved && (
            <p className="rounded-md border border-success bg-success/10 px-3 py-2 text-sm text-success">
              Perfil guardado.
            </p>
          )}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar perfil'}
          </Button>
        </form>
      )}

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link to="/" className="font-semibold underline underline-offset-2">
          Volver al inicio
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="font-semibold underline underline-offset-2 disabled:opacity-50"
        >
          {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </main>
  )
}
