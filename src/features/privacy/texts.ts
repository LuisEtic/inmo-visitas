/**
 * Textos de privacidad (Fase 8).
 *
 * BORRADOR — texto provisional para que Luis lo revise (y lo revise
 * con un profesional) antes del piloto con datos reales. Luis puede
 * editarlo aquí sin tocar las pantallas.
 */

export const PRIVACY_TEXTS = {
  title: 'Privacidad',
  draftNotice:
    'BORRADOR — texto provisional, pendiente de revisión con un profesional.',
  paragraphs: [
    'La app guarda tus notas de visita (texto y audio), los datos extraídos de cada nota con su cita, las tareas, los borradores y las exportaciones. También guarda los datos de contacto de tus clientes (nombre, teléfono y email) y de los propietarios (nombre y teléfono), y los datos de los inmuebles.',
    'Los textos salen de Supabase (Unión Europea) hacia los proveedores de IA: la transcripción va al proveedor de transcripción (en pruebas, Groq) y la extracción y los borradores van al proveedor de lenguaje (en pruebas, Google Gemini). A la IA solo se envía lo necesario para cada tarea, nunca tus claves ni datos de otros agentes.',
    'El audio se borra al aprobar la nota: una vez aprobada, la fuente es la transcripción revisada y el audio ya no hace falta.',
    'Tienes derecho a que se borren tus datos y a recibir una copia: en la ficha de cada cliente, «Borrar cliente y todos sus datos» y «Descargar sus datos». Lo que ya enviaste por WhatsApp o exportaste al CRM hay que borrarlo allí: la app no puede borrarlo por ti.',
  ],
  actionsLinkLabel: 'Mis acciones de privacidad',
  actionsIntro:
    'Acciones de privacidad que has hecho en la app (borrados y entregas de datos). No se guardan nombres ni textos, solo la acción y la fecha.',
}
