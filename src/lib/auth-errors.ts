/**
 * Traduce a español los errores más habituales de Supabase Auth.
 * Los mensajes originales vienen en inglés; al agente se le muestran
 * siempre en español. Lo que no se reconoce, mensaje genérico.
 */
export function mapAuthErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Credenciales incorrectas. Revisa el email y la contraseña.'
  }
  if (message.includes('User already registered')) {
    return 'Este email ya está registrado. Prueba a entrar con tu contraseña.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Tienes que confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.'
  }
  if (message.includes('only request this once every')) {
    return 'Por seguridad, solo puedes pedir un enlace cada 60 segundos. Espera un poco y vuelve a intentarlo.'
  }
  if (message.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }
  if (message.includes('Unable to validate email address')) {
    return 'Ese email no parece válido. Revísalo e inténtalo de nuevo.'
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}
