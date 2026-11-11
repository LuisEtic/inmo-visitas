# FASE 5 DE 9 — EXTRACCIÓN CON EVIDENCIA + REVISIÓN Y APROBACIÓN

> Prompt escrito por Claude el 2026-11-11 tras revisar el HANDOFF real de la
> Fase 4 (cerrada: voz real, micrófono bloqueado y recarga verificados por
> Luis en el móvil). Constructor: Muse.
> **No empieces hasta que Luis lo pida** y hasta que el PR de la revisión de
> la Fase 4 esté aprobado (merge en `main`).

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: al terminar una visita, el
agente dicta o escribe lo ocurrido; la app lo transcribe, **extrae datos
estructurados con la cita literal que los respalda**, el agente los revisa y
aprueba, y en la Fase 6 se generan tareas y borradores para comprador y
propietario. Stack: React 19 + Vite 8 + TypeScript estricto + Tailwind v4 +
shadcn/ui + Supabase (Auth + Postgres + Storage + Edge Functions) + Zod +
react-router 8 + Vitest. Lee antes `AGENTS.md` y `docs/ESTADO.md`.

## ESTADO ACTUAL

- **PRIMERO:** `git pull origin main`. No reviertas nada de lo que sigue.
- Fases 1–3 cerradas (esquema, Auth, RLS por agente en 8 tablas, CRUD de
  clientes e inmuebles, contacto). Parche de la Fase 3: precio con coma de
  miles y referencia siguiente libre.
- Fase 4 (`v0.4-fase-4`), cerrada y revisada: `/capturar` (texto y voz),
  bucket privado `visit-audio` (migración 0006), Edge Function `transcribe`
  (Groq por *secrets* `TRANSCRIBE_*`, JWT del agente, sin `service_role`),
  `/notas/:id` (audio con URL firmada, transcripción, corrección).
  `deno check` de `transcribe` pasa (Claude, Deno 2.9.6).
- Estados de la nota hoy: texto → `transcribed`; voz → `draft` →
  `transcribed`. La corrección del texto solo se permite en `draft` o
  `transcribed` (ya es así en `NoteDetail.tsx`).
- **Patrones que hay que mantener** (lecciones de las fases 3 y 4): rutas
  estáticas sin `useParams`; fichas con `key = id`; `<Button asChild><Link/>`
  para botones que son enlaces; errores de base con `translateDbError`;
  tipos a mano como `type`; **cada pantalla probada en el navegador**, no
  solo por API.
- Mejoras menores aplazadas a la Fase 9 (no las toques ahora): reintento de
  subida tras fallo parcial y URL firmada que se repide tras transcribir.

## ALCANCE DE ESTA FASE

1. **Migración 0007:** columnas de revisión en `extracted_facts`, marcas de
   tiempo en `visit_notes` y **reglas en la base**: una nota aprobada no se
   puede cambiar, y no se puede aprobar con datos sin revisar.
2. **Edge Function `extract`:** extrae datos de la nota con un modelo de
   lenguaje por la API de chat compatible con OpenAI (en pruebas, Gemini
   Flash; proveedor por *secrets* `EXTRACT_*`) y **descarta todo dato cuya
   cita no aparezca literalmente en el texto**.
3. **Revisión en `/notas/:id`:** ver cada dato junto a su cita resaltada en
   el texto, aceptar, editar, descartar o añadir datos, y aprobar la nota.
4. **Registro de revisión** para las métricas del piloto (cuántos datos
   propuso la IA, cuántos se aceptaron, editaron, descartaron o añadieron).

## QUÉ NO TOCAR

- Nada de tareas, borradores, bandeja de pendientes ni lista de notas
  (Fase 6), ni CRM o WhatsApp (Fase 7). No escribas en `tasks`, `drafts` ni
  `crm_exports`. La petición «mándanos los gastos» se extrae como dato; la
  tarea la crea la Fase 6.
- No modificar las migraciones 0001–0006 ni la función `transcribe`.
- **Nunca** `service_role`. La clave del modelo solo como *secret*
  (`EXTRACT_API_KEY`), nunca en `.env`, en el repo, en el HANDOFF ni en un
  chat. Muse no ve la clave: la guarda Luis.
