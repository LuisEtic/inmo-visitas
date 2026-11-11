-- Inmo Visitas — SQL completo hasta la Fase 2 (migraciones 0001 a 0004).
-- SOLO PARA UN PROYECTO SUPABASE NUEVO Y VACÍO: pega este archivo de una
-- vez en el SQL Editor (región UE: Frankfurt o Irlanda).
-- Si el proyecto ya tiene aplicadas 0001 y 0002, NO pegues este archivo
-- (fallaría por tablas duplicadas): aplica solo 0003 y 0004.
-- Después: Authentication → URL Configuration → Site URL =
-- http://localhost:5173 y añade https://luisetic.github.io/inmo-visitas/
-- en Redirect URLs, para que el enlace mágico funcione en local y en Pages.


-- ============================================================
-- supabase/migrations/0001_initial_schema.sql
-- ============================================================
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

-- ============================================================
-- supabase/migrations/0002_seed_demo.sql
-- ============================================================
-- Fase 1 — Seed de demostración.
-- agent_id = NULL en todas las filas por ahora (no hay Auth real en esta fase).

insert into public.properties
  (reference, address, city, price, owner_name, owner_phone, status)
values
  ('V-18', 'Calle de Alcalá 120', 'Madrid', 230000.00, 'Carlos Ruiz', '+34 611 100 200', 'disponible'),
  ('V-22', 'Calle Serrano 45', 'Madrid', 450000.00, 'Marta Gómez', '+34 611 100 201', 'disponible'),
  ('V-07', 'Calle Goya 88', 'Madrid', 310000.00, 'Javier López', '+34 611 100 202', 'reservado'),
  ('V-31', 'Avenida de América 15', 'Madrid', 275000.00, 'Lucía Fernández', '+34 611 100 203', 'disponible'),
  ('V-12', 'Calle Bravo Murillo 200', 'Madrid', 195000.00, 'Antonio Sánchez', '+34 611 100 204', 'vendido'),
  ('V-45', 'Paseo de la Castellana 300', 'Madrid', 620000.00, 'Elena Torres', '+34 611 100 205', 'disponible'),
  ('V-09', 'Calle Toledo 55', 'Madrid', 215000.00, 'Miguel Ángel Díaz', '+34 611 100 206', 'disponible'),
  ('V-27', 'Calle Princesa 33', 'Madrid', 340000.00, 'Sofía Martín', '+34 611 100 207', 'reservado');

insert into public.clients (full_name, phone, email, is_temporary)
values
  ('Ana García', '+34 612 345 678', 'ana.garcia@gmail.com', false),
  ('Pedro Molina', '+34 655 123 456', 'pedro.molina@hotmail.com', false),
  ('Laura Ortiz', '+34 699 876 543', 'laura.ortiz@yahoo.es', false),
  ('David Romero', '+34 611 222 333', null, false),
  ('Carmen Ibáñez', '+34 622 333 444', 'carmen.ibanez@gmail.com', false),
  ('Jorge Navarro', '+34 633 444 555', null, true);

-- ============================================================
-- supabase/migrations/0003_auth_agents_trigger.sql
-- ============================================================
-- Fase 2 — Acceso e identidad de agentes.
-- Al registrarse un usuario en Supabase Auth, el trigger crea su fila en
-- public.agents. La misma función reclama las filas seed sin dueño
-- (agent_id NULL) solo para el primer agente que se registre.

