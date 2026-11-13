-- Fase 8 — Seguridad, borrado y RGPD (2026-11-13).
-- Avisos de Supabase (Advisors), B-4, B-9 (external_id), cola de
-- borrado de audios, borrado de notas, clientes y datos del
-- propietario, registro de acciones, límite diario de IA y formato
-- de contacto en la base. Retirada del reclamo de la demo.
-- Idempotente: se puede volver a aplicar sin error.
-- Aplicar en el SQL Editor (ver `docs/deploy/supabase-fase-8.sql`).
-- No modifica las migraciones 0001–0011. No toca RLS (0004): las
-- políticas existentes siguen siendo las que deciden quién.
--
-- B-6 (un agente puede pasar su propia exportación de `pendiente` a
-- `enviado` con un PATCH directo) se ACEPTA y se documenta en
-- `docs/rgpd/riesgos.md`: arreglarlo exigiría `service_role` en
-- `crm-export`, contra la norma del proyecto, y el único efecto es
-- que un agente falsee sus propias métricas.

-- 1. `search_path` fijo en las seis funciones de guarda ---------------
-- Sin él, Supabase marca `function_search_path_mutable`. Los cuerpos
-- ya usan `public.` en todas las tablas (comprobado en 0007–0011).
alter function public.visit_notes_guard() set search_path = public, pg_temp;
alter function public.visit_notes_insert_guard() set search_path = public, pg_temp;
alter function public.extracted_facts_guard() set search_path = public, pg_temp;
alter function public.tasks_guard() set search_path = public, pg_temp;
alter function public.drafts_guard() set search_path = public, pg_temp;
alter function public.crm_exports_guard() set search_path = public, pg_temp;

