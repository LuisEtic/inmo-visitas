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

## `extract` (Fase 5)

Extrae datos estructurados de una nota de visita con un modelo de
lenguaje por la API de chat compatible con OpenAI y guarda los datos
en `extracted_facts` (estado `extracted`).

- Entrada: `POST` con cuerpo JSON `{ "visit_note_id": "<uuid>" }`.
- Autenticación: Supabase verifica el JWT por defecto. Dentro, la
  función crea el cliente con la clave anon y la cabecera
  `Authorization` de la petición: todas las lecturas y escrituras
  pasan por RLS como ese agente. **Nunca `service_role`.**
- Al modelo solo se envía el texto de la nota (`transcript` o
  `raw_text`). Ni teléfonos, ni emails, ni el nombre del propietario,
  ni el precio del inmueble. Las reglas (`rules.ts`) mandan sobre la
  IA: se descarta todo dato cuya cita no aparezca literalmente en el
  texto y todo campo sensible del art. 9 RGPD.
- Proveedor configurable por *secrets* (los crea Luis):
  - `EXTRACT_API_URL` — en pruebas, Gemini por su API compatible con
    OpenAI:
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
  - `EXTRACT_MODEL` — en pruebas, el modelo Flash vigente que muestre
    Google AI Studio (los nombres cambian a menudo)
  - `EXTRACT_API_KEY` — clave del proveedor (nunca en el repo,
    ni en `.env`, ni en el HANDOFF)
- Cambiar de proveedor es cambiar solo los *secrets*, sin tocar el
  código.
- Solo admite notas en `transcribed`, o en `extracted` sin datos
  revisados («Volver a extraer»). Cualquier otro estado → 409
  `{ "error": "La nota ya está en revisión" }`.
- Si falta algún *secret* o el proveedor falla, responde 502 con el
  mensaje en español y la nota no cambia. La clave, el texto de la
  nota, los datos y la respuesta del modelo nunca aparecen en los
  logs ni en las respuestas de error.

### Redespliegue tras la revisión de la Fase 5 (2026-11-12)

La revisión de Claude cambió `index.ts` (dos frases del `SYSTEM_PROMPT`)
y `rules.ts` (cita mínima de 2 palabras y 8 caracteres; datos sensibles
también por el valor). Hay que **volver a desplegar `extract`** con los
dos archivos actualizados (mismos pasos de abajo: editar la función
existente y pegar ambos). Los *secrets* no cambian.

### Desplegar sin CLI (la vía de este proyecto)

La función tiene **dos archivos** (`index.ts` y `rules.ts`): hay que
subir los dos, con `index.ts` como archivo principal.

1. Supabase → Edge Functions → **Deploy a new function** →
   **Via Editor**.
2. Nombre de la función: `extract`.
3. Pegar el contenido completo de `supabase/functions/extract/index.ts`
   como `index.ts`.
4. Añadir un archivo `rules.ts` en la misma función y pegar el
   contenido completo de `supabase/functions/extract/rules.ts`
   (`index.ts` lo importa como `./rules.ts`).
5. Comprobar que los tres *secrets* están en Supabase → Edge
   Functions → Secrets (`EXTRACT_API_URL`, `EXTRACT_MODEL`,
   `EXTRACT_API_KEY`).
6. Deploy. La función queda en
   `https://<proyecto>.supabase.co/functions/v1/extract`.

### Desplegar con CLI

```bash
supabase functions deploy extract
```

(La CLI sube la carpeta completa, con los dos archivos.)

### Comprobar que responde

Con el JWT de un agente (la función exige autenticación):

```bash
curl -X POST https://<proyecto>.supabase.co/functions/v1/extract \
  -H "Authorization: Bearer <jwt-del-agente>" \
  -H "Content-Type: application/json" \
  -d '{"visit_note_id": "<uuid-de-una-nota-transcrita>"}'
```

