# FASE 6 DE 9 — BORRADORES DUALES + BANDEJA DE PENDIENTES + LISTA DE NOTAS

> Prompt escrito por Claude el 2026-11-12, al cerrar la Fase 5 (Pages
> desplegado con el parche de etiqueta y prueba rápida en vivo). Constructor:
> Muse. **No empieces hasta que Luis lo pida** y hasta que el PR del cierre
> de la Fase 5 y de este prompt esté fusionado en `main`.
> Las decisiones marcadas «(decidido por Claude)» las confirma Luis al
> lanzar la fase; si cambia alguna, se anota en `docs/ESTADO.md` antes de
> empezar.

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: al terminar una visita, el
agente dicta o escribe lo ocurrido; la app lo transcribe, extrae datos con
su cita literal, el agente los revisa y aprueba y, **en esta fase**, la app
prepara las **tareas** y **dos borradores distintos**, uno para el comprador
y otro para el propietario, que el agente revisa, edita y aprueba. **Nada se
envía automáticamente**: el agente copia el texto (el envío por WhatsApp o
CRM es la Fase 7). Stack: React 19 + Vite 8 + TypeScript estricto +
Tailwind v4 + shadcn/ui + Supabase (Auth + Postgres + Storage + Edge
Functions) + Zod + react-router 8 + Vitest. Lee antes `AGENTS.md` y
`docs/ESTADO.md`.

## ESTADO ACTUAL

- **PRIMERO:** `git pull origin main`. No reviertas nada de lo que sigue.
- Fases 1–5 cerradas. Fase 5 (`v0.5-fase-5` + revisión, migraciones 0007 y
  0008): Edge Function `extract` (v13, *secrets* `EXTRACT_API_URL`,
  `EXTRACT_MODEL` = `gemini-3.5-flash-lite`, `EXTRACT_API_KEY`), revisión
  dato a dato y aprobación en `/notas/:id`.
- **Regla de la base que condiciona esta fase:** `visit_notes_guard` (0008)
  rechaza **cualquier** `update` de una nota `approved` (`nota_aprobada`).
  Por eso **todo el estado de la Fase 6 vive en `tasks` y `drafts`, nunca
  en `visit_notes`**: no añadas columnas a `visit_notes` ni intentes marcar
  la nota como «con borradores».
- Las tablas `tasks` y `drafts` existen desde la 0001 y tienen RLS desde la
  0004 (`tasks` por `agent_id`; `drafts` a través de su nota). Hoy no hay
  filas en ellas.
- Datos de prueba ya disponibles: la nota de ejemplo de Ana García + V-18,
  **aprobada**, con sus datos (objeción de ruido, segunda visita el viernes
  sin confirmar, hora desconocida, presupuesto declarado de 230.000 €,
  petición de gastos de comunidad e IBI).
- La llamada al proveedor de IA desde Supabase es **lenta o intermitente**
  (12 nov.: 28–60 s o 502 a veces; al reintentar funciona). Diseña la UI
  para eso: estado de espera largo y reintento.
- **Patrones que hay que mantener:** rutas estáticas sin `useParams`; fichas
  con `key = id`; `<Button asChild><Link/>`; errores de base con
  `translateDbError`; tipos a mano como `type`; etiqueta de fase solo en
  `src/lib/app-label.ts`; funciones puras de la Edge Function en `rules.ts`
  probadas con Vitest; **cada pantalla probada en el navegador**.
- Mejoras aplazadas a la Fase 9 (no las toques): reintento de subida tras
  fallo parcial y URL firmada que se repide tras transcribir.

## ALCANCE DE ESTA FASE

1. **Migración 0009:** columnas y reglas en `tasks` y `drafts`.
2. **Edge Function `drafts`:** a partir de una nota **aprobada** y sus datos
   no descartados, genera el borrador al comprador, el borrador al
   propietario y las tareas propuestas. **Las reglas mandan sobre la IA**:
   el borrador al propietario nunca recibe ni revela presupuesto ni
   finanzas del comprador, ningún borrador da por confirmada una cita, y
   cada cita pendiente tiene su tarea de confirmar.