-- 2. Funciones `security definer` ---------------------------------------
-- `handle_new_agent()` y `rls_auto_enable()` (función del event
-- trigger `ensure_rls` que creó Supabase, no está en nuestras
-- migraciones) no deben ser ejecutables por `anon` ni
-- `authenticated` vía `/rest/v1/rpc`. Los triggers siguen
-- funcionando: el permiso de ejecutar no afecta a un trigger.
revoke execute on function public.handle_new_agent() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 3. Retirar el reclamo de la demo ---------------------------------------
-- `handle_new_agent()` ya no reclama las filas seed sin dueño: solo
-- crea la fila de `agents`. La tabla del reclamo se elimina.
create or replace function public.handle_new_agent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.agents (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  return new;
end;
$$;

drop table if exists public.demo_seed_claim;

-- 4. B-4: `tasks_guard` y `drafts_guard` ---------------------------------
-- Un `update` que cambie `visit_note_id`, `origin` (tareas) o
-- `audience` (borradores) falla con `cambio_no_permitido`. Copias
-- enteras de la 0009 con solo esa comprobación añadida.

create or replace function public.tasks_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_note_status text;
begin
  if TG_OP = 'DELETE' then
    if old.visit_note_id is not null then
      select status into v_note_status
      from public.visit_notes
      where id = old.visit_note_id;
      -- Nota borrada (cascada): se permite, como en
      -- `extracted_facts_guard`. Si existe, solo se borra en
      -- `propuesta`/`descartada` o si la creó el agente.
      if v_note_status is not null
        and old.status not in ('propuesta', 'descartada')
        and old.origin <> 'agente'
      then
        raise exception 'transicion_no_valida' using errcode = 'P0001';
      end if;
    end if;
    return old;
  end if;

  if TG_OP = 'INSERT' then
    if new.visit_note_id is not null then
      select status into v_note_status
      from public.visit_notes
      where id = new.visit_note_id;
      if v_note_status is distinct from 'approved' then
        raise exception 'nota_no_aprobada' using errcode = 'P0001';
      end if;
    end if;
    if new.status = 'propuesta' then
      if new.origin not in ('ia', 'regla') or new.visit_note_id is null then
        raise exception 'transicion_no_valida' using errcode = 'P0001';
      end if;
    elsif new.status <> 'pendiente' then
      raise exception 'transicion_no_valida' using errcode = 'P0001';
    end if;
  end if;

  if TG_OP = 'UPDATE' then
    -- Revisión de la Fase 8 (B-4): la nota y el origen no cambian en
    -- un `update`.
    if new.visit_note_id is distinct from old.visit_note_id
      or new.origin is distinct from old.origin
    then
      raise exception 'cambio_no_permitido' using errcode = 'P0001';
    end if;

    if new.status is distinct from old.status
      and not (
        (old.status = 'propuesta' and new.status in ('pendiente', 'descartada'))
        or (old.status = 'pendiente' and new.status in ('completada', 'descartada'))
        or (old.status = 'completada' and new.status = 'pendiente')
        or (old.status = 'descartada' and new.status = 'propuesta' and old.origin <> 'agente')
      ) then
      raise exception 'transicion_no_valida' using errcode = 'P0001';
    end if;

    if new.status = 'completada' and old.status <> 'completada' then
      new.completed_at := now();
    elsif new.status <> 'completada' and old.status = 'completada' then
      new.completed_at := null;
    end if;

    if new.description is distinct from old.description
      and old.original_description is null
      and old.origin <> 'agente'
    then
      new.original_description := old.description;
    end if;
  end if;

  if new.source_fact_id is not null then
    if not exists (
      select 1 from public.extracted_facts
      where id = new.source_fact_id
        and visit_note_id = new.visit_note_id
    ) then
      raise exception 'fuente_no_valida' using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard
  before insert or update or delete on public.tasks
  for each row execute function public.tasks_guard();

create or replace function public.drafts_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_note_status text;
begin
  if TG_OP = 'DELETE' then
    if old.status = 'aprobado' then
      select status into v_note_status
      from public.visit_notes
      where id = old.visit_note_id;
      -- Nota borrada (cascada): se permite; si existe, el borrador
      -- aprobado no se puede borrar.
      if v_note_status is not null then
        raise exception 'borrador_aprobado' using errcode = 'P0001';
      end if;
    end if;
    return old;
  end if;

  if TG_OP = 'INSERT' then
    select status into v_note_status
    from public.visit_notes
    where id = new.visit_note_id;
    if v_note_status is distinct from 'approved' then
      raise exception 'nota_no_aprobada' using errcode = 'P0001';
    end if;
    if new.status = 'aprobado' and new.approved_at is null then
      new.approved_at := now();
    end if;
    return new;
  end if;

  -- UPDATE.
  -- Revisión de la Fase 8 (B-4): la nota y el destinatario no cambian
  -- en un `update`.
  if new.visit_note_id is distinct from old.visit_note_id
    or new.audience is distinct from old.audience
  then
    raise exception 'cambio_no_permitido' using errcode = 'P0001';
  end if;

  if old.status = 'aprobado' then
    raise exception 'borrador_aprobado' using errcode = 'P0001';
  end if;

  if new.content is distinct from old.content then
    if old.original_content is null then
      new.original_content := old.content;
    end if;
    new.edited_at := now();
  end if;

  if new.status = 'aprobado' then
    new.approved_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists drafts_guard on public.drafts;
create trigger drafts_guard
  before insert or update or delete on public.drafts
  for each row execute function public.drafts_guard();

-- 5. B-9: `external_id` con límite ---------------------------------------
alter table public.crm_exports
  drop constraint if exists crm_exports_external_id_check;
alter table public.crm_exports
  add constraint crm_exports_external_id_check
    check (char_length(external_id) <= 200);

-- 6. B-6: aceptado y documentado (ver la cabecera). Sin cambios de
--    código: arreglarlo exigiría `service_role` en `crm-export`.

-- 7. Cola de borrado de audios --------------------------------------------
-- La cola guarda la ruta y nada más. El navegador (`flushAudioCleanup`)
-- borra los objetos de `visit-audio` y vacía la cola. Un agente que
-- inserte rutas falsas solo afectaría a su propia carpeta, que ya
-- protegen las políticas de la 0006.
create table if not exists public.audio_cleanup (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null default auth.uid()
    references public.agents (id) on delete cascade,
  path text not null,
  reason text check (reason in ('nota_borrada', 'nota_aprobada')),
  created_at timestamptz not null default now()
);

alter table public.audio_cleanup enable row level security;

drop policy if exists audio_cleanup_select_own on public.audio_cleanup;
create policy audio_cleanup_select_own on public.audio_cleanup
  for select to authenticated
  using (agent_id = auth.uid());

drop policy if exists audio_cleanup_insert_own on public.audio_cleanup;
create policy audio_cleanup_insert_own on public.audio_cleanup
  for insert to authenticated
  with check (agent_id = auth.uid());

drop policy if exists audio_cleanup_delete_own on public.audio_cleanup;
create policy audio_cleanup_delete_own on public.audio_cleanup
  for delete to authenticated
  using (agent_id = auth.uid());

-- Sin política de `update`: la cola no se edita, solo se vacía.

create index if not exists audio_cleanup_agent_id_idx
  on public.audio_cleanup (agent_id);

-- 7b. Audio al aprobar y borrado de notas -----------------------------------
-- Copia entera del guard de la 0008 con solo esto añadido: al pasar a
-- `approved`, si la nota tenía audio, su ruta va a la cola de borrado
-- (`nota_aprobada`) y la nota deja de apuntar al audio. Una vez
-- aprobada, la fuente es la transcripción revisada y el audio ya no
-- hace falta (minimización, arts. 5.1.c y 25 RGPD).
create or replace function public.visit_notes_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.status = 'approved' then
    raise exception 'nota_aprobada' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status
    and not (
      (old.status = 'draft' and new.status = 'transcribed')
      or (old.status = 'transcribed' and new.status = 'extracted')
      or (old.status = 'extracted' and new.status in ('reviewed', 'approved'))
      or (old.status = 'reviewed' and new.status = 'approved')
    ) then
    raise exception 'transicion_no_valida' using errcode = 'P0001';
  end if;

  if new.status = 'approved' then
    if exists (
      select 1 from public.extracted_facts
      where visit_note_id = old.id
        and review_status = 'propuesto'
    ) then
      raise exception 'datos_sin_revisar' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.extracted_facts
      where visit_note_id = old.id
        and review_status <> 'descartado'
    ) then
      raise exception 'nota_sin_datos' using errcode = 'P0001';
    end if;
    new.approved_at := now();
    -- Fase 8: el audio se borra al aprobar (ver la cabecera del
    -- punto 7). Solo si la nota tenía audio.
    if old.audio_url is not null then
      insert into public.audio_cleanup (agent_id, path, reason)
      values (old.agent_id, old.audio_url, 'nota_aprobada');
      new.audio_url := null;
    end if;
  end if;

  if (new.raw_text is distinct from old.raw_text
      or new.transcript is distinct from old.transcript)
    and old.status not in ('draft', 'transcribed') then
    raise exception 'texto_bloqueado' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists visit_notes_guard on public.visit_notes;
