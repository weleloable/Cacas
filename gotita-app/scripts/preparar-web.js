/**
 * Post-proceso del build web.
 *
 * Con `web.output: "single"` Expo ignora `src/app/+html.tsx` (sólo lo usa en
 * los modos con render estático), así que el index.html que genera sale sin
 * manifest, sin iconos de iOS y en lang="en". Se comprobó exportando con un
 * +html.tsx puesto: el HTML salía igual que sin él.
 *
 * Este script hace tres cosas sobre el `dist/` ya generado:
 *  1. completa el <head> con lo que hace instalable a la app,
 *  2. escribe 404.html (GitHub Pages lo sirve en las rutas que no existen como
 *     fichero, y así la SPA sobrevive a un refresco) y .nojekyll,
 *  3. reescribe sw.js con el hash del bundle, para precargarlo y para que la
 *     caché vieja se borre sola en cada despliegue.
 *
 * Todo funciona a base de sustituir texto exacto sobre lo que escupe Expo, o
 * sea que un cambio de plantilla en un SDK nuevo lo rompe. Por eso cada
 * sustitución se comprueba y el script sale con error si alguna no encaja,
 * en vez de publicar en silencio una web que ya no se puede instalar.
 */

const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

class ErrorDePreparacion extends Error {}

/** Sustituye una vez, y revienta si no encontró qué sustituir. */
function sustituir(texto, buscado, puesto, queEs) {
  if (!texto.includes(buscado)) {
    throw new ErrorDePreparacion(
      `No se encontró ${queEs} en la salida del build.\n` +
        `  Buscaba: ${buscado}\n` +
        `  Probablemente Expo cambió su plantilla en un SDK nuevo. ` +
        `Hay que actualizar scripts/preparar-web.js o la web dejará de ser instalable.`
    );
  }
  return texto.replace(buscado, puesto);
}

/**
 * Mete en el <head> todo lo que hace instalable a la app.
 * @param {string} html  El index.html tal cual lo escupe `expo export`.
 * @param {string} base  El baseUrl, sin barra final ("" si está en la raíz).
 */
function inyectarPwa(html, base) {
  if (html.includes('rel="manifest"')) return html; // idempotente: no duplica.

  const cabeza = `
    <link rel="manifest" href="${base}/manifest.json" />
    <link rel="apple-touch-icon" href="${base}/iconos/apple-touch-icon.png" />
    <meta name="application-name" content="Gotita" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Gotita" />
    <style>html,body{background-color:#0B1020}body{overscroll-behavior-y:none}</style>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker
            .register('${base}/sw.js', { scope: '${base}/' })
            .catch(function (e) { console.warn('Service worker no registrado:', e); });
        });
      }
    </script>
  </head>`;

  let salida = sustituir(html, '<html lang="en">', '<html lang="es">', 'el idioma del <html>');
  // viewport-fit=cover para que el notch no coma la cabecera estando instalada.
  salida = sustituir(
    salida,
    'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
    'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"',
    'la etiqueta viewport'
  );
  return sustituir(salida, '</head>', cabeza, 'el cierre del <head>');
}

/**
 * Deja el service worker con la lista real de cosas a precargar y una versión
 * que cambia en cada build.
 * @param {string} sw       El contenido de public/sw.js.
 * @param {string[]} rutas  Rutas a precargar, relativas al scope ("./algo").
 * @param {string} version  Identificador del build, para el nombre de caché.
 */
function prepararServiceWorker(sw, rutas, version) {
  let salida = sustituir(
    sw,
    "const VERSION = 'desarrollo';",
    `const VERSION = ${JSON.stringify(version)};`,
    'la constante VERSION del service worker'
  );
  return sustituir(
    salida,
    "const DEL_ARRANQUE = ['./', './manifest.json'];",
    `const DEL_ARRANQUE = ${JSON.stringify(rutas)};`,
    'la lista DEL_ARRANQUE del service worker'
  );
}

/**
 * Saca del index.html las rutas de los bundles JS que hay que precargar.
 * Sin el bundle en caché, abrir la app sin red da pantalla en blanco: el
 * index cacheado pide un JS que no está en ningún sitio.
 */
function rutasDelBundle(html, base) {
  const encontradas = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const bundles = encontradas.filter((r) => r.includes('/_expo/static/'));
  if (bundles.length === 0) {
    throw new ErrorDePreparacion(
      'No se encontró ningún bundle /_expo/static/ en el index.html. ' +
        'Sin él, la app no arranca sin red.'
    );
  }
  // El sw las resuelve contra su propio scope, que ya es el baseUrl.
  const prefijo = base ? `${base}/` : '/';
  return bundles.map((r) => `./${r.startsWith(prefijo) ? r.slice(prefijo.length) : r.replace(/^\//, '')}`);
}

function principal() {
  const raiz = join(__dirname, '..');
  const dist = join(raiz, 'dist');
  const indice = join(dist, 'index.html');

  if (!existsSync(indice)) {
    console.error('No hay dist/index.html. Ejecuta antes: npx expo export --platform web');
    process.exit(1);
  }

  const base = (require(join(raiz, 'app.json')).expo.experiments?.baseUrl ?? '').replace(/\/$/, '');
  const original = readFileSync(indice, 'utf8');
  const html = inyectarPwa(original, base);

  writeFileSync(indice, html);
  // GitHub Pages sirve 404.html cuando la ruta no existe como fichero. Al ser
  // el mismo index, el router de la app coge el control y la ruta funciona.
  writeFileSync(join(dist, '404.html'), html);
  // Sin esto, GitHub Pages pasa el sitio por Jekyll y se come /_expo/.
  writeFileSync(join(dist, '.nojekyll'), '');

  const bundles = rutasDelBundle(original, base);
  const precarga = ['./', './manifest.json', './iconos/icono-192.png', './iconos/icono-512.png', ...bundles];
  // El hash del bundle ya identifica el build: si el código cambia, cambia.
  const version = (bundles[0].match(/entry-([0-9a-f]+)\.js$/)?.[1] ?? String(Date.now())).slice(0, 12);

  const swDist = join(dist, 'sw.js');
  if (!existsSync(swDist)) {
    throw new ErrorDePreparacion('No se copió public/sw.js al dist. ¿Se ha renombrado public/?');
  }
  writeFileSync(swDist, prepararServiceWorker(readFileSync(swDist, 'utf8'), precarga, version));

  // Comprobación final: que lo que se va a publicar tiene de verdad las piezas.
  for (const fichero of ['manifest.json', 'sw.js', 'iconos/icono-192.png', 'iconos/icono-512.png']) {
    if (!existsSync(join(dist, fichero))) {
      throw new ErrorDePreparacion(`Falta ${fichero} en dist/. La app no será instalable.`);
    }
  }

  console.log(`Web preparada para PWA (baseUrl "${base || '/'}", sw ${version}).`);
  console.log(`Precarga: ${precarga.join(' ')}`);
}

if (require.main === module) {
  try {
    principal();
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { inyectarPwa, prepararServiceWorker, rutasDelBundle, ErrorDePreparacion };