- **Minimización de datos (RGPD):** a la IA solo se envía el texto de la
  nota (transcripción o `raw_text`). Ni teléfonos, ni emails, ni el nombre
  del propietario, ni el precio del inmueble.
- No extraer **categorías especiales de datos** (salud, origen étnico,
  religión, ideología, orientación sexual, etc.; art. 9 RGPD) aunque
  aparezcan en el texto: el prompt del sistema lo prohíbe y la función
  descarta los datos con `field_name` de esa lista (ver abajo).
- No cambiar tokens de diseño, fuentes, ruta base, Auth ni las políticas
  de RLS existentes. Sin dependencias nuevas de producción.
- No escribir en `console.log` ni en los logs de la función el texto de la
  nota, los datos extraídos, la respuesta del modelo ni la clave.

## ESPECIFICACIÓN (crear exactamente así)

### Estados de la nota (`visit_notes.status`, ya existen en 0001)

| Estado | Significado | Cómo se llega |
|---|---|---|
| `transcribed` | Texto listo | Fase 4 |
| `extracted` | La IA ha propuesto datos | `extract` termina bien |
| `reviewed` | En revisión: el agente ya ha tocado algún dato | Primer aceptar/editar/descartar/añadir |
| `approved` | Aprobada: nota y datos congelados | «Aprobar nota» |

Etiquetas en la UI: «Pendiente de transcribir», «Transcrita», «Datos
extraídos», «En revisión», «Aprobada».

### Migración `supabase/migrations/0007_extraccion_revision.sql`

Idempotente, comentada en español (`add column if not exists`, `create or
replace function`, `drop trigger if exists`):

- `extracted_facts`:
  - `origin text not null default 'ia' check (origin in ('ia', 'agente'))`
  - `review_status text not null default 'propuesto' check (review_status
    in ('propuesto', 'aceptado', 'editado', 'descartado'))`
  - `original_value text` — valor que propuso la IA, guardado la primera
    vez que el agente lo edita (para medir correcciones).
  - `reviewed_at timestamptz`
- `visit_notes`: `extracted_at timestamptz`, `approved_at timestamptz`.
- Función + trigger `before update` en `visit_notes`
  (`visit_notes_guard`, `security invoker`):
  - Si `old.status = 'approved'` → `raise exception 'nota_aprobada' using
    errcode = 'P0001'` (nada de una nota aprobada se puede cambiar).
  - Si `new.status = 'approved'` y `old.status <> 'approved'`: si existe
    algún `extracted_facts` de la nota con `review_status = 'propuesto'` →
    `raise exception 'datos_sin_revisar' using errcode = 'P0001'`; si no,
    `new.approved_at := now()`.
  - Si cambia `raw_text` o `transcript` y `old.status` no está en
    (`draft`, `transcribed`) → `raise exception 'texto_bloqueado' using
    errcode = 'P0001'` (la evidencia apunta a ese texto).
- Función + trigger `before insert or update or delete` en
  `extracted_facts` (`extracted_facts_guard`): si la nota está `approved`
  → `nota_aprobada`. Devuelve `old` en delete y `new` en el resto. Si la
  nota ya no existe (borrado de la nota en cascada), **permite** la
  operación: borrar una nota entera, aprobada o no, tiene que seguir
  siendo posible (derecho de supresión, RGPD; la pantalla de borrado llega
  en la Fase 8). El trigger de `visit_notes` es solo `before update`: no
  bloquea el borrado.
- Prueba en el HANDOFF: borrar en el SQL Editor una nota aprobada de
  prueba borra también sus datos sin error.
- No toca RLS: las políticas de 0004 siguen siendo las que deciden quién.
- `docs/deploy/supabase-fase-5.sql` con solo la 0007, para el SQL Editor.

### Errores nuevos en `translateDbError` (`P0001` por mensaje)

- `nota_aprobada` → «La nota está aprobada y ya no se puede cambiar»
- `datos_sin_revisar` → «Revisa todos los datos antes de aprobar la nota»
- `texto_bloqueado` → «El texto ya no se puede corregir: tiene datos extraídos»

### Edge Function `supabase/functions/extract/` (Deno)

Archivos: `index.ts` (servidor) y `rules.ts` (funciones puras, sin APIs de
Deno, importadas por `index.ts` y probadas con Vitest). Mismo patrón que
`transcribe`: CORS solo para `http://localhost:5173`,
`http://localhost:4173` y `https://luisetic.github.io`; verificación de JWT
por defecto; cliente con `SUPABASE_URL` + `SUPABASE_ANON_KEY` + cabecera
`Authorization` (RLS como el agente).

