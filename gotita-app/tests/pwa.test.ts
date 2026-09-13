/**
 * Gate test de instalabilidad.
 *
 * Chrome en Android sólo ofrece "Instalar aplicación" si se cumplen todos los
 * criterios de golpe: manifest servido, name/short_name, start_url, display
 * standalone, iconos de 192 y 512, y un service worker con manejador de fetch.
 * Falla uno y no hay aviso de error en ningún sitio: el botón simplemente no
 * aparece. Por eso están aquí, uno a uno.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..');
const publico = join(raiz, 'public');
const manifest = JSON.parse(readFileSync(join(publico, 'manifest.json'), 'utf8'));

/** Lee ancho y alto del IHDR de un PNG, sin dependencias. */
function tamañoPng(ruta: string): { ancho: number; alto: number } {
  const b = readFileSync(ruta);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

describe('manifest.json', () => {
  it('tiene los campos que Chrome exige para instalar', () => {
    expect(manifest.name).toBe('Gotita');
    expect(manifest.short_name).toBe('Gotita');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#0B1020');
    expect(manifest.theme_color).toBe('#0B1020');
  });

  it('start_url y scope son relativos, para no romperse si cambia el baseUrl', () => {
    // Están servidos desde /Cacas/. Absolutos habría que tocarlos a mano el día
    // que la app se mueva de sitio, y nadie se acordaría.
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('trae los iconos de 192 y 512 en variante normal y maskable', () => {
    const clave = (i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`;
    const presentes = manifest.icons.map(clave).sort();
    expect(presentes).toEqual([
      '192x192 any',
      '192x192 maskable',
      '512x512 any',
      '512x512 maskable',
    ]);
  });

  it('cada icono existe y mide de verdad lo que dice medir', () => {
    for (const icono of manifest.icons) {
      const ruta = join(publico, icono.src);
      expect(existsSync(ruta)).toBe(true);
      const [ancho, alto] = icono.sizes.split('x').map(Number);
      expect(tamañoPng(ruta)).toEqual({ ancho, alto });
    }
  });

  it('el apple-touch-icon existe y es de 180, que es lo que pide iOS', () => {
    const ruta = join(publico, 'iconos/apple-touch-icon.png');
    expect(existsSync(ruta)).toBe(true);
    expect(tamañoPng(ruta)).toEqual({ ancho: 180, alto: 180 });
  });
});

describe('service worker', () => {
  const sw = readFileSync(join(publico, 'sw.js'), 'utf8');

  it('tiene manejador de fetch, que es el criterio real de Chrome', () => {
    expect(sw).toMatch(/addEventListener\(\s*['"]fetch['"]/);
  });

  it('no cachea nada de otro origen: Supabase no se sirve de caché', () => {
    expect(sw).toContain('url.origin !== self.location.origin');
  });

  it('las navegaciones van a red primero, para no clavar la app en una versión vieja', () => {
    expect(sw).toMatch(/mode === 'navigate'/);
    expect(sw).toContain('redPrimero');
  });
});

describe('inyección en el HTML del build', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { inyectarPwa } = require('../scripts/preparar-web.js');

  // El index.html que escupe `expo export`, recortado a lo que toca el script.
  const original = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '  <head>',
    '    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
    '    <title>Gotita</title>',
    '  </head>',
    '  <body><div id="root"></div></body>',
    '</html>',
  ].join('\n');

  const resultado: string = inyectarPwa(original, '/Cacas');

  it('enlaza el manifest y el icono de iOS con el baseUrl delante', () => {
    expect(resultado).toContain('<link rel="manifest" href="/Cacas/manifest.json" />');
    expect(resultado).toContain('href="/Cacas/iconos/apple-touch-icon.png"');
  });

  it('registra el service worker con el scope correcto', () => {
    expect(resultado).toContain("register('/Cacas/sw.js', { scope: '/Cacas/' })");
  });

  it('pone el idioma en castellano y el viewport a pantalla completa', () => {
    expect(resultado).toContain('<html lang="es">');
    expect(resultado).toContain('viewport-fit=cover');
  });

  it('funciona igual servido desde la raíz', () => {
    const enRaiz: string = inyectarPwa(original, '');
    expect(enRaiz).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(enRaiz).toContain("register('/sw.js', { scope: '/' })");
  });

  it('es idempotente: pasarlo dos veces no duplica el manifest', () => {
    const dosVeces: string = inyectarPwa(resultado, '/Cacas');
    expect(dosVeces).toBe(resultado);
    expect(dosVeces.match(/rel="manifest"/g)).toHaveLength(1);
  });
});

// Estos sólo corren si hay un build hecho. Es la comprobación de que Expo
// copia public/ al dist, que es la pieza de la que depende todo lo demás.
const dist = join(raiz, 'dist');
const hayBuild = existsSync(join(dist, 'index.html'));
(hayBuild ? describe : describe.skip)('dist/ generado', () => {
  it('lleva manifest, service worker e iconos en la raíz del sitio', () => {
    for (const f of ['manifest.json', 'sw.js', 'iconos/icono-512.png', '.nojekyll']) {
      expect(existsSync(join(dist, f))).toBe(true);
    }
  });

  it('tiene 404.html idéntico al index, para que GitHub Pages no rompa las rutas', () => {
    expect(readFileSync(join(dist, '404.html'), 'utf8')).toBe(
      readFileSync(join(dist, 'index.html'), 'utf8')
    );
  });

  it('el index ya trae el manifest inyectado', () => {
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).toContain(
      '<link rel="manifest" href="/Cacas/manifest.json" />'
    );
  });
});
