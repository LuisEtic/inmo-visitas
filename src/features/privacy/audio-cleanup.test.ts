import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushAudioCleanup } from './audio-cleanup'

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  deleteIn: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: mocks.select,
      delete: () => ({ in: mocks.deleteIn }),
    }),
    storage: {
      from: () => ({ remove: mocks.remove }),
    },
  },
}))

function queueRow(id: string, path: string) {
  return { id, path }
}

function removed(name: string) {
  return { name }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.deleteIn.mockResolvedValue({ data: null, error: null })
})

describe('flushAudioCleanup', () => {
  it('borra en lotes de 50 y vacía la cola', async () => {
    const rows = Array.from({ length: 120 }, (_, i) =>
      queueRow(`id-${i}`, `agente-a/nota-${i}.webm`),
    )
    mocks.select.mockResolvedValue({ data: rows, error: null })
    mocks.remove.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => removed(path)),
      error: null,
    }))

    await flushAudioCleanup()

    expect(mocks.remove).toHaveBeenCalledTimes(3)
    expect(mocks.remove).toHaveBeenNthCalledWith(
      1,
      rows.slice(0, 50).map((row) => row.path),
    )
    expect(mocks.remove).toHaveBeenNthCalledWith(
      3,
      rows.slice(100).map((row) => row.path),
    )
    expect(mocks.deleteIn).toHaveBeenCalledTimes(3)
    expect(mocks.deleteIn).toHaveBeenNthCalledWith(
      1,
      'id',
      rows.slice(0, 50).map((row) => row.id),
    )
  })

  it('fallo parcial: las filas fallidas se quedan en la cola', async () => {
    const rows = [queueRow('id-1', 'agente-a/nota-1.webm'), queueRow('id-2', 'agente-a/nota-2.webm')]
    mocks.select.mockResolvedValue({ data: rows, error: null })
    // `remove` solo lista la primera ruta: la segunda falló.
    mocks.remove.mockResolvedValue({
      data: [removed('agente-a/nota-1.webm')],
      error: null,
    })

    await flushAudioCleanup()

    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.deleteIn).toHaveBeenCalledTimes(1)
    expect(mocks.deleteIn).toHaveBeenCalledWith('id', ['id-1'])
  })

  it('objeto que ya no existe: la fila se va', async () => {
    // El borrado en Storage es idempotente: `remove` lista la ruta
    // aunque el objeto ya no existiera.
    const rows = [queueRow('id-1', 'agente-a/nota-1.webm')]
    mocks.select.mockResolvedValue({ data: rows, error: null })
    mocks.remove.mockResolvedValue({
      data: [removed('agente-a/nota-1.webm')],
      error: null,
    })

    await flushAudioCleanup()

    expect(mocks.deleteIn).toHaveBeenCalledWith('id', ['id-1'])
  })

  it('si `remove` falla, el lote entero se queda para la próxima vez', async () => {
    const rows = [queueRow('id-1', 'agente-a/nota-1.webm')]
    mocks.select.mockResolvedValue({ data: rows, error: null })
    mocks.remove.mockResolvedValue({ data: null, error: { message: 'caído' } })

    await flushAudioCleanup()

    expect(mocks.deleteIn).not.toHaveBeenCalled()
  })

  it('si leer la cola falla, no lanza', async () => {
    mocks.select.mockResolvedValue({ data: null, error: { message: 'caído' } })

    await expect(flushAudioCleanup()).resolves.toBeUndefined()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('cola vacía: no hace nada', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null })

    await flushAudioCleanup()

    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.deleteIn).not.toHaveBeenCalled()
  })
})
