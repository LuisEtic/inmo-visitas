# FASE 9 DE 9 — PULIDO: MÓVIL Y RESILIENCIA

> Prompt escrito por Claude el 2026-11-13, en la revisión de la Fase 8
> (PR de revisión con los ajustes M-1 a M-3). Constructor: Muse (o Argo).
> **No empieces hasta que Luis lo pida** y hasta que el PR de este prompt
> esté fusionado en `main`.
> Las decisiones marcadas «(decidido por Claude)» las confirma Luis al
> lanzar la fase; si cambia alguna, se anota en `docs/ESTADO.md` antes de
> empezar. La marcada «(decide Luis)» **no la toma el constructor**: si
> Luis no la ha decidido al lanzar la fase, se deja como está.

## CONTEXTO DE LA APP

App PWA para agentes inmobiliarios en España: el agente dicta o escribe lo
ocurrido en una visita; la app lo transcribe, extrae datos con su cita
literal, el agente los revisa y aprueba, prepara tareas y borradores, lleva
la ficha al CRM o a WhatsApp, y puede borrar y entregar los datos de una
persona (Fase 8). Se ha probado **solo con datos ficticios**. **Esta
fase** es la última del MVP: arregla los fallos pequeños aplazados en las
revisiones, hace la captura más resistente a los fallos de red y deja la
app pulida en el móvil, para pasar al piloto. Stack: React 19 + Vite 8 +
TypeScript estricto + Tailwind v4 + shadcn/ui + Supabase (Auth + Postgres +
Storage + Edge Functions) + Zod + react-router 8 + Vitest. Lee antes
`AGENTS.md` y `docs/ESTADO.md`.

## ESTADO ACTUAL

- **PRIMERO:** `git pull origin main`. No reviertas nada de lo que sigue.
- Fases 1–8 construidas y revisadas. Migraciones 0001–0012 aplicadas en
  el proyecto `inmo-visitas-pruebas` (UE). Edge Functions activas, todas
  con verificación de JWT, clave anon + JWT del agente y **nunca
  `service_role`**: `transcribe` v16, `extract` v18, `drafts` v9 y
  `crm-export` v7 (CORS desde `ALLOWED_ORIGINS` y límite diario de IA
  desde `AI_DAILY_LIMIT`; ninguno de los dos *secrets* existe hoy, así
  que valen los valores por defecto).
- **Revisión de la Fase 8 (Claude):** M-1 la cola de audios comprueba con
  `exists()` las rutas que `storage.remove` no lista; M-2 la confirmación
  de borrado de cliente tolera espacios y mayúsculas
  (`src/features/privacy/confirm.ts`); M-3 la descarga del JSON libera la
  URL a los 10 s (Safari de iPhone). Tests 250/250.
- **Aplazados que entran en esta fase** (descritos en `docs/HANDOFF.md`):
  - **Fase 4:** «Reintentar subida» tras un fallo parcial vuelve a subir
    con `upsert: false` y falla siempre (`Capture.tsx`,
    `handleSaveAudio`); la URL firmada del audio se vuelve a pedir al
    terminar la transcripción (efecto con `[note]` en `NoteDetail.tsx`).
  - **Fase 6:** B-1 (si el borrador del comprador da 422, la tarea de
    regla de la cita pendiente no se crea), B-3 (falsos positivos de las
    reglas de `drafts`), B-5 (el borrador afirma cosas del inmueble que
    no están en los datos).
  - **Fase 7:** B-7 (filas `pendiente` huérfanas si `crm-export` se
    corta), B-8 (`window.open` después de un `await`, que Safari de iOS
    puede bloquear).
  - **Fase 8:** B-10 (texto del botón de borrar cliente), B-11 (límite de
    IA, **decide Luis**), B-12 (aviso de `/capturar`), B-13
    (`gmail.com` en datos ficticios).
  - **Extracción lenta** (desde la Fase 5): el camino Supabase → Google
    a veces tarda 28–60 s o da 502, y al reintentar funciona.
- **Aplazados que NO entran:** B-2 (escrituras no atómicas en `drafts`)
  se **acepta y se documenta** (ver abajo); B-6 ya está aceptado en
  `docs/rgpd/riesgos.md`. Nada de lo jurídico (base legal, textos,
  proveedor de IA, DPA, plan de pago): sigue siendo de Luis.
