import { z } from 'zod'

/**
 * Normalizadores y enlaces de contacto (Fase 3, decisión de contacto).
 * Funciones puras: no tocan la red ni la base de datos.
 *
 * Reglas (cerradas con Luis el 2026-11-11):
 * - El teléfono se guarda normalizado en E.164 (`+34612345678`) y el email
 *   en minúsculas. La validación es al guardar, en el frontend con Zod.
 * - Sin restricción en la base de datos en esta fase: los datos antiguos
 *   con otro formato (el seed, `+34 611 100 200`) se aceptan al leer, se
 *   muestran formateados y se normalizan cuando se edita y guarda la ficha.
 * - Los botones solo aparecen si hay dato. WhatsApp solo abre el chat con
 *   `wa.me`, sin texto precargado: no envía nada (eso es la Fase 7).
 */

const PHONE_ERROR = 'Teléfono no válido'
const EMAIL_ERROR = 'Email no válido'

/** Quita espacios, puntos, guiones y paréntesis de un teléfono. */
function stripPhoneSeparators(raw: string): string {
  return raw.replace(/[\s.\-()]/g, '')
}

/**
 * Normaliza un teléfono a E.164.
 * - 9 dígitos que empiezan por 6, 7, 8 o 9 → `+34XXXXXXXXX`.
 * - Con prefijo `+34` o `0034` + 9 dígitos → `+34XXXXXXXXX`.
 * - Otro `+` con 8–15 dígitos → se guarda tal cual (E.164 extranjero).
 * - Cualquier otra cosa → lanza Error(PHONE_ERROR).
 */
export function normalizePhone(raw: string): string {
  const cleaned = stripPhoneSeparators(raw.trim())
  if (cleaned === '') {
    throw new Error(PHONE_ERROR)
  }
  if (/^[6789]\d{8}$/.test(cleaned)) {
    return `+34${cleaned}`
  }
  if (cleaned.startsWith('0034')) {
    const rest = cleaned.slice(4)
    if (/^\d{9}$/.test(rest)) {
      return `+34${rest}`
    }
    throw new Error(PHONE_ERROR)
  }
  if (cleaned.startsWith('+34')) {
    const rest = cleaned.slice(3)
    if (/^\d{9}$/.test(rest)) {
      return `+34${rest}`
    }
    throw new Error(PHONE_ERROR)
  }
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return cleaned
  }
  throw new Error(PHONE_ERROR)
}

/**
 * Formatea un teléfono para mostrarlo.
 * `+34612345678` → `612 34 56 78`. Acepta también los teléfonos del seed
 * (`+34 611 100 200`). Los extranjeros se muestran tal cual.
 */
export function formatPhone(phone: string): string {
  const cleaned = stripPhoneSeparators(phone.trim())
  const match = /^\+34([6789]\d{8})$/.exec(cleaned)
  if (match === null) {
    return phone.trim()
  }
  const digits = match[1]
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`
}

/**
 * Normaliza un email: recorta y pasa a minúsculas; valida el formato.
 * Lanza Error(EMAIL_ERROR) si no es válido.
 */
export function normalizeEmail(raw: string): string {
  const cleaned = raw.trim().toLowerCase()
  const parsed = z.email().safeParse(cleaned)
  if (!parsed.success) {
    throw new Error(EMAIL_ERROR)
  }
  return cleaned
}

/**
 * Enlace `tel:` para un teléfono, o `null` si no hay dato o no es válido.
 * Acepta también teléfonos sin normalizar (seed).
 */
export function telHref(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined || phone.trim() === '') {
    return null
  }
  try {
    return `tel:${normalizePhone(phone)}`
  } catch {
    return null
  }
}

/**
 * Enlace `https://wa.me/…` para un teléfono, o `null` si no hay dato o no
 * es válido. Solo dígitos, sin `+`, sin espacios. Acepta también teléfonos
 * sin normalizar (seed). Solo abre el chat: no envía texto (Fase 7).
 */
export function whatsappHref(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined || phone.trim() === '') {
    return null
  }
  try {
    const normalized = normalizePhone(phone)
    return `https://wa.me/${normalized.slice(1)}`
  } catch {
    return null
  }
}

/**
 * Enlace `mailto:` para un email, o `null` si no hay dato.
 * No valida el formato: el email ya se validó al guardar.
 */
export function emailHref(email: string | null | undefined): string | null {
  if (email === null || email === undefined || email.trim() === '') {
    return null
  }
  return `mailto:${email.trim()}`
}

const MAX_PRICE = 9999999999.99

/**
 * Interpreta un precio escrito en formato español.
 * `230.000` → 230000; `230000` → 230000; `230.000,50` → 230000.5.
 * El punto es separador de miles y la coma, decimal. Debe ser > 0 y
 * ≤ 9.999.999.999,99 (`numeric(12,2)`). Lanza Error si no es válido.
 */
export function parsePriceEs(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '')
  if (cleaned === '') {
    throw new Error('Precio no válido')
  }
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(cleaned) && !/^\d+(,\d{1,2})?$/.test(cleaned)) {
    throw new Error('Precio no válido')
  }
  const [integerPart, decimalPart] = cleaned.split(',')
  const integer = Number(integerPart.replace(/\./g, ''))
  const value =
    decimalPart === undefined ? integer : integer + Number(`0.${decimalPart}`)
  if (!Number.isFinite(value) || value <= 0 || value > MAX_PRICE) {
    throw new Error('Precio no válido')
  }
  return value
}

/** Formatea un precio en euros con formato español: 230000 → «230.000 €». */
export function formatPriceEs(value: number): string {
  // Intl usa un espacio de no separación antes de €; se normaliza a un
  // espacio normal para que el texto sea el de la especificación.
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\u00A0/g, ' ')
}
