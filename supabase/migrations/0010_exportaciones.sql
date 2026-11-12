-- Fase 7 — Exportación al CRM y WhatsApp (2026-11-12).
-- Columnas y reglas en `crm_exports`: qué se lleva fuera (la ficha de
-- la nota o un borrador aprobado), a dónde, y en qué estado queda.
-- Idempotente: se puede volver a aplicar sin error.
-- Aplicar en el SQL Editor (ver `docs/deploy/supabase-fase-7.sql`).
-- No toca RLS (0004, a través de su nota) ni los guards de
-- `visit_notes`, `extracted_facts`, `tasks` ni `drafts`: todo el estado
-- de la Fase 7 vive en `crm_exports`, porque una nota aprobada no
-- admite `update` (migración 0008).
--
-- Motivo: que el agente pueda llevar el trabajo fuera de la app (abrir
-- WhatsApp con el borrador aprobado ya escrito, exportar la ficha al
-- CRM o copiarla) con un registro de solo inserción: cada intento es
-- una fila nueva; una fila cerrada (`enviado`, `error`, `entregado`)
-- no cambia. Nada se envía solo.

-- 1. `crm_exports`: qué se exporta y a dónde ------------------------------
-- `kind`: `nota` (la ficha de la visita) o `borrador` (un borrador
-- aprobado, para WhatsApp). `draft_id` y `audience` solo con
-- `kind = 'borrador'`.
-- `external_id`: id que devuelve el CRM (o `SIM-…` en modo simulado).
-- `error_message`: mensaje genérico en español (≤ 300 caracteres, sin
-- datos personales), solo con `status = 'error'`.
-- `visit_note_id` pasa a `not null`: no hay filas (la tabla está vacía
-- desde la 0001).
alter table public.crm_exports
  add column if not exists kind text not null default 'nota'
    check (kind in ('nota', 'borrador')),
  add column if not exists draft_id uuid
    references public.drafts (id) on delete cascade,
  add column if not exists audience text
    check (audience in ('comprador', 'propietario')),
  add column if not exists external_id text,
  add column if not exists error_message text
    check (char_length(error_message) <= 300),
  add column if not exists updated_at timestamptz;

alter table public.crm_exports
  alter column visit_note_id set not null;

-- 2. Estados ---------------------------------------------------------------
-- `pendiente`: creada, a la espera del CRM (solo `inmovilla`/`witei`).
-- `enviado`: el CRM la aceptó. `error`: el CRM no respondió o la
-- rechazó. `entregado`: la app se la dio al agente (WhatsApp abierto
-- con el texto, ficha copiada); la app NO sabe si llegó a enviarse.
alter table public.crm_exports
  drop constraint if exists crm_exports_status_check;
alter table public.crm_exports
  add constraint crm_exports_status_check
    check (status in ('pendiente', 'enviado', 'error', 'entregado'));

-- 3. Combinaciones válidas -------------------------------------------------
-- `inmovilla`/`witei` y `manual` solo llevan la ficha (`kind = 'nota'`);
-- `whatsapp` lleva la ficha o un borrador.
alter table public.crm_exports
  drop constraint if exists crm_exports_kind_target_check;
alter table public.crm_exports
  add constraint crm_exports_kind_target_check
    check (
      (target not in ('inmovilla', 'witei') or kind = 'nota')
      and (target <> 'manual' or kind = 'nota')
    );

-- Un borrador lleva su `draft_id` y su `audience`; una ficha, ninguno.
alter table public.crm_exports
  drop constraint if exists crm_exports_draft_check;
alter table public.crm_exports
  add constraint crm_exports_draft_check
    check (
      (kind <> 'borrador' or (draft_id is not null and audience is not null))
      and (kind <> 'nota' or (draft_id is null and audience is null))
    );

-- 4. Guard: registro de solo inserción ------------------------------------
-- Insert: la nota debe estar `approved`; con `kind = 'borrador'`, el
-- borrador debe ser de esa nota, de ese `audience` y estar `aprobado`.
-- `inmovilla`/`witei` nacen `pendiente`; `whatsapp`/`manual` nacen
-- `entregado` (y ponen `exported_at`). Otro estado inicial no vale.
-- Update: solo `pendiente → enviado` (pone `exported_at`) o
-- `pendiente → error`, y solo cambian `status`, `external_id`,
-- `error_message`, `payload` y `updated_at`. Una fila cerrada no cambia.
-- Reintentar = fila nueva: cada intento queda registrado.
-- Delete: solo por la cascada del borrado de la nota (RGPD); si la nota
-- sigue existiendo, no se puede borrar la exportación a mano.
create or replace function public.crm_exports_guard()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_note_status text;
  v_draft_ok boolean;
begin
  if TG_OP = 'DELETE' then
    select status into v_note_status
    from public.visit_notes
    where id = old.visit_note_id;
    -- Nota borrada (cascada): se permite, como en `tasks_guard`. Si
    -- existe, la exportación no se borra a mano.
    if v_note_status is not null then
      raise exception 'exportacion_cerrada' using errcode = 'P0001';
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

    if new.kind = 'borrador' then
      select exists (
        select 1 from public.drafts
        where id = new.draft_id
          and visit_note_id = new.visit_note_id
          and audience = new.audience
          and status = 'aprobado'
      ) into v_draft_ok;
      if not v_draft_ok then
        raise exception 'borrador_no_aprobado' using errcode = 'P0001';
      end if;
    end if;

    if new.target in ('inmovilla', 'witei') then
      if new.status <> 'pendiente' then
        raise exception 'exportacion_no_valida' using errcode = 'P0001';
      end if;
    elsif new.target in ('whatsapp', 'manual') then
      if new.status <> 'entregado' then
        raise exception 'exportacion_no_valida' using errcode = 'P0001';
      end if;
      new.exported_at := now();
    end if;

    new.updated_at := now();
    return new;
  end if;

  -- UPDATE: solo desde `pendiente` y solo a `enviado` o `error`.
  if old.status <> 'pendiente' then
    raise exception 'exportacion_cerrada' using errcode = 'P0001';
  end if;
  if new.status not in ('enviado', 'error') then
    raise exception 'exportacion_cerrada' using errcode = 'P0001';
  end if;

  -- Solo cambian `status`, `external_id`, `error_message`, `payload` y
  -- `updated_at` (`exported_at` la pone el guard al enviar).
  if new.visit_note_id is distinct from old.visit_note_id
    or new.target is distinct from old.target
    or new.kind is distinct from old.kind
    or new.draft_id is distinct from old.draft_id
    or new.audience is distinct from old.audience
    or new.exported_at is distinct from old.exported_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'exportacion_cerrada' using errcode = 'P0001';
  end if;

  if new.status = 'enviado' then
    new.exported_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_exports_guard on public.crm_exports;
create trigger crm_exports_guard
  before insert or update or delete on public.crm_exports
  for each row execute function public.crm_exports_guard();

-- 5. Índice para el historial de una nota (las más recientes primero) -----
create index if not exists crm_exports_visit_note_created_idx
  on public.crm_exports (visit_note_id, created_at desc);