- **Patrones que hay que mantener:** rutas estáticas sin `useParams`;
  fichas con `key = id`; `<Button asChild><Link/>`; errores de base con
  `translateDbError`; tipos a mano como `type`; etiqueta de fase solo en
  `src/lib/app-label.ts`; funciones puras de las Edge Functions en un
  archivo aparte probado con Vitest; **cada pantalla probada en el
  navegador**; migraciones como SQL directo.

## ALCANCE DE ESTA FASE

1. **Captura resistente:** reintento de subida que funciona, aviso sin
   conexión y la grabación conservada en pantalla hasta guardarla.
2. **Ficha de la nota:** URL firmada estable y espera de la IA explicada.
3. **Reglas de `drafts`:** B-1, B-3 y B-5.
4. **Exportación:** B-7 y B-8.
5. **Restos de la Fase 8:** B-10, B-12 y B-13; B-11 solo si Luis lo
   decide.
6. **Móvil:** repaso de todas las pantallas a 360 px y en un móvil real.
7. **Documentación de cierre del MVP:** checklist de la Etapa 6.

## QUÉ NO TOCAR

- **Sin migración nueva**, salvo que B-11 la necesite (no la necesita: se
  hace en las funciones). Si crees que hace falta una, para y pregunta.
- **Nunca** `service_role`. Las claves solo como *secrets*.
- No cambiar la lógica de extracción ni la de exportación salvo lo que
  dice este prompt. No cambiar los esquemas de las respuestas de las
  funciones (el cliente depende de ellos).
- No escribir en logs ni en `console.log` datos personales, textos de
  notas, rutas de audio ni claves.
- No cambiar tokens de diseño, fuentes, ruta base ni Auth. Sin
  dependencias nuevas de producción (tampoco una librería de
  almacenamiento local: IndexedDB a mano si hiciera falta, pero esta fase
  no la usa).
- **Sin cola offline** — (decidido por Claude): guardar audios en el
  dispositivo para subirlos más tarde es otro producto (cifrado en el
  móvil, borrado, RGPD). Aquí solo se conserva la grabación **en
  memoria** mientras la pantalla siga abierta.
- No borres datos del proyecto de pruebas. La limpieza sigue esperando
  el «sí» de Luis (`docs/deploy/limpieza-pruebas.sql`).

## ESPECIFICACIÓN (crear exactamente así)

### 1. Captura (`src/pages/Capture.tsx`, `src/features/notes/api.ts`)

- **Reintento de subida:** recuerda la ruta ya subida de esa nota. Si la
  subida fue bien y falló el paso siguiente (guardar `audio_url` o
  pasar a transcribir), «Reintentar» **se salta la subida** y repite
  solo lo que falló. Si la subida falló, la repite (sigue con
  `upsert: false`). Función pura que decide el siguiente paso a partir
  del estado (`nota creada`, `audio subido`, `audio_url guardado`), con
  tests.
- **Sin conexión:** si `navigator.onLine` es `false` o llega el evento
  `offline`, aviso fijo en `/capturar`: «Sin conexión. La grabación se
  guarda en esta pantalla: no la cierres y pulsa Guardar cuando vuelva
  la conexión.» Al volver (`online`), el aviso desaparece. El botón
  Guardar no se desactiva (el navegador puede equivocarse).
- **Salir con una grabación sin guardar:** `beforeunload` con el aviso
  estándar del navegador mientras haya un audio grabado sin guardar.
- **B-12:** el aviso de la pestaña de voz pasa a ser «Graba tu resumen al
  salir de la visita. No grabes al cliente sin su permiso.»

### 2. Ficha de la nota (`src/pages/NoteDetail.tsx`)

- **URL firmada:** el efecto que la pide depende solo de
  `note.audio_url` (no de `note`), para que no se vuelva a pedir al
  cambiar el estado de la nota.
- **Espera de la IA:** en «Transcribiendo…», «Extrayendo…» y
  «Preparando seguimiento…», si pasan más de 10 s, se añade debajo:
  «Puede tardar hasta un minuto.» Sin reintento automático —
  (decidido por Claude): cada reintento gasta un uso del límite diario y
  una llamada al proveedor; el botón «Reintentar» ya existe.