- Nota de otro agente → 404 `{ "error": "No encontrado" }`.
- Sin JWT → 401.
- Nota ya en revisión → 409
  `{ "error": "La nota ya está en revisión" }`.
- Nota sin texto → 400.
- Proveedor caído o *secret* ausente → 502
  `{ "error": "No se han podido extraer los datos. Inténtalo de nuevo." }`.

## `drafts` (Fase 6)

Prepara el seguimiento de una nota aprobada: un borrador para el
comprador, otro para el propietario y las tareas propuestas, con un
modelo de lenguaje por la API de chat compatible con OpenAI. Guarda
los borradores en `drafts` (estado `borrador`) y las tareas en `tasks`
(estado `propuesta`, `origin` `ia` o `regla`).

- Entrada: `POST` con cuerpo JSON `{ "visit_note_id": "<uuid>" }` (los
  dos borradores y las tareas) o `{ "visit_note_id": "<uuid>",
  "audience": "comprador" | "propietario" }` (solo regenerar ese
  borrador, «Volver a generar»).
- Autenticación: Supabase verifica el JWT por defecto. Dentro, la
  función crea el cliente con la clave anon y la cabecera
  `Authorization` de la petición: todas las lecturas y escrituras
  pasan por RLS como ese agente. **Nunca `service_role`.**
- Al modelo solo se envían la categoría, el nombre y el valor de los
  datos no descartados, más la referencia del inmueble. Ni nombres,
  ni teléfonos, ni la dirección, ni el precio. El borrador al
  propietario sale de una llamada aparte SIN presupuesto ni finanzas
  (`ownerFacts` en `rules.ts`). Las reglas mandan sobre la IA: el
  borrador al propietario nunca filtra presupuesto ni el nombre del
  cliente, ningún borrador da por confirmada una cita ni inventa una
  hora, y cada cita pendiente tiene su tarea de confirmar (la añade la
  regla si la IA no la propuso). Un borrador rechazado se reintenta
  UNA vez; si vuelve a fallar → 422 y ese borrador no se guarda (el
  otro, si pasó, sí se guarda).
- Proveedor configurable por *secrets*, con fallback a los de
  `extract` si falta alguno (no hay *secrets* nuevos que crear):
  - `DRAFT_API_URL` → `EXTRACT_API_URL`
  - `DRAFT_MODEL` → `EXTRACT_MODEL`
  - `DRAFT_API_KEY` → `EXTRACT_API_KEY`
  En pruebas: la API compatible con OpenAI de Gemini y el modelo
  Flash vigente (`gemini-3.5-flash-lite`, puesto en `EXTRACT_MODEL`
  en la Fase 5).
- Solo admite notas en `approved` (cualquier otro estado → 409
  `{ "error": "Aprueba la nota antes de preparar el seguimiento" }`). Si el borrador pedido
  ya está aprobado → 409 `{ "error": "El borrador ya está aprobado" }`.
  Sin datos no descartados → 400.
- Si falta algún *secret*, el proveedor falla o el JSON no es válido,
  responde 502 con el mensaje en español y no se escribe nada. La
  clave, los datos, los borradores y la respuesta del modelo nunca
  aparecen en los logs ni en las respuestas de error.
- Respuesta 200: `{ "drafts": ["comprador", "propietario"],
  "tasks_proposed": n, "tasks_by_rule": n, "retries": n }`.

### Desplegar sin CLI (la vía de este proyecto)

La función tiene **dos archivos** (`index.ts` y `rules.ts`): hay que
subir los dos, con `index.ts` como archivo principal.

1. Supabase → Edge Functions → **Deploy a new function** →
   **Via Editor**.
2. Nombre de la función: `drafts`.
3. Pegar el contenido completo de `supabase/functions/drafts/index.ts`
   como `index.ts`.
4. Añadir un archivo `rules.ts` en la misma función y pegar el
   contenido completo de `supabase/functions/drafts/rules.ts`
   (`index.ts` lo importa como `./rules.ts`).
