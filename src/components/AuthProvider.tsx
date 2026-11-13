import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../lib/auth-context'
import { flushAudioCleanup } from '../features/privacy/audio-cleanup'

/**
 * Proveedor de sesión. Escucha onAuthStateChange y mantiene la sesión en
 * contexto. Mientras se comprueba la sesión inicial, `loading` es true y
 * las rutas privadas no redirigen todavía (sin parpadeo de /login).
 * Sin variables de Supabase configuradas, no hay cliente: la sesión queda
 * en null y las pantallas muestran el aviso «Falta configurar Supabase».
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Sin cliente de Supabase no hay sesión que comprobar: carga terminada.
  const [loading, setLoading] = useState(supabase !== null)
  // Fase 8: el usuario para el que ya se vació la cola de audios en
  // esta sesión del navegador. La cola se vacía una vez por sesión
  // (al entrar), y nunca lanza: si falla, lo que quede se vacía la
  // próxima vez.
  const flushedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (supabase === null) {
      return
    }
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setSession(null)
          setLoading(false)
        }
      })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Fase 8: al entrar con una sesión nueva, vaciar la cola de audios
  // pendientes de borrar (aprobaciones y borrados anteriores).
  useEffect(() => {
    const userId = session?.user.id
    if (userId === undefined || flushedUserIdRef.current === userId) {
      return
    }
    flushedUserIdRef.current = userId
    void flushAudioCleanup()
  }, [session])

  const signOut = useCallback(async () => {
    if (supabase !== null) {
      await supabase.auth.signOut()
    }
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      supabaseConfigured: supabase !== null,
      signOut,
    }),
    [session, loading, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
