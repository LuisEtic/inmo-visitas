# CLAUDE.md — inmo-visitas

Instrucciones para Claude Code. Las normas del proyecto están en `AGENTS.md`
(se importan aquí) y valen igual para cualquier constructor.

@AGENTS.md

## Antes de empezar cualquier sesión

1. `git pull` y lee `docs/ESTADO.md`: es la única fuente de verdad (etapa,
   fase en curso, decisiones, pendientes, consumo).
2. Usa la skill `app-mvp` (`.claude/skills/app-mvp/SKILL.md`). Este proyecto
   está en la **Etapa 5 · Bucle por fase**.
3. Indica en la primera línea de cada respuesta de trabajo dónde estáis:
   «Etapa X · <nombre> — siguiente: <...>».

## Papel de Claude en este repo

- Revisar cada fase que entrega el constructor (Muse): `npm ci`, `tsc`,
  `build`, `lint`, migraciones en PostgreSQL temporal con esquema `auth`
  simulado, prueba negativa de RLS y comparación con el prompt de la fase y
  el HANDOFF.
- Proponer ajustes en un PR (nunca push directo a `main`), con nota en
  `docs/HANDOFF.md`.
- Escribir el prompt de la fase siguiente en `docs/prompts/PROMPT-FASE-N.md`
  y actualizar `docs/ESTADO.md` en el mismo PR.
- No pasar a construir la fase siguiente sin que Luis lo pida.

## Datos y privacidad

- Repositorio público mientras el staging sea GitHub Pages: no subir datos
  personales reales, claves ni `.env`. Solo la URL y la clave anon de
  Supabase en el `.env` local; nunca `service_role`.
- Las claves de IA (Whisper, Gemini) solo en Edge Functions.
