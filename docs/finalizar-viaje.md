# Finalizar viaje

- Sólo el admin (`viaje.admin === userId`) ve "Finalizar viaje", con el mismo
  `DialogoConfirmar` que restar (ver `docs/confirmacion.md`). `finalizarViaje`
  (lib/viajes.ts) pone `activo=false` y `fecha_finalizacion`.
- Un viaje finalizado es de sólo lectura para TODOS, admin incluido: sin +/−,
  con un aviso y la fecha arriba. La pantalla oculta los botones, pero quien
  lo hace cumplir es `modificarEvento`, que rechaza escribir si la fila
  recién leída ya no está activa: otro móvil puede seguir teniéndolo pintado
  como activo.
- `cargarMisViajes` ya NO filtra `activo`: quien estaba dentro sigue viendo la
  clasificación final. Consecuencias que hay que mantener:
  - `actualizarNombreEnMisViajes` y `actualizarAvatarEnMisViajes` filtran
    `activo` ellas mismas (un viaje cerrado es registro histórico).
  - La autocorrección de avatar de `ViajesProvider` ignora los finalizados;
    si los contara, cada recarga haría una escritura y una segunda lectura
    para siempre.
  - El viaje por defecto prefiere uno en marcha (`viajeActivoPorDefecto`),
    porque Supabase no garantiza orden.
  - "Mis viajes" distingue "Viendo" (el elegido) de "Finalizado" (el estado
    del viaje); pueden convivir en la misma tarjeta.
- El admin de un viaje finalizado puede copiar la clasificación en texto y un
  prompt para una IA (`lib/reporte.ts`). No se llama a ninguna IA desde la
  app: no hay backend donde guardar una clave.