create trigger visit_notes_guard
  before update on public.visit_notes
  for each row execute function public.visit_notes_guard();

-- Al borrar una nota, su audio (si lo tenía) va a la cola y el borrado
-- queda registrado. La cascada se lleva sus datos, tareas, borradores
-- y exportaciones; los guards permiten borrarlos cuando la nota ya no
-- existe.
create or replace function public.visit_notes_delete_cleanup()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.audio_url is not null then
    insert into public.audio_cleanup (agent_id, path, reason)
    values (old.agent_id, old.audio_url, 'nota_borrada');
  end if;
  insert into public.audit_events (action, entity_id)
  values ('nota_borrada', old.id);
  return old;
end;
$$;

drop trigger if exists visit_notes_delete_cleanup on public.visit_notes;
create trigger visit_notes_delete_cleanup
  before delete on public.visit_notes
  for each row execute function public.visit_notes_delete_cleanup();

-- 8. Borrado de cliente e inmueble ----------------------------------------
-- `security invoker`: todo pasa por RLS. Solo el agente que ve el
-- cliente o el inmueble puede borrarlo; si no lo ve → `no_encontrado`.
create or replace function public.erase_client(p_client_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.clients where id = p_client_id
  ) then
    raise exception 'no_encontrado' using errcode = 'P0001';
  end if;

  -- Las notas se llevan en cascada sus datos, tareas, borradores y
  -- exportaciones; el trigger de borrado encola sus audios y registra
  -- cada nota borrada.
  delete from public.visit_notes where client_id = p_client_id;
  delete from public.clients where id = p_client_id;

  insert into public.audit_events (action, entity_id)
  values ('cliente_borrado', p_client_id);
end;
$$;

create or replace function public.erase_property_owner(p_property_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.properties where id = p_property_id
  ) then
    raise exception 'no_encontrado' using errcode = 'P0001';
  end if;

  -- No toca las notas: sus textos pueden nombrar al propietario, y
  -- eso lo avisa la interfaz.
  update public.properties
  set owner_name = 'Propietario borrado', owner_phone = null
  where id = p_property_id;

  insert into public.audit_events (action, entity_id)
  values ('propietario_borrado', p_property_id);
end;
$$;

