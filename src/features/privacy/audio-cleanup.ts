import { supabase } from '../../lib/supabase'

/**
 * Cola de borrado de audios (Fase 8, migración 0012).
 *
 * La base encola la ruta del audio cuando se borra una nota
 * (`nota_borrada`) o cuando se aprueba (`nota_aprobada`); la cola
 * guarda solo la ruta. Esta función borra esos objetos de
 * `visit-audio` y vacía la cola.
 *
 * - En lotes de 50 rutas por llamada a `storage.remove`.
 * - Solo se borran de la cola las filas cuyo objeto se borró o ya no
 *   existía (la respuesta de `remove` las lista en ambos casos: el
 *   borrado en Storage es idempotente). Las filas de un lote fallido
 *   se quedan para la próxima vez.
 * - Nunca lanza: si algo falla, se reintenta en la próxima llamada
 *   (al iniciar sesión, tras aprobar una nota o tras cada borrado).
 */

const AUDIO_BUCKET = 'visit-audio'

/** Rutas por llamada a `storage.remove`. */
const BATCH_SIZE = 50

export async function flushAudioCleanup(): Promise<void> {
  try {
    if (supabase === null) {
      return
    }
    const { data, error } = await supabase
      .from('audio_cleanup')
      .select('id, path')
    if (error !== null || data === null || data.length === 0) {
      return
    }
    const rows: Array<{ id: string; path: string }> = data
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const paths = batch.map((row) => row.path)
      let removedNames: Set<string>
      try {
        const result = await supabase.storage
          .from(AUDIO_BUCKET)
          .remove(paths)
        if (result.error !== null || result.data === null) {
          // Lote fallido: las filas se quedan para la próxima vez.
          continue
        }
        removedNames = new Set(result.data.map((object) => object.name))
      } catch {
        continue
      }
      const doneIds = batch
        .filter((row) => removedNames.has(row.path))
        .map((row) => row.id)
      if (doneIds.length === 0) {
        continue
      }
      // Si borrar de la cola falla, las filas se quedan: se reintentan.
      await supabase.from('audio_cleanup').delete().in('id', doneIds)
    }
  } catch {
    // Nunca lanza: se reintenta la próxima vez.
  }
}
