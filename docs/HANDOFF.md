# HANDOFF — inmo-visitas

Historial de entregas por fase. Un bloque por fase, en orden.

---

## HANDOFF FASE 1

- Hecho: fundación de la app. Esquema completo de base de datos en dos
  migraciones SQL (esquema + seed) y sistema de diseño Minimal-Mono con
  sus tokens aplicados a una única pantalla de showcase en `/design-system`.
  Scaffold React 19 + Vite + TypeScript estricto + Tailwind v4 +
  shadcn/ui (Button y Badge), Supabase (`@supabase/supabase-js`, cliente
  creado pero sin uso en esta fase), PWA con `vite-plugin-pwa` y Zod.
  Configuración por cliente en `src/config/client.ts` (variables `VITE_*`)
  e interfaz común `CrmAdapter` con adaptadores stub para inmovilla,
  witei, whatsapp y manual (sin lógica real).
- Tablas/columnas creadas (tipos y constraints exactos tal como quedaron):
  - `agents`: id uuid PK references auth.users(id) on delete cascade,
    full_name text not null, email text not null, phone text,
    created_at timestamptz not null default now().
  - `clients`: id uuid PK default gen_random_uuid(), agent_id uuid
    references agents(id) on delete set null, full_name text not null,
    phone text, email text, is_temporary boolean not null default false,
    created_at timestamptz not null default now().
  - `properties`: id uuid PK default gen_random_uuid(), agent_id uuid
    references agents(id) on delete set null, reference text not null
    unique, address text not null, city text not null default 'Madrid',
    price numeric(12,2) not null, owner_name text not null,
    owner_phone text, status text not null default 'disponible' check
    status in ('disponible','reservado','vendido'),
    created_at timestamptz not null default now().
  - `visit_notes`: id uuid PK default gen_random_uuid(), agent_id uuid
    references agents(id) on delete set null, client_id uuid references
    clients(id) on delete restrict, property_id uuid references
    properties(id) on delete restrict, input_type text not null check
    in ('audio','text'), audio_url text, raw_text text, transcript text,
    status text not null default 'draft' check in
    ('draft','transcribed','extracted','reviewed','approved'),
    created_at timestamptz not null default now().
  - `extracted_facts`: id uuid PK default gen_random_uuid(),
    visit_note_id uuid references visit_notes(id) on delete cascade,
    category text not null check in ('hecho_declarado','observacion',
    'desconocido','objecion','presupuesto','cita_pendiente'),
    field_name text not null, value text not null, evidence_quote text,
    confidence numeric(3,2), created_at timestamptz not null
    default now().
  - `tasks`: id uuid PK default gen_random_uuid(), visit_note_id uuid
    references visit_notes(id) on delete cascade, agent_id uuid
    references agents(id) on delete set null, description text not null,
    due_date date, status text not null default 'pendiente' check in
    ('pendiente','completada'), created_at timestamptz not null
    default now().
  - `drafts`: id uuid PK default gen_random_uuid(), visit_note_id uuid
    references visit_notes(id) on delete cascade, audience text not
    null check in ('comprador','propietario'), content text not null,
    is_sensitive_filtered boolean not null default true,
    created_at timestamptz not null default now().
  - `crm_exports`: id uuid PK default gen_random_uuid(), visit_note_id
    uuid references visit_notes(id) on delete cascade, target text not
    null check in ('inmovilla','witei','whatsapp','manual'),
    payload jsonb, status text not null default 'pendiente' check in
    ('pendiente','enviado','error'), exported_at timestamptz,
    created_at timestamptz not null default now().
  - Seed (`0002_seed_demo.sql`, agent_id = NULL en todas las filas):
    8 propiedades (V-18, V-22, V-07, V-31, V-12, V-45, V-09, V-27) y
    6 clientes (Ana García, Pedro Molina, Laura Ortiz, David Romero,
    Carmen Ibáñez, Jorge Navarro — este último is_temporary = true).
- Políticas RLS / Edge Functions / server functions activas: ninguna,
  planificado para Fase 8 (RLS) y fases posteriores (Edge Functions).
  `supabase/functions/` solo contiene un README que lo indica.
- Rutas/pantallas nuevas: `/` (landing mínima con enlace) y
  `/design-system` (showcase: paleta con swatches y hex, tipografía en
  Inter y JetBrains Mono en las 6 escalas, botones primario/secundario
  en sus estados, tarjeta de V-18 con reference en mono y badge de
  estado, badges disponible/reservado/vendido, bloque de evidencia
  simulado, radios/sombras/espaciado).
- Errores o warnings de build (estado de tsc/lint): `npx tsc --noEmit`
  exit 0 sin errores; `npm run build` (tsc -b + vite build) sin errores,
  122 módulos, dist con `index.html`, CSS 14,21 kB y JS 342,27 kB,
  service worker generado por vite-plugin-pwa (6 entradas precache,
  349,29 KiB). Preview local: HTTP 200 en `/` y en `/design-system`.
  Un error de rutas corregido durante la fase: los imports de CRM
  apuntaban a `../config/client` y debían ser `../../config/client`.
  Warnings de npm al instalar (glob deprecado en una dependencia
  transitiva) no son de este código.
- Supuestos tomados o pendientes:
  - Las migraciones SQL no se han aplicado contra un proyecto Supabase
    real: no hay credenciales en esta fase y no se ha ejecutado
    `supabase db push`. El esquema está verificado por lectura, no por
    ejecución en Supabase.
  - El cliente Supabase es `null` si faltan `VITE_SUPABASE_URL` /
    `VITE_SUPABASE_ANON_KEY`; no se crea con claves falsas.
  - Los adaptadores CRM son stubs que devuelven
    "No implementado en Fase 1".
  - Las fuentes Inter y JetBrains Mono se cargan desde Google Fonts
    con fallback a system-ui/monospace si no hay conexión.
  - Push a GitHub pendiente: falta la URL real del repositorio y el
    token. Commit local y tag `v0.1-fase-1` creados; sin remote.
- URL de preview con pasos para probar: no hay URL pública en esta
  fase (proyecto de código en disco, no artefacto web). En local:
  `npm install`, `npm run dev` y abrir `http://localhost:5173/design-system`.

---
## Nota de despliegue (Fase 1, sin cambio de fase)

