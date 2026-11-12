# FASE 7 DE 9 — EXPORTACIÓN AL CRM Y ENVÍO POR WHATSAPP

> Prompt escrito por Claude el 2026-11-12, al cerrar la Fase 6 (`drafts` v4
> verificada por API y Pages `1ecc966` desplegado). Constructor: Muse.
> **No empieces hasta que Luis lo pida** y hasta que el PR del cierre de la
> Fase 6 y de este prompt esté fusionado en `main`.
> Las decisiones marcadas «(decidido por Claude)» las confirma Luis al
> lanzar la fase; si cambia alguna, se anota en `docs/ESTADO.md` antes de
> empezar.

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: al terminar una visita, el
agente dicta o escribe lo ocurrido; la app lo transcribe, extrae datos con
su cita literal, el agente los revisa y aprueba, y la app prepara tareas y
dos borradores (comprador y propietario) que el agente revisa y aprueba.
**En esta fase** el agente puede **llevar** ese trabajo fuera de la app:
abrir WhatsApp con el borrador aprobado ya escrito y **exportar la ficha de
la visita** al CRM de la agencia (Inmovilla o Witei, simulado mientras no
haya acceso real a sus API), o copiarla si la agencia no tiene CRM. **La app
nunca envía nada sola:** en WhatsApp el agente pulsa «Enviar»; al CRM se
exporta solo cuando el agente pulsa «Exportar». Stack: React 19 + Vite 8 +
TypeScript estricto + Tailwind v4 + shadcn/ui + Supabase (Auth + Postgres +
Storage + Edge Functions) + Zod + react-router 8 + Vitest. Lee antes
`AGENTS.md` y `docs/ESTADO.md`.

## ESTADO ACTUAL

- **PRIMERO:** `git pull origin main`. No reviertas nada de lo que sigue.
- Fases 1–6 cerradas. Fase 6 (`v0.6-fase-6` + revisión, PR #10,
  migración 0009): Edge Function `drafts` **v4** (reglas de presupuesto,
  horas, nombres y citas), tareas en `tasks` (`propuesta → pendiente →
  completada`, `descartada`), borradores en `drafts` (`borrador →
  aprobado`, uno por nota y destinatario, el aprobado queda congelado),
  pantallas `/pendientes` y `/notas`, sección «Seguimiento» en
  `/notas/:id` con «Copiar» como único «envío».
- **Reglas de la base que condicionan esta fase:**
  - `visit_notes_guard` (0008) rechaza **cualquier** `update` de una nota
    `approved`. Todo el estado de la Fase 7 vive en `crm_exports`, nunca
    en `visit_notes`, `drafts` ni `tasks`.
  - `drafts_guard` (0009) congela el borrador `aprobado`: no lo marques
    como «enviado» en `drafts`.
- La tabla `crm_exports` existe desde la 0001 (`visit_note_id`, `target`
  ∈ `inmovilla|witei|whatsapp|manual`, `payload jsonb`, `status` ∈
  `pendiente|enviado|error`, `exported_at`, `created_at`) y tiene RLS desde
  la 0004 (a través de su nota). Hoy no tiene filas.
- `src/integrations/crm/` tiene la interfaz `CrmAdapter` y cuatro
  adaptadores *stub* («No implementado en Fase 1»); `getCrmAdapter(target)`
  elige uno con `clientConfig.crmTarget` (`VITE_CLIENT_CRM_TARGET`, por
  defecto `manual`).
- `src/lib/contact.ts` → `whatsappHref(phone)` ya normaliza el teléfono y
  devuelve `https://wa.me/<dígitos>` **sin texto** (Fase 3). Los teléfonos:
  comprador en `clients.phone`; propietario en `properties.owner_phone`.
- Datos de prueba: la nota de ejemplo de Ana García + V-18, **aprobada**,
  con el borrador del **propietario aprobado** y el del comprador en
  `borrador` (regenerado con la v4: «Hola Ana, …»). Para probar WhatsApp
  con los dos, aprueba antes el del comprador.
- La llamada al proveedor de IA sigue siendo lenta a veces; esta fase **no
  llama a la IA**.
- **Patrones que hay que mantener:** rutas estáticas sin `useParams`; fichas
  con `key = id`; `<Button asChild><Link/>`; errores de base con
  `translateDbError`; tipos a mano como `type`; etiqueta de fase solo en
  `src/lib/app-label.ts`; funciones puras de las Edge Functions en un
  archivo aparte (`rules.ts`, aquí `mappers.ts`) probadas con Vitest; **cada
  pantalla probada en el navegador**.
