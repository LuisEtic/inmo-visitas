import { describe, expect, it } from 'vitest'
import { matchesClientQuery, matchesPropertyQuery } from '../lib/search'

const ANA = {
  id: '1',
  agent_id: 'a',
  full_name: 'Ana García',
  phone: '+34 612 345 678',
  email: 'ana.garcia@gmail.com',
  is_temporary: false,
  created_at: '',
}

const V07 = {
  id: '7',
  agent_id: 'a',
  reference: 'V-07',
  address: 'Calle Goya 88',
  city: 'Madrid',
  price: 310000,
  owner_name: 'Javier López',
  owner_phone: '+34 611 100 202',
  status: 'reservado' as const,
  created_at: '',
}

describe('matchesClientQuery', () => {
  it('«garcia» encuentra a «Ana García» (sin tildes ni mayúsculas)', () => {
    expect(matchesClientQuery(ANA, 'garcia')).toBe(true)
    expect(matchesClientQuery(ANA, 'GARCÍA')).toBe(true)
    expect(matchesClientQuery(ANA, 'Ana')).toBe(true)
  })

  it('busca por teléfono (con o sin formato) y por email', () => {
    expect(matchesClientQuery(ANA, '612345678')).toBe(true)
    expect(matchesClientQuery(ANA, '612 34 56 78')).toBe(true)
    expect(matchesClientQuery(ANA, 'ana.garcia@gmail.com')).toBe(true)
  })

  it('no coincide con otros textos', () => {
    expect(matchesClientQuery(ANA, 'pedro')).toBe(false)
    expect(matchesClientQuery(ANA, '999')).toBe(false)
  })
})

describe('matchesPropertyQuery', () => {
  it('busca por referencia, dirección, ciudad y propietario', () => {
    expect(matchesPropertyQuery(V07, 'V-07')).toBe(true)
    expect(matchesPropertyQuery(V07, 'goya')).toBe(true)
    expect(matchesPropertyQuery(V07, 'Madrid')).toBe(true)
    expect(matchesPropertyQuery(V07, 'javier lopez')).toBe(true)
  })

  it('no coincide con otros textos', () => {
    expect(matchesPropertyQuery(V07, 'V-18')).toBe(false)
    expect(matchesPropertyQuery(V07, 'Toledo')).toBe(false)
  })
})
