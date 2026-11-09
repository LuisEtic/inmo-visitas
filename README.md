# Inmo Visitas

App PWA para agentes inmobiliarios en España: capturar notas de visita
por voz o texto, transcribirlas y extraer datos estructurados con
evidencia, para generar tareas y borradores diferenciados para comprador
y propietario.

## Stack

React 19 + Vite + TypeScript estricto + Tailwind CSS + shadcn/ui,
Supabase (Auth + Postgres + Storage), PWA con `vite-plugin-pwa`, Zod.
Nada de `any`. Normas completas en `AGENTS.md`.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # rellenar con los valores reales de Supabase
npm run dev
```

La única pantalla de la Fase 1 es el showcase del sistema de diseño:

```
http://localhost:5173/design-system
```

## Base de datos

Migraciones numeradas en `supabase/migrations/`:

- `0001_initial_schema.sql` — 8 tablas del dominio.
- `0002_seed_demo.sql` — 8 propiedades y 6 clientes de demostración.

Sin RLS todavía: planificada para la Fase 8. En esta fase las tablas
quedan accesibles sin restricción, de forma intencional y temporal.

## Fases

- **Fase 1** (esta): fundación — modelo de datos + sistema de diseño
  Minimal-Mono. Sin auth, sin CRUD, sin IA ni audio, sin Edge Functions.
- Fases 2–9: solo cuando Luis lo pida. Ver `docs/HANDOFF.md`.

## Comandos

```bash
npm run build   # tsc + vite build
npx tsc --noEmit
```
