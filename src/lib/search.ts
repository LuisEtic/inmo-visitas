import type { ClientRow, PropertyRow } from './database.types'
import { digitsOnly, normalizeForSearch } from './utils'

/**
 * Coincidencia de la búsqueda de clientes (nombre, teléfono, email), sin
 * distinguir mayúsculas ni tildes. El teléfono se compara por dígitos, así
 * que «612345678» encuentra «+34 612 345 678».
 */
export function matchesClientQuery(client: ClientRow, query: string): boolean {
  const needle = normalizeForSearch(query)
  if (needle === '') {
    return true
  }
  const digits = digitsOnly(query)
  const haystack = normalizeForSearch(
    [client.full_name, client.email ?? ''].join(' '),
  )
  return (
    haystack.includes(needle) ||
    (digits.length > 0 && digitsOnly(client.phone ?? '').includes(digits))
  )
}

/**
 * Coincidencia de la búsqueda de inmuebles (referencia, dirección, ciudad,
 * propietario), sin distinguir mayúsculas ni tildes.
 */
export function matchesPropertyQuery(property: PropertyRow, query: string): boolean {
  const needle = normalizeForSearch(query)
  if (needle === '') {
    return true
  }
  const haystack = normalizeForSearch(
    [
      property.reference,
      property.address,
      property.city,
      property.owner_name,
    ].join(' '),
  )
  return haystack.includes(needle)
}
