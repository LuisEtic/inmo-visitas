-- Ajustes de la revisión de la Fase 5 (Claude, 2026-11-12).
-- La 0007 ya está aplicada y no se modifica: esta migración sustituye la
-- función `visit_notes_guard` (mismo trigger) y añade un guard de alta.
-- Idempotente: se puede volver a aplicar sin error.
-- Aplicar en el SQL Editor (ver `docs/deploy/supabase-fase-5-ajustes.sql`).
-- No toca RLS: las políticas de 0004 siguen siendo las que deciden quién.
--
-- Motivo:
-- I-1. La nota podía volver atrás de estado (p. ej. `extracted` →
--      `transcribed`) y, con un segundo update, cambiar el texto: los
--      datos quedaban con citas que ya no estaban en el texto.
-- I-2. Se podía aprobar una nota que nunca pasó por la extracción
--      (`draft`/`transcribed` → `approved`), o sin ningún dato válido.

-- 1. Guard de actualización de `visit_notes` (sustituye al de 0007) ------
-- Transiciones de estado permitidas (solo hacia delante):
--   draft → transcribed → extracted → reviewed → approved
--   extracted → approved (todos los datos ya revisados)
-- Cualquier otro cambio de estado → `transicion_no_valida`.
-- Aprobar exige: ningún dato `propuesto` y al menos uno no descartado.
create or replace function public.visit_notes_guard()
returns trigger
language plpgsql
security invoker
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
  end if;

  if (new.raw_text is distinct from old.raw_text
      or new.transcript is distinct from old.transcript)
    and old.status not in ('draft', 'transcribed') then
    raise exception 'texto_bloqueado' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- El trigger `visit_notes_guard` de 0007 ya apunta a esta función; se
-- vuelve a crear por si la 0007 no se aplicó entera.
drop trigger if exists visit_notes_guard on public.visit_notes;
create trigger visit_notes_guard
  before update on public.visit_notes
  for each row execute function public.visit_notes_guard();

-- 2. Guard de alta de `visit_notes` ---------------------------------------
-- Una nota nace en `draft` (voz) o `transcribed` (texto), nunca ya
-- extraída o aprobada, y sin marcas de extracción ni aprobación.
create or replace function public.visit_notes_insert_guard()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.status not in ('draft', 'transcribed')
    or new.extracted_at is not null
    or new.approved_at is not null then
    raise exception 'transicion_no_valida' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists visit_notes_insert_guard on public.visit_notes;
create trigger visit_notes_insert_guard
  before insert on public.visit_notes
  for each row execute function public.visit_notes_insert_guard();