- Ajuste necesario para Pages: `base: '/inmo-visitas/'` en Vite y ruta `/design-system` reconocida también como subpath (`endsWith`). Sin este ajuste los assets en `/assets/...` darían 404 en Pages. Commit `6f50ab5` en `main`.
- La etiqueta `v0.1-fase-1` sigue en el commit de la Fase 1; este cambio es infra de despliegue, no una fase nueva.
- Rama `gh-pages` publicada con el contenido de `dist/` (solo eso, sin código fuente ni `node_modules`). Despliegue por Actions NO usado: el token disponible no tiene scope `workflow` y GitHub rechazó subir `.github/workflows/deploy.yml`.
- Falta UN clic de Luis para activarlo: GitHub → repo → Settings → Pages → Build and deployment → Branch: `gh-pages`, carpeta `/ (root)` → Save. El token tampoco tiene scope para activar Pages por API (403). URL prevista: https://luisetic.github.io/inmo-visitas/design-system
- Lección: NO desplegar con `git checkout --orphan` dentro del worktree principal: al desaparecer `.gitignore`, `git add -A` metió `node_modules` (113 MB) en el commit. La vía segura es copiar `dist/` a un directorio temporal `/tmp/...`, `git init` allí y pushear solo eso a `gh-pages`.

---
## Ajustes post-Fase 1 (revisión de Claude, sin cambio de fase)

- Ruta de publicación configurable: `VITE_BASE_PATH` (por defecto `/`). Antes estaba fijada en `/inmo-visitas/` para GitHub Pages, lo que dejaba la web en blanco en Coolify con dominio propio. Para Pages: `VITE_BASE_PATH=/inmo-visitas/`.
- Manifest PWA: `start_url` y `scope` usan la misma ruta base (antes `start_url: '/'` rompía la app instalada en subcarpeta); `lang: 'es'`.
- Fuentes autoalojadas con Fontsource (`@fontsource-variable/inter`, `@fontsource/jetbrains-mono` 400/600). Eliminado Google Fonts por RGPD (transferencia de la IP del visitante).
- Verificado: `tsc -b` y `npm run build` sin errores en raíz y en subcarpeta; lint con los 2 avisos previos de shadcn (no bloqueantes).

---

## HANDOFF FASE 2

- Hecho: acceso e identidad de agentes + seguridad básica (RLS por
  agente), adelantada desde la Fase 8 por decisión de Luis (2026-11-11).
  Captura NO es esta fase: es la Fase 4 (audio en Fase 4, lista de
  borradores en Fase 6). Supabase Auth real: registro con email +
  contraseña, login con email + contraseña, enlace mágico y cierre de
  sesión. Perfil de agente en /perfil (ver y editar full_name y phone,
  email de solo lectura). react-router en modo declarativo con
  `basename={import.meta.env.BASE_URL}` (instalado en esta fase:
  react-router 8.5.1; no estaba en el proyecto). Rutas públicas /login,
  /registro, /design-system; privadas / y /perfil, con redirección a
  /login y vuelta a la ruta pedida tras entrar. RLS activada en las 8
  tablas (detalle con el SQL exacto abajo). Migraciones nuevas 0003
  (trigger) y 0004 (RLS); 0001 y 0002 sin tocar. Archivo
  `docs/deploy/supabase-hasta-fase-2.sql` (0001–0004 concatenadas, solo
  para proyecto nuevo y vacío). Prompts de la fase guardados en
  `docs/prompts/` (original de Claude y corregido, con la cabecera
  actualizada: reorden confirmado, Captura = Fase 4, Pages como staging
  temporal y producción en Hostinger/Coolify). GitHub Pages es STAGING
  TEMPORAL (probar y demos), no hosting permanente; `VITE_BASE_PATH`
  sigue configurable para servir en `/` y en `/inmo-visitas/`.
- Migraciones nuevas y políticas RLS creadas (SQL exacto de cada
  política, en `supabase/migrations/0004_rls_por_agente.sql`):
  - `alter table public.{agents,clients,properties,visit_notes,extracted_facts,tasks,drafts,crm_exports} enable row level security;`
  - `alter table public.{clients,properties,visit_notes,tasks} alter column agent_id set default auth.uid();`
  - agents (sin insert ni delete; el insert lo hace el trigger):
    - `agents_select_own`: `for select to authenticated using (id = auth.uid())`
    - `agents_update_own`: `for update to authenticated using (id = auth.uid()) with check (id = auth.uid())`
  - clients / properties (las cuatro operaciones, `agent_id = auth.uid()`):
    - `clients_select_own` / `properties_select_own`: `for select to authenticated using (agent_id = auth.uid())`
    - `clients_insert_own` / `properties_insert_own`: `for insert to authenticated with check (agent_id = auth.uid())`
    - `clients_update_own` / `properties_update_own`: `for update to authenticated using (agent_id = auth.uid()) with check (agent_id = auth.uid())`
    - `clients_delete_own` / `properties_delete_own`: `for delete to authenticated using (agent_id = auth.uid())`
  - visit_notes (las cuatro operaciones; en insert y update el cliente y
    el inmueble enlazados deben ser del mismo agente — corrección de la
    revisión, aplicada también al update):
    - `visit_notes_select_own`: `for select to authenticated using (agent_id = auth.uid())`
    - `visit_notes_insert_own`: `for insert to authenticated with check (agent_id = auth.uid() and exists (select 1 from public.clients c where c.id = client_id and c.agent_id = auth.uid()) and exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid()))`
    - `visit_notes_update_own`: `for update to authenticated using (agent_id = auth.uid()) with check (agent_id = auth.uid() and exists (select 1 from public.clients c where c.id = client_id and c.agent_id = auth.uid()) and exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid()))`
    - `visit_notes_delete_own`: `for delete to authenticated using (agent_id = auth.uid())`
  - tasks (las cuatro operaciones; visit_note_id null o de nota propia):
    - `tasks_select_own`: `for select to authenticated using (agent_id = auth.uid())`
    - `tasks_insert_own`: `for insert to authenticated with check (agent_id = auth.uid() and (visit_note_id is null or exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid())))`
    - `tasks_update_own`: `for update to authenticated using (agent_id = auth.uid()) with check (agent_id = auth.uid() and (visit_note_id is null or exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid())))`
    - `tasks_delete_own`: `for delete to authenticated using (agent_id = auth.uid())`
  - extracted_facts / drafts / crm_exports (las cuatro operaciones, vía
    la nota de visita): `for {select,insert,update,delete} to authenticated using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()))` (en update, el mismo `exists` también en `with check`). Nombres: `extracted_facts_{select,insert,update,delete}_own`, `drafts_{select,insert,update,delete}_own`, `crm_exports_{select,insert,update,delete}_own`.
  - Ninguna política para `anon`: sin sesión, todas las consultas
    devuelven 0 filas.
  - Índices: `clients_agent_id_idx`, `properties_agent_id_idx`,
    `visit_notes_agent_id_idx`, `tasks_agent_id_idx`,
    `extracted_facts_visit_note_id_idx`, `drafts_visit_note_id_idx`,
    `crm_exports_visit_note_id_idx` (todos `create index if not exists`).
  - Total: 30 políticas (2 agents + 16 clients/properties/
    visit_notes/tasks + 12 extracted_facts/drafts/crm_exports).
