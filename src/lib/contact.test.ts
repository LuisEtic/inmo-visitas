import { describe, expect, it } from 'vitest'
import {
  emailHref,
  formatPhone,
  formatPriceEs,
  normalizeEmail,
  normalizePhone,
  parsePriceEs,
  telHref,
  whatsappHref,
} from './contact'

describe('normalizePhone', () => {
  it('9 dígitos que empiezan por 6, 7, 8 o 9 → +34', () => {
    expect(normalizePhone('612345678')).toBe('+34612345678')
    expect(normalizePhone('699 11 22 33')).toBe('+34699112233')
    expect(normalizePhone('612.34.56.78')).toBe('+34612345678')
    expect(normalizePhone('612-34-56-78')).toBe('+34612345678')
    expect(normalizePhone('(612) 345 678')).toBe('+34612345678')
    expect(normalizePhone('755123456')).toBe('+34755123456')
    expect(normalizePhone('855123456')).toBe('+34855123456')
    expect(normalizePhone('955123456')).toBe('+34955123456')
  })

  it('con prefijo +34 o 0034 → +34', () => {
    expect(normalizePhone('+34612345678')).toBe('+34612345678')
    expect(normalizePhone('+34 612 345 678')).toBe('+34612345678')
    expect(normalizePhone('0034612345678')).toBe('+34612345678')
    expect(normalizePhone('0034 612 345 678')).toBe('+34612345678')
  })

  it('teléfonos del seed con otro formato se normalizan', () => {
    expect(normalizePhone('+34 611 100 200')).toBe('+34611100200')
    expect(normalizePhone('+34 612 345 678')).toBe('+34612345678')
  })

  it('extranjeros en E.164 se guardan tal cual', () => {
    expect(normalizePhone('+33612345678')).toBe('+33612345678')
    expect(normalizePhone('+442071234567')).toBe('+442071234567')
  })

  it('cualquier otra cosa → error «Teléfono no válido»', () => {
    for (const raw of ['', '12345', '512345678', '61234567', '6123456789', '+34', '0034', 'abc', '+34 612 345', '+34123456789', '0034512345678']) {
      expect(() => normalizePhone(raw)).toThrow('Teléfono no válido')
    }
  })
})

describe('formatPhone', () => {
  it('+34612345678 → 612 34 56 78', () => {
    expect(formatPhone('+34612345678')).toBe('612 34 56 78')
    expect(formatPhone('+34699112233')).toBe('699 11 22 33')
  })

  it('acepta los teléfonos del seed', () => {
    expect(formatPhone('+34 611 100 200')).toBe('611 10 02 00')
    expect(formatPhone('+34 612 345 678')).toBe('612 34 56 78')
  })

  it('los extranjeros se muestran tal cual', () => {
    expect(formatPhone('+33612345678')).toBe('+33612345678')
  })
})

describe('normalizeEmail', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(normalizeEmail('Irene.Castro@Example.com')).toBe('irene.castro@example.com')
    expect(normalizeEmail('  ANA@GMAIL.COM  ')).toBe('ana@gmail.com')
  })

  it('rechaza emails sin formato válido', () => {
    for (const raw of ['', 'no-es-un-email', 'ana@', '@gmail.com', 'ana gmail.com']) {
      expect(() => normalizeEmail(raw)).toThrow('Email no válido')
    }
  })
})

describe('telHref / whatsappHref / emailHref', () => {
  it('tel: con el teléfono normalizado', () => {
    expect(telHref('+34612345678')).toBe('tel:+34612345678')
    expect(telHref('612.34.56.78')).toBe('tel:+34612345678')
  })

  it('wa.me solo con dígitos, sin + ni espacios', () => {
    expect(whatsappHref('+34612345678')).toBe('https://wa.me/34612345678')
    expect(whatsappHref('612.34.56.78')).toBe('https://wa.me/34612345678')
    expect(whatsappHref('+33612345678')).toBe('https://wa.me/33612345678')
  })

  it('aceptan teléfonos del seed sin normalizar', () => {
    expect(telHref('+34 611 100 200')).toBe('tel:+34611100200')
    expect(whatsappHref('+34 611 100 200')).toBe('https://wa.me/34611100200')
  })

  it('devuelven null si no hay dato o no es válido', () => {
    expect(telHref(null)).toBeNull()
    expect(telHref(undefined)).toBeNull()
    expect(telHref('')).toBeNull()
    expect(telHref('12345')).toBeNull()
    expect(whatsappHref(null)).toBeNull()
    expect(whatsappHref('12345')).toBeNull()
    expect(emailHref(null)).toBeNull()
    expect(emailHref('')).toBeNull()
  })

  it('mailto: con el email tal cual', () => {
    expect(emailHref('ana.garcia@gmail.com')).toBe('mailto:ana.garcia@gmail.com')
  })
})

describe('parsePriceEs', () => {
  it('interpreta el formato español', () => {
    expect(parsePriceEs('230.000')).toBe(230000)
    expect(parsePriceEs('230000')).toBe(230000)
    expect(parsePriceEs('230.000,50')).toBe(230000.5)
    expect(parsePriceEs('285.000')).toBe(285000)
    expect(parsePriceEs('1.234.567,89')).toBe(1234567.89)
    expect(parsePriceEs(' 230.000 ')).toBe(230000)
  })

  it('rechaza lo que no es un precio válido', () => {
    for (const raw of ['', 'abc', '0', '-5', '230,000.50', '12,34,56', '10.000.000.000', '230.00']) {
      expect(() => parsePriceEs(raw)).toThrow('Precio no válido')
    }
  })

  it('acepta el máximo de numeric(12,2)', () => {
    expect(parsePriceEs('9.999.999.999,99')).toBe(9999999999.99)
    expect(() => parsePriceEs('10.000.000.000')).toThrow('Precio no válido')
  })
})

describe('formatPriceEs', () => {
  it('230000 → «230.000 €»', () => {
    expect(formatPriceEs(230000)).toBe('230.000 €')
    expect(formatPriceEs(285000)).toBe('285.000 €')
    expect(formatPriceEs(620000)).toBe('620.000 €')
  })
})
