import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza un texto para buscar sin distinguir mayúsculas ni tildes:
 * «García» y «garcia» coinciden. También quita los espacios sobrantes.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Deja solo los dígitos de un texto (para buscar por teléfono). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}
