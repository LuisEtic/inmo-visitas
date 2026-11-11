import { describe, expect, it } from 'vitest'
import { propertyFormSchema } from './schema'

describe('propertyFormSchema', () => {
  it('normaliza el ejemplo de la especificación', () => {
    const parsed = propertyFormSchema.safeParse({
      reference: 'v-52',
      address: 'Calle de Bravo Murillo 214, 3.º B',
      city: 'Madrid',
      price: '285.000',
      owner_name: 'Rafael Gil Moreno',
      owner_phone: '+34 699 11 22 33',
      status: 'disponible',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.reference).toBe('V-52')
      expect(parsed.data.price).toBe(285000)
      expect(parsed.data.owner_phone).toBe('+34699112233')
    }
  })

  it('rechaza referencias con formato no válido', () => {
    for (const reference of ['', 'v 52', 'v_52', 'V-52!']) {
      const parsed = propertyFormSchema.safeParse({
        reference,
        address: 'Calle de Bravo Murillo 214',
        city: 'Madrid',
        price: '285.000',
        owner_name: 'Rafael Gil Moreno',
        owner_phone: '',
        status: 'disponible',
      })
      expect(parsed.success, `referencia «${reference}»`).toBe(false)
    }
  })

  it('precio inválido no guarda', () => {
    const parsed = propertyFormSchema.safeParse({
      reference: 'V-52',
      address: 'Calle de Bravo Murillo 214',
      city: 'Madrid',
      price: 'abc',
      owner_name: 'Rafael Gil Moreno',
      owner_phone: '',
      status: 'disponible',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const priceIssue = parsed.error.issues.find((issue) => issue.path[0] === 'price')
      expect(priceIssue?.message).toBe('Precio no válido')
    }
  })
})
