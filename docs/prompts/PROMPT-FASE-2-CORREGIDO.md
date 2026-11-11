# FASE 2 DE 9 (CORREGIDA) — ACCESO E IDENTIDAD DE AGENTES + SEGURIDAD BÁSICA (RLS POR AGENTE)

> **Versión corregida por Argo el 2026-11-10 a partir del prompt de Claude.**
> Corrige las 3 incongruencias graves y 1 menor detectadas en la revisión del
> 2026-11-10 (chat «Clone Vivir de IA platform», 18:50). Todo lo demás es el
> prompt original, sin cambios.
>
> **REORDEN CONFIRMADO POR LUIS EL 2026-11-11:** esta Fase 2 es Acceso + RLS
> por agente, adelantada desde la Fase 8. Captura NO es la Fase 2: es la Fase 4
> (ahí irán el audio y la lista de borradores, en la Fase 6). De las 3
> decisiones aprobadas para Captura solo sobrevive la de Supabase real, y como
> proyecto de pruebas. Este prompt es el que se ejecuta en la Fase 2.

## Correcciones aplicadas (qué cambió respecto al prompt de Claude y por qué)

1. **GitHub Pages SÍ se usa — es el staging temporal (probar y demos); producción en Hostinger/Coolify.** El prompt original decía
   «Ya no se usa GitHub Pages». Eso es falso: Luis lo eligió como staging temporal, hizo público el repo, y la web está viva y verificada en navegador
   real el 2026-11-10: https://luisetic.github.io/inmo-visitas/design-system
   El prompt corregido exige build con `VITE_BASE_PATH=/inmo-visitas/` y
   actualización de la rama `gh-pages`, y verificación en la URL pública.
   Con la base por defecto (`/`) los assets se pedirían en `/assets/...` y darían
   404 en la web viva.
2. **react-router con `basename`.** El prompt añadía react-router sin decir nada
   del `basename`, y react-router NO está instalado en el proyecto (no aparece en
   `package.json`). En Pages la app vive en `/inmo-visitas/`, así que el router
   debe crearse con `basename={import.meta.env.BASE_URL}` (que deriva de
   `VITE_BASE_PATH`). Sin esto, `/login`, `/registro` y `/perfil` resolverían a la
   raíz del dominio y darían 404 en la web viva. En local (`/`) el basename es
   `/` y no cambia nada.
3. **Enlace mágico: Site URL localhost + URL de Pages.** El prompt solo
   configuraba `http://localhost:5173`. En Pages ese enlace redirigiría a
   localhost y no funcionaría. Hay que añadir la URL de Pages en Redirect URLs
   de Supabase y probar el enlace mágico en local Y en Pages.
4. **(Menor) `visit_notes` debe comprobar que cliente e inmueble son del mismo
   agente.** La política original solo comprueba el `agent_id` propio de la nota,
   no que el `client_id` / `property_id` enlazados pertenezcan a ese agente: un
   agente podría crear una nota sobre un cliente de otro agente. Se añade esa
   comprobación en el `WITH CHECK` del insert (ver especificación).
5. **Aclarado el archivo `docs/deploy/supabase-hasta-fase-2.sql`.** Solo vale en
   un proyecto Supabase nuevo y vacío (pegar 0001–0004 de una vez). Si se pega
   en un proyecto donde 0001 y 0002 ya están aplicadas, fallará por tablas
   duplicadas. Se añade un criterio de aceptación que verifica los dos caminos:
   0003+0004 sobre una base con 0001+0002, y el archivo concatenado sobre un
   proyecto vacío.

---

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: capturan notas de visita por voz o texto, se transcriben y se extraen datos estructurados con evidencia, para generar tareas y borradores diferenciados para comprador y propietario. Stack: React 19 + Vite + TypeScript estricto + Tailwind v4 + shadcn/ui + Supabase (Auth + Postgres + Storage) + Zod. Normas del proyecto en AGENTS.md (léelas antes de empezar).

## ESTADO ACTUAL

- Fase 1 cerrada (tag v0.1-fase-1): 8 tablas en supabase/migrations/0001_initial_schema.sql, seed en 0002_seed_demo.sql, sistema de diseño Minimal-Mono en src/index.css y showcase en /design-system.
- Después de la Fase 1 se aprobó la PR #1 (revisión de Claude): ruta base configurable con VITE_BASE_PATH (por defecto /), manifest PWA alineado con la ruta base y fuentes autoalojadas con Fontsource (sin Google Fonts).
- **Staging temporal: GitHub Pages (probar y demos); producción en Hostinger/Coolify.** La web está viva en https://luisetic.github.io/inmo-visitas/design-system (verificada en navegador real el 2026-11-10). Para Pages el build usa `VITE_BASE_PATH=/inmo-visitas/`; en local y en Coolify con dominio propio la base es `/`.
- PRIMERO: haz `git pull origin main` para partir de esa versión (la copia de Argo ya está en `42a06c5`, limpia y al día). No reviertas ninguno de esos cambios.

