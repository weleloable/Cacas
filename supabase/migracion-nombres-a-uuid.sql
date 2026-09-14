-- Migración: pasar las claves del JSON `usuarios` de nombre a UUID.
--
-- Los viajes creados con la versión Streamlit guardan a cada persona bajo su
-- nombre ('Dudu', 'Rodri'...). La app nueva usa el user.id de Supabase, que no
-- cambia aunque alguien se cambie el nombre o entre con Google. Este script
-- mueve cada entrada a su clave nueva sin perder los contadores.
--
-- CÓMO USARLO
--   1. Cada persona que quiera conservar su historial necesita una cuenta.
--      Que entre en la app y use "📝 Crear cuenta".
--   2. En Supabase -> Authentication -> Users, copia el UUID (columna UID) de
--      cada una.
--   3. Rellena el mapeo de abajo: 'nombre viejo' -> 'uuid'.
--      Borra las líneas de quien todavía no tenga cuenta; se quedarán con su
--      clave-nombre y se podrán migrar más adelante repitiendo este script.
--   4. Supabase -> SQL Editor -> New query -> pegar -> Run.
--
-- Es seguro ejecutarlo varias veces: una entrada ya migrada se ignora.

do $$
declare
  -- ⬇️ EDITA SÓLO ESTO ⬇️
  mapeo jsonb := jsonb_build_object(
    'Dudu',      'PENDIENTE',
    'DuduTest2', 'PENDIENTE',
    'Rodri',     'PENDIENTE',
    'Peobol',    'PENDIENTE'
  );
  -- ⬆️ EDITA SÓLO ESTO ⬆️

  nombre_viejo text;
  uuid_nuevo   text;
  tocados      integer;
begin
  for nombre_viejo, uuid_nuevo in select * from jsonb_each_text(mapeo) loop

    if uuid_nuevo = 'PENDIENTE' or uuid_nuevo is null or uuid_nuevo = '' then
      raise notice 'Saltando "%": todavía no tiene cuenta.', nombre_viejo;
      continue;
    end if;

    -- Mueve la entrada a la clave nueva. Se conserva el bloque `eventos` tal
    -- cual y se rellena `nombre` con el nombre viejo, que en los viajes más
    -- antiguos venía a null.
    update public.viajes
       set usuarios = (usuarios - nombre_viejo)
                      || jsonb_build_object(
                           uuid_nuevo,
                           jsonb_set(
                             usuarios -> nombre_viejo,
                             '{nombre}',
                             to_jsonb(nombre_viejo)
                           )
                         )
     where usuarios ? nombre_viejo;

    get diagnostics tocados = row_count;
    raise notice 'Migrado "%" -> % (% viaje/s).', nombre_viejo, uuid_nuevo, tocados;

    -- Quien creó el viaje también se guardaba por nombre.
    update public.viajes
       set admin = uuid_nuevo
     where admin = nombre_viejo;

  end loop;
end $$;

-- Comprobación: después de ejecutarlo, las claves deberían ser UUIDs.
-- select id, nombre, admin, jsonb_object_keys(usuarios) as clave from public.viajes order by id;
