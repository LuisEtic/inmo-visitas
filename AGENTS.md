# AGENTS.md — inmo-visitas

Normas del proyecto. Leer antes de tocar código.

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
- SQL en `supabase/migrations/`, numerado (`0001_...`, `0002_...`).
- Edge Functions en `supabase/functions/` (una carpeta por función).
- Sistema de diseño Minimal-Mono: tokens en `src/index.css` (`@theme` de
  Tailwind). No introducir otros colores, fuentes ni radios fuera de los tokens.

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

- Fase 1 (esta): fundación — modelo de datos + sistema de diseño.
  Sin autenticación, sin RLS (planificada para la Fase 8), sin CRUD
  interactivo, sin IA ni grabación de audio, sin Edge Functions.
