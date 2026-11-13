import { describe, expect, it } from 'vitest'
import { allowedOrigins, DEFAULT_ALLOWED_ORIGINS } from './cors'

function envWith(value: string | undefined) {
  return (_name: string) => value
}

describe('allowedOrigins', () => {
  it('sin secret: los tres orígenes actuales', () => {
    expect([...allowedOrigins(envWith(undefined))]).toEqual([
      ...DEFAULT_ALLOWED_ORIGINS,
    ])
  })

  it('lista separada por comas, con espacios', () => {
    expect([
      ...allowedOrigins(
        envWith('https://a.example.com, http://localhost:3000 '),
      ),
    ]).toEqual(['https://a.example.com', 'http://localhost:3000'])
  })

  it('secret vacío o solo comas: los valores por defecto', () => {
    expect([...allowedOrigins(envWith(''))]).toEqual([
      ...DEFAULT_ALLOWED_ORIGINS,
    ])
    expect([...allowedOrigins(envWith(' , , '))]).toEqual([
      ...DEFAULT_ALLOWED_ORIGINS,
    ])
  })

  it('un solo origen', () => {
    expect([
      ...allowedOrigins(envWith('https://visitas.agencia.com')),
    ]).toEqual(['https://visitas.agencia.com'])
  })

  it('un origen no listado no está en el conjunto', () => {
    const origins = allowedOrigins(
      envWith('https://visitas.agencia.com'),
    )
    expect(origins.has('https://luisetic.github.io')).toBe(false)
    expect(origins.has('https://visitas.agencia.com')).toBe(true)
  })
})