- **B-8:** con destino `whatsapp`, abre la ventana **antes** del
  `await` (`window.open('', '_blank')`) y le asigna la URL después; si
  el navegador devuelve `null`, se queda el enlace de respaldo que ya hay
  en pantalla. Mismo patrón en «Abrir en WhatsApp» de cada borrador si
  también abre tras un `await`.

### 3. Reglas de `drafts` (`supabase/functions/drafts/`)

- **B-1:** si el borrador del comprador no pasa las reglas (422) y no
  hay `audience`, las **tareas de regla** (una por cada `cita_pendiente`)
  se crean igualmente con `requiredTasks(buyerData, [])`. Las tareas de
  la IA, no (vienen del borrador rechazado).
- **B-3 — falsos positivos** (en `rules.ts`, con un test por caso):
  - `MONEY_FIGURE_PATTERN`: `mil` solo como palabra completa
    («Calle 3 Milagros» ya no es dinero; «230 mil» sí).
  - `entrada` solo cuenta como término económico junto a una cifra o a
    «dar», «pagar» o «para la» («la entrada del edificio» no; «tiene
    la entrada» sí, por la regla de cifra o de verbo: elige la forma más
    simple que pase los tests y documéntala).
  - Nombre del cliente en el borrador al propietario: no cuentan las
    partes del nombre que también estén en el nombre del agente
    (agente y cliente que comparten apellido).
  - «te confirmo»: `confirmo` / `confirmamos` solo cuentan como cita
    confirmada si en las 6 palabras siguientes aparece `visita`, `cita`,
    `día`, `hora` o un día de la semana («te confirmo los gastos» no;
    «te confirmo la visita del viernes» sí).
- **B-5:** añade al `SYSTEM_PROMPT_BUYER` y al `SYSTEM_PROMPT_OWNER`:
  «No afirmes nada del inmueble, del barrio ni del edificio que no esté
  en los datos.» Sin regla nueva (no se puede comprobar con fiabilidad).
- **B-2 — (decidido por Claude):** se **acepta y se documenta** en
  `docs/rgpd/riesgos.md` (sección técnica): un fallo a mitad deja un 502
  con parte guardada, y «Reintentar» lo arregla. Hacerlo atómico exige
  una función en la base y no compensa en el MVP.

### 4. Exportación (`supabase/functions/crm-export/`)

- **B-7:** antes de insertar la fila nueva, la función pasa a `error`
  las filas **propias** de esa nota y ese `target` que sigan en
  `pendiente` desde hace más de 10 minutos, con `error_message`
  «Sin respuesta (interrumpida)». Función pura que decide qué filas
  caducan, con tests.

### 5. Restos de la Fase 8

- **B-10:** en `/clientes/:id`, cuando el cliente tiene notas, el botón
  dice «Borrar cliente y todos sus datos»; sin notas, «Borrar».
- **B-13:** en datos ficticios **nuevos** (tests, documentación), emails
  con `example.com`. No se tocan la 0002 ni los textos históricos del
  HANDOFF.
- **B-11 — (decide Luis):** hoy el límite cuenta **por función** (150
  transcripciones, 150 extracciones y 150 seguimientos por agente y día)
  y un uso cuenta aunque luego falle el proveedor. Opciones: (a) dejarlo
  así; (b) un solo límite por agente para las tres funciones (quitar el
  filtro `.eq('fn', …)` del recuento); (c) no contar los usos fallidos
  (borrar la fila propia si el proveedor falla: hace falta una política
  de `delete` y, por tanto, una migración; **no** lo hagas sin que Luis
  lo pida). Si Luis no ha decidido al lanzar la fase, **(a)**.

### 6. Móvil (todas las pantallas)

- Recorre a 360 × 780 px y en un móvil real (Android con Chrome e iPhone
  con Safari si hay): `/login`, `/`, `/capturar`, `/clientes`,
  `/clientes/:id`, `/inmuebles`, `/inmuebles/:id`, `/notas`,
  `/notas/:id` (en todos sus estados), `/pendientes`, `/perfil` y
  `/perfil/acciones`.
- Sin desbordamiento horizontal ni errores de consola; zonas táctiles de
  al menos 44 px de alto en botones y enlaces de acción; el teclado no
  tapa el botón de guardar en los formularios.
