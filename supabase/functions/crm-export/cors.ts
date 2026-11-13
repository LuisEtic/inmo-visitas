/**
 * CORS configurable (Fase 8, B-9). Los orígenes salen del secret
 * `ALLOWED_ORIGINS` (lista separada por comas). Si falta o queda
 * vacío, se usan los actuales. Función pura: no toca `Deno.env`.
 * Copiada en cada función (no pueden compartir archivo hoy).
 */

export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://luisetic.github.io',
] as const

export function allowedOrigins(
  env: (name: string) => string | undefined,
): Set<string> {
  const raw = env('ALLOWED_ORIGINS')
  if (raw === undefined) {
    return new Set(DEFAULT_ALLOWED_ORIGINS)
  }
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
  return origins.length > 0
    ? new Set(origins)
    : new Set(DEFAULT_ALLOWED_ORIGINS)
}
