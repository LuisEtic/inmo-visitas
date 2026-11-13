/**
 * Confirmación de borrado de un cliente con notas (Fase 8, ajuste de la
 * revisión): el nombre escrito vale si coincide con el del cliente sin
 * contar los espacios de los extremos, los espacios repetidos ni las
 * mayúsculas. En el móvil el teclado suele añadir un espacio al final o
 * poner la primera letra en mayúscula, y eso no debe bloquear el botón.
 * Las tildes sí cuentan: «Garcia» no confirma a «García».
 */
function normalizeName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

export function matchesConfirmName(typed: string, fullName: string): boolean {
  const expected = normalizeName(fullName)
  return expected !== '' && normalizeName(typed) === expected
}
