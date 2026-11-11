import { z } from 'zod'
import { normalizePhone, parsePriceEs } from '../../lib/contact'
import type { PropertyRow, PropertyStatus } from '../../lib/database.types'
import { normalizeReference } from './reference'

/**
 * Esquemas Zod de inmuebles (Fase 3).
 * El esquema del formulario recibe los valores tal como se escriben y
 * devuelve los valores normalizados listos para guardar: referencia en
 * mayúsculas, precio en número, teléfono del propietario en E.164 o null.
 */

const ownerPhoneField = z.string().transform((raw, ctx) => {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return null
  }
  try {
    return normalizePhone(trimmed)
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Teléfono no válido' })
    return z.NEVER
  }
})

const priceField = z.string().transform((raw, ctx) => {
  try {
    return parsePriceEs(raw)
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Precio no válido. Escribe 285000 o 285.000.' })
    return z.NEVER
  }
})

export const PROPERTY_STATUSES: PropertyStatus[] = ['disponible', 'reservado', 'vendido']

/** Texto visible de cada estado (lista y ficha usan el mismo). */
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
}

export const propertyFormSchema = z.object({
  reference: z
    .string()
    .transform((raw) => normalizeReference(raw))
    .pipe(
      z
        .string()
        .min(1, 'Introduce la referencia.')
        .max(20, 'La referencia no puede tener más de 20 caracteres.')
        .regex(
          /^[A-Z0-9][A-Z0-9-]*$/,
          'La referencia solo admite letras, números y guiones.',
        ),
    ),
  address: z
    .string()
    .trim()
    .min(3, 'Introduce la dirección.')
    .max(200, 'La dirección no puede tener más de 200 caracteres.'),
  city: z
    .string()
    .trim()
    .min(1, 'Introduce la ciudad.')
    .max(200, 'La ciudad no puede tener más de 200 caracteres.'),
  price: priceField,
  owner_name: z
    .string()
    .trim()
    .min(2, 'Introduce el nombre del propietario.')
    .max(120, 'El nombre no puede tener más de 120 caracteres.'),
  owner_phone: ownerPhoneField,
  status: z.enum(['disponible', 'reservado', 'vendido']),
})

export type PropertyFormValues = z.output<typeof propertyFormSchema>

export const propertyRowSchema = z.object({
  id: z.string(),
  agent_id: z.string().nullable(),
  reference: z.string(),
  address: z.string(),
  city: z.string(),
  price: z.number(),
  owner_name: z.string(),
  owner_phone: z.string().nullable(),
  status: z.enum(['disponible', 'reservado', 'vendido']),
  created_at: z.string(),
})

export type Property = PropertyRow
