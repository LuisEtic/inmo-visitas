import { describe, expect, it } from 'vitest'
import {
  emailHref,
  formatPhone,
  formatPriceEs,
  formatPricePlain,
  normalizeEmail,
  normalizePhone,
  parsePriceEs,
  telHref,
  whatsappHref,
  whatsappShareHref,
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
    expect(whatsappHref('12345', 'Hola')).toBeNull()
    expect(whatsappHref('', 'Hola')).toBeNull()
    expect(emailHref(null)).toBeNull()
    expect(emailHref('')).toBeNull()
  })

  it('mailto: con el email tal cual', () => {
    expect(emailHref('ana.garcia@gmail.com')).toBe('mailto:ana.garcia@gmail.com')
  })
})

describe('whatsappHref con texto (Fase 7)', () => {
  it('añade ?text= con el texto codificado', () => {
    expect(whatsappHref('+34612345678', 'Hola Ana, ¿qué tal?')).toBe(
      'https://wa.me/34612345678?text=Hola%20Ana%2C%20%C2%BFqu%C3%A9%20tal%3F',
    )
  })

  it('codifica saltos de línea, €, tildes, &, ? # y emojis', () => {
    const text = 'Hola Ana,\n¿te va bien el viernes a las 17h? Son 230.000 € & más #detalles? 😊'
    const href = whatsappHref('612345678', text)
    expect(href).not.toBeNull()
    expect(href?.startsWith('https://wa.me/34612345678?text=')).toBe(true)
    // Lo que va tras ?text= es el texto tal cual al decodificarlo.
    const encoded = href?.slice('https://wa.me/34612345678?text='.length) ?? ''
    expect(decodeURIComponent(encoded)).toBe(text)
    expect(href).toContain('%0A')
    expect(href).toContain('%E2%82%AC')
    expect(href).toContain('%26')
    expect(href).toContain('%3F')
    expect(href).toContain('%23')
  })

  it('sin texto, igual que en la Fase 3', () => {
    expect(whatsappHref('+34612345678', '')).toBe('https://wa.me/34612345678')
    expect(whatsappHref('+34612345678', undefined)).toBe(
      'https://wa.me/34612345678',
    )
  })

  it('aguanta un borrador de 1500 caracteres variados', () => {
    // 1500 caracteres mezclando letras con tildes, cifras, €, signos
    // y emojis (el texto más largo posible: un borrador aprobado).
    const chunk = 'Hola Ana, ¿te va el viernes a las 17h? 230.000 € & #piso? 😊\n'
    const text = chunk.repeat(25).slice(0, 1500)
    expect(text.length).toBe(1500)
    const href = whatsappHref('612345678', text)
    expect(href).not.toBeNull()
    const encoded = href?.slice('https://wa.me/34612345678?text='.length) ?? ''
    expect(decodeURIComponent(encoded)).toBe(text)
    // Cabe de sobra en los límites de los navegadores móviles.
    expect(href?.length ?? 0).toBeLessThan(8000)
  })
})

describe('whatsappShareHref (Fase 7)', () => {
  it('wa.me sin número, con el texto codificado', () => {
    expect(whatsappShareHref('Visita V-18')).toBe(
      'https://wa.me/?text=Visita%20V-18',
    )
    const href = whatsappShareHref('Hola,\n¿qué tal? 230.000 €')
    expect(decodeURIComponent(href.slice('https://wa.me/?text='.length))).toBe(
      'Hola,\n¿qué tal? 230.000 €',
    )
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

  it('la coma con 3 dígitos y sin punto es miles (teclado móvil)', () => {
    expect(parsePriceEs('285,000')).toBe(285000)
    expect(parsePriceEs('1,285,000')).toBe(1285000)
    expect(parsePriceEs('285,500')).toBe(285500)
    expect(parsePriceEs('285,50')).toBe(285.5)
  })

  it('rechaza lo que no es un precio válido', () => {
    for (const raw of ['', 'abc', '0', '-5', '230,000.50', '12,34,56', '10.000.000.000', '230.00', '285,000,50']) {
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

describe('formatPricePlain', () => {
  it('285000 → «285.000» (sin símbolo, para el campo)', () => {
    expect(formatPricePlain(285000)).toBe('285.000')
    expect(formatPricePlain(230000.5)).toBe('230.000,5')
  })
})