- Aplazados a la Fase 9 (no los toques): reintento de subida tras fallo
  parcial, URL firmada que se repide tras transcribir, y B-1 a B-4 de la
  revisión de la Fase 6 (en `docs/HANDOFF.md`).

## ALCANCE DE ESTA FASE

1. **Migración 0010:** columnas y reglas en `crm_exports`.
2. **WhatsApp para los borradores aprobados:** «Abrir en WhatsApp» con el
   texto ya escrito, al teléfono del comprador o del propietario, y
   registro en `crm_exports`.
3. **Ficha de la visita** (texto y JSON) a partir de la nota aprobada.
4. **Exportar al CRM:** Edge Function `crm-export` con un *mapper* por CRM
   (Inmovilla y Witei) y modo **simulado** mientras no haya acceso real.
   Sin CRM (`manual` o `whatsapp`): copiar la ficha o abrir WhatsApp con
   ella.
5. **Adaptadores** de `src/integrations/crm/` implementados.
6. `/notas/:id` (sección «Exportar»), `/pendientes` (grupo «Por
   exportar»), `/notas` (marca «Exportada»), etiqueta de fase.

## QUÉ NO TOCAR

- **Nada de envío automático** (exclusión del MVP): ni API de WhatsApp
  Business, ni envío programado, ni exportación al aprobar. Todo empieza
  con un toque del agente.
- No modificar las migraciones 0001–0009 ni las funciones `transcribe`,
  `extract` y `drafts`. No cambiar RLS existente ni los guards de
  `visit_notes`, `extracted_facts`, `tasks` y `drafts`.
- **Nunca** `service_role`. Las claves solo como *secrets*; Muse no las ve.
- **Minimización (RGPD) — decidido por Claude:** a la ficha y al CRM **no**
  van la transcripción, el texto de la nota, el audio (ni su ruta), las
  citas literales, los datos descartados ni los borradores. Van los datos
  revisados (categoría, nombre legible y valor), las tareas abiertas, el
  cliente (nombre, teléfono, email), la referencia y la dirección del
  inmueble, el nombre del agente y la fecha de la visita. El presupuesto va
  siempre como «declarado». El **propietario** solo recibe por WhatsApp su
  borrador aprobado (que ya pasó las reglas de la Fase 6), **nunca** la
  ficha.
- **No inventes la API de Inmovilla ni la de Witei.** Su acceso real está
  sin confirmar: los *mappers* producen un **formato propio documentado**
  («inmo-visitas v1» con la forma de cada CRM). Cuando haya acceso, solo
  cambiará `mappers.ts` y los *secrets*. Escríbelo así en el código y en
  el HANDOFF.
- No escribir en logs ni en `console.log` datos personales, la ficha, el
  *payload*, respuestas del CRM ni claves.
- No cambiar tokens de diseño, fuentes, ruta base ni Auth. Sin
  dependencias nuevas de producción.

## ESPECIFICACIÓN (crear exactamente así)

### Migración `supabase/migrations/0010_exportaciones.sql`

Y una copia idéntica en `docs/deploy/supabase-fase-7.sql` (como en la
Fase 6), idempotente (`if not exists`, `drop … if exists`).

1. Columnas nuevas en `crm_exports`:
   - `kind text not null default 'nota' check (kind in ('nota',
     'borrador'))` — qué se lleva fuera: la ficha de la nota o un borrador.
   - `draft_id uuid references public.drafts (id) on delete cascade` —
     obligatorio si `kind = 'borrador'`, nulo si `kind = 'nota'`
     (`check`).
   - `audience text check (audience in ('comprador', 'propietario'))` —
     obligatorio si `kind = 'borrador'`.
   - `external_id text`, `error_message text` (≤ 300 caracteres, en
     español, sin datos personales), `updated_at timestamptz`.
   - `visit_note_id` pasa a `not null` (no hay filas).
2. Estados: se sustituye el `check` de `status` por `pendiente | enviado |
   error | entregado`. `entregado` = la app se lo dio al agente (WhatsApp
   abierto con el texto, ficha copiada); la app **no** sabe si llegó a
   enviarse. `enviado` solo lo usa el CRM.
3. Combinaciones válidas (`check`):
   - `target in ('inmovilla','witei')` → `kind = 'nota'`.
   - `target = 'whatsapp'` → `kind` `nota` o `borrador`.
   - `target = 'manual'` → `kind = 'nota'`.
