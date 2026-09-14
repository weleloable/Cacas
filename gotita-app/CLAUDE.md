@AGENTS.md

## Comandos

```bash
npx expo start --web --host lan --port 8082   # dev, accesible desde el móvil
npx tsc --noEmit                              # chequeo de tipos
npm test                                      # gate tests (jest-expo)
npm run build:web                             # build a dist/ + inyección PWA
npm run desplegar                             # build + publicar en gh-pages
npm run iconos                                # regenera public/iconos (necesita Pillow)
```

## Web y PWA

Se sirve en https://weleloable.github.io/Gotita/ desde la rama `gh-pages`.
`experiments.baseUrl` es `/Gotita`, así que todo cuelga de ahí.

El repo se llamaba `Cacas` y se renombró a `Gotita` (v1.0.4). GitHub redirige
el repo, pero **no redirige GitHub Pages**: `/Cacas/` quedó en 404 a
propósito (corte limpio, sin página de redirección) y quien tuviera la app
instalada tuvo que reinstalarla desde `/Gotita/`. Crear otro repo llamado
`Cacas` rompería la redirección de git de GitHub para clones viejos.

Expo SDK 57 no genera manifest PWA y, con `web.output: "single"`, **ignora
`src/app/+html.tsx`** (comprobado: el HTML sale igual con él que sin él). Por
eso el `<head>` se completa después del export, en `scripts/preparar-web.js`,
que además escribe `404.html` (para que GitHub Pages no rompa las rutas de la
SPA) y `.nojekyll`. El script **falla el build** si alguna de sus
sustituciones de texto no encaja contra lo que Expo generó — mejor que
publicar en silencio una web que ya no se puede instalar. El HTML crudo de
referencia está capturado en `tests/fixtures/expo-index.html`; al actualizar
Expo hay que recapturarlo (`npx expo export --platform web` y copiar el
`dist/index.html` de antes de correr `preparar-web.js`).

Piezas de la PWA:

- `public/manifest.json` — Expo copia `public/` a la raíz de `dist/`.
  **`id` es `/Gotita/`, absoluto, y no debe cambiarse ni hacerse relativo
  mientras la app viva en esa URL.** Sólo cambia si cambia la URL (como en el
  renombrado), y entonces debe ser `baseUrl + "/"`: `tests/pwa.test.ts` lo
  deriva de `app.json`, así que no pueden desalinearse.
  El spec resuelve `id` contra el *origin* del documento, no contra la carpeta
  del manifest ni contra `start_url`: `new URL(id, origin)`. Un `id` relativo
  como `"./"` resolvería a `https://weleloable.github.io/` — la raíz de TODO
  el dominio de GitHub Pages del usuario, no sólo `/Gotita/` — y cambiar su
  valor resuelto hace que Chrome dé de alta una instalación nueva en vez de
  actualizar la existente (icono duplicado para quien ya la tuviera
  instalada). `start_url` y `scope` sí son relativos (`"./"`), y esos dos no
  tienen este problema.
- `public/sw.js` — service worker. Existe porque Chrome no ofrece instalar sin
  uno que tenga manejador de `fetch`. Red primero en navegaciones, caché
  primero en `/_expo/static/` e `/iconos/` (llevan hash), nada de otro origen
  se toca (Supabase jamás sale de caché). `VERSION` y `DEL_ARRANQUE` los
  reescribe el build con el hash del bundle: nada que subir a mano, y la
  caché vieja se borra sola en cada despliegue. El bundle va precargado, así
  que offline funciona **a partir de la segunda visita** — la primera
  necesita red, porque el registro del service worker ocurre en el evento
  `load`, después de que el bundle ya se haya bajado sin pasar por él.
- `public/iconos/` — generados por `scripts/generar-iconos.py` desde
  `assets/images/icon.png`. 192/512 normales y maskable, más
  `apple-touch-icon` de 180.
- `src/componentes/AvisoInstalar.tsx` — en Android abre el diálogo nativo de
  Chrome; en iOS explica dónde está "Añadir a pantalla de inicio" (Safari no
  tiene diálogo). El evento `beforeinstallprompt` lo captura un script en el
  `<head>` (inyectado por `preparar-web.js`), **no** un `useEffect` de React:
  Chrome lo dispara una sola vez por carga, normalmente antes de que la app
  monte nada, y este componente sólo vive dentro de la pantalla de viaje —
  si el usuario arranca en `/login`, un listener puesto ahí llegaría tarde y
  el aviso no aparecería nunca en esa carga. En Chrome/Firefox de iOS (que por
  dentro son Safari, Apple obliga a WebKit, pero sin su menú de compartir) se
  avisa de que hace falta abrir con Safari.

## Navegación

Cuatro pestañas abajo (expo-router `Tabs`), sólo con sesión: Mi Viaje (gota),
Mis viajes (maleta), Crear viaje (avión de papel), Perfil (persona). Iconos
de línea, no emoji — ver "Iconos en vez de emoji" más abajo.

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
  nombre de cada viaje es una copia guardada en su JSON `usuarios` (ver
  "Decisiones tomadas"), así que `actualizarNombreEnMisViajes` (lib/viajes.ts)
  recorre los viajes activos del usuario y actualiza esa copia en cada uno,
  con `Promise.allSettled` — si un viaje falla al escribir no debe tapar que
  la cuenta y el resto de viajes sí se actualizaron. Los viajes ya
  finalizados no se tocan (se quedan con el nombre que tenían, como registro
  histórico).
