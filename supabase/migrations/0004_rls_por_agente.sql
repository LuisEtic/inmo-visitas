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
