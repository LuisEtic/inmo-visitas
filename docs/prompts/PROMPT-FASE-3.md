# FASE 3 DE 9 — CRUD DE CLIENTES E INMUEBLES + DATOS DE CONTACTO

> Prompt escrito por Claude el 2026-11-11 tras revisar el HANDOFF real de la
> Fase 2 y los ajustes del PR de revisión (migración 0005). Constructor: Muse.
> **No empieces hasta que Luis lo pida** y hasta que el PR de ajustes de la
> Fase 2 esté aprobado (merge en `main`).

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: capturan notas de visita por voz
o texto, se transcriben y se extraen datos estructurados con evidencia, para
generar tareas y borradores diferenciados para comprador y propietario. Stack:
React 19 + Vite 8 + TypeScript estricto + Tailwind v4 + shadcn/ui + Supabase
(Auth + Postgres + Storage) + Zod + react-router 8. Lee antes `AGENTS.md` y
`docs/ESTADO.md` (fuente de verdad del proyecto).

## ESTADO ACTUAL

- **PRIMERO:** `git pull origin main`. No reviertas nada de lo que sigue.
- Fase 1 cerrada (`v0.1-fase-1`): 8 tablas, seed (8 inmuebles V-18, V-22,
  V-07, V-31, V-12, V-45, V-09, V-27 y 6 clientes, Jorge Navarro provisional),
  Minimal-Mono en `src/index.css`. PR #1: `VITE_BASE_PATH`, manifest PWA y
  fuentes autoalojadas.
- Fase 2 (`v0.2-fase-2`): Supabase Auth (contraseña, enlace mágico, registro,
  cierre de sesión), trigger de alta en `agents` con reclamo de la demo para
  el primer agente, /perfil, rutas con `basename`, RLS por agente en las 8
  tablas (30 políticas, sin políticas para `anon`). Prueba en vivo: 16/16,
  enlace mágico incluido (commit 5abb997).
- **Ajustes de la revisión de la Fase 2 (PR de Claude, migración 0005):**
  - `properties.reference` es única **por agente**: constraint
    `properties_agent_reference_key unique (agent_id, reference)`.
  - `agents`: solo `full_name` y `phone` se pueden actualizar (permisos por
    columna). El email es de solo lectura también en la base.
  - `visit_notes.client_id` y `property_id` son `not null`.
  - Reclamo de demo de una sola vez con `public.demo_seed_claim` (no tocar).
  - Páginas con `React.lazy` y trozos `vendor-*` en `vite.config.ts`. Las
    pantallas nuevas también van con `lazy`.
- En el proyecto Supabase de pruebas, Luis aplica `0005` en el SQL Editor
  antes de que pruebes. Compruébalo: `select conname from pg_constraint where
  conname = 'properties_agent_reference_key'` devuelve una fila.
