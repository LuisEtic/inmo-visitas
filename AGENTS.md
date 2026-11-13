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
- Fase 3: CRUD de clientes e inmuebles + contacto (tag `v0.3-fase-3`),
  revisada por Claude con ajustes (altas por la UI arregladas).
- Fase 4: captura por voz y texto + transcripción (tag `v0.4-fase-4`,
  migración 0006, Edge Function `transcribe`), cerrada y revisada.
- Fase 5: extracción con evidencia + revisión y aprobación (tag
  `v0.5-fase-5`, migraciones 0007 y 0008, Edge Function `extract`),
  revisada por Claude con ajustes (0008: el estado de la nota solo avanza).
  Cerrada el 2026-11-12 (Pages desplegado y prueba rápida en vivo).
- Fase 6: borradores duales + bandeja de pendientes + lista de notas
  (tag `v0.6-fase-6`, migración 0009, Edge Function `drafts`), revisada
  por Claude con ajustes en las reglas de `drafts` (presupuesto, horas,
  nombres, citas, provisionales) y «Generar borrador». Cerrada el
  2026-11-12 (`drafts` v4 y Pages `1ecc966`).
- Fase 7: exportación al CRM y WhatsApp (tag `v0.7-fase-7`, migraciones
  0010 y 0011, Edge Function `crm-export`, formato propio y modo
  simulado), revisada por Claude con ajustes (0011: el insert no acepta
  campos de cierre del navegador; «Presupuesto declarado» sin repetir;
  «Exportada» al momento). Cerrada el 2026-11-13 (0011 aplicada,
  Pages `7ac0529`).
- Fase 8: seguridad, borrado y RGPD (tag `v0.8-fase-8`, migración
  0012, CORS configurable y límite diario de IA en las Edge Functions),
  revisada por Claude con ajustes (cola de audios, confirmación por
  nombre, descarga en iPhone). Pendiente de cerrar: Pages desde `main`
  y prueba de Luis en el móvil.
- Fase 9: pulido, móvil y resiliencia (tag `v0.9-fase-9`, sin
  migración), revisada por Claude con ajustes (B-8 con la ventana
  abierta sin `noopener`, subida con respuesta perdida, zonas táctiles
  del perfil). Última fase del MVP. Desplegada (`drafts` v14,
  `crm-export` v12, Pages `815af3f`). Pendiente: prueba de Luis en el
  móvil.
- Cada pantalla se prueba en el navegador, no solo por API.
