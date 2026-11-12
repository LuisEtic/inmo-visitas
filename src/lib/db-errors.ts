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
  context?: {
    reference?: string
    drafts?: boolean
    task?: boolean
    exports?: boolean
  },
): string {
  if (error.code === '23505') {
    if (context?.reference !== undefined) {
      return `Ya tienes un inmueble con la referencia ${context.reference}`
    }
    if (context?.drafts === true) {
      return 'Ya hay un borrador para este destinatario; vuelve a generarlo'
    }
    return 'Ya existe un registro con esos datos.'
  }
  if (error.code === '23503') {
    return 'No se puede borrar: tiene notas de visita asociadas'
  }
  if (error.code === '42501') {
    return 'No tienes permiso para esta acción'
  }
  if (error.code === 'P0001') {
    // Excepciones de los triggers de revisión (migraciones 0007 y 0008): el
    // mensaje es el nombre del error que lanza el trigger.
    if (error.message.includes('nota_aprobada')) {
      return 'La nota está aprobada y ya no se puede cambiar'
    }
    if (error.message.includes('datos_sin_revisar')) {
      return 'Revisa todos los datos antes de aprobar la nota'
    }
    if (error.message.includes('texto_bloqueado')) {
      return 'El texto ya no se puede corregir: tiene datos extraídos'
    }
    // Migración 0008 (revisión de la Fase 5).
    if (error.message.includes('transicion_no_valida')) {
      // El mismo error lo lanzan el guard de notas (0008) y el de
      // tareas (0009): el texto cambia según la entidad.
      return context?.task === true
        ? 'La tarea no puede pasar a ese estado'
        : 'La nota no puede pasar a ese estado'
    }
    if (error.message.includes('nota_sin_datos')) {
      return 'La nota necesita al menos un dato no descartado para aprobarla'
    }
    // Migración 0009 (Fase 6): seguimiento de una nota aprobada.
    // El mismo error lo lanza el guard de exportaciones (0010): el
    // texto cambia según el contexto (en la exportación no se prepara
    // ningún seguimiento).
    if (error.message.includes('nota_no_aprobada')) {
      return context?.exports === true
        ? 'Aprueba la nota antes de exportarla'
        : 'Aprueba la nota antes de preparar el seguimiento'
    }
    if (error.message.includes('borrador_aprobado')) {
      return 'El borrador está aprobado y ya no se puede cambiar'
    }
    if (error.message.includes('fuente_no_valida')) {
      return 'El dato de origen no pertenece a esta nota'
    }
    // Migración 0010 (Fase 7): registro de exportaciones.
    if (error.message.includes('borrador_no_aprobado')) {
      return 'Aprueba el borrador antes de enviarlo.'
    }
    if (error.message.includes('exportacion_no_valida')) {
      return 'Esta exportación no es válida.'
    }
    if (error.message.includes('exportacion_cerrada')) {
      return 'Esta exportación ya está cerrada; si quieres, vuelve a exportar.'
    }
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}
