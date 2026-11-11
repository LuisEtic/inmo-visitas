-- Fase 4 — Audio de visitas en Supabase Storage (2026-11-11).
-- Bucket privado `visit-audio` + políticas por agente: cada agente solo
-- accede a los objetos de su propia carpeta (primer segmento de la ruta
-- = su `auth.uid()`). La ruta del objeto es
-- `<agent_id>/<visit_note_id>.<ext>` y se guarda en `visit_notes.audio_url`.
-- Idempotente: se puede volver a aplicar sin error.
-- Aplicar en el SQL Editor (ver `docs/deploy/supabase-fase-4.sql`).

-- 1. Bucket privado ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit-audio',
  'visit-audio',
  false,
  10485760,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Políticas: solo `authenticated`, solo este bucket, solo la carpeta
--    propia. Sin política para `anon` y sin update (un audio no se
--    sobrescribe: se sube con `upsert: false`).

drop policy if exists visit_audio_select_own on storage.objects;
create policy visit_audio_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'visit-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists visit_audio_insert_own on storage.objects;
create policy visit_audio_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'visit-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists visit_audio_delete_own on storage.objects;
create policy visit_audio_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'visit-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
