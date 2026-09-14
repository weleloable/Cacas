# Expo HAS CHANGED

SDK 57. Antes de escribir código nuevo, lee la documentación versionada
exacta en https://docs.expo.dev/versions/v57.0.0/ — no la genérica/latest,
que puede describir una API distinta a la instalada aquí.

## Comandos

```bash
npx expo start --web --host lan --port 8082   # dev, accesible desde el móvil
npx tsc --noEmit                              # chequeo de tipos
npm test                                      # gate tests (jest-expo)
npm run build:web                             # build a dist/ + inyección PWA
npm run desplegar                             # build + publicar en gh-pages
npm run iconos                                # regenera public/iconos (necesita Pillow)
```

## Invariantes que NO se deben romper

- **`public/manifest.json` → `id` es `/Gotita/` absoluto.** No cambiarlo ni
  hacerlo relativo mientras la app viva en esa URL — rompe la instalación
  existente de quien ya la tenga. Detalle y motivo: `docs/pwa.md`.
- **`build:web` siempre lleva `--clear`.** Sin él, Metro sirve una versión
  vieja cacheada aunque `app.json` ya tenga el número nuevo. No quitarlo
  "para ir más rápido". Detalle: `docs/pwa.md`.
- **Toda tarea que cambie comportamiento sube la versión** en `app.json`,
  `package.json` y `package-lock.json` a la vez.
- **Iconos, no emoji.** Todo pasa por `src/lib/iconos.tsx`
  (`<IconoDe spec={...} />`). Importar `@expo/vector-icons` siempre desde el
  submódulo (`import Feather from '@expo/vector-icons/Feather'`), nunca del
  barrel — el barrel mete las ~20 familias de fuentes en el bundle web.
  Detalle: `docs/iconos.md`.
- **Editar este/otros ficheros con script:** `str.replace()` sobre un fichero
  leído con `io.open()` no falla si el texto buscado no existe — reescribe
  igual sin cambiar nada. Verificar con `git diff` después, no fiarse de que
  el script "no dio error".

## Dónde está cada cosa (leer sólo si la tarea lo toca)

- `docs/pwa.md` — manifest, service worker, iconos PWA, `preparar-web.js`,
  por qué la web tarda una visita en funcionar offline, versión y caché de
  Metro.
- `docs/navegacion.md` — pestañas, `ViajesProvider`, por qué vive en la raíz
  y no dentro de `(tabs)`, la carrera de `idPeticion` al hacer logout.
- `docs/iconos.md` — cómo se dibuja el icono de la app y el sistema de
  iconos de línea que sustituye a los emoji.
- `docs/confirmacion.md` — el diálogo de confirmar al restar, la ventana de
  armado de 350ms, la revalidación contra servidor.
- `docs/finalizar-viaje.md` — qué pasa cuando un viaje se cierra, qué sigue
  leyendo/escribiendo sobre viajes finalizados y qué no.
- `docs/tests.md` — qué cubre cada fichero de test y por qué existe.

## Contexto general (rara vez hace falta, pero por si acaso)

- Se sirve en https://weleloable.github.io/Gotita/ desde `gh-pages`,
  `experiments.baseUrl` = `/Gotita`.
- El repo se llamaba `Cacas`, se renombró a `Gotita` (v1.0.4). No crear otro
  repo llamado `Cacas`: rompería la redirección de git para clones viejos.
