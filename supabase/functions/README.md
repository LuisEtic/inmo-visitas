# Edge Functions (Supabase)

En la Fase 1 **no hay ninguna Edge Function**.

Las funciones de servidor se crean en fases posteriores, por ejemplo:

- Transcripción con OpenAI Whisper (fases de captura).
- Extracción estructurada con Gemini 2.5 Flash (fases de extracción).

Las claves de IA solo viven aquí, en el servidor. Nunca en el cliente.

## `transcribe` (Fase 4)

Transcribe el audio de una nota de visita con Whisper y guarda el texto
en `visit_notes.transcript` (estado `transcribed`).

- Entrada: `POST` con cuerpo JSON `{ "visit_note_id": "<uuid>" }`.
- Autenticación: Supabase verifica el JWT por defecto. Dentro, la
  función crea el cliente con la clave anon y la cabecera
  `Authorization` de la petición: todas las lecturas y escrituras
  pasan por RLS como ese agente. **Nunca `service_role`.**
- Proveedor configurable por *secrets* (ya creados por Luis):
  - `TRANSCRIBE_API_URL` — en pruebas, Groq:
    `https://api.groq.com/openai/v1/audio/transcriptions`
  - `TRANSCRIBE_MODEL` — en pruebas, Groq: `whisper-large-v3-turbo`
  - `TRANSCRIBE_API_KEY` — clave del proveedor (nunca en el repo,
    ni en `.env`, ni en el HANDOFF)
- Cambiar de proveedor (p. ej. a OpenAI `whisper-1`) es cambiar solo
  los *secrets*, sin tocar el código.
- Si la nota ya está transcrita, responde con la transcripción
  existente sin gastar otra llamada. Si falta algún *secret* o el
  proveedor falla, responde 502 con el mensaje en español y la nota
  se queda en `draft`. La clave, la transcripción y el audio nunca
  aparecen en los logs ni en las respuestas de error.

### Desplegar sin CLI (la vía de este proyecto)

1. Supabase → Edge Functions → **Deploy a new function** →
   **Via Editor**.
2. Nombre de la función: `transcribe`.
3. Pegar el contenido completo de `supabase/functions/transcribe/index.ts`.
4. Comprobar que los tres *secrets* están en Supabase → Edge
   Functions → Secrets (`TRANSCRIBE_API_URL`, `TRANSCRIBE_MODEL`,
   `TRANSCRIBE_API_KEY`).
5. Deploy. La función queda en
   `https://<proyecto>.supabase.co/functions/v1/transcribe`.

### Desplegar con CLI

```bash
supabase functions deploy transcribe
```

### Comprobar que responde

Con el JWT de un agente (la función exige autenticación):

```bash
curl -X POST https://<proyecto>.supabase.co/functions/v1/transcribe \
  -H "Authorization: Bearer <jwt-del-agente>" \
  -H "Content-Type: application/json" \
  -d '{"visit_note_id": "<uuid-de-una-nota-de-voz>"}'
```

- Nota de otro agente → 404 `{ "error": "No encontrado" }`.
- Sin JWT → 401.
- Nota sin audio → 400.
- Proveedor caído o *secret* ausente → 502
  `{ "error": "No se ha podido transcribir. Inténtalo de nuevo." }`.
