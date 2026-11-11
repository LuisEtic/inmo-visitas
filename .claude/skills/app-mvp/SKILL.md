---
name: "app-mvp"
description: "Guía paso a paso para llevar una idea de app desde cero hasta un MVP probado. Úsala cuando Luis lance una idea de app o retome una app en curso."
---

# app-mvp — De la idea al MVP probado

Método inspirado en la suite Vivir de IA (Roadmap Scoper + Generador de Prompts + sesiones de construcción por fases), adaptado al trabajo de Luis: un repositorio por app (que es la fuente de verdad), Claude Code como entorno de trabajo de Claude, construcción con Claude o con otra IA (Muse, Codex, Lovable) según su cupo, y revisión de cada fase por Claude.

Responde siempre en español de España, con tono profesional y cercano. Cuando cites fuentes externas, usa APA 7.

## Principios

1. **Una app = un repositorio, y el repositorio es la fuente de verdad.** Todo lo que Claude o el constructor necesitan vive dentro del repo: `docs/ESTADO.md`, `AGENTS.md`, `CLAUDE.md`, `docs/HANDOFF.md`, `docs/prompts/` y esta skill en `.claude/skills/app-mvp/`. Las apps nuevas se crean desde la plantilla `plantilla-app-mvp` (GitHub → *Use this template*). Un proyecto de Claude.ai es opcional para las Etapas 1–3 (ideación); a partir de que exista el repo, se trabaja en Claude Code y el proyecto de Claude.ai, si lo hubo, se archiva con una instrucción de una línea que apunta a `docs/ESTADO.md`.
2. **Documento de estado obligatorio.** Toda app tiene `docs/ESTADO.md` en su repositorio, que es la única fuente de verdad. Actualízalo al cerrar cada etapa y cada fase, en el mismo PR que la revisión. Si Luis aporta un ESTADO fuera del repo (adjunto o pegado), es la fuente de verdad solo hasta que se suba al repo.
3. **Etapas en orden, con puerta de salida.** No avances de etapa sin la aprobación explícita de Luis. Al empezar cada respuesta de trabajo, indica en una línea dónde estáis: «Etapa X · <nombre> — siguiente: <...>».
4. **Cupo primero.** Luis tiene Claude Pro (20 €/mes). Antes de cualquier tarea cara, estima su coste en porcentaje del cupo semanal y ofrece la alternativa barata (otra IA para construir, Sonnet en lugar de Opus, alcance más pequeño).
5. **Concreción sobre adjetivos.** Datos de ejemplo realistas, criterios verificables, esquemas exactos. Nada de «moderno» o «intuitivo» sin traducirlo a algo comprobable.
6. **La IA no decide lo jurídico ni lo irreversible.** Señala RGPD, privacidad y datos sensibles desde la Etapa 1.

## Modo de entrada

- **Idea nueva** («tengo una idea…»): empieza en la Etapa 1.
- **App en curso** («seguimos con…», un repositorio o un HANDOFF): lee `docs/ESTADO.md` del repositorio (con `git pull` antes), o pídelo si no existe. Si no hay estado, reconstrúyelo con lo que Luis aporte (PDF de la suite, prompts, repositorio, `docs/HANDOFF.md`), confírmalo con él y continúa en la etapa que corresponda.

---

## Etapa 1 — Idea y entrevista

**Objetivo:** convertir la idea en una ficha de MVP sin ambigüedades. Coste: bajo (<2 % del cupo semanal).

Haz **una sola ronda** de preguntas, en bloque, preferiblemente con la herramienta de preguntas: como máximo 4 preguntas con opciones, y el resto en texto. Si algo no es crítico, propón un valor razonable en lugar de preguntarlo.

**Contexto** (equivale al Roadmap Scoper):

- Tipo de producto: Landing/web corporativa · E-commerce · SaaS simple (con login) · SaaS completo (con pagos) · Marketplace multi-rol · App móvil (PWA) · Plataforma de reservas · Herramienta interna · Otro.
- Cliente ideal (ICP) y usuarios reales de la app.
- Sector o nicho · Plataforma (web, móvil, ambas) · País e idioma.
- Para quién es: uso propio, un cliente concreto o producto vendible a varios clientes (marca blanca).

**Ficha del MVP** (el formato de la ficha de idea de la suite):