- Triggers / Edge Functions / server functions activas:
  - Trigger `on_auth_user_created` (`after insert on auth.users, for
    each row, execute function public.handle_new_agent()`), en
    `supabase/migrations/0003_auth_agents_trigger.sql`. Función
    `public.handle_new_agent()` con `security definer` y
    `set search_path = public`: inserta en `public.agents`
    `(id = new.id, email = new.email, full_name = coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))`.
    Reclamo de demo: SOLO SI no existe ningún otro agente
    (`count(*) = 1` en `public.agents`, contando la fila recién
    insertada), asigna el `agent_id` del nuevo agente a las filas de
    `clients` y `properties` con `agent_id IS NULL`. Comentario SQL en
    mayúsculas: «SOLO DEMO — ELIMINAR ANTES DE PRODUCCIÓN».
  - Edge Functions: ninguna (no se crea ninguna en esta fase).
- Rutas y pantallas nuevas (públicas y privadas):
  - Públicas: `/login` (email + contraseña, enlace «Entrar con enlace
    mágico», enlace a /registro), `/registro` (nombre completo, email,
    contraseña mínimo 8 caracteres, nombre en
    `options.data.full_name`), `/design-system` (sin cambios).
  - Privadas (redirigen a /login sin sesión y vuelven a la ruta pedida
    tras entrar): `/` (inicio provisional: «Hola, \<nombre\>», enlaces
    a /perfil y /design-system, botón «Cerrar sesión») y `/perfil`
    (ver y editar full_name y phone; email de solo lectura).
  - Ruta desconocida redirige a `/` (que exige sesión).
  - `AuthProvider` (`src/components/AuthProvider.tsx`) con
    `onAuthStateChange` y estado de carga sin parpadeo de /login;
    `RequireAuth` (`src/components/RequireAuth.tsx`) como guarda de
    rutas privadas. `signInWithOtp` y `signUp` pasan
    `emailRedirectTo = window.location.origin + import.meta.env.BASE_URL`
    (sin eso Supabase volvería a la Site URL = localhost aunque el
    enlace se abra desde Pages).
  - Validación con Zod y mensajes de error en español (credenciales
    incorrectas, email ya registrado, enlace enviado). Si la
    confirmación de email está activa, /registro muestra «Revisa tu
    correo para confirmar la cuenta» (por defecto Supabase permite 2
    emails/hora).
  - Componentes nuevos: `src/components/ui/input.tsx` y
    `src/components/ui/label.tsx` (shadcn; Label necesita
    `@radix-ui/react-label` 2.1.17, instalado en esta fase). Solo tokens
    Minimal-Mono y componentes Button/Badge existentes.
  - Sin Supabase configurado (sin .env), las pantallas muestran el
    aviso «Falta configurar Supabase (.env)» en lugar de fallar.
- Errores o warnings de build (estado de tsc/lint): `npx tsc --noEmit`
  exit 0 sin errores; `npm run build` exit 0 sin errores, en base `/`
  y en base `/inmo-visitas/` (assets bajo `/inmo-visitas/assets/...`,
  manifest con `start_url` y `scope` en `/inmo-visitas/`, `lang: 'es'`);
  `npm run lint` (oxlint) 2 warnings y 0 errores, los 2 previos de
  shadcn (button/badge exportan variantes); los 2 avisos nuevos de
  `setState` en efecto que aparecieron al crear AuthProvider y Profile
  se corrigieron inicializando el estado de carga con su valor final.
  Aviso nuevo de Vite (no bloqueante): el chunk JS supera 500 kB tras
  minificar (612 kB, Supabase + react-router); no se ha hecho
  code-splitting en esta fase.
  Preview local del build de Pages: HTTP 200 en `/inmo-visitas/`,
  `/inmo-visitas/login`, `/inmo-visitas/registro`,
  `/inmo-visitas/perfil` y `/inmo-visitas/design-system`.