3. **`/notas/:id` ampliada:** sección «Seguimiento» (solo con la nota
   aprobada): tareas propuestas y los dos borradores (editar, copiar,
   aprobar, volver a generar).
4. **`/pendientes`:** bandeja de tareas y de notas que piden acción.
5. **`/notas`:** lista de notas guardadas con filtros y búsqueda.
6. Navegación, etiqueta de fase y registro para las métricas del piloto.

## QUÉ NO TOCAR

- Nada de CRM, WhatsApp, `crm_exports` ni enlaces `wa.me` con texto
  (Fase 7). El único «envío» es **copiar al portapapeles**.
- No modificar las migraciones 0001–0008 ni las funciones `transcribe` y
  `extract`. No cambiar RLS existente ni el guard de `visit_notes`.
- **Nunca** `service_role`. Las claves solo como *secrets*; Muse no las ve.
- **Minimización (RGPD) — decidido por Claude:** a la IA **no** se envían
  nombres, teléfonos, emails, dirección ni precio del inmueble, ni el
  texto completo de la nota, ni las citas. Solo `category`, `field_name` y
  `value` de los datos no descartados, la referencia del inmueble (p. ej.
  `V-18`) y marcadores (`{nombre}`, `{propietario}`, `{inmueble}`,
  `{agente}`) que la función sustituye **después**, ya en el servidor.
- El borrador al propietario se genera en una **llamada aparte** que no
  recibe los datos de presupuesto ni de finanzas del comprador (ver
  reglas): no basta con pedírselo al modelo.
- No escribir en logs ni en `console.log` datos, borradores, respuestas del
  modelo ni claves.
- No cambiar tokens de diseño, fuentes, ruta base ni Auth. Sin dependencias
  nuevas de producción.

## ESPECIFICACIÓN (crear exactamente así)

### Migración `supabase/migrations/0009_borradores_tareas.sql`

Idempotente y comentada en español, como la 0007 y la 0008. Al aplicarla,
`tasks` y `drafts` están vacías, pero escríbela para que no falle con
filas `pendiente`/`completada`.

**`tasks`**

- `status`: sustituir el *check* (`drop constraint if exists
  tasks_status_check` y crearlo de nuevo) por `('propuesta', 'pendiente',
  'completada', 'descartada')`, por defecto `'pendiente'`.
- `origin text not null default 'agente' check (origin in ('ia', 'regla',
  'agente'))`: quién la propuso.
- `source_fact_id uuid references public.extracted_facts (id) on delete
  set null`: el dato que la justifica (la evidencia de la tarea).
- `original_description text` (primera edición del agente, para medir
  correcciones), `completed_at timestamptz`, `updated_at timestamptz`.
- Índice `tasks_agent_status_due_idx (agent_id, status, due_date)`.
- Trigger `tasks_guard` (`before insert or update`, `security invoker`):
  - Insert con `visit_note_id` no nulo: la nota debe estar `approved` →
    si no, `raise exception 'nota_no_aprobada' using errcode = 'P0001'`.
  - Insert con `status = 'propuesta'` solo si `origin in ('ia','regla')`
    y la nota no es nula; una tarea creada a mano (`agente`) nace
    `pendiente`.
  - Transiciones válidas: `propuesta → pendiente | descartada`;
    `pendiente → completada | descartada`; `completada → pendiente`
    (reabrir); `descartada → propuesta` solo si `origin <> 'agente'`
    (recuperar). Cualquier otra → `transicion_no_valida`.
  - `completada` pone `completed_at := now()`; reabrir lo vacía.
  - Si cambia `description` y `original_description` es nula y `origin
    <> 'agente'` → guarda la anterior. Siempre `updated_at := now()`.
  - `source_fact_id`, si no es nulo, debe ser de la misma nota
    (`fuente_no_valida`).