1. `POST { "visit_note_id": "<uuid>" }` (Zod). Leer la nota → 404 si no hay
   fila.
2. Estado permitido: `transcribed`, o `extracted` **sin** datos con
   `review_status <> 'propuesto'` («Volver a extraer»). Cualquier otro →
   409 `{ "error": "La nota ya está en revisión" }`.
3. Texto fuente = `transcript ?? raw_text`, recortado; vacío → 400.
4. Llamar a `POST ${EXTRACT_API_URL}` (chat completions compatible con
   OpenAI) con `Authorization: Bearer ${EXTRACT_API_KEY}`, cuerpo:
   `{ model: EXTRACT_MODEL, temperature: 0, response_format: { type:
   'json_object' }, messages: [ { role: 'system', content: SYSTEM_PROMPT },
   { role: 'user', content: <texto fuente> } ] }`. Tiempo máximo 60 s. Los
   tres *secrets* sin valores por defecto; si falta alguno o el proveedor
   falla → 502 `{ "error": "No se han podido extraer los datos. Inténtalo
   de nuevo." }` y la nota no cambia.
5. Parsear `choices[0].message.content` como JSON y validarlo con Zod
   (`rules.ts`): `{ facts: Array<{ category, field_name, value,
   evidence_quote, confidence }> }`, máx. 30; `category` del check de 0001;
   `field_name` `^[a-z][a-z0-9_]{1,39}$`; `value` 1–300; `evidence_quote`
   1–300; `confidence` 0–1 (redondeado a 2 decimales). JSON no válido →
   502 con el mismo mensaje.
6. **Reglas (en `rules.ts`, no en el modelo):**
   - `hasEvidence(quote, text)`: la cita debe aparecer en el texto
     comparando ambos normalizados (NFC, minúsculas, espacios colapsados,
     comillas tipográficas → rectas). Si no aparece, el dato se
     **descarta** y se cuenta en `discarded_no_evidence`.
   - `SENSITIVE_FIELDS`: si `field_name` contiene `salud`, `enfermedad`,
     `religion`, `etnia`, `origen`, `nacionalidad`, `orientacion`,
     `ideologia`, `politica`, `embarazo` o `discapacidad`, el dato se
     descarta y se cuenta en `discarded_sensitive`.
   - Duplicados (misma categoría + `field_name` + valor normalizado): se
     queda el de mayor confianza.
7. Borrar los `extracted_facts` previos de la nota con `origin = 'ia'`
   (solo en «Volver a extraer»), insertar los nuevos (`origin = 'ia'`,
   `review_status = 'propuesto'`) y actualizar la nota a `status =
   'extracted'`, `extracted_at = now()`. Todo con el cliente del agente.
   Error de base → 502.
8. Responder 200 `{ "facts_inserted": n, "discarded_no_evidence": n,
   "discarded_sensitive": n }`.

**`SYSTEM_PROMPT`** (constante en `index.ts`, en español; puedes mejorar la
redacción, no el contenido):

> Eres un asistente que extrae datos de la nota de un agente inmobiliario
> tras una visita. Devuelve SOLO un objeto JSON `{"facts": [...]}`. Cada
> dato: `category`, `field_name` (snake_case en español), `value` (breve),
> `evidence_quote` (fragmento COPIADO LITERALMENTE de la nota, sin
> cambiar ninguna palabra) y `confidence` (0 a 1). Categorías:
> `hecho_declarado` (lo que el cliente dijo o pidió; dato declarado, no
> comprobado), `observacion` (lo que el agente observó u opina),
> `objecion` (preocupaciones o pegas del cliente), `presupuesto` (cifra
> que el cliente declaró; es un presupuesto DECLARADO, nunca solvencia,
> financiación ni capacidad de pago acreditada), `cita_pendiente` (visitas
> o llamadas futuras; NUNCA las des por confirmadas salvo que la nota diga
> que están confirmadas con día y hora), `desconocido` (datos que faltan o
> están sin confirmar). No inventes nada que no esté en la nota. No
> extraigas datos de salud, origen, religión, ideología, orientación
> sexual ni otros datos especialmente protegidos. Si no hay datos,
> devuelve `{"facts": []}`.