- Staging temporal: GitHub Pages (https://luisetic.github.io/inmo-visitas/).
  Producción futura: Coolify en Hostinger.

## ALCANCE DE ESTA FASE

1. **Clientes:** lista con búsqueda, alta, ficha (ver y editar) y borrado.
2. **Inmuebles:** lista con búsqueda y filtro por estado, alta, ficha (ver y
   editar) y borrado.
3. **Datos de contacto:** validación y normalización de teléfonos y emails
   **al guardar** (cliente y propietario), y botones de contacto que abre el
   agente con un toque: «Llamar» (`tel:`), «WhatsApp» (abre el chat con
   `https://wa.me/…`, sin texto) y «Email» (`mailto:`). Cada botón aparece
   **solo si hay dato**. La app no llama ni envía nada por sí misma. Ver
   «Decisión de contacto» abajo.
4. **Navegación privada:** barra con Inicio, Clientes, Inmuebles y Perfil en
   todas las rutas privadas. Inicio enlaza a Clientes e Inmuebles.
5. **Pruebas unitarias** de los normalizadores con Vitest (`npm test`).

## QUÉ NO TOCAR

- Nada de captura de voz o texto, transcripción, IA, extracción, tareas,
  borradores ni exportación a CRM o WhatsApp (Fases 4–7). Nada de pantallas de
  notas de visita.
- Sin Edge Functions.
- No modificar las migraciones 0001–0005. Esta fase **no necesita migración**:
  si crees que sí, para y explícalo en el HANDOFF en lugar de crearla.
- No enviar `agent_id` desde el frontend: lo pone la base (`default
  auth.uid()`), y RLS lo comprueba.
- No cambiar tokens de diseño, fuentes, ruta base, Auth ni RLS.
- Sin paginación en servidor, importación CSV, fotos de inmuebles, mapas ni
  geolocalización.
- No escribir datos personales en `console.log` ni en mensajes de error.

## DECISIÓN DE CONTACTO (cerrada por Claude con Luis el 2026-11-11)

Queda escrito así, para que no haya dudas:

- **Qué es «contacto» en esta fase:** el teléfono y el email del cliente, y
  el teléfono del propietario (no hay columna de email del propietario y no
  se crea). Nada más: sin campo de WhatsApp aparte, sin historial de
  contactos, sin plantillas de mensaje.
- **Qué es «validar»:** formato **al guardar** desde la app, en el frontend
  con Zod (`src/lib/contact.ts`). Si el formato no es válido, el formulario
  no se guarda y muestra el error. Los teléfonos se guardan normalizados
  (`+34612345678`) y los emails en minúsculas. **No** se añade restricción en
  la base de datos en esta fase (sin migración); los datos antiguos con otro
  formato (el seed, `+34 611 100 200`) se aceptan al leer, se muestran
  formateados y se normalizan cuando se edita y guarda esa ficha. La
  restricción en base de datos, si hace falta, va en la Fase 8.
- **Por qué normalizar:** un único formato evita duplicados del mismo
  cliente escrito de dos formas, hace que los enlaces `tel:` y `wa.me`
  funcionen siempre, y prepara la búsqueda por teléfono de la captura
  (Fase 4) y la exportación al CRM (Fase 7).
- **Botones:** «Llamar», «WhatsApp» y «Email», solo cuando hay dato. Para
  el propietario, «Llamar» y «WhatsApp». El de WhatsApp solo **abre el chat**
  en la app del móvil del agente, sin texto precargado: no envía nada ni
  comparte datos desde la app. Es distinto de la Fase 7 (enviar los
  borradores generados por WhatsApp), que sigue fuera de alcance.
- **Teléfonos extranjeros** (E.164 con otro prefijo): se guardan tal cual y
  tienen los mismos botones.

## ESPECIFICACIÓN (crear exactamente así)

### Tipos y capa de datos

- `src/lib/database.types.ts`: tipos escritos a mano (`Row`, `Insert`,
  `Update`) para `clients` y `properties`, con las columnas exactas de 0001.
  `createClient<Database>` en `src/lib/supabase.ts`. Nada de `any`.
- `src/features/clients/` y `src/features/properties/`, cada una con:
  - `schema.ts`: esquemas Zod del formulario (entrada) y de la fila (salida).
  - `api.ts`: `list()`, `get(id)`, `create(input)`, `update(id, input)` y
    `remove(id)` sobre `supabase.from(...)`, con errores tipados.
- `src/lib/contact.ts` (funciones puras, con tests):
  - `normalizePhone(raw)`: quita espacios, puntos, guiones y paréntesis.
    9 dígitos que empiezan por 6, 7, 8 o 9 → `+34XXXXXXXXX`. Con prefijo `+34`
    o `0034` → `+34XXXXXXXXX`. Otro `+` con 8–15 dígitos → se guarda tal cual
    (E.164). Cualquier otra cosa → error «Teléfono no válido».
  - `formatPhone(e164)`: `+34612345678` → `612 34 56 78`; los extranjeros, tal
    cual. Debe aceptar también los teléfonos del seed (`+34 611 100 200`).
  - `normalizeEmail(raw)`: recorta y pasa a minúsculas; valida con Zod.
  - `telHref(phone)` → `tel:+34612345678`; `whatsappHref(phone)` →
    `https://wa.me/34612345678` (solo dígitos, sin `+`, sin espacios). Ambas
    aceptan también teléfonos del seed sin normalizar y devuelven `null` si
    no hay dato o no es válido (entonces no se pinta el botón).
  - `parsePriceEs(raw)`: `230.000` → 230000; `230000` → 230000;
    `230.000,50` → 230000.5. Debe ser > 0 y ≤ 9.999.999.999,99
    (`numeric(12,2)`).
  - `formatPriceEs(n)`: `Intl.NumberFormat('es-ES', { style: 'currency',
    currency: 'EUR', maximumFractionDigits: 0 })` → «230.000 €».
- Teléfonos ya guardados con otro formato (seed) se muestran con
  `formatPhone` y se normalizan al guardar la ficha.

### Validación de formularios (Zod, mensajes en español)

| Campo | Regla |
|---|---|
| `clients.full_name` | obligatorio, recortado, 2–120 caracteres |
| `clients.phone` | opcional, `normalizePhone` |
| `clients.email` | opcional, `normalizeEmail` |
| `clients.is_temporary` | casilla «Cliente provisional (faltan datos)» |
| `properties.reference` | obligatoria, recortada y en mayúsculas, 1–20 caracteres, `^[A-Z0-9][A-Z0-9-]*$` |
| `properties.address` | obligatoria, 3–200 caracteres |
| `properties.city` | obligatoria, por defecto «Madrid» |
| `properties.price` | obligatorio, `parsePriceEs` |
| `properties.owner_name` | obligatorio, 2–120 caracteres |
| `properties.owner_phone` | opcional, `normalizePhone` |
| `properties.status` | `disponible` · `reservado` · `vendido` (select nativo con tokens) |

Errores de la base que hay que traducir:

- `23505` en `properties_agent_reference_key` → «Ya tienes un inmueble con la
  referencia V-18» (con la referencia real).
- `23503` al borrar un cliente o un inmueble con notas de visita → «No se
  puede borrar: tiene notas de visita asociadas».
- `42501` o violación de RLS → «No tienes permiso para esta acción».

### Pantallas (todas privadas, con `lazy`)

- `/clientes`: buscador (nombre, teléfono, email; sin distinguir mayúsculas
  ni tildes), contador «6 clientes», botón «Nuevo cliente», lista en
  tarjetas ordenada por nombre: nombre, teléfono formateado y badge
  «Provisional» si `is_temporary`. Estado vacío: «Todavía no tienes
  clientes» + botón «Nuevo cliente».
- `/clientes/nuevo` y `/clientes/:id`: el mismo formulario. En la ficha:
  modo ver (con botones «Llamar», «WhatsApp» y «Email», cada uno solo si hay
  dato) y botón «Editar»; «Borrar» con confirmación («¿Borrar a Ana García?
  Esta acción no se puede deshacer.»). Un id inexistente o de otro agente →
  «No encontrado» (RLS devuelve 0 filas: no distinguir entre los dos casos).
- `/inmuebles`: buscador (referencia, dirección, ciudad, propietario),
  filtro por estado (Todos, Disponible, Reservado, Vendido), botón «Nuevo
  inmueble», tarjetas ordenadas por referencia: referencia en JetBrains Mono,
  dirección, precio formateado y badge de estado (variantes ya existentes).
- `/inmuebles/nuevo` y `/inmuebles/:id`: igual que clientes; en la ficha, el
  bloque «Propietario» con nombre y botones «Llamar» y «WhatsApp» si hay
  teléfono.
- Componentes: Button, Badge, Input y Label existentes. Puedes añadir
  `AlertDialog` de shadcn para la confirmación de borrado (solo tokens
  Minimal-Mono). Móvil primero: una columna, objetivos táctiles de 44 px como
  mínimo, sin desbordamiento horizontal a 360 px.
- Estados de carga («Cargando…») y de error en cada lista y ficha.

### Datos de ejemplo para probar

- Cliente nuevo: «Irene Castro Vidal», teléfono `612.34.56.78` → se guarda
  `+34612345678` y se muestra `612 34 56 78`; email `Irene.Castro@Example.com`
  → `irene.castro@example.com`.
- Inmueble nuevo: `v-52` → `V-52`, «Calle de Bravo Murillo 214, 3.º B»,
  Madrid, `285.000` → 285000 («285.000 €»), propietario «Rafael Gil Moreno»,
  `+34 699 11 22 33`, estado Disponible.

## DESPLIEGUE (GitHub Pages, staging temporal)

- Mismo método que en la Fase 2: build con `VITE_BASE_PATH=/inmo-visitas/`,
  copiar `dist/` (con `404.html` = `index.html`) a un directorio temporal,
  `git init` allí y push solo de eso a `gh-pages`. Nunca `git checkout
  --orphan` en el worktree principal.
- Verificar en navegador real que `/inmo-visitas/clientes`,
  `/inmo-visitas/clientes/<id>` (recargando la página) e
  `/inmo-visitas/inmuebles` cargan sin 404.

## CRITERIOS DE ACEPTACIÓN

1. El agente A (dueño de la demo) ve 6 clientes y 8 inmuebles; crea a Irene
   Castro Vidal y V-52 con los datos de ejemplo y se guardan normalizados.
2. A edita a Ana García (teléfono) y V-07 (estado a Vendido); los cambios
   persisten tras recargar.
3. A intenta crear otro «V-52» → «Ya tienes un inmueble con la referencia
   V-52». El agente B sí puede crear su propio «V-52» y su propio «V-18».
4. B ve 0 clientes y 0 inmuebles de A; abrir `/clientes/<id de Ana>` con B
   muestra «No encontrado».
5. Borrar a Irene Castro Vidal funciona. Si un cliente tiene una nota de
   visita (créala desde el SQL Editor para probar), el borrado muestra «No se
   puede borrar: tiene notas de visita asociadas» y el cliente sigue ahí.
6. Buscar «garcia» encuentra a «Ana García»; el filtro «Reservado» muestra
   solo los reservados.
7. En un móvil real: «Llamar» abre el marcador con `+34…`, «WhatsApp» abre
   el chat con ese número sin texto, «Email» abre el correo; un cliente sin
   email no muestra el botón «Email». A 360 px no hay desbordamiento
   horizontal. Teléfono inválido (`12345`) → el formulario no se guarda y
   dice «Teléfono no válido».
8. `npm test` pasa con, como mínimo, los casos de `contact.ts` de esta
   especificación (incluidos los del seed y los inválidos).
9. Las rutas nuevas funcionan en Pages (criterio de despliegue) y en local.
10. `npm run build`, `npx tsc --noEmit` y `npm run lint` sin errores (los 2
    avisos previos de shadcn se aceptan), y ningún trozo JS > 500 kB.

## ENTREGA

Termina con el bloque HANDOFF FASE 3 (añádelo a `docs/HANDOFF.md`), commit
«Fase 3: CRUD de clientes e inmuebles + contacto», etiqueta `v0.3-fase-3` y
push a `main`:

HANDOFF FASE 3
- Hecho: qué construiste realmente
- Tablas/columnas/políticas creadas o cambiadas (esperado: ninguna)
- RLS / Edge Functions / server functions activas
- Rutas/pantallas nuevas
- Dependencias nuevas (nombre y versión)
- Errores o warnings de build (tsc/lint/test) y tamaño del trozo JS mayor
- Supuestos tomados o pendientes
- Cómo probarlo (pasos y URL, con los datos de ejemplo de arriba)
