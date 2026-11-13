import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadAudio } from './api'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  exists: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mocks.upload, exists: mocks.exists }),
    },
  },
}))

const blob = new Blob(['audio'], { type: 'audio/webm' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('uploadAudio (respuesta perdida tras una subida correcta)', () => {
  it('subida correcta: devuelve la ruta sin preguntar a Storage', async () => {
    mocks.upload.mockResolvedValue({ data: {}, error: null })
    await expect(uploadAudio('agente', 'nota', blob, 'webm')).resolves.toBe(
      'agente/nota.webm',
    )
    expect(mocks.exists).not.toHaveBeenCalled()
  })

  it('«ya existe» porque la subida anterior llegó: se da por subido', async () => {
    mocks.upload.mockResolvedValue({
      data: null,
      error: new Error('The resource already exists'),
    })
    mocks.exists.mockResolvedValue({ data: true, error: null })
    await expect(uploadAudio('agente', 'nota', blob, 'webm')).resolves.toBe(
      'agente/nota.webm',
    )
    expect(mocks.exists).toHaveBeenCalledWith('agente/nota.webm')
  })

  it('fallo y el objeto no está: error de subida', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: new Error('red') })
    mocks.exists.mockResolvedValue({ data: false, error: null })
    await expect(uploadAudio('agente', 'nota', blob, 'webm')).rejects.toThrow(
      'No se ha podido subir el audio',
    )
  })

  it('fallo y la comprobación también falla: error de subida', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: new Error('red') })
    mocks.exists.mockRejectedValue(new Error('sin red'))
    await expect(uploadAudio('agente', 'nota', blob, 'webm')).rejects.toThrow(
      'No se ha podido subir el audio',
    )
  })
})
