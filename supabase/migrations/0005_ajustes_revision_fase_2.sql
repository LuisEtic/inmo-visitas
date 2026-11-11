-- Fase 2 — Ajustes de la revisión de Claude (2026-11-11).
-- Se puede volver a aplicar sin error. Aplicar después de 0001–0004.
--
-- 1. properties.reference única POR AGENTE (antes, única en toda la base):
--    un segundo agente no podía crear su propio «V-18», y el error de
--    duplicado le revelaba que esa referencia existía en otro agente
--    aunque RLS se la ocultara.
-- 2. agents.email de solo lectura también en la base de datos (antes solo
--    lo era en la interfaz): el agente solo puede actualizar full_name y
--    phone. El email lo fija el trigger de alta desde auth.users.
-- 3. visit_notes.client_id y property_id obligatorios (NOT NULL): las
--    políticas de 0004 ya exigían cliente e inmueble propios, así que una
--    nota sin cliente era imposible en la práctica. Ahora el esquema lo
--    dice. Si en la captura (Fase 4) no se conoce al cliente, se crea un
--    cliente provisional (clients.is_temporary = true).
-- 4. Reclamo de datos de demo de una sola vez y sin carreras: un registro
--    en public.demo_seed_claim marca que ya se reclamó. Antes se usaba
--    count(*) = 1 en agents, que volvía a reclamar si se borraban todos los
--    agentes y podía fallar con dos altas simultáneas.

-- 1. Referencia única por agente ---------------------------------------
alter table public.properties drop constraint if exists properties_reference_key;
alter table public.properties drop constraint if exists properties_agent_reference_key;
alter table public.properties
  add constraint properties_agent_reference_key unique (agent_id, reference);

-- 2. agents: solo full_name y phone son editables ------------------------
revoke update on public.agents from anon, authenticated;
grant update (full_name, phone) on public.agents to authenticated;

-- 3. Nota de visita siempre con cliente e inmueble -----------------------
alter table public.visit_notes alter column client_id set not null;
alter table public.visit_notes alter column property_id set not null;

-- 4. Reclamo de demo de una sola vez -------------------------------------
-- SOLO DEMO — ELIMINAR ANTES DE PRODUCCIÓN (tabla, y el bloque del reclamo
-- en public.handle_new_agent()).
create table if not exists public.demo_seed_claim (
  id boolean primary key default true check (id),
  agent_id uuid references public.agents (id) on delete set null,
  claimed_at timestamptz not null default now()
);
-- Nadie la lee ni la escribe desde la API: RLS activa y sin políticas.
alter table public.demo_seed_claim enable row level security;
revoke all on public.demo_seed_claim from anon, authenticated;

-- Si ya hay agentes (proyecto donde el reclamo ya ocurrió), se marca como
-- reclamado para que nadie más lo repita.
insert into public.demo_seed_claim (agent_id)
select id from public.agents order by created_at limit 1
on conflict (id) do nothing;

create or replace function public.handle_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agents (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  -- SOLO DEMO — ELIMINAR ANTES DE PRODUCCIÓN: el primer agente que se
  -- registra reclama las filas seed sin dueño (agent_id NULL). La fila única
  -- de demo_seed_claim garantiza que ocurre una sola vez, aunque se borren
  -- agentes o haya dos altas a la vez.
  insert into public.demo_seed_claim (agent_id) values (new.id)
  on conflict (id) do nothing;
  if found then
    update public.clients set agent_id = new.id where agent_id is null;
    update public.properties set agent_id = new.id where agent_id is null;
  end if;

  return new;
end;
$$;
