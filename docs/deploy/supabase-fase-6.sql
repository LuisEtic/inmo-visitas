-- Fase 6 — Borradores duales + bandeja de pendientes (2026-11-12).
-- Columnas y reglas en `tasks` y `drafts`. Al aplicarla, ambas tablas
-- están vacías, pero la migración no falla si hay filas
-- `pendiente`/`completada` (el check nuevo las incluye).
-- Idempotente: se puede volver a aplicar sin error.
-- Aplicar en el SQL Editor (ver `docs/deploy/supabase-fase-6.sql`).
-- No toca RLS ni el guard de `visit_notes`: todo el estado de la
-- Fase 6 vive en `tasks` y `drafts`, porque una nota aprobada no
-- admite `update` (migración 0008).
--
-- Motivo: preparar el seguimiento de una nota aprobada (tareas y dos
-- borradores, uno por destinatario) sin que nada se envíe solo.

-- 1. `tasks`: estados, origen y evidencia -------------------------------
-- `status`: propuesta (la IA o una regla la propone), pendiente (el
-- agente la acepta), completada, descartada.
-- `origin`: quién la propuso (`ia`, `regla` o el propio `agente`).
-- `source_fact_id`: el dato que la justifica (la evidencia).
alter table public.tasks
  drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
    check (status in ('propuesta', 'pendiente', 'completada', 'descartada'));
alter table public.tasks
  alter column status set default 'pendiente';

alter table public.tasks
  add column if not exists origin text not null default 'agente'
    check (origin in ('ia', 'regla', 'agente')),
  add column if not exists source_fact_id uuid
    references public.extracted_facts (id) on delete set null,
  add column if not exists original_description text,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz;

create index if not exists tasks_agent_status_due_idx
  on public.tasks (agent_id, status, due_date);

-- 2. Regla en `tasks` ----------------------------------------------------
-- - Insert con nota: la nota debe estar `approved`.
-- - Insert como `propuesta` solo si `origin` es `ia` o `regla` y hay
--   nota; una tarea a mano (`agente`) nace `pendiente`. Tampoco se
--   puede nacer `completada` ni `descartada`: esos estados solo se
--   alcanzan desde `propuesta` o `pendiente`.
-- - Transiciones: propuesta → pendiente | descartada;
--   pendiente → completada | descartada; completada → pendiente
--   (reabrir); descartada → propuesta solo si `origin <> 'agente'`
--   (recuperar). Cualquier otra → `transicion_no_valida`.
-- - `completada` pone `completed_at`; reabrir lo vacía.
-- - Si cambia `description` y `original_description` es nula y
--   `origin <> 'agente'` → guarda la anterior. Siempre
--   `updated_at := now()`.
-- - `source_fact_id`, si no es nulo, debe ser de la misma nota
--   (`fuente_no_valida`).
-- - Borrar solo si `status` es `propuesta` o `descartada` o
--   `origin = 'agente'`; si la nota ya no existe (borrado en cascada
--   de la nota, RGPD), se permite, igual que `extracted_facts_guard`.
create or replace function public.tasks_guard()
returns trigger
language plpgsql
security invoker
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

-- 3. `drafts`: estados, marcas y un borrador por destinatario ------------
-- `status`: `borrador` o `aprobado` (congelado).
-- `original_content`: texto que generó la IA, guardado en la primera
-- edición (para medir correcciones en el piloto).
-- `generated_at`: cuándo se generó; `edited_at` y `approved_at`: marcas.
alter table public.drafts
  add column if not exists status text not null default 'borrador'
    check (status in ('borrador', 'aprobado')),
  add column if not exists original_content text,
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists edited_at timestamptz,
  add column if not exists approved_at timestamptz;

alter table public.drafts
  drop constraint if exists drafts_visit_note_audience_unique;
alter table public.drafts
  add constraint drafts_visit_note_audience_unique
    unique (visit_note_id, audience);

-- El borrador al propietario solo existe filtrado: la regla de la
-- función (`rules.ts`) impide que lleve presupuesto o finanzas.
alter table public.drafts
  drop constraint if exists drafts_owner_filtered_check;
alter table public.drafts
  add constraint drafts_owner_filtered_check
    check (audience <> 'propietario' or is_sensitive_filtered);

alter table public.drafts
  drop constraint if exists drafts_content_length_check;
alter table public.drafts
  add constraint drafts_content_length_check
    check (char_length(content) between 1 and 1500);

-- 4. Regla en `drafts` ----------------------------------------------------
-- - Insert: la nota debe estar `approved`.
-- - Update o delete de un borrador `aprobado` → `borrador_aprobado`
--   (queda congelado), salvo la cascada de borrado de la nota (mismo
--   patrón que `extracted_facts_guard`).
-- - Si cambia `content` y `original_content` es nula → guarda la
--   anterior; `edited_at := now()`.
-- - Pasar a `aprobado` pone `approved_at := now()`; no se puede
--   volver a `borrador` (eso es cambiar un borrador aprobado).
create or replace function public.drafts_guard()
returns trigger
language plpgsql
security invoker
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
