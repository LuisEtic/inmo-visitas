/**
 * Reintento de subida de audio (Fase 9): función pura que decide el
 * siguiente paso de la subida a partir del estado.
 *
 * La subida de una nota de voz tiene tres pasos: crear la nota en
 * `draft`, subir el audio a Storage (`upsert: false`) y guardar
 * `audio_url` en la nota. Si la subida fue bien y falló el paso
 * siguiente, el reintento se salta la subida y repite solo lo que
 * falló: volver a subir con `upsert: false` sobre una ruta que ya
 * existe falla siempre («ya existe»). La pantalla recuerda la ruta ya
 * subida (`uploadedPath`) y si `audio_url` ya se guardó.
 */

export type UploadStepState = {
  /** Id de la nota en `draft` ya creada, o null si aún no se creó. */
  noteId: string | null
  /** Ruta del audio ya subido a Storage, o null si no se subió. */
  uploadedPath: string | null
  /** Si `audio_url` ya se guardó en la nota. */
  audioUrlSaved: boolean
}

export type UploadNextStep =
  | { step: 'create-note' }
  | { step: 'upload-audio'; noteId: string }
  | { step: 'save-audio-url'; noteId: string; path: string }
  | { step: 'done'; noteId: string }

/**
 * Decide el siguiente paso de la subida a partir del estado.
 * Sin nota → crearla; con nota sin audio → subirlo; con audio
 * subido y `audio_url` sin guardar → guardarlo; con todo hecho →
 * la nota está lista. Un estado imposible (audio subido sin nota)
 * se trata como si no hubiera nota: se crea una nueva.
 */
export function nextUploadStep(state: UploadStepState): UploadNextStep {
  if (state.noteId === null) {
    return { step: 'create-note' }
  }
  if (state.uploadedPath === null) {
    return { step: 'upload-audio', noteId: state.noteId }
  }
  if (!state.audioUrlSaved) {
    return { step: 'save-audio-url', noteId: state.noteId, path: state.uploadedPath }
  }
  return { step: 'done', noteId: state.noteId }
}