4. Trigger `crm_exports_guard` (`before insert or update or delete`,
   `security invoker`, mismo estilo que `drafts_guard`):
   - Insert: la nota debe estar `approved` → si no, `nota_no_aprobada`.
     Si `kind = 'borrador'`, el borrador debe ser de **esa** nota, de ese
     `audience` y estar `aprobado` → si no, `borrador_no_aprobado`.
   - Insert con `target` `inmovilla`/`witei` nace `pendiente`; con
     `whatsapp`/`manual` nace `entregado` y pone `exported_at := now()`.
     Otro estado inicial → `exportacion_no_valida`.
   - Update: solo `pendiente → enviado` (pone `exported_at := now()`) o
     `pendiente → error`, y solo cambian `status`, `external_id`,
     `error_message`, `payload` y `updated_at := now()`. Una fila
     `enviado`, `error` o `entregado` no cambia → `exportacion_cerrada`.
     Reintentar = **fila nueva**: cada intento queda registrado.
   - Delete: solo por la cascada del borrado de la nota (RGPD), como en
     `drafts_guard`; si no, `exportacion_cerrada`.
5. Índice `crm_exports (visit_note_id, created_at desc)`.

### Errores nuevos en `translateDbError` (`P0001` por mensaje)

- `borrador_no_aprobado` → «Aprueba el borrador antes de enviarlo.»
- `exportacion_no_valida` → «Esta exportación no es válida.»
- `exportacion_cerrada` → «Esta exportación ya está cerrada; si quieres,
  vuelve a exportar.»
- `nota_no_aprobada` ya existe: comprueba que el texto sirve aquí
  («Aprueba la nota antes de …»).

### WhatsApp: `src/lib/contact.ts`

- `whatsappHref(phone, text?)`: si hay `text`, añade `?text=` con
  `encodeURIComponent` (saltos de línea, «€», tildes, `&`, `?`, `#` y
  emojis). Sin `text`, igual que hoy (los botones de contacto de la Fase 3
  no cambian). Teléfono no válido o vacío → `null`.
- `whatsappShareHref(text)`: `https://wa.me/?text=…` (sin número: el
  agente elige el chat). Se usa para la ficha cuando el CRM es `whatsapp`.
- El texto más largo posible es un borrador de 1500 caracteres; el enlace
  resultante cabe de sobra en los límites de los navegadores móviles.
  Añade un test con 1500 caracteres variados.

### Ficha de la visita: `src/features/export/summary.ts` (pura, con tests)

- `buildVisitSummary(input)` → `{ text, json }` con la entrada **ya
  filtrada**: nota aprobada (`id`, `created_at`, `approved_at`), cliente
  (`full_name`, `phone`, `email`, `is_temporary`), inmueble (`reference`,
  `address`, `city`), agente (`full_name`), datos con `review_status` ≠
  `descartado` (`category`, `field_name`, `value`) y tareas `pendiente`
  (`description`, `due_date`).
- `text` (para copiar o WhatsApp), en este orden y en español:

  ```
  Visita V-18 · Calle de Alcalá 120, Madrid
  12 nov 2026, 18:40 · Agente: <nombre>
  Cliente: Ana García · +34 6xx xxx xxx · <email>
  Hechos declarados:
  - Presupuesto (declarado): 230.000 €
  - …
  Observaciones:
  - …
  Pendiente de saber:
  - …
  Tareas:
  - Confirmar la hora de la segunda visita del viernes (sin fecha)
  - …
  ```

  Grupos por `category` (las seis de la base: hechos declarados,
  observaciones, objeciones, presupuesto, citas pendientes y pendiente de
  saber) con los nombres de `src/features/extraction/labels.ts`; los grupos
  vacíos no salen; nombres legibles de los campos (los mismos que en
  «Revisar»),
  fecha y hora de `Europe/Madrid`, cliente provisional con «(provisional)».
  ≤ 3000 caracteres; si pasa, recorta las tareas y añade «…».
- `json`: el mismo contenido estructurado, `schema: 'inmo-visitas.v1'`.
- **Tests:** no aparecen la transcripción, el texto de la nota, la ruta del
  audio, ninguna cita ni ningún dato descartado; el presupuesto sale como
  «(declarado)»; agrupación y orden; recorte a 3000; zona horaria de
  Madrid en el cambio de día.