- **Promesa:** una frase con el resultado que obtiene el usuario.
- **Flujo:** 5–8 pasos que hace el usuario.
- **Ejemplo ficticio con salida esperada:** un caso real escrito y lo que la app debe producir, y también lo que NO debe hacer.
- **MVP:** pantallas (máximo 3–4) e inclusiones.
- **Exclusiones explícitas.**
- **Dónde está la IA y dónde mandan las reglas.**
- **Validación:** 3–5 métricas del piloto (tiempo, correcciones, errores, uso voluntario…).
- **Datos sensibles y riesgos legales** detectados.

**Entrega:** la ficha en un doc. **Puerta:** Luis confirma la ficha.

---

## Etapa 2 — Roadmap y validación

**Objetivo:** decidir si merece la pena y qué entra en el MVP. Coste: bajo-medio (2–4 %).

Genera el informe con esta estructura, que es el esquema del Roadmap Scoper:

1. **Score de viabilidad /100**, suma de 4 dimensiones de 0 a 25 con una justificación cada una: Mercado · Diferenciación · Ejecución · Monetización. Para una herramienta interna: Utilidad interna · Tiempo ahorrado · Implantación · Coste/retorno.
2. **Veredicto:** Adelante (≥65) · Pivotar (40–64) · Descartar (<40), con su razón.
3. **Qué funciona · Qué preocupa · Decisiones críticas antes de construir** (numeradas).
4. **Features** en tres columnas: Imprescindible / Deseable / Futuro. Cada una con horas, complejidad (Baja/Media/Alta) y categoría. El MVP = Imprescindibles.
5. **Fases** (2–4 macrofases con semanas y entregables).
6. **Stack** por defecto: React + Vite + TypeScript estricto + Tailwind + shadcn/ui + Supabase (Auth, Postgres, Storage, Edge Functions) + Zod; PWA si es móvil; claves de IA solo en Edge Functions. Justifica cualquier cambio.
7. **Riesgos** (Alto/Medio/Bajo + mitigación).
8. **Horas totales y horquilla de precio** orientativa (EUR).

**Entrega:** doc «Roadmap — <App>». **Puerta:** veredicto aceptado y lista de Imprescindibles cerrada.

---

## Etapa 3 — Plan de fases y prompt troncal

**Objetivo:** dividir el MVP en fases construibles y escribir el prompt de la Fase 1. Coste: medio (3–6 %).

### 3.1 Roadmap de fases

Entre 5 y 9 fases. Cada una con este formato:

```
FASE N — <Título>
Objetivo: <una frase>
Alcance: <lo que se construye, concreto>
Fuera de alcance: <lo que NO se toca>
Handoff esperado: <pruebas verificables + "build verde">
```

Orden recomendado: 1 Fundación (modelo de datos completo + sistema de diseño + seed) → 2 Acceso/identidad (Auth **y RLS básica por usuario**) → 3 CRUD núcleo → 4–6 Funcionalidad principal / IA → 7 Integraciones → 8 Seguridad completa (RLS en todas las tablas + prueba negativa + RGPD) → 9 Pulido (PWA, estados vacíos, offline, accesibilidad).

Mejora sobre la suite: no dejes las tablas abiertas hasta la Fase 8 si se va a usar con datos reales. Como mínimo, activa RLS en la fase de Auth.

### 3.2 Reglas del proyecto (`AGENTS.md`)

Genéralas siempre junto a la Fase 1:

```markdown
# AGENTS.md — <app>
## Stack
<stack de la Etapa 2>
## Estructura
- src/config/client.ts -> todo lo que cambia por cliente, leído de variables VITE_* (marca blanca)
- src/integrations/<tipo>/ -> un adaptador por proveedor externo con interfaz común
- supabase/migrations/ (SQL numerado) · supabase/functions/ (Edge Functions; las claves solo aquí)
- docs/HANDOFF.md -> un bloque HANDOFF por fase, en orden
- docs/ESTADO.md -> fuente de verdad del proyecto (leer antes de empezar)
- docs/prompts/ -> un prompt por fase (PROMPT-FASE-N.md), versionado
## Normas
- Nunca claves reales; .env.example y .gitignore (excluye .env, node_modules, dist)
- Ruta base configurable (VITE_BASE_PATH, por defecto /); fuentes autoalojadas (sin Google Fonts, RGPD)
- Al acabar cada fase: build y tsc sin errores, HANDOFF en docs/HANDOFF.md, commit "Fase N: ..." + tag v0.N-fase-N + push a main
- No pasar a la siguiente fase sin permiso de Luis
```

