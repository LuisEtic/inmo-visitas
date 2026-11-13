-- =====================================================================
-- LIMPIEZA DE DATOS DE PRUEBA — inmo-visitas (proyecto de pruebas)
-- =====================================================================
-- ¡SOLO CON EL «SÍ» POR ESCRITO DE LUIS! Este script borra datos del
-- proyecto de pruebas de Supabase. NO ejecutarlo como parte de ninguna
-- fase ni sin ese «sí».
--
-- Cómo se usa:
--   1. Ejecutar SOLO la PARTE 1 (listar) y revisar fila a fila lo que
--      se va a borrar. Si algo no cuadra, NO seguir.
--   2. Ejecutar la PARTE 2 (borrar), en el mismo orden en que está.
--   3. Después, entrar en la app con cada agente: al entrar,
--      `flushAudioCleanup()` vacía la cola de audios y borra de
--      Storage los audios de las notas borradas (el trigger solo los
--      encola; este script NO borra de Storage).
--
-- Qué borra (datos de prueba de `docs/ESTADO.md`):
--   - Inmuebles V-52 del agente A, V-52 y V-18 del agente B, V-54
--     (Luis).
--   - Nota de prueba sobre David Romero (V-12, borrador, agente A).
--   - Nota de ejemplo de Ana García + V-18 (id e0782f7c-…): OJO, es
--     la nota de ejemplo. Solo se borra aquí, antes del piloto, con
--     el «sí» de Luis; nunca en las pruebas de una fase.
--   - Cliente provisional «Marta (la del lunes)» con su nota (V-31).
--   - Notas de voz de Luis (audio, agente distinto de A y B).
-- Qué NO borra: los datos semilla (6 clientes y 8 inmuebles de la
-- migración 0002), las cuentas de agente, ni `audit_events` (el
-- trigger sí registra `nota_borrada` por cada nota borrada).
--
-- Los ids de los agentes de prueba A y B están abajo. El agente de
-- Luis se identifica como «distinto de A y B» (en el proyecto de
-- pruebas solo hay tres agentes con datos).
-- =====================================================================

-- Agentes de prueba A y B (ids de `auth.users` / `public.agents`).
-- Luis = cualquier agente distinto de estos dos.
-- (No se escriben emails en este archivo: es un repo público.)

-- PARTE 1: LISTAR (ejecutar primero y revisar) ----------------------
-- Cada consulta muestra lo que borrará su equivalente de la PARTE 2.

-- 1a. Inmuebles de prueba por borrar.
select p.id, p.agent_id, a.full_name as agente, p.reference, p.address
from public.properties p
left join public.agents a on a.id = p.agent_id
where (p.reference = 'V-52' and p.agent_id = '59b96eb9-c341-4a93-b4b8-721701ceeafb')
   or (p.reference in ('V-52', 'V-18') and p.agent_id = 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0')
   or (p.reference = 'V-54'
       and p.agent_id not in ('59b96eb9-c341-4a93-b4b8-721701ceeafb', 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0'))
order by p.reference, p.agent_id;

-- 1b. Notas de prueba por borrar (David Romero, Marta, voces de Luis,
--     ejemplo de Ana).
select n.id, n.agent_id, a.full_name as agente, n.client_id,
       c.full_name as cliente, n.property_id, p.reference as inmueble,
       n.input_type, n.status, n.created_at
from public.visit_notes n
left join public.agents a on a.id = n.agent_id
left join public.clients c on c.id = n.client_id
left join public.properties p on p.id = n.property_id
where n.id = 'e0782f7c-8409-4e23-a2b0-5972521fed0a' -- ejemplo Ana + V-18
   or n.id = 'd91d1785-dd9e-415e-9106-5f227152c25b' -- nota de Marta + V-31
   or (c.full_name = 'David Romero' and n.status = 'draft'
       and n.agent_id = '59b96eb9-c341-4a93-b4b8-721701ceeafb')
   or (n.input_type = 'audio'
       and n.agent_id not in ('59b96eb9-c341-4a93-b4b8-721701ceeafb', 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0'))
order by n.created_at;

-- 1c. Cliente provisional por borrar.
select id, agent_id, full_name, is_temporary, created_at
from public.clients
where id = '15d60343-1a2d-4280-a688-71eb839132e8';

-- 1d. Notas que aún apuntan a los inmuebles de la PARTE 2 (si sale
--     alguna fila, ese inmueble NO se borra: primero hay que borrar
--     la nota, o revisar por qué sigue ahí).
select n.id, n.property_id, p.reference as inmueble, n.status
from public.visit_notes n
join public.properties p on p.id = n.property_id
where (p.reference = 'V-52' and p.agent_id = '59b96eb9-c341-4a93-b4b8-721701ceeafb')
   or (p.reference in ('V-52', 'V-18') and p.agent_id = 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0')
   or (p.reference = 'V-54'
       and p.agent_id not in ('59b96eb9-c341-4a93-b4b8-721701ceeafb', 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0'));

-- PARTE 2: BORRAR (solo después de revisar la PARTE 1) ---------------
-- Orden: notas primero (sus datos, tareas, borradores y exportaciones
-- se borran en cascada; el trigger encola sus audios y registra
-- `nota_borrada`), luego el cliente provisional, luego los inmuebles.

begin;

-- 2a. Nota de ejemplo de Ana + V-18 (OJO: la nota de ejemplo).
delete from public.visit_notes
where id = 'e0782f7c-8409-4e23-a2b0-5972521fed0a';

-- 2b. Nota de Marta + V-31.
delete from public.visit_notes
where id = 'd91d1785-dd9e-415e-9106-5f227152c25b';

-- 2c. Nota de prueba sobre David Romero (V-12, borrador, agente A).
delete from public.visit_notes
where client_id in (
  select id from public.clients
  where full_name = 'David Romero'
    and agent_id = '59b96eb9-c341-4a93-b4b8-721701ceeafb'
)
and status = 'draft';

-- 2d. Notas de voz de Luis (audio, agente distinto de A y B).
delete from public.visit_notes
where input_type = 'audio'
  and agent_id not in ('59b96eb9-c341-4a93-b4b8-721701ceeafb', 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0');

-- 2e. Cliente provisional «Marta (la del lunes)».
delete from public.clients
where id = '15d60343-1a2d-4280-a688-71eb839132e8';

-- 2f. Inmuebles de prueba. Solo se borran si ya no tienen notas (la
--     1d debe salir vacía); si alguno tiene notas, su fila queda y
--     hay que revisar por qué.
delete from public.properties p
where (
  (p.reference = 'V-52' and p.agent_id = '59b96eb9-c341-4a93-b4b8-721701ceeafb')
  or (p.reference in ('V-52', 'V-18') and p.agent_id = 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0')
  or (p.reference = 'V-54'
      and p.agent_id not in ('59b96eb9-c341-4a93-b4b8-721701ceeafb', 'd6847264-72d9-4b6a-8eaa-34bb98ebd2b0'))
)
and not exists (
  select 1 from public.visit_notes n where n.property_id = p.id
);

commit;

-- Después: entrar en la app con cada agente para que
-- `flushAudioCleanup()` vacíe la cola de audios (tabla
-- `audio_cleanup`) y borre de Storage los audios de las notas
-- borradas. Comprobar con:
--   select * from public.audio_cleanup;
-- Debe quedar vacía tras entrar con los tres agentes.
