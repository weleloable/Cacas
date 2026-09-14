-- Bucket y políticas de Storage para las fotos de perfil.
--
-- Pégalo en el panel de Supabase -> SQL Editor -> New query -> Run.
-- Se puede ejecutar varias veces sin romper nada.
--
-- Antes hace falta crear el bucket (Storage -> New bucket -> nombre
-- "avatars" -> Public bucket: SÍ), o crearlo aquí mismo con el insert de
-- abajo. Público porque la foto se enseña en la clasificación de todo el
-- viaje: si el bucket no fuera público, cada `<Image>` necesitaría una URL
-- firmada con expiración, que es innecesario para algo que no es sensible.
--
-- Estructura de rutas: `avatars/<user_id>/<timestamp>.jpg`. El primer
-- segmento de la ruta (`storage.foldername(name)[1]`) es el UUID del dueño,
-- así que las políticas de escritura comparan ESE segmento contra
-- `auth.uid()`, no el bucket entero: cualquiera autenticado puede subir su
-- propia foto, nadie puede subir o borrar la de otro.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_select_publico" on storage.objects;
drop policy if exists "avatars_insert_dueno" on storage.objects;
drop policy if exists "avatars_update_dueno" on storage.objects;
drop policy if exists "avatars_delete_dueno" on storage.objects;

-- Leer: público, para que cualquier participante del viaje vea la foto de
-- los demás sin necesitar sesión propia contra Storage.
create policy "avatars_select_publico"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Subir: sólo dentro de la carpeta que lleva tu propio UUID.
create policy "avatars_insert_dueno"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- `upsert: true` en el cliente hace un update si el nombre coincide; sin
-- esta política, resubir con el mismo nombre (mismo timestamp, poco
-- probable pero posible) daría 42501 en vez de sobrescribir.
create policy "avatars_update_dueno"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_dueno"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