## ALCANCE DE ESTA FASE

1. Autenticación real con Supabase Auth: registro e inicio de sesión con email + contraseña, inicio de sesión con enlace mágico (magic link) y cierre de sesión.
2. Perfil de agente: la fila de `agents` se crea automáticamente al registrarse (trigger sobre auth.users). Pantalla /perfil para ver y editar full_name y phone (el email es de solo lectura).
3. Rutas: instala react-router (no está en el proyecto) en modo declarativo, con `basename={import.meta.env.BASE_URL}` para que funcione en la subcarpeta de Pages. Públicas: /login, /registro, /design-system. Privadas: / (inicio provisional con «Hola, <nombre>» y enlace a /perfil) y /perfil. Si no hay sesión, una ruta privada redirige a /login; tras iniciar sesión, vuelve a la ruta que se pidió.
4. SEGURIDAD BÁSICA (adelantada desde la Fase 8 por decisión de Luis, confirmada el 2026-11-11): activa RLS en las 8 tablas con políticas «cada agente solo ve y modifica lo suyo» (detalle abajo).
5. Datos de demo: el primer agente que se registre «reclama» las filas seed sin dueño (agent_id NULL), para poder probar con datos.

## QUÉ NO TOCAR

- No construir CRUD de clientes ni de inmuebles (Fase 3), ni captura de audio o texto, transcripción, IA, borradores ni exportación a CRM.
- No crear Edge Functions.
- No cambiar los tokens de diseño, la ruta base configurable ni las fuentes autoalojadas.
- No modificar las migraciones 0001 y 0002: todo lo nuevo va en migraciones nuevas.
- Sin roles múltiples (admin, gestor): un único rol «agente».
- Sin recuperación avanzada de contraseña (como mucho, el enlace estándar «¿Olvidaste tu contraseña?» de Supabase).

## ESPECIFICACIÓN (crear exactamente así)

Migración `supabase/migrations/0003_auth_agents_trigger.sql`:
- Función `public.handle_new_agent()` con `security definer` y `set search_path = public`. Al insertar en auth.users, crea la fila en `public.agents` con:
  - id = new.id;
  - email = new.email;
  - full_name = coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)).
- La misma función, SOLO SI todavía no existe ningún otro agente, asigna el agent_id del nuevo agente a las filas de `clients` y `properties` cuyo agent_id sea NULL (reclamo de los datos de demo). Comentario SQL en mayúsculas: «SOLO DEMO — ELIMINAR ANTES DE PRODUCCIÓN».
- Trigger `on_auth_user_created`, after insert on auth.users, for each row, que ejecuta esa función.

Migración `supabase/migrations/0004_rls_por_agente.sql`:
- `alter table ... enable row level security` en las 8 tablas.
- Valor por defecto `agent_id default auth.uid()` en clients, properties, visit_notes y tasks.
- Políticas (`to authenticated`; ninguna política para `anon`):
  - agents: select y update solo donde `id = auth.uid()`. Sin insert (lo hace el trigger) ni delete.
  - clients, properties, visit_notes, tasks: select, insert, update y delete con `agent_id = auth.uid()` (en `using` y en `with check`).
  - **Corrección (menor):** en el insert de `visit_notes`, el `WITH CHECK` debe exigir además que el cliente y el inmueble enlazados pertenezcan al mismo agente (`exists (select 1 from public.clients c where c.id = client_id and c.agent_id = auth.uid())` y lo mismo para `properties`), para que «cada agente solo ve y modifica lo suyo» se cumpla también en ese enlace.
  - extracted_facts, drafts, crm_exports: las mismas cuatro operaciones si `exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid())`.
- Índices en agent_id (clients, properties, visit_notes, tasks) y en visit_note_id (extracted_facts, drafts, crm_exports).

Archivo `docs/deploy/supabase-hasta-fase-2.sql`: concatenación en orden de las migraciones 0001 a 0004, para que Luis la pegue de una vez en el SQL Editor de un proyecto Supabase de pruebas **nuevo y vacío** (ver criterio 7: en un proyecto donde 0001 y 0002 ya están aplicadas, fallaría por tablas duplicadas; ahí se aplican solo 0003 y 0004).

