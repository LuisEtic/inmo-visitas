# Encargados del tratamiento

> **BORRADOR — revisar con un profesional antes del piloto con datos
> reales.** La columna «DPA firmado» está vacía a propósito: no se
> afirma ningún acuerdo que no se haya comprobado. Donde pone
> «comprobar», hay que leer el documento del proveedor y anotar la
> fecha.

| Encargado | Servicio | Datos que trata | Ubicación | DPA firmado |
| --- | --- | --- | --- | --- |
| Supabase | Auth, base de datos (Postgres), Storage y Edge Functions | Todos los de la app (clientes, propietarios, notas, audios, tareas, borradores, exportaciones, registro de acciones) | UE (proyecto de pruebas: eu-central-1) | comprobar |
| Groq | Transcripción de voz (`transcribe`) | Audio de la nota y su transcripción | EE. UU. (Google Cloud), cláusulas tipo; ZDR disponible (comprobado 2026-11-13, `decisiones-piloto.md`) | comprobar |
| Google (Gemini) | Extracción de datos y borradores (`extract`, `drafts`) | Solo el texto de la nota (extracción) o categoría, nombre y valor de los datos no descartados más la referencia del inmueble (borradores) | Fuera de la UE (comprobar) | comprobar |
| GitHub Pages | Alojamiento de la app (staging temporal) | Ninguno (la app es estática; los datos viven en Supabase) | Fuera de la UE (comprobar) | comprobar |
| Hostinger / Coolify | Alojamiento de la app (producción prevista) | Ninguno (la app es estática; los datos viven en Supabase) | comprobar | comprobar |

## Notas

- **Revisión 2026-11-13:** la cuota gratuita de Gemini **no se puede
  usar** para usuarios del EEE; hay que activar la facturación antes
  de enseñar la app a un agente. Opciones de proveedor (A: Google de
  pago + Groq con ZDR; B: Mistral en la UE) en `decisiones-piloto.md`.

- **Proveedor de IA definitivo y plan de pago: (decide Luis).** En
  pruebas se usan los planes gratuitos de Groq y Gemini; antes del
  piloto hay que elegir proveedor y plan de pago con DPA, y decidir
  la base legal de la transferencia fuera de la UE.
- **Correo de Supabase:** el correo integrado de Auth solo permite 2
  emails por hora y solo a miembros del equipo; el SMTP propio es
  una decisión pendiente de Luis.
- **CRM (Inmovilla / Witei):** en pruebas la exportación es
  **simulada** (formato propio «inmo-visitas v1», no sale nada de
  Supabase). Con el CRM real, el CRM es destinatario de la ficha
  exportada (ver `registro-actividades.md`).
- **Subencargados:** comprobar en el DPA de cada proveedor quiénes
  son sus subencargados antes de firmar.