- PWA: se instala desde Chrome en Android con su icono y nombre; tras
  desplegar, la versión nueva se carga sola (`registerType:
  'autoUpdate'`, ya configurado). Anota lo que no puedas comprobar.

### 7. Documentación

- `docs/rgpd/riesgos.md`: añade B-2 (técnico) y la decisión sobre B-11.
- `docs/deploy/checklist-mvp.md` (nuevo): el checklist «listo para
  probar» de la Etapa 6 de la skill `app-mvp`, con el estado real de cada
  punto y lo que falta de Luis (contraseñas filtradas, limpieza de datos,
  decisiones jurídicas, Coolify, repo privado).
- `APP_PHASE_LABEL = 'inmo-visitas · Fase 9'`; portada «Fase 9 —
  Pulido: móvil y resiliencia».

## DESPLIEGUE

- **Edge Functions:** cambian `drafts` (B-1, B-3, B-5) y `crm-export`
  (B-7), y `transcribe`/`extract`/`drafts` solo si Luis decide B-11 (b).
  Las despliega Claude con el conector de Supabase desde `main` (como en
  la Fase 8), con Verify JWT activado. Anota las versiones nuevas.
- Pages, como siempre (con `404.html`).
- Sin migración.

## CRITERIOS DE ACEPTACIÓN

1. **Reintento de subida:** simulando un fallo **después** de subir el
   audio, «Reintentar» guarda la nota sin volver a subir (sin error de
   «ya existe») y la nota se transcribe.
2. **Sin conexión:** con el modo avión o la red cortada en las
   herramientas del navegador, sale el aviso; la grabación sigue en
   pantalla y se guarda al volver la conexión. Salir con una grabación
   sin guardar pide confirmación.
3. **URL firmada:** al transcribir una nota, no hay una segunda petición
   de URL firmada (pestaña Red).
4. **Espera:** a los 10 s de una llamada lenta aparece «Puede tardar
   hasta un minuto.»
5. **B-1:** con un borrador del comprador que no pasa las reglas, la
   tarea «Confirmar día y hora: …» se crea igual.
6. **B-3:** tests con los cuatro casos de falso positivo (pasan) y sus
   contrapartes verdaderas (siguen rechazándose). Los tests que ya había
   siguen en verde.
7. **B-7:** una fila `pendiente` propia de hace más de 10 min pasa a
   `error` con «Sin respuesta (interrumpida)» al exportar de nuevo esa
   nota a ese destino; una de hace menos no se toca.
8. **B-8:** en Safari de iPhone, «Compartir ficha por WhatsApp» abre
   WhatsApp (o deja el enlace de respaldo), sin bloqueo silencioso.
9. **B-10 y B-12:** textos nuevos en pantalla.
10. **Móvil:** todas las pantallas del punto 6 a 360 px sin
    desbordamiento ni errores de consola; lo que no se pueda comprobar en
    un móvil real queda anotado para Luis con pasos concretos.
11. `npm test`, `npx tsc --noEmit`, `npm run build` (base `/` y
    `/inmo-visitas/`), `npm run lint` sin errores (2 avisos de shadcn
    aceptados), trozo JS ≤ 500 kB; `deno check` de las funciones que
    cambien si tienes Deno (si no, anótalo).
12. Prueba con **datos de sacrificio**, nunca con la nota de ejemplo de
    Ana.

## ENTREGA

Termina con el bloque HANDOFF FASE 9 en `docs/HANDOFF.md`, commit «Fase 9:
pulido, móvil y resiliencia», etiqueta `v0.9-fase-9` y push a `main`:

HANDOFF FASE 9
- Hecho: qué construiste realmente
- Migraciones (esperado: ninguna)
- Edge Functions cambiadas (pendientes de desplegar por Claude)
- Rutas/pantallas cambiadas
- Dependencias nuevas (esperado: ninguna de producción)
- Errores o warnings de build (tsc/lint/test/deno) y trozo JS mayor
- Resultado del repaso móvil (pantalla por pantalla) y lo que quedó sin
  comprobar
- Decisión aplicada en B-11
- Supuestos tomados y decisiones que quedan para Luis
- Cómo probarlo (pasos y URL, con datos de sacrificio)