Frontend:
- `src/lib/supabase.ts`: mantenerlo; si faltan las variables de entorno, las pantallas de acceso muestran el aviso «Falta configurar Supabase (.env)» en lugar de fallar.
- Hook o contexto de sesión (`AuthProvider`) con onAuthStateChange; estado de carga mientras se comprueba la sesión (sin parpadeo de /login).
- /login: email + contraseña, botón «Entrar», enlace «Entrar con enlace mágico» (solo email) y enlace a /registro. /registro: nombre completo, email y contraseña (mínimo 8 caracteres), con el nombre enviado en `options.data.full_name`. Validación con Zod y mensajes de error en español: credenciales incorrectas, email ya registrado, enlace enviado.
- Usa exclusivamente los tokens Minimal-Mono y los componentes Button/Badge existentes; añade Input y Label de shadcn si hacen falta.
- `.env.example`: añade un comentario indicando que en Supabase → Authentication → URL Configuration hay que poner Site URL = http://localhost:5173 **y añadir https://luisetic.github.io/inmo-visitas/ en Redirect URLs** para que el enlace mágico funcione también en la web de Pages (no solo en local).

## DESPLIEGUE (GitHub Pages, staging temporal)

- Build con `VITE_BASE_PATH=/inmo-visitas/` y actualización de la rama `gh-pages` con el contenido de `dist/`, con el mismo método seguro de la Fase 1: copiar `dist/` a un directorio temporal, `git init` allí y pushear solo eso a `gh-pages`. **NO usar `git checkout --orphan` dentro del worktree principal** (en la Fase 1 eso metió `node_modules`, 113 MB, en el commit al desaparecer `.gitignore`).
- No desplegar con GitHub Actions: el token disponible no tiene scope `workflow`.
- Verificar en navegador real que la URL pública https://luisetic.github.io/inmo-visitas/ carga, que /login y /registro resuelven dentro de `/inmo-visitas/` (no 404) y que el enlace mágico abre sesión en Pages.

## CRITERIOS DE ACEPTACIÓN

1. Un agente nuevo se registra, se crea su fila en `agents` con el nombre indicado y accede a / y a /perfil.
2. El primer agente registrado ve como suyas las 8 propiedades y los 6 clientes de demo; un segundo agente no ve ninguno.
3. Prueba negativa documentada: con la clave anon y sin sesión, `select * from clients` devuelve 0 filas; con la sesión del agente B no se ven ni se pueden modificar datos del agente A.
4. Sin sesión, / y /perfil redirigen a /login; /design-system sigue siendo pública.
5. El enlace mágico llega y abre la app con sesión iniciada, probado con Site URL = localhost **y** con la URL de Pages en Redirect URLs (sesión iniciada en https://luisetic.github.io/inmo-visitas/).
6. Las migraciones 0003 y 0004 se ejecutan sin errores sobre una base de datos que ya tenga 0001 y 0002.
7. El archivo `docs/deploy/supabase-hasta-fase-2.sql` se ejecuta sin errores sobre un proyecto Supabase **nuevo y vacío** (0001–0004 de una vez).
8. El build de Pages con `VITE_BASE_PATH=/inmo-visitas/` no rompe la web viva: las rutas /login, /registro, /perfil y /design-system resuelven dentro de `/inmo-visitas/` y los assets cargan (sin 404 en `/assets/...`).
9. `npm run build`, `npx tsc --noEmit` y `npm run lint` sin errores.

## ENTREGA

Termina con el bloque HANDOFF FASE 2 (y añádelo a docs/HANDOFF.md), haz el commit «Fase 2: acceso de agentes + RLS por agente», la etiqueta v0.2-fase-2 y el push a main:
HANDOFF FASE 2
- Hecho: qué construiste realmente
- Migraciones nuevas y políticas RLS creadas (SQL exacto de cada política)
- Triggers / Edge Functions / server functions activas
- Rutas y pantallas nuevas (públicas y privadas)
- Errores o warnings de build (estado de tsc/lint)
- Supuestos tomados o pendientes (incluido el reclamo de datos de demo)
- Cómo probarlo: pasos para Luis (crear el proyecto Supabase de pruebas en región UE, pegar docs/deploy/supabase-hasta-fase-2.sql en SQL Editor, configurar la Site URL y las Redirect URLs —localhost y Pages—, rellenar .env, npm run dev, registrar dos agentes y hacer la prueba negativa)
