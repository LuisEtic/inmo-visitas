# FASE 4 DE 9 — CAPTURA: NOTA DE VISITA POR VOZ O TEXTO + TRANSCRIPCIÓN

> Prompt escrito por Claude el 2026-11-11 tras revisar el HANDOFF real de la
> Fase 3 y los ajustes del PR de revisión. Constructor: Muse.
> **No empieces hasta que Luis lo pida** y hasta que el PR de ajustes de la
> Fase 3 esté aprobado (merge en `main`).

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: al terminar una visita, el
agente dicta o escribe lo ocurrido; la app lo transcribe y, en fases
siguientes, extrae datos con evidencia y prepara tareas y borradores
distintos para comprador y propietario. Stack: React 19 + Vite 8 +
TypeScript estricto + Tailwind v4 + shadcn/ui + Supabase (Auth + Postgres +
Storage + Edge Functions) + Zod + react-router 8 + Vitest. Lee antes
`AGENTS.md` y `docs/ESTADO.md` (fuente de verdad del proyecto).

## ESTADO ACTUAL

- **PRIMERO:** `git pull origin main`. No reviertas nada de lo que sigue.
- Fases 1–2 cerradas: 8 tablas, seed, Minimal-Mono, Auth, RLS por agente en
  las 8 tablas, migración 0005 (referencia única por agente, email de solo
  lectura, `visit_notes.client_id`/`property_id` not null).
- Fase 3 (`v0.3-fase-3`): CRUD de clientes e inmuebles, `src/lib/contact.ts`
  (teléfono E.164, email en minúsculas, `tel:`/`wa.me`/`mailto:`),
  `src/lib/search.ts` (`matchesClientQuery` busca por nombre, email y
  dígitos del teléfono), `src/lib/database.types.ts` (tipos a mano, como
  `type`, no `interface`), `PrivateNav`, Vitest.
- **Ajustes de la revisión de la Fase 3 (PR de Claude):**
  - Las altas `/clientes/nuevo` e `/inmuebles/nuevo` estaban rotas en la UI
    (`useParams` da `id = undefined` en una ruta estática). Ahora
    `isNew = id === undefined` y la ficha se monta con `key = id`. **Lección
    para esta fase:** una ruta estática como `/capturar` no tiene
    parámetros; y **prueba cada pantalla en el navegador**, no solo por API.
  - Botón dentro de enlace sustituido por `<Button asChild><Link/></Button>`.
    Usa ese patrón.
  - `PROPERTY_STATUS_LABELS` en `src/features/properties/schema.ts`.
  - `normalizePhone` exige 6/7/8/9 también con `+34`/`0034`.
- **Paso 0 antes de construir:** despliega `main` (con los ajustes) en Pages
  y avisa a Luis para que repita los criterios 1, 3, 7 y 9 de la Fase 3
  (alta por la UI, móvil real y recarga en `/inmo-visitas/clientes/<id>`).
