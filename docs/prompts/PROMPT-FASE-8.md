# FASE 8 DE 9 — SEGURIDAD, BORRADO Y RGPD

> Prompt escrito por Claude el 2026-11-13, al cerrar la Fase 7 (0011
> aplicada, Pages `7ac0529`, prueba de Luis en el móvil). Constructor:
> Muse (o Argo). **No empieces hasta que Luis lo pida** y hasta que el PR
> de este prompt esté fusionado en `main`.
> Las decisiones marcadas «(decidido por Claude)» las confirma Luis al
> lanzar la fase; si cambia alguna, se anota en `docs/ESTADO.md` antes de
> empezar. Las marcadas «(decide Luis)» **no son de código**: el
> constructor no las toma ni las da por hechas.

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: el agente dicta o escribe lo
ocurrido en una visita; la app lo transcribe, extrae datos con su cita
literal, el agente los revisa y aprueba, prepara tareas y borradores, y
lleva la ficha al CRM o a WhatsApp. Hasta ahora se ha probado **solo con
datos ficticios**. **Esta fase** prepara la app para un piloto con datos
reales: cierra los huecos de seguridad conocidos, hace posible **borrar y
entregar** los datos de una persona desde la app (derechos de supresión y
de acceso del RGPD, arts. 15, 17 y 20), reduce lo que se guarda (audio) y
deja la documentación que Luis necesita para decidir lo jurídico. Stack:
React 19 + Vite 8 + TypeScript estricto + Tailwind v4 + shadcn/ui + Supabase
(Auth + Postgres + Storage + Edge Functions) + Zod + react-router 8 +
Vitest. Lee antes `AGENTS.md` y `docs/ESTADO.md`.

## ESTADO ACTUAL

- **PRIMERO:** `git pull origin main`. No reviertas nada de lo que sigue.
- Fases 1–7 cerradas. Migraciones 0001–0011 aplicadas en el proyecto
  `inmo-visitas-pruebas` (UE). Edge Functions activas: `transcribe`,
  `extract`, `drafts`, `crm-export` (todas con verificación de JWT, clave
  anon + JWT del agente, **nunca `service_role`**).
- RLS por agente en todas las tablas (0004 y siguientes). Bucket privado
  `visit-audio` con carpeta por agente y políticas de `select`, `insert` y
  `delete` propias (0006). `audio_url` guarda la ruta, no una URL.
- **Lo que hoy falta (comprobado por Claude el 13 nov.):**
  - **No hay forma de borrar una nota** desde la app. La base lo permite
    (cascada a datos, tareas, borradores y exportaciones), pero no hay
    botón.
  - **Un cliente o un inmueble con notas no se puede borrar**:
    `visit_notes.client_id` y `property_id` son `on delete restrict`.
  - **Borrar una nota dejaría su audio huérfano** en Storage: nada lo
    borra.
  - No se pueden **entregar** los datos de un cliente (acceso y
    portabilidad).
  - Avisos de seguridad de Supabase (*Advisors*):
    - `function_search_path_mutable` en `visit_notes_guard`,
      `visit_notes_insert_guard`, `extracted_facts_guard`, `tasks_guard`,
      `drafts_guard` y `crm_exports_guard`;
    - `handle_new_agent()` (`security definer`) ejecutable por `anon` y
      `authenticated` vía `/rest/v1/rpc`;
    - `rls_auto_enable()` igual: es la función del *event trigger*
      `ensure_rls` que creó Supabase, no está en nuestras migraciones;
    - `demo_seed_claim` con RLS y sin políticas (el reclamo de la demo);
    - protección de contraseñas filtradas desactivada (ajuste de Auth).
- **Aplazados que entran en esta fase:**
  - **B-4:** `tasks_guard` y `drafts_guard` no impiden cambiar
    `visit_note_id`, `origin` ni `audience` en un `update`.
  - **B-6:** un agente puede pasar su propia exportación de `pendiente` a
    `enviado` con un PATCH directo.
  - **B-9:** CORS con `https://luisetic.github.io` escrito en el código de
    las cuatro funciones, y `crm_exports.external_id` sin límite.
- **Aplazados que NO entran (Fase 9):** B-1, B-2, B-3, B-5, B-7, B-8,
  reintento de subida y URL firmada. No los toques.