revoke execute on function public.erase_client(uuid) from public, anon, authenticated;
grant execute on function public.erase_client(uuid) to authenticated;
revoke execute on function public.erase_property_owner(uuid) from public, anon, authenticated;
grant execute on function public.erase_property_owner(uuid) to authenticated;

-- 9. Registro de acciones --------------------------------------------------
-- Solo inserción y sin datos personales (ni nombres, ni textos, ni
-- rutas): sirve para rendir cuentas (art. 5.2 RGPD). Se borra solo
-- con la cuenta del agente (cascada desde `agents`).
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null default auth.uid()
    references public.agents (id) on delete cascade,
  action text check (action in (
    'nota_borrada', 'cliente_borrado', 'propietario_borrado',
    'datos_entregados'
  )),
  entity_id uuid,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

drop policy if exists audit_events_select_own on public.audit_events;
create policy audit_events_select_own on public.audit_events
  for select to authenticated
  using (agent_id = auth.uid());

drop policy if exists audit_events_insert_own on public.audit_events;
create policy audit_events_insert_own on public.audit_events
  for insert to authenticated
  with check (agent_id = auth.uid());

-- Sin `update` ni `delete`: el registro no se edita ni se borra.

create index if not exists audit_events_agent_created_idx
  on public.audit_events (agent_id, created_at desc);

-- 10. Límite diario de IA ---------------------------------------------------
-- Una fila por llamada a `transcribe`, `extract` o `drafts`. Sin
-- `update` ni `delete`: el agente no puede borrar su cuenta de
-- llamadas.
create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null default auth.uid()
    references public.agents (id) on delete cascade,
  fn text check (fn in ('transcribe', 'extract', 'drafts')),
  created_at timestamptz not null default now()
);

alter table public.ai_calls enable row level security;

drop policy if exists ai_calls_select_own on public.ai_calls;
create policy ai_calls_select_own on public.ai_calls
  for select to authenticated
  using (agent_id = auth.uid());

drop policy if exists ai_calls_insert_own on public.ai_calls;
create policy ai_calls_insert_own on public.ai_calls
  for insert to authenticated
  with check (agent_id = auth.uid());

-- Sin `update` ni `delete`.

create index if not exists ai_calls_agent_created_idx
  on public.ai_calls (agent_id, created_at);


-- 11. Formato de contacto en la base (pendiente desde la Fase 3) ----------
-- Primero se normalizan los datos existentes (quitar espacios, puntos,
-- guiones y paréntesis de los teléfonos; `lower(trim())` en los
-- emails). Después se comprueba si queda alguna fila que no cumpla;
-- si la hay, la migración se detiene con un error que dice cuántas
-- (sin mostrar los datos), para revisarlas a mano. Nunca cambia ni
-- borra datos que no sepa normalizar.
update public.clients
set phone = regexp_replace(phone, '[\s.\-()]', '', 'g')
where phone is not null;

update public.properties
set owner_phone = regexp_replace(owner_phone, '[\s.\-()]', '', 'g')
where owner_phone is not null;

update public.clients
set email = lower(trim(email))
where email is not null;

do $$
declare
  v_bad_phones integer;
  v_bad_owner_phones integer;
  v_bad_emails integer;
begin
  select count(*) into v_bad_phones from public.clients
  where phone is not null and phone !~ '^\+[1-9][0-9]{7,14}$';
  select count(*) into v_bad_owner_phones from public.properties
  where owner_phone is not null
    and owner_phone !~ '^\+[1-9][0-9]{7,14}$';
  select count(*) into v_bad_emails from public.clients
  where email is not null
    and (email <> lower(email)
      or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  if v_bad_phones + v_bad_owner_phones + v_bad_emails > 0 then
    raise exception 'Contacto sin normalizar: % teléfonos de cliente, % teléfonos de propietario y % emails no cumplen el formato; revísalos a mano antes de añadir las restricciones.',
      v_bad_phones, v_bad_owner_phones, v_bad_emails;
  end if;
end $$;

alter table public.clients
  drop constraint if exists clients_phone_format_check;
alter table public.clients
  add constraint clients_phone_format_check
    check (phone ~ '^\+[1-9][0-9]{7,14}$');

alter table public.properties
  drop constraint if exists properties_owner_phone_format_check;
alter table public.properties
  add constraint properties_owner_phone_format_check
    check (owner_phone ~ '^\+[1-9][0-9]{7,14}$');

alter table public.clients
  drop constraint if exists clients_email_format_check;
alter table public.clients
  add constraint clients_email_format_check
    check (email = lower(email)
      and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
