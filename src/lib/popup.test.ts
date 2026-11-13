import { describe, expect, it, vi } from 'vitest'
import { openBlankWindow } from './popup'

describe('openBlankWindow (B-8)', () => {
  it('sin destino WhatsApp no abre nada', () => {
    const open = vi.fn()
    expect(openBlankWindow(false, open)).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  it('abre en blanco SIN noopener (con él devolvería null) y anula opener', () => {
    const fake = { opener: {} } as unknown as Window
    const open = vi.fn(() => fake)
    expect(openBlankWindow(true, open)).toBe(fake)
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(open.mock.calls[0]).toHaveLength(2)
    expect(fake.opener).toBeNull()
  })

  it('si el navegador bloquea la ventana devuelve null (queda el enlace)', () => {
    expect(openBlankWindow(true, () => null)).toBeNull()
  })
})