- El borrado de una tarea solo si `status in ('propuesta', 'descartada')`
  o `origin = 'agente'`; **excepto** cuando la nota ya no existe (borrado
  en cascada de la nota, RGPD), igual que `extracted_facts_guard`.

**`drafts`**

- `status text not null default 'borrador' check (status in ('borrador',
  'aprobado'))`.
- `original_content text` (texto que generó la IA, guardado en la primera
  edición), `generated_at timestamptz not null default now()`,
  `edited_at timestamptz`, `approved_at timestamptz`.
- `unique (visit_note_id, audience)`: un borrador por destinatario.
- `check (audience <> 'propietario' or is_sensitive_filtered)`.
- `check (char_length(content) between 1 and 1500)`.
- Trigger `drafts_guard` (`before insert or update or delete`):
  - Insert: la nota debe estar `approved` → si no, `nota_no_aprobada`.
  - Update o delete de un borrador `aprobado` → `borrador_aprobado`
    (queda congelado), salvo la cascada de borrado de la nota (mismo
    patrón que `extracted_facts_guard`).
  - Si cambia `content` y `original_content` es nula → guarda la anterior;
    `edited_at := now()`.
  - Pasar a `aprobado` pone `approved_at := now()`; no se puede volver a
    `borrador`.
- `docs/deploy/supabase-fase-6.sql` con solo la 0009, para el SQL Editor.

### Errores nuevos en `translateDbError` (`P0001` por mensaje)

- `nota_no_aprobada` → «Aprueba la nota antes de preparar el seguimiento»
- `borrador_aprobado` → «El borrador está aprobado y ya no se puede cambiar»
- `fuente_no_valida` → «El dato de origen no pertenece a esta nota»
- `transicion_no_valida` ya existe: revisa que el texto valga para tareas.
- `23505` en `drafts` (duplicado por destinatario) → «Ya hay un borrador
  para este destinatario; vuelve a generarlo».

### Edge Function `supabase/functions/drafts/` (Deno)

Archivos: `index.ts` y `rules.ts` (puro, sin Deno, con
`rules.test.ts` en Vitest). Mismo patrón que `extract`: CORS para
`http://localhost:5173`, `http://localhost:4173` y
`https://luisetic.github.io`; JWT verificado; cliente con
`SUPABASE_URL` + `SUPABASE_ANON_KEY` + cabecera `Authorization` (RLS como
el agente). **Proveedor (decidido por Claude):** lee `DRAFT_API_URL`,
`DRAFT_MODEL` y `DRAFT_API_KEY` y, si falta alguno, usa el `EXTRACT_*`
equivalente: en pruebas no hay que crear *secrets* nuevos.

1. `POST { "visit_note_id": "<uuid>", "audience"?: "comprador" |
   "propietario" }` (Zod). Sin `audience` = los dos borradores **y** las
   tareas propuestas; con `audience` = solo ese borrador («Volver a
   generar»).
2. Leer la nota (404 si no hay fila) → debe estar `approved`, si no 409
   `{ "error": "Aprueba la nota antes de preparar el seguimiento" }`. Si el
   borrador pedido ya está `aprobado` → 409 `{ "error": "El borrador ya
   está aprobado" }`.
3. Leer los datos con `review_status <> 'descartado'` (si no hay ninguno →
   400), el cliente (`full_name`), el inmueble (`reference`, `address`,
   `owner_name`) y el agente (`full_name`). Los nombres y la dirección se
   quedan en la función: **no van al modelo**.
4. Construir con `rules.ts`:
   - `buyerFacts(facts)`: todos los datos no descartados.
   - `ownerFacts(facts)`: quita la categoría `presupuesto` y cualquier
     dato cuyo `field_name` o `value` coincida con `FINANCE_TERMS`
     (`presupuesto`, `financ`, `hipoteca`, `banco`, `prestamo`/`préstamo`,
     `ingresos`, `nomina`/`nómina`, `ahorro`, `entrada`, `solvencia`,
     `tasacion`, `aval`) o contenga una cifra de dinero (`\d[\d.]*\s*(€|eur|euros|mil)`).
