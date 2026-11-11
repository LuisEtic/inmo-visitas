# ESTADO — Inmo Visitas (piloto de la skill app-mvp)
Última actualización: 2026-11-11 (revisión de la Fase 2 + migración a Claude Code, en Claude Code)
Etapa actual: 5 · Bucle por fase   ·   Fase de construcción: 2 de 9 cerrada (16/16, revisada) · Fase 3 con prompt listo, empieza al aprobar el PR #2
Constructor: Muse (chat, Git en su espacio → GitHub)   ·   Repo: https://github.com/LuisEtic/inmo-visitas (PÚBLICO, necesario para GitHub Pages gratis)
Staging actual: https://luisetic.github.io/inmo-visitas/ (rama `gh-pages`, despliegue manual de Muse)   ·   Producción: Hostinger VPS + Coolify
Entorno de trabajo de Claude: **Claude Code** desde la revisión de la Fase 2. Este archivo (`docs/ESTADO.md` en el repo) es la fuente de verdad; el proyecto de Claude.ai «APP INMO VISITAS» se archiva tras el PR de migración.

## Ficha (resumen)
- **Promesa:** «Al terminar una visita, dicta lo ocurrido. Revisa la ficha, deja la siguiente acción preparada y genera el seguimiento sin redactarlo todo de nuevo.»
- **ICP:** agentes inmobiliarios en España. Tipo: Demo/MVP, PWA móvil. Idioma: español de España.
- **Flujo:** seleccionar cliente e inmueble → dictar o escribir una nota propia (sin grabar al cliente por defecto) → transcribir y extraer campos → ver la evidencia del dictado junto a cada dato → separar hechos declarados, observaciones y desconocidos → revisar y aprobar → preparar tarea y borradores distintos para comprador y propietario → guardar o transferir.
- **Ejemplo ficticio:** «Ana ha visitado V-18… le preocupa el ruido… quiere volver el viernes, falta la hora… presupuesto 230.000 €… pide gastos». Salida esperada: objeción de ruido, segunda visita pendiente de confirmar, presupuesto declarado y tarea de preparar gastos. NO confirmar la cita ni tratar el presupuesto como solvencia acreditada. El borrador al propietario NO revela presupuesto ni finanzas del comprador.
- **MVP:** 3 pantallas (Capturar, Revisar, Pendientes); texto y audio, extracción, edición, tareas, borradores y registro de aprobación.
- **Exclusiones:** envío automático, llamadas, identificación ambigua de personas, CRM nuevo, app nativa, decisiones jurídicas.
- **IA:** transcripción (Whisper), extracción estructurada y borradores (Gemini 2.5 Flash), siempre desde Edge Functions. Las reglas controlan referencias, estados, permisos y aprobaciones.
- **Validación (piloto):** tiempo total por registro, correcciones, campos importantes, tareas omitidas y uso voluntario.
- **Datos sensibles:** audios y notas con datos personales y económicos de compradores y propietarios (RGPD).

