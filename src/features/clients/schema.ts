import { z } from 'zod'
import { normalizeEmail, normalizePhone } from '../../lib/contact'
import type { ClientRow } from '../../lib/database.types'

/**
 * Esquemas Zod de clientes (Fase 3).
 * El esquema del formulario recibe los valores tal como se escriben y
 * devuelve los valores normalizados listos para guardar: teléfono en
 * E.164 (`+34…`) o null si está vacío, email en minúsculas o null.
 */

const phoneField = z.string().transform((raw, ctx) => {
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

const emailField = z.string().transform((raw, ctx) => {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return null
  }
  try {
    return normalizeEmail(trimmed)
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Email no válido' })
    return z.NEVER
  }
})

export const clientFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Introduce el nombre completo.')
    .max(120, 'El nombre no puede tener más de 120 caracteres.'),
  phone: phoneField,
  email: emailField,
  is_temporary: z.boolean(),
})

export type ClientFormValues = z.output<typeof clientFormSchema>

export const clientRowSchema = z.object({
  id: z.string(),
  agent_id: z.string().nullable(),
  full_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  is_temporary: z.boolean(),
  created_at: z.string(),
})

export type Client = ClientRow