-- Función que crea la fila del agente al insertar en auth.users.
create or replace function public.handle_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_count integer;
begin
  insert into public.agents (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  -- SOLO DEMO — ELIMINAR ANTES DE PRODUCCIÓN: el primer agente que se
  -- registra reclama las filas seed sin dueño (agent_id NULL) para poder
  -- probar con datos. Un segundo agente no reclama nada.
  select count(*) into v_agent_count from public.agents;
  if v_agent_count = 1 then
    update public.clients set agent_id = new.id where agent_id is null;
    update public.properties set agent_id = new.id where agent_id is null;
  end if;

  return new;
end;
$$;

-- Trigger sobre auth.users: un agente por usuario registrado.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_agent();

-- ============================================================
-- supabase/migrations/0004_rls_por_agente.sql
-- ============================================================
-- Fase 2 — Seguridad básica: RLS por agente (adelantada desde la Fase 8).
-- Cada agente solo ve y modifica lo suyo. No hay ninguna política para
-- `anon`: sin sesión, todas las consultas devuelven 0 filas.
-- Las filas seed sin dueño (agent_id NULL) no las ve nadie hasta que el
-- primer agente las reclama (ver 0003_auth_agents_trigger.sql).

-- Activar RLS en las 8 tablas.
alter table public.agents enable row level security;
alter table public.clients enable row level security;
alter table public.properties enable row level security;
alter table public.visit_notes enable row level security;
alter table public.extracted_facts enable row level security;
alter table public.tasks enable row level security;
alter table public.drafts enable row level security;
alter table public.crm_exports enable row level security;

-- El agente que crea una fila es su dueño por defecto.
alter table public.clients alter column agent_id set default auth.uid();
alter table public.properties alter column agent_id set default auth.uid();
alter table public.visit_notes alter column agent_id set default auth.uid();
alter table public.tasks alter column agent_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- agents: cada agente solo ve y edita su propia fila. Sin insert (lo hace
-- el trigger de 0003) ni delete.
-- ---------------------------------------------------------------------------
drop policy if exists agents_select_own on public.agents;
create policy agents_select_own on public.agents
  for select to authenticated
  using (id = auth.uid());

drop policy if exists agents_update_own on public.agents;
create policy agents_update_own on public.agents
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- clients y properties: las cuatro operaciones solo sobre filas propias.
-- ---------------------------------------------------------------------------
drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients
  for select to authenticated
  using (agent_id = auth.uid());

drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own on public.clients
  for insert to authenticated
  with check (agent_id = auth.uid());

drop policy if exists clients_update_own on public.clients;
create policy clients_update_own on public.clients
  for update to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

drop policy if exists clients_delete_own on public.clients;
create policy clients_delete_own on public.clients
  for delete to authenticated
  using (agent_id = auth.uid());

drop policy if exists properties_select_own on public.properties;
create policy properties_select_own on public.properties
  for select to authenticated
  using (agent_id = auth.uid());

drop policy if exists properties_insert_own on public.properties;
create policy properties_insert_own on public.properties
  for insert to authenticated
  with check (agent_id = auth.uid());

drop policy if exists properties_update_own on public.properties;
create policy properties_update_own on public.properties
  for update to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

drop policy if exists properties_delete_own on public.properties;
create policy properties_delete_own on public.properties
  for delete to authenticated
  using (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- visit_notes: las cuatro operaciones solo sobre notas propias. En insert y
-- update, el cliente y el inmueble enlazados deben pertenecer también al
-- mismo agente (corrección de la revisión: sin esto, un agente podría crear
-- una nota sobre un cliente o un inmueble de otro agente).
-- ---------------------------------------------------------------------------
drop policy if exists visit_notes_select_own on public.visit_notes;
create policy visit_notes_select_own on public.visit_notes
  for select to authenticated
  using (agent_id = auth.uid());

drop policy if exists visit_notes_insert_own on public.visit_notes;
create policy visit_notes_insert_own on public.visit_notes
  for insert to authenticated
  with check (
    agent_id = auth.uid()
    and exists (select 1 from public.clients c where c.id = client_id and c.agent_id = auth.uid())
    and exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid())
  );

drop policy if exists visit_notes_update_own on public.visit_notes;
create policy visit_notes_update_own on public.visit_notes
  for update to authenticated
  using (agent_id = auth.uid())
  with check (
    agent_id = auth.uid()
    and exists (select 1 from public.clients c where c.id = client_id and c.agent_id = auth.uid())
    and exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid())
  );

drop policy if exists visit_notes_delete_own on public.visit_notes;
create policy visit_notes_delete_own on public.visit_notes
  for delete to authenticated
  using (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- tasks: las cuatro operaciones solo sobre tareas propias. El visit_note_id
-- debe ser null o pertenecer a una nota del mismo agente (insert y update).
-- ---------------------------------------------------------------------------
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select to authenticated
  using (agent_id = auth.uid());

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check (
    agent_id = auth.uid()
    and (visit_note_id is null or exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()))
  );

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update to authenticated
  using (agent_id = auth.uid())
  with check (
    agent_id = auth.uid()
    and (visit_note_id is null or exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()))
  );

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using (agent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- extracted_facts, drafts y crm_exports: las cuatro operaciones solo si la
-- nota de visita a la que pertenecen es del mismo agente.
-- ---------------------------------------------------------------------------
drop policy if exists extracted_facts_select_own on public.extracted_facts;
create policy extracted_facts_select_own on public.extracted_facts
  for select to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists extracted_facts_insert_own on public.extracted_facts;
create policy extracted_facts_insert_own on public.extracted_facts
  for insert to authenticated
  with check (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists extracted_facts_update_own on public.extracted_facts;
create policy extracted_facts_update_own on public.extracted_facts
  for update to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()))
  with check (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists extracted_facts_delete_own on public.extracted_facts;
create policy extracted_facts_delete_own on public.extracted_facts
  for delete to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists drafts_select_own on public.drafts;
create policy drafts_select_own on public.drafts
  for select to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists drafts_insert_own on public.drafts;
create policy drafts_insert_own on public.drafts
  for insert to authenticated
  with check (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists drafts_update_own on public.drafts;
create policy drafts_update_own on public.drafts
  for update to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()))
  with check (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists drafts_delete_own on public.drafts;
create policy drafts_delete_own on public.drafts
  for delete to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists crm_exports_select_own on public.crm_exports;
create policy crm_exports_select_own on public.crm_exports
  for select to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists crm_exports_insert_own on public.crm_exports;
create policy crm_exports_insert_own on public.crm_exports
  for insert to authenticated
  with check (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists crm_exports_update_own on public.crm_exports;
create policy crm_exports_update_own on public.crm_exports
  for update to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()))
  with check (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

drop policy if exists crm_exports_delete_own on public.crm_exports;
create policy crm_exports_delete_own on public.crm_exports
  for delete to authenticated
  using (exists (select 1 from public.visit_notes v where v.id = visit_note_id and v.agent_id = auth.uid()));

-- Índices para las comprobaciones de propiedad.
create index if not exists clients_agent_id_idx on public.clients (agent_id);
create index if not exists properties_agent_id_idx on public.properties (agent_id);
create index if not exists visit_notes_agent_id_idx on public.visit_notes (agent_id);
create index if not exists tasks_agent_id_idx on public.tasks (agent_id);
create index if not exists extracted_facts_visit_note_id_idx on public.extracted_facts (visit_note_id);
create index if not exists drafts_visit_note_id_idx on public.drafts (visit_note_id);
create index if not exists crm_exports_visit_note_id_idx on public.crm_exports (visit_note_id);