5. No hay que crear *secrets*: usa los `EXTRACT_*` que ya existen
   (salvo que se quiera un proveedor distinto, en cuyo caso se crean
   los `DRAFT_*`).
6. Deploy. La función queda en
   `https://<proyecto>.supabase.co/functions/v1/drafts`.

### Desplegar con CLI

```bash
supabase functions deploy drafts
```

(La CLI sube la carpeta completa, con los dos archivos.)

### Comprobar que responde

Con el JWT de un agente (la función exige autenticación):

```bash
curl -X POST https://<proyecto>.supabase.co/functions/v1/drafts \
  -H "Authorization: Bearer <jwt-del-agente>" \
  -H "Content-Type: application/json" \
  -d '{"visit_note_id": "<uuid-de-una-nota-aprobada>"}'
```

- Nota de otro agente → 404 `{ "error": "No encontrado" }`.
- Sin JWT → 401.
- Nota no aprobada → 409 `{ "error": "Aprueba la nota antes de preparar el seguimiento" }`.
- Borrador ya aprobado → 409
  `{ "error": "El borrador ya está aprobado" }`.
- Proveedor caído o *secret* ausente → 502
  `{ "error": "No se ha podido preparar el seguimiento. Inténtalo de nuevo." }`.
- Borrador que no pasa los controles dos veces → 422
  `{ "error": "El borrador no ha pasado los controles. Vuelve a generarlo o escríbelo tú." }`
  (el otro borrador, si pasó, sí queda guardado).

## `crm-export` (Fase 7)

Exporta la ficha de una nota aprobada al CRM de la agencia (Inmovilla
o Witei) en un **formato propio** («inmo-visitas v1», NO la API real de
esos CRM, cuyo acceso está sin confirmar). Guarda el intento en
`crm_exports` (estado `pendiente` → `enviado` o `error`).

- Entrada: `POST` con cuerpo JSON `{ "visit_note_id": "<uuid>",
  "target": "inmovilla" | "witei" }`. Otro `target` → 400.
- Autenticación: Supabase verifica el JWT por defecto. Dentro, la
  función crea el cliente con la clave anon y la cabecera
  `Authorization` de la petición: todas las lecturas y escrituras
  pasan por RLS como ese agente. **Nunca `service_role`.**
- La función construye su propio JSON (no confía en el que mande el
  navegador): lee la nota, el cliente, el inmueble, el agente, los
  datos no descartados y las tareas `pendiente`, y los mapea con
  `mappers.ts` (que copia lo mínimo de `buildVisitSummary`; si cambia
  el formato de la ficha, hay que cambiarlo también ahí). A la ficha
  y al CRM NO van la transcripción, el texto de la nota, el audio (ni
  su ruta), las citas literales, los datos descartados ni los
  borradores. El presupuesto va siempre como «(declarado)».
- Solo admite notas en `approved` (otro estado → 409
  `{ "error": "Aprueba la nota antes de exportarla." }`). Si ya hay
  una fila `enviado` de esa nota y ese `target`, responde 200 con
  ella sin volver a llamar al CRM (`already_exported: true`).
- **Modo simulado** (falta `CRM_WEBHOOK_URL`, el modo de las
  pruebas): valida el *payload* con el esquema Zod de ese CRM y
  actualiza la fila a `enviado` con `external_id = 'SIM-' + <8
  primeros del id>` y `payload.simulated = true`. **No sale nada de
  Supabase.**
- **Modo webhook** (hay `CRM_WEBHOOK_URL`): `POST` del *payload* con
  `Content-Type: application/json`, `Idempotency-Key: <id de la fila>`
  y, si hay `CRM_WEBHOOK_SECRET`, `X-InmoVisitas-Signature:
  sha256=<HMAC del cuerpo>` (Web Crypto). *Timeout* de 15 s y **un**
  reintento con la misma clave ante *timeout* o 5xx. 2xx → `enviado`
  con el `external_id` de la respuesta (`id` o `external_id`, si
  viene). Otro caso → fila `error` con un mensaje genérico en español
  («El CRM no respondió», «El CRM rechazó la ficha (código 422)») y
  la función responde 502 con ese mensaje.
