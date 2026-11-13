/**
 * Ventana en blanco abierta en el gesto del usuario (Fase 9, B-8;
 * ajuste de la revisión de Claude).
 *
 * Safari de iOS bloquea un `window.open` que llega después de un
 * `await`. Por eso la ventana se abre ANTES del `await`, en blanco, y
 * se le asigna la URL después.
 *
 * No se pasa `'noopener'`: con esa opción, `window.open` devuelve
 * SIEMPRE `null` (especificación HTML, comprobado en Chromium) y no
 * habría ventana a la que asignar la URL. Se anula `opener` a mano en
 * cuanto se abre, que da la misma protección (la página de destino no
 * puede tocar esta).
 *
 * Devuelve `null` si `wanted` es falso o si el navegador bloquea la
 * ventana; entonces queda el enlace de respaldo en pantalla.
 */
export function openBlankWindow(
  wanted: boolean,
  open: (url: string, target: string) => Window | null = (url, target) =>
    window.open(url, target),
): Window | null {
  if (!wanted) {
    return null
  }
  const opened = open('', '_blank')
  if (opened !== null) {
    try {
      opened.opener = null
    } catch {
      // Algún navegador no deja escribir `opener`: se sigue igual.
    }
  }
  return opened
}
