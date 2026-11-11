-- Fase 5 — Extracción con evidencia + revisión y aprobación (2026-11-11).
-- Columnas de revisión en `extracted_facts`, marcas de tiempo en
-- `visit_notes` y reglas en la base: una nota aprobada no se puede
-- cambiar, y no se puede aprobar con datos sin revisar.
-- Idempotente: se puede volver a aplicar sin error.
-- Aplicar en el SQL Editor (ver `docs/deploy/supabase-fase-5.sql`).
-- No toca RLS: las políticas de 0004 siguen siendo las que deciden quién.

-- 1. Columnas de revisión en `extracted_facts` --------------------------
-- `origin`: quién propuso el dato (`ia` o el propio `agente`).
-- `review_status`: estado de la revisión dato a dato.
-- `original_value`: valor que propuso la IA, guardado la primera vez
--   que el agente lo edita (para medir correcciones en el piloto).
-- `reviewed_at`: cuándo se revisó el dato por última vez.
alter table public.extracted_facts
  add column if not exists origin text not null default 'ia'
    check (origin in ('ia', 'agente')),
  add column if not exists review_status text not null default 'propuesto'
    check (review_status in ('propuesto', 'aceptado', 'editado', 'descartado')),
  add column if not exists original_value text,
  add column if not exists reviewed_at timestamptz;

-- 2. Marcas de tiempo en `visit_notes` ------------------------------------
alter table public.visit_notes
  add column if not exists extracted_at timestamptz,
  add column if not exists approved_at timestamptz;

-- 3. Regla en `visit_notes`: nota aprobada congelada ----------------------
-- - Nada de una nota aprobada se puede cambiar (cualquier update falla).
-- - Aprobar con datos `propuesto` falla; si no los hay, se pone
--   `approved_at`.
-- - El texto (`raw_text` / `transcript`) solo se puede corregir en
--   `draft` o `transcribed`: la evidencia apunta a ese texto.
-- El trigger es solo `before update`: no bloquea el borrado de la nota.
create or replace function public.visit_notes_guard()
returns trigger
language plpgsql
security invoker
as $$
begin
  if old.status = 'approved' then
    raise exception 'nota_aprobada' using errcode = 'P0001';
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    if exists (
      select 1 from public.extracted_facts
      where visit_note_id = old.id
        and review_status = 'propuesto'
    ) then
      raise exception 'datos_sin_revisar' using errcode = 'P0001';
    end if;
    new.approved_at := now();
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

-- 4. Regla en `extracted_facts`: datos de nota aprobada congelados -------
-- Si la nota ya no existe (borrado de la nota en cascada), se permite
-- la operación: borrar una nota entera, aprobada o no, tiene que seguir
-- siendo posible (derecho de supresión, RGPD).
create or replace function public.extracted_facts_guard()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_note_id uuid;
  v_status text;
begin
  v_note_id := case
    when TG_OP = 'DELETE' then old.visit_note_id
    else new.visit_note_id
  end;

  select status into v_status
  from public.visit_notes
  where id = v_note_id;

  if v_status = 'approved' then
    raise exception 'nota_aprobada' using errcode = 'P0001';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists extracted_facts_guard on public.extracted_facts;
create trigger extracted_facts_guard
  before insert or update or delete on public.extracted_facts
  for each row execute function public.extracted_facts_guard();