## Decisiones tomadas
- 2026-11-09 — Construye Muse y Claude revisa por fases — cupo de Claude Pro insuficiente para construirlo todo.
- 2026-11-09 — Supabase en la nube (UE), un proyecto por cliente; producción en Hostinger VPS con Coolify — menos mantenimiento.
- 2026-11-09 — Comercialización con una instalación por cliente (marca blanca) — datos aislados por agencia.
- 2026-11-09 — Ruta base configurable (`VITE_BASE_PATH`, por defecto `/`) y fuentes autoalojadas (PR #1) — la misma build sirve para Pages (`/inmo-visitas/`) y para Coolify (`/`).
- 2026-11-09 — GitHub Pages como **staging temporal** (probar cada fase y enseñar demos); repo público por ese motivo. *Corrige la entrada anterior «Sin GitHub Pages», que era errónea.*
- 2026-11-10 — RLS básica por agente adelantada a la Fase 2 (la Fase 8 la completa: Storage, Edge Functions con agent_id del JWT, RGPD). Confirmada por Luis ante Muse el 2026-11-11.
- 2026-11-10 — Proyecto de Claude propio «APP INMO VISITAS», con un chat por fase.
- 2026-11-11 — Se descarta la «Captura como Fase 2» que propuso Muse (no conocía el roadmap). Se mantiene el roadmap de la suite: Captura = Fase 4. Las decisiones de Muse «audio sí» y «lista de borradores» pasan a las Fases 4 y 6.
- 2026-11-11 — Fase 2 = PROMPT-FASE-2-CORREGIDO.md de Muse + addendum de Claude: fallback `404.html` en Pages; Supabase de pruebas en UE; `emailRedirectTo` = origin + BASE_URL en signInWithOtp/signUp; límite de 2 emails/h del SMTP por defecto (confirmación desactivada o SMTP propio en pruebas); `tasks` y update de `visit_notes` con comprobación de pertenencia; prompts versionados en `docs/prompts/` con cabecera actualizada.
- 2026-11-11 — Supabase de pruebas creado por Luis.
- 2026-11-11 — **Aprobada la migración del sistema a Claude Code.** Se hará junto con la revisión de la Fase 2 (no antes).
- 2026-11-11 — Revisión de la Fase 2 en Claude Code: OK. Ajustes aprobados por Luis (puntos 2, 4, 5, 6 y 7): migración 0005 (`properties.reference` única por agente, `agents.email` de solo lectura en la base, `visit_notes.client_id`/`property_id` not null, reclamo de demo de una sola vez) y code-splitting. Se mantienen los emails de prueba en el HANDOFF mientras duren las pruebas.
- 2026-11-11 — Fase 2 cerrada: enlace mágico verificado en la web viva (16/16).
- 2026-11-11 — Una nota de visita siempre lleva cliente e inmueble; si en la captura no se conoce al cliente, se crea uno provisional (`is_temporary`).
- 2026-11-11 — Fase 3 sin migración nueva: CRUD sobre el esquema actual.
- 2026-11-11 — «Contacto» en la Fase 3 (decidido por Claude a petición de Luis, tras la pregunta de Muse): validación y normalización al guardar en el frontend (teléfono `+34…`, email en minúsculas), sin restricción en la base hasta la Fase 8; botones «Llamar» (`tel:`), «WhatsApp» (solo abre el chat con `wa.me`, sin texto) y «Email» (`mailto:`), cada uno solo si hay dato. Motivo: en el trabajo diario el agente contacta a propietarios y compradores por teléfono y WhatsApp; un formato único evita duplicados y prepara la Fase 4 (búsqueda por teléfono) y la 7 (CRM). Enviar borradores por WhatsApp sigue siendo la Fase 7.

## Migración a Claude Code (ejecutada el 2026-11-11, salvo los pasos marcados para Luis)
1. ✅ Repo `plantilla-app-mvp` creado por Luis (privado). ⬜ **Luis:** marcarlo como *Template repository* (Settings → General → casilla «Template repository»).
2. ✅ Plantilla rellenada (push inicial a `main`): `CLAUDE.md`, `AGENTS.md`, `.claude/skills/app-mvp/SKILL.md`, `docs/ESTADO.md`, `docs/HANDOFF.md`, `docs/prompts/` (con la plantilla de prompt de fase), en versión genérica.
3. ✅ PR en `inmo-visitas`: este ESTADO en `docs/ESTADO.md`, `CLAUDE.md`, `.claude/skills/app-mvp/`, `AGENTS.md` y el prompt de la Fase 3. Va en el mismo PR que los ajustes de la Fase 2, pero en un commit aparte (solo docs y `.claude/`).
4. ✅ Skill app-mvp actualizada en `.claude/skills/app-mvp/SKILL.md`: principio 1 (repo como fuente de verdad), Etapa 4 (Claude Code) y staging (Pages temporal → Coolify con preview por PR). ⬜ **Luis:** sustituir la skill app-mvp de su cuenta de Claude (ajustes de skills de claude.ai) por esa versión: la de la cuenta sigue siendo la antigua. En este repo, Claude Code ya usa la nueva.
5. ⬜ **Luis:** archivar el proyecto de Claude.ai: renombrarlo a «APP INMO VISITAS (archivo)» y dejar como instrucciones: «Proyecto archivado. La fuente de verdad es docs/ESTADO.md en github.com/LuisEtic/inmo-visitas; se trabaja en Claude Code.»

## Fases
| Fase | Título | Estado | Tag | Revisión Claude | PR |
|---|---|---|---|---|---|
| 1 | Fundación: modelo de datos + diseño minimal-mono | Cerrada (desplegada en Pages, commit b075d2e) | v0.1-fase-1 | OK: esquema verificado en PostgreSQL, build verde | #1 aprobado |
| 2 | Acceso / identidad de agentes + RLS por agente | Cerrada: 16/16, enlace mágico verificado en Pages el 11 nov. (commit 5abb997) | v0.2-fase-2 | OK con ajustes (11 nov., Claude Code): migraciones en PostgreSQL 16 por los dos caminos, prueba negativa de RLS, navegador en `/` y `/inmo-visitas/` | #2 (ajustes + migración, fusionado) |
| 3 | CRUD clientes, inmuebles y contacto | Prompt listo (`docs/prompts/PROMPT-FASE-3.md`, con la decisión de contacto); empieza cuando Luis lo pida | — | — | — |
| 4 | Captura: voz PWA (audio sí) + texto + transcripción | Pendiente | — | — | — |
| 5 | Extracción con evidencia + revisión/aprobación | Pendiente | — | — | — |
| 6 | Borradores duales + bandeja de pendientes (incluye lista de notas guardadas) | Pendiente | — | — | — |
| 7 | Exportación CRM y WhatsApp | Pendiente | — | — | — |
| 8 | Seguridad: completar RLS (Storage, Edge Functions), hardening + RGPD | Pendiente | — | — | — |
| 9 | Pulido: PWA, móvil y resiliencia | Pendiente | — | — | — |

## Revisión prevista de la Fase 2 (cuando Muse entregue)
*Hecha el 2026-11-11: todo OK. Enlace mágico verificado por Luis en Pages (~13:42, commit 5abb997); en local no se repitió, se acepta porque es el mismo código con `emailRedirectTo` = origin + base. Detalle en `docs/HANDOFF.md` → «Ajustes post-Fase 2».*
- `git diff v0.1-fase-1..HEAD`; `npm ci`, `tsc`, `build`, `lint`.
- Migraciones 0003+0004 sobre 0001+0002 en PostgreSQL temporal con esquema `auth` simulado; y el SQL concatenado en base vacía.
- RLS: `agent_id = auth.uid()`; insert/update de `visit_notes` exige cliente e inmueble del mismo agente; `tasks` con `visit_note_id` nulo o del mismo agente; tablas hijas vía `visit_notes`.
- Prueba negativa: agente B y anónimo no leen ni editan filas del agente A.
- Router con `basename` = `import.meta.env.BASE_URL`; `404.html` en `gh-pages`; `emailRedirectTo` en signInWithOtp/signUp; magic link en localhost y en Pages.
- Mensaje «Revisa tu correo» en /registro si la confirmación está activa.
- Sin claves en el repo (`.env` ignorado; solo URL y clave anon, nunca `service_role`).
- `docs/prompts/` con los dos prompts y cabecera actualizada.

## Pendientes y riesgos abiertos
- Repo público: el código de un producto marca blanca queda visible. Pasar staging a Coolify (auto-deploy + preview por PR) y volver a privado como tarde antes de enseñarlo a clientes reales o antes de la Fase 8.
- **Aplicar la 0005 en el Supabase de pruebas** (Luis, SQL Editor: pegar solo `supabase/migrations/0005_ajustes_revision_fase_2.sql`) tras aprobar el PR y antes de la Fase 3.
- Emails de prueba en `docs/HANDOFF.md` (repo público): quitarlos al terminar las pruebas de la Fase 2. Seguirán en el historial de Git salvo que se reescriba.
- Reclamo de datos de demo (`demo_seed_claim` + bloque del trigger de alta): eliminar antes de producción.
- Plan Free de Supabase: el proyecto se pausa tras 1 semana sin actividad, no hay copias automáticas y el SMTP por defecto envía 2 emails/h (SMTP propio antes del piloto).
- Revocar el token de GitHub de Muse al terminar el proyecto.
- Acceso real a las API de Inmovilla y Witei sin confirmar (la Fase 7 simula el webhook).
- Lección de proceso: Muse no tenía el roadmap ni ESTADO.md → propuso fases por su cuenta. Solución: ESTADO y prompts dentro del repo (migración aprobada).

## Consumo
- Claude: revisión de la Fase 1 + PR #1 ≈ 3–5 %. Chats de entorno, alineación y revisión del prompt corregido (10–11 nov.) ≈ 3–4 %. Revisión de la Fase 2 + ajustes + migración + prompt de la Fase 3 (11 nov., Claude Code) ≈ 9–12 % (por encima de lo previsto, por las pruebas en PostgreSQL y en navegador y la plantilla).
- Muse: Fase 1 ≈ 0,5–1 % de su cupo semanal (reinicio: 12 nov., 15:22). Previsión de las 9 fases: ~10–20 %.