5. Llamadas al modelo **en paralelo** (`Promise.all`), chat completions
   compatible con OpenAI, `temperature: 0.3`, `response_format: { type:
   'json_object' }`, 60 s de tiempo máximo cada una:
   - **Comprador** (si toca): `SYSTEM_PROMPT_BUYER` + usuario =
     `{ inmueble: "V-18", datos: buyerFacts }` en JSON. Devuelve
     `{ "draft": "...", "tasks": [ { "description", "fact_index" } ] }`
     (`fact_index` = posición del dato en la lista enviada). Las tareas
     solo se piden en la llamada del comprador y solo sin `audience`.
   - **Propietario** (si toca): `SYSTEM_PROMPT_OWNER` + usuario =
     `{ inmueble: "V-18", datos: ownerFacts }`. Devuelve `{ "draft": "..." }`.
   - Falta de *secrets*, error, tiempo agotado o JSON no válido (Zod:
     `draft` 1–1500; `tasks` máx. 10, `description` 3–200, `fact_index`
     entero válido) → 502 `{ "error": "No se ha podido preparar el
     seguimiento. Inténtalo de nuevo." }` y **no se escribe nada**.
6. **Reglas sobre la salida (en `rules.ts`):**
   - `checkPlaceholders(text, audience)`: comprador admite `{nombre}`,
     `{inmueble}`, `{agente}`; propietario admite `{propietario}`,
     `{inmueble}`, `{agente}`. Cualquier otro `{...}` (en especial
     `{nombre}` en el del propietario) → rechazo.
   - `fillPlaceholders(text, values)`: `{nombre}` = **solo el nombre de
     pila** del cliente (primera palabra; si es provisional, «Hola» sin
     nombre); `{propietario}` = nombre de pila de `owner_name`;
     `{inmueble}` = `reference` + dirección; `{agente}` = `full_name` del
     agente.
   - `ownerLeaks(text, ctx)` (después de sustituir): rechazo si contiene
     algún `FINANCE_TERMS`, una cifra de dinero, el valor de cualquier
     dato `presupuesto` (también sin puntos: `230000`) o el nombre o
     apellidos del cliente.
   - `confirmsAppointment(text)`: rechazo si dice que una cita está
     confirmada (`confirmad[ao]`, `queda(mos)? (para|el)`, `nos vemos el`,
     `te esperamos el`…) **salvo** que exista un dato no descartado que
     diga que está confirmada; y rechazo si aparece una hora
     (`\b\d{1,2}[:.h]\d{2}\b`, `a las \d`) que no esté en ningún `value`.
   - Si un borrador se rechaza, se repite **una sola vez** esa llamada con
     el motivo añadido al mensaje del sistema; si vuelve a fallar → 422
     `{ "error": "El borrador no ha pasado los controles. Vuelve a
     generarlo o escríbelo tú." }` y no se guarda ese borrador (el otro,
     si pasó, sí).
   - `requiredTasks(facts, aiTasks)`: cada dato `cita_pendiente` no
     descartado **debe** tener una tarea; si la IA no la propuso, la
     regla añade «Confirmar día y hora: <valor>» con `origin = 'regla'`.
     Tareas con `fact_index` no válido se descartan; duplicadas (misma
     descripción normalizada) se quedan una vez.
7. Guardar con el cliente del agente: borrador nuevo = `delete` del
   borrador no aprobado de ese destinatario + `insert` (`status =
   'borrador'`, `is_sensitive_filtered = true` en los dos); tareas = borrar
   las `propuesta` y `descartada` de la nota con `origin in ('ia','regla')`
   e insertar las nuevas como `propuesta` con su `source_fact_id`. Las
   tareas que el agente ya aceptó no se tocan. Error de base → 502.
8. Responder 200 `{ "drafts": ["comprador", "propietario"],
   "tasks_proposed": n, "tasks_by_rule": n, "retries": n }`.

**Mensajes del sistema** (constantes en `index.ts`, en español de España;
puedes mejorar la redacción, no el contenido):