### Edge Function `supabase/functions/crm-export/` (Deno)

`index.ts` + `mappers.ts` (puro, probado con Vitest como `rules.ts`).

- Entrada: `POST { "visit_note_id": "<uuid>", "target": "inmovilla" |
  "witei" }`. Valida con Zod; otro `target` → 400.
- Autenticación: JWT verificado por Supabase; cliente con la clave anon y
  la cabecera `Authorization`: todo pasa por RLS como ese agente. **Nunca
  `service_role`.** Sin JWT → 401. Nota que no ve → 404. Nota no
  aprobada → 409 «Aprueba la nota antes de exportarla.»
- Si ya hay una fila `enviado` de esa nota y ese `target` → 200 con ella,
  **sin** volver a llamar al CRM (`already_exported: true`).
- Lee la nota, el cliente, el inmueble, el agente, los datos no
  descartados y las tareas `pendiente`, y construye el *payload* con
  `mapToInmovilla(summaryJson)` o `mapToWitei(summaryJson)`. La función
  **construye su propio JSON** (no confía en el que mande el navegador);
  copia en `mappers.ts` lo mínimo de `buildVisitSummary` que necesite, sin
  importar de `src/`.
- Inserta la fila `pendiente` con el *payload*; después:
  - **Modo simulado** (falta `CRM_WEBHOOK_URL`): valida el *payload* con
    el esquema Zod de ese CRM y, si pasa, actualiza a `enviado` con
    `external_id = 'SIM-' + <8 primeros del id>` y `payload.simulated =
    true`. **No sale nada de Supabase.**
  - **Modo webhook** (hay `CRM_WEBHOOK_URL`): `POST` del *payload* con
    `Content-Type: application/json`, `Idempotency-Key: <id de la fila>`
    y, si hay `CRM_WEBHOOK_SECRET`, `X-InmoVisitas-Signature: sha256=<HMAC
    del cuerpo>` (Web Crypto). *Timeout* de 15 s y **un** reintento con la
    misma `Idempotency-Key` si hay *timeout* o 5xx. 2xx → `enviado` con
    `external_id` de la respuesta (`id` o `external_id`, si viene).
    Otro caso → `error` con `error_message` genérico en español («El CRM
    no respondió», «El CRM rechazó la ficha (código 422)») y la función
    responde 502.
- `mappers.ts` exporta los esquemas Zod de cada formato, `mapToInmovilla`,
  `mapToWitei` y `signBody`. Formato **propio** (no la API real), por
  ejemplo: Inmovilla → `{ schema, referencia, cliente: { nombre, telefono,
  email }, visita: { fecha, agente }, comentarios, datos: [...], tareas:
  [...] }`; Witei → `{ schema, property_reference, contact: { name, phone,
  email }, visit: { date, agent }, notes, facts: [...], tasks: [...] }`.
  `comentarios`/`notes` = el `text` de la ficha.
- **Tests de `mappers.ts`:** los dos formatos pasan su esquema con la nota
  de ejemplo; ninguno lleva transcripción, citas, audio ni datos
  descartados; el presupuesto va como declarado; `signBody` da el HMAC
  esperado de un vector fijo; un *payload* incompleto no pasa el esquema.
- *Secrets* opcionales: `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET`. **En
  pruebas no se crean** (modo simulado). Documenta en
  `supabase/functions/README.md` cómo se probaría contra un receptor de
  pruebas propio cuando haga falta.
- Respuestas: `{ export: { id, status, external_id, exported_at },
  simulated: boolean, already_exported: boolean }`. Errores en español.
  Ni el *payload* ni la respuesta del CRM en los logs.

### Adaptadores `src/integrations/crm/`

- `types.ts`: `exportVisitNote(input: VisitNoteExportInput):
  Promise<CrmExportResult>`, con `VisitNoteExportInput = { visitNoteId,
  summary: { text, json } }` y `CrmExportResult = { ok, status?:
  'enviado' | 'entregado' | 'error', exportId?, externalId?, simulated?,
  error? }`. Actualiza el comentario de la interfaz (ya no son *stubs*).
- `inmovilla.ts` / `witei.ts`: `functions.invoke('crm-export', { body: {
  visit_note_id, target } })`; mensaje del error de la función si falla.
- `manual.ts`: copia `summary.text` al portapapeles (si falla, devuelve
  `ok: false` para que la UI muestre el texto seleccionable) e inserta la
  fila `manual` / `nota` / `entregado`.
