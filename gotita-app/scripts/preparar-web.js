/**
 * Post-proceso del build web.
 *
 * Con `web.output: "single"` Expo ignora `src/app/+html.tsx` (sólo lo usa en
 * los modos con render estático), así que el index.html que genera sale sin
 * manifest, sin iconos de iOS y en lang="en". Se comprobó exportando con un
 * +html.tsx puesto: el HTML salía igual que sin él.
 *
 * Este script arregla eso sobre el HTML ya generado, y de paso escribe el
 * 404.html que GitHub Pages necesita para que una SPA sobreviva a un refresco
 * en cualquier ruta que no sea la raíz.
 *
 * La inyección es una función pura para poder probarla sin hacer un build.
 */

const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

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

  return html
    .replace('<html lang="en">', '<html lang="es">')
    // viewport-fit=cover para que el notch no coma la cabecera estando instalada.
    .replace(
      'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
      'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"'
    )
    .replace('</head>', cabeza);
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
  const html = inyectarPwa(readFileSync(indice, 'utf8'), base);

  writeFileSync(indice, html);
  // GitHub Pages sirve 404.html cuando la ruta no existe como fichero. Al ser
  // el mismo index, el router de la app coge el control y la ruta funciona.
  writeFileSync(join(dist, '404.html'), html);
  // Sin esto, GitHub Pages pasa el sitio por Jekyll y se come /_expo/.
  writeFileSync(join(dist, '.nojekyll'), '');

  console.log(`Web preparada para PWA (baseUrl "${base || '/'}").`);
}

if (require.main === module) principal();

module.exports = { inyectarPwa };