> **Comprador.** Eres un asistente que redacta, para un agente
> inmobiliario, un mensaje breve de seguimiento al COMPRADOR tras una
> visita. Recibes la referencia del inmueble y una lista de datos
> revisados por el agente. Escribe en español de España, tono cercano y
> profesional, de tuteo, en 60–140 palabras, listo para WhatsApp o email,
> sin asunto. Empieza con «Hola {nombre},» y firma con «{agente}». Usa
> `{inmueble}` para referirte al inmueble. Responde a las peticiones y
> objeciones sin prometer nada que no esté en los datos. Una cita
> pendiente NUNCA está confirmada: propón confirmarla y pregunta lo que
> falte (por ejemplo, la hora). No menciones el presupuesto ni la
> financiación del comprador. No inventes datos, precios, horas ni
> fechas. Devuelve SOLO JSON `{"draft": "...", "tasks": [...]}`; cada
> tarea es una acción concreta del agente (`description`, en infinitivo)
> y el `fact_index` del dato que la justifica.
>
> **Propietario.** Eres un asistente que redacta, para un agente
> inmobiliario, un mensaje breve al PROPIETARIO del inmueble para
> informarle de una visita. Recibes la referencia del inmueble y una lista
> de datos revisados. Escribe en español de España, tono profesional y
> cercano, de usted, en 50–120 palabras. Empieza con «Hola {propietario},»
> y firma con «{agente}». Habla del comprador como «el cliente» o «la
> persona interesada», nunca por su nombre. No hables de presupuesto,
> ofertas, financiación ni situación económica del cliente. Una cita
> pendiente NUNCA está confirmada. No inventes datos. Devuelve SOLO JSON
> `{"draft": "..."}`.

### Pantalla `/notas/:id` — sección «Seguimiento»

Solo con la nota `approved`, debajo de los datos (que siguen en solo
lectura):

- Sin borradores ni tareas: botón principal «Preparar seguimiento» →
  `drafts` → «Preparando borradores y tareas… puede tardar hasta un
  minuto» → recarga. Error: el mensaje de la función y «Reintentar».
- **Tareas propuestas** (`propuesta`): descripción, dato de origen
  (etiqueta legible + su cita entre «…», del dato `source_fact_id`), badge
  «IA» o «Regla» y acciones «Añadir a pendientes» (con fecha opcional,
  `<input type="date">`), «Editar» y «Descartar». Descartadas plegadas en
  «Descartadas (N)» con «Recuperar». Botón «Añadir tarea» (a mano, nace
  `pendiente`, sin dato de origen).
- **Dos tarjetas de borrador**, «Para el comprador» y «Para el
  propietario» (este con la nota «Sin presupuesto ni datos económicos del
  comprador»):
  - Texto editable (`<textarea>`, 1–1500, contador). «Guardar cambios».
  - «Copiar» (`navigator.clipboard.writeText`; aviso «Copiado»; si falla,
    selecciona el texto). **No** hay botón de enviar.
  - «Aprobar borrador» con confirmación («Una vez aprobado no se podrá
    cambiar») → solo lectura, «Aprobado el 12 nov 2026, 18:40». Copiar
    sigue disponible.
  - «Volver a generar» (solo si no está aprobado), con confirmación «Se
    sustituirá el texto actual», llama a `drafts` con ese `audience`.
  - Si el borrador fue editado: «Editado por ti».
  - 422 de las reglas: el aviso de la función y «Escribir yo», que abre el
    editor vacío y guarda con un `insert` directo (1–1500 caracteres,
    `is_sensitive_filtered = true`; la base lo permite con la nota
    aprobada).
- **Resumen de seguimiento** (métricas del piloto): «Tareas: 3 propuestas ·
  2 aceptadas · 1 descartada · 1 añadida por ti · Borradores: 1 editado · 1
  aprobado».

### Pantalla `/pendientes` (nueva) — la bandeja