- **Patrones que hay que mantener:** rutas estáticas sin `useParams`;
  fichas con `key = id`; `<Button asChild><Link/>`; errores de base con
  `translateDbError`; tipos a mano como `type`; etiqueta de fase solo en
  `src/lib/app-label.ts`; funciones puras de las Edge Functions en un
  archivo aparte probado con Vitest; **cada pantalla probada en el
  navegador**; las migraciones se aplican como SQL directo (no hay
  historial de migraciones en Supabase).

## ALCANCE DE ESTA FASE

1. **Migración 0012:** avisos de Supabase, B-4, B-9 (`external_id`),
   cola de borrado de audios, borrado de notas, clientes e inmuebles,
   registro de acciones, límite diario de IA, formato de contacto en la
   base y retirada del reclamo de la demo.
2. **Borrado desde la app** (derecho de supresión): nota, cliente con
   todas sus notas y datos del propietario de un inmueble, con su audio.
3. **Entrega de datos** de un cliente en un archivo JSON (acceso y
   portabilidad).
4. **Menos audio guardado:** el audio se borra al aprobar la nota.
5. **Edge Functions:** CORS configurable (B-9) y límite diario de
   llamadas a la IA por agente.
6. **Documentación RGPD** en `docs/rgpd/` (borradores para que Luis los
   revise con un profesional) y limpieza de datos personales del repo.

## QUÉ NO TOCAR

- **No decidas lo jurídico.** Base legal, textos legales definitivos,
  proveedor de IA definitivo, plan de pago y contratos de encargo (DPA)
  son de Luis (y de su asesor). El constructor solo deja borradores y
  listas de comprobación, marcados como «BORRADOR — revisar con un
  profesional».
- **Nunca** `service_role`. Las claves solo como *secrets*; el
  constructor no las ve.
- No modificar las migraciones 0001–0011. Los cambios van en la 0012.
- No cambiar la lógica de transcripción, extracción, borradores ni
  exportación, salvo CORS y el límite diario (que se añaden delante).
- No escribir en logs ni en `console.log` datos personales, textos de
  notas, rutas de audio ni claves.
- No cambiar tokens de diseño, fuentes, ruta base ni Auth en el código.
  Sin dependencias nuevas de producción.
- **No borres datos del proyecto de pruebas** por tu cuenta: la limpieza
  es un script que se ejecuta solo cuando Luis lo apruebe (ver
  DESPLIEGUE).

## ESPECIFICACIÓN (crear exactamente así)

### Migración `supabase/migrations/0012_seguridad_rgpd.sql`

Copia idéntica en `docs/deploy/supabase-fase-8.sql`, idempotente
(`if not exists`, `drop … if exists`, `create or replace`).

1. **`search_path` fijo** en las seis funciones de guarda:
   `alter function public.<nombre>() set search_path = public, pg_temp;`.
   Comprueba que sus cuerpos usan `public.` en todas las tablas.
2. **Funciones `security definer`:** `revoke execute on function
   public.handle_new_agent() from public, anon, authenticated;` y lo mismo
   con `public.rls_auto_enable()`. Los *triggers* siguen funcionando: el
   permiso de ejecutar no afecta a un *trigger*. Añade `set search_path =
   public, pg_temp` a `handle_new_agent`.
3. **Retirar el reclamo de la demo:** redefine `handle_new_agent()` sin el
   bloque «SOLO DEMO» (solo crea la fila de `agents`) y `drop table if
   exists public.demo_seed_claim`.
4. **B-4:** en `tasks_guard` y `drafts_guard`, un `update` que cambie
   `visit_note_id`, `origin` (tareas) o `audience` (borradores) falla con
   `cambio_no_permitido`. Copia la función entera de la 0009 y añade solo
   esa comprobación.
5. **B-9:** `check (char_length(external_id) <= 200)` en `crm_exports`.
6. **B-6 — (decidido por Claude):** **se acepta y se documenta**, no se
   arregla. Cerrar la exportación solo desde el servidor exigiría
   `service_role` en `crm-export`, contra la norma del proyecto, y el
   único efecto es que un agente falsee sus propias métricas. Anótalo en
   `docs/rgpd/riesgos.md` (ver más abajo).