### Pantalla `/notas/:id` (ampliar, mismo archivo y patrones)

- Estado `transcribed`: botón principal «Extraer datos» → `extract` →
  «Extrayendo…» → recarga los datos. Si `discarded_no_evidence > 0`, aviso
  discreto: «La IA propuso N datos sin cita en el texto y se han
  descartado.»
- **Texto con evidencia:** el texto de la nota se muestra con la cita del
  dato seleccionado resaltada (`<mark>` con clases de tokens existentes,
  p. ej. `bg-surface` + subrayado; sin colores nuevos). Al tocar un dato se
  resalta su cita y se desplaza hasta ella.
- **Datos agrupados por categoría**, en este orden y con estos títulos:
  «Objeciones», «Presupuesto declarado», «Citas pendientes (sin
  confirmar)», «Por confirmar», «Hechos declarados», «Observaciones».
  Tarjeta: etiqueta legible del `field_name` (`segunda_visita` → «Segunda
  visita»), valor, cita entre comillas «…», confianza como texto
  («Confianza alta» ≥ 0,8 · «media» ≥ 0,5 · «baja»), badge de
  `review_status` («Propuesto», «Aceptado», «Editado», «Descartado») y
  «IA» o «Añadido por ti» según `origin`.
- Acciones por dato (solo si la nota no está aprobada): «Aceptar»,
  «Editar» (valor 1–300; guarda `original_value` la primera vez,
  `review_status = 'editado'`), «Descartar» (no se borra:
  `review_status = 'descartado'`; los descartados se agrupan plegados en
  «Descartados (N)» con «Recuperar» → `propuesto`). Cada acción pone
  `reviewed_at = now()` y, si la nota está en `extracted`, la pasa a
  `reviewed`.
- «Añadir dato»: categoría (select nativo), nombre del dato (se convierte
  a `snake_case`), valor y cita opcional (si se escribe, debe estar en el
  texto: misma `hasEvidence`, copiada a `src/features/extraction/` o
  importada de `rules.ts`). Se guarda con `origin = 'agente'`,
  `review_status = 'aceptado'`, `confidence` null.
- «Volver a extraer»: solo en `extracted` sin datos revisados, con
  confirmación («Se sustituirán los datos propuestos por la IA»).
- **Resumen de revisión** encima de los datos: «IA: 6 propuestos · 4
  aceptados · 1 editado · 1 descartado · 1 añadido por ti».
- «Aprobar nota»: activo solo si no queda ningún dato `propuesto` (y hay
  al menos uno no descartado). Confirmación: «Una vez aprobada, la nota y
  sus datos no se podrán cambiar.» → `update status = 'approved'` (la
  base pone `approved_at`). Después: «Aprobada el 11 nov 2026, 19:05»,
  todo en solo lectura (también «Corregir»).
- Estados de carga y error en cada acción; 360 px sin desbordamiento;
  objetivos de 44 px.

### Tipos y capa de datos

- `database.types.ts`: `ExtractedFactRow`/`Insert`/`Update` (columnas de
  0001 + 0007) y `FactCategory`, `FactReviewStatus`, `FactOrigin`; añade
  `extracted_at` y `approved_at` a `VisitNoteRow`.
- `src/features/extraction/api.ts`: `listFacts(noteId)`, `extractNote(noteId)`
  (`functions.invoke('extract')`), `reviewFact(id, action, value?)`,
  `addFact(...)`, `approveNote(noteId)`.
- `src/features/extraction/labels.ts`: títulos de categoría, etiqueta de
  `field_name`, nivel de confianza (con tests).

### Datos de ejemplo para probar (ficticios)

Nota de texto de la Fase 4 (Ana García + V-18): «Ana ha visitado V-18 con
su pareja. Le preocupa el ruido de la calle Alcalá por la noche. Quiere
volver el viernes, falta confirmar la hora. Dice que su presupuesto es de
230.000 euros y pide que le mandemos los gastos de comunidad e IBI.»

Salida esperada (como mínimo; los `field_name` pueden variar):

