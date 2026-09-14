# Tests

`npm test`. Jest con el preset `jest-expo`, tests en `tests/`. Sin red: el
`fetch` global revienta a propósito en `tests/preparar.ts`.

- `viaje.test.tsx` — la pantalla de verdad: que el − no resta, que confirmar
  sí, que un toque temprano no confirma, que un conflicto de servidor no
  escribe y avisa.
- `DialogoConfirmar.test.tsx` — el diálogo aislado: ventana de armado,
  cancelar inmediato, fondo, Escape.
- `sw.test.ts` — ejecuta `public/sw.js` en un contexto aislado con `caches` y
  `fetch` falsos. Comportamiento, no grep sobre el fuente. Incluye una prueba
  de que el guardia de origen protege de verdad (con una URL de otro origen
  que imita las rutas cacheables, para que no pase por casualidad).
- `pwa.test.ts` — manifest, iconos (mide los PNG de verdad, por criterio no
  por lista exacta) e inyección en el HTML contra el fixture del build real.
- `instalacion.test.ts` — detección de iOS (incluido el iPad moderno, que se
  hace pasar por Mac) y de Safari frente a Chrome/Firefox para iOS.
- `viajesContext.test.tsx` — el estado compartido: cambiar el activo se ve
  sin recargar, un refresco de sesión sí recarga, `recargar(false)` no toca
  `error`.
- `mis-viajes.test.tsx`, `perfil.test.tsx` — las pantallas nuevas, montadas
  con el `ViajesProvider` real (no una versión de mentira del contexto).
- `viajes.test.ts` — `modificarEvento` (incluido el rechazo en viaje
  finalizado), propagación de nombre/foto (que no toca finalizados),
  `cargarMisViajes` y `finalizarViaje`, ejecutando la implementación real y
  mockeando sólo `supabase`.
- `reporte.test.ts` — el texto copiable de la clasificación y el prompt de IA:
  orden, nombre visible del evento, categorías que ya no existen.
- `crear.test.tsx` — que tras "Empezar a contar" la pestaña vuelve al
  formulario en blanco.
- `iconos.test.ts` — comprueba contra el glyphmap real instalado que cada
  nombre de icono usado (en `ICONOS`, en `CATEGORIAS`, en el diálogo de
  confirmación) existe de verdad, y que la gota es un único spec compartido.
- `unirme.test.tsx` — monta `Unirme` y "Mi Viaje" JUNTAS bajo el mismo
  `ViajesProvider`, sin desmontar entre medias (así es como conviven de
  verdad dos rutas del mismo Stack). Un test que renderizase `unirme.tsx`
  sola no habría detectado que unirse no avisaba al contexto compartido.
