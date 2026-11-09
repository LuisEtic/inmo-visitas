-- Fase 1 — Fundación: modelo de datos + sistema de diseño (Minimal-Mono)
-- 8 tablas del dominio. Sin RLS todavía: las políticas se activan en la
-- Fase 8. En esta fase las tablas quedan accesibles sin restricción,
-- de forma intencional y temporal.

-- agents: el agente es un usuario de Supabase Auth.
create table public.agents (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  is_temporary boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete set null,
  reference text not null unique,
  address text not null,
  city text not null default 'Madrid',
  price numeric(12, 2) not null,
  owner_name text not null,
  owner_phone text,
  status text not null default 'disponible'
    check (status in ('disponible', 'reservado', 'vendido')),
  created_at timestamptz not null default now()
);

create table public.visit_notes (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.agents (id) on delete set null,
  client_id uuid references public.clients (id) on delete restrict,
  property_id uuid references public.properties (id) on delete restrict,
  input_type text not null check (input_type in ('audio', 'text')),
  audio_url text,
  raw_text text,
  transcript text,
  status text not null default 'draft'
    check (status in ('draft', 'transcribed', 'extracted', 'reviewed', 'approved')),
  created_at timestamptz not null default now()
);

create table public.extracted_facts (
  id uuid primary key default gen_random_uuid(),
  visit_note_id uuid references public.visit_notes (id) on delete cascade,
  category text not null check (category in (
    'hecho_declarado', 'observacion', 'desconocido',
    'objecion', 'presupuesto', 'cita_pendiente'
  )),
  field_name text not null,
  value text not null,
  evidence_quote text,
  confidence numeric(3, 2),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  visit_note_id uuid references public.visit_notes (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  description text not null,
  due_date date,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'completada')),
  created_at timestamptz not null default now()
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  visit_note_id uuid references public.visit_notes (id) on delete cascade,
  audience text not null check (audience in ('comprador', 'propietario')),
  content text not null,
  is_sensitive_filtered boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.crm_exports (
  id uuid primary key default gen_random_uuid(),
  visit_note_id uuid references public.visit_notes (id) on delete cascade,
  target text not null check (target in ('inmovilla', 'witei', 'whatsapp', 'manual')),
  payload jsonb,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'enviado', 'error')),
  exported_at timestamptz,
  created_at timestamptz not null default now()
);
