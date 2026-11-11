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
- `0003_auth_agents_trigger.sql` — alta automática del agente (trigger).
- `0004_rls_por_agente.sql` — RLS por agente en las 8 tablas.
- `0005_ajustes_revision_fase_2.sql` — referencia única por agente, email
  de solo lectura, nota siempre con cliente e inmueble, reclamo de demo
  de una sola vez.

RLS activa desde la Fase 2: cada agente solo ve y modifica lo suyo. La
Fase 8 la completa (Storage, Edge Functions, RGPD).

## Fases

- **Fase 1**: fundación — modelo de datos + sistema de diseño
  Minimal-Mono. Sin auth, sin CRUD, sin IA ni audio, sin Edge Functions.
- **Fase 2** (esta): acceso e identidad de agentes + RLS por agente.
  Sin CRUD de clientes/inmuebles, sin captura, sin IA ni Edge Functions.
- Fases 3–9: solo cuando Luis lo pida. Captura es la Fase 4. Ver `docs/HANDOFF.md`.

## Comandos

```bash
npm run build   # tsc + vite build
npx tsc --noEmit
```