### 3.3 Plantilla de prompt de fase

```
FASE N DE M — <TÍTULO EN MAYÚSCULAS>

CONTEXTO DE LA APP
<2–3 frases: qué es, para quién, stack>

ESTADO ACTUAL
<Fase 1: "proyecto nuevo". Fases siguientes: resumen del HANDOFF anterior + ajustes posteriores (PRs de revisión). Pide primero `git pull`.>

ALCANCE DE ESTA FASE
<lista concreta>

QUÉ NO TOCAR
<lista concreta; repite lo fuera de alcance>

ESPECIFICACIÓN (crear exactamente así)
<tablas con tipos y constraints, pantallas con sus elementos, reglas de negocio, datos de ejemplo realistas>

CRITERIOS DE ACEPTACIÓN
1. <verificable>  2. ...  N. Build y tsc sin errores.

ENTREGA
Termina con el bloque HANDOFF FASE N:
- Hecho: qué construiste realmente
- Tablas/columnas/políticas creadas o cambiadas (exactas)
- RLS / Edge Functions / server functions activas
- Rutas/pantallas nuevas
- Errores o warnings de build (tsc/lint)
- Supuestos tomados o pendientes
- Cómo probarlo (pasos y URL)
```

Escribe solo el prompt troncal de la **Fase 1** completo. Los prompts de las fases siguientes se generan **después** de revisar el HANDOFF real de la fase anterior (Etapa 5), igual que en las «sesiones de construcción» de la suite.

**Entrega:** doc «Plan de fases — <App>» con el roadmap de fases, `AGENTS.md` y el prompt de la Fase 1. **Puerta:** Luis aprueba el plan.

---

## Etapa 4 — Decidir quién construye y preparar el repositorio

**Objetivo:** elegir el constructor según el cupo y dejar listo el flujo de GitHub.

**Estimación orientativa en Claude Pro** (Opus 5.5, esfuerzo medio), para un MVP de unas 9 fases:

| Quién construye | Cupo semanal aproximado |
| --- | --- |
| Construir todo con Claude | 150–250 % (2–3 semanas) |
| Claude solo revisa y corrige | 30–60 % |
| Revisar una fase suelta | 3–6 % |

Recomendación por defecto: **otra IA construye y Claude revisa cada fase**. Usa Claude para construir solo fases pequeñas o delicadas (seguridad, IA) si hay cupo.

**Entorno de Claude: Claude Code** (escritorio o web). Claude clona el repositorio, ejecuta build, lint y migraciones de verdad, y abre los PR él mismo. Los chats de Claude.ai ya no se usan para revisar fases.

**Flujo de GitHub para Luis** (sin terminal):

1. github.com → repositorio `plantilla-app-mvp` → **Use this template** → **Create a new repository** → privado. Trae `CLAUDE.md`, `AGENTS.md`, `docs/ESTADO.md`, `docs/HANDOFF.md`, `docs/prompts/` y esta skill.
2. Rellenar `docs/ESTADO.md` y `AGENTS.md` con la ficha y el plan de las Etapas 1–3 (Claude lo hace en la primera sesión de Claude Code, con un PR).
3. **Acceso de Claude:** la app de Claude instalada en GitHub (github.com/apps/claude → Install → Only select repositories → añadir el repo nuevo). Autorizarla no basta: hay que instalarla.
4. Si construye otra IA: token *fine-grained* (Settings → Developer settings → Personal access tokens → Fine-grained → solo ese repositorio, **Contents: Read and write**, caducidad de 30 días). Se pasa al constructor solo cuando pida hacer el push, y se revoca al terminar. Si es Lovable: activar su sincronización con GitHub.

**Staging y producción:**

