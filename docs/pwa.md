# Web y PWA

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

## Piezas de la PWA

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

## Versión y caché de Metro

Perfil enseña la versión de la app abajo del todo (`Gotita v1.0.4`), leída
con `expo-constants` (`Constants.expoConfig?.version`), no importando
`app.json` directamente: es la fuente de verdad en tiempo de ejecución. Bajo
Jest ese manifest no existe (sólo lo inyecta el build de Expo), así que
`tests/perfil.test.tsx` mockea `expo-constants` explícitamente en vez de
fiarse del valor real.

**Toda tarea que cambie comportamiento sube la versión** (`app.json`,
`package.json` y el `"version"` de `package-lock.json`, los tres a la vez).
Comprobado en vivo que subir sólo el número no basta: Metro cachea el bundle
entre builds y, si el caché no se invalida, `expoConfig.version` sigue
sirviendo el número VIEJO aunque `app.json` ya tenga el nuevo (pasó con la
1.0.1, que nunca llegó a verse en la web pese a estar bien escrita en el
JSON). Por eso `build:web` lleva `--clear` de forma permanente (`expo export
--platform web --clear`) — nunca quitarlo para "ir más rápido": ese flag es
la única razón de que el número que se ve en Perfil sea de fiar.
