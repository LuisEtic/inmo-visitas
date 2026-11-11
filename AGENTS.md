# AGENTS.md — inmo-visitas

Normas del proyecto. Leer antes de tocar código, junto con
`docs/ESTADO.md` (fuente de verdad: fase en curso, decisiones y pendientes).

## Stack

- React 19 + Vite + TypeScript estricto + Tailwind CSS + shadcn/ui
- Supabase (`@supabase/supabase-js`): Auth + Postgres + Storage
- PWA con `vite-plugin-pwa`
- Zod para validación. Nada de `any`.

## Estructura

- `src/config/client.ts` — todo lo que cambia por cliente (nombre, logo,
  colores, CRM). Se lee de variables `VITE_*`. Nunca hardcodear datos de
  cliente en componentes.
- `src/integrations/crm/` — un adaptador por CRM y una interfaz común
  `CrmAdapter` (`src/integrations/crm/types.ts`). Añadir un CRM = añadir un
  adaptador, sin tocar el resto.
- SQL en `supabase/migrations/`, numerado (`0001_...`, `0002_...`). Nunca
  modificar una migración ya aplicada: los cambios van en una nueva.
- Edge Functions en `supabase/functions/` (una carpeta por función).
- Sistema de diseño Minimal-Mono: tokens en `src/index.css` (`@theme` de
  Tailwind). No introducir otros colores, fuentes ni radios fuera de los tokens.
- `docs/ESTADO.md` — estado del proyecto. `docs/HANDOFF.md` — un bloque por
  fase. `docs/prompts/PROMPT-FASE-N.md` — el prompt de cada fase (léelo
  entero antes de empezar la fase).

## Seguridad / secretos

- Nunca escribir claves reales. Crear `.env.example` y un `.gitignore` que
  excluya `.env`, `node_modules` y `dist`.
- Las claves de IA (Whisper, Gemini) solo viven en Edge Functions, nunca en
  el cliente.

## Fases

- Al acabar cada fase: `npm run build` y `tsc --noEmit` sin errores,
  añadir el bloque HANDOFF a `docs/HANDOFF.md`, commit `Fase N: …` con la
  etiqueta `v0.N-fase-N` y push a `main`.
- No pasar a la siguiente fase hasta que Luis lo pida.

## Estado

- El estado vivo está en `docs/ESTADO.md`. Resumen:
- Fase 1: fundación — modelo de datos + sistema de diseño. Cerrada
  (tag `v0.1-fase-1`). GitHub Pages es staging temporal (probar y demos);
  producción irá a Hostinger con Coolify. `VITE_BASE_PATH` configurable:
  la misma build sirve en `/` y en `/inmo-visitas/`.
- Fase 2: acceso e identidad de agentes + RLS por agente (tag
  `v0.2-fase-2`), cerrada (16/16) y revisada por Claude con ajustes
  (migración 0005).
- Fase 3 (siguiente, solo cuando Luis lo pida): CRUD de clientes e
  inmuebles + contacto. Prompt en `docs/prompts/PROMPT-FASE-3.md`.
- Captura es la Fase 4; lista de borradores, la Fase 6.