- Supuestos tomados o pendientes:
  - **Prueba de Auth en vivo HECHA el 2026-11-11 (15/16 checks PASS, con
    clave anon contra el proyecto real).** Migraciones aplicadas por Luis
    en el SQL Editor (Success, 8 tablas). Anon sin sesión: `clients`
    devuelve 0 filas. Login con contraseña de los 2 agentes OK. El
    trigger crea la fila en `agents` al crear el usuario. El primer
    agente ve los 6 clientes y las 8 propiedades de demo; el segundo ve
    0 y 0. El agente B no puede leer ni modificar un cliente de A por
    id, ni crear `visit_notes` sobre cliente de A («new row violates
    row-level security policy for table "visit_notes"»), ni crear `tasks`
    sobre una nota de A (misma violación en `tasks`); sí puede crear
    `tasks` con `visit_note_id` null. El agente A crea `visit_notes`
    propias y edita su perfil (full_name y phone). Incidencia en la
    primera pasada (7/11): una cuenta fantasma de prueba creada antes
    por Argo (`inmovisitas.prueba.a@gmail.com`) había reclamado los
    datos de demo al ser el primer agente; se limpió (borrado de las 3
    cuentas/agentes y `agent_id` a null) y se repitió la prueba con A
    creado primero y B después: 15/16. Prueba de interfaz en la web
    viva (navegador real, 2026-11-11 12:31–12:43): 5/5 — login con la
    cuenta A, inicio con «Hola, Agente A Prueba», /perfil con edición
    de nombre (probado: cambio, persistencia tras recargar y
    restauración del nombre original), /design-system pública sin
    sesión, y cierre de sesión con vuelta a /login y /perfil
    redirigiendo a /login. Incidencia menor: el primer intento de
    login usó por error el login guardado de pluton2408@hotmail.com
    (sin «+agente-a») y dio «Credenciales incorrectas»; con las
    credenciales exactas de la cuenta de prueba entró sin problema.
    El único check que falta es el enlace mágico (ver punto siguiente).
  - **Confirmación de email ACTIVADA (por defecto, sin interruptor
    visible en el panel actual).** El registro por correo no da sesión
    inmediata: el usuario queda pendiente de confirmar. El correo
    integrado de Supabase solo permite 2 emails/hora por proyecto
    (docs oficiales): la primera prueba gastó el presupuesto y el
    registro de las cuentas de prueba devolvió «email rate limit
    exceeded». Las cuentas de prueba se crearon desde el panel
    (Authentication → Users → Create new user, con «Auto Confirm
    User»), sin gastar emails. **Enlace mágico VERIFICADO el
    2026-11-11 ~13:42 por Luis en la web viva:** pidió el enlace en
    /login con la cuenta A, recibió el correo en su Hotmail, pulsó el
    enlace y aterrizó en / con sesión iniciada («Hola, Agente A
    Prueba»). 16/16: la Fase 2 queda cerrada del todo. El código pasa
    `emailRedirectTo` en `signUp` y en `signInWithOtp`, y la Site URL
    y las Redirect URLs ya están configuradas (ver punto siguiente).
  - **SQL verificado por lectura, no por ejecución.** No hay Postgres
    local en esta máquina para ejecutar las migraciones (ni `psql` ni
    Docker). La sintaxis sigue los mismos patrones que 0001 (verificada
    igual en Fase 1) y los conteos cuadran (8 tablas, 30 políticas, 7
    índices, trigger + función). La primera ejecución real será la de
    Luis en el SQL Editor.
  - **.env local creado** con la URL y la clave anon del proyecto de
    pruebas de Luis, solo en el archivo `.env` (ignorado por Git,
    verificado con `git status` y `git check-ignore`: no entra en el
    commit). Sin valores reales en ningún otro archivo, HANDOFF o
    mensaje de commit. Solo URL y clave anon; nunca `service_role`.
  - **Reclamo de demo:** el primer agente que se registre reclama las
    8 propiedades y 6 clientes seed; un segundo agente no ve ninguno.
    Es SOLO DEMO y hay que eliminarlo antes de producción (comentario
    en el SQL).
  - **Despliegue en Pages HECHO y verificado en navegador real el
    2026-11-11.** Push a `main` (commit 4f47b94, tag `v0.2-fase-2`) y
    `gh-pages` actualizada con el build de Pages (base
    `/inmo-visitas/`, `dist/404.html` copiado de `dist/index.html`).
    Verificado: `/` redirige a `/login`, `/login` y `/registro` muestran
    sus formularios (con enlace mágico en /login), `/design-system`
    intacto. La primera pasada mostró la versión antigua por la caché
    de Pages; tras 60 s se propagó la Fase 2.
  - **Site URL y Redirect URLs CONFIGURADAS por Luis el 2026-11-11:**
    Site URL = http://localhost:5173 (antes http://localhost:3000);
    Redirect URLs = http://localhost:5173/** (ya existía, se conserva)
    + https://luisetic.github.io/inmo-visitas/ +
    https://luisetic.github.io/inmo-visitas/login.
  - Las migraciones 0003/0004 usan `drop policy if exists` y `create
    index if not exists`: se pueden volver a aplicar sin error si ya
    existen las políticas o los índices.
- Cómo probarlo: pasos para Luis (crear el proyecto Supabase de
  pruebas en región UE —Frankfurt o Irlanda— si no lo tiene, pegar
  `docs/deploy/supabase-hasta-fase-2.sql` en el SQL Editor de un
  proyecto nuevo y vacío, o 0003+0004 si ya tiene 0001+0002; configurar
  Site URL = http://localhost:5173 y añadir
  https://luisetic.github.io/inmo-visitas/ en Redirect URLs; copiar
  .env.example a .env con URL y clave anon —el .env local ya está
  creado—; `npm run dev`; registrar dos agentes y hacer la prueba
  negativa: con la clave anon y sin sesión, `select * from clients`
  devuelve 0 filas; con la sesión del agente B no se ven ni se pueden
  modificar datos del agente A; probar el enlace mágico en local y en
  Pages, al final de todo).

---
## Ajustes post-Fase 2 (revisión de Claude, sin cambio de fase)

