/**
 * Límite diario de IA (Fase 8, migración 0012, tabla `ai_calls`).
 * Funciones puras: no tocan `Deno.env` ni la base. Copiada en cada
 * función de IA (no pueden compartir archivo hoy).
 */

/** Límite por defecto: 150 usos de IA al día por agente. */
export const DEFAULT_DAILY_LIMIT = 150

/** Mensaje del 429 cuando se llega al límite diario. */
export const DAILY_LIMIT_MESSAGE =
  'Has llegado al límite diario de usos de la IA. Vuelve a intentarlo mañana.'

/** Lee el secret `AI_DAILY_LIMIT`: entero ≥ 1, o 150 si falta o no vale. */
export function parseDailyLimit(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_DAILY_LIMIT
  }
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_DAILY_LIMIT
  }
  return parsed
}

/** Desplazamiento de Europe/Madrid respecto a UTC en un instante. */
function madridOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - at.getTime()
}

/**
 * Inicio del día actual en Europe/Madrid, como instante UTC. El
 * desplazamiento se toma a las 00:00 UTC, antes de los cambios de
 * hora (01:00 UTC, 02:00/03:00 en Madrid), así el cambio de hora no
 * mueve el inicio del día.
 */
export function madridDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const midnightUtc = Date.UTC(get('year'), get('month') - 1, get('day'))
  return new Date(midnightUtc - madridOffsetMs(new Date(midnightUtc)))
}
