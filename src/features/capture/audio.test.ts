import { describe, expect, it } from 'vitest'
import {
  extensionForMimeType,
  formatRecordingTime,
  MAX_NOTE_TEXT_LENGTH,
  MAX_RECORDING_SECONDS,
  pickSupportedMimeType,
  RECORDING_MIME_TYPES,
  validateNoteText,
} from './audio'

describe('pickSupportedMimeType', () => {
  it('devuelve el primer tipo soportado, en orden de preferencia', () => {
    const supported = new Set(['audio/webm', 'audio/mp4'])
    expect(pickSupportedMimeType((mime) => supported.has(mime))).toBe('audio/webm')
  })

  it('salta los no soportados hasta encontrar uno válido', () => {
    const supported = new Set(['audio/mp4'])
    expect(pickSupportedMimeType((mime) => supported.has(mime))).toBe('audio/mp4')
  })

  it('devuelve null si el navegador no soporta ninguno', () => {
    expect(pickSupportedMimeType(() => false)).toBeNull()
  })

  it('reconoce el tipo con códecs opus cuando está soportado', () => {
    const supported = new Set(['audio/webm;codecs=opus'])
    expect(pickSupportedMimeType((mime) => supported.has(mime))).toBe(
      'audio/webm;codecs=opus',
    )
  })
})

describe('extensionForMimeType', () => {
  it('webm con códecs → webm', () => {
    expect(extensionForMimeType('audio/webm;codecs=opus')).toBe('webm')
  })

  it('webm sin códecs → webm', () => {
    expect(extensionForMimeType('audio/webm')).toBe('webm')
  })

  it('mp4 (Safari/iOS) → m4a', () => {
    expect(extensionForMimeType('audio/mp4')).toBe('m4a')
  })

  it('ogg → ogg', () => {
    expect(extensionForMimeType('audio/ogg')).toBe('ogg')
  })

  it('tipo desconocido → null', () => {
    expect(extensionForMimeType('audio/wav')).toBeNull()
    expect(extensionForMimeType('video/mp4')).toBeNull()
    expect(extensionForMimeType('')).toBeNull()
  })
})

describe('formatRecordingTime', () => {
  it('0 segundos → 0:00', () => {
    expect(formatRecordingTime(0)).toBe('0:00')
  })

  it('59 segundos → 0:59', () => {
    expect(formatRecordingTime(59)).toBe('0:59')
  })

  it('65 segundos → 1:05', () => {
    expect(formatRecordingTime(65)).toBe('1:05')
  })

  it('180 segundos (límite) → 3:00', () => {
    expect(formatRecordingTime(MAX_RECORDING_SECONDS)).toBe('3:00')
  })

  it('recorta decimales y negativos', () => {
    expect(formatRecordingTime(12.9)).toBe('0:12')
    expect(formatRecordingTime(-5)).toBe('0:00')
  })
})

describe('validateNoteText', () => {
  const ejemplo =
    'Ana ha visitado V-18 con su pareja. Le preocupa el ruido de la calle Alcalá por la noche.'

  it('acepta el texto de ejemplo y lo recorta', () => {
    const result = validateNoteText(`  ${ejemplo}  `)
    expect(result).toEqual({ ok: true, value: ejemplo })
  })

  it('rechaza menos de 10 caracteres', () => {
    const result = validateNoteText('demasiado')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('La nota debe tener al menos 10 caracteres.')
    }
  })

  it('rechaza el texto vacío o solo con espacios', () => {
    const result = validateNoteText('    ')
    expect(result.ok).toBe(false)
  })

  it('acepta exactamente 10 caracteres', () => {
    expect(validateNoteText('0123456789').ok).toBe(true)
  })

  it('acepta exactamente 5.000 caracteres', () => {
    expect(validateNoteText('a'.repeat(MAX_NOTE_TEXT_LENGTH)).ok).toBe(true)
  })

  it('rechaza 5.001 caracteres', () => {
    const result = validateNoteText('a'.repeat(MAX_NOTE_TEXT_LENGTH + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('La nota no puede tener más de 5.000 caracteres.')
    }
  })
})

describe('constantes de captura', () => {
  it('el límite de grabación es 3 minutos', () => {
    expect(MAX_RECORDING_SECONDS).toBe(180)
  })

  it('la lista de tipos MIME empieza por webm con opus', () => {
    expect(RECORDING_MIME_TYPES[0]).toBe('audio/webm;codecs=opus')
  })
})
