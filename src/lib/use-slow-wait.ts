import { useEffect, useState } from 'react'

/**
 * Espera lenta (Fase 9): devuelve `true` cuando `active` lleva al
 * menos `delayMs` (10 s por defecto) sin interrupción. Sirve para
 * añadir «Puede tardar hasta un minuto.» a un aviso de carga solo
 * cuando la espera se alarga, sin reintentar nada: la operación sigue
 * su curso y es el agente quien decide si espera o sale.
 */
export function useSlowWait(active: boolean, delayMs = 10000): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = window.setTimeout(() => setSlow(true), delayMs)
    // Al dejar de estar activo (o al cambiar el retardo) la espera
    // lenta se resetea: la próxima espera vuelve a contar desde cero.
    return () => {
      window.clearTimeout(timer)
      setSlow(false)
    }
  }, [active, delayMs])
  return slow
}
