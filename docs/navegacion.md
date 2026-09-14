# Navegación

Cuatro pestañas abajo (expo-router `Tabs`), sólo con sesión: Mi Viaje (gota),
Mis viajes (maleta), Crear viaje (avión de papel), Perfil (persona). Iconos
de línea, no emoji — ver `docs/iconos.md`.

- `src/app/(tabs)/_layout.tsx` — un único guard de sesión para las cuatro
  (antes cada pantalla comprobaba `session` por su cuenta). Sin sesión,
  `<Redirect href="/login" />`; con sesión, envuelve todo en
  `<ViajesProvider>`.
- `src/lib/viajesContext.tsx` — qué viajes hay y cuál es el activo,
  compartido entre "Mi Viaje" y "Mis viajes": elegir un viaje en una pestaña
  tiene que verse en la otra sin pedirlo otra vez a Supabase. Reproduce el
  efecto que antes tenía `viaje.tsx`: recarga al montar Y cada vez que
  cambia la identidad de `session` (Supabase dispara `TOKEN_REFRESHED` al
  volver a la pestaña).
- Los ficheros de ruta se llaman `viaje.tsx` y `crear.tsx` (no `mi-viaje.tsx`
  ni `crear-viaje.tsx`) a propósito: son los nombres de antes de haber
  pestañas, y varios `router.replace('/viaje')` / `router.push('/crear')`
  siguen intactos porque la ruta no cambió, sólo el título de la pestaña
  (`options={{ title: 'Mi Viaje' }}`). `(tabs)` es un grupo de rutas de
  expo-router: no aparece en la URL.
- `unirme.tsx` se queda FUERA de las pestañas (ruta suelta, empujada con
  `router.push('/unirme')` desde "Mis viajes" y desde el estado vacío de "Mi
  Viaje"): es una acción puntual, no un sitio en el que uno "vive".
- `ViajesProvider` vive en el `_layout.tsx` RAÍZ, no dentro de
  `(tabs)/_layout.tsx`. `unirme` es una ruta HERMANA de `(tabs)` en el mismo
  Stack, no una descendiente suya: aunque las dos convivan montadas a la vez
  (un Stack no desmonta la pantalla de debajo al empujar otra encima), el
  contexto sólo llega a través del árbol de componentes, no por estar en el
  mismo Stack. Ponerlo sólo alrededor de `<Tabs>` habría dejado a
  `unirme.tsx` sin forma de avisar de un viaje nuevo — justo el bug que hubo
  aquí la primera vez: unirse escribía en Supabase pero "Mi Viaje" seguía
  enseñando el viaje anterior hasta un pull-to-refresh, porque las pestañas
  no se remontan al navegar entre ellas.
- Efecto secundario de vivir en la raíz: cerrar sesión ya NO desmonta el
  proveedor (antes, viviendo dentro de `(tabs)`, sí lo hacía, y eso limpiaba
  su estado gratis). El propio `ViajesProvider` vacía `viajes`/`error`
  explícitamente en cuanto `userId` queda vacío — si no lo hiciera, en un
  móvil compartido entre varias personas del viaje, quien entrase después
  vería un parpadeo con los viajes de quien usó la app justo antes.
  El vaciado por sí solo no basta: una `recargar()` que ya estuviera en
  vuelo desde ANTES del logout puede resolver después y repoblar `viajes`
  con los datos de quien ya se fue. `idPeticion` (un contador en un `ref`)
  marca cuál es la petición más reciente; al resolver, cada llamada
  comprueba que sigue siéndolo antes de aplicar su resultado, y el propio
  vaciado de logout también incrementa el contador para invalidar lo que
  hubiera en vuelo.
- Perfil permite cambiar el nombre. Eso NO es sólo `auth.updateUser`: el
  nombre de cada viaje es una copia guardada en su JSON `usuarios`, así que
  `actualizarNombreEnMisViajes` (lib/viajes.ts) recorre los viajes activos
  del usuario y actualiza esa copia en cada uno, con `Promise.allSettled` —
  si un viaje falla al escribir no debe tapar que la cuenta y el resto de
  viajes sí se actualizaron. Los viajes ya finalizados no se tocan (se
  quedan con el nombre que tenían, como registro histórico — ver
  `docs/finalizar-viaje.md`).
- "Crear viaje" resetea su estado local ANTES de `router.replace('/viaje')`
  (`alEmpezarAContar`): como las pestañas no se desmontan, sin eso volver a
  la pestaña enseñaba la pantalla de éxito del viaje anterior.
