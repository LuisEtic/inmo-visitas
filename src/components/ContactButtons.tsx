import { emailHref, formatPhone, telHref, whatsappHref } from '../lib/contact'

/**
 * Botones de contacto (Fase 3, decisión de contacto).
 * Cada botón aparece solo si hay dato. «Llamar» abre el marcador (`tel:`),
 * «WhatsApp» abre el chat (`wa.me`) sin texto precargado y «Email» abre el
 * correo (`mailto:`). La app no llama ni envía nada por sí misma.
 * Todos los objetivos táctiles miden 44 px como mínimo.
 */

const contactButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface'

export function ContactButtons({
  phone,
  email,
}: {
  phone: string | null | undefined
  email?: string | null | undefined
}) {
  const tel = telHref(phone)
  const whatsapp = whatsappHref(phone)
  const mail = email === undefined ? null : emailHref(email)
  if (tel === null && whatsapp === null && mail === null) {
    return null
  }
  return (
    <div className="flex flex-wrap gap-2">
      {tel !== null && (
        <a href={tel} className={contactButtonClass}>
          Llamar
        </a>
      )}
      {whatsapp !== null && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className={contactButtonClass}
        >
          WhatsApp
        </a>
      )}
      {mail !== null && (
        <a href={mail} className={contactButtonClass}>
          Email
        </a>
      )}
    </div>
  )
}

/** Teléfono formateado para mostrar, o nada si no hay dato. */
export function PhoneText({ phone }: { phone: string | null | undefined }) {
  if (phone === null || phone === undefined || phone.trim() === '') {
    return null
  }
  return <>{formatPhone(phone)}</>
}
