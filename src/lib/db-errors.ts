import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Traduce a español los errores de PostgREST más habituales.
 * Los mensajes originales vienen en inglés y, en el caso de las claves
 * duplicadas, revelan detalles internos; al agente se le muestra siempre
 * un mensaje en español y sin datos de otros agentes. Lo que no se
 * reconoce, mensaje genérico.
 */
export function translateDbError(
  error: PostgrestError,
  context?: { reference?: string },
): string {
  if (error.code === '23505') {
    if (context?.reference !== undefined) {
      return `Ya tienes un inmueble con la referencia ${context.reference}`
    }
    return 'Ya existe un registro con esos datos.'
  }
  if (error.code === '23503') {
    return 'No se puede borrar: tiene notas de visita asociadas'
  }
  if (error.code === '42501') {
    return 'No tienes permiso para esta acción'
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}
