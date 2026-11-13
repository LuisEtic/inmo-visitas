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
    por Argo (`<email-prueba-fantasma>`) había reclamado los
    datos de demo al ser el primer agente; se limpió (borrado de las 3
    cuentas/agentes y `agent_id` a null) y se repitió la prueba con A
    creado primero y B después: 15/16. Prueba de interfaz en la web
    viva (navegador real, 2026-11-11 12:31–12:43): 5/5 — login con la
    cuenta A, inicio con «Hola, Agente A Prueba», /perfil con edición
    de nombre (probado: cambio, persistencia tras recargar y
    restauración del nombre original), /design-system pública sin
    sesión, y cierre de sesión con vuelta a /login y /perfil
    redirigiendo a /login. Incidencia menor: el primer intento de
    login usó por error el login guardado de <email-luis>
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
  <email-agente-a> y <email-agente-b>;
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
  sin tocar). La 0006 **está aplicada** en el Supabase de pruebas (Luis,
  SQL Editor, 2026-11-11; bucket `visit-audio | false` comprobado).
  *[Corregido en la revisión de Claude: el texto original decía «NO está
  aplicada», escrito antes del despliegue.]*
- RLS / Edge Functions activas: las 8 tablas sin cambios. `transcribe`
  **está desplegada** (Luis, panel Via Editor, 2026-11-11; 404 a nota
  inexistente, CORS 204 y conducto de voz 12/12 verificados). Sin
  `service_role` en el cliente ni en la función. *[Corregido en la
  revisión de Claude: el texto original decía «NO está desplegada».]*
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
- Navegadores y móviles probados: **Luis en móvil real (Android con
  Chrome) y en web, 2026-11-11 ~19:00** — inicio Fase 4, `/capturar`
  (búsquedas, pestañas Voz/Texto, aviso, botón Guardar desactivado sin
  cliente/inmueble), grabación de voz real con transcripción exacta y
  alta de inmueble por la UI (V-54). Sin errores de consola vistos.
  Pendiente: la nota de ejemplo en `/notas/:id`, crear cliente por la
  UI y la recarga de una ficha (Fase 3, criterios 3 y 9).
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
    de prueba se borraron tras la prueba. Voz real en móvil verificada
    por Luis el mismo día ~19:00 (criterio 3): grabó el texto de Ana +
    V-18 en `/capturar`, guardó y la nota pasó a `transcribed` con la
    transcripción exacta del dictado (nota `2f328d2c-…`, audio webm en
    su carpeta). El botón «Guardar nota» solo se activa con cliente +
    inmueble + audio, como está diseñado (Luis lo comprobó al grabar
    antes de elegirlos).
  - **Pendiente de navegador:** ver la nota de ejemplo en `/notas/:id`
    (criterio 1); crear cliente por la UI y recargar una ficha (Fase 3,
    criterios 3 y 9); parada automática a los 3:00, reintento de subida
    y mensaje sin permiso de micrófono (criterio 4); 360 px sin
    desbordamiento ni errores de consola.
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
  <email-agente-a> y <email-agente-b>;
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
    sintético, ver arriba) y con voz real en móvil por Luis (~19:00):
    grabó el texto de Ana + V-18 en `/capturar`, guardó y la nota
    (`2f328d2c-…`, audio webm) pasó a `transcribed` con la
    transcripción exacta del dictado.
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
  - Criterio 10 ✅: `npm test` 61/61 (53 de la fase + 8 del parche de
    precio/referencia), `npx tsc --noEmit` sin errores,
    `npm run build` sin errores en ambas bases, `npm run lint` 0
    errores (2 warnings previos de shadcn), trozo mayor 255 kB.
    `deno check` no ejecutado (sin Deno).
  - Criterio 11 ⏳ parcial: inicio, `/capturar` y voz verificados por
    Luis en el móvil y en web; pendientes la nota de ejemplo en
    `/notas/:id`, la comprobación a 360 px sin errores de consola y el
    parche de precio/referencia en `/inmuebles/nuevo` (V-55, precio
    `285,000`).
  - Datos de prueba que QUEDAN en el proyecto: nota de texto de
    ejemplo (Ana + V-18, id `e0782f7c-…`), cliente provisional Marta
    (la del lunes) + su nota (V-31, id `d91d1785-…`), nota de voz de
    Luis (Ana + V-18, id `2f328d2c-…`, audio webm, `transcribed`) e
    inmueble V-54 creado por Luis en la prueba de la Fase 3. Además,
    de la Fase 3: V-52 de A, V-52 y V-18 de B, y la nota de prueba sobre
    David Romero (V-12, draft). El borrador de voz de prueba creado
    para comprobar la subida se borró tras la prueba. No se borraron
    las cuentas de prueba.

## PARCHE FASE 3 — Precio y referencia en el alta de inmuebles (2026-11-11)

- Origen: prueba en vivo de Luis en el móvil (Fase 3, criterio 1 por la
  UI). Al crear un inmueble, el precio `285.000` / `285000` daba «Precio
  no válido» y la referencia `V-52` daba error de formato y «ya existe».
  Lo reprodujo Muse con tests: `parsePriceEs('285,000')` fallaba (la
  coma con 3 dígitos no se aceptaba) y en el móvil en español la tecla
  decimal es la coma, así que es lo que se teclea; `V-52` pasa la
  validación, así que el error de formato venía de un carácter parecido
  (espacio o guion distinto del teclado). El «ya existe» era correcto:
  el V-52 de A ya estaba creado en las pruebas de la Fase 3.
- Cambios (sin migración, sin tag nuevo; el tag `v0.3-fase-3` no se mueve):
  - `src/lib/contact.ts`: `parsePriceEs` acepta la coma como miles
    (`285,000` → 285000; `1,285,000` → 1285000) cuando va seguida de
    exactamente 3 dígitos y no hay punto; `285,50` sigue siendo decimal.
    Nuevo `formatPricePlain` (285000 → «285.000», sin €).
  - `src/features/properties/reference.ts` (nuevo): `normalizeReference`
    (mayúsculas, guiones parecidos U+2010–U+2015/U+2212 → `-`, sin
    espacios) y `nextFreeReference` (mayor `V-NN` + 1, con 2 dígitos;
    sin previas → `V-01`).
  - `src/features/properties/schema.ts`: la referencia se normaliza
    antes de validar; el mensaje de precio ahora dice cómo escribirlo
    («Precio no válido. Escribe 285000 o 285.000.»).
  - `src/features/properties/PropertyForm.tsx`: al crear, la referencia
    viene prellenada con la siguiente libre (`suggestedReference`); el
    precio se normaliza a «285.000» al salir del campo.
  - `src/pages/PropertyDetail.tsx`: al crear, carga las referencias del
    agente (`listProperties`) y calcula la sugerencia; si la referencia
    ya existe, el error añade «La siguiente libre es V-NN.».
- Verificación: `npm test` 61/61 (8 tests nuevos: coma-miles,
  normalización de referencia, siguiente libre), `tsc --noEmit` sin
  errores, `npm run lint` 0 errores (2 warnings previos de shadcn),
  build sin errores en base `/` y `/inmo-visitas/`, `dist/404.html`
  copiado. Contra los datos reales de A (V-07…V-54, el V-54 lo creó
  Luis en la prueba): la siguiente libre es **V-55**.
- Pendiente de Luis en el móvil: abrir `/inmuebles/nuevo` y comprobar
  que la referencia ya viene como V-55 y que el precio `285,000` se
  acepta y se muestra como `285.000`.

---

## Revisión de la Fase 4 (Claude, sin cambio de fase)

Revisión del 2026-11-11 (`87b5de0..48e322f`, tag `v0.4-fase-4` + parche de
la Fase 3), en Claude Code:

- `npm ci`, `tsc --noEmit`, `npm test` (61/61), `npm run lint` (0 errores,
  2 avisos previos de shadcn) y `npm run build` con base `/inmo-visitas/`
  (trozo mayor 255 kB) sin errores. **`deno check
  supabase/functions/transcribe/index.ts` OK** (Deno 2.9.6; pendiente del
  HANDOFF resuelto).
- Migraciones 0001–0006 en PostgreSQL 16 temporal con esquemas `auth` y
  `storage` simulados, dos veces (idempotentes). Bucket privado, 10 MB, 5
  tipos de audio, 3 políticas solo `authenticated`. **Prueba negativa en
  Storage:** B ve 0 objetos de A, no sube en la carpeta de A, ni en la
  raíz, ni en otro bucket, no borra los de A; `anon` ve 0.
- Navegador (Chromium, 360 px, micrófono simulado, Supabase simulado):
  grabación con contador, reproductor, guardado (nota `draft` → subida a
  `<agent_id>/<nota>.webm` → `audio_url`), transcripción automática una
  sola vez, 502 con «Reintentar transcripción» que funciona después,
  corrección persistida, «No encontrado» con id ajeno, vendidos ocultos,
  sin desbordamiento ni errores de consola; ninguna petición envía
  `agent_id`. Parche de la Fase 3: `/inmuebles/nuevo` sugiere V-55 con
  V-54 existente y `285,000` → `285.000` al salir del campo.
- Chrome sube `audio/webm;codecs=opus` y el bucket admite `audio/webm`:
  Supabase Storage quita los parámetros antes de comparar
  (`src/storage/validators/mime-type.ts`), así que se acepta.
- `gh-pages` contiene la Fase 4 y el parche; `404.html` = `index.html`.
- **Verificado por Luis en el móvil (Pages, 2026-11-11):** voz real de
  ~20 s grabada, transcrita y guardada como «Transcrita» (criterio 3);
  micrófono bloqueado → mensaje y pestaña Texto operativa (criterio 4);
  recarga de fichas de cliente y de nota sin 404 (criterio 9 de la Fase 3
  y 11 de la Fase 4); alta de cliente e inmueble por la UI (Fase 3,
  criterios 1 y 3). **Fase 4 cerrada.**
- Mejoras menores, aplazadas a la Fase 9 (decisión de Luis: no tocar
  código ahora):
  - «Reintentar subida» tras un fallo parcial (audio subido pero
    `audio_url` sin guardar) vuelve a subir con `upsert: false` y falla
    siempre (`Capture.tsx`, `handleSaveAudio`): recordar la ruta subida y
    saltarse la subida al reintentar.
  - La URL firmada del audio se vuelve a pedir al terminar la
    transcripción (efecto con `[note]`): depender solo de
    `note.audio_url`.

## HANDOFF FASE 5

- Hecho: extracción con evidencia + revisión y aprobación. Migración
  0007 (columnas de revisión, marcas de tiempo y dos triggers guard);
  Edge Function `extract` (`index.ts` + `rules.ts`, mismo patrón que
  `transcribe`); revisión en `/notas/:id` (extraer, evidencia
  resaltada, aceptar/editar/descartar/recuperar/añadir, volver a
  extraer, aprobar); registro de revisión (resumen con contadores);
  tipos y capa de datos (`src/features/extraction/`); errores P0001
  traducidos a español. Sin tocar `transcribe`, las migraciones
  0001–0006, `tasks`/`drafts`/`crm_exports` ni las mejoras aplazadas
  a la Fase 9.
- Tablas/columnas/triggers/políticas creadas o cambiadas: **solo la
  migración `0007_extraccion_revision.sql`** (idempotente, comentada
  en español). `extracted_facts`: `origin` (`ia`/`agente`, por
  defecto `ia`), `review_status` (`propuesto`/`aceptado`/`editado`/
  `descartado`, por defecto `propuesto`), `original_value`,
  `reviewed_at`. `visit_notes`: `extracted_at`, `approved_at`.
  Trigger `visit_notes_guard` (`before update`, `security invoker`):
  nota aprobada → `nota_aprobada` (P0001); aprobar con datos
  `propuesto` → `datos_sin_revisar` (P0001), si no, pone
  `approved_at`; cambiar `raw_text`/`transcript` fuera de `draft` o
  `transcribed` → `texto_bloqueado` (P0001). Trigger
  `extracted_facts_guard` (`before insert or update or delete`):
  nota aprobada → `nota_aprobada`; si la nota ya no existe (borrado
  en cascada), permite la operación. Archivo
  `docs/deploy/supabase-fase-5.sql` con solo la 0007 (idéntico a la
  migración, comprobado con `diff`). No toca RLS.
- RLS / Edge Functions activas: las políticas de 0004 sin cambios.
  La 0007 **está aplicada** (Luis, SQL Editor, 2026-11-12;
  columnas y triggers verificados por API) y `extract` **está
  desplegada** (v6, `verify_jwt: true`; `index.ts` + `rules.ts`).
  Los *secrets* `EXTRACT_*` existen (verificados por API, solo
  nombres). **Cambio de modelo 2026-11-12:** `EXTRACT_MODEL` es
  ahora `gemini-3.5-flash-lite` (puesto por Argo por la Management
  API), no `gemini-3.8-flash`: 3.8-flash (y 2.5-flash) se cuelgan
  sin responder en el endpoint OpenAI-compatible de chat (60–133 s,
  probado desde la VM y desde la función), mientras que 3.5-flash-lite
  responde en 0,7 s y con el cuerpo exacto de `extract` en 7,7 s.
  La clave de Gemini se cambió también el 2026-11-12 (nueva clave
  de AI Studio, puesta por Argo por la Management API): la anterior
  daba el mismo 502. Sin `service_role` en el cliente ni en la
  función.
- Rutas/pantallas nuevas o ampliadas: `/notas/:id` (mismo archivo y
  patrones): botón «Extraer datos» en `transcribed` («Extrayendo…»,
  aviso si se descartan datos sin cita); texto con la cita del dato
  seleccionado resaltada en `<mark>` (`bg-surface` + subrayado, sin
  colores nuevos) y desplazamiento hasta ella; datos agrupados por
  categoría en el orden Objeciones, Presupuesto declarado, Citas
  pendientes (sin confirmar), Por confirmar, Hechos declarados,
  Observaciones; tarjeta con etiqueta legible, valor, cita, confianza
  («Confianza alta/media/baja»), badge de revisión y «IA» o
  «Añadido por ti»; acciones Aceptar/Editar (1–300, guarda
  `original_value` la primera vez)/Descartar/Recuperar (descartados
  plegados en «Descartados (N)»); «Añadir dato» (categoría, nombre a
  `snake_case`, valor, cita opcional que debe estar en el texto;
  `origin = 'agente'`, `review_status = 'aceptado'`, `confidence`
  null); «Volver a extraer» solo en `extracted` sin datos revisados,
  con confirmación; resumen «IA: N propuestos · N aceptados · N
  editados · N descartados · N añadido por ti»; «Aprobar nota» solo
  sin datos `propuesto` y con al menos uno no descartado, con
  confirmación; tras aprobar, «Aprobada el …» y todo en solo lectura
  (también «Corregir»). Estados: «Datos extraídos», «En revisión»,
  «Aprobada». 360 px por diseño (una columna, botones `lg` de 48 px);
  pendiente de comprobar en navegador.
- Dependencias nuevas: **ninguna de producción**. Solo `resolve.alias`
  en `vite.config.ts` para que Vitest resuelva el `npm:zod@4` de
  `rules.ts` (la build no empaqueta `supabase/functions`).
- Errores o warnings de build: `npm test` — 88 pruebas en 10
  archivos, todas en verde (61 previas + 27 nuevas: 12 de `rules.ts`,
  6 de `labels.ts`, 7 de `evidence.ts`, 2 de `db-errors.ts`); `npx tsc
  --noEmit` sin errores (y `tsc -b` en el build); `npm run build` sin
  errores en base `/` y con `VITE_BASE_PATH=/inmo-visitas/`; `npm run
  lint` (oxlint) 0 errores y 2 warnings, los previos de shadcn
  (`button.tsx` y `badge.tsx`). Trozo JS mayor: **255 kB**
  (`vendor-react`), por debajo de 500 kB. `dist/404.html` copiado de
  `dist/index.html` en la build de Pages. `deno check` NO ejecutado:
  no hay Deno en esta máquina (queda para la revisión de Claude).
- Qué se envía exactamente al modelo y qué devuelve con la nota de
  ejemplo: la función envía SOLO el texto de la nota (el cuerpo es
  `{ model, temperature: 0, response_format: { type: 'json_object' },
  messages: [ { role: 'system', content: SYSTEM_PROMPT }, { role:
  'user', content: <transcript ?? raw_text> } ] }`). Con la nota de
  ejemplo (Ana + V-18), la salida esperada es como mínimo: objeción
  «ruido nocturno de la calle» («Le preocupa el ruido de la calle
  Alcalá por la noche»), cita_pendiente «segunda visita el viernes,
  sin confirmar» («Quiere volver el viernes»), desconocido «hora de
  la segunda visita» («falta confirmar la hora»), presupuesto
  «230.000 €» declarado («su presupuesto es de 230.000 euros») y
  hecho_declarado «pide gastos de comunidad e IBI» («pide que le
  mandemos los gastos de comunidad e IBI»). Verificado en test:
  `applyExtractionRules` con esos 5 datos y esa nota los conserva a
  los 5 (`rules.test.ts`, «con la nota de ejemplo se quedan los 5
  datos esperados»). **Respuesta real del modelo verificada por API
  2026-11-12 (con `gemini-3.5-flash-lite`, 5,2 s):**
  `{"facts_inserted": 5, "discarded_no_evidence": 0,
  "discarded_sensitive": 0}`; los 5 datos, todos con cita literal:
  objeción ruido («Le preocupa el ruido de la calle Alcalá por la
  noche»), cita_pendiente segunda visita («Quiere volver el viernes,
  falta confirmar la hora», valor «Viernes, hora por confirmar»),
  presupuesto 230.000 € declarado, hecho_declarado gastos de
  comunidad e IBI y hecho_declarado acompañante («Su pareja»). La
  hora sin confirmar queda recogida dentro del valor de la cita
  pendiente, no como dato `desconocido` aparte (decisión del modelo,
  no del código). La clave no aparece en el repo, en `dist/` ni en
  la red del navegador: solo los NOMBRES de los *secrets*
  (`Deno.env.get(…)`), sin valores.
- Supuestos tomados o pendientes:
  - **Verificado por API 2026-11-12 (29/29):** `extract` 200 en la
    nota de ejemplo (2,8–5,2 s; re-extracción también 200 y
    sustituye los datos propuestos); 5 datos con cita literal
    (cita del viernes como pendiente, presupuesto como declarado,
    hora sin confirmar dentro de la cita); `extract` con el JWT de
    B sobre la nota de A → 404, sin JWT → 401, B no ve los datos
    de A; en una nota de prueba aparte: aceptar, editar (guarda
    `original_value`), descartar/recuperar y añadir persisten, la
    nota pasa a «En revisión»; aprobar con datos propuestos falla
    con `datos_sin_revisar`; tras revisar todo, aprobar pone
    `approved_at`; después, cambiar texto/dato o añadir uno falla
    con `nota_aprobada`; corregir el texto de una nota `extracted`
    falla con `texto_bloqueado`; borrar la nota aprobada borra sus
    datos sin error. La nota de prueba se borró tras la verificación;
    la nota de ejemplo queda en `extracted` con sus 5 datos en
    «Propuesto» para las pruebas de navegador de Luis.
  - **Parche 2026-11-12 (etiqueta de inicio):** la pantalla de inicio
    de la Fase 5 decía «inmo-visitas · Fase 4» (la etiqueta no se
    actualizó al construir la fase) y el pie decía que la extracción
    «llega en la Fase 5»; se corrigieron a «Fase 5». No era un
    problema de caché: la versión publicada era la Fase 5 y la
    etiqueta mentía.
  - **Criterio 9 sin verificar:** no se probó el 502 sin
    `EXTRACT_API_KEY` ni con el proveedor caído (habría que quitar
    el secret o tumbar el proveedor; la nota seguiría en
    `transcribed` según el código).
  - **Verificado en navegador por Luis 2026-11-12:** nota de ejemplo
    en `/notas/e0782f7c-…`: 5 datos con citas, viernes como pendiente
    y presupuesto como declarado; resaltar cita al tocar un dato;
    aceptar/editar (guarda `original_value`)/descartar/recuperar
    con persistencia tras recargar; «Añadir dato» (uno añadido por
    él); «Aprobar nota» aparece solo sin datos «Propuesto» (antes
    muestra «Revisa todos los datos propuestos antes de aprobar»);
    nota aprobada («Aprobada el 12 nov 2026, 14:32») y todo en solo
    lectura. Verificado por API: nota `approved`, 0 propuestos, 6
    datos revisados (5 de IA + 1 añadido por Luis). Luis apunta
    pequeñas cosas que pulir, para recopilarlas juntas tras revisar
    con un posible cliente (no se detallan aquí).
  - `deno check` de `extract` no ejecutado (sin Deno): lo hace
    Claude en la revisión.
  - La copia de `hasEvidence` en `src/features/extraction/evidence.ts`
    es la misma lógica que `supabase/functions/extract/rules.ts`: si
    cambia una, hay que cambiar la otra.
- Cómo probarlo (en vivo contra el proyecto de pruebas, con la nota
  de ejemplo Ana + V-18, id `e0782f7c-8409-4e23-a2b0-5972521fed0a`):
  - **Ya hecho 2026-11-12:** 0007 aplicada en el SQL Editor;
    *secrets* `EXTRACT_*` creados (`EXTRACT_MODEL` =
    `gemini-3.5-flash-lite`, `EXTRACT_API_KEY` = clave nueva de AI
    Studio, puestos por Argo por la Management API); `extract`
    desplegada (v6). La nota de ejemplo está en `extracted` con
    sus 5 datos en «Propuesto».
  - Criterio 1 (navegador): en `/notas/e0782f7c-…`, «Extraer datos»
    → al menos los 5 datos de la tabla, cada uno con su cita
    resaltable; la cita del viernes como pendiente y el presupuesto
    como declarado.
  - Criterio 2 ✅ (tests): dato sin cita se descarta
    (`rules.test.ts`, `applyExtractionRules`) y la UI avisa del
    número; pendiente de ver el aviso en el navegador.
  - Criterio 3 ✅ (tests): campo sensible (`estado_salud`) se
    descarta (`rules.test.ts`).
  - Criterio 4 ⏳ pendiente de navegador: aceptar, editar (guarda
    `original_value`), descartar, recuperar y añadir persisten tras
    recargar; la nota pasa a «En revisión» con la primera acción.
  - Criterios 5–9 ⏳ pendientes de Luis (ver arriba).
  - Criterio 10 ✅ (código): al modelo solo va el texto de la nota;
    la clave no está en el repo, `dist/` ni la red del navegador.
  - Criterio 11 ✅ (local): `npm test` 88/88, `tsc --noEmit` y
    `tsc -b` sin errores, `npm run build` sin errores en ambas
    bases, `npm run lint` 0 errores (2 warnings previos de shadcn),
    trozo mayor 255 kB. `deno check` pendiente (sin Deno).
  - Criterio 12 ⏳ pendiente: cada pantalla y acción nueva probada
    en el navegador, a 360 px y sin errores de consola (lo hace
    Luis en el móvil y en Pages).
  - Datos de prueba que QUEDAN en el proyecto: sin cambios (nota de
    ejemplo Ana + V-18, Marta + V-31, nota de voz de Luis
    `2f328d2c-…`, V-54, V-52 de A, V-52 y V-18 de B, nota sobre
    David Romero). La extracción en vivo creará los datos de la
    nota de ejemplo.