7. **Cola de borrado de audios** `public.audio_cleanup`: `id uuid pk`,
   `agent_id uuid not null default auth.uid() references public.agents
   (id) on delete cascade`, `path text not null`,
   `reason text check (reason in ('nota_borrada', 'nota_aprobada'))`,
   `created_at`. RLS: `select`, `insert` y `delete` solo del propio
   agente (`agent_id = auth.uid()`); **sin** `update`. Los *triggers*
   insertan con los permisos del agente (`visit_notes_guard` es
   `security invoker`), así que hace falta la política de `insert`; un
   agente que inserte rutas falsas solo afectaría a su propia carpeta de
   `visit-audio`, que ya protegen las políticas de la 0006. La cola
   guarda la ruta y nada más.
   - *Trigger* `before delete` en `visit_notes`: si `old.audio_url` no es
     nulo, inserta `(old.agent_id, old.audio_url, 'nota_borrada')`.
   - **Audio al aprobar — (decidido por Claude):** en `visit_notes_guard`,
     al pasar a `approved` y si `old.audio_url` no es nulo, `new.audio_url
     := null` e inserta `(old.agent_id, old.audio_url, 'nota_aprobada')`.
     Motivo: una vez aprobada, la fuente es la transcripción revisada y el
     audio ya no hace falta (minimización, art. 5.1.c y 25 RGPD). Copia la
     función entera de la 0008 y añade solo esto.
8. **Borrado de cliente e inmueble** (`security invoker`, todo pasa por
   RLS):
   - `public.erase_client(p_client_id uuid) returns void`: borra las
     notas de ese cliente (su cascada se lleva datos, tareas, borradores y
     exportaciones, y el *trigger* encola los audios), después el cliente,
     y registra la acción (punto 9). Cliente que el agente no ve → `raise
     exception 'no_encontrado'`.
   - `public.erase_property_owner(p_property_id uuid) returns void`:
     `owner_name := 'Propietario borrado'`, `owner_phone := null` y
     registra la acción. No toca las notas: sus textos pueden nombrar al
     propietario, y eso lo avisa la UI (ver más abajo).
   - `grant execute … to authenticated` y `revoke … from anon, public`.
9. **Registro de acciones** `public.audit_events`: `id`, `agent_id uuid not
   null default auth.uid() references public.agents (id) on delete
   cascade`, `action text check (action in
   ('nota_borrada', 'cliente_borrado', 'propietario_borrado',
   'datos_entregados'))`, `entity_id uuid`, `created_at`. **Sin datos
   personales** (ni nombres, ni textos, ni rutas). RLS: `select` e
   `insert` del propio agente; **sin** `update` ni `delete`: es de solo
   inserción. Se borra solo con la cuenta del agente (cascada desde
   `agents`). Sirve para rendir cuentas (art. 5.2 RGPD).
10. **Límite diario de IA** `public.ai_calls`: `id`, `agent_id uuid not
    null default auth.uid() references public.agents (id) on delete
    cascade`, `fn text check (fn in ('transcribe',
    'extract', 'drafts'))`, `created_at`. RLS: `select` e `insert` del
    propio agente, **sin** `update` ni `delete` (no puede borrar su
    cuenta de llamadas). Índice `(agent_id, created_at)`.
11. **Formato de contacto en la base** (pendiente desde la Fase 3):
    normaliza antes los datos existentes (quitar espacios, puntos,
    guiones y paréntesis de `clients.phone` y `properties.owner_phone`;
    `lower(trim())` en `clients.email`) y después `check` con
    `phone ~ '^\+[1-9][0-9]{7,14}$'` (y lo mismo en `owner_phone`) y
    `email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'`,
    nulos permitidos. El seed tiene `+34 611 100 200`: tras normalizar
    debe pasar. Antes de añadir los `check`, la migración comprueba si
    queda alguna fila que no cumpla; si la hay, se detiene con un error
    que dice cuántas (sin mostrar los datos), para revisarlas a mano.
    Nunca cambia ni borra datos que no sepa normalizar.

### Errores nuevos en `translateDbError` (`P0001` por mensaje)