- "Crear viaje" resetea su estado local ANTES de `router.replace('/viaje')`
  (`alEmpezarAContar`): como las pestañas no se desmontan, sin eso volver a
  la pestaña enseñaba la pantalla de éxito del viaje anterior.
- Perfil enseña la versión de la app abajo del todo (`Gotita v1.0.4`), leída
  con `expo-constants` (`Constants.expoConfig?.version`), no importando
  `app.json` directamente: es la fuente de verdad en tiempo de ejecución.
  Bajo Jest ese manifest no existe (sólo lo inyecta el build de Expo), así
  que `tests/perfil.test.tsx` mockea `expo-constants` explícitamente en vez
  de fiarse del valor real.
- **Toda tarea que cambie comportamiento sube la versión** (`app.json`,
  `package.json` y el `"version"` de `package-lock.json`, los tres a la vez).
  Comprobado en vivo que subir sólo el número no basta: Metro cachea el
  bundle entre builds y, si el caché no se invalida, `expoConfig.version`
  sigue sirviendo el número VIEJO aunque `app.json` ya tenga el nuevo (pasó
  con la 1.0.1, que nunca llegó a verse en la web pese a estar bien escrita
  en el JSON). Por eso `build:web` lleva `--clear` de forma permanente
  (`expo export --platform web --clear`) — nunca quitarlo para "ir más
  rápido": ese flag es la única razón de que el número que se ve en Perfil
  sea de fiar.

## Icono

Gota dibujada por vector en `scripts/generar-iconos.py` (no un emoji, no una
imagen de origen): silueta hueca, trazo negro de grosor medio, fondo y
relleno transparentes. Cada tamaño se genera de cero con su propio grosor
proporcional — redimensionar un único master deja un trazo fino borroso o
dentado. Dos excepciones, ambas por limitación de la plataforma, no por
gusto:

- `apple-touch-icon` va sobre fondo blanco porque iOS no respeta el canal
  alfa (pinta el hueco de negro; negro sobre negro sería invisible).
- `android-icon-foreground.png` lleva trazo BLANCO, no negro: es la capa
  "foreground" del icono adaptativo de Android, que se compone sobre
  `android.adaptiveIcon.backgroundColor` de `app.json` (`#0B1020`, el mismo
  azul-negro de la app) — no sobre transparente de verdad. Negro sobre ese
  fondo da un contraste de ~1.1:1, invisible en el launcher.

Para regenerarlo tras tocar la geometría: `npm run iconos`.

## Iconos en vez de emoji

Toda la interfaz usaba emoji (💧💩🍺🏆🧳✈️👤🎉📲🔑📝🗑️). Sustituidos por
iconos de línea minimalistas: dan sensación de app cuidada, no de "hecho
deprisa con IA".

- `src/lib/iconos.tsx` es el único sitio que sabe dibujar un icono. Un
  `IconoSpec` (`{ fuente: 'gota' }` | `{ fuente: 'feather', nombre }` |
  `{ fuente: 'mci', nombre }`) es una REFERENCIA a un icono, no el icono en
  sí: así se puede guardar como dato plano en `categorias.ts` o en el
  resultado de `textosDeConfirmacion`, y decidir cómo se pinta sólo al
  llegar a `<IconoDe spec={...} />`.
- La gota (`ICONOS.gota`) es la MISMA silueta que el icono de la app —
  mismo path SVG, generado con la misma geometría de
  `scripts/generar-iconos.py` (envolvente circulo+ápice), no una imitación
  con otra librería. Verificado en `tests/iconos.test.ts` que categoría
  Gotitas y evento `pises` usan ese mismo spec, no uno parecido.
- Todo lo demás sale de `@expo/vector-icons` (Feather / MaterialCommunity),
  que ya viene con Expo. **Importar desde el submódulo, no del barrel**:
  `import Feather from '@expo/vector-icons/Feather'`, no
  `import { Feather } from '@expo/vector-icons'`. El barrel reexporta las
  ~20 familias de iconos del paquete, y Metro mete el `.ttf` de cada una en
  el bundle web aunque sólo se use una — de 4MB en 19 fuentes a 1.4MB en
  las 2 que hacen falta, comprobado inspeccionando `dist/` tras el build.
- Un nombre de icono mal escrito (`'toilett'` en vez de `'toilet'`) no lo
  pilla TypeScript de forma fiable y da un icono en blanco en producción sin
  ningún aviso. `tests/iconos.test.ts` abre el glyphmap real instalado y
  comprueba que cada nombre usado en la app existe de verdad.

## Confirmación al restar

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

## Finalizar viaje

- Sólo el admin (`viaje.admin === userId`) ve "Finalizar viaje", con el mismo
  `DialogoConfirmar` que restar. `finalizarViaje` (lib/viajes.ts) pone
  `activo=false` y `fecha_finalizacion`.
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

## Tests

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

## Nota para quien edite este fichero con un script

Un `str.replace()` sobre un fichero leído con `io.open()` no falla si el texto
buscado no existe: simplemente no hace nada, y el fichero se reescribe igual.
Verificar después con `git diff` o releyendo el resultado, no dar por hecho
que un script sin errores hizo el cambio.