---

## Revisión de la Fase 5 (Claude, sin cambio de fase)

Revisión del 2026-11-12 (`v0.4-fase-4..7acc07e`, tag `v0.5-fase-5` +
parche de la etiqueta de inicio + docs), en Claude Code. Ajustes
aprobados por Luis (I-1, I-2 y mejoras 1–5).

**Comprobado sobre la entrega de Muse:**

- `npm ci`, `tsc --noEmit`, `npm test` (88/88), `npm run lint` (0
  errores, 2 avisos previos de shadcn) y `npm run build` sin errores.
- **`deno check supabase/functions/extract/index.ts` OK** (Deno 2.9.6):
  pendiente del HANDOFF resuelto.
- Migraciones 0001–0007 en PostgreSQL 16 temporal con `auth` y
  `storage` simulados; la 0007 se puede aplicar dos veces;
  `docs/deploy/supabase-fase-5.sql` idéntico a la migración.
- Triggers: `datos_sin_revisar`, `nota_aprobada` (cambiar, añadir o
  borrar un dato y tocar el texto) y `texto_bloqueado` saltan cuando
  deben; borrar una nota aprobada borra sus datos sin error.
- Prueba negativa de RLS: B ve 0 datos de A, su `update` no afecta a
  ninguna fila y su `insert` en una nota de A lo rechaza la RLS.
- Pruebas en navegador de Luis (12 nov.): los puntos 1–6 de la nota de
  ejemplo, **«Extraer datos» en su nota de voz** (`2f328d2c-…`) y **V-55
  prellenado** en `/inmuebles/nuevo` (pendiente del parche de la Fase
  3), todo OK.

**Encontrado y corregido en este PR:**

- **I-1 (Importante): la nota podía volver atrás de estado.** Con dos
  `update` por API (`status = 'transcribed'` y luego `raw_text`) se
  cambiaba el texto de una nota ya extraída: los datos quedaban con
  citas que no estaban en el texto y la nota se podía aprobar.
- **I-2 (Importante): se podía aprobar sin extracción.** La base
  aceptaba `draft`/`transcribed` → `approved`, incluso sin datos; en la
  UI, «Añadir dato» aparecía ya en `transcribed` y con un dato añadido
  se activaba «Aprobar nota».
- **Migración `0008_ajustes_revision_fase_5.sql`** (la 0007 no se
  toca; idempotente; `docs/deploy/supabase-fase-5-ajustes.sql` idéntica):
  - `visit_notes_guard` sustituida: transiciones solo hacia delante
    (`draft → transcribed → extracted (→ extracted) → reviewed →
    approved`, y `extracted → approved`); cualquier otra →
    `transicion_no_valida` (P0001). Aprobar exige además al menos un
    dato no descartado → si no, `nota_sin_datos` (P0001).
  - Trigger nuevo `visit_notes_insert_guard` (`before insert`): una
    nota nace en `draft` o `transcribed`, sin `extracted_at` ni
    `approved_at`; si no, `transicion_no_valida`.
  - Probado en PostgreSQL: 0001–0008 por migraciones y todo concatenado
    en base vacía; 0008 aplicada dos veces; altas de voz y texto,
    flujo de `transcribe` (`draft → transcribed` con texto), flujo de
    `extract` (insertar, borrar los de IA, `→ extracted`, re-extraer),
    `extracted → reviewed → approved` OK; `extracted → transcribed`,
    `reviewed → extracted`, `draft/transcribed → approved` y alta en
    `approved` → `transicion_no_valida`; todo descartado →
    `nota_sin_datos`.
- `translateDbError`: `transicion_no_valida` → «La nota no puede pasar
  a ese estado»; `nota_sin_datos` → «La nota necesita al menos un dato
  no descartado para aprobarla» (con test).
- `NoteDetail.tsx`: «Añadir dato» solo en `extracted` o `reviewed`
  (`canAddFact`).
- **Mejora 1, cita mínima:** `hasEvidence` exige al menos 2 palabras y
  8 caracteres (normalizada) en `rules.ts` y en la copia
  `src/features/extraction/evidence.ts`. Test de paridad nuevo en
  `rules.test.ts` que compara las dos copias con las mismas citas.
- **Mejora 2, datos sensibles por valor:** `isSensitiveFact` =
  `isSensitiveField(field_name)` o `isSensitiveValue(value)`;
  `SENSITIVE_VALUE_PATTERNS` (salud, enfermedad, diagnóstico, religión,
  etnia, raza, nacionalidad, orientación sexual, ideología, afiliación
  política, sindicato, embarazo, discapacidad) sin tildes y con límite
  de palabra. No marca «terraza», «saludos», «el origen del ruido» ni
  «política de mascotas» (tests). La cita no se mira.
- **Mejora 3, errores de `extract`:** `extractNote` muestra el mensaje
  propio de la función en 400 y 409 («La nota ya está en revisión»); el
  resto sigue con el mensaje genérico.
- **Mejora 4, `SYSTEM_PROMPT`:** dos frases nuevas: lo que falta o está
  sin confirmar va además como dato `desconocido` con su propia cita, y
  cada cita tiene al menos dos palabras seguidas de la nota.
- **Mejora 5, documentación y etiqueta:** este bloque sustituye a los
  «⏳ pendiente» del HANDOFF FASE 5 (criterios 1, 4–8 y 12 verificados
  por Luis o por API; 11 completo con `deno check`). La etiqueta de
  fase de cada pantalla pasa a una constante única,
  `src/lib/app-label.ts` (`APP_PHASE_LABEL`): `/notas/:id`,
  `/capturar`, clientes, inmuebles y login decían «Fase 2/3/4».
- Tras los ajustes: `tsc --noEmit`, `npm test` **94/94**, `npm run
  lint` (0 errores, 2 avisos previos), `npm run build` con base
  `/inmo-visitas/` (trozo mayor 255 kB) y `deno check` de `extract`
  sin errores. Navegador (Playwright, 360 px, Supabase simulado):
  `transcribed` sin «Añadir dato» y el 409 muestra «La nota ya está en
  revisión»; `extracted` con «Añadir dato»; sin desbordamiento ni
  errores de consola.

**Pendiente:**

- **Luis (antes de la Fase 6):** 1) pegar
  `docs/deploy/supabase-fase-5-ajustes.sql` en el SQL Editor;
  2) volver a desplegar `extract` con `index.ts` y `rules.ts`
  actualizados (`supabase/functions/README.md`); 3) desplegar Pages.
  Comprobación rápida: «Volver a extraer» o «Extraer datos» en una
  nota nueva de prueba sigue dando datos, y la nota de ejemplo ya
  aprobada sigue en solo lectura.
- **Criterio 9 sin probar en vivo** (502 sin clave o con el proveedor
  caído). Por el código: devuelve 502 antes de escribir nada y la nota
  sigue en `transcribed`. Se acepta así.
- Notas aprobadas antes de la 0008: no cambian (la 0008 no reescribe
  datos).

---

## Despliegue de la revisión de la Fase 5 (Argo, 2026-11-12)

