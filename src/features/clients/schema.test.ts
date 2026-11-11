import { describe, expect, it } from 'vitest'
import { clientFormSchema } from './schema'

describe('clientFormSchema', () => {
  it('normaliza teléfono y email al guardar', () => {
    const parsed = clientFormSchema.safeParse({
      full_name: 'Irene Castro Vidal',
      phone: '612.34.56.78',
      email: 'Irene.Castro@Example.com',
      is_temporary: false,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.phone).toBe('+34612345678')
      expect(parsed.data.email).toBe('irene.castro@example.com')
    }
  })

  it('teléfono vacío → null, email vacío → null', () => {
    const parsed = clientFormSchema.safeParse({
      full_name: 'David Romero',
      phone: '',
      email: '',
      is_temporary: false,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.phone).toBeNull()
      expect(parsed.data.email).toBeNull()
    }
  })

  it('teléfono inválido (12345) no guarda y dice «Teléfono no válido»', () => {
    const parsed = clientFormSchema.safeParse({
      full_name: 'Ana García',
      phone: '12345',
      email: 'ana.garcia@gmail.com',
      is_temporary: false,
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const phoneIssue = parsed.error.issues.find((issue) => issue.path[0] === 'phone')
      expect(phoneIssue?.message).toBe('Teléfono no válido')
    }
  })

  it('nombre obligatorio y con límites', () => {
    expect(
      clientFormSchema.safeParse({
        full_name: 'A',
        phone: '',
        email: '',
        is_temporary: false,
      }).success,
    ).toBe(false)
    expect(
      clientFormSchema.safeParse({
        full_name: '  Ana García  ',
        phone: '',
        email: '',
        is_temporary: false,
      }).success,
    ).toBe(true)
  })
})
