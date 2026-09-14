-- Políticas de Row Level Security para la tabla `viajes`.
--
-- Pégalo en el panel de Supabase -> SQL Editor -> New query -> Run.
-- Se puede ejecutar varias veces sin romper nada.
--
-- Sin esto, la tabla tiene RLS activado pero ninguna política, que en Postgres
-- significa "nadie puede hacer nada": las lecturas devuelven [] y las
-- escrituras dan 42501. Sólo una clave con service_role (la secret key) se lo
-- salta, y esa clave no puede vivir dentro de una app que se descarga el
-- usuario.
--
-- Modelo de confianza: cualquiera que haya iniciado sesión puede leer y
-- escribir cualquier viaje. Es deliberado y encaja con cómo se usa Gotita
-- (para entrar en un viaje hace falta su código, y los participantes son
-- amigos). Lo que SÍ impide es que alguien sin cuenta toque nada.
--
-- No se crea política de DELETE a propósito: desde la app no se borran viajes.

alter table public.viajes enable row level security;

drop policy if exists "viajes_select_autenticados" on public.viajes;
drop policy if exists "viajes_insert_autenticados" on public.viajes;
drop policy if exists "viajes_update_autenticados" on public.viajes;

-- Leer: hace falta para buscar un viaje por su código al unirse.
create policy "viajes_select_autenticados"
  on public.viajes for select
  to authenticated
  using (true);

-- Crear viajes nuevos.
create policy "viajes_insert_autenticados"
  on public.viajes for insert
  to authenticated
  with check (true);

-- Actualizar: apuntarse a un viaje y mover los contadores.
create policy "viajes_update_autenticados"
  on public.viajes for update
  to authenticated
  using (true)
  with check (true);