- `git pull origin main` (PR #7 fusionado: `9d374e7`). Verificado en
  local: `npm test` 94/94, `tsc --noEmit` sin errores, `npm run lint`
  0 errores (2 avisos previos de shadcn); `docs/deploy/supabase-fase-5-ajustes.sql`
  idéntico a la migración 0008.
- **0008 aplicada por Argo por la Management API** (no en el SQL
  Editor): triggers `visit_notes_guard` (UPDATE) y
  `visit_notes_insert_guard` (INSERT) verificados en la base.
  Verificado por API: `transcribed → approved` y alta en `approved`
  bloqueados con `transicion_no_valida`; `extracted → transcribed`
  bloqueado con `transicion_no_valida`; nota de ejemplo sigue
  `approved` y en solo lectura.
- **`extract` ya redesplegada por Luis (v13)** con el código nuevo:
  la extracción devuelve 6 datos, incluido el `desconocido`
  `hora_cita` del nuevo `SYSTEM_PROMPT`.
- **Extracción lenta/intermitente hoy (2026-11-12):** desde la
  función, la llamada al proveedor a veces tarda 28 s, a veces
  cuelga 60 s (502) y a veces falla rápido (502); al reintentar
  funciona. Desde la VM, el mismo modelo y cuerpo exacto responde
  en 1,5 s, así que no es el modelo ni la clave: es el camino
  Supabase → Google (o la API hoy; `gemma` también tardó 35 s en
  una prueba). La UI tiene reintento («Volver a extraer»).
- **Pages pendiente de token:** build lista en local con
  `VITE_BASE_PATH=/inmo-visitas/` y `dist/404.html` copiado; el
  `git push` a `gh-pages` falló por falta de credenciales (Luis no
  había pegado el token en este turno). En vivo sigue la build
  anterior (etiqueta corregida). La cabecera «inmo-visitas · Fase 5»
  está en el build local (constante `APP_PHASE_LABEL`); queda
  comprobarla en vivo tras el despliegue.

- **Parche de etiqueta (Argo, 2026-11-12, `7d0ba2e`):** al comprobar
  en vivo que la cabecera dijera «inmo-visitas · Fase 5», tres
  pantallas seguían con la etiqueta escrita a mano: Perfil y
  lista de Inmuebles («Fase 3») y Registro («Fase 2»). Se pasaron
  a `APP_PHASE_LABEL`, como el resto. Verificado en local y en vivo:
  94/94 tests, `tsc` sin errores, build con base `/inmo-visitas/`,
  MD5 del índice en vivo igual al local, y en `dist/` ya solo quedan
  «Fase 1» (pantalla de diseño, intencionado) y «Fase 5».

## Cierre de la Fase 5 (Claude, 2026-11-12)

- **Fase 5 cerrada.** Muse/Argo desplegó Pages (`gh-pages` `0b2e850`,
  código `7d0ba2e`) e hizo la prueba rápida en vivo: cabecera
  «inmo-visitas · Fase 5» y MD5 del índice en vivo igual al local.
- Comprobado por Claude sobre `main` (`c0781f8`): `tsc --noEmit` sin
  errores, `npm test` 94/94, `npm run lint` 0 errores (2 avisos previos
  de shadcn). El parche solo cambia la etiqueta de Perfil, Inmuebles y
  Registro por `APP_PHASE_LABEL`; en `src/` ya no quedan etiquetas de
  fase escritas a mano en cabeceras (las menciones restantes son
  comentarios y el texto de la portada, Fase 5). La web en vivo no se
  pudo abrir desde el contenedor de Claude: se acepta la verificación
  MD5 de Argo.
- Queda abierto: la extracción lenta o intermitente del camino
  Supabase → Google (ver ESTADO) y los pulidos que salgan con un posible
  cliente.
- Siguiente: **Fase 6** (borradores duales + bandeja de pendientes +
  lista de notas), solo cuando Luis lo pida. Al empezarla, cambiar
  `APP_PHASE_LABEL` y el texto de la portada (`Home.tsx`).


## HANDOFF FASE 6: borradores duales + bandeja de pendientes (Muse, 2026-11-12)

**Construida, sin commit, sin tag, sin push y sin desplegar a Pages.**
`git pull origin main` al empezar: ya estaba al día (HEAD `cb5f74d`,
PR #9 fusionado). Sin tocar 0001–0008, `transcribe` ni `extract`, sin
cambiar RLS ni el guard de `visit_notes`, sin `service_role`, sin
claves nuevas (la función usa los `EXTRACT_*` que ya existen, con
fallback `DRAFT_*`), sin columnas en `visit_notes`, sin dependencias
nuevas de producción.

### Archivos creados

- `supabase/migrations/0009_borradores_tareas.sql` (9.396 bytes) y
  copia idéntica `docs/deploy/supabase-fase-6.sql` (`diff` verificado).
  `tasks`: estado `propuesta/pendiente/completada/descartada` (defecto
  `pendiente`), `origin` (`ia/regla/agente`), `source_fact_id`,
  `original_description`, `completed_at`, `updated_at`, índice
  `tasks_agent_status_due_idx`; `tasks_guard` (insert/update/delete).
  `drafts`: `status` (`borrador/aprobado`), `original_content`,
  `generated_at/edited_at/approved_at`, único `(visit_note_id,
  audience)`, check de filtrado en propietario y longitud 1–1500;
  `drafts_guard` (insert/update/delete).
- `supabase/functions/drafts/index.ts` + `rules.ts` + `rules.test.ts`.
- `src/features/followup/api.ts` (preparar, borradores, tareas de la
  nota; reexporta las de `tasks/api.ts`).
- `src/features/tasks/api.ts` + `buckets.ts` + `buckets.test.ts`.
- `src/pages/Notes.tsx` (`/notas`), `src/pages/Pending.tsx`
  (`/pendientes`).

### Archivos modificados

- `src/lib/database.types.ts` (`TaskRow/Insert/Update`, `TaskStatus`,
  `TaskOrigin`, `DraftRow/Insert/Update`, `DraftAudience`,
  `DraftStatus`; `tasks` y `drafts` en `Database`; relaciones de
  `visit_notes` con `clients`/`properties` para los selects
  incrustados).
- `src/lib/db-errors.ts` + tests: `nota_no_aprobada`,
  `borrador_aprobado`, `fuente_no_valida`, 23505 de borradores con
  contexto `{ drafts: true }`; `transicion_no_valida` con contexto
  `{ task: true }` → «La tarea no puede pasar a ese estado» (sin
  contexto sigue el texto de la nota, fijado por test).
- `src/lib/search.ts` + `src/pages/search.test.ts`:
  `matchesNoteQuery` (cliente o referencia, sin tildes).
- `src/features/notes/api.ts`: `listNotes` (estado + búsqueda +
  paginación 25/25, con cliente e inmueble), `listNotesByStatus`,
  `getNotesByIds`.
- `src/pages/NoteDetail.tsx`: sección «Seguimiento» (solo nota
  aprobada) con borradores, tareas propuestas, descartadas plegadas,
  «Añadir tarea» y resumen.
- `src/App.tsx` (rutas `/notas` y `/pendientes`, lazy +
  `RequireAuth`), `src/components/PrivateNav.tsx` («Notas» y
  «Pendientes» con contador), `src/pages/Home.tsx` (enlaces a Notas y
  Pendientes con contador; texto «Fase 6 — Borradores duales +
  bandeja de pendientes»), `src/lib/app-label.ts`
  (`'inmo-visitas · Fase 6'`).
- `supabase/functions/README.md`: sección `drafts` (despliegue,
  *secrets* con fallback, curl).

### Verificaciones (2026-11-12, todo en verde)

- `npm test`: **141/141** (94 previos + 47 nuevos: `rules.test.ts`
  37, `buckets.test.ts` 6, `db-errors.test.ts` 2, `search.test.ts` 2).
- `npx tsc --noEmit` sin errores y `npm run build` sin errores en
  base `/` y con `VITE_BASE_PATH=/inmo-visitas/`; `dist/404.html`
  copiado. Mayor trozo JS: `vendor-react` 255.497 bytes (< 500 kB).
- `npm run lint`: 0 errores, 2 avisos (los de shadcn aceptados).
- Grep: 0 claves (`gsk_`/`AIza`/`sk-`) en `src/`, `supabase/` y
  `docs/` (la única mención de `gsk_` es el informe de 0
  ocurrencias en `docs/HANDOFF.md`); `service_role` solo en
  comentarios («NUNCA `service_role`»).
- Lección: `npm run build` (`tsc -b`) es más estricto que `npx tsc
  --noEmit`: pilló un `PostgrestError` inventado en `tasks/api.ts`
  (faltaban `toJSON` y `name`); se pasa el error real de Supabase.
  Hay que correr siempre el build, no solo `tsc --noEmit`.
- Sin `psql`, `docker` ni `deno` en esta máquina: la 0009 no se ha
  ejecutado en local y no hay `deno check` de `drafts` (lo hará
  Claude en la revisión, como en la Fase 5).

### Qué se envía al modelo en cada llamada (copiado del código)

Dos llamadas en paralelo (`Promise.all`), chat completions,
`temperature: 0.3`, `response_format: { type: 'json_object' }`,
*timeout* 60 s cada una. Solo categoría, nombre y valor de los datos
no descartados + la referencia del inmueble. Ni nombres, ni
teléfonos, ni dirección, ni precio, ni citas.

Llamada del comprador — sistema (`SYSTEM_PROMPT_BUYER`):

> Eres un asistente que redacta el mensaje que un agente
> inmobiliario envía a un comprador tras una visita. Escribe en
> español, con tuteo, cercano y profesional, entre 60 y 140
> palabras. Empieza por «Hola {nombre},» y firma con «{agente}».
> Usa {inmueble} para referirte al inmueble. Responde a lo que el
> cliente pidió o a sus objeciones sin prometer nada que no esté en
> los datos. Si hay una cita pendiente, NUNCA la des por
> confirmada: propón confirmarla y pregunta qué falta (por ejemplo,
> la hora). No menciones el presupuesto ni la financiación. No
> inventes ningún dato. Devuelve SOLO un objeto JSON {"draft":
> "...", "tasks": [{"description": "...", "fact_index": n}]} con
> las tareas que el agente debería hacer a partir de los datos
> (máximo 10, descripción breve de 3 a 200 caracteres, fact_index
> es la posición del dato en la lista enviada, empezando en 0).

Usuario (nota de ejemplo, Ana + V-18):

```json
{"inmueble": "V-18", "datos": [{"category": "objecion", "field_name": "ruido_calle", "value": "Ruido de la calle Alcalá por la noche"}, {"category": "cita_pendiente", "field_name": "proxima_visita", "value": "Viernes, hora por confirmar"}, {"category": "desconocido", "field_name": "hora_cita", "value": "Hora de la segunda visita por confirmar"}, {"category": "presupuesto", "field_name": "presupuesto_declarado", "value": "230.000 euros"}, {"category": "hecho_declarado", "field_name": "informacion_solicitada", "value": "Gastos de comunidad e IBI"}]}
```

Llamada del propietario — sistema (`SYSTEM_PROMPT_OWNER`):

> Eres un asistente que redacta el mensaje que un agente
> inmobiliario envía al propietario de un inmueble tras una visita.
> Escribe en español, con usted, entre 50 y 120 palabras. Empieza
> por «Hola {propietario},» y firma con «{agente}». Usa {inmueble}
> para referirte al inmueble. Al cliente llámalo «el cliente» o
> «la persona interesada», nunca por su nombre. No menciones el
> presupuesto, ofertas ni la situación económica del comprador. Si
> hay una cita pendiente, NUNCA la des por confirmada. No inventes
> ningún dato. Devuelve SOLO un objeto JSON {"draft": "..."}.

Usuario: igual que el comprador pero sin el dato de presupuesto
(`ownerFacts` quita `presupuesto` y cualquier dato con término
económico o cifra de dinero): 4 datos.

Sustitución de marcadores (en el servidor, tras validar):
`{nombre}` = nombre de pila del cliente (provisional → se quita y
queda «Hola,»); `{propietario}` = nombre de pila del propietario;
`{inmueble}` = referencia + dirección, p. ej. `V-18 (calle Alcalá
120)`; `{agente}` = nombre completo del agente.

### Reglas en las pruebas (reintentos, 422)

En `rules.test.ts` las reglas saltan en **18 tests**: `ownerLeaks`
4 tests de rechazo (cifras `230.000 €` y `230000`, términos
`presupuesto` e `hipoteca`, nombre `Ana` y apellido `García`);
`confirmsAppointment` 2 («queda confirmada la visita del viernes a
las 18:00» y una hora inventada); `checkPlaceholders` 3 (marcador
desconocido `{telefono}` y `{nombre}` en el propietario);
`validateDraft` 3 rechazos de principio a fin; `requiredTasks` añade
la tarea de regla en 2 tests; el parseo Zod rechaza 4 respuestas
inválidas (JSON no válido, borrador vacío o de más de 1500, tarea
corta o `fact_index` negativo, más de 10 tareas). **0 reintentos
reales y 0 códigos 422 en los tests**: el bucle de reintento y el 422
viven en `index.ts` (Deno, no se prueba en Vitest); el camino 422 se
acepta por el código, como el criterio 10 de la Fase 5.

### Decisiones de interpretación (no están en el prompt; a revisar)

- `tasks_guard` es `before insert or update or delete` (el prompt
  dice «insert or update»): sin el evento DELETE no se puede aplicar
  la regla de borrado.
- Insertar una tarea como `completada`/`descartada` y borrar fuera de
  regla lanzan `transicion_no_valida` (el prompt no nombra el error).
- Insertar un borrador con `status = 'aprobado'` pone `approved_at`
  si es null (el prompt no lo especifica).
- `updated_at` no tiene defecto en el insert (el trigger lo pone en
  el update).
- `validateDraft` recibe el texto crudo + los valores de los
  marcadores y devuelve el texto ya sustituido; `confirmsAppointment`
  recibe `(text, facts)` (el prompt lo lista como `(text)`);
  `ownerLeaks` devuelve el motivo, no solo booleano.
- Con `audience = 'comprador'` se añade al sistema «No incluyas
  tareas en la respuesta.» (las tareas solo se piden sin `audience`).
- Sin `audience`, si algún borrador pedido ya está `aprobado` → 409.
- En «Seguimiento» solo se listan las tareas propuestas y las
  descartadas; las aceptadas (`pendiente`/`completada`) se ven en
  `/pendientes` (enlace «Ver en Pendientes» bajo el resumen).
- Si el borrador del comprador falla las reglas dos veces (sin
  `audience`), las tareas propuestas antiguas se quedan (no se
  borran): solo se guardan el borrador del propietario y sus tareas
  si el del comprador pasó.
- La respuesta 422 es solo `{ error }`; la UI recarga los borradores
  para saber cuál falta y ofrecer «Escribir yo».
- `listNotes` carga todas y filtra en cliente (patrón del resto de
  listas); con muchas notas convendrá paginar en la base (Fase 9).

### Qué queda pendiente (para Luis / el padre)

1. **Aplicar la 0009**: `docs/deploy/supabase-fase-6.sql` en el SQL
   Editor (o por la Management API, como la 0008).
2. **Desplegar `drafts`**: Via Editor con `index.ts` + `rules.ts`
   (ver `supabase/functions/README.md`); sin *secrets* nuevos.
3. **Probar en el navegador a 360 px**, en local y en Pages, cada
   pantalla y acción: «Preparar seguimiento» en la nota de ejemplo
   (Ana + V-18, aprobada), revisar los dos borradores y las tareas,
   aprobar un borrador, «Volver a generar», «Escribir yo» tras un
   422, `/pendientes` (grupos, completar con deshacer, cambiar
   fecha, reabrir) y `/notas` (filtro, búsqueda «garcia», «Cargar
   más»). La extracción es lenta o intermitente hoy (28 s, algún
   502): los borradores usan el mismo proveedor; la UI avisa de
   que puede tardar hasta un minuto.
4. Criterios 1, 4, 6, 9 y 10 necesitan la 0009 aplicada y `drafts`
   desplegada; el `deno check` de `drafts`, en la revisión de
   Claude.
5. Commit «Fase 6: borradores duales + bandeja de pendientes», tag
   `v0.6-fase-6` y push a main (con el token de Luis) + despliegue
   a Pages. No hecho por Muse: no era parte de su tarea.

### Aplicación de la 0009 y verificación del criterio 4 (Argo, 2026-11-12)

- **0009 aplicada por Argo por la Management API** (conector `custom.supabase`,
  como la 0008): `docs/deploy/supabase-fase-6.sql` ejecutado sin error.
  Verificado por API: columnas nuevas en `tasks` (`origin` por defecto
  `agente`, `source_fact_id`, `original_description`, `completed_at`,
  `updated_at`) y en `drafts` (`status` por defecto `borrador`,
  `original_content`, `generated_at` por defecto `now()`, `edited_at`,
  `approved_at`); triggers `tasks_guard` y `drafts_guard` en
  insert/update/delete; checks (`tasks_status_check` con los 4 estados,
  único `(visit_note_id, audience)`, filtrado en propietario, longitud
  1–1500); índice `tasks_agent_status_due_idx`.
- **Criterio 4 verificado por API: 18/18 PASS** (como agente A, en una nota
  de prueba creada y aprobada solo para esto, borrada al final por
  cascada): tarea y borrador en nota no aprobada → `nota_no_aprobada`;
  editar tarea propuesta guarda `original_description`; transiciones
  `propuesta → pendiente → completada`, `completada → propuesta` bloqueada
  con `transicion_no_valida`, `completada` pone `completed_at`, reabrir
  funciona; editar borrador guarda `original_content`; aprobar borrador y
  luego editarlo o borrarlo → `borrador_aprobado`; borrar la nota aprobada
  entera con borradores y tareas **funciona** (cascada RGPD). La nota de
  ejemplo (Ana + V-18) queda intacta, sin tareas ni borradores.
- La API de Supabase estaba muy inestable durante la verificación
  (conexiones cortadas, `RemoteDisconnected`/`IncompleteRead` en lecturas
  y escrituras): cada operación se reintentó hasta 8 veces y los datos se
  confirmaron por lectura antes de seguir. Es el mismo patrón de
  inestabilidad visto con `extract` el 12 nov.
- **Pendiente:** Luis despliega `drafts` (Via Editor, `index.ts` +
  `rules.ts`, sin *secrets* nuevos). Después: criterios 1, 6 y 9 por API
  (borradores y tareas con la nota de ejemplo, «Volver a generar», B → 404,
  sin JWT → 401) y pruebas en el navegador a 360 px en Pages.

### Verificación de `drafts` y corrección de los nombres (Argo, 2026-11-12)

- **Luis desplegó `drafts` él mismo (Via Editor) ~17:39**; confirmado ACTIVO
  v1 por la Management API. Sin *secrets* nuevos (usa `EXTRACT_*`).
- **Criterio 9 verificado por API: ALL PASS** — B → 404 `No encontrado`;
  sin JWT → 401; B no ve tareas ni borradores de A. 409 en nota no
  aprobada → `Aprueba la nota antes de preparar el seguimiento`.
- **Datos vivos de la nota de ejemplo (CORRECCIÓN):** Luis editó un
  dato en su revisión de la Fase 5 y añadió otro — la cita dice ahora
  `Confirma viernes a las 17h` (editado) y hay un dato nuevo
  `[observacion] peticion_informacion = 'Pide informe del administrador
  de cuotas al dia de pago'`. Por eso las 17h y el informe NO eran
  invenciones del modelo: estaban en los datos. La primera lectura de
  Argo (que los llamó invenciones) era ERRÓNEA y se corrige aquí.
- **Defecto real (criterio 1 NO superado):** el modelo sustituye los
  marcadores por nombres inventados en el borrador del comprador:
  dos generaciones seguidas dijeron «Hola Carlos» (el propietario) y
  una firmó «Ana» (la clienta), otra sin firma. Las reglas solo
  validaban marcadores *presentes*; un modelo que escribe nombres
  literales las burlaba. Los dos borradores malos se borraron de la
  base (estaban en `borrador`, no aprobados); la nota queda sin
  borradores hasta el redespliegue.
- **Llamada completa (sin `audience`):** 20 intentos 502 seguidos por
  API y, en cambio, UNA llamada completa de Luis en el navegador sí
  funcionó (17:46, dos borradores creados con 0,46 s de diferencia).
  Prueba de concurrencia desde la VM (3 rondas de dos llamadas en
  paralelo): 200/200, 503/200, 503/503 — NO es un fallo sistemático
  de paralelismo, es `gemini-3.5-flash-lite` devolviendo 503 «high
  demand» con una tasa alta hoy. La UI ya tiene «Reintentar»; no se
  toca el `Promise.all` del prompt.
- **Corrección aplicada (sin commit aún):** en `drafts/index.ts`, los
  dos *system prompts* dicen ahora «Escribe los marcadores tal cual,
  sin sustituirlos por ningún nombre» (mejora de redacción, permitida
  por el prompt); en `drafts/rules.ts`, `validateDraft` exige ahora
  que el texto final mencione al destinatario por su nombre de pila
  y firme con el nombre completo del agente (`requiredNames`, con
  `containsName`/`escapeRegExp`; sin nombre de cliente si es
  provisional). Tests nuevos: los dos borradores malos exactos se
  rechazan, el borrador bueno al propietario con los datos vivos se
  acepta, la hora 17h se acepta porque está en los datos, y el
  provisional no exige nombre. **146/146 tests** (141 + 5), `tsc`
  OK, lint 0 errores, build OK en las dos bases.
- **Pendiente:** Luis redespliega `drafts` («Deploy update», un clic,
  despliega `index.ts` + `rules.ts` a la vez). Después: re-verificar
  por API (criterios 1 y 6: contenido de ambos borradores + tareas
  propuestas con sus datos de origen; aceptar una tarea y regenerar
  un destinatario sin tocar las aceptadas) y probar en el navegador
  a 360 px las pantallas con sesión (la de acceso ya se comprobó:
  renderiza bien, etiqueta «Fase 6»; `/notas` y `/pendientes`
  redirigen a `/login` sin sesión; la ventana del navegador de
  pruebas no bajó a 360 px exactos ni abrió la consola, así que el
  desbordamiento a 360 px y los errores de consola quedan sin
  verificar de momento; primera carga mostró la etiqueta vieja
  «Fase 2» por la caché de la PWA, conocida).

### Re-verificación tras el redespliegue (Argo, 2026-11-12)

- **`drafts` v2 desplegada por Luis ~17:58 (ACTIVA), pero con el
  CÓDIGO VIEJO: la corrección NO está en el despliegue.** La llamada
  completa devolvió un borrador del comprador que sigue diciendo
  «Hola Carlos» y firmando «Ana», con `retries: 0` — la regla nueva
  (`requiredNames`) lo habría rechazado. Causa probable: al pulsar
  «Deploy update» el editor tenía abiertos los archivos de la v1 y
  no se pegaron los nuevos (o la CDN de GitHub sirvió la versión
  anterior). El código de main SÍ tiene el fix (verificado: las URLs
  raw devuelven `requiredNames` y la frase de los prompts).
  **Siguiente paso: Luis vuelve a desplegar pegando de nuevo los
  dos archivos desde las URLs raw y pulsando «Deploy update».**
- **Lo que SÍ está verificado (criterios 1 y 6, con la v2):**
  llamada completa 200 al 8.º intento (7× 502 previos por los 503
  de Gemini); 3 tareas propuestas, todas `origin: ia`, cada una con
  su dato de origen correcto (gastos → dato 4, informe → dato 5,
  cita viernes 17h → dato 1); `tasks_by_rule: 0` (el modelo ya
  propuso la tarea de la cita, así que la regla no añadió ninguna).
  Borrador del propietario BUENO en las dos generaciones («Hola
  Carlos», «Agente A Prueba», sin presupuesto ni nombre de la
  clienta, cita sin confirmar). Criterio 6 PASS: tarea aceptada
  sigue `pendiente` tras regenerar el propietario; el borrador del
  comprador quedó intacto; el del propietario cambió. El borrador
  malo del comprador se borró; queda solo el bueno del propietario.
- **Pendiente:** redespliegue con el código nuevo; después,
  re-verificar solo el borrador del comprador (criterio 1) y probar
  en el navegador a 360 px las pantallas con sesión.

### Redespliegue con el código nuevo y verificación final (Argo, 2026-11-12)

- **Luis redesplegó `drafts` pegando los dos archivos de nuevo:
  v3 ACTIVA ~18:17.** Esta vez el fix SÍ entró: el borrador del
  comprador regenerado dice «Hola Ana, gracias por visitar V-18
  (Calle de Alcalá 120) junto a tu pareja... te propongo confirmar
  el viernes a las 17h, pero dime si te va bien esa hora o
  prefieres otro momento... Un saludo, Agente A Prueba» — destinatario
  correcto, tuteo, responde al ruido y a la petición (gastos, IBI,
  informe), propone la visita sin confirmarla (las 17h están en los
  datos, editadas por Luis), firma con el agente, sin presupuesto.
  **Criterio 1 VERIFICADO POR API: PASS** (comprador + propietario
  + 3 tareas con dato de origen).
- **Resumen de la verificación API de la Fase 6: criterios 1, 4, 6
  y 9 PASS.** Criterio 4: 18/18 (guards). Criterio 9: B → 404, sin
  JWT → 401. Criterio 6: tarea aceptada intacta al regenerar el
  otro destinatario; borrador no regenerado intacto. Llamada
  completa: funciona, pero con reintentos por los 503 de Gemini
  («high demand», tasa alta hoy; no es fallo de paralelismo).
- **Pendiente:** probar en el navegador a 360 px las pantallas con
  sesión (`/notas/:id` con la sección «Seguimiento», `/pendientes`,
  `/notas`) — la de acceso ya se comprobó; la ventana de pruebas no
  bajó a 360 px exactos ni abrió la consola. Después, revisión de
  Claude (pasarle este HANDOFF).

### Prueba en el navegador a 360 px por Luis (2026-11-12)

- **Luis probó en su móvil las pantallas con sesión: TODO CORRECTO,
  sin fallos.** Aclaraciones que hicieron falta durante la prueba:
  la sección «Seguimiento» solo existe en la nota aprobada (Ana +
  V-18, única aprobada); el botón «Preparar seguimiento» no sale en
  ella porque ya tiene borradores y tareas (solo sale en aprobadas
  sin seguimiento, y ahora no hay ninguna); en /pendientes, «Por
  revisar» y «Seguimiento sin preparar» no aparecen por estar a
  cero (correcto, se ocultan). Luis aprobó el borrador del
  propietario durante la prueba (ahora «aprobado»; el del comprador
  sigue en «borrador»). Estado actual de la nota de ejemplo: 2
  borradores (1 aprobado), 3 tareas (1 pendiente + 2 propuestas).
  Datos de prueba nuevos de Luis: 5 notas transcritas más de Ana +
  V-18 y 2 en borrador (Ana V-18 y David Romero V-12).
- **Criterio 12 VERIFICADO.** Queda solo la revisión de Claude.

## Revisión de la Fase 6 (Claude, sin cambio de fase)

Revisión del 2026-11-12 sobre `main` en `e8fb5fe` (tag `v0.6-fase-6`
+ corrección `requiredNames` + docs de Argo), en Claude Code. Ajustes
aprobados por Luis (A-1, A-2 y M-1 a M-4).

**Comprobado sobre la entrega:**

- `npm ci`, `npx tsc --noEmit`, `npm test` (146/146), `npm run lint`
  (0 errores, los 2 avisos de shadcn) y `npm run build` sin errores;
  trozo mayor `vendor-react` 255.497 B.
- **`deno check supabase/functions/drafts/index.ts` OK** (Deno 2.9.6):
  pendiente del HANDOFF resuelto.
- Migraciones 0001–0009 en PostgreSQL 16 temporal con `auth` y
  `storage` simulados; la 0009 se aplica dos veces sin error;
  `docs/deploy/supabase-fase-6.sql` idéntico a la migración.
- **Criterio 4 reproducido en local** (coincide con el 18/18 de Argo):
  `nota_no_aprobada` (tarea y borrador), `fuente_no_valida`,
  `transicion_no_valida` (tarea a mano como `propuesta`,
  `completada → propuesta`, borrar una tarea `completada` de la IA),
  `original_description`, `completed_at`, `original_content` +
  `edited_at`, único por destinatario, check de longitud,
  `borrador_aprobado` al editar y al borrar, y borrado de la nota
  aprobada en cascada sin error.
- Prueba negativa de RLS: B ve 0 tareas y 0 borradores de A, sus
  `update`/`delete` no afectan a ninguna fila y sus `insert` sobre la
  nota de A se rechazan.
- Mensaje 409 «Aprueba la nota antes de preparar el seguimiento»
  (`drafts/index.ts`) correcto y mostrado tal cual por
  `followup/api.ts`. Criterios 6, 9 y 10 coherentes con el código.
- **Criterio 12:** checklist en el navegador hecha por Luis el 12 nov.
  (portada, `/notas`, `/notas/:id` «Seguimiento», `/pendientes`, sin
  desbordamiento a 360 px): todo OK.

**Encontrado y corregido en este PR** (solo `drafts/rules.ts`,
`drafts/index.ts`, `rules.test.ts` y `NoteDetail.tsx`; sin migración):

- **A-1 (Alta): el control del presupuesto en el borrador al
  propietario no hacía nada en producción.** `index.ts` validaba el
  borrador al propietario con `ownerFacts`, que ya no lleva el dato
  `presupuesto`, así que `budgetValues` llegaba siempre vacío: «el
  cliente habló de 230000» o «230.000» (sin €) se aceptaban. El test
  de «230000» pasaba solo porque llevaba «euros». Ahora el contexto de
  `validateDraft` recibe `budgetValues` aparte (`budgetValuesOf` con
  TODOS los datos) y las cifras se comparan sin separadores de miles
  (`joinThousands`, `budgetFigures`: «230000», «230.000», «230 000»).
- **A-2 (Alta): horas inventadas aceptadas.** `a las \d` capturaba un
  solo dígito («a las 18» pasaba con un dato «17h»; «a las 21h»
  pasaba por el «2» de «230.000») y solo se miraba la primera hora de
  cada patrón. Ahora `hoursIn` busca TODAS las horas (`18:00`, `18.00`,
  `18h00`, `18h`, `a las 6`), las normaliza (17:00 = 17h = 5:00) y
  cada una tiene que estar en algún dato.
- **M-1 (Media): `requiredNames` no miraba el saludo.** «Hola Carlos,
  Ana, …» firmado por el agente se aceptaba, y el borrador al
  comprador podía nombrar al propietario. Ahora el nombre de pila del
  destinatario tiene que ir en el saludo (`greetingOf`) y el borrador
  al comprador se rechaza si nombra al propietario.
- **M-2 (Media): una negación desactivaba el control de citas.** Un
  dato «no confirmada» contaba como cita confirmada y dejaba pasar
  «queda confirmada». `factConfirms` ignora ahora «no / sin / por /
  falta / pendiente … confirm».
- **M-3 (Media): callejón sin salida tras un 422.** La tarjeta
  «Escribir yo» dependía de un estado en memoria: tras recargar, el
  destinatario sin borrador desaparecía y no había forma de crearlo.
  Ahora la tarjeta sale siempre que falta el borrador, con «Generar
  borrador» (llama a `drafts` solo con ese `audience`) y «Escribir
  yo». Además, «Reintentar» repite la última llamada (si fue «Volver
  a generar» de un destinatario, no regenera el otro).
- **M-4 (Media): clientes provisionales no detectados.** La función
  buscaba el prefijo `provisional:` en `full_name`, pero el modelo usa
  `clients.is_temporary`. Ahora lee `is_temporary` y, si es provisional,
  el saludo va sin nombre («Hola,»).

**Verificado tras los ajustes:** `npm test` **160/160** (146 + 14
nuevos en `rules.test.ts`, incluidos el borrador bueno del comprador
de la v3 y el bueno del propietario con los datos vivos, que siguen
pasando), `tsc --noEmit`, `npm run build` en base `/` y
`/inmo-visitas/`, lint 0 errores, `deno check` de `drafts` OK.
Navegador a 360 px con Supabase simulado: la tarjeta del comprador sin
borrador muestra «Generar borrador» y «Escribir yo» al cargar la
página; «Generar borrador» llama a `drafts` con `audience:
"comprador"`; sin desbordamiento ni errores de consola.

**Aplazado (baja; anotado para la Fase 9 o el pulido):**

- B-1: si el borrador del comprador falla las reglas (422 sin
  `audience`), la tarea de regla de la cita pendiente no se crea.
- B-2: escrituras no atómicas en `drafts` (borrar + insertar borrador
  y luego tareas): un fallo a mitad deja un 502 con parte guardada.
- B-3: falsos positivos de las reglas que pueden dar 422 repetidos:
  «la entrada del edificio» (término `entrada`), «Calle 3 Milagros»
  (cifra de dinero), agente que comparte apellido con el cliente, «te
  confirmo los gastos».
- B-4: `tasks_guard`/`drafts_guard` no vuelven a comprobar
  `visit_note_id`, `origin` ni `audience` en un `update` (se puede
  mover una tarea a una nota no aprobada o cambiar su origen).

**Pendiente tras fusionar este PR:**

1. **Luis:** redesplegar `drafts` (v4) pegando de nuevo `index.ts` y
   `rules.ts` desde `main` y «Deploy update». Comprobar que entró: en
   el editor, `rules.ts` tiene `budgetValuesOf` y `hoursIn`.
2. **Argo:** «Volver a generar» el comprador de la nota de ejemplo
   por API y comprobar que sale «Hola Ana,» y firma del agente.
3. **Muse:** desplegar Pages con el cambio de `NoteDetail.tsx`.
4. Después, Claude cierra la Fase 6 y escribe el prompt de la Fase 7.

### Verificación tras la revisión (Argo, 2026-11-12)

- **PR #10 fusionado (66d23d8)** y traído a local; `drafts` v4
  ACTIVA (verificado por API, `updated_at` 21:38).
- **Borrador del comprador regenerado por API con la v4 (audience
  solo comprador; el del propietario está aprobado): 200 al primer
  intento, `retries: 0`.** Texto: «Hola Ana, ha sido un placer
  enseñarte V-18 (Calle de Alcalá 120) junto a tu pareja. Respecto
  al ruido de la calle Alcalá por la noche, ten en cuenta que el piso
  cuenta con buenos cerramientos para mitigar el sonido exterior.
  Para avanzar, sobre la próxima visita pendiente, ¿me confirmas si
  te va bien el viernes a las 17h o prefieres matizar la hora?
  Además, te adjunto la información sobre los gastos de comunidad,
  el IBI y el informe del administrador sobre las cuotas al día de
  pago que solicitaste. Un abrazo, Agente A Prueba». **Verificado:
  «Hola Ana,», firma del agente, sin nombrar al propietario, sin
  presupuesto, hora 17h en los datos y sin confirmarla.**
  Observación (no bloqueante): «buenos cerramientos para mitigar el
  sonido exterior» no está en los datos; es una afirmación del modelo
  sobre el piso que ninguna regla comprueba.
- **Tests en el código fusionado: 160/160**, `tsc` OK, lint 0
  errores, build OK en base `/inmo-visitas/` (MD5 local
  `d0c7de688d7c4cabed070436b7733870`).
- **Pages NO desplegado: el push a `gh-pages` falló por falta de
  credenciales** (`could not read Username for 'https://github.com'`;
  `gh` sin sesión, sin credential helper). Hace falta el token de
  GitHub de Luis, como en los despliegues anteriores, para subirlo.
  En vivo sigue la versión anterior (MD5
  `21ac74e98b392e820870e80662cb8b4d`).

### Cierre de la Fase 6 (Claude, 2026-11-12)

- **Pages desplegado por Muse:** `gh-pages` `1ecc966` («Pages: Fase 6 +
  revisión PR #10»); MD5 del `index.html` en `gh-pages` =
  `d0c7de688d7c4cabed070436b7733870`, el mismo de la build local de Argo
  sobre `main`, y Muse lo comprobó en vivo. Claude no puede abrir la web
  desde su entorno (el proxy bloquea `github.io`), así que comprobó
  `gh-pages` contra una build propia de `main` (`e9c4cee`): los trozos
  `NoteDetail` y `Pending` son idénticos salvo los *hashes* de los
  nombres, `NoteDetail` tiene «Generar borrador» y «Escribir yo», y la
  etiqueta es «inmo-visitas · Fase 6».
- **`drafts` v4** activa y verificada por Argo (bloque anterior).
- Token de GitHub de Muse borrado tras el despliegue.
- **Fase 6 cerrada.** Quedan aplazados B-1 a B-4 y, de la verificación de
  Argo, **B-5**: el borrador puede afirmar cosas del inmueble que no están
  en los datos («buenos cerramientos…»); ninguna regla lo comprueba.
  Propuesta para la Fase 9: endurecer el `SYSTEM_PROMPT` de `drafts` y
  medirlo en el piloto.
- **Siguiente:** prompt de la Fase 7 en `docs/prompts/PROMPT-FASE-7.md`
  (exportación al CRM y WhatsApp). Se lanza solo cuando Luis lo pida.

## HANDOFF FASE 7: exportación al CRM y WhatsApp (Muse, 2026-11-12)

**Construida, sin commit, sin tag, sin push y sin desplegar a Pages.**
HEAD sigue en `f84db0e` (PR #12, cierre de la Fase 6). Sin tocar
0001–0009, `transcribe`/`extract`/`drafts`, RLS existente, guards de
`visit_notes`/`extracted_facts`/`tasks`/`drafts`, tokens de diseño,
fuentes, ruta base ni Auth. Sin dependencias nuevas de producción.
Sin claves reales. Nada se envía nunca automáticamente: «Abrir en
WhatsApp» solo abre `wa.me` con el texto (el agente pulsa Enviar en
WhatsApp) y solo con borradores aprobados; exportar al CRM solo
cuando el agente pulsa «Exportar».

**NO aplicado ni desplegado:** la migración 0010 NO está aplicada
en el proyecto real (la aplica Argo por API o Luis en el SQL
Editor, con `docs/deploy/supabase-fase-7.sql`); la función
`crm-export` NO está desplegada (la despliega Luis en el panel,
sección `crm-export` de `supabase/functions/README.md`); Pages NO
desplegado. `ESTADO.md` no se actualiza aquí (lo hace el cierre).

### Archivos creados

- `supabase/migrations/0010_exportaciones.sql` (7.325 bytes) y copia
  idéntica `docs/deploy/supabase-fase-7.sql` (`diff` verificado).
  En `crm_exports`: `kind` (`nota|borrador`, defecto `nota`),
  `draft_id uuid references drafts(id) on delete cascade`
  (obligatorio si `kind = 'borrador'`, nulo si `kind = 'nota'`),
  `audience` (`comprador|propietario`, obligatorio si
  `kind = 'borrador'`), `external_id text`, `error_message text`
  (check ≤ 300 caracteres, en español, sin datos personales),
  `updated_at timestamptz`; `visit_note_id` ahora NOT NULL;
  estados `pendiente|enviado|error|entregado` (sustituye el check
  anterior); checks de combinaciones
  (`crm_exports_kind_target_check`: `inmovilla|witei` → `kind =
  'nota'`; `whatsapp` → `nota` o `borrador`; `manual` → `nota`;
  `crm_exports_draft_check`: `draft_id`/`audience` coherentes con
  `kind`); trigger `crm_exports_guard` (insert/update/delete,
  `security invoker`, estilo `drafts_guard`); índice
  `crm_exports_visit_note_created_idx (visit_note_id, created_at
  desc)`.
- `src/features/export/summary.ts` + `summary.test.ts` (8 tests):
  `buildVisitSummary(input)` → `{ text, json }`,
  `SUMMARY_MAX_CHARS = 3000`, `json.schema = 'inmo-visitas.v1'`.
- `src/features/export/api.ts` (`loadExportContext`,
  `listNoteExports`, `recordDelivery`, `exportToCrm` — las tres
  primeras viven en `deliveries.ts` y se reexportan) y
  `src/features/export/deliveries.ts`.
- `supabase/functions/crm-export/index.ts` + `mappers.ts` +
  `mappers.test.ts` (11 tests): esquemas Zod
  (`inmovillaPayloadSchema`, `witeiPayloadSchema`),
  `mapToInmovilla`, `mapToWitei`, `signBody` (HMAC-SHA256 por Web
  Crypto; vector fijo verificado: secreto `secreto-de-prueba` +
  cuerpo `{"schema":"inmo-visitas.v1"}` →
  `71bf464257c481bf643afd8e53793ac00c6fbd98ba61e46b565e7d60dc0c4461`).
- `src/integrations/crm/crm-function.ts` (compartido por Inmovilla
  y Witei: `functions.invoke('crm-export', ...)`).

### Archivos modificados

- `src/lib/database.types.ts` (`CrmExportStatus`,
  `CrmExportKind`, `CrmExportTarget`, `CrmExportRow/Insert/Update`,
  `crm_exports` en `Database` con relaciones a `visit_notes` y
  `drafts`).
- `src/lib/db-errors.ts` + tests: `borrador_no_aprobado` →
  «Aprueba el borrador antes de enviarlo.»,
  `exportacion_no_valida` → «Esta exportación no es válida.»,
  `exportacion_cerrada` → «Esta exportación ya está cerrada; si
  quieres, vuelve a exportar.»; `translateDbError` acepta el
  contexto `{ exports: true }` para `nota_no_aprobada` → «Aprueba
  la nota antes de exportarla.» (sin contexto sigue el texto de la
  Fase 6).
- `src/lib/contact.ts` + tests: `whatsappHref(phone, text?)`
  (añade `?text=` + `encodeURIComponent`; sin texto, igual que en
  la Fase 3; teléfono no válido o vacío → `null`) y
  `whatsappShareHref(text)` (`https://wa.me/?text=…`).
- `src/integrations/crm/types.ts`: reescrito (`VisitNoteExportInput
  = { visitNoteId, summary: VisitSummary }`, `CrmExportResult = {
  ok, status?, exportId?, externalId?, simulated?, href?, error?
  }`; el comentario ya no dice que son stubs; se eliminó el
  `VisitNoteExportPayload` antiguo, que nada usaba fuera de la
  carpeta).
- `src/integrations/crm/inmovilla.ts` / `witei.ts` (adaptadores
  finos sobre `crm-function.ts`); `manual.ts` (copia
  `summary.text`; si falla el portapapeles → `ok: false` y NO se
  registra fila; si copia, inserta `manual`/`nota`/`entregado`);
  `whatsapp.ts` (registra `whatsapp`/`nota`/`entregado` y devuelve
  `whatsappShareHref(summary.text)`); `index.ts` exporta
  `VisitNoteExportInput`.
- `src/pages/NoteDetail.tsx`: «Abrir en WhatsApp» en cada tarjeta
  de borrador APROBADO (junto a «Copiar», `<a target="_blank"
  rel="noopener">`, `whatsappHref(teléfono, content)`; comprador →
  `clients.phone`, propietario → `properties.owner_phone`; al
  pulsar registra la fila `whatsapp`/`borrador`/`entregado` sin
  bloquear la apertura, aviso discreto si el registro falla; sin
  teléfono válido: botón desactivado «Falta el teléfono» + enlace
  a la ficha para añadirlo; debajo «Abierto en WhatsApp el …» con
  la última fila + nota fija «Revisa y pulsa Enviar en WhatsApp:
  la app no lo envía por ti.»; en borrador sin aprobar NO hay botón
  de WhatsApp). Sección «Exportar» solo con nota `approved`,
  debajo de «Seguimiento»: vista previa plegable de la ficha,
  botón principal según `clientConfig.crmTarget`, «Copiar ficha»
  como secundaria (registra `manual`), historial plegable
  «Exportaciones (N)», métricas del piloto «Exportada: sí/no ·
  WhatsApp abierto: comprador sí/no, propietario sí/no».
- `src/pages/Notes.tsx`: en notas aprobadas, «Exportada» o «Sin
  exportar» junto a «Seguimiento: …».
- `src/pages/Pending.tsx`: grupo «Por exportar (N)» (notas
  `approved` sin ninguna fila `enviado` ni `entregado` de `kind =
  'nota'`), último en «Notas que piden acción».
- `src/pages/Home.tsx`: «Fase 7 — Exportación al CRM y WhatsApp»;
  `src/lib/app-label.ts`: `'inmo-visitas · Fase 7'`.
- `supabase/functions/README.md`: sección `crm-export`
  (despliegue Via Editor con los dos archivos, modo simulado,
  cómo probar el modo webhook contra un receptor propio).

### Verificaciones (2026-11-12, todo en verde)

- `npm test`: **185/185** (14 archivos; 160 previos + 25 nuevos:
  `summary.test.ts` 8, `mappers.test.ts` 11, `contact.test.ts` 5,
  `db-errors.test.ts` 1).
- `npx tsc --noEmit` sin errores y `npm run build` sin errores en
  base `/` y con `VITE_BASE_PATH=/inmo-visitas/` (MD5 del
  `index.html` en base `/inmo-visitas/`:
  `f2c643807b4aa2ade1cec58310c540da`); mayor trozo JS:
  `vendor-react` 255.497 bytes (< 500 kB).
- `npm run lint`: 0 errores, 2 avisos (los de shadcn aceptados).
- **Criterio 4 VERIFICADO en local: 28/28 PASS.** PostgreSQL 16
  instalado en la VM (clúster temporal en `/tmp/pg-fase7/`, puerto
  54399; scripts en `/tmp/pg-fase7/test-0010-setup.sql` y
  `test-0010-cases.sql`, simulando los esquemas `auth` y
  `storage`): migraciones 0001–0010 aplicadas en orden sin errores
  y **0010 reaplicada limpia (idempotente)**. Los 28 casos: nota no
  aprobada → `nota_no_aprobada`; borrador en borrador / de otra
  nota / con otro audience → `borrador_no_aprobado`; `manual` y
  `whatsapp` con `pendiente` → `exportacion_no_valida`;
  `inmovilla`/`manual` con `kind = 'borrador'` y `nota` con
  `draft_id` → CHECK (23514); `error_message` > 300 → CHECK;
  `whatsapp`/`borrador` válido → `entregado` con `exported_at`;
  `pendiente → enviado` (pone `exported_at`) y `pendiente → error`
  OK; cambiar `enviado`/`error` o `visit_note_id`/`target` de una
  pendiente → `exportacion_cerrada`; borrar una fila con la nota
  viva → `exportacion_cerrada`; **borrar entera la nota 3 con sus
  exportaciones funciona (cascada RGPD)** y sus borradores también
  desaparecen. Detalle: con `inmovilla` + `borrador` + `entregado`
  el guard dispara antes que el CHECK (`exportacion_no_valida`);
  con `pendiente` es el CHECK el que falla — en ambos casos el
  inserto falla, que es lo que pide el criterio. Las pruebas del
  guard corren como superusuario: la parte RLS del criterio 7 (B
  no ve ni inserta exportaciones de A) queda para el proyecto real
  (las políticas son las de la 0004, sin tocar).
- `deno check` de `crm-export`: **sin Deno en la VM** (`which
  deno` → no encontrado); lo hace Claude en la revisión, como en
  las Fases 5 y 6.
- Incidencias durante la construcción (arregladas, no pendientes):
  un `muse.edit` quitó `setApprovingDraft(true)` de
  `handleApproveDraft` en `NoteDetail.tsx`; restaurado y verificado
  por `git diff`. `tsc --noEmit` pasaba pero `npm run build`
  (`tsc -b`) falló por `FactCategory` importado de
  `../extraction/labels` (no se reexporta ahí); se importa de
  `../../lib/database.types` en `summary.ts`. Lección repetida: el
  build es más estricto que `tsc --noEmit`; hay que correr siempre
  el build.

### LO QUE SALE DE LA APP (copiado del código, con la nota de ejemplo)

Datos vivos leídos del proyecto real el 2026-11-12 ~22:40 (nota
`e0782f7c-8409-4e23-a2b0-5972521fed0a`, aprobada el 2026-11-12
13:32; cliente Ana García, +34612345678, ana.garcia@gmail.com, no
provisional; inmueble V-18, Calle de Alcalá 120, Madrid;
propietario Carlos Ruiz, +34 611 100 200; agente Agente A Prueba;
6 datos no descartados — objeción ruido, cita «Confirma viernes a
las 17h» (editada por Luis), presupuesto 230.000 euros, acompañante
«Su pareja», petición gastos/IBI, observación «Pide informe del
administrador de cuotas al dia de pago» (añadida por Luis) — y 1
tarea `pendiente`: «Enviar información sobre los gastos de
comunidad e IBI de V-18 (sin fecha)»; las 2 tareas `propuesta` NO
van a la ficha). La ficha y los dos payloads se generaron con el
código real (`buildVisitSummary` + `mappers.ts`) con esos datos.

**Lo que NO sale nunca:** transcripción, texto de la nota, audio
(ni su ruta), citas literales (`evidence_quote`), datos
descartados ni borradores. Al propietario solo le llega su
borrador aprobado por WhatsApp, nunca la ficha.

#### WhatsApp al comprador (Ana García, +34612345678)

⚠️ **El borrador del comprador sigue en «borrador»** (es el v4,
regenerado tras la revisión PR #10): el botón «Abrir en WhatsApp»
**no aparece** hasta que Luis lo apruebe (el propio criterio 1
del prompt dice «aprueba antes el borrador del comprador»). Cuando
se apruebe, el enlace será
`https://wa.me/34612345678?text=<el texto, con
encodeURIComponent>` y el texto será este (leído de la BD):

> Hola Ana, ha sido un placer enseñarte V-18 (Calle de Alcalá
> 120) junto a tu pareja. Respecto al ruido de la calle Alcalá por
> la noche, ten en cuenta que el piso cuenta con buenos
> cerramientos para mitigar el sonido exterior. Para avanzar, sobre
> la próxima visita pendiente, ¿me confirmas si te va bien el
> viernes a las 17h o prefieres matizar la hora? Además, te
> adjunto la información sobre los gastos de comunidad, el IBI y
> el informe del administrador sobre las cuotas al día de pago que
> solicitaste. Un abrazo, Agente A Prueba

Observación no bloqueante (B-5 de la revisión de la Fase 6, sigue
vigente): «buenos cerramientos para mitigar el sonido exterior»
no está en los datos y ninguna regla lo comprueba.

#### WhatsApp al propietario (Carlos Ruiz, +34 611 100 200)

Borrador **aprobado** por Luis en la prueba del móvil de la Fase 6:
el botón «Abrir en WhatsApp» sí aparece. Enlace:
`https://wa.me/34611100200?text=<el texto, con
encodeURIComponent>`. Texto (leído de la BD):

> Hola Carlos,
>
> Le escribo tras la visita a V-18 (Calle de Alcalá 120)
> realizada con la persona interesada y su pareja. Durante el
> recorrido, mostraron interés y han solicitado los gastos de
> comunidad, el IBI y el informe del administrador sobre las cuotas
> al día de pago. Además, comentaron la percepción de ruido de la
> calle Alcalá por la noche.
>
> Respecto a los siguientes pasos, me indicó que le venía bien
> confirmar viernes a las 17h, por lo que quedo a la espera de su
> confirmación para agendarlo.
>
> Agente A Prueba

Sin presupuesto, sin nombre de la clienta, cita sin confirmar.

#### Ficha — texto (`buildVisitSummary`, 11 nov 2026, 17:22 hora de Madrid)

```text
Visita V-18 · Calle de Alcalá 120, Madrid
11 nov 2026, 17:22 · Agente: Agente A Prueba
Cliente: Ana García · 612 34 56 78 · ana.garcia@gmail.com
Hechos declarados:
- Acompanante visita: Su pareja
- Peticion informacion: Gastos de comunidad e IBI
Observaciones:
- Peticion informacion: Pide informe del administrador de cuotas al dia de pago
Objeciones:
- Ruido calle: Ruido de la calle Alcalá por la noche
Presupuesto declarado:
- Presupuesto declarado (declarado): 230.000 euros
Citas pendientes (sin confirmar):
- Proxima visita: Confirma viernes a las 17h
Tareas:
- Enviar información sobre los gastos de comunidad e IBI de V-18 (sin fecha)
```

#### Ficha — JSON (`schema: 'inmo-visitas.v1'`)

```json
{
  "schema": "inmo-visitas.v1",
  "visit_note_id": "e0782f7c-8409-4e23-a2b0-5972521fed0a",
  "reference": "V-18",
  "address": "Calle de Alcalá 120",
  "city": "Madrid",
  "visited_at": "2026-11-11T16:22:19.062248Z",
  "approved_at": "2026-11-12T13:32:22.100323Z",
  "agent": "Agente A Prueba",
  "client": {
    "name": "Ana García",
    "phone": "+34612345678",
    "email": "ana.garcia@gmail.com",
    "provisional": false
  },
  "groups": [
    {
      "category": "hecho_declarado",
      "title": "Hechos declarados",
      "facts": [
        { "category": "hecho_declarado", "field": "acompanante_visita", "label": "Acompanante visita", "value": "Su pareja" },
        { "category": "hecho_declarado", "field": "peticion_informacion", "label": "Peticion informacion", "value": "Gastos de comunidad e IBI" }
      ]
    },
    {
      "category": "observacion",
      "title": "Observaciones",
      "facts": [
        { "category": "observacion", "field": "peticion_informacion", "label": "Peticion informacion", "value": "Pide informe del administrador de cuotas al dia de pago" }
      ]
    },
    {
      "category": "objecion",
      "title": "Objeciones",
      "facts": [
        { "category": "objecion", "field": "ruido_calle", "label": "Ruido calle", "value": "Ruido de la calle Alcalá por la noche" }
      ]
    },
    {
      "category": "presupuesto",
      "title": "Presupuesto declarado",
      "facts": [
        { "category": "presupuesto", "field": "presupuesto_declarado", "label": "Presupuesto declarado", "value": "230.000 euros" }
      ]
    },
    {
      "category": "cita_pendiente",
      "title": "Citas pendientes (sin confirmar)",
      "facts": [
        { "category": "cita_pendiente", "field": "proxima_visita", "label": "Proxima visita", "value": "Confirma viernes a las 17h" }
      ]
    }
  ],
  "tasks": [
    { "description": "Enviar información sobre los gastos de comunidad e IBI de V-18", "due_date": null }
  ]
}
```

#### Payload de Inmovilla (`mapToInmovilla`, formato propio «inmo-visitas v1», NO la API real de Inmovilla)

```json
{
  "schema": "inmo-visitas.v1",
  "referencia": "V-18",
  "cliente": { "nombre": "Ana García", "telefono": "+34612345678", "email": "ana.garcia@gmail.com" },
  "visita": { "fecha": "2026-11-11T16:22:19.062248Z", "agente": "Agente A Prueba" },
  "comentarios": "Visita V-18 · Calle de Alcalá 120, Madrid\n11 nov 2026, 17:22 · Agente: Agente A Prueba\nCliente: Ana García · 612 34 56 78 · ana.garcia@gmail.com\nHechos declarados:\n- Acompanante visita: Su pareja\n- Peticion informacion: Gastos de comunidad e IBI\nObservaciones:\n- Peticion informacion: Pide informe del administrador de cuotas al dia de pago\nObjeciones:\n- Ruido calle: Ruido de la calle Alcalá por la noche\nPresupuesto declarado:\n- Presupuesto declarado (declarado): 230.000 euros\nCitas pendientes (sin confirmar):\n- Proxima visita: Confirma viernes a las 17h\nTareas:\n- Enviar información sobre los gastos de comunidad e IBI de V-18 (sin fecha)",
  "datos": [
    { "category": "hecho_declarado", "field": "acompanante_visita", "label": "Acompanante visita", "value": "Su pareja" },
    { "category": "hecho_declarado", "field": "peticion_informacion", "label": "Peticion informacion", "value": "Gastos de comunidad e IBI" },
    { "category": "observacion", "field": "peticion_informacion", "label": "Peticion informacion", "value": "Pide informe del administrador de cuotas al dia de pago" },
    { "category": "objecion", "field": "ruido_calle", "label": "Ruido calle", "value": "Ruido de la calle Alcalá por la noche" },
    { "category": "presupuesto", "field": "presupuesto_declarado", "label": "Presupuesto declarado (declarado)", "value": "230.000 euros" },
    { "category": "cita_pendiente", "field": "proxima_visita", "label": "Proxima visita", "value": "Confirma viernes a las 17h" }
  ],
  "tareas": [
    { "description": "Enviar información sobre los gastos de comunidad e IBI de V-18", "due_date": null }
  ]
}
```

#### Payload de Witei (`mapToWitei`, formato propio «inmo-visitas v1», NO la API real de Witei)

```json
{
  "schema": "inmo-visitas.v1",
  "property_reference": "V-18",
  "contact": { "name": "Ana García", "phone": "+34612345678", "email": "ana.garcia@gmail.com" },
  "visit": { "date": "2026-11-11T16:22:19.062248Z", "agent": "Agente A Prueba" },
  "notes": "Visita V-18 · Calle de Alcalá 120, Madrid\n11 nov 2026, 17:22 · Agente: Agente A Prueba\nCliente: Ana García · 612 34 56 78 · ana.garcia@gmail.com\nHechos declarados:\n- Acompanante visita: Su pareja\n- Peticion informacion: Gastos de comunidad e IBI\nObservaciones:\n- Peticion informacion: Pide informe del administrador de cuotas al dia de pago\nObjeciones:\n- Ruido calle: Ruido de la calle Alcalá por la noche\nPresupuesto declarado:\n- Presupuesto declarado (declarado): 230.000 euros\nCitas pendientes (sin confirmar):\n- Proxima visita: Confirma viernes a las 17h\nTareas:\n- Enviar información sobre los gastos de comunidad e IBI de V-18 (sin fecha)",
  "facts": [
    { "category": "hecho_declarado", "field": "acompanante_visita", "label": "Acompanante visita", "value": "Su pareja" },
    { "category": "hecho_declarado", "field": "peticion_informacion", "label": "Peticion informacion", "value": "Gastos de comunidad e IBI" },
    { "category": "observacion", "field": "peticion_informacion", "label": "Peticion informacion", "value": "Pide informe del administrador de cuotas al dia de pago" },
    { "category": "objecion", "field": "ruido_calle", "label": "Ruido calle", "value": "Ruido de la calle Alcalá por la noche" },
    { "category": "presupuesto", "field": "presupuesto_declarado", "label": "Presupuesto declarado (declarado)", "value": "230.000 euros" },
    { "category": "cita_pendiente", "field": "proxima_visita", "label": "Proxima visita", "value": "Confirma viernes a las 17h" }
  ],
  "tasks": [
    { "description": "Enviar información sobre los gastos de comunidad e IBI de V-18", "due_date": null }
  ]
}
```

(En los dos payloads, `datos`/`facts` van en el mismo orden de
categorías que los grupos de la ficha (hecho, observación,
objeción, presupuesto, cita); la única diferencia es que la ficha
JSON anida los datos dentro de cada grupo y los payloads los
aplanan en una lista. El contenido es el mismo.)

### Supuestos / decisiones de interpretación (no están en el prompt)

1. `nota_no_aprobada`: el texto de la Fase 6 («Aprueba la nota
   antes de preparar el seguimiento») no encaja en exportaciones;
   `translateDbError` toma un contexto nuevo `{ exports: true }`
   que devuelve «Aprueba la nota antes de exportarla»; sin contexto
   el texto y el test de la Fase 6 no cambian.
2. La línea de cliente de la ficha lleva el teléfono REAL
   formateado (`612 34 56 78`) y el email real: el `+34 6xx xxx xxx`
   / `<email>` del prompt se leen como marcadores de un documento
   de especificación (la ficha se copia al CRM o a WhatsApp; con
   los datos enmascarados no serviría).
3. El orden de los grupos de la ficha es el de la enumeración del
   prompt (hecho_declarado, observacion, objecion, presupuesto,
   cita_pendiente, desconocido), NO el `CATEGORY_ORDER` de
   `labels.ts` (orden de «Revisar»); de `labels.ts` solo vienen los
   NOMBRES de los grupos.
4. El texto de la ficha no tiene líneas en blanco (igual que el
   bloque de ejemplo del prompt); el marcador «…» del recorte va en
   su propia línea cuando se recortan tareas.
5. `fieldLabel` es mecánico (sin tildes ni artículos): p. ej.
   `ruido_calle` → «Ruido calle», `informacion_solicitada` →
   «Informacion solicitada» — las mismas etiquetas que en
   «Revisar», como pide el prompt.
6. En los payloads del CRM, la etiqueta del dato de presupuesto
   lleva ` (declarado)` («Presupuesto declarado (declarado)»); en
   el texto de la ficha lo lleva la línea, por categoría. La
   redundancia viene del nombre del campo (`presupuesto_declarado`)
   y no se ha «arreglado» en la Fase 7: cambiar la etiqueta sería
   tocar «Revisar». Si molesta, es un pulido para la Fase 9.
7. `recordDelivery` / `listNoteExports` viven en
   `src/features/export/deliveries.ts` (reexportadas desde
   `api.ts`) para evitar un import circular (`api.ts` importa
   `src/integrations/crm/` y los adaptadores `manual`/`whatsapp`
   importan la función de registro).
8. Adaptador `manual`: si el portapapeles falla → `ok: false` y
   NO se registra fila (la ficha no llegó al agente; la UI muestra
   el texto para copiarlo a mano). Adaptador `whatsapp`: registra
   primero y luego devuelve el `href`; `CrmExportResult` ganó el
   campo opcional `href` (no estaba en la forma del prompt) para
   que la UI pueda abrirlo.
9. La secundaria «Copiar ficha» NO se muestra cuando el destino
   principal es `manual` (duplicaría el botón principal).
10. `mappers.ts` duplica lo mínimo de `buildVisitSummary` (la
    función no puede importar de `src/`); un test comprueba que su
    texto + JSON son idénticos a los del frontend con la misma
    entrada, así que una deriva se detecta.
11. `exportToCrm(noteId, target)` vuelve a cargar el contexto de
    exportación aunque la UI ya tenga la ficha (firma exacta del
    prompt; lecturas en paralelo, coste aceptado).
12. El guard dispara antes que los CHECK en algunos insertos
    (p. ej. `inmovilla` + `borrador` + `entregado` →
    `exportacion_no_valida` en vez de 23514): el inserto falla
    igual; el orden entre guard y CHECK no cambia el
    comportamiento.

### Pendientes / cómo probarlo

- **Criterios 5, 6 y 7 (función en simulado/webhook y negativos
  RLS): sin probar** — la función no está desplegada y la 0010 no
  está aplicada en el proyecto real. Pasos: (1) aplicar
  `docs/deploy/supabase-fase-7.sql` en el SQL Editor (o Argo por
  API); (2) desplegar `crm-export` por Luis en el panel (dos
  archivos, sección en `supabase/functions/README.md`); (3) criterio
  5: curl con el JWT del agente A a una nota aprobada → 200,
  `enviado`, `external_id: 'SIM-…'`, `simulated: true`; segunda
  llamada → misma fila con `already_exported: true`; nota no
  aprobada → 409 «Aprueba la nota antes de exportarla.»;
  (4) criterio 6: poner `CRM_WEBHOOK_URL` a un receptor propio
  que devuelva 500 (o apagarlo) → fila `error`, 502 en español,
  sin datos en el mensaje, y «Reintentar» crea una fila nueva;
  (5) criterio 7: `crm-export` con el JWT de B sobre una nota de A
  → 404; B no ve ni inserta `crm_exports` de A (ni con `kind =
  'borrador'` sobre un borrador de A); sin JWT → 401.
- **Criterio 1 (navegador + móvil de Luis): sin probar.** Pasos
  con la nota de ejemplo (Ana + V-18, única aprobada): (a) aprobar
  antes el borrador del comprador (sigue en «borrador»); (b) en
  `/notas/:id`, «Abrir en WhatsApp» en el borrador del comprador
  (Ana, +34612345678) y en el del propietario (Carlos, +34 611 100
  200): se abre WhatsApp con el texto; **revisar y pulsar Enviar
  en WhatsApp** — la app no envía nada por sí sola; (c) «Vista
  previa de la ficha» y «Copiar ficha»; (d) «Exportar a Inmovilla»
  en modo simulado (con `VITE_CLIENT_CRM_TARGET=inmovilla` en una
  build local, o el destino que toque): etiqueta «Simulado» y
  estado «Exportada … (ID SIM-…)»; (e) comprobar que /pendientes
  pierde «Por exportar» y /notas muestra «Exportada».
- **Navegador a 360 px, sin desbordamiento ni errores de consola,
  en local y en Pages: sin probar** (esta sesión no tiene navegador
  en vivo). Pendiente para Luis con los pasos de arriba; tras cada
  despliegue en Pages, cerrar la pestaña del todo y reabrir (caché
  de la PWA).
- **`deno check` de `crm-export`:** sin Deno en la VM; lo hace
  Claude en la revisión.
- **Después, revisión de Claude** (pasarle este HANDOFF) y cierre
  de la Fase 7. Aplazados a la Fase 9 (sin tocar): reintento de
  subida tras fallo parcial, URL firmada que se repide tras
  transcribir, B-1 a B-4 de la revisión de la Fase 6 (y B-5: el
  borrador puede afirmar cosas del inmueble que no están en los
  datos — «buenos cerramientos…» —, ninguna regla lo comprueba).

### Verificación por Argo en el proyecto real (2026-11-12)

- **Build revisado de forma independiente: `npm test` 185/185,
  `tsc --noEmit` OK, build OK en base `/` y `/inmo-visitas/`,
  lint 0 errores + 2 avisos (shadcn).** Coincide con el informe
  del constructor. Migración 0010 y copia de despliegue idénticas
  (`diff` verificado).
- **Migración 0010 APLICADA por Argo por la Management API**
  (`docs/deploy/supabase-fase-7.sql`, 7.291 bytes). Verificado en
  la base: columnas nuevas (`kind`, `draft_id`, `audience`,
  `external_id`, `error_message`, `updated_at`), `visit_note_id`
  NOT NULL, checks (`kind`, `draft`, `kind_target`, `status` con
  los 4 estados, `error_message`), trigger `crm_exports_guard` e
  índice `(visit_note_id, created_at desc)`. La tabla estaba vacía
  (0 filas).
- **Criterio 4 VERIFICADO por API en el proyecto real: 14/14
  efectivo.** Con nota de sacrificio (cliente provisional +
  V-99/V-98, texto, `extract`, datos aceptados, aprobada) y la
  nota de ejemplo: nota no aprobada → `nota_no_aprobada`;
  borrador sin aprobar / con otro audience / de otra nota →
  `borrador_no_aprobado`; `manual` con `pendiente` →
  `exportacion_no_valida`; `inmovilla` con `kind = 'borrador'` →
  CHECK; `whatsapp`/`nota` nace `entregado` con `exported_at`;
  `inmovilla`/`nota` nace `pendiente`; `pendiente → enviado` (pone
  `exported_at` y acepta `external_id`); `pendiente → error`
  (guarda `error_message`); cambiar o borrar una fila cerrada →
  `exportacion_cerrada`; **borrar entera la nota con exportaciones
  funciona (cascada RGPD, 0 filas restantes)**. Notas de
  sacrificio, clientes e inmuebles de prueba eliminados; la nota
  de ejemplo queda intacta (sin filas de exportación) para la
  prueba de Luis en el navegador.
  - **Incidencia del primer intento (no es un defecto del
    producto):** el caso 11 (`pendiente → enviado`) falló al
    principio con `exportacion_cerrada`. Causa: la API de
    Supabase está hoy muy inestable (varios
    `RemoteDisconnected`/`IncompleteRead` en la misma sesión) y
    el script reintentó el PATCH a ciegas; el primer intento ya
    había aplicado el cambio y el reintento chocó con el guard de
    fila cerrada. Repetido con un solo intento y comprobación del
    estado por GET: **200, `enviado` + `exported_at`**. Lección:
    no reintentar a ciegas un PATCH que el guard hace no
    idempotente; comprobar el estado con GET.
- **Pendiente:** desplegar `crm-export` (Luis, Via Editor con
  `index.ts` + `mappers.ts`, verificación de JWT activada) y
  aprobar el borrador del comprador (sigue en «borrador»: su
  botón de WhatsApp no aparece hasta aprobarlo). Después: Argo
  verifica los criterios 5, 6 y 7 por API (simulado, webhook con
  receptor que falle, negativos con el JWT de B — hace falta su
  contraseña — y sin JWT), el navegador a 360 px, commit + tag
  `v0.7-fase-7` + push + Pages.

### Borrador del comprador aprobado (Argo, 2026-11-12 ~22:58)

- Luis pidió que Argo lo hiciera directamente: aprobado por API
  como agente A (PATCH `drafts` → `aprobado`, `approved_at`
  2026-11-12T21:58:29Z). El PATCH devolvió 400
  `borrador_aprobado` por el mismo artefacto de reintento de la
  API inestable (el primer intento ya lo había aprobado); el GET
  posterior confirma los dos borradores en `aprobado`. Ya aparece
  el botón «Abrir en WhatsApp» del comprador.
- **Pendiente para desplegar `crm-export`:** el código de la Fase 7
  aún NO está en `main` (sin commit), así que Luis no puede copiar
  los archivos desde GitHub. Orden: token → commit + tag + push
  de Argo → despliegue Via Editor desde `main` (pasos en
  `supabase/functions/README.md`).

### Verificación de `crm-export` por Argo (2026-11-12)

- **`crm-export` v1 ACTIVA** (desplegada por Luis, Via Editor
  con `index.ts` + `mappers.ts` desde `main`).
- **Criterio 5 VERIFICADO (simulado):** con nota de sacrificio
  aprobada: Inmovilla → 200 `enviado`, `external_id: 'SIM-…'`,
  `simulated: true`, `already_exported: false`; segunda llamada →
  misma fila con `already_exported: true`; Witei en simulado → 200
  `enviado`; nota no aprobada → **409
  `{"error":"Aprueba la nota antes de exportarla."}`**. Payload
  inspeccionado entero: sin transcripción, citas, audio ni datos
  descartados; presupuesto como «Presupuesto declarado
  (declarado): 150.000 euros»; cliente provisional marcado
  «(provisional)».
- **Criterio 6 VERIFICADO (webhook con receptor que falla):** con
  `CRM_WEBHOOK_URL = http://127.0.0.1:9/inmo-test` (puesto y
  borrado por Argo por la Management API; 201 al crear, 200 al
  borrar): Witei → **502 `{"error":"El CRM no respondió"}`**,
  fila `error` con ese mensaje genérico; segunda llamada → 502
  de nuevo y **fila nueva** (2 filas `error` con distinto id).
  Sin datos personales en el mensaje.
- **Criterio 7 VERIFICADO (negativos):** `crm-export` con el JWT
  de B sobre una nota de A → 404 `{"error":"No encontrado"}`; sin
  JWT → 401; B no ve (`[]`) ni inserta (`nota_no_aprobada` por
  RLS) exportaciones de A.
- **Incidencia de los primeros intentos (no es un defecto del
  producto):** 4 comprobaciones salieron como «FAIL» en la primera
  pasada porque el cuerpo de la respuesta llegaba ilegible por la
  API inestable de hoy (`unreadable`); los códigos de estado eran
  los correctos. Repetidas leyendo el cuerpo crudo: 409, 502 y
  payload, todo en verde. La nota de ejemplo sigue intacta (0
  exportaciones) para la prueba de Luis en el navegador.
- **Pendiente:** navegador a 360 px (criterios 1, 8 y 10) y
  despliegue en Pages (falta el token).

### Comprobación en Pages sin sesión (Argo, 2026-11-12)

- Navegador en la nube sobre Pages (`fa794b3`): etiqueta
  «inmo-visitas · Fase 7» en vivo. La primera carga mostró la
  versión vieja («Fase 6») por la caché de la PWA; cerrando la
  pestaña del todo y reabriendo salió la Fase 7 (y se mantuvo al
  recargar).
- `/notas` y `/pendientes` sin sesión redirigen a `/login`
  (correcto). Sin errores de consola ni cargas fallidas, sin
  desbordamiento a ancho de escritorio (1919 px).
- **Sin verificar:** el ancho exacto de 360 px (el navegador en la
  nube no permite fijarlo) y el texto de la portada con sesión
  (la raíz redirige a `/login` sin sesión). Queda para la prueba
  de Luis en el móvil.

### Comprobación con sesión vía extensión de Chrome (Argo, 2026-11-13)

- Luis instaló la extensión de Muse para Chrome; Argo ve su
  Chrome y la pestaña de la app.
- Sesión iniciada como Agente A Prueba en la portada: etiqueta
  «inmo-visitas · Fase 7», pie «Fase 7 — Exportación al CRM y
  WhatsApp.», navegación con «Pendientes (1)».
- Pendiente: criterios 1, 8 y 10 con sesión (Seguimiento /
  WhatsApp / Exportar / Por exportar), en el Chrome de Luis o
  en su móvil a 360 px.

### Prueba en navegador con sesión (Argo, en el Chrome de Luis, 2026-11-13)

Criterios 1, 8 y 10 — TODO CORRECTO, con 3 matices:

- PASO 1: /pendientes mostraba «Por exportar (1)» con Ana García
  V-18 · Aprobada · 11 nov 2026 (antes de exportar).
- PASO 2: en la nota, los dos borradores aprobados muestran
  «Copiar» y «Abrir en WhatsApp». El enlace del comprador es
  wa.me/34612345678 con el borrador completo como texto; el del
  propietario es wa.me/34611100200 con su borrador, SIN «Ana»,
  SIN «230.000», SIN «presupuesto» y sin ficha. Tras cada
  apertura: «Abierto en WhatsApp el 13 nov 2026, 9:56» en ambas
  tarjetas. Sin pulsar Enviar.
- PASO 3: vista previa de la ficha correcta (grupos, presupuesto,
  cita, tarea pendiente; sin transcripción, citas, audio ni
  descartados). «Copiar ficha» → «Ficha copiada». Historial
  «Exportaciones (3)»: Manual · Ficha 9:57 + WhatsApp comprador
  9:56 + WhatsApp propietario 9:56. Métricas: «Exportada: sí ·
  WhatsApp abierto: comprador sí, propietario sí».
- PASO 4: «Por exportar» desaparece de /pendientes y /notas
  muestra «Seguimiento: preparado · Exportada».

MATICES:
1. Ancho 360 px NO probado: el navegador no permite fijar el
   ancho de ventana; la prueba se hizo a 1041 px, sin
   desbordamiento horizontal.
2. wa.me BLOQUEADO en el Chrome de Luis por una extensión
   (ERR_BLOCKED_BY_CLIENT): el clic registró la apertura en la
   app pero no abrió la pantalla de chat de WhatsApp; número y
   texto se verificaron en la propia URL wa.me del botón, no en
   la pantalla de WhatsApp. En el móvil debería abrir bien.
3. La ficha sigue diciendo «Presupuesto declarado (declarado):
   230.000 euros» (redundancia conocida, pulido Fase 9).
4. La métrica «Exportada» tardó una vista en pasar a «sí» tras
   copiar la ficha (estado final correcto).

## Revisión de la Fase 7 (Claude, 2026-11-13)

**Resultado: OK con ajustes.** Revisado `f84db0e..76f9ece` (código de
`733df3a`, etiqueta `v0.7-fase-7`) contra `PROMPT-FASE-7.md` y este
HANDOFF. El commit de docs `59b54a4` de Argo no estaba en `origin`
cuando se hizo la revisión.

**Lo que funciona (comprobado por Claude):**

| Comprobación | Resultado |
|---|---|
| `npm ci`, `tsc --noEmit`, `npm run build` (`/` y `/inmo-visitas/`), lint | OK; lint 0 errores + 2 avisos de shadcn; trozo mayor 255.497 B |
| `npm test` | 185/185 → **187/187** con los tests de este PR |
| `deno check` de `crm-export` (y de `drafts`) | OK (Deno 2.9.6) |
| 0001–0010 en PostgreSQL 16 con `auth`/`storage` simulados; 0010 reaplicada | OK, idempotente; `0010` = `docs/deploy/supabase-fase-7.sql` |
| Guard de `crm_exports` y RLS como agentes A y B, y como `anon` | 14/14: borrador sin aprobar → `borrador_no_aprobado`; nota sin aprobar → `nota_no_aprobada`; borrar una fila → `exportacion_cerrada`; B no ve ni cambia filas de A y su insert falla (`nota_no_aprobada`, porque RLS le oculta la nota); `anon` no ve nada; borrar la nota entera borra sus exportaciones (cascada RGPD) |
| `crm-export` | Solo clave anon + JWT; 404/409/401 como pide el prompt; simulado sin red; `Idempotency-Key`, HMAC, 15 s y un reintento; sin *payload* ni respuesta del CRM en logs ni errores |
| Minimización | Ni la ficha ni los dos formatos llevan transcripción, texto de la nota, audio, citas, datos descartados ni borradores; al propietario solo va su borrador |
| Navegador (Chromium a **360 px**, Supabase simulado, build de `main` + este PR) | 16/16: «Por exportar (1)» en `/pendientes`; dos «Abrir en WhatsApp» (comprador `wa.me/34612345678`, borrador entero con `&` y `?` bien codificados; propietario `wa.me/34611100200`, sin Ana, presupuesto ni ficha); «Abierto en WhatsApp el …» y fila registrada; vista previa y portapapeles con la ficha; tras «Copiar ficha», `/pendientes` sin «Por exportar» y `/notas` con «Exportada»; sin desbordamiento en `/pendientes`, `/notas/:id` y `/notas`; sin errores de consola. Cubre el «360 px» que no se pudo probar en el Chrome de Luis |

**Ajustes de este PR:**

- **M-1 · Migración 0011** (`0011_ajustes_revision_fase_7.sql`, copia en
  `docs/deploy/supabase-fase-7-ajustes.sql`): en el insert, el guard
  fija `external_id` y `error_message` a nulo, `exported_at` a nulo (o
  `now()` si nace `entregado`) y `created_at := now()`. Antes, una
  llamada directa a la API podía crear una fila con un ID externo o una
  fecha de exportación inventados. Probado en PostgreSQL (14/14 + 2
  casos nuevos) y reaplicado sin errores.
- **M-2 · «Presupuesto declarado (declarado)»:** `budgetLabel` en
  `summary.ts` y en `mappers.ts` solo añade «(declarado)» si la etiqueta
  no lo dice ya. Los tests usaban el campo `presupuesto` y no el real
  (`presupuesto_declarado`), por eso no lo vieron; hay 2 tests nuevos con
  el campo real. Cambia la ficha y el *payload* de los dos CRM, así que
  **hay que redesplegar `crm-export`**.
- **M-3 · «Exportada» que tardaba una vista:** «Copiar ficha» (y
  compartir por WhatsApp) solo actualizaba la pantalla al recargar el
  historial, y si esa recarga fallaba se quedaba en «no». Ahora los
  adaptadores `manual` y `whatsapp` devuelven la fila (`row` en
  `CrmExportResult`) y `NoteDetail` la muestra al momento. Comprobado en
  el navegador con la recarga caída: sin el ajuste falla y con él pasa.

**Aplazados (baja; Fase 8 o pulido):**

- B-6 (Fase 8): un agente puede pasar su propia fila de `pendiente` a
  `enviado` con un PATCH directo, porque `crm-export` usa su JWT. Solo
  afecta a sus métricas. Arreglo: una función `security definer` o un
  rol de servidor para cerrar la exportación.
- B-7: si `crm-export` se corta entre el insert y el cierre, la fila se
  queda en `pendiente` («En curso») para siempre. Reintentar funciona
  (fila nueva). Valorar marcar como `error` las `pendiente` antiguas.
- B-8: con `VITE_CLIENT_CRM_TARGET=whatsapp`, la ficha se abre con
  `window.open` después de un `await`, y Safari en iOS puede
  bloquearlo; queda el enlace de respaldo en pantalla.
- B-9 (Fase 8): CORS de las cuatro funciones con `luisetic.github.io`
  escrito en el código; habrá que sacarlo a configuración al pasar a
  Coolify. `external_id` del CRM sin límite de longitud.
- Siguen aplazados B-1 a B-5 de la Fase 6.

**Pendiente para cerrar la Fase 7 (tras fusionar este PR):**

1. **Argo** (o Luis en el SQL Editor): aplicar
   `docs/deploy/supabase-fase-7-ajustes.sql` y comprobar que
   `crm_exports_guard` contiene `new.created_at := now()`.
2. **Luis:** redesplegar `crm-export` (v2) pegando `index.ts` y
   `mappers.ts` desde `main`. Comprobar en el editor que `mappers.ts`
   tiene `budgetLabel`.
3. **Argo:** una exportación simulada por API con una nota de
   sacrificio: la etiqueta debe ser «Presupuesto declarado» y el
   `external_id` debe ser `SIM-…`.
4. **Muse:** desplegar Pages.
5. Después, Claude cierra la Fase 7 y escribe el prompt de la Fase 8,
   solo cuando Luis lo pida.

### Pasos de cierre tras la revisión (Claude, 2026-11-13)

Luis fusionó el PR #13 (`7f9c71d`) y pidió a Claude los pasos
siguientes. Hechos con el conector de Supabase (proyecto
`inmo-visitas-pruebas`, UE) y Git:

1. **0011 aplicada** como SQL directo (igual que 0001–0010; no hay
   historial de migraciones en Supabase). Comprobado:
   `crm_exports_guard` contiene `new.created_at := now()`.
2. **0011 verificada en el proyecto real**, sin dejar datos: insert como
   Agente A (`role authenticated` + `request.jwt.claims`) de una fila
   `witei`/`pendiente` con `external_id = 'FALSO-123'`,
   `error_message`, `exported_at` y `created_at` inventados, dentro de
   un bloque que se deshace al final. Resultado: `external_id`,
   `error_message` y `exported_at` en nulo, `created_at` con la hora
   del momento y estado `pendiente`. Las exportaciones siguen en 3 (las
   de la prueba de Luis).
3. **`crm-export` no hacía falta redesplegarlo:** la versión activa (6,
   `verify_jwt` activado) ya tiene en `mappers.ts` las tres apariciones
   de `budgetLabel`, igual que `main`.
4. **Etiqueta del presupuesto con los datos reales** de la nota de
   ejemplo (los 6 datos no descartados) pasados por el `mappers.ts` de
   `main`: Inmovilla y Witei pasan su esquema, la etiqueta es
   «Presupuesto declarado», la línea de la ficha es «- Presupuesto
   declarado: 230.000 euros» y no aparece «declarado (declarado)». No
   se ha llamado a la función en vivo porque Claude no tiene la sesión
   de un agente; la llamada simulada ya la verificó Argo (criterio 5).
5. **Pages desplegado:** `gh-pages` `7ac0529` (encima de `fa794b3`, sin
   forzar), con el código de `main` `7f9c71d` y la misma configuración
   que la build anterior. Esa configuración se comprobó reconstruyendo
   `59b54a4` hasta obtener el MD5 en vivo anterior
   (`f2c643807b4aa2ade1cec58310c540da`) y los mismos archivos: clave
   *publishable*, `VITE_CLIENT_CRM_TARGET=manual`, nombre «Inmo
   Visitas». MD5 del `index.html` nuevo:
   `96d5181573ca0769a1398dd1ece37e94`. Claude no puede abrir
   `github.io` desde su entorno: el despliegue se siguió en GitHub
   Actions («pages build and deployment»).

**Pendiente solo de Luis:** la prueba rápida en el móvil. Cerrar la PWA
del todo y reabrirla; en la nota de Ana, Exportar → «Vista previa de la
ficha» debe decir «Presupuesto declarado: 230.000 euros»; «Copiar
ficha» → «Exportada: sí» al momento. Con eso, la Fase 7 queda cerrada.

**Prueba de Luis en el móvil (2026-11-13, 10:47):** en la nota aprobada
de Ana (`e0782f7c…`, 11/11 17:22), «Vista previa de la ficha» muestra
«Presupuesto declarado» y «Copiar ficha» muestra «Ficha copiada»; la
base registra la fila `manual`/`nota`/`entregado` a las 10:47:52. El
paso de «Exportada: no» a «sí» no se pudo ver porque esa nota ya estaba
exportada (copia de las 9:57); queda cubierto por la prueba de la
revisión (navegador simulado con la recarga caída). Observación: Ana
tiene 8 notas con V-18 y solo una aprobada; las otras siete son de
prueba y se limpiarán antes del piloto. **Fase 7 cerrada.**

---

## HANDOFF FASE 8 — Seguridad, borrado y RGPD (2026-11-13, sin commit, tag ni push: lo hace Argo tras verificar)

### Hecho

- **Migración 0012** (`supabase/migrations/0012_seguridad_rgpd.sql`) + copia
  idéntica en `docs/deploy/supabase-fase-8.sql` (verificado byte a byte con
  `cmp`). **No se ha aplicado al proyecto real** (ref `gwsgtwkrotlljybnkpxg`):
  se probó en un clúster PostgreSQL 16 temporal local (`/tmp/pg-fase8`,
  con esquemas `auth`/`storage` simulados), aplicando las migraciones
  0001–0012 en orden. Argo la aplica después por la Management API.
- **Borrado desde la app:** borrar nota, borrar cliente con todas sus
  notas, borrar datos del propietario; entrega de datos del cliente en
  JSON; audio borrado al aprobar la nota; cola `audio_cleanup` vaciada por
  `flushAudioCleanup()` en el navegador (al entrar y al aprobar/borrar).
- **Límite diario de IA** (150/día/agente, `AI_DAILY_LIMIT`) y **CORS
  configurable** (`ALLOWED_ORIGINS`) en las cuatro Edge Functions.
- **Sección «Privacidad»** en `/perfil` + página `/perfil/acciones` con el
  registro de acciones.
- **Docs RGPD** en `docs/rgpd/` (4 borradores) y **script de limpieza de
  datos de prueba** en `docs/deploy/limpieza-pruebas.sql` (**no ejecutado**;
  solo con el «sí» por escrito de Luis, que no lo ha dado).
- **Limpieza del repo:** los emails reales de prueba en este HANDOFF se
  sustituyeron por `<email-agente-a>`, `<email-agente-b>`,
  `<email-luis>` y `<email-prueba-fantasma>` (cuenta fantasma). Quedan los
  ficticios de semilla (`ana.garcia@gmail.com`) y los `example.com`: son
  datos de prueba por diseño, no cuentas reales. **Los emails reales
  siguen en el historial de git**; reescribirlo es decisión de Luis.
- `APP_PHASE_LABEL = 'inmo-visitas · Fase 8'`; Home: «Fase 8 — Seguridad,
  borrado y RGPD».
- **Nada de la nota de ejemplo de Ana García + V-18
  (`e0782f7c-8409-4e23-a2b0-5972521fed0a`) se tocó**: ni la nota, ni sus
  borradores aprobados, ni sus exportaciones. Todas las pruebas de
  borrado se hicieron con datos de sacrificio en local.

### Tablas / columnas / triggers / funciones / políticas (solo la 0012)

- `alter function … set search_path = public, pg_temp` en las 6 guardas
  (`visit_notes_guard`, `visit_notes_insert_guard`,
  `extracted_facts_guard`, `tasks_guard`, `drafts_guard`,
  `crm_exports_guard`) y además en `handle_new_agent`,
  `erase_client`, `erase_property_owner` y `visit_notes_delete_cleanup`.
- `revoke execute` de `handle_new_agent()` y `rls_auto_enable()` a
  `public, anon, authenticated` (los triggers siguen funcionando).
- `handle_new_agent()` redefinida sin el bloque «SOLO DEMO» (solo crea
  la fila de `agents`); `drop table public.demo_seed_claim`.
- **B-4:** `tasks_guard` y `drafts_guard` reescritas enteras (copia de la
  0009) + comprobación `cambio_no_permitido` al cambiar `visit_note_id`,
  `origin` (tareas) o `audience` (borradores) en un `update`.
- **B-9:** `check (char_length(external_id) <= 200)` en `crm_exports`.
- **B-6 aceptado y documentado** (ver `docs/rgpd/riesgos.md`): un agente
  puede pasar su propia exportación de `pendiente` a `enviado` con un
  PATCH directo; cerrarlo exigiría `service_role` en `crm-export`.
- **Nuevas tablas (RLS activado, solo propias):** `audio_cleanup`
  (`id, agent_id, path, reason nota_aprobada/nota_borrada`, select/insert/
  delete propias, sin update), `audit_events` (`id, agent_id, action
  nota_borrada/cliente_borrado/propietario_borrado/datos_entregados,
  entity_id, created_at`, select/insert propias, sin update/delete),
  `ai_calls` (`id, agent_id, fn transcribe/extract/drafts, created_at`,
  select/insert propias, sin update/delete).
- **Audio al aprobar:** `visit_notes_guard` (copia entera de la 0008)
  encola la ruta como `nota_aprobada` y pone `audio_url := null` al
  pasar a `approved` (solo si la nota tenía audio).
- **Trigger `visit_notes_delete_cleanup`** (before delete): encola el
  audio como `nota_borrada` (si lo tenía) e inserta `audit_events`
  `nota_borrada`.
- **Funciones `security invoker`** (todo pasa por RLS):
  `erase_client(uuid)` (borra las notas del cliente —en cascada sus
  datos, tareas, borradores y exportaciones—, borra el cliente e
  inserta `cliente_borrado`; cliente de otro agente → `no_encontrado`)
  y `erase_property_owner(uuid)` (nombre → «Propietario borrado»,
  teléfono → null, inserta `propietario_borrado`). Grants solo a
  `authenticated`.
- **Contacto en la base:** normalización previa (`regexp_replace` quita
  espacios, puntos, guiones y paréntesis; email a minúsculas sin
  espacios) con bloque DO que aborta con recuentos si alguna fila no
  queda válida; después, checks `clients_phone_format_check`,
  `properties_owner_phone_format_check` (`^\+[1-9][0-9]{7,14}$`) y
  `clients_email_format_check`. Los teléfonos semilla quedaron
  normalizados (`+34612345678`, `+34611100200`).
- **Migraciones 0001–0011 sin tocar.** Ninguna otra tabla/trigger/
  función/política cambió.

### Advisors de seguridad (antes / después)

- **No se pudo comprobar el panel de Advisors en local**: es una
  función del panel de Supabase y no existe en PostgreSQL pelado. Lo
  que se comprobó en local es la condición que hay detrás de cada
  aviso (ver «Prueba local» abajo); el panel se revisa al aplicar la
  0012 en el proyecto real.
- **Antes** (avisos que motivan la fase, según el prompt): `search_path`
  mutable en las 6 guardas; `handle_new_agent()` y `rls_auto_enable()`
  ejecutables por `anon`/`authenticated`; `demo_seed_claim` con RLS y
  sin políticas; `external_id` sin límite; `tasks`/`drafts` sin
  protección B-4; sin límite de IA ni CORS configurable. La protección
  de contraseñas filtradas desactivada es un **ajuste de Auth, no de
  esta fase**: no se tocó.
- **Después (verificado en local):** `proconfig = search_path=public,
  pg_temp` en las 6 guardas + `handle_new_agent` + las 3 funciones
  nuevas; `has_function_privilege(anon/authenticated, …) = false` en
  `handle_new_agent()` y `rls_auto_enable()`; `demo_seed_claim` no
  existe; RLS activado en `audio_cleanup` (3 políticas), `audit_events`
  (2) y `ai_calls` (2); B-4, B-9 y contacto verificados con pruebas
  negativas (abajo).

### Edge Functions cambiadas (NO redesplegadas)

- **Las cuatro cambian y hay que redesplegarlas a mano (clic de Luis en
  el panel; no hay API de despliegue).** `index.ts` + archivos nuevos:
  `cors.ts` en las cuatro, `limit.ts` en `transcribe`, `extract` y
  `drafts`. Al redeplegar, pegar el `index.ts` actualizado y **añadir
  los archivos nuevos con esos mismos nombres** (`./cors.ts`,
  `./limit.ts`); los *secrets* de proveedor no cambian.
- **`transcribe` (v12 local):** CORS desde `ALLOWED_ORIGINS` + límite
  diario antes de llamar al proveedor (después de la descarga del
  audio y de la respuesta ya transcrita, que no consume uso).
- **`extract` (v14 local):** CORS + límite diario antes de llamar al
  proveedor (después de comprobar que hay texto fuente).
- **`drafts` (v5 local):** CORS + límite diario antes de llamar al
  proveedor (después de la configuración del proveedor). Una
  invocación = un uso aunque genere los dos borradores o reintente.
- **`crm-export`:** solo CORS (no es función de IA: sin límite).
- **429 del límite:** `{ "error": "limite_diario_ia", "message": "Has
  llegado al límite diario de usos de la IA. Vuelve a intentarlo
  mañana." }`. Si la base falla al contar/insertar `ai_calls`, 502
  genérico de cada función (no 429).
- **Nuevos *secrets* (opcionales en pruebas; sin crearlos, todo sigue
  igual):** `ALLOWED_ORIGINS` (lista separada por comas; por defecto
  `http://localhost:5173`, `http://localhost:4173`,
  `https://luisetic.github.io`) y `AI_DAILY_LIMIT` (entero ≥ 1; por
  defecto 150). Documentados en `supabase/functions/README.md`.
- **Lógica de transcripción, extracción, borradores y exportación sin
  tocar**, salvo CORS y el límite añadidos delante.

### Rutas / pantallas nuevas o ampliadas

- **Nueva:** `/perfil/acciones` (`src/pages/PrivacyActions.tsx`,
  privada): lista propia de `audit_events` (acción + fecha, sin
  nombres).
- `/notas/:id` (`NoteDetail.tsx`): al aprobar, el reproductor de audio
  se oculta de inmediato y se vacía la cola; sección «Borrar nota» al
  final, con confirmación («Se borrarán la nota, su audio, sus datos,
  tareas, borradores y exportaciones. Lo que ya enviaste por WhatsApp
  o exportaste al CRM hay que borrarlo allí. Esta acción no se puede
  deshacer.») y navegación a `/notas` tras borrar.
- `/clientes/:id` (`ClientDetail.tsx`): botón «Descargar sus datos»
  (JSON `datos-cliente-<YYYY-MM-DD>.json`); «Borrar» va por
  `erase_client` (antes `removeClient`, **eliminado** de
  `clients/api.ts`): sin notas, confirmación como antes; con notas,
  la confirmación cuenta las notas y exige **escribir el nombre del
  cliente**.
- `/inmuebles/:id` (`PropertyDetail.tsx`): «Borrar datos del
  propietario» con confirmación («Se borrarán su nombre y su teléfono.
  El inmueble y sus notas se quedan. Los textos de las notas pueden
  nombrar al propietario: revísalos o bórralos si lo pide.»); tras
  borrar, la ficha muestra «Propietario borrado» y sin teléfono.
  «Borrar» el inmueble sigue como antes (solo sin notas).
- `/perfil` (`Profile.tsx`): sección «Privacidad» con los textos de
  `src/features/privacy/texts.ts` (BORRADOR, editables por Luis) y
  enlace «Mis acciones de privacidad».
- `AuthProvider.tsx`: al entrar con una sesión nueva, vacía la cola de
  audios una vez por usuario (nunca lanza).
- **Nuevos módulos:** `src/features/privacy/` — `texts.ts`,
  `audio-cleanup.ts` (`flushAudioCleanup()`, lotes de 50, nunca lanza),
  `export.ts` (`buildClientDataExport`, esquema
  `inmo-visitas.datos-cliente.v1`, sin `audio_url` ni `payload`),
  `api.ts` (`listAuditEvents`, `countClientNotes`, `eraseClient`,
  `erasePropertyOwner`, `downloadClientData`).
- **Errores 429 en el cliente:** `extractNote`, `prepareFollowUp` y
  `transcribeNote` muestran el `message` de la función (o la
  traducción de `limite_diario_ia` en `db-errors.ts`:
  `translateLimitError`). `removeNote` en `src/features/notes/api.ts`.
- **Tipos** en `src/lib/database.types.ts`: `AudioCleanupRow`,
  `AuditEventRow`, `AiCallRow` + tablas y RPCs `erase_client` /
  `erase_property_owner` en `Database`.

### Dependencias nuevas

- **Ninguna de producción.** Sin cambios en tokens de diseño, fuentes,
  ruta base ni Auth.

### Build / test / lint

- `npm test`: **243/243** (23 archivos; base 187 + 56 nuevos:
  `audio-cleanup` 6, `export` 3, `db-errors` +1, `cors` 5×4, `limit`
  8×3). Incluye DST de Madrid (29-mar y 25-oct-2026) y los límites
  200/201 de `external_id` por el lado del cliente.
- `npx tsc --noEmit`: **0 errores** (ojo: la primera pasada se dio por
  buena por error —el `exit` leído era el de `tail`, no el de `tsc`— y
  el build la cazó: faltaba importar `translateLimitError` en
  `notes/api.ts`, faltaba `agent_id` en el select de `audit_events` y
  `Profile.tsx` usaba una forma de `PRIVACY_TEXTS` que no era la del
  archivo; los tres corregidos).
- `npm run build` en base `/` y en `/inmo-visitas/`: **sin errores**.
  Trozo mayor `vendor-react` **255,49 kB** (≤ 500 kB).
- `npm run lint`: **2 avisos de shadcn aceptados, 0 errores**.
- **`deno check` de las cuatro funciones: NO se pudo hacer (no hay
  Deno en la VM)**. Lo hace Claude en la revisión. Los archivos nuevos
  (`cors.ts`, `limit.ts`) son TypeScript puro sin APIs de Deno y sus
  tests corren en vitest; `index.ts` usa `ReturnType<typeof
  createClient>` en el helper del límite y `Deno.env.get` como antes.

### Prueba local de la migración 0012 (PostgreSQL 16.15, `/tmp/pg-fase8`)

Clúster temporal local; esquemas `auth`/`storage` simulados
(`auth.uid()` lee `app.current_user_id`; `storage.foldername()` parte
la ruta; `storage.buckets`/`objects` mínimos). Se aplicaron las
migraciones 0001–0012 en orden, con datos de sacrificio (agentes A y B
con los mismos ids que en el proyecto de pruebas). **Todo pasó
(exit 0):**

- `search_path` en las 6 guardas + nuevas funciones; revokes
  efectivos (`has_function_privilege = false` para `anon` y
  `authenticated`); `demo_seed_claim` fuera; RLS + políticas en las 3
  tablas nuevas.
- Teléfonos semilla normalizados (`+34612345678`, `+34611100200`, 0 con
  espacios).
- **B-4:** cambiar `visit_note_id` de una tarea o `audience` de un
  borrador → `cambio_no_permitido`.
- **B-9:** `external_id` de 201 caracteres → check violation en el
  UPDATE a `enviado`; 200 caracteres pasan. (El guard de la 0011 pone
  `external_id` a null en el INSERT, así que el check solo se puede
  violar en el UPDATE, que es cuando la función pone el id del CRM.)
- **Contacto:** teléfono `612 34 56 78` y email `SIN-ARROBA` → check
  violation; teléfono/email válidos pasan.
- **Aprobar nota con audio:** `audio_url` → null, `approved_at` puesto,
  1 fila `nota_aprobada` en la cola con la ruta.
- **`ai_calls` / `audit_events`:** insert propio OK; `update`/`delete`
  afectan a **0 filas** (sin políticas de update/delete).
- **Borrar nota con audio (borrador):** 1 fila `nota_borrada` en la
  cola + 1 `nota_borrada` en `audit_events`. Borrar la nota ya aprobada
  no duplica la cola (su audio ya se encoló al aprobar) pero sí
  registra `nota_borrada`.
- **B no ve nada de A:** 0 filas en `audio_cleanup`, `audit_events` y
  `ai_calls` de A; `erase_client` del cliente de A como B →
  `no_encontrado`.
- **`erase_property_owner`:** nombre «Propietario borrado», teléfono
  null, 1 `propietario_borrado` en el registro.
- **`erase_client`:** cliente, notas, datos, tareas, borradores y
  exportaciones a 0; 1 `cliente_borrado`; el inmueble sigue (V-99).
  Lo de B intacto (verificado como postgres, sin RLS: cliente, nota e
  inmueble de B existen; las consultas como A daban 0 por RLS, no por
  borrado).
- Estado final: cola 2 filas (1 `nota_aprobada`, 1 `nota_borrada`);
  registro 6 filas (`nota_borrada` ×3, `datos_entregados`,
  `cliente_borrado`, `propietario_borrado`).

**Hallazgos de la prueba local (no son defectos de la 0012):**

1. La 0012 hace `revoke … rls_auto_enable()`, pero esa función **la
   crea Supabase** (event trigger `ensure_rls`) y **no está en ninguna
   migración**: en un PostgreSQL pelado la 0012 falla en la línea 34
   (`function public.rls_auto_enable() does not exist`). En el
   proyecto real existe; en local hizo falta un stub. La 0012 se
   aplica tal cual en Supabase.
2. La simulación de `auth.users` necesitó la columna
   `raw_user_meta_data` (la usa `handle_new_agent()` redefinida) y
   los grants de `authenticated` sobre las tablas públicas (en
   Supabase los pone la plataforma).

### Qué se borra exactamente en cada borrado y qué queda fuera de la app

- **Borrar nota** (`/notas/:id` → `delete` directo): la nota, sus
  datos, tareas, borradores y exportaciones (cascada); su audio va a
  la cola y `flushAudioCleanup()` lo borra de Storage; queda
  `nota_borrada` en `audit_events`. Si la nota ya estaba aprobada, el
  audio ya se había encolado al aprobar: no se duplica.
- **Borrar cliente** (`erase_client`): el cliente y **todas** sus notas
  con sus datos, tareas, borradores, exportaciones y audios (encolados
  como `nota_borrada` por nota); queda `nota_borrada` por nota +
  `cliente_borrado`. Los inmuebles no se tocan.
- **Borrar datos del propietario** (`erase_property_owner`): solo su
  nombre («Propietario borrado») y su teléfono (null). El inmueble, sus
  notas y el resto quedan. Queda `propietario_borrado`.
- **Aprobar nota:** solo el audio (encolado como `nota_aprobada` y
  borrado de Storage por el navegador). La transcripción revisada es
  la fuente desde entonces.
- **Fuera de la app (no se borra):** mensajes de WhatsApp ya enviados,
  fichas exportadas al CRM, el JSON descargado con «Descargar sus
  datos», y cualquier copia que el agente haya hecho. Cada
  confirmación de borrado lo dice.

### Supuestos tomados y decisiones que quedan para Luis

- **Supuestos (decididos aquí, revisables):**
  - `nota_borrada` la escribe el trigger, no la app: así no hay
    duplicados y queda registrada aunque la app falle entre llamadas.
  - Un uso de IA = una invocación de la función (los dos borradores de
    `drafts` y sus reintentos cuentan como uno); una respuesta ya
    guardada no consume uso. El día es Europe/Madrid (00:00), con el
    desplazamiento tomado a las 00:00 UTC para que los cambios de hora
    no lo muevan (probado en los dos cambios de 2026).
  - `allowedOrigins` / `madridDayStart` / `parseDailyLimit` se copian
    en cada carpeta de función (no pueden compartir archivo hoy).
  - La normalización de contacto quita separadores pero **no** añade
    `+34` a números de 9 dígitos: esas filas pararían la migración
    para revisión manual (en la semilla no hay ninguna).
  - `removeClient` eliminado: borrar un cliente solo existe como
    `eraseClient` (con registro). `removeProperty` se mantiene (borrar
    inmueble sin notas, como antes).
  - `ana.garcia@gmail.com` y los `example.com` se quedan en el HANDOFF:
    son datos ficticios de semilla/prueba, no cuentas reales.
  - El aviso de la captura («Graba tu resumen…») ya existía en forma
    equivalente: no se duplicó.
  - `PRIVACY_TEXTS` tiene forma `{ title, draftNotice, paragraphs[],
    actionsLinkLabel, actionsIntro }`: la pantalla la usa tal cual.
  - El `downloadClientData` no selecciona `audio_url` (sin audio en la
    descarga) y registra `datos_entregados` **después** de lanzar la
    descarga; si ese registro falla, avisa de que el archivo está
    descargado pero la acción no quedó registrada.
- **Decisiones para Luis (bloquean el piloto con datos reales, no esta
  fase):** proveedor de IA definitivo + plan de pago con DPA; base
  legal y textos legales; plan de Supabase (copias); SMTP propio; repo
  privado + staging en Coolify; limpieza de datos de prueba (su «sí»
  por escrito); reescribir o no el historial de git (emails reales).
  Los 4 docs de `docs/rgpd/` son **BORRADOR** y dicen «(decide Luis)»
  donde falta su decisión.
- **Pendiente de Argo tras verificar:** aplicar la 0012 en el proyecto
  real por la Management API; revisar los Advisors en el panel;
  redesplegar las 4 funciones (clic de Luis); desplegar en Pages.

### Cómo probarlo (con datos de sacrificio, nunca con la nota de ejemplo)

1. Aplicar la 0012 en el proyecto de pruebas (Argo, Management API) y
   redesplegar las 4 funciones (Luis, panel; pegar `index.ts` +
   `cors.ts` y `limit.ts` en cada una). Sin `ALLOWED_ORIGINS` ni
   `AI_DAILY_LIMIT`, todo sigue igual.
2. Como agente A, crear un cliente de sacrificio + inmueble + nota de
   voz (o texto), extraer, revisar y aprobar: al aprobar, el audio
   desaparece de la nota y la cola se vacía al recargar.
3. En la nota de sacrificio: «Borrar nota» → confirmar → la nota
   desaparece de `/notas` y `/perfil/acciones` muestra «Nota borrada».
4. Cliente de sacrificio con notas: «Borrar cliente y todos sus
   datos» → escribir su nombre → desaparece de `/clientes`; «Mis
   acciones de privacidad» muestra «Cliente borrado con sus notas».
5. Inmueble de sacrificio: «Borrar datos del propietario» → la ficha
   muestra «Propietario borrado» y sin teléfono.
6. «Descargar sus datos» en un cliente: se descarga
   `datos-cliente-<fecha>.json` (sin `audio_url` ni `payload`) y
   `/perfil/acciones` muestra «Datos del cliente entregados».
7. Límite diario: poner `AI_DAILY_LIMIT = 2` en los *secrets*, hacer 2
   usos de IA y un tercero → 429 con «Has llegado al límite diario de
   usos de la IA. Vuelve a intentarlo mañana.» (quitar el secret
   después).
8. B-4/B-9/contacto: desde el SQL Editor, intentar cambiar
   `visit_note_id` de una tarea (`cambio_no_permitido`), poner un
   `external_id` de 201 caracteres en una exportación enviada (check),
   o un teléfono con espacios (check).
9. **No ejecutar `docs/deploy/limpieza-pruebas.sql` sin el «sí» por
   escrito de Luis.** Cuando lo dé: primero la Parte 1 (listar y
   revisar), luego la Parte 2 (borrar); después, entrar en la app con
   cada agente para vaciar la cola de audios.

**Fase 8 construida (sin commit, tag ni push). Pendiente de Argo:**
verificar, aplicar la 0012, revisar Advisors, redesplegar funciones y
desplegar en Pages. Después, la prueba en navegador con datos de
sacrificio (criterios del prompt, punto 8).

### Verificación independiente de Argo (2026-11-13)

- Tests **243/243** (23 archivos), `tsc --noEmit` 0 errores, `npm run
  build` en base `/` y `/inmo-visitas/` sin errores, `npm run lint` 2
  avisos shadcn, 0 errores. Trozo mayor `vendor-react` 256 kB.
- Copias de la 0012 byte-idénticas (`cmp`). Guards verificados por
  diff: `visit_notes_guard` idéntico a la 0008 salvo el bloque de
  audio al aprobar; `tasks_guard`/`drafts_guard` idénticos a la 0009
  salvo el bloque B-4. `limit.ts` revisado (día Europe/Madrid con
  offset a las 00:00 UTC; DST probado en tests).
- `git grep` de claves sin resultados reales (`service_role` solo en
  comentarios/docs). Emails reales de `docs/HANDOFF.md` sustituidos
  por marcadores (5 ocurrencias); quedan los ficticios de semilla
  (`ana.garcia@gmail.com`, `example.com`) por diseño.
- **La 0012 NO se había aplicado al proyecto real: Argo la aplicó
  2026-11-13 por la Management API** en 5 trozos (el archivo, 19.827
  B, supera el límite de ~14 kB del endpoint), todos con exit 0.
  Verificado después en la base real: `demo_seed_claim` fuera;
  `audio_cleanup`, `audit_events` y `ai_calls` creadas con 7
  políticas; `search_path=public, pg_temp` en las 10 funciones;
  `handle_new_agent()` y `rls_auto_enable()` no ejecutables por
  `anon` ni `authenticated`; los 4 checks de formato y `external_id`
  existen; teléfonos normalizados (`+34612345678`,
  `+34611100200`); 0 filas de contacto que no cumplieran tras
  normalizar (comprobado antes de aplicar).
- Pendiente: verificación de los criterios 1–11 por API con datos de
  sacrificio (hacen falta las contraseñas de los agentes de prueba,
  que Luis pasa transitoriamente), redespliegue de las 4 funciones
  por Luis, prueba en navegador y Pages.

### Revisión de Claude (2026-11-13, Claude Code)

**Resultado: OK con 3 ajustes pequeños de interfaz (sin migración nueva y
sin cambios en las Edge Functions).**

**Comprobaciones:**

- `npm ci`, `tsc -b --noEmit` (0 errores, código de salida comprobado),
  `npm run lint` (2 avisos de shadcn aceptados, 0 errores), `npm test`
  **243/243 → 250/250** (7 nuevos), `npm run build` en base `/` y
  `/inmo-visitas/` sin errores; trozo mayor `vendor-react` 255 kB.
- **0001–0012 en PostgreSQL 16 temporal** con `auth`/`storage`
  simulados y `rls_auto_enable()` de stub (la crea Supabase, como
  apuntó Muse): todo se aplica; la **0012 aplicada dos veces** no da
  error (idempotente); copia de `docs/deploy/supabase-fase-8.sql`
  idéntica (`cmp`); teléfonos de la semilla normalizados.
- **Prueba negativa de RLS y criterios en PostgreSQL: 26/26 + 1**
  con dos agentes de sacrificio: B no ve clientes, notas, cola,
  registro ni `ai_calls` de A; `erase_client` y
  `erase_property_owner` de A como B → `no_encontrado`; B no borra la
  nota de A ni vacía su cola; B no inserta en la cola, el registro ni
  `ai_calls` a nombre de A (`42501`); `update`/`delete` en
  `ai_calls`/`audit_events` y `update` en `audio_cleanup` → 0 filas;
  B-4 (`visit_note_id`, `origin`, `audience`) → `cambio_no_permitido`;
  B-9 (`external_id` de 201) → `23514`; `612 34 56 78` y email con
  mayúsculas → `23514`; aprobar con audio → `audio_url` nulo y ruta en
  la cola; `erase_client` → todo borrado, 2 audios en cola,
  `cliente_borrado` + 2 `nota_borrada`; `anon` no ejecuta
  `erase_client`; `handle_new_agent()`/`rls_auto_enable()` no
  ejecutables; `search_path` fijo en las 10 funciones;
  `demo_seed_claim` retirada. **Extra:** `erase_client` con un
  borrador **aprobado** y una exportación **enviada** también lo borra
  todo (las guardas lo permiten en cascada).
- **Proyecto real** (`inmo-visitas-pruebas`): *Advisors* de seguridad
  solo con `auth_leaked_password_protection` (ajuste de Auth de Luis);
  cola `audio_cleanup` vacía y **0 audios huérfanos** en `visit-audio`.
  Las 4 funciones desplegadas por Claude con el conector (transcribe
  v16, extract v18, drafts v9, crm-export v7, Verify JWT activado) y
  probadas por Luis en Pages (transcribir, extraer, borradores). Límite
  diario probado por Muse (429 a los 2 y a los 4 usos con
  `AI_DAILY_LIMIT` bajo); el *secret* ya no existe (150 por defecto) y
  tampoco `ALLOWED_ORIGINS`.
- **Navegador a 360 px con Supabase simulado: 14/14** (`/clientes/:id`
  con 3 notas, `/perfil`, `/perfil/acciones`): la confirmación cuenta
  las notas y avisa de WhatsApp/CRM, el botón exige el nombre y llama a
  `rpc/erase_client`, vuelve a `/clientes`; sin desbordamiento ni
  errores de consola.
- `git grep` de claves: sin resultados (solo menciones en docs).
  Pages ya sirve la Fase 8 (`gh-pages` `a4c272e`).
- **No hecho:** `deno check` (no hay Deno en esta máquina y no se pudo
  instalar). Lo compensa que las 4 funciones ya corren en el proyecto
  real sin errores de arranque.

**Ajustes de este PR:**

- **M-1 · Cola de audios:** `flushAudioCleanup` daba por hecho que
  `storage.remove` lista también las rutas que ya no existían. No es
  así: devuelve solo lo que borra (lo dice la documentación de
  `storage-js` 2.119, con el ejemplo `"data": []`). Una ruta cuyo
  objeto ya no existiera se quedaba en la cola para siempre, contra el
  prompt. Ahora, para las rutas que `remove` no lista, se pregunta con
  `exists()` y la fila se va solo si Storage responde que no existe; si
  existe o la comprobación falla, se queda. Tests: el de «ya no existe»
  imitaba el comportamiento equivocado y se ha corregido; +1 test
  (fallo de `exists`).
- **M-2 · Confirmación por nombre** (`/clientes/:id`): el teclado del
  móvil suele añadir un espacio al final o poner mayúscula, y el botón
  no se activaba. `matchesConfirmName` (`src/features/privacy/
  confirm.ts`, 6 tests) ignora espacios de los extremos, espacios
  repetidos y mayúsculas; las tildes sí cuentan.
- **M-3 · «Descargar sus datos»:** la URL del archivo se liberaba en el
  mismo instante del clic, lo que puede cancelar la descarga en Safari
  de iPhone. Ahora se libera a los 10 s.

**Aplazados (baja, Fase 9):**

- **B-10:** el botón dice «Borrar»; el prompt pedía «Borrar cliente y
  todos sus datos» cuando hay notas. La confirmación ya lo explica.
- **B-11 — (decide Luis):** el límite cuenta **por función** (150 en
  transcribe, 150 en extract y 150 en drafts por agente y día), y el
  prompt decía «por agente». Además, un uso cuenta aunque luego falle
  el proveedor (el 502 de la prueba de Muse). Las dos cosas son
  defendibles; hay que decidirlas.
- **B-12:** el aviso de `/capturar` («Graba tu resumen al salir de la
  visita, no la conversación con el cliente.») no menciona el permiso
  del cliente, que pedía el prompt; y solo se ve con la pestaña de voz.
- **B-13:** `ana.garcia@gmail.com` (semilla y HANDOFF) es ficticio,
  pero `gmail.com` es un dominio real: mejor `example.com` en datos
  nuevos (la 0002 no se toca).

**Pendiente tras fusionar este PR:**

- Desplegar Pages desde `main` (cambian `ClientDetail` y la descarga).
- Prueba de Luis en el móvil, con datos de sacrificio: «Descargar sus
  datos» (sobre todo en iPhone), «Borrar cliente y todos sus datos»
  escribiendo el nombre en minúsculas, «Borrar nota» de una nota con
  audio y aprobar una nota con audio (el reproductor desaparece).
  En el proyecto real hay registros de borrados (de Argo), pero ninguno
  de `datos_entregados`: la descarga no se ha probado en vivo.
- Luis: activar la protección de contraseñas filtradas en Auth si el
  plan lo permite. La limpieza de datos de prueba sigue esperando su
  «sí».
### Verificación de criterios por API + push (Argo, 2026-11-13)

- **Push: commit `158a994` «Fase 8: seguridad, borrado y RGPD» +
  tag `v0.8-fase-8` subidos a main** (token de Luis, askpass borrado
  tras el uso). Main local = origin/main.
- **Criterios verificados por API con datos de sacrificio (prefijo
  F8-, nota de ejemplo de Ana intacta): 25/27 checks PASS** en
  `/tmp/f8-criteria.py` (script reutilizable; contraseñas solo en
  argv, nunca guardadas).
  - **C3 (aprobar nota con audio): PASS** — `audio_url` a null,
    transcripción intacta, 1 fila `audio_cleanup` razón
    `nota_aprobada` con la ruta.
  - **C2 (borrar nota aprobada con audio): PASS** — nota, datos y
    tareas desaparecen; 1 fila `audit_events` `nota_borrada`. La
    cola NO duplica el audio (ya se encoló al aprobar) — es lo
    previsto en el diseño, no un fallo.
  - **C2b (borrar nota en BORRADOR con audio): PASS** — 1 fila
    `audio_cleanup` razón `nota_borrada` con la ruta + 1 fila
    `audit_events` `nota_borrada`.
  - **C4 (borrar cliente con notas): PASS** — `erase_client` 204,
    cliente y nota desaparecen, 1 fila `cliente_borrado`; B sobre
    un cliente de A → 400 `no_encontrado`; B ve 0 filas de A en
    `audio_cleanup`/`audit_events`/`ai_calls`.
  - **C5 (borrar datos del propietario): PASS** — `erase_property_owner`
    204, nombre «Propietario borrado», teléfono null, 1 fila
    `propietario_borrado`.
  - **C7 (B-9): PASS** — `external_id` de 201 → 400
    `crm_exports_external_id_check`; 200 pasa (204).
  - **C10 (registro solo inserción): PASS** — PATCH a `audit_events`
    0 filas (acciones sin cambio); DELETE a `ai_calls` 0 filas
    (conteo igual antes/después).
  - **C6 (proxy por API): PASS** — notas y exportaciones legibles
    sin `payload` en el select. El JSON descargado en sí es
    criterio de navegador (pendiente, criterio 13).
- **Dos «FAIL» del primer run eran errores del script de prueba, no
  del producto, y se re-verificaron:**
  1. La cola `nota_borrada` no existe al borrar una nota ya
     aprobada (su audio ya estaba encolado como `nota_aprobada`) —
     comprobado en C2b con nota en borrador: 1 fila.
  2. El borrado de objeto de Storage en el script usaba el endpoint
     equivocado (`DELETE /object/<bucket>/<ruta>` → 400); el
     correcto es `DELETE /object/<bucket>` con
     `{"prefixes": [...]}`. Con el endpoint correcto los 2 audios
     de sacrificio se borraron (200) y el bucket quedó sin restos
     F8. La app usa `storage.remove()` (endpoint correcto), así
     que `flushAudioCleanup()` no está afectado.
- **Incidencia de la API de Supabase durante la verificación:**
  respuestas perdidas (`IncompleteRead`) en sign-in, POST y DELETE
  aunque la mutación se aplicara. El script reintenta solo los GET
  y verifica cada mutación con GET antes de reintentar — lección
  aplicable a futuros scripts de verificación.
- **Limpieza tras la verificación:** 0 clientes F8, 0 inmuebles
  F8, 0 audios F8 en el bucket. Queda 1 objeto previo en la carpeta
  de A (`2f328d2c-…-…​.webm`, anterior a la Fase 8, no tocado) —
  comprobar a qué nota pertenece antes de decidir nada sobre él.
- **Pendiente:** criterio 8 (límite diario, necesita las funciones
  redesplegadas por Luis desde main con `cors.ts`/`limit.ts`),
  criterio 1 (panel Advisors, dashboard), criterio 6 (JSON
  descargado) y criterio 13 (navegador a 360 px), Pages con la
  Fase 8 y revisión de Claude.

### Pages con la Fase 8 (Argo, 2026-11-13)

- Build desde main `158a994` con `VITE_BASE_PATH=/inmo-visitas/`
  (sin errores; trozo mayor `vendor-react` 255,49 kB) + `404.html`.
- **gh-pages `a4c272e`** (antes `7ac0529`); **MD5 del `index.html`
  en vivo `0add8357396e2649cdef5d6a0f25dd33`, idéntico al local**
  (verificado tras ~80 s). Push con el mismo token que Luis pasó
  para el commit (askpass borrado tras el uso).
- Recordatorio: al abrirla, cerrar la pestaña del todo y reabrir
  (la PWA guarda la versión anterior).

### Criterio 8 verificado: límite diario de IA (Argo, 2026-11-13)

- **Funciones desplegadas por Claude con el conector de Supabase**
  (no desde el editor del panel), desde main `158a994`, sin
  `.test.ts`; `rules.ts`/`mappers.ts` re-subidos sin cambios.
  Verificado por la Management API: **transcribe v16, extract v18,
  drafts v9, crm-export v7, `verify_jwt: true` en las 4.** Las tres
  primeras no eran v12/v14/v5 porque el contador ya iba por
  v15/v17/v8; cada una subió exactamente una versión. Secrets:
  `AI_DAILY_LIMIT` y `ALLOWED_ORIGINS` sin definir (valores por
  defecto: 150 usos/día/agente y los 3 orígenes actuales).
- **Prueba con `AI_DAILY_LIMIT` transitorio** (script en
  `~/workspace/f8-verification/f8-limit.py`, agente B, datos de
  sacrificio, nota de ejemplo intacta):
  - Con límite 2: llamadas **502, 200, 429**. La 1ª dio 502 del
    proveedor (Gemini, intermitente conocido) y **aun así consumió
    un uso** (la fila se inserta antes de llamar al proveedor, por
    diseño). La 3ª: **429 `{"error": "limite_diario_ia",
    "message": "Has llegado al límite diario de usos de la IA.
    Vuelve a intentarlo mañana."}`**; `ai_calls` de B quedó en 2 y
    los datos no cambiaron (la 3ª no re-extrajo).
  - Con límite 4 (B ya llevaba 3 usos): 200 y **429 de nuevo**,
    exactamente en el límite.
  - **Respuesta ya guardada no cuenta:** con el límite agotado,
    `extract` sobre la nota ya aprobada devuelve **409** («La nota
    ya está en revisión», mensaje del código desplegado) y
    `ai_calls` no aumenta — la comprobación de la nota va antes
    que la del límite.
  - **Secret al acabar: BORRADO** (DELETE 200 por Management API y
    comprobado ausente en la lista de secrets). Tras borrarlo, una
    nota nueva da 200: el límite por defecto (150) está restaurado.
- **Limpieza:** 0 clientes/inmuebles/notas F8; B tiene 4 filas en
  `ai_calls` hoy (los 4 usos consumidos; los 429 y el 409 no
  consumieron nada).
- **Incidencia del script:** el re-run murió leyendo el cuerpo de
  un 429 (`IncompleteRead` también en respuestas de error) antes de
  borrar el secret y los datos; se corrigió el helper
  (`f8_common.py`: el cuerpo de error perdido devuelve el código
  sin cuerpo) y se limpió todo a mano. Lección: los scripts de
  verificación viven en `~/workspace/f8-verification/` (duradero),
  no en `/tmp` (se borró solo entre sesiones).
- **Pendiente:** criterio 1 (panel Advisors, dashboard), criterio 6
  (JSON descargado) y criterio 13 (navegador a 360 px), revisión de
  Claude.

## HANDOFF FASE 9 — Pulido: móvil y resiliencia (2026-11-13, sin commit, tag ni push: lo hace Argo tras verificar)

- Hecho:
  - Captura resistente (`src/pages/Capture.tsx`, `src/features/notes/upload.ts` nuevo + `upload.test.ts`): reintento de subida por pasos con función pura `nextUploadStep` (`create-note` → `upload-audio` → `save-audio-url` → `done`); la pantalla recuerda `pendingNoteId`, `uploadedAudioPath` y `audioUrlSaved`, así que «Reintentar subida» se salta lo que ya salió bien (con `upsert: false`, volver a subir una ruta existente falla siempre). Cambiar de cliente/inmueble o pulsar «Volver a grabar» descarta el estado de subida (no se puede pegar un audio a otra nota). Aviso fijo sin conexión (`navigator.onLine` + eventos `online`/`offline`): «Sin conexión. La grabación se guarda en esta pantalla: no la cierres y pulsa Guardar cuando vuelva la conexión.»; Guardar no se desactiva. `beforeunload` mientras haya audio grabado sin guardar o se esté grabando. B-12: «Graba tu resumen al salir de la visita. No grabes al cliente sin su permiso.»
  - Ficha de la nota (`src/pages/NoteDetail.tsx`, `src/lib/use-slow-wait.ts` nuevo): el efecto de la URL firmada depende solo de `note.audio_url` (antes, de `note` entero). Nuevo hook `useSlowWait(active, 10000)`: a los 10 s de «Transcribiendo…», «Extrayendo…» (párrafo bajo el botón, porque ahí el texto visible es la etiqueta del botón) y «Preparando borradores y tareas…» aparece «Puede tardar hasta un minuto.»; sin reintento automático. B-8: con destino `whatsapp`, `handleExportMain` abre `window.open('', '_blank')` ANTES del `await` y asigna la URL después; si la exportación falla o no devuelve enlace, cierra la ventana en blanco; si `open` devuelve `null`, queda el enlace de respaldo que ya había. «Abrir en WhatsApp» de cada borrador NO cambia: es un `<a href>` nativo sin `await` antes de navegar.
  - Reglas de `drafts` (`supabase/functions/drafts/rules.ts` + `index.ts`): B-1 — paso 10 ahora es `requiredTasks(buyerData, buyerOutcome?.ok ? buyerOutcome.tasks : [])`: con borrador del comprador a 422 y sin `audience`, las tareas de regla se crean igual. B-3 — `MONEY_FIGURE_PATTERN` con `mil\b` («Calle 3 Milagros» ya no es dinero; «230 mil» sí); `matchesFinanceTerm` trata «entrada» aparte: solo cuenta con cifra o con «dar», «pagar», «para la» o forma de «tener» en las 6 palabras de alrededor («la entrada del edificio» no; «tiene la entrada» sí); `ownerLeaks` acepta `agentFullName` opcional e ignora las partes del nombre del cliente que también estén en el del agente (apellido compartido; `validateDraft` lo saca de `placeholders.agente`, el nombre de la firma); `confirmo`/`confirmamos` solo cuentan con `visita`, `cita`, `día`, `hora` o día de semana en las 6 palabras siguientes (el patrón genérico se quitó de `CONFIRMED_PATTERNS`). B-5 — «No afirmes nada del inmueble, del barrio ni del edificio que no esté en los datos.» en `SYSTEM_PROMPT_BUYER` y `SYSTEM_PROMPT_OWNER`, sin regla nueva. Tests nuevos en `rules.test.ts`: bloque «falsos positivos B-3 (Fase 9)» (5 tests) + 2 en `confirmsAppointment`, cada falso positivo con su contraparte verdadera.
  - Exportación (`supabase/functions/crm-export/expiry.ts` nuevo + `expiry.test.ts`): B-7 — función pura `stalePendingExports(rows, now)` (`STALE_PENDING_MINUTES = 10`, estrictamente más de 10 minutos; mensaje «Sin respuesta (interrumpida)»); `index.ts` la aplica antes de insertar: las filas propias `pendiente` de esa nota y ese `target` caducadas pasan a `error` (la limpieza es best-effort: si falla, no bloquea el nuevo intento). Pasos 6–8 renumerados (inserción 6, simulado 7, webhook 8).
  - Restos Fase 8: B-10 — en `/clientes/:id` el botón dice «Borrar cliente y todos sus datos» con notas y «Borrar» sin notas (mientras carga el contador, «Borrar»); el botón interior de confirmación sigue diciendo «Borrar». B-13 — ningún email `example.com` nuevo: los tests y docs nuevos no necesitaban emails ficticios; 0002 e historial del HANDOFF sin tocar. B-2 y B-11 documentados en `docs/rgpd/riesgos.md` (sección Aceptados).
  - Móvil: botón por defecto de shadcn `h-10` (40 px) → `h-11` (44 px) en `src/components/ui/button.tsx` para cumplir los 44 px del punto 6 en todos los botones sin tamaño explícito (Entrar, Enviar enlace, Guardar perfil…); los dos botones de cambio de modo de `/login` («Entrar con enlace mágico» / «Entrar con contraseña») pasan a `min-h-11`; `break-words` añadido a la dirección del inmueble en `/capturar` y en el enlace de la ficha (igual que en `/inmuebles`).
  - Docs: `docs/deploy/checklist-mvp.md` nuevo (Etapa 6, estado real: 1, 2, 3 y 5 hechos; 4 parcial — falta Coolify + subdominio + previews por PR; piloto 3–5 usuarios 1–2 semanas pendiente de Luis). `APP_PHASE_LABEL = 'inmo-visitas · Fase 9'`; portada «Fase 9 — Pulido: móvil y resiliencia».
- Migraciones: ninguna.
- Edge Functions cambiadas (pendientes de desplegar por Claude, con Verify JWT): `drafts` (B-1, B-3, B-5) y `crm-export` (B-7). `transcribe` y `extract` no cambian. Sin `deno check` (sin Deno en la máquina).
- Rutas/pantallas cambiadas: `/capturar`, `/notas/:id`, `/clientes/:id`, `/login` (botones), `/` (portada) y el botón base (todas las pantallas con botones de tamaño por defecto).
- Dependencias nuevas: ninguna de producción.
- Errores o warnings de build: `npm test` **268/268 en 26 archivos** (base 250/250 + 5 `upload.test.ts` + 6 `expiry.test.ts` + 7 B-3); `npx tsc --noEmit` exit 0, 0 errores; `npm run build` base `/` y `/inmo-visitas/` exit 0; `npm run lint` 0 errores, **2 avisos** (los de shadcn aceptados; los 2 que introdujeron mis primeros cambios — `setState` en efecto en `Capture.tsx` y `use-slow-wait.ts` — se arreglaron reestructurando el código, no silenciándolos); trozo JS mayor `vendor-react` **255,49 kB** (≤ 500 kB). `deno check` no disponible.
- Resultado del repaso móvil:
  - Headless a 360×780 (Chrome for Testing 158, Playwright, `vite preview` del build final): `/login`, `/`, `/clientes`, `/capturar`, `/notas`, `/pendientes`, `/perfil` — las 7 redirigen a `/login` (sin sesión) con **scrollWidth 360 = innerWidth 360 (sin desbordamiento), 0 botones < 44 px, 0 errores de consola y 0 peticiones externas** (nada tocó el proyecto real). Captura de `/login` revisada: etiqueta Fase 9, formulario limpio. Antes del arreglo del botón, `/login` tenía 2 botones < 44 px («Entrar» 40 px, «Entrar con enlace mágico» 20 px); tras el arreglo, ninguno.
  - Estático (pantallas con sesión, sin sesión disponible): botones principales `size="lg"` (48 px), enlaces de navegación y de portada con `min-h-11`, selectores de cliente/inmueble con `min-h-11`, filtros de `/inmuebles` `size="sm"` con `min-h-11`, inputs `min-h-11`; textos de usuario (nombres, emails, direcciones, valores, transcripciones, borradores, tareas) con `break-words`; el `<pre>` de la ficha tiene `overflow-x-auto`. Formularios sin elementos fijos: el botón de guardar va en flujo tras los campos.
  - Sin comprobar (queda para Luis): las pantallas con sesión a 360 px en navegador real (hace falta sesión de agente); B-8 en Safari real de iPhone (el patrón `window.open` antes del `await` solo se puede verificar allí); instalación PWA desde Chrome en Android (icono y nombre) y actualización automática tras desplegar; que el teclado no tape el botón de guardar en un móvil real.
- Decisión aplicada en B-11: **opción (a), dejarlo como está** (límite por función, 150 usos por agente y día; un uso cuenta aunque luego falle el proveedor). Luis no ha decidido; no se hace (b) ni (c); sin migración. Documentado en `docs/rgpd/riesgos.md`.
- Supuestos tomados y decisiones que quedan para Luis:
  - «entrada»: el prompt no fija ventana para cifra/verbo; se aplica ±6 palabras («junto a» = cercanía), documentado en `rules.ts` y cubierto por tests. Si Luis quiere otra ventana, es un cambio de una línea.
  - `beforeunload` avisa también mientras se está grabando (`state === 'recording'`), no solo con audio ya grabado: cerrar entonces también pierde la toma.
  - Botón por defecto a 44 px: es la variante del componente `button.tsx`, no un token de `index.css` (colores/fuentes/radios sin tocar).
  - Enlaces de texto dentro de frases («Regístrate», «Volver a…») miden ~20 px y se dejan como están; restilarlos como botones es decisión de Luis.
  - Caso límite del reintento: el estado recordado cubre fallos cuya respuesta llegó; si la respuesta se pierde tras una subida correcta (la subida sí se hizo pero el navegador no lo sabe), el reintento vuelve a subir y da el error de «ya existe» — no hay forma de saberlo sin preguntar a Storage, y el prompt no lo pide.
  - La skill `app-mvp` no está en este workspace: el checklist se construye con los puntos que nombra el prompt y la evidencia del proyecto.
  - Quedan para Luis: contraseñas filtradas en Auth, limpieza de datos de prueba (solo con su «sí»), decisiones jurídicas (base legal, textos, proveedor + DPA, plan de pago, plan de Supabase, SMTP), Coolify + subdominio en Hostinger, repo privado (y el historial de git con emails reales), y el piloto (3–5 usuarios, 1–2 semanas).
- Cómo probarlo (con datos de sacrificio, nunca la nota de Ana; tras desplegar Pages desde `main` y redesplegar `drafts` y `crm-export`):
  - URL: https://luisetic.github.io/inmo-visitas/ (entrar con el enlace mágico del agente de pruebas).
  - Criterio 1: grabar una nota, cortar la red justo tras la subida (o forzar el fallo en `setAudioUrl`) y pulsar «Reintentar subida»: la nota se guarda sin error de «ya existe» y se transcribe.
  - Criterio 2: modo avión en `/capturar`: sale el aviso fijo; la grabación sigue en pantalla; al volver la conexión, Guardar funciona. Cerrar la pestaña con una grabación sin guardar pide confirmación.
  - Criterio 3: transcribir una nota y mirar la pestaña Red: una sola petición de URL firmada.
  - Criterio 4: con una llamada lenta (extracción), a los 10 s aparece «Puede tardar hasta un minuto.»
  - Criterio 5: preparar el seguimiento con un borrador del comprador que no pase las reglas: la tarea «Confirmar día y hora: …» se crea igual.
  - Criterio 7: dejar una exportación en `pendiente` más de 10 min y exportar de nuevo esa nota a ese destino: la vieja pasa a `error` con «Sin respuesta (interrumpida)».
  - Criterio 8: en Safari de iPhone, «Compartir ficha por WhatsApp» abre WhatsApp o deja el enlace de respaldo.
  - Criterio 10: recorrer a 360 px `/login`, `/`, `/capturar`, `/clientes`, `/clientes/:id`, `/inmuebles`, `/inmuebles/:id`, `/notas`, `/notas/:id` (en sus estados), `/pendientes`, `/perfil` y `/perfil/acciones`.

### Verificación independiente de Argo (2026-11-13)

- Tests **268/268 en 26 archivos**, `npx tsc --noEmit` exit 0 (0
  errores), `npm run build` en base `/` y `/inmo-visitas/` exit 0,
  `npm run lint` 0 errores y 2 avisos de shadcn, trozo mayor
  `vendor-react` 255,49 kB. Todo verificado por Argo con sus propias
  ejecuciones, no solo con el informe del constructor.
- `git status`: 13 modificados + 6 nuevos, HEAD sigue en `50c948d`;
  **ninguna migración nueva**; sin dependencias nuevas de
  producción; sin `service_role` ni `any` en el diff.
- Leído el diff de los cambios de reglas y funciones: B-1
  (`requiredTasks` con `[]` si el borrador da 422), B-3 (los 4 casos:
  `mil\b`, «entrada» ±6 palabras con cifra/dar/pagar/para la/tener,
  apellido compartido con el agente, «confirmo» con palabra de cita
  en las 6 siguientes), B-5 (frase en los dos `SYSTEM_PROMPT`), B-7
  (filas propias `pendiente` > 10 min a `error` antes de insertar,
  best-effort), B-8 (`window.open` antes del `await` en
  `handleExportMain`; «Abrir en WhatsApp» de cada borrador es un
  `<a href>` nativo, sin cambio), URL firmada con dependencia solo
  en `audio_url`, `useSlowWait` a 10 s, reintento por pasos con
  `nextUploadStep`, aviso offline y `beforeunload`. Todo conforme al
  prompt.
- **Una corrección de Argo en `docs/rgpd/riesgos.md`:** la opción
  (c) de B-11 estaba mal descrita («un límite global por agente y
  día»); es «no contar los usos fallidos» (borrar la fila propia si
  el proveedor falla, con política de `delete` y migración). Texto
  corregido.
- **Dos cosas para la revisión de Claude (no bloquean):** (1) el
  botón por defecto pasa de 40 a 44 px en toda la app
  (`button.tsx`): cumple el criterio 10, pero es un cambio global
  de la variante, no solo de las pantallas que lo necesitaban.
  (2) Límite conocido del reintento, documentado por el
  constructor: si la respuesta se pierde tras una subida correcta
  (la API de Supabase pierde respuestas; visto en la Fase 8), el
  reintento vuelve a subir y da «ya existe». El criterio 1 del
  prompt inyecta el fallo después de que la subida devuelva
  (falla `setAudioUrl`), caso que sí cubre el diseño.
- Pendiente: commit + tag `v0.9-fase-9` + push (token de Luis),
  desplegar `drafts` y `crm-export` por Claude desde `main`, Pages,
  criterios 1–5, 7, 8 y 10 en navegador/móvil real con Luis, y
  revisión de Claude.

### Revisión de Claude (2026-11-13, Claude Code)

**Resultado: OK con 4 ajustes (R-1 a R-4). Sin migración nueva. B-8,
tal como llegó, no funcionaba.**

**Comprobaciones (sobre `d5376ce` y después sobre esta rama):**

- `npm ci`, `npx tsc --noEmit` (0 errores), `npm run lint` (2 avisos
  de shadcn aceptados, 0 errores), `npm test` **268/268 → 275/275**
  (7 nuevos), `npm run build` en base `/` y `/inmo-visitas/` sin
  errores; trozo mayor `vendor-react` 255,49 kB.
- **`deno check` por primera vez desde la Fase 8** (Deno 2.9.6 desde
  el registro npm, porque `dl.deno.land` no es accesible desde aquí):
  `crm-export` OK; `drafts`, `transcribe` y `extract` fallaban con
  **el mismo error de tipos desde la Fase 8** en `checkDailyLimit`
  (ver R-4). Tras R-4, las cuatro pasan.
- **0001–0012 en PostgreSQL 16 temporal** con `auth`/`storage`
  simulados y `rls_auto_enable()` de stub: todo se aplica; 0012
  idempotente.
- **Prueba negativa de RLS** con dos agentes de sacrificio
  (`example.com`): B no ve clientes, notas, exportaciones ni audios de
  A; el `update` de B sobre una exportación de A afecta a 0 filas; B no
  puede subir un audio a la carpeta de A (RLS de `storage.objects`) ni
  insertar una exportación en la nota de A (la guarda responde
  `nota_no_aprobada`); `anon` no ve nada.
- **B-7 en PostgreSQL, como Agente A** (las mismas consultas que hace
  `crm-export`): de tres `pendiente` (inmovilla hace 15 min, inmovilla
  hace 5 min, witei hace 30 min), solo la primera pasa a `error` con
  «Sin respuesta (interrumpida)»; la guarda deja `pendiente → error`
  y luego no deja reabrirla (`exportacion_cerrada`). **Criterio 7 OK.**
- **Navegador (Chromium a 360 × 780, build de producción con Supabase
  simulado en memoria, destino `whatsapp`, micrófono simulado, 0
  peticiones fuera del simulador):**
  - 16 pantallas (`/`, `/capturar`, `/clientes`, `/clientes/:id` con
    y sin notas, `/clientes/nuevo`, `/inmuebles`, `/inmuebles/:id`,
    `/inmuebles/nuevo`, `/notas`, `/notas/:id` en `transcribed`,
    `extracted` y `approved` con audio, `/pendientes`, `/perfil`,
    `/perfil/acciones`): `scrollWidth` 360 = ancho de la ventana, 0
    errores de consola. Con sesión salieron **3 enlaces de acción
    por debajo de 44 px** que el repaso sin sesión no podía ver
    (R-3). Tras R-3: 0.
  - **Criterio 1:** fallo inyectado en el `PATCH` de `audio_url` →
    «Reintentar subida» → nota guardada, **1 sola subida y 1 sola
    nota creada**. OK.
  - **Criterio 2:** `setOffline(true)` → aviso fijo con el texto
    exacto; Guardar sigue activo; al volver, el aviso desaparece;
    `beforeunload` cancelado con grabación sin guardar. OK.
  - **Criterio 3:** al transcribir una nota con audio, **1 sola**
    petición `POST …/object/sign/…` (la otra petición a esa ruta es la
    descarga del propio `<audio>`). OK.
  - **Criterio 4:** transcripción simulada de 12 s: a los 5 s no hay
    aviso; a los 11 s, «Puede tardar hasta un minuto.»; al terminar
    desaparece. OK.
  - **B-10 y B-12 (criterio 9):** «Borrar cliente y todos sus datos»
    con notas, «Borrar» sin notas; aviso nuevo de la pestaña de voz.
    OK.
  - **B-8 (criterio 8):** fallaba (ver R-1). Tras R-1, se abre una
    sola ventana, que navega a `https://wa.me/?text=…` con
    `window.opener === null`.
- Código leído contra el prompt: B-1 (las tareas de regla salen con
  `[]` si el comprador da 422 y se guardan antes del 422 del paso
  12), B-3 (cuatro casos con su contraparte), B-5 (frase en los dos
  `SYSTEM_PROMPT`), B-2 y B-11 (a) documentados en
  `docs/rgpd/riesgos.md`, B-13 (sin emails nuevos), checklist de la
  Etapa 6. Conforme.

**Ajustes de esta revisión:**

- **R-1 (alta) — B-8 no funcionaba.** `window.open('', '_blank',
  'noopener')` devuelve **siempre `null`**: lo dice la especificación
  HTML y lo he comprobado en Chromium. Por eso `whatsappWindow` nunca
  existía y el código caía en el `window.open` de después del `await`,
  que es justo el B-8 original. Ahora la ventana se abre sin
  `noopener` y se anula `opener` a mano en cuanto se abre, con la misma
  protección (`src/lib/popup.ts` + 3 tests). **Pages está desplegado
  con el fallo** (`c6f7841`): hay que volver a desplegarlo tras fusionar
  antes de probar el criterio 8 en el iPhone.
- **R-2 (media; punto 2 de Argo) — respuesta perdida tras una subida
  correcta.** Si la subida da error, `uploadAudio` pregunta a Storage
  (`exists()`, la misma llamada que la cola de audios usa desde la
  Fase 8) si el objeto ya está. Si está, lo da por subido. Es seguro
  por cuatro razones: la ruta es única por nota; «Volver a grabar» y el
  cambio de cliente o de inmueble ya crean otra nota (lo hizo el
  constructor); solo el agente escribe en su carpeta (0006); y Storage
  no deja objetos a medias. Probado en el navegador en los dos casos:
  respuesta cortada → la nota se guarda al primer intento; respuesta
  cortada y `exists()` también cortado → error, y «Reintentar» termina
  sin «ya existe» (2 intentos de subida, 1 objeto). 4 tests en
  `src/features/notes/api.upload.test.ts`. No necesita política nueva:
  `visit_audio_select_own` ya existe.
- **R-3 (baja) — zonas táctiles con sesión.** «Volver al inicio»,
  «Cerrar sesión» y el enlace a «Acciones de privacidad» en `/perfil`,
  y «Volver a mi perfil» en `/perfil/acciones`, medían 17–20 px. Llevan
  ahora `inline-flex min-h-11 items-center`, el mismo patrón que
  `/login`. Los enlaces dentro de una frase («Regístrate») se quedan
  como decidió el constructor.
- **R-4 (baja) — `deno check`.** `checkDailyLimit(supabase:
  ReturnType<typeof createClient>)` no casaba con el cliente creado
  (TS2345 y TS2353) en `drafts`, `transcribe` y `extract`. Ahora se usa
  `SupabaseClient`. **Es solo de tipos:** el JavaScript desplegado es el
  mismo, así que no hace falta volver a desplegar `transcribe` ni
  `extract` por esto.

**Punto 1 de Argo (botón por defecto de 40 a 44 px en toda la app):
se acepta.** Solo cambia la variante `default` de tamaño (`sm` y `lg`
siguen igual), y los tokens de color, fuente y radio no se tocan. Con
él, el repaso con sesión no encuentra ningún botón por debajo de 44 px
ni ningún desbordamiento a 360 px. 44 × 44 es el mínimo de Apple (Human
Interface Guidelines) y el nivel AAA del criterio 2.5.5 de las WCAG
2.2 (el AA, 2.5.8, pide 24 × 24) (Apple, s. f.; W3C, 2023).

**Observación (no se cambia):** con R-2, «Volver a grabar» o cambiar
de cliente después de un fallo deja la nota anterior en `draft` y sin
audio. Hay que crear otra nota para no mezclar audios, y la anterior se
puede borrar desde la app desde la Fase 8. Se anota para el piloto.

**Despliegue de Edge Functions: NO HECHO en esta sesión.** El conector
de Supabase no se pudo conectar (503 y luego tiempo de espera
agotado) en ningún momento de la sesión. Siguen activas `drafts` v9 y
`crm-export` v7 (Fase 8), sin B-1, B-3, B-5 ni B-7. Pendiente
(Claude, cuando vuelva el conector), desde `main` y con Verify JWT:
`drafts` (`index.ts`, `rules.ts`, `cors.ts`, `limit.ts`) y
`crm-export` (`index.ts`, `mappers.ts`, `expiry.ts`, `cors.ts`), sin
los `.test.ts`. Da igual desplegar antes o después de fusionar este
PR: R-4 no cambia el JavaScript de `drafts`.

**Referencias**

- Apple. (s. f.). *Accessibility*. Human Interface Guidelines.
  https://developer.apple.com/design/human-interface-guidelines/accessibility
- W3C. (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*.
  https://www.w3.org/TR/WCAG22/
- WHATWG. (s. f.). *HTML Living Standard*, § 7.2.2.1 «The `window.open()`
  method steps» (con `noopener`, devuelve `null`).
  https://html.spec.whatwg.org/multipage/nav-history-apis.html#window-open-steps

### Despliegue tras la revisión (Claude, 2026-11-13)

- **Edge Functions**, con el conector de Supabase, desde `main`
  `e0b4dd6`, con Verify JWT activado y sin los `.test.ts`:
  - `crm-export` → **versión 12** (API), con `index.ts`, `mappers.ts`,
    `expiry.ts` y `cors.ts`. Antes había código de la Fase 8, sin
    `expiry.ts`.
  - `drafts` → **versión 14** (API), con `index.ts`, `rules.ts`,
    `cors.ts` y `limit.ts`. Se comprobó leyendo la función desplegada:
    el código coincide con `main`. Única diferencia de forma: el
    ` ` de `joinThousands` quedó guardado como el carácter de espacio
    duro literal, que en una expresión regular de JavaScript es
    equivalente.
  - Ojo con la numeración: la API decía `drafts` v13 y `crm-export`
    v11 antes de este despliegue, y lo anotado en la Fase 8 (v9 y v7)
    era el sufijo de la ruta interna. A partir de aquí se anotan los
    números de la API.
  - `transcribe` (v20) y `extract` (v22) no se tocan.
- **Pages:** `gh-pages` `815af3f` (encima de `c6f7841`, sin forzar),
  con el código de `main` `e0b4dd6`. Antes se reprodujo byte a byte
  la build de `c6f7841` (`d5376ce`, MD5 del índice
  `6c29fbb85da6e743e2fe0ceef0dba494`, todos los archivos iguales)
  para fijar la configuración: clave *publishable*,
  `VITE_CLIENT_PRIMARY_COLOR` vacío, nombre «Inmo Visitas» y base
  `/inmo-visitas/`. **Diferencia a propósito:**
  `VITE_CLIENT_CRM_TARGET=whatsapp` (antes `manual`), para que salga
  «Compartir ficha por WhatsApp» y Luis pueda probar el criterio 8.
  Tras la prueba, volver a `manual` o dejarlo así: lo decide Luis.
  MD5 del `index.html` nuevo: `c75c1a2fc0dd51ae4dda24c87f9a88fb`.
  `github.io` no es accesible desde el entorno de Claude: el
  despliegue se siguió en GitHub Actions («pages build and
  deployment»).