| Categoría | Dato | Cita |
|---|---|---|
| `objecion` | ruido nocturno de la calle | «Le preocupa el ruido de la calle Alcalá por la noche» |
| `cita_pendiente` | segunda visita el viernes, **sin confirmar** | «Quiere volver el viernes» |
| `desconocido` | hora de la segunda visita | «falta confirmar la hora» |
| `presupuesto` | 230.000 € **declarado** | «su presupuesto es de 230.000 euros» |
| `hecho_declarado` | pide gastos de comunidad e IBI | «pide que le mandemos los gastos de comunidad e IBI» |

Lo que **NO** debe salir: la cita dada por confirmada; el presupuesto
como solvencia o financiación aprobada; datos que no estén en el texto.

## DESPLIEGUE

- **Luis:** pegar `docs/deploy/supabase-fase-5.sql` en el SQL Editor; crear
  los *secrets* `EXTRACT_API_URL`, `EXTRACT_MODEL` y `EXTRACT_API_KEY`
  (Claude le dará los valores); desplegar `extract` (Via Editor con sus dos
  archivos, `index.ts` y `rules.ts`, o CLI `supabase functions deploy
  extract`). Actualiza `supabase/functions/README.md` con todo esto.
- Pages, igual que en las fases 3 y 4.

## CRITERIOS DE ACEPTACIÓN

1. Con la nota de ejemplo, «Extraer datos» produce al menos los 5 datos de
   la tabla, cada uno con su cita resaltable en el texto; la cita del
   viernes aparece como pendiente y el presupuesto como declarado.
2. Un dato cuya cita no está en el texto se descarta (test de `rules.ts`
   con una respuesta simulada del modelo) y la UI avisa del número.
3. Un dato con `field_name` sensible (p. ej. `estado_salud`) se descarta
   (test).
4. Aceptar, editar (guarda `original_value`), descartar, recuperar y
   añadir funcionan y persisten tras recargar; la nota pasa a «En
   revisión» con la primera acción.
5. «Aprobar nota» está desactivado con datos «Propuesto»; **en la base**,
   un `update ... set status = 'approved'` con datos propuestos falla con
   `datos_sin_revisar` (pruébalo en el SQL Editor o por API).
6. Tras aprobar: `approved_at` relleno; la UI queda en solo lectura; **en
   la base**, cambiar el texto, un dato o añadir uno falla con
   `nota_aprobada`.
7. Corregir el texto de una nota `extracted` falla con `texto_bloqueado`.
8. **Prueba negativa:** `extract` con el JWT de B sobre la nota de A → 404;
   B no ve ni modifica `extracted_facts` de A; sin JWT → 401.
9. Sin `EXTRACT_API_KEY` o con el proveedor caído → 502 con el mensaje en
   español y la nota sigue en `transcribed`.
10. Lo que se envía al modelo es solo el texto de la nota (revisa el cuerpo
    en el código y escríbelo en el HANDOFF); la clave no aparece en el
    repo, `dist/` ni la red del navegador.
11. `npm test` (con tests de `rules.ts` y `labels.ts`), `npx tsc --noEmit`,
    `npm run build`, `npm run lint` sin errores (2 avisos de shadcn
    aceptados), trozo JS ≤ 500 kB; `deno check` de `extract` si tienes
    Deno (si no, lo hace Claude en la revisión).
12. Cada pantalla y acción nueva probada **en el navegador**, a 360 px y
    sin errores de consola, en local y en Pages (lo que no puedas, lo
    marcas como pendiente para Luis con pasos concretos).

## ENTREGA

Termina con el bloque HANDOFF FASE 5 (en `docs/HANDOFF.md`), commit «Fase 5:
extracción con evidencia + revisión y aprobación», etiqueta `v0.5-fase-5` y
push a `main`:

HANDOFF FASE 5
- Hecho: qué construiste realmente
- Tablas/columnas/triggers/políticas creadas o cambiadas (esperado: solo la
  0007)
- RLS / Edge Functions activas (y si `extract` está desplegada)
- Rutas/pantallas nuevas o ampliadas
- Dependencias nuevas (esperado: ninguna de producción)
- Errores o warnings de build (tsc/lint/test/deno) y trozo JS mayor
- Qué se envía exactamente al modelo y qué devuelve con la nota de ejemplo
  (los datos, no la clave)
- Supuestos tomados o pendientes
- Cómo probarlo (pasos y URL, con la nota de ejemplo)