- `cambio_no_permitido` → «Este cambio no está permitido.»
- `no_encontrado` → «No se ha encontrado.»
- `limite_diario_ia` (lo devuelven las funciones, ver abajo) → «Has
  llegado al límite diario de usos de la IA. Vuelve a intentarlo
  mañana.»
- `23514` en `clients`/`properties` (formato de contacto) → «El teléfono o
  el email no tienen un formato válido.»

### Cola de audios en el navegador: `src/features/privacy/audio-cleanup.ts`

- `flushAudioCleanup()`: lee las filas propias de `audio_cleanup`, borra
  esas rutas de `visit-audio` con `storage.remove` (en lotes de 50) y
  borra de la cola **solo** las filas cuyo objeto se borró o ya no
  existía. Si falla, no lanza: se reintenta la próxima vez.
- Se llama: al iniciar sesión (en `AuthProvider`, una vez por sesión),
  después de aprobar una nota y después de cada borrado.
- **Tests** con un cliente simulado: lotes, fallo parcial (las filas
  fallidas se quedan) y objeto que ya no existe (la fila se va).

### Borrado desde la app (derecho de supresión, art. 17)

Todas las confirmaciones dicen qué se borra y que **no se puede deshacer**.
Tras borrar, `flushAudioCleanup()` y vuelta a la lista.

- **`/notas/:id` → «Borrar nota»** (en cualquier estado), al final de la
  página, estilo destructivo de los tokens: «Se borrarán la nota, su
  audio, sus datos, tareas, borradores y exportaciones.» `delete` de la
  nota y fila `nota_borrada` en `audit_events`.
- **`/clientes/:id` → «Borrar cliente y todos sus datos»** (sustituye al
  «Borrar» actual cuando el cliente tiene notas; sin notas, igual que hoy
  pero también con registro). Confirmación que cuenta las notas («Se
  borrarán Ana García y sus 3 notas…») y pide escribir el nombre del
  cliente para confirmar. Llama a `rpc('erase_client')`.
- **`/inmuebles/:id` → «Borrar datos del propietario»**: `rpc
  ('erase_property_owner')`. Aviso: «Los textos de las notas pueden
  nombrar al propietario: revísalos o bórralos si lo pide.» El «Borrar»
  del inmueble sigue como hoy (solo sin notas).
- Los borradores de WhatsApp ya enviados y las fichas exportadas a un CRM
  están **fuera** de la app: la confirmación lo dice («Lo que ya enviaste
  por WhatsApp o exportaste al CRM hay que borrarlo allí»).

### Entrega de datos (acceso y portabilidad, arts. 15 y 20)

- **`/clientes/:id` → «Descargar sus datos»**: un archivo
  `datos-cliente-<YYYY-MM-DD>.json` (sin el nombre en el nombre del
  archivo) con: el cliente; sus notas (fecha, inmueble por referencia,
  tipo, estado, texto y transcripción); por nota, los datos (categoría,
  campo, valor, cita, estado de revisión), las tareas, los borradores y
  las exportaciones (destino, tipo, estado y fechas, **sin** `payload`).
  `schema: 'inmo-visitas.datos-cliente.v1'` y `generated_at`. Sin audio
  (se entrega aparte si lo piden y aún existe). Registra
  `datos_entregados`.
- Función pura `buildClientDataExport(input)` en
  `src/features/privacy/export.ts` con tests (estructura, sin `payload`,
  sin rutas de audio, sin datos de otros clientes).

### Edge Functions

- **CORS configurable (B-9)** en las cuatro funciones: los orígenes salen
  del *secret* `ALLOWED_ORIGINS` (lista separada por comas). Si falta, se
  usan los actuales (`http://localhost:5173`, `http://localhost:4173`,
  `https://luisetic.github.io`). Función pura `allowedOrigins(env)` con
  tests, copiada en cada función (no pueden compartir archivo hoy).
- **Límite diario de IA** en `transcribe`, `extract` y `drafts`, antes de
  llamar al proveedor y después de comprobar la nota: cuenta las filas de
  `ai_calls` del agente desde las 00:00 de `Europe/Madrid`; si llega al
  límite → 429 `{ "error": "limite_diario_ia", "message": "Has llegado
  al límite diario…" }`; si no, inserta su fila y sigue. El límite sale
  del *secret* `AI_DAILY_LIMIT` (por defecto **150**). Los reintentos
  internos de una misma llamada cuentan como una. Una respuesta ya
  guardada (p. ej. nota ya transcrita) no cuenta. Función pura
  `madridDayStart(now)` con tests (cambio de hora incluido).