- **Tareas** del agente con `status = 'pendiente'`, agrupadas en
  «Vencidas», «Hoy», «Próximos días», «Sin fecha» (fecha local de
  Madrid), cada una con cliente + referencia del inmueble (enlace a la
  nota), dato de origen si lo hay, «Completar» (un toque, con deshacer
  durante 5 s), «Cambiar fecha» y «Editar». Plegadas: «Completadas
  recientes (7 días)» con «Reabrir».
- **Notas que piden acción** (debajo de las tareas), con enlace a cada
  nota:
  - «Por revisar»: notas en `transcribed`, `extracted` o `reviewed`.
  - «Sin transcribir»: notas en `draft`.
  - «Seguimiento sin preparar»: notas `approved` sin ningún borrador.
  - «Borradores por aprobar»: notas con algún borrador en `borrador`.
  - «Tareas propuestas sin revisar»: notas con tareas `propuesta`.
- Contadores en cada grupo y estado vacío: «No tienes nada pendiente.»
- Botón «Nueva tarea» (a mano, sin nota).

### Pantalla `/notas` (nueva) — lista de notas guardadas

- Todas las notas del agente, más recientes primero: fecha, cliente,
  referencia del inmueble, tipo (texto/voz), etiqueta de estado (las de la
  Fase 5) y, si está aprobada, «Seguimiento: preparado / sin preparar».
- Filtro por estado (select nativo, con «Todas») y búsqueda por cliente o
  referencia (normalizada sin tildes, como `src/lib/search.ts`).
- Paginación simple de 25 en 25 («Cargar más»).
- Enlace a cada nota y botón «Nueva nota» (a `/capturar`).

### Navegación y portada

- `PrivateNav`: añade «Notas» y «Pendientes» (con el número de tareas
  pendientes si es > 0). A 360 px **no** puede desbordar la página: usa
  desplazamiento horizontal dentro de la barra o dos filas, objetivos de
  44 px.
- Portada: un acceso a «Pendientes» con el recuento; texto de fase
  «Fase 6 — Borradores duales + bandeja de pendientes».
- `APP_PHASE_LABEL = 'inmo-visitas · Fase 6'`.

### Tipos y capa de datos

- `database.types.ts`: `TaskRow`/`Insert`/`Update`, `TaskStatus`,
  `TaskOrigin`, `DraftRow`/`Insert`/`Update`, `DraftAudience`,
  `DraftStatus`.
- `src/features/followup/api.ts`: `prepareFollowUp(noteId, audience?)`
  (`functions.invoke('drafts')`), `listDrafts`, `saveDraft`,
  `approveDraft`, `createManualDraft`, `listNoteTasks`, `acceptTask`,
  `discardTask`, `restoreTask`, `editTask`, `createTask`.
- `src/features/tasks/api.ts` y `src/features/tasks/buckets.ts`
  (agrupación por fecha, pura y con tests, incluido el cambio de día en
  `Europe/Madrid`).
- `src/features/notes/api.ts`: `listNotes({ status, query, offset })` con
  el cliente y el inmueble embebidos.

### Datos de ejemplo para probar (ficticios)

Con la nota aprobada de Ana García + V-18, «Preparar seguimiento» debe dar,
como mínimo:

| Salida | Esperado | NO debe |
|---|---|---|
| Borrador comprador | «Hola Ana,»; menciona que se le enviarán los gastos de comunidad e IBI; reconoce lo del ruido; propone la visita del viernes y **pregunta la hora** | dar la cita por confirmada; inventar una hora; hablar del presupuesto |
| Borrador propietario | «Hola <nombre de pila del propietario>,»; la visita a V-18 se hizo; el cliente comentó el ruido de la calle; posible segunda visita el viernes **por confirmar** | contener «230.000», «presupuesto», financiación, «Ana» ni «García» |
| Tareas propuestas | «Enviar a Ana los gastos de comunidad e IBI» (del dato de los gastos); «Confirmar la hora de la segunda visita del viernes» (IA o regla) | tareas sin dato de origen; fechas inventadas |

## DESPLIEGUE