- Staging temporal: GitHub Pages (https://luisetic.github.io/inmo-visitas/).

## ALCANCE DE ESTA FASE

1. **Pantalla Capturar** (`/capturar`): elegir cliente e inmueble y crear
   una nota de visita **por texto** o **por voz** (audio grabado en el
   navegador).
2. **Cliente provisional rápido** desde la captura, cuando el agente no
   tiene aún al cliente dado de alta (decisión del 2026-11-11).
3. **Audio en Supabase Storage**, en un bucket privado con políticas por
   agente (migración 0006).
4. **Edge Function `transcribe`**: transcribe el audio con OpenAI Whisper,
   usando el JWT del agente (RLS se aplica también dentro de la función).
5. **Ficha mínima de la nota** (`/notas/:id`): ver la nota, escuchar el
   audio, corregir la transcripción y reintentar si falló.
6. Navegación: «Capturar» en `PrivateNav` y botón principal en Inicio.

## QUÉ NO TOCAR

- Nada de extracción de datos, evidencia, categorías, revisión/aprobación
  (Fase 5), tareas, borradores, lista o bandeja de notas (Fase 6), CRM o
  WhatsApp (Fase 7). No escribas en `extracted_facts`, `tasks`, `drafts` ni
  `crm_exports`. Nada de Gemini en esta fase.
- No modificar las migraciones 0001–0005. La única migración nueva es la
  `0006_storage_audio_visitas.sql` descrita abajo.
- No enviar `agent_id` desde el frontend (lo pone la base y RLS lo
  comprueba).
- **Nunca** `service_role`, ni en el cliente ni en la Edge Function. La
  clave de OpenAI solo como *secret* de Edge Functions (`OPENAI_API_KEY`),
  nunca en `.env`, en el repo ni en el HANDOFF.
- Sin cola offline ni IndexedDB (Fase 9), sin grabar la conversación con el
  cliente, sin subir archivos de audio desde el disco, sin dependencias
  nuevas de producción (MediaRecorder es nativo).
- No cambiar tokens de diseño, fuentes, ruta base, Auth ni las políticas de
  las 8 tablas.
- No escribir datos personales, transcripciones ni rutas de audio en
  `console.log` ni en los logs de la Edge Function.

## ESPECIFICACIÓN (crear exactamente así)

### Reglas de la nota (`visit_notes`, columnas de 0001)

| Caso | `input_type` | `raw_text` | `audio_url` | `transcript` | `status` |
|---|---|---|---|---|---|
| Texto guardado | `text` | el texto, recortado | null | null | `transcribed` |
| Audio subido, sin transcribir | `audio` | null | ruta en Storage | null | `draft` |
| Audio transcrito | `audio` | null | ruta en Storage | texto de Whisper | `transcribed` |

- `transcribed` significa «hay texto listo para la extracción» (Fase 5 leerá
  `coalesce(transcript, raw_text)`).
- `audio_url` guarda la **ruta** del objeto en Storage
  (`<agent_id>/<visit_note_id>.<ext>`), **no** una URL pública. Para
  escuchar el audio se pide una URL firmada de 5 minutos
  (`createSignedUrl(path, 300)`).
- Texto: obligatorio, 10–5.000 caracteres (Zod, mensajes en español).
- La transcripción se puede corregir a mano en `/notas/:id` (máx. 5.000
  caracteres) mientras el estado sea `draft` o `transcribed`.

### Migración `supabase/migrations/0006_storage_audio_visitas.sql`

Idempotente (se puede reaplicar), comentada en español:

- Bucket privado `visit-audio`: `insert into storage.buckets (id, name,
  public, file_size_limit, allowed_mime_types) values ('visit-audio',
  'visit-audio', false, 10485760, array['audio/webm', 'audio/mp4',
  'audio/ogg', 'audio/mpeg', 'audio/wav']) on conflict (id) do update ...`.
- Políticas en `storage.objects` **solo para `authenticated`** y solo para
  ese bucket, con la carpeta del agente como primer segmento:
  `bucket_id = 'visit-audio' and (storage.foldername(name))[1] =
  auth.uid()::text`.
  - `visit_audio_select_own` (select), `visit_audio_insert_own` (insert),
    `visit_audio_delete_own` (delete). **Sin** update (no se sobrescribe un
    audio: se sube con `upsert: false`).
  - Ninguna política para `anon`.
- `drop policy if exists` antes de cada `create policy`.
- No toques `docs/deploy/supabase-hasta-fase-2.sql`: crea
  `docs/deploy/supabase-fase-4.sql` con solo la 0006, para que Luis la pegue
  en el SQL Editor. Comprobación: `select id, public from
  storage.buckets where id = 'visit-audio'` devuelve `visit-audio | false`.

### Grabación (frontend, `src/features/capture/`)

- `useRecorder.ts`: hook sobre `navigator.mediaDevices.getUserMedia({
  audio: true })` + `MediaRecorder`. Tipo MIME: el primero que cumpla
  `MediaRecorder.isTypeSupported` de `['audio/webm;codecs=opus',
  'audio/webm', 'audio/mp4', 'audio/ogg']` (Safari/iOS graba `audio/mp4`).
  Extensión de archivo según el tipo base (`webm`, `m4a` para `audio/mp4`,
  `ogg`). Estados: `idle` · `recording` · `stopped` · `error`.
- Límite: **3 minutos**; a los 3:00 se para solo y lo avisa. Contador
  `0:00 / 3:00` visible mientras graba. Al parar, se liberan las pistas del
  micrófono (`track.stop()`), también al salir de la pantalla.
- Tras parar: reproductor `<audio controls>` del blob, botones «Volver a
  grabar» y «Guardar nota».
- Errores en español: sin permiso de micrófono → «Permite el micrófono
  para grabar. También puedes escribir la nota.»; navegador sin
  `MediaRecorder` → ocultar la pestaña de voz y dejar solo texto.
- Aviso fijo encima del botón de grabar: «Graba tu resumen al salir de la
  visita, no la conversación con el cliente.» (ficha: sin grabar al
  cliente por defecto).
- Las funciones puras (elegir tipo MIME, extensión, formato `m:ss`,
  validación de la nota) van en `src/features/capture/audio.ts` con tests
  de Vitest.

### Pantalla `/capturar` (privada, `lazy`, móvil primero)

1. **Cliente:** buscador con `matchesClientQuery` sobre `listClients()`
   (nombre, email o teléfono), lista de resultados con nombre y teléfono
   formateado; el elegido queda marcado. Opción «Cliente nuevo
   (provisional)»: nombre obligatorio (2–120) y teléfono opcional
   (`normalizePhone`), crea el cliente con `is_temporary = true` usando
   `createClient` de `features/clients/api.ts` y lo selecciona.
2. **Inmueble:** buscador con `matchesPropertyQuery`; solo inmuebles
   `disponible` o `reservado` por defecto, con casilla «Mostrar vendidos».
   Tarjeta: referencia (JetBrains Mono), dirección y badge de estado.
3. **Nota:** dos pestañas, «Voz» (por defecto si hay MediaRecorder) y
   «Texto» (`textarea`, contador `n / 5.000`).
4. **Guardar nota:** desactivado hasta tener cliente, inmueble y texto o
   audio. Al guardar:
   - Texto → `insert` en `visit_notes` (estado `transcribed`) → navegar a
     `/notas/:id`.
   - Voz → `insert` de la nota (`draft`, `audio_url` null) → subir el blob
     a `visit-audio/<agent_id>/<id>.<ext>` (`agent_id` = `session.user.id`,
     solo para la ruta) con `contentType` del blob y `upsert: false` →
     `update` de `audio_url` con la ruta → navegar a `/notas/:id`, que lanza
     la transcripción.
   - Si la subida falla: mensaje «No se ha podido subir el audio. Revisa la
     conexión y vuelve a intentarlo.» con botón «Reintentar subida»; **el
     audio sigue en la pantalla** (no se pierde la grabación) y no se crea
     una segunda nota.
- Errores de base traducidos con `translateDbError`. Objetivos táctiles de
  44 px, sin desbordamiento a 360 px, estados de carga y error.

### Edge Function `supabase/functions/transcribe/index.ts` (Deno)

- `POST` con cuerpo JSON `{ "visit_note_id": "<uuid>" }` (validado con Zod
  desde `npm:zod`). CORS: responder a `OPTIONS` y permitir solo los orígenes
  `http://localhost:5173`, `http://localhost:4173` y
  `https://luisetic.github.io`; cabeceras `authorization, x-client-info,
  apikey, content-type`.
- Autenticación: se mantiene la verificación de JWT por defecto de Supabase.
  Dentro, crea el cliente de Supabase con `SUPABASE_URL`,
  `SUPABASE_ANON_KEY` y la cabecera `Authorization` de la petición, para que
  **todas** las lecturas y escrituras pasen por RLS como ese agente. Sin
  `service_role`.
- Pasos:
  1. Leer la nota (`select ... where id = visit_note_id`): si no hay fila →
     404 `{ "error": "No encontrado" }` (nota de otro agente o inexistente).
  2. Si `input_type <> 'audio'` o `audio_url` es null → 400. Si ya está
     `transcribed` → 200 con la transcripción existente (no gastar otra
     llamada).
  3. Descargar el audio de Storage con ese mismo cliente (RLS de 0006).
     Si pesa más de 10 MB → 413.
  4. Llamar a `https://api.openai.com/v1/audio/transcriptions`
     (`multipart/form-data`: `file`, `model=whisper-1`, `language=es`,
     `response_format=json`) con `Authorization: Bearer
     ${Deno.env.get('OPENAI_API_KEY')}`. Tiempo máximo 60 s.
  5. Guardar `transcript` y `status = 'transcribed'` con `update` (RLS).
  6. Responder 200 `{ "transcript": "..." }`.
- Errores: si falta `OPENAI_API_KEY` o OpenAI falla → 502 `{ "error":
  "No se ha podido transcribir. Inténtalo de nuevo." }` y la nota se queda en
  `draft`. Nunca devolver al cliente el mensaje original de OpenAI ni
  escribir en los logs la transcripción, el audio o la clave.
- Llamada desde el frontend: `supabase.functions.invoke('transcribe', {
  body: { visit_note_id } })` en `src/features/notes/api.ts`.
- Actualiza `supabase/functions/README.md`: qué hace `transcribe`, el
  secret `OPENAI_API_KEY` y cómo desplegarla **sin CLI** (Supabase →
  Edge Functions → *Deploy a new function* → *Via Editor*, nombre
  `transcribe`, pegar `index.ts`) y con CLI (`supabase functions deploy
  transcribe`).

### Ficha `/notas/:id` (privada, `lazy`, `key = id`)

- Cabecera: cliente (enlace a su ficha, badge «Provisional» si aplica),
  inmueble (referencia + dirección, enlace a su ficha), fecha
  (`Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle:
  'short' })`) y estado («Pendiente de transcribir» / «Transcrita»).
- Audio: `<audio controls>` con URL firmada; si la nota es `draft` con
  audio, lanza `transcribe` al abrir **una sola vez** (no en cada render) y
  muestra «Transcribiendo…»; si falla, el mensaje de la función y el botón
  «Reintentar transcripción».
- Texto: la transcripción (o `raw_text`) en modo lectura con botón
  «Corregir»; al guardar, `update` de `transcript` (audio) o `raw_text`
  (texto), mismas reglas de longitud.
- Id inexistente o de otro agente → «No encontrado» (igual que Fase 3).
- Botón «Nueva captura» → `/capturar`. Sin lista de notas (Fase 6).

### Tipos

- Añade a `database.types.ts` `VisitNoteRow`/`Insert`/`Update` (columnas
  exactas de 0001 con `client_id`/`property_id` no nulos por 0005),
  `VisitNoteStatus` y `VisitNoteInputType`, como `type`.

### Datos de ejemplo para probar (ficticios)

- Texto, cliente Ana García, inmueble V-18: «Ana ha visitado V-18 con su
  pareja. Le preocupa el ruido de la calle Alcalá por la noche. Quiere
  volver el viernes, falta confirmar la hora. Dice que su presupuesto es de
  230.000 euros y pide que le mandemos los gastos de comunidad e IBI.»
- Voz: dicta ese mismo texto (unos 20 s) en el móvil de pruebas.
- Cliente provisional desde la captura: «Marta (la del lunes)», sin
  teléfono, inmueble V-31.

## DESPLIEGUE

- **Luis** (o Muse con su permiso): pegar `docs/deploy/supabase-fase-4.sql`
  en el SQL Editor; crear el secret `OPENAI_API_KEY` en Supabase → Edge
  Functions → Secrets; desplegar `transcribe`. Muse nunca ve ni escribe la
  clave.
- Pages, igual que en la Fase 3 (directorio temporal → `gh-pages`, nunca
  `git checkout --orphan` en el worktree principal). El micrófono exige
  HTTPS: Pages sirve con HTTPS; en local, `localhost` también vale.

## CRITERIOS DE ACEPTACIÓN

1. Como A, en `/capturar`, busca «ana», elige a Ana García y V-18, escribe
   la nota de ejemplo y guarda → `/notas/<id>` con estado «Transcrita»,
   `input_type = text`, `raw_text` correcto y sin `agent_id` en la petición.
2. Texto de menos de 10 caracteres o sin cliente/inmueble → no se guarda y
   lo explica en español.
3. Voz en un **móvil real** (Android con Chrome y, si es posible, iPhone
   con Safari) en Pages: graba, escucha, guarda → el audio aparece en
   `visit-audio/<id de A>/<id de la nota>.<ext>` y la nota pasa a
   «Transcrita» con un texto razonable en español. A los 3:00 la grabación
   se para sola.
4. Sin permiso de micrófono → mensaje de la especificación y la pestaña
   «Texto» sigue funcionando.
5. Cliente provisional «Marta (la del lunes)» creado desde la captura:
   aparece en `/clientes` con badge «Provisional» y la nota queda enlazada.
6. Corregir la transcripción en `/notas/:id` persiste tras recargar.
7. **Prueba negativa:** B no ve la nota de A (`/notas/<id de A>` → «No
   encontrado»); B no puede descargar ni subir objetos en la carpeta de A
   (prueba con `supabase.storage.from('visit-audio')` desde la consola o
   un script con la clave anon: error o 0 objetos); `transcribe` con el JWT
   de B sobre la nota de A → 404; sin JWT → 401.
8. Sin `OPENAI_API_KEY` (o con OpenAI caído) → 502 con el mensaje en
   español, nota en `draft` y «Reintentar transcripción» funciona después.
9. La clave de OpenAI no aparece en el repo, en `dist/`, en el HANDOFF ni
   en la red del navegador (solo viaja de la Edge Function a OpenAI).
10. `npm test` (con los tests nuevos de `audio.ts`), `npx tsc --noEmit`,
    `npm run build` y `npm run lint` sin errores (los 2 avisos previos de
    shadcn se aceptan) y ningún trozo JS > 500 kB. Si tienes Deno,
    `deno check supabase/functions/transcribe/index.ts`.
11. Cada pantalla nueva probada **en el navegador** (no solo por API), a
    360 px y sin errores de consola, en local y en Pages.

## ENTREGA

Termina con el bloque HANDOFF FASE 4 (añádelo a `docs/HANDOFF.md`), commit
«Fase 4: captura por voz y texto + transcripción», etiqueta `v0.4-fase-4` y
push a `main`:

HANDOFF FASE 4
- Hecho: qué construiste realmente
- Tablas/columnas/políticas creadas o cambiadas (esperado: solo la 0006,
  bucket y 3 políticas de Storage)
- RLS / Edge Functions activas (y si está desplegada `transcribe`)
- Rutas/pantallas nuevas
- Dependencias nuevas (esperado: ninguna de producción)
- Errores o warnings de build (tsc/lint/test) y tamaño del trozo JS mayor
- Navegadores y móviles probados (modelo, sistema y tipo MIME grabado)
- Supuestos tomados o pendientes
- Cómo probarlo (pasos y URL, con los datos de ejemplo de arriba)