- La UI muestra el mensaje del 429 donde hoy muestra los errores de cada
  función.

### `/perfil` — sección «Privacidad»

- Texto breve (BORRADOR, editable por Luis en
  `src/features/privacy/texts.ts`): qué guarda la app, a qué proveedores
  van los textos (transcripción, extracción y borradores) y que el audio
  se borra al aprobar la nota.
- Recordatorio fijo en `/capturar`: «Dicta tu propia nota. No grabes al
  cliente sin su permiso.» (si ya existe uno equivalente, no lo dupliques).
- Enlace «Mis acciones de privacidad»: lista de `audit_events` propios
  (fecha y acción; sin nombres, porque no los guarda).

### Documentación `docs/rgpd/` (BORRADORES — revisar con un profesional)

- `registro-actividades.md`: borrador del registro de actividades de
  tratamiento (art. 30): finalidad, categorías de interesados (compradores,
  propietarios, agentes) y de datos, destinatarios, transferencias,
  plazos y medidas. Con huecos «(decide Luis)».
- `encargados.md`: tabla de encargados y proveedores con lo que recibe
  cada uno y en qué región: Supabase (UE), proveedor de transcripción
  (Groq en pruebas), proveedor de extracción y borradores (Google Gemini
  en pruebas), GitHub Pages (solo staging, sin datos), Hostinger/Coolify
  (producción). Columna «DPA firmado» vacía para Luis. **No afirmes
  condiciones de un proveedor sin enlazar su documento**; si no tienes
  acceso, escribe «comprobar».
- `riesgos.md`: riesgos abiertos y aceptados: B-6, textos libres que
  pueden nombrar a terceros, plan gratuito de los proveedores de IA,
  copia de seguridad (plan Free sin copias), datos fuera de la app (CRM y
  WhatsApp).
- `checklist-piloto.md`: lo que tiene que estar hecho antes de usar datos
  reales, con casillas (ver DESPLIEGUE).

### Limpieza del repositorio (repo público)

- Sustituye en `docs/HANDOFF.md` los emails reales de prueba por
  marcadores (`<email-agente-a>`, `<email-agente-b>`, `<email-luis>`).
  Siguen en el historial de Git: anótalo en `riesgos.md` (reescribir el
  historial lo decide Luis).
- Comprueba que no hay claves, tokens ni `.env` en el repo (`git grep`
  de `eyJ`, `sb_secret`, `service_role`, `sk-`, `gsk_`, `AIza`). La clave
  *publishable* en la build de Pages es pública por diseño; no cuenta.

### Tipos, etiqueta y portada

- `database.types.ts`: `AudioCleanupRow`, `AuditEventRow`, `AiCallRow`,
  las dos RPC.
- `APP_PHASE_LABEL = 'inmo-visitas · Fase 8'`; portada «Fase 8 —
  Seguridad, borrado y RGPD».

## DESPLIEGUE

- **Argo** (o Luis en el SQL Editor): aplicar
  `docs/deploy/supabase-fase-8.sql`. Después, volver a pasar los
  *Advisors* de seguridad: no deben quedar avisos de `search_path`, de
  `security definer` ejecutable ni de `demo_seed_claim`.
- **Luis:** redesplegar las **cuatro** Edge Functions (CORS) desde
  `main`, con la verificación de JWT activada. *Secrets* opcionales:
  `ALLOWED_ORIGINS` y `AI_DAILY_LIMIT` (sin ellos valen los valores por
  defecto).
- **Luis — ajustes de Auth (no son código):** activar la protección de
  contraseñas filtradas si el plan lo permite; revisar la longitud mínima
  de contraseña.
- Pages, como siempre (con `404.html`).
- **Limpieza de datos de prueba — solo con el «sí» de Luis:** script
  `docs/deploy/limpieza-pruebas.sql` que lista primero (`select`) y
  borra después (en un bloque aparte) las notas y fichas de prueba que
  enumera `docs/ESTADO.md`. No lo ejecutes sin ese «sí» por escrito.