- `whatsapp.ts`: devuelve el `whatsappShareHref(summary.text)` para que la
  UI lo abra y registra `whatsapp` / `nota` / `entregado`.
- Añadir un CRM sigue siendo añadir un adaptador (y un *mapper*).

### Pantalla `/notas/:id` — botones de WhatsApp en «Seguimiento»

En cada tarjeta de borrador **aprobado**, junto a «Copiar»:

- «Abrir en WhatsApp»: un `<a target="_blank" rel="noopener">` con
  `whatsappHref(teléfono, content)` (comprador → `clients.phone`;
  propietario → `properties.owner_phone`). Al pulsarlo se registra la fila
  `whatsapp` / `borrador` / `entregado` (sin bloquear la apertura; si el
  registro falla, aviso discreto «No se pudo registrar el envío»).
- Sin teléfono o no válido: botón desactivado con «Falta el teléfono» y
  enlace a la ficha del cliente o del inmueble para añadirlo. Cliente
  provisional sin teléfono: igual.
- Debajo: «Abierto en WhatsApp el 12 nov 2026, 19:05» (la última fila de
  ese borrador) y la nota fija «Revisa y pulsa Enviar en WhatsApp: la app
  no lo envía por ti.»
- En un borrador sin aprobar **no** hay botón de WhatsApp (solo «Copiar»,
  como en la Fase 6).

### Pantalla `/notas/:id` — sección «Exportar» (nueva)

Solo con la nota `approved`, debajo de «Seguimiento»:

- «Vista previa de la ficha» (plegable): el `text` de `buildVisitSummary`
  en un bloque de solo lectura.
- Botón principal según `clientConfig.crmTarget`:
  - `inmovilla` / `witei`: «Exportar a Inmovilla» / «Exportar a Witei»
    (etiqueta del adaptador) → «Exportando…» → «Exportada a Inmovilla el
    … (ID SIM-1a2b3c4d)». En modo simulado, la etiqueta «Simulado» junto
    al estado. Error: el mensaje y «Reintentar» (fila nueva).
  - `manual`: «Copiar ficha» → «Ficha copiada».
  - `whatsapp`: «Compartir ficha por WhatsApp» (enlace sin número).
  - Siempre, como acción secundaria: «Copiar ficha» (para pegarla donde
    quiera; registra `manual`).
- Historial plegable «Exportaciones (N)»: fecha, destino, tipo (ficha o
  borrador al comprador/propietario), estado legible («Enviada»,
  «Entregada al agente», «Error», «En curso») y ID externo.
- **Métricas del piloto** en el resumen de seguimiento: «Exportada: sí/no
  · WhatsApp abierto: comprador sí/no, propietario sí/no».

### `/pendientes` y `/notas`

- `/pendientes`: grupo nuevo «Por exportar» con las notas `approved` que
  no tienen ninguna fila `enviado` ni `entregado` de `kind = 'nota'`.
- `/notas`: si está aprobada, «Exportada» o «Sin exportar», junto a
  «Seguimiento: …».
- Portada: texto de fase «Fase 7 — Exportación al CRM y WhatsApp».
  `APP_PHASE_LABEL = 'inmo-visitas · Fase 7'`.

### Tipos y capa de datos

- `database.types.ts`: `CrmExportRow`/`Insert`/`Update`, `CrmExportStatus`,
  `CrmExportKind`.
- `src/features/export/api.ts`: `loadExportContext(noteId)` (lo necesario
  para la ficha, en pocas consultas), `listNoteExports(noteId)`,
  `recordDelivery({ noteId, target, kind, draftId?, audience? })`,
  `exportToCrm(noteId, target)`.

### Datos de ejemplo para probar (ficticios)

Con la nota aprobada de Ana García + V-18 (aprueba antes el borrador del
comprador) y un teléfono ficticio en el cliente y en el inmueble:

| Acción | Esperado | NO debe |
|---|---|---|
| «Abrir en WhatsApp» (comprador) | `wa.me/34…?text=Hola%20Ana%2C…` con el borrador aprobado entero; fila `whatsapp/borrador/entregado` | enviar nada; abrirse con un borrador sin aprobar |
| «Abrir en WhatsApp» (propietario) | al `owner_phone`, con su borrador | llevar la ficha, el presupuesto ni el nombre de Ana |
| Vista previa / «Copiar ficha» | grupos, «Presupuesto (declarado): 230.000 €», tareas pendientes, hora de Madrid | transcripción, citas, ruta del audio, datos descartados |
| «Exportar a Inmovilla» (simulado) | 200, fila `enviado` con `SIM-…`, «Simulado»; el segundo toque devuelve la misma fila | llamar a ningún host externo |

