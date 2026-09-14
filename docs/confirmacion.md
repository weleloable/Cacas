# Confirmación al restar

- Restar pide confirmación, sumar no. Borrar tiene que costar más que añadir.
  El diálogo es propio (`src/componentes/DialogoConfirmar.tsx`) porque
  `Alert.alert` de react-native no hace nada en web.
- Confirmar ignora pulsaciones durante `MS_DE_ARMADO` (350ms) al abrirse.
  react-native-web monta el modal clicable a pantalla completa desde el primer
  frame mientras se funde 250ms (`animatedIn` no lleva `pointerEvents: 'none'`,
  `animatedOut` sí). Sin esa ventana, el segundo toque de un doble toque en −
  cae sobre "Sí, quitar" invisible y resta sin que se vea nada. **Cancelar no
  lleva esa espera**: cancelar pronto nunca destruye nada, y gatearlo también
  producía un dimado de "pulsado" que no hacía nada durante 350ms — una
  confirmación visual falsa.
- La revalidación al confirmar es contra el **servidor**, no contra el estado
  local: `modificarEvento(..., valorEsperado)` relee la fila justo antes de
  escribir y lanza `ConflictoDeConcurrencia` si el valor real no es el que el
  diálogo prometió. Comparar sólo contra `viaje` (estado local) no basta,
  porque el cliente puede llevar el mismo retraso que el diálogo: el caso real
  es que OTRO dispositivo haya sumado entre medias, y el cliente local no se
  entera de eso salvo que recargue.
- El aviso de conflicto sube el scroll al principio (`mostrarError` en
  `viaje.tsx`), porque el botón − suele estar lejos de la cabecera. La
  recarga que deshace el pintado optimista tras un fallo (`recargar(false)`)
  no toca `error`: si lo tocara, su propio `setError(null)` de éxito borraría
  el aviso justo después de haberlo puesto.
- El botón atrás de Android **no** cancela el diálogo en el build web:
  `onRequestClose` sólo se dispara con Escape en react-native-web.