Revisión del 2026-11-11 (`42a06c5..491a75d`, desde el merge del PR #1), en Claude Code:
`npm ci`, `tsc --noEmit`, `npm run build` (bases `/` y `/inmo-visitas/`) y
`npm run lint` sin errores (2 avisos previos de shadcn). Migraciones
ejecutadas en PostgreSQL 16 temporal con esquema `auth` simulado: 0003+0004
sobre 0001+0002 (dos veces, idempotentes) y el SQL concatenado en base
vacía: 30 políticas, RLS en 8 tablas, 7 índices. Prueba negativa en SQL:
anon ve 0 filas; B no ve, edita ni borra filas de A, ni inserta con el
`agent_id` de A, ni crea notas sobre inmuebles de A, ni `drafts` o
`extracted_facts` sobre notas de A. Cuadra con la prueba en vivo de Muse.

Cambios (aprobados por Luis: puntos 2, 4, 5, 6 y 7 de la revisión):

- **Migración nueva `0005_ajustes_revision_fase_2.sql`** (0001–0004 sin
  tocar; se puede reaplicar). En el proyecto de pruebas, pegar SOLO la 0005
  en el SQL Editor.
  - `properties.reference` única **por agente**: se elimina
    `properties_reference_key` y se crea
    `properties_agent_reference_key unique (agent_id, reference)`. Antes,
    B no podía crear su propio «V-18» y el error de duplicado revelaba la
    existencia de la referencia de A.
  - `agents.email` de solo lectura en la base: `revoke update on agents
    from anon, authenticated` + `grant update (full_name, phone) on agents
    to authenticated`. /perfil ya solo envía esos dos campos.
  - `visit_notes.client_id` y `property_id` pasan a `not null` (las
    políticas ya lo exigían). Si en la captura (Fase 4) no se conoce al
    cliente, se crea un cliente provisional (`is_temporary = true`).
  - Reclamo de demo de una sola vez: tabla `public.demo_seed_claim` (una
    fila como máximo, RLS activa sin políticas, sin permisos para anon ni
    authenticated) y `handle_new_agent()` reescrita con
    `insert … on conflict do nothing` + `if found`. Ya no repite el
    reclamo si se borran todos los agentes ni falla con dos altas
    simultáneas. Si ya hay agentes al aplicar la 0005, se marca como
    reclamado. Para volver a probar el reclamo en un proyecto de pruebas:
    borrar los agentes, poner `agent_id = null` en clients y properties y
    `delete from public.demo_seed_claim`. SOLO DEMO — eliminar antes de
    producción (tabla + bloque del trigger).
- `docs/deploy/supabase-hasta-fase-2.sql` ahora incluye 0001–0005.
- **Code-splitting**: páginas con `React.lazy` + `Suspense` en
  `src/App.tsx` y grupos `vendor-react`, `vendor-supabase` y `vendor` en
  `vite.config.ts` (`build.rolldownOptions.output.codeSplitting`). Trozo
  mayor: 255 kB (antes, uno solo de 612 kB); desaparece el aviso de 500 kB.
- Verificado tras los cambios: 0005 aplicada sobre una base con 0001–0004
  y datos (dos veces), 0001–0005 por orden y el concatenado en vacío.
  Pruebas nuevas: B crea su «V-18»; A no puede duplicar su «V-18»; A edita
  nombre y teléfono pero cambiar el email da `permission denied`; nota sin
  cliente rechazada; tras borrar todos los agentes, un alta nueva no
  reclama la demo. Navegador (Chromium, build de preview) en `/` y en
  `/inmo-visitas/`: /login, /registro y /design-system se pintan; / y
  /perfil redirigen a /login; sin errores de consola ni 404.
- Sin cambiar (decisión de Luis): los emails de prueba del HANDOFF se
  mantienen mientras duren las pruebas. Criterio 5 (enlace mágico):
  verificado en Pages el 2026-11-11 (commit 5abb997); Fase 2 cerrada.

---

## HANDOFF FASE 3

- Hecho: CRUD de clientes e inmuebles + datos de contacto (decisión de
  contacto cerrada en `docs/prompts/PROMPT-FASE-3.md`). Validación y
  normalización al guardar en el frontend con Zod
  (`src/lib/contact.ts`): teléfono español de 9 dígitos → `+34…`,
  email en minúsculas; sin restricción en la base (llega en la Fase 8).
  Botones «Llamar» (`tel:`), «WhatsApp» (solo abre el chat con
  `https://wa.me/…`, sin texto prellenado) y «Email» (`mailto:`), cada
  uno solo si hay dato; el propietario solo tiene teléfono (no hay
  columna de email de propietario y no se crea). La app no llama ni
  envía nada por sí misma. Enviar borradores por WhatsApp sigue siendo
  la Fase 7. Navegación privada (Inicio, Clientes, Inmuebles, Perfil)
  en todas las pantallas privadas. Pruebas unitarias de los
  normalizadores y de los esquemas con Vitest (`npm test`).
- Tablas/columnas/políticas creadas o cambiadas: **ninguna**. Sin
  migración nueva (0001–0005 sin tocar, como exige el prompt).
- RLS/Edge Functions: sin cambios. No se envía `agent_id` desde el
  frontend (lo pone la base con `default auth.uid()`); las políticas
  de la Fase 2 hacen el resto. Sin Edge Functions.
- Rutas/pantallas nuevas (todas privadas, `lazy`, dentro de
  `RequireAuth`): `/clientes` (búsqueda por nombre/teléfono/email sin
  tildes ni mayúsculas, contador «N clientes», tarjetas ordenadas por
  nombre, insignia «Provisional»), `/clientes/nuevo` y `/clientes/:id`
  (ficha: vista con botones de contacto, edición, borrado con
  confirmación «¿Borrar a …? Esta acción no se puede deshacer.»;
  id inexistente o de otro agente → «No encontrado»), `/inmuebles`
  (búsqueda por referencia/dirección/ciudad/propietario, filtro por
  estado Todos/Disponible/Reservado/Vendido, tarjetas ordenadas por
  referencia con precio en formato español), `/inmuebles/nuevo` y
  `/inmuebles/:id` (ficha con bloque «Propietario» y sus botones
  Llamar/WhatsApp). `Home` enlaza a Clientes e Inmuebles y `Profile`
  lleva la navegación. Errores de base traducidos a español:
  23505 → «Ya tienes un inmueble con la referencia V-52» (con la
  referencia real), 23503 → «No se puede borrar: tiene notas de
  visita asociadas», 42501 → «No tienes permiso para esta acción».
  Móvil primero: una columna, objetivos táctiles ≥ 44 px.
- Dependencias nuevas: **vitest 5.1.0** (devDependency, `npm test` =
  `vitest run`). Sin dependencias nuevas de producción.
- Errores o warnings de build: `npx tsc --noEmit` sin errores;
  `npm run build` sin errores en base `/` y con
  `VITE_BASE_PATH=/inmo-visitas/`; `npm run lint` (oxlint) 0 errores
  y 2 warnings, los previos de shadcn (`button.tsx` y `badge.tsx`,
  `only-export-components`). Trozo JS mayor: **255 kB**
  (`vendor-react`), por debajo de 500 kB. Dos avisos nuevos
  (`set-state-in-effect` en las listas) se corrigieron inicializando
  `loading` con su valor final cuando no hay Supabase; dos avisos
  `only-export-components` por exportar los comparadores de búsqueda
  desde las páginas se corrigieron moviéndolos a `src/lib/search.ts`.
  Lección: las interfaces de TypeScript no son asignables a
  `Record<string, unknown>` que exige el `GenericSchema` de
  supabase-js, así que los tipos de fila de `database.types.ts` son
  `type` (alias de objeto), no `interface`; con `interface`, los
  `insert`/`update` tipados resolvían a `never` y el build fallaba.
- Archivos creados: `src/lib/contact.ts` (+ `contact.test.ts`, 19
  casos: normalización, formato, seed, extranjeros e inválidos),
  `src/lib/database.types.ts` (tipos a mano de `clients`,
  `properties` y `agents`: `Row`/`Insert`/`Update`),
  `src/lib/db-errors.ts` (traducción 23505/23503/42501),
  `src/lib/search.ts` (comparadores de búsqueda), `src/lib/utils.ts`
  (+ `normalizeForSearch`, `digitsOnly`),
  `src/features/clients/{schema,api}.ts` (+ `schema.test.ts`, 4
  casos), `src/features/properties/{schema,api}.ts` (+
  `schema.test.ts`, 3 casos), `src/components/ContactButtons.tsx`,
  `src/components/PrivateNav.tsx`,
  `src/features/clients/ClientForm.tsx`,
  `src/features/properties/PropertyForm.tsx`, `src/pages/Clients.tsx`,
  `src/pages/ClientDetail.tsx`, `src/pages/Properties.tsx`,
  `src/pages/PropertyDetail.tsx`, `src/pages/search.test.ts` (5
  casos de búsqueda). Modificados: `src/App.tsx` (6 rutas nuevas,
  `lazy`), `src/pages/Home.tsx` (navegación + enlaces),
  `src/pages/Profile.tsx` (navegación), `src/lib/supabase.ts`
  (`createClient<Database>`), `package.json` + `package-lock.json`
  (vitest + script `test`).
- Supuestos tomados o pendientes:
  - El teléfono del seed (`+34 612 345 678`) se acepta en lectura y
    se muestra formateado (`612 34 56 78`); se normaliza al editar y
    guardar. Los teléfonos extranjeros en E.164 se guardan tal cual.
  - `formatPriceEs` usa `Intl.NumberFormat('es-ES', { style:
    'currency', currency: 'EUR', maximumFractionDigits: 0 })` y
    sustituye el espacio de no separación (U+00A0) que emite
    `Intl` por un espacio normal, para que el texto sea «230.000 €».
  - La referencia se guarda en mayúsculas y el precio se parsea con
    formato español (`230.000` → 230000, `230.000,50` → 230000.5).
  - El borrado de un cliente o inmueble con notas de visita asociadas
    lo bloquea la base (23503) y la UI traduce el mensaje; no hay
    borrado en cascada.
- Cómo probarlo (en vivo contra el proyecto de pruebas, 2026-11-11,
  con la clave anon; agentes de prueba
  pluton2408+agente-a@hotmail.com y pluton2408+agente-b@hotmail.com;
  las contraseñas NO se escriben aquí, como en la Fase 2):
  - Criterio 1 ✅: A ve 6 clientes + 8 inmuebles; crea a Irene Castro
    Vidal (teléfono `612.34.56.78` → guardado `+34612345678`,
    mostrado `612 34 56 78`; email `Irene.Castro@Example.com` →
    `irene.castro@example.com`) y V-52 (`v-52` → `V-52`, `285.000` →
    285000, «285.000 €», propietario Rafael Gil Moreno,
    `+34 699 11 22 33` → `+34699112233`, Disponible).
  - Criterio 2 ✅: A edita el teléfono de Ana García (a
    `+34612345679`) y el estado de V-07 (a Vendido); ambos persisten
    tras releer; después se restauraron los valores del seed (teléfono
    `+34 612 345 678`, V-07 Reservado) y se verificó la restauración.
  - Criterio 3 ✅: A intenta otro V-52 → «Ya tienes un inmueble con
    la referencia V-52»; B crea su propio V-52 y su propio V-18.
  - Criterio 4 ✅: B ve 0 clientes y 0 inmuebles de A (antes de crear
    los suyos); abrir `/clientes/<id de Ana>` como B devuelve
    «No encontrado» (la API devuelve null por RLS).
  - Criterio 5 ✅: borrar a Irene funciona (desaparece); se creó una
    nota de visita de prueba como A sobre David Romero (inmueble
    V-12, texto «Nota de prueba Fase 3», estado draft) y borrar a
    David muestra «No se puede borrar: tiene notas de visita
    asociadas» y el cliente sigue ahí.
  - Criterio 6 ✅ (lógica): la búsqueda «garcia» encuentra a
    «Ana García» y el filtro Reservado solo muestra reservados,
    cubiertos por pruebas unitarias de `matchesClientQuery` /
    `matchesPropertyQuery` en `src/pages/search.test.ts`. La
    interacción en la UI (escribir en el buscador, pulsar el filtro)
    queda pendiente de verificar en el navegador.
  - Criterio 7 ⚠️ parcial: teléfono inválido `12345` no guarda y el
    formulario dice «Teléfono no válido» (prueba unitaria del esquema
    de cliente); los botones solo aparecen si hay dato (los `href`
    devuelven `null` sin dato o con dato inválido, probado en
    `contact.test.ts`); que «Llamar» abra el marcador, «WhatsApp» el
    chat sin texto y «Email» el correo, y que no haya desbordamiento
    horizontal a 360 px, son comprobaciones de móvil real pendientes
    (sin navegador en esta fase).
  - Criterio 8 ✅: `npm test` — 31 pruebas en 4 archivos, todas en
    verde (19 de `contact.ts`, 4 del esquema de cliente, 3 del
    esquema de inmueble, 5 de búsqueda), incluidos los casos del seed
    y los inválidos.
  - Criterio 9 ⚠️ parcial: las rutas nuevas funcionan en local y la
    build con base `/inmo-visitas/` genera los activos bajo
    `/inmo-visitas/` con `dist/404.html` = `index.html`; la
    comprobación en Pages (`/inmuebles`, recarga en `/clientes/<id>`)
    queda para el despliegue (lo hace el padre, sin gh-pages en esta
    fase).
  - Criterio 10 ✅: `npm test` 31/31, `npx tsc --noEmit` sin errores,
    `npm run build` sin errores en ambas bases, `npm run lint` 0
    errores (2 warnings previos de shadcn), trozo mayor 255 kB.
  - Datos de prueba que QUEDAN en el proyecto: V-52 del agente A,
    V-52 y V-18 del agente B, y la nota de visita de prueba sobre
    David Romero (V-12, draft). Borrados: Irene Castro Vidal; el
    V-18 de B de la comprobación de la 0005 ya estaba borrado.
    Ana García y V-07 quedaron con sus valores del seed. No se
    borraron las cuentas de prueba.

---

## Ajustes post-Fase 3 (revisión de Claude, sin cambio de fase)

Revisión del 2026-11-11 (`6225d00..d529595`, tag `v0.3-fase-3`), en Claude
Code: `npm ci`, `tsc --noEmit`, `npm test` (31/31), `npm run lint` (0
errores, 2 avisos previos de shadcn) y `npm run build` con base
`/inmo-visitas/` (trozo mayor 255 kB) sin errores. Sin migraciones nuevas
(0001–0005 sin tocar) ni cambios de RLS: la prueba negativa de la Fase 2
sigue valiendo. Las FK de `visit_notes` son `on delete restrict`, así que el
23503 al borrar es correcto. Navegador (Chromium, 360 px, Supabase simulado
con interceptación de red): listas, búsqueda «garcia», filtro por estado,
fichas, `tel:`/`wa.me`/`mailto:` y teléfonos del seed formateados, sin
desbordamiento horizontal ni errores de consola.

Cambios (aprobados por Luis el 2026-11-11):

- **Importante — altas rotas en la UI.** `/clientes/nuevo` e
  `/inmuebles/nuevo` se quedaban en «Cargando…» para siempre: son rutas
  estáticas sin `:id`, así que `useParams()` da `id = undefined` y
  `isNew = id === 'nuevo'` era `false`. La prueba en vivo de Muse fue por
  API (sin navegador), por eso el criterio 1 constaba como superado.
  Ahora `isNew = id === undefined`, y el componente de la ficha se monta con
  `key = id` (`ClientDetailView` / `PropertyDetailView`) para que, al pasar
  de «nuevo» a la ficha creada, no arrastre el estado de edición.
  Verificado en navegador: crear «Irene Castro Vidal» con `12345` → «Teléfono
  no válido»; con `612.34.56.78` e `Irene.Castro@Example.com` → la petición
  envía `+34612345678` e `irene.castro@example.com` (sin `agent_id`) y la
  ficha queda en modo ver.
- `<Link><Button/></Link>` (botón dentro de enlace, HTML no válido) →
  `<Button asChild><Link/></Button>` en «Nuevo cliente», «Nuevo inmueble» y
  «Volver a …».
- La lista de inmuebles mostraba el estado en minúsculas («reservado»):
  ahora usa `PROPERTY_STATUS_LABELS` (en `features/properties/schema.ts`),
  igual que la ficha.
- `normalizePhone`: con `+34`/`0034` también exige que el número empiece por
  6, 7, 8 o 9 (antes aceptaba `+34123456789`). 2 casos inválidos más en
  `contact.test.ts`.
- Mensajes 23503 y 42501 sin punto final, como en el prompt.
- Pendiente de Luis (tras el merge y el despliegue en Pages): repetir en la
  web viva los criterios 1 y 3 por la UI, y el 7 (móvil real) y el 9
  (recarga en `/inmo-visitas/clientes/<id>`). Quedan datos de prueba de Muse
  en el Supabase de pruebas (V-52 de A, V-52 y V-18 de B, nota de visita
  sobre David Romero).

---

## HANDOFF FASE 4

- Hecho: captura por voz y texto + transcripción. Pantalla `/capturar`
  (elegir cliente con buscador, elegir inmueble disponible/reservado con
  casilla «Mostrar vendidos», cliente provisional rápido con
  `is_temporary = true`, pestañas Voz/Texto, grabación con MediaRecorder
  de hasta 3 minutos con contador `0:00 / 3:00`, aviso «Graba tu resumen
  al salir de la visita, no la conversación con el cliente», reproductor
  del blob y «Volver a grabar»). Nota de texto → `transcribed` y
  navegación a `/notas/:id`; nota de voz → insert en `draft`, subida a
  Storage con `upsert: false`, `audio_url` con la ruta y navegación a
  `/notas/:id`; si la subida falla, el audio se conserva y el botón
  «Reintentar subida» reutiliza la misma nota (no se crea una segunda).
  Ficha `/notas/:id` (cliente con enlace y badge «Provisional», inmueble
  con enlace, fecha en español, estado «Pendiente de transcribir» /
  «Transcrita», audio con URL firmada de 5 minutos, transcripción
  automática una sola vez al abrir un `draft` con audio, «Reintentar
  transcripción» si falla, corrección del texto a mano hasta 5.000
  caracteres, «No encontrado» si el id es de otro agente o no existe,
  botón «Nueva captura»). «Capturar» en `PrivateNav` y botón principal
  «Capturar visita» en Inicio. Funciones puras en
  `src/features/capture/audio.ts` con tests de Vitest (tipo MIME,
  extensión, `m:ss`, validación 10–5.000 caracteres). Edge Function
  `transcribe` (Deno): CORS solo para localhost:5173, localhost:4173 y
  luisetic.github.io; JWT verificado por Supabase; cliente con clave
  anon + cabecera `Authorization` (RLS como ese agente, sin
  `service_role`); 404 si la nota no es del agente, 400 si no tiene
  audio, 200 con la transcripción existente si ya está transcrita,
  413 si el audio supera 10 MB, 502 genérico en español si falta
  algún secret o falla el proveedor (sin devolver su mensaje ni
  escribir transcripción, audio o clave en los logs); proveedor por
  secrets `TRANSCRIBE_API_URL`, `TRANSCRIBE_MODEL` y
  `TRANSCRIBE_API_KEY`, sin valores por defecto en el código.
- Tablas/columnas/políticas creadas o cambiadas: **solo la migración
  `0006_storage_audio_visitas.sql`** (idempotente, comentada en
  español). Bucket privado `visit-audio` (`file_size_limit` 10 MB,
  `allowed_mime_types` audio/webm, audio/mp4, audio/ogg, audio/mpeg,
  audio/wav) y 3 políticas en `storage.objects` solo para
  `authenticated` y solo para ese bucket, con la carpeta del agente
  como primer segmento (`(storage.foldername(name))[1] =
  auth.uid()::text`): `visit_audio_select_own`, `visit_audio_insert_own`,
  `visit_audio_delete_own`. Sin política para `anon` y sin update.
  Archivo `docs/deploy/supabase-fase-4.sql` con solo la 0006 (0001–0005
  sin tocar). **La 0006 NO está aplicada en Supabase todavía: la aplica
  Luis en el SQL Editor** (ver «Cómo probarlo»).
- RLS / Edge Functions activas: las 8 tablas sin cambios. `transcribe`
  **NO está desplegada**: la despliega Luis desde el panel (Via Editor,
  ver `supabase/functions/README.md`). Sin `service_role` en el cliente
  ni en la función.
- Rutas/pantallas nuevas (todas privadas, `lazy`, dentro de
  `RequireAuth`): `/capturar` (sin parámetros; lección de la Fase 3: la
  ruta estática no usa `useParams`) y `/notas/:id` (ficha montada con
  `key = id`, mismo patrón que `ClientDetail`/`PropertyDetail`).
  `<Button asChild><Link/></Button>` en los botones que son enlaces.
  Móvil primero: una columna, objetivos táctiles ≥ 44 px, sin
  desbordamiento a 360 px (por diseño; pendiente de comprobar en
  navegador).
- Dependencias nuevas: **ninguna de producción**. Sin Deno instalado
  en esta máquina: `deno check supabase/functions/transcribe/index.ts`
  no se pudo ejecutar (queda pendiente en la revisión).
- Errores o warnings de build: `npm test` — 53 pruebas en 5 archivos,
  todas en verde (31 previas + 22 nuevas de `audio.ts`); `npx tsc
  --noEmit` sin errores; `npm run build` sin errores en base `/` y con
  `VITE_BASE_PATH=/inmo-visitas/`; `npm run lint` (oxlint) 0 errores y
  2 warnings, los previos de shadcn (`button.tsx` y `badge.tsx`).
  Trozo JS mayor: **255 kB** (`vendor-react`), por debajo de 500 kB.
  `dist/404.html` copiado de `dist/index.html` en la build de Pages.
- Navegadores y móviles probados: **ninguno** — esta fase no se pudo
  probar en el navegador (el constructor no opera el navegador; lección
  de la Fase 3 aplicada así: todo lo verificable por API y tests está
  probado; lo de navegador queda documentado pantalla por pantalla en
  «Supuestos tomados o pendientes»). Micrófono no probado en ningún
  dispositivo real.
- Supuestos tomados o pendientes:
  - **Verificado tras el despliegue (Luis, 2026-11-11 ~17:50):** la
    0006 está aplicada (Success en el SQL Editor) y el bucket existe
    y es privado (`select id, public from storage.buckets where id =
    'visit-audio'` → `visit-audio | false`); `transcribe` está
    desplegada (Via Editor, nombre `transcribe`) y responde: POST
    con nota inexistente → 404 `{"error":"No encontrado"}` y
    preflight CORS → 204. Conducto de voz verificado 12/12 con audio
    sintético: A crea la nota de audio, sube a su carpeta, invoca
    `transcribe` → 200 y la nota pasa a `transcribed`; B ve 0
    objetos en la carpeta de A, no puede subir en ella (RLS) y
    `transcribe` con su JWT da 404; sin JWT, 401. La nota y el audio
    de prueba se borraron tras la prueba. Lo que queda de voz es la
    grabación real en móvil (criterio 3).
  - **Pendiente de navegador (padre + Luis):** `/capturar` completa
    (búsqueda de cliente/inmueble, cliente provisional, pestañas,
    grabación, contador, parada a los 3:00, reproductor del blob,
    guardado de texto y de voz, reintento de subida); `/notas/:id`
    (audio con URL firmada, «Transcribiendo…», corrección y su
    persistencia, «No encontrado» como B); 360 px sin desbordamiento
    ni errores de consola, en local y en Pages. Voz en **móvil real**
    (Android con Chrome y, si es posible, iPhone con Safari): grabar,
    escuchar, guardar y comprobar que la nota pasa a «Transcrita» y
    que el audio está en `visit-audio/<id de A>/<id de la nota>.<ext>`.
  - La validación de longitud del texto (10–5.000) es solo de
    frontend (Zod): la base no la restringe, igual que en la Fase 3
    con el contacto.
  - `audio_url` guarda solo la ruta; el reproductor de la ficha usa
    URL firmada de 5 minutos. El `agent_id` de la ruta de Storage es
    el `session.user.id`, solo como segmento de la ruta (lo permite el
    prompt); la nota en sí no envía `agent_id`.
  - Sin Deno en esta máquina: la función no pasó `deno check`; la
    sintaxis sigue los patrones de Supabase Edge Functions (Deno.serve,
    `jsr:@supabase/supabase-js@2`, `npm:zod@4`).
- Cómo probarlo (en vivo contra el proyecto de pruebas, 2026-11-11,
  con la clave anon; agentes de prueba
  pluton2408+agente-a@hotmail.com y pluton2408+agente-b@hotmail.com;
  las contraseñas NO se escriben aquí, como en la Fase 2):
  - **Hecho por Luis el 2026-11-11:** `docs/deploy/supabase-fase-4.sql`
    aplicado en el SQL Editor (Success) y `transcribe` desplegada
    (Via Editor, nombre `transcribe`). Comprobado: bucket
    `visit-audio | false` y la función responde 404 a nota
    inexistente.
  - Criterio 1 ✅ (API): A crea la nota de texto del ejemplo (Ana
    García + V-18, id `e0782f7c-8409-4e23-a2b0-5972521fed0a`):
    `input_type = text`, `status = transcribed`, `raw_text` exacto,
    `audio_url` null, `agent_id` puesto por la base. Pendiente de
    repetir por la UI en `/capturar` y verla en `/notas/<id>`.
  - Criterio 2 ✅ (tests): texto de menos de 10 caracteres o vacío no
    se guarda y lo explica en español (`audio.test.ts`); sin
    cliente/inmueble el botón «Guardar nota» está desactivado (por
    diseño; pendiente de navegador).
  - Criterio 3 ✅ conducto verificado por API (12/12 con audio
    sintético, ver arriba): nota de audio → subida → `transcribe` →
    `transcribed`. Pendiente la voz real en un móvil real (Android
    con Chrome y, si es posible, iPhone con Safari): grabar, escuchar,
    guardar y comprobar que la nota pasa a «Transcrita» con un texto
    razonable en español.
  - Criterio 4 ⏳ pendiente de navegador: sin permiso de micrófono, el
    mensaje es «Permite el micrófono para grabar. También puedes
    escribir la nota.» y la pestaña «Texto» sigue funcionando.
  - Criterio 5 ✅ (API): cliente provisional «Marta (la del lunes)»
    creado sin teléfono (id `15d60343-1a2d-4280-a688-71eb839132e8`,
    `is_temporary = true`) y nota enlazada a Marta + V-31 (id
    `d91d1785-dd9e-415e-9106-5f227152c25b`). Pendiente de ver el badge
    «Provisional» en `/clientes` y de repetirlo por la UI en
    `/capturar`.
  - Criterio 6 ✅ (API): corregir el `raw_text` de la nota de ejemplo
    persiste tras releer (y se restauró el texto original). Pendiente
    de repetirlo con la transcripción de una nota de voz en el
    navegador.
  - Criterio 7 ✅ (API): B no ve la nota de A por id (null =
    «No encontrado») ni puede modificarla (0 filas); B ve 0 objetos
    en la carpeta de A en `visit-audio`, no puede subir en ella (RLS)
    y `transcribe` con su JWT da 404; sin JWT, 401.
  - Criterio 8 ⏳ pendiente: 502 sin clave o con el proveedor caído
    (se prueba quitando el secret temporalmente o con el proveedor
    caído; ya no depende del despliegue).
  - Criterio 9 ✅: la clave no aparece en el repo, en `dist/`, en el
    HANDOFF ni en la red del navegador: `gsk_` 0 ocurrencias en todo
    el repo; `TRANSCRIBE` 0 archivos en `dist/`; el frontend solo
    llama a `functions.invoke('transcribe', …)` y nunca ve los
    secrets; en el código solo aparecen los NOMBRES de los secrets
    (`Deno.env.get(…)`), sin valores.
  - Criterio 10 ✅: `npm test` 53/53, `npx tsc --noEmit` sin errores,
    `npm run build` sin errores en ambas bases, `npm run lint` 0
    errores (2 warnings previos de shadcn), trozo mayor 255 kB.
    `deno check` no ejecutado (sin Deno).
  - Criterio 11 ⏳ pendiente: cada pantalla nueva probada en el
    navegador, a 360 px y sin errores de consola, en local y en
    Pages (lo hace el padre con el navegador real y Luis en el
    móvil).
  - Datos de prueba que QUEDAN en el proyecto: nota de texto de
    ejemplo (Ana + V-18, id `e0782f7c-…`), cliente provisional Marta
    (la del lunes) + su nota (V-31, id `d91d1785-…`). Además, de la
    Fase 3: V-52 de A, V-52 y V-18 de B, y la nota de prueba sobre
    David Romero (V-12, draft). El borrador de voz de prueba creado
    para comprobar la subida se borró tras la prueba. No se borraron
    las cuentas de prueba.
