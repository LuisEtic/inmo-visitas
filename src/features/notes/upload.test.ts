import { describe, expect, it } from 'vitest'
import { nextUploadStep } from './upload'

describe('nextUploadStep (reintento de subida)', () => {
  it('sin nota → crear la nota', () => {
    expect(
      nextUploadStep({ noteId: null, uploadedPath: null, audioUrlSaved: false }),
    ).toEqual({ step: 'create-note' })
  })

  it('con nota y sin audio → subir el audio', () => {
    expect(
      nextUploadStep({ noteId: 'nota-1', uploadedPath: null, audioUrlSaved: false }),
    ).toEqual({ step: 'upload-audio', noteId: 'nota-1' })
  })

  it('con audio subido y audio_url sin guardar → guardarlo, sin volver a subir', () => {
    expect(
      nextUploadStep({
        noteId: 'nota-1',
        uploadedPath: 'agente/nota-1.webm',
        audioUrlSaved: false,
      }),
    ).toEqual({
      step: 'save-audio-url',
      noteId: 'nota-1',
      path: 'agente/nota-1.webm',
    })
  })

  it('con todo hecho → la nota está lista', () => {
    expect(
      nextUploadStep({
        noteId: 'nota-1',
        uploadedPath: 'agente/nota-1.webm',
        audioUrlSaved: true,
      }),
    ).toEqual({ step: 'done', noteId: 'nota-1' })
  })

  it('audio subido sin nota (estado imposible) → crear una nota nueva', () => {
    expect(
      nextUploadStep({
        noteId: null,
        uploadedPath: 'agente/nota-1.webm',
        audioUrlSaved: false,
      }),
    ).toEqual({ step: 'create-note' })
  })
})
