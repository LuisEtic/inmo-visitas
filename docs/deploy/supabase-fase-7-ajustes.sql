-- Revisión de la Fase 7 (Claude, 2026-11-13).
-- `crm_exports_guard` (0010) aceptaba en el insert los valores de
-- `external_id`, `error_message`, `exported_at` y `created_at` que
-- mandara el navegador: con una llamada directa a la API se podía crear
-- una fila `pendiente` con un ID externo o una fecha de exportación
-- inventados, y falsear las métricas del piloto. Ahora el insert los
-- fija la base: `external_id` y `error_message` nulos, `exported_at`
-- nulo (o `now()` si nace `entregado`) y `created_at := now()`.
-- El resto de reglas no cambia. Idempotente.
--
-- Sigue abierto (Fase 8): un agente puede pasar su propia fila de
-- `pendiente` a `enviado` con un PATCH directo, porque `crm-export` usa
-- su JWT (sin `service_role`). Solo afecta a sus propios datos.

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

    -- Revisión de la Fase 7: estos campos los pone la base (o la
    -- función `crm-export` al pasar de `pendiente` a `enviado`/`error`),
    -- nunca el navegador al insertar.
    new.external_id := null;
    new.error_message := null;
    new.exported_at := null;
    new.created_at := now();

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