- *Secrets* opcionales: `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET`. **En
  pruebas no se crean** (modo simulado).
- Respuesta 200: `{ "export": { "id", "status", "external_id",
  "exported_at" }, "simulated": boolean, "already_exported":
  boolean }`. Ni el *payload* ni la respuesta del CRM aparecen en los
  logs ni en las respuestas de error.

### Desplegar sin CLI (la vía de este proyecto)

La función tiene **dos archivos** (`index.ts` y `mappers.ts`): hay que
subir los dos, con `index.ts` como archivo principal.

1. Supabase → Edge Functions → **Deploy a new function** →
   **Via Editor**.
2. Nombre de la función: `crm-export`.
3. Pegar el contenido completo de `supabase/functions/crm-export/index.ts`
   como `index.ts`.
4. Añadir un archivo `mappers.ts` en la misma función y pegar el
   contenido completo de `supabase/functions/crm-export/mappers.ts`
   (`index.ts` lo importa como `./mappers.ts`).
5. No hay que crear *secrets* en pruebas (modo simulado). Para el modo
   webhook, crear `CRM_WEBHOOK_URL` y, si el receptor lo pide,
   `CRM_WEBHOOK_SECRET` en Supabase → Edge Functions → Secrets.
6. Comprobar que la verificación de JWT está activada (por defecto).
   Deploy. La función queda en
   `https://<proyecto>.supabase.co/functions/v1/crm-export`.

### Desplegar con CLI

```bash
supabase functions deploy crm-export
```

(La CLI sube la carpeta completa, con los dos archivos.)

### Comprobar que responde (modo simulado)

Con el JWT de un agente (la función exige autenticación):

```bash
curl -X POST https://<proyecto>.supabase.co/functions/v1/crm-export \
  -H "Authorization: Bearer <jwt-del-agente>" \
  -H "Content-Type: application/json" \
  -d '{"visit_note_id": "<uuid-de-una-nota-aprobada>", "target": "inmovilla"}'
```

- Nota de otro agente → 404 `{ "error": "No encontrado" }`.
- Sin JWT → 401.
- Nota no aprobada → 409
  `{ "error": "Aprueba la nota antes de exportarla." }`.
- Segunda llamada con la misma nota y `target` → 200 con la misma
  fila y `"already_exported": true`.
- Respuesta 200: `"status": "enviado"`, `"external_id": "SIM-…"`,
  `"simulated": true`.

### Probar el modo webhook contra un receptor propio

1. Levantar un receptor de pruebas que guarde lo que recibe y
   responda 200 con un JSON, por ejemplo con
   [webhook.site](https://webhook.site) (copiar su URL única) o con
   un servidor local expuesto con un túnel (`npx localtunnel --port
   3000`, o `ngrok http 3000`) y un endpoint que haga `console.log`
   del cuerpo y las cabeceras y responda `{ "id": "ext-123" }`.
2. En Supabase → Edge Functions → Secrets, crear `CRM_WEBHOOK_URL`
   con esa URL (y `CRM_WEBHOOK_SECRET` con un secreto compartido si
   se quiere comprobar la firma `X-InmoVisitas-Signature`:
   HMAC-SHA256 del cuerpo, en hexadecimal).
3. Llamar a la función con una nota aprobada (como arriba): la fila
   queda `enviado` con el `external_id` que devolvió el receptor.
4. Para probar el fallo: que el receptor responda 500 (o apagarlo).
   La función reintenta **una** vez con la misma `Idempotency-Key` y
   deja la fila en `error` con «El CRM no respondió» o «El CRM
   rechazó la ficha (código 500)», y responde 502. El «Reintentar» de
   la app crea una fila nueva.
5. Al terminar, **borrar `CRM_WEBHOOK_URL`** (y el secreto) para
   volver al modo simulado, salvo que el receptor sea el CRM real.