- **Staging:** Coolify en el VPS de Hostinger con despliegue automático desde `main` y **preview por PR** (cada PR de revisión tiene su URL para probar antes de aprobarlo). El repo puede seguir privado.
- **GitHub Pages** solo como staging temporal mientras no haya Coolify: obliga a repo público y a `VITE_BASE_PATH=/<repo>/`. Pasar a Coolify como tarde antes de enseñar la app a clientes reales.
- **Producción:** Coolify con dominio propio (`VITE_BASE_PATH=/`) y Supabase en región UE, un proyecto por cliente.

**Mensaje de arranque para el constructor:** «Empieza la Fase 1 con Git. El repositorio vive en <URL>; pídeme el token al hacer push. Antes de nada, lee `AGENTS.md` y `docs/ESTADO.md`. El prompt de la fase está en `docs/prompts/PROMPT-FASE-1.md`.»

---

## Etapa 5 — Bucle por fase: revisar → corregir → siguiente prompt

Repite este bucle en cada fase. Coste por fase: 3–6 %, más las correcciones.

1. Luis avisa: «Fase N terminada» (repositorio o HANDOFF). Claude trabaja en Claude Code sobre el repositorio: `git pull` y lee `docs/ESTADO.md`.
2. **Revisión de Claude**, limitada a esa fase (`git diff` entre la etiqueta anterior y HEAD):
   - clonar y ejecutar `npm ci`, `tsc`, `build` y `lint`;
   - ejecutar las migraciones en un PostgreSQL temporal (con un esquema `auth` de prueba si hace falta);
   - comparar la especificación del prompt con lo que se ha construido y con el HANDOFF;
   - seguridad: claves, RLS, datos sensibles, rutas expuestas;
   - desviaciones del constructor (cosas no pedidas).
3. **Informe breve:** Lo que funciona (tabla) · Lo que conviene corregir (Importante / Mejora) · Consumo estimado. Pregunta si quiere un PR.
4. Si lo quiere: rama `claude/fase-N-ajustes` (o la rama que asigne la sesión de Claude Code), cambios verificados, nota en `docs/HANDOFF.md`, commit y PR (si `gh pr create` falla, usa `gh api repos/<owner>/<repo>/pulls`). Explica a Luis cómo aprobarlo: pestaña Pull requests → Conversation → **Merge pull request**. Si hay Coolify, indica la URL de preview del PR para probarlo antes.
5. **Prompt de la Fase N+1**, con la plantilla 3.3, guardado en `docs/prompts/PROMPT-FASE-<N+1>.md` dentro del mismo PR. Su «ESTADO ACTUAL» incluye el HANDOFF real y los ajustes del PR, y la instrucción de hacer `git pull` primero.
6. Actualiza `docs/ESTADO.md` en el mismo PR (fase cerrada, decisiones, pendientes, consumo).

---

## Etapa 6 — Cierre del MVP

**Checklist «listo para probar»:**

- [ ] Todas las fases del MVP cerradas, con build en verde.
- [ ] RLS activa con prueba negativa (un usuario no ve los datos de otro).
- [ ] Sin claves en el repositorio; secretos en Supabase.
- [ ] Desplegado en un entorno de pruebas: Supabase de prueba (región UE) + Coolify en el VPS de Hostinger con subdominio (y preview por PR).
- [ ] Ejemplo ficticio de la Etapa 1 reproducido de principio a fin.

**Plan de piloto:** 3–5 usuarios reales durante 1–2 semanas, midiendo las métricas de la ficha, con una hoja sencilla de registro y una entrevista de cierre.

**Salida:** actualiza `docs/ESTADO.md` a «MVP en piloto» y recomienda pasar a la skill **app-validar-y-vender** cuando haya resultados del piloto.

---

## Plantilla `docs/ESTADO.md`

```markdown
# ESTADO — <App>
Última actualización: <fecha>
Etapa actual: <n · nombre>   ·   Fase de construcción: <N de M>
Constructor: <Claude / Muse / Codex / Lovable>   ·   Repo: <URL>
Staging: <URL de Coolify / Pages>   ·   Producción: <URL>

## Ficha (resumen)
Promesa · ICP · tipo de producto · exclusiones clave

## Decisiones tomadas
- <fecha> — <decisión> — <motivo>

## Fases
| Fase | Estado | Tag | Revisión Claude | PR |
|---|---|---|---|---|

## Pendientes y riesgos abiertos
- ...

## Consumo
- Claude: <% cupo semanal por etapa/fase>  ·  Constructor: <tokens por fase>
```