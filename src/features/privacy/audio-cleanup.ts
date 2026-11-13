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
 *   existía. `remove` lista solo los objetos que borró de verdad (si
 *   la ruta ya no existía, no la lista): para esas rutas se pregunta
 *   a Storage con `exists` y la fila se va solo si responde que no
 *   existe (revisión de la Fase 8). Las filas de un lote fallido, o
 *   cuya comprobación falla, se quedan para la próxima vez.
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
      // Rutas que `remove` no listó: si el objeto ya no existe, la fila
      // también se va; si existe o la comprobación falla, se queda.
      for (const row of batch) {
        if (removedNames.has(row.path)) {
          continue
        }
        try {
          const { data: stillExists } = await supabase.storage
            .from(AUDIO_BUCKET)
            .exists(row.path)
          if (stillExists === false) {
            doneIds.push(row.id)
          }
        } catch {
          // Se queda para la próxima vez.
        }
      }
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