## DESPLIEGUE

- **Luis** (o Argo por la Management API, como la 0009): aplicar
  `docs/deploy/supabase-fase-7.sql`; desplegar `crm-export` (Via Editor
  con `index.ts` y `mappers.ts`, con verificación de JWT activada). No hay
  *secrets* nuevos en pruebas (modo simulado). Actualiza
  `supabase/functions/README.md`.
- Para probar Inmovilla y Witei en el navegador: build con
  `VITE_CLIENT_CRM_TARGET=inmovilla` (y otra con `witei`) en local; Pages
  se queda con `manual` salvo que Luis diga otra cosa.
- Pages, como en las fases anteriores (con `404.html`).

## CRITERIOS DE ACEPTACIÓN

1. Con la nota de ejemplo, las cuatro filas de la tabla se cumplen, en el
   navegador y en el móvil de Luis (WhatsApp real con números ficticios o
   el propio).
2. **Tests** de `whatsappHref` con texto (codificación, 1500 caracteres,
   teléfono no válido), de `buildVisitSummary` y de `mappers.ts` (lo que
   piden sus apartados).
3. **Lo que sale de la app** (escríbelo en el HANDOFF, copiado del
   código): el texto de WhatsApp de cada destinatario, la ficha y el
   *payload* de cada CRM con la nota de ejemplo. Ni transcripción, ni
   citas, ni audio, ni datos descartados; al propietario solo su borrador.
4. En la base: insertar una exportación de una nota **no aprobada** falla
   con `nota_no_aprobada`; un `borrador` sin aprobar o de otra nota falla
   con `borrador_no_aprobado`; `manual` con `pendiente` o `inmovilla` con
   `kind = 'borrador'` fallan; cambiar una fila `enviado`/`entregado`/
   `error` falla con `exportacion_cerrada`; borrar entera una nota con
   exportaciones **funciona** (cascada, RGPD).
5. `crm-export` en modo simulado: 200 y `enviado`; segunda llamada → la
   misma fila con `already_exported: true`; nota no aprobada → 409.
6. Modo webhook con un receptor que falla (o por el código si no puedes
   montarlo): fila `error`, 502 en español, sin datos en el mensaje, y el
   «Reintentar» crea una fila nueva.
7. **Prueba negativa:** `crm-export` con el JWT de B sobre la nota de A →
   404; B no ve ni inserta `crm_exports` de A (tampoco con `kind =
   'borrador'` apuntando a un borrador de A); sin JWT → 401.
8. `/pendientes` muestra «Por exportar» y desaparece la nota al exportarla
   o copiar la ficha; `/notas` muestra «Exportada».
9. `npm test`, `npx tsc --noEmit`, `npm run build` (base `/` y
   `/inmo-visitas/`), `npm run lint` sin errores (2 avisos de shadcn
   aceptados), trozo JS ≤ 500 kB; `deno check` de `crm-export` si tienes
   Deno (si no, lo hace Claude en la revisión).
10. Cada pantalla y acción nueva probada **en el navegador**, a 360 px, sin
    desbordamiento ni errores de consola, en local y en Pages (lo que no
    puedas, pendiente para Luis con pasos concretos).

## ENTREGA

Termina con el bloque HANDOFF FASE 7 en `docs/HANDOFF.md`, commit «Fase 7:
exportación al CRM y WhatsApp», etiqueta `v0.7-fase-7` y push a `main`:

HANDOFF FASE 7
- Hecho: qué construiste realmente
- Tablas/columnas/triggers/políticas creadas o cambiadas (esperado: solo la
  0010)
- Edge Functions activas (y si `crm-export` está desplegada y en qué modo)
- Rutas/pantallas nuevas o ampliadas
- Dependencias nuevas (esperado: ninguna de producción)
- Errores o warnings de build (tsc/lint/test/deno) y trozo JS mayor
- Lo que sale de la app en cada caso (WhatsApp ×2, ficha, Inmovilla,
  Witei) con la nota de ejemplo
- Supuestos tomados o pendientes (en especial, el formato propio de los
  CRM)
- Cómo probarlo (pasos y URL, con la nota de ejemplo)
