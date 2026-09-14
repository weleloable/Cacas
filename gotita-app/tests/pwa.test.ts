/**
 * Gate test de instalabilidad.
 *
 * Chrome en Android sólo ofrece "Instalar aplicación" si se cumplen todos los
 * criterios de golpe: manifest servido, name/short_name, start_url, display
 * standalone, iconos de 192 y 512, y un service worker con manejador de fetch.
 * Falla uno y no hay aviso de error en ningún sitio: el botón simplemente no
 * aparece. Por eso están aquí, uno a uno.
 *
 * El comportamiento del service worker se prueba ejecutándolo, en sw.test.ts.
 * Aquí sólo va lo estático: el manifest, los iconos y la inyección en el HTML.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..');
const publico = join(raiz, 'public');
const manifest = JSON.parse(readFileSync(join(publico, 'manifest.json'), 'utf8'));
// El baseUrl real, leído de app.json igual que hace preparar-web.js. Nada de
// "/Gotita" escrito a mano en estos tests: cuando el repo se renombró (antes
// Cacas) había diez copias sueltas de la ruta que había que acordarse de tocar.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BASE: string = require('../app.json').expo.experiments.baseUrl;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { inyectarPwa, rutasDelBundle, ErrorDePreparacion } = require('../scripts/preparar-web.js');

/** Lee ancho y alto del IHDR de un PNG, sin dependencias. */
function tamañoPng(ruta: string): { ancho: number; alto: number } {
  const b = readFileSync(ruta);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

type Icono = { src: string; sizes: string; type: string; purpose: string };

/** ¿Hay un icono PNG de al menos `lado` px con este propósito? */
function hayIcono(lado: number, purpose: string): boolean {
  return manifest.icons.some((i: Icono) => {
    const [ancho] = i.sizes.split('x').map(Number);
    return (
      i.type === 'image/png' &&
      ancho >= lado &&
      i.purpose.split(/\s+/).includes(purpose) &&
      existsSync(join(publico, i.src))
    );
  });
}

describe('manifest.json', () => {
  it('tiene los campos que Chrome exige para instalar', () => {
    expect(manifest.name || manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.prefer_related_applications).toBeFalsy();
  });

  it('start_url y scope son relativos, para no romperse si cambia el baseUrl', () => {
    // Están servidos desde el baseUrl. Absolutos habría que tocarlos a mano el
    // día que la app se mueva de sitio (ya pasó: Cacas -> Gotita).
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  it('id es absoluto a propósito, y es la ruta del baseUrl', () => {
    // Contraintuitivo y por eso este test existe. El spec resuelve `id` contra
    // el ORIGEN del documento, no contra la carpeta del manifest ni contra
    // start_url: new URL(id, origin). "./" resolvería a
    // "https://weleloable.github.io/", que es la RAÍZ DE TODO EL SITIO
    // weleloable.github.io, no la carpeta de la app. Con ese valor, la
    // instalación de Gotita reclamaría el origin entero y cualquier futura PWA
    // del mismo usuario en ese dominio colisionaría con ella.
    //
    // Además, `id` es la identidad de la instalación: cambiar su valor
    // resuelto hace que Chrome dé de alta una instalación NUEVA en vez de
    // actualizar la existente, duplicando el icono de quien ya la tuviera.
    // Por eso no se toca mientras la app viva en la misma URL. La única vez
    // que cambia es cuando cambia la URL (renombrar el repo mueve GitHub
    // Pages y ya obliga a reinstalar), y entonces tiene que seguir al baseUrl:
    // un id de la ruta vieja sobre un sitio servido en la nueva sería una
    // identidad huérfana.
    expect(manifest.id).toMatch(/^\/.+\/$/);
    expect(manifest.id).toBe(`${BASE}/`);
  });

  it('los colores coinciden con el tema de la app, para que no pegue un fogonazo al abrir', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { tema } = require('@/lib/tema');
    expect(manifest.background_color).toBe(tema.fondo);
    expect(manifest.theme_color).toBe(tema.fondo);
  });

  it('cumple el criterio de iconos: >=192 y >=512 en purpose any', () => {
    // Por criterio, no por lista exacta: añadir tamaños no debe romper el test.
    expect(hayIcono(192, 'any')).toBe(true);
    expect(hayIcono(512, 'any')).toBe(true);
  });

  it('trae maskable, que es lo que evita que Android recorte el dibujo', () => {
    expect(hayIcono(192, 'maskable')).toBe(true);
    expect(hayIcono(512, 'maskable')).toBe(true);
  });

  it('cada icono existe y mide de verdad lo que dice medir', () => {
    for (const icono of manifest.icons as Icono[]) {
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

describe('inyección en el HTML del build', () => {
  // El index.html real que escupe `expo export`, capturado del build. No es una
  // plantilla escrita a mano: si Expo cambia la suya en un SDK nuevo, esta se
  // queda vieja, y para eso está el test de "revienta si no encaja".
  const original = readFileSync(join(__dirname, 'fixtures/expo-index.html'), 'utf8');
  const resultado: string = inyectarPwa(original, BASE);

  it('el fixture es el HTML crudo de Expo, sin nada inyectado', () => {
    expect(original).toContain('<html lang="en">');
    expect(original).not.toContain('rel="manifest"');
  });

  it('enlaza el manifest y el icono de iOS con el baseUrl delante', () => {
    expect(resultado).toContain(`<link rel="manifest" href="${BASE}/manifest.json" />`);
    expect(resultado).toContain(`href="${BASE}/iconos/apple-touch-icon.png"`);
  });

  it('registra el service worker con el scope correcto', () => {
    expect(resultado).toContain(`register('${BASE}/sw.js', { scope: '${BASE}/' })`);
  });

  it('pone el idioma en castellano y el viewport a pantalla completa', () => {
    expect(resultado).toContain('<html lang="es">');
    expect(resultado).toContain('viewport-fit=cover');
    expect(resultado).not.toContain('<html lang="en">');
  });

  it('funciona igual servido desde la raíz', () => {
    const enRaiz: string = inyectarPwa(original, '');
    expect(enRaiz).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(enRaiz).toContain("register('/sw.js', { scope: '/' })");
  });

  it('es idempotente: pasarlo dos veces no duplica el manifest', () => {
    const dosVeces: string = inyectarPwa(resultado, BASE);
    expect(dosVeces).toBe(resultado);
    expect(dosVeces.match(/rel="manifest"/g)).toHaveLength(1);
  });

  it('revienta si el HTML no es el que espera, en vez de publicar en silencio', () => {
    // El día que Expo cambie su plantilla, esto es lo que evita publicar una
    // web que ya no se puede instalar y que nadie se entere.
    expect(() => inyectarPwa('<html lang="en"><head></head></html>', BASE)).toThrow(
      ErrorDePreparacion
    );
    expect(() => inyectarPwa('<html lang="en"><head></head></html>', BASE)).toThrow(
      /viewport/
    );
  });

  it('encuentra el bundle con hash para poder precargarlo', () => {
    const rutas: string[] = rutasDelBundle(original, BASE);
    expect(rutas.length).toBeGreaterThan(0);
    for (const r of rutas) {
      expect(r).toMatch(/^\.\/_expo\/static\/js\/web\/entry-[0-9a-f]+\.js$/);
    }
  });

  it('revienta si no hay bundle: sin él la app no arranca sin red', () => {
    expect(() => rutasDelBundle('<html><body></body></html>', BASE)).toThrow(
      ErrorDePreparacion
    );
  });
});

// Estos sólo corren si hay un build hecho, porque dist/ está en .gitignore. No
// son la red de seguridad (esa son los de arriba, que corren siempre), sino la
// comprobación de que Expo sigue copiando public/ al dist.
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
      `<link rel="manifest" href="${BASE}/manifest.json" />`
    );
  });

  it('el sw del dist ya no tiene los valores de desarrollo', () => {
    const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
    expect(sw).not.toContain("const VERSION = 'desarrollo';");
    expect(sw).toMatch(/const DEL_ARRANQUE = \[.*_expo\/static.*\];/);
  });
});