- **Luis** (o Argo por la Management API, como en la 0008): aplicar
  `docs/deploy/supabase-fase-6.sql`; desplegar `drafts` (Via Editor con
  `index.ts` y `rules.ts`, o `supabase functions deploy drafts`). No hacen
  falta *secrets* nuevos (usa `EXTRACT_*`). Actualiza
  `supabase/functions/README.md`.
- Pages, como en las fases anteriores (con `404.html`).

## CRITERIOS DE ACEPTACIÓN

1. Con la nota de ejemplo, «Preparar seguimiento» produce los dos
   borradores y las tareas de la tabla, y cumple la columna «NO debe».
2. **Tests de `rules.ts`** con respuestas simuladas del modelo: un
   borrador al propietario con «230.000 €», «230000», «presupuesto»,
   «hipoteca» o el nombre de la clienta se rechaza; un borrador que dice
   «queda confirmada la visita del viernes a las 18:00» se rechaza; un
   marcador desconocido se rechaza; `ownerFacts` no incluye el dato de
   presupuesto; `requiredTasks` añade la tarea de confirmar si falta.
3. **Lo que se envía al modelo** (escríbelo en el HANDOFF, copiado del
   código): ni nombres, ni teléfonos, ni dirección, ni precio, ni citas; y
   la llamada del propietario no lleva el presupuesto.
4. En la base: insertar un borrador o una tarea de nota en una nota **no
   aprobada** falla con `nota_no_aprobada`; cambiar o borrar un borrador
   `aprobado` falla con `borrador_aprobado`; `completada → propuesta`
   falla con `transicion_no_valida`; borrar entera una nota aprobada con
   borradores y tareas **funciona** (cascada, RGPD).
5. Editar un borrador guarda `original_content` la primera vez; editar una
   tarea propuesta guarda `original_description`; las dos cosas persisten
   tras recargar.
6. «Volver a generar» sustituye solo el borrador no aprobado de ese
   destinatario y no toca las tareas aceptadas.
7. `/pendientes` agrupa bien por fecha (tests de `buckets.ts`), completar
   y reabrir funcionan, y las notas que piden acción aparecen en su grupo.
8. `/notas` lista, filtra por estado y busca sin tildes («garcia» encuentra
   a «García»).
9. **Prueba negativa:** `drafts` con el JWT de B sobre la nota de A → 404;
   B no ve ni cambia `tasks` ni `drafts` de A; sin JWT → 401.
10. Proveedor caído o sin clave → 502 en español y no se escribe nada (se
    acepta por el código si no se puede provocar en vivo).
11. `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run lint` sin
    errores (2 avisos de shadcn aceptados), trozo JS ≤ 500 kB; `deno check`
    de `drafts` si tienes Deno (si no, lo hace Claude en la revisión).
12. Cada pantalla y acción nueva probada **en el navegador**, a 360 px, sin
    desbordamiento ni errores de consola, en local y en Pages (lo que no
    puedas, pendiente para Luis con pasos concretos).

## ENTREGA

Termina con el bloque HANDOFF FASE 6 en `docs/HANDOFF.md`, commit «Fase 6:
borradores duales + bandeja de pendientes», etiqueta `v0.6-fase-6` y push a
`main`:

HANDOFF FASE 6
- Hecho: qué construiste realmente
- Tablas/columnas/triggers/políticas creadas o cambiadas (esperado: solo la
  0009)
- Edge Functions activas (y si `drafts` está desplegada)
- Rutas/pantallas nuevas o ampliadas
- Dependencias nuevas (esperado: ninguna de producción)
- Errores o warnings de build (tsc/lint/test/deno) y trozo JS mayor
- Qué se envía exactamente al modelo en cada llamada y qué devuelve con la
  nota de ejemplo (los borradores y las tareas, no la clave)
- Cuántas veces saltaron las reglas (reintentos, 422) en tus pruebas
- Supuestos tomados o pendientes
- Cómo probarlo (pasos y URL, con la nota de ejemplo)
