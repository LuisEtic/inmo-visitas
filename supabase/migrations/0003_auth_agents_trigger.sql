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
