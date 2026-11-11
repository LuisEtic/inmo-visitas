import { z } from 'zod'

/**
 * Funciones puras de la captura (Fase 4): elección del tipo MIME de
 * grabación, extensión de archivo, formato del contador y validación
 * del texto de la nota. Sin acceso a `navigator` ni a Supabase, para
 * poder probarlas con Vitest.
 */

/** Duración máxima de una grabación: 3 minutos. */
export const MAX_RECORDING_SECONDS = 180

/** Longitud máxima del texto de una nota (también de una corrección). */
export const MAX_NOTE_TEXT_LENGTH = 5000

/** Longitud mínima del texto de una nota. */
export const MIN_NOTE_TEXT_LENGTH = 10

/** Tamaño máximo de un audio subido: 10 MB (igual que el bucket). */
export const MAX_AUDIO_BYTES = 10485760

/**
 * Tipos MIME que se prueban, en orden de preferencia. Safari/iOS no
 * soporta `audio/webm` y graba `audio/mp4`.
 */
export const RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
] as const

/**
 * Devuelve el primer tipo MIME de `RECORDING_MIME_TYPES` que el
 * navegador soporta, o null si no soporta ninguno. `isSupported` es
 * `MediaRecorder.isTypeSupported` (se inyecta para poder probarlo).
 */
export function pickSupportedMimeType(
  isSupported: (mimeType: string) => boolean,
): string | null {
  for (const mimeType of RECORDING_MIME_TYPES) {
    if (isSupported(mimeType)) {
      return mimeType
    }
  }
  return null
}

/** Extensión de archivo según el tipo base del audio grabado. */
export function extensionForMimeType(mimeType: string): string | null {
  const base = mimeType.split(';')[0]?.trim().toLowerCase()
  if (base === 'audio/webm') {
    return 'webm'
  }
  if (base === 'audio/mp4') {
    return 'm4a'
  }
  if (base === 'audio/ogg') {
    return 'ogg'
  }
  return null
}

/** Segundos a formato `m:ss` del contador de grabación (`0:00 / 3:00`). */
export function formatRecordingTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

/** Texto de una nota: obligatorio, 10–5.000 caracteres, recortado. */
export const noteTextSchema = z
  .string()
  .trim()
  .min(MIN_NOTE_TEXT_LENGTH, 'La nota debe tener al menos 10 caracteres.')
  .max(
    MAX_NOTE_TEXT_LENGTH,
    'La nota no puede tener más de 5.000 caracteres.',
  )

export type NoteText = z.output<typeof noteTextSchema>

/**
 * Valida el texto de una nota y devuelve el texto recortado o el
 * mensaje de error en español.
 */
export function validateNoteText(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const result = noteTextSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, value: result.data }
  }
  const message = result.error.issues[0]?.message
  return { ok: false, error: message ?? 'La nota no es válida.' }
}