- **Decisiones de Luis antes del piloto (no bloquean la fase):** proveedor
  de IA definitivo y plan de pago con DPA; base legal y textos legales;
  repositorio privado y staging en Coolify; plan de Supabase (copias de
  seguridad); SMTP propio.

## CRITERIOS DE ACEPTACIÓN

1. **Advisors de seguridad** tras aplicar la 0012: sin
   `function_search_path_mutable`, sin
   `*_security_definer_function_executable` y sin `rls_enabled_no_policy`.
   (La protección de contraseñas filtradas depende de Luis.)
2. **Borrar una nota** con audio desde la app: desaparecen la nota, sus
   datos, tareas, borradores y exportaciones; el audio desaparece de
   `visit-audio` y la cola queda vacía; hay una fila `nota_borrada`.
3. **Aprobar una nota con audio:** `audio_url` queda nulo, el objeto
   desaparece de Storage tras `flushAudioCleanup()`, la transcripción
   sigue.
4. **Borrar un cliente con notas** (escribiendo su nombre): se va todo,
   incluidos los audios; fila `cliente_borrado`. El agente B no puede
   borrar un cliente de A (`no_encontrado`), ni ver ni vaciar la cola, el
   registro ni `ai_calls` de A.
5. **«Borrar datos del propietario»:** nombre «Propietario borrado» y
   teléfono nulo; fila `propietario_borrado`.
6. **«Descargar sus datos»:** JSON válido con el esquema pedido, sin
   `payload`, sin rutas de audio y sin datos de otros clientes; fila
   `datos_entregados`.
7. **B-4:** cambiar `visit_note_id` de una tarea, u `origin` o
   `audience`, falla con `cambio_no_permitido`. **B-9:** un
   `external_id` de 201 caracteres falla; con `ALLOWED_ORIGINS` puesto,
   un origen no listado no recibe la cabecera CORS.
8. **Límite diario:** con `AI_DAILY_LIMIT=2` (pruébalo y quítalo
   después), la tercera llamada del día devuelve 429 con el mensaje en
   español y no llama al proveedor; el agente no puede borrar sus filas
   de `ai_calls` (RLS).
9. **Contacto:** un teléfono `612 34 56 78` guardado por API directa falla
   con el mensaje nuevo; los datos existentes pasaron la normalización.
10. **Registro de solo inserción:** `update` y `delete` en `audit_events`
    y `ai_calls` no afectan a ninguna fila (RLS).
11. `docs/rgpd/` con los cuatro borradores, marcados como BORRADOR; sin
    emails reales en `docs/HANDOFF.md`; `git grep` de claves sin
    resultados.
12. `npm test`, `npx tsc --noEmit`, `npm run build` (base `/` y
    `/inmo-visitas/`), `npm run lint` sin errores (2 avisos de shadcn
    aceptados), trozo JS ≤ 500 kB; `deno check` de las cuatro funciones
    si tienes Deno (si no, lo hace Claude en la revisión).
13. Cada pantalla y acción nueva probada **en el navegador**, a 360 px,
    sin desbordamiento ni errores de consola, en local y en Pages (lo que
    no puedas, pendiente para Luis con pasos concretos). **Prueba los
    borrados con datos de sacrificio, nunca con la nota de ejemplo de
    Ana.**

## ENTREGA

Termina con el bloque HANDOFF FASE 8 en `docs/HANDOFF.md`, commit «Fase 8:
seguridad, borrado y RGPD», etiqueta `v0.8-fase-8` y push a `main`:

HANDOFF FASE 8
- Hecho: qué construiste realmente
- Tablas/columnas/triggers/funciones/políticas creadas o cambiadas
  (esperado: solo la 0012)
- Resultado de los *Advisors* de seguridad antes y después
- Edge Functions cambiadas (y si están redesplegadas)
- Rutas/pantallas nuevas o ampliadas
- Dependencias nuevas (esperado: ninguna de producción)
- Errores o warnings de build (tsc/lint/test/deno) y trozo JS mayor
- Qué se borra exactamente en cada borrado y qué queda fuera de la app
- Supuestos tomados y decisiones que quedan para Luis
- Cómo probarlo (pasos y URL, con datos de sacrificio)
