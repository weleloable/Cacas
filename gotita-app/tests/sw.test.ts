/**
 * Tests del service worker ejecutándolo de verdad.
 *
 * Los tests anteriores eran grep sobre el fuente: comprobaban que existía una
 * cadena, no que el comportamiento fuera el correcto. Aquí se monta un `self`
 * falso con `caches` y `fetch` de mentira, se evalúa `sw.js` dentro y se
 * disparan los eventos reales.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const SCOPE = 'https://weleloable.github.io/Cacas/';
const swFuente = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prepararServiceWorker } = require('../scripts/preparar-web.js');

type Respuesta = { url: string; ok: boolean; clone: () => Respuesta; cuerpo: string };

function respuesta(url: string, cuerpo: string, ok = true): Respuesta {
  const r: Respuesta = { url, ok, cuerpo, clone: () => respuesta(url, cuerpo, ok) };
  return r;
}

/** Caché de mentira, con la superficie que usa el sw. */
class CacheFalsa {
  guardado = new Map<string, Respuesta>();
  async match(peticion: { url: string } | string) {
    const url = typeof peticion === 'string' ? url_(peticion) : peticion.url;
    return this.guardado.get(url);
  }
  async put(clave: { url: string } | string, resp: Respuesta) {
    this.guardado.set(typeof clave === 'string' ? url_(clave) : clave.url, resp);
  }
  async add(ruta: string) {
    const url = url_(ruta);
    const resp = await entorno.fetch({ url, mode: 'no-cors' });
    if (!resp.ok) throw new Error(`no se pudo cachear ${url}`);
    this.guardado.set(url, resp);
  }
}

function url_(relativa: string) {
  return new URL(relativa, SCOPE).href;
}

type Entorno = {
  self: Record<string, unknown>;
  fetch: (p: { url: string; mode?: string; method?: string }) => Promise<Respuesta>;
  caches: Map<string, CacheFalsa>;
  manejadores: Record<string, ((e: unknown) => void)[]>;
  enRed: Set<string>;
  hayRed: boolean;
};

let entorno: Entorno;

/** Monta el sw en un contexto aislado y devuelve con qué hablar con él. */
function montarSw(fuente = swFuente) {
  const manejadores: Record<string, ((e: unknown) => void)[]> = {};
  const almacenes = new Map<string, CacheFalsa>();

  entorno = {
    self: {},
    caches: almacenes,
    manejadores,
    enRed: new Set(),
    hayRed: true,
    fetch: async (peticion) => {
      if (!entorno.hayRed) throw new TypeError('Failed to fetch');
      if (!entorno.enRed.has(peticion.url)) return respuesta(peticion.url, 'no está', false);
      return respuesta(peticion.url, `contenido de ${peticion.url}`);
    },
  };

  const self: Record<string, unknown> = {
    location: new URL(SCOPE),
    registration: { scope: SCOPE },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    addEventListener: (tipo: string, fn: (e: unknown) => void) => {
      (manejadores[tipo] ??= []).push(fn);
    },
  };
  entorno.self = self;

  const caches = {
    open: async (nombre: string) => {
      if (!almacenes.has(nombre)) almacenes.set(nombre, new CacheFalsa());
      return almacenes.get(nombre)!;
    },
    keys: async () => [...almacenes.keys()],
    delete: async (nombre: string) => almacenes.delete(nombre),
  };

  const contexto = {
    self,
    caches,
    URL,
    Response: class {
      status: number;
      cuerpo: string;
      constructor(cuerpo: string, init: { status?: number } = {}) {
        this.cuerpo = cuerpo;
        this.status = init.status ?? 200;
      }
    },
    fetch: (p: { url: string }) => entorno.fetch(p),
    Promise,
    console,
    TypeError,
  };
  runInNewContext(fuente, contexto);
  return entorno;
}

/** Dispara un evento y espera a lo que el sw haya metido en waitUntil. */
async function disparar(tipo: string, evento: Record<string, unknown>) {
  const esperas: Promise<unknown>[] = [];
  let respondidoCon: Promise<unknown> | null = null;
  const e = {
    ...evento,
    waitUntil: (p: Promise<unknown>) => esperas.push(p),
    respondWith: (p: Promise<unknown>) => {
      respondidoCon = p;
    },
  };
  for (const fn of entorno.manejadores[tipo] ?? []) fn(e);
  await Promise.all(esperas);
  return respondidoCon as Promise<Respuesta> | null;
}

const SW_DE_BUILD = () =>
  prepararServiceWorker(
    swFuente,
    ['./', './manifest.json', './_expo/static/js/web/entry-abc.js'],
    'abc123'
  );

describe('service worker, ejecutado', () => {
  it('registra un manejador de fetch, que es el criterio real de Chrome', () => {
    montarSw();
    expect(entorno.manejadores.fetch).toHaveLength(1);
  });

  it('precarga en install lo que le diga el build, incluido el bundle', async () => {
    montarSw(SW_DE_BUILD());
    entorno.enRed.add(SCOPE);
    entorno.enRed.add(`${SCOPE}manifest.json`);
    entorno.enRed.add(`${SCOPE}_expo/static/js/web/entry-abc.js`);

    await disparar('install', {});

    const cache = entorno.caches.get('gotita-abc123')!;
    expect([...cache.guardado.keys()]).toEqual([
      SCOPE,
      `${SCOPE}manifest.json`,
      `${SCOPE}_expo/static/js/web/entry-abc.js`,
    ]);
  });

  it('una precarga que falle no tumba la instalación entera', async () => {
    montarSw(SW_DE_BUILD());
    entorno.enRed.add(SCOPE); // el resto devuelve 404

    await expect(disparar('install', {})).resolves.toBeDefined();
    expect(entorno.caches.get('gotita-abc123')!.guardado.has(SCOPE)).toBe(true);
  });

  it('sin red, una navegación devuelve el index precargado y el bundle sale de caché', async () => {
    montarSw(SW_DE_BUILD());
    entorno.enRed.add(SCOPE);
    entorno.enRed.add(`${SCOPE}manifest.json`);
    entorno.enRed.add(`${SCOPE}_expo/static/js/web/entry-abc.js`);
    await disparar('install', {});

    entorno.hayRed = false;

    const navegacion = await disparar('fetch', {
      request: { url: `${SCOPE}viaje`, method: 'GET', mode: 'navigate' },
    });
    expect((await navegacion!).cuerpo).toBe(`contenido de ${SCOPE}`);

    const bundle = await disparar('fetch', {
      request: {
        url: `${SCOPE}_expo/static/js/web/entry-abc.js`,
        method: 'GET',
        mode: 'no-cors',
      },
    });
    expect((await bundle!).cuerpo).toBe(`contenido de ${SCOPE}_expo/static/js/web/entry-abc.js`);
  });

  it('sin red y sin copia, responde 504 en vez de reventar la promesa', async () => {
    montarSw(SW_DE_BUILD());
    entorno.hayRed = false;

    const r = await disparar('fetch', {
      request: { url: `${SCOPE}_expo/static/js/web/otro.js`, method: 'GET', mode: 'no-cors' },
    });
    expect(r).toMatchObject({ status: 504 });
  });

  it('no toca nada de Supabase: ni lo cachea ni lo intercepta', async () => {
    montarSw(SW_DE_BUILD());

    const r = await disparar('fetch', {
      request: {
        url: 'https://jvswgdepktzbzhegugta.supabase.co/rest/v1/viajes?select=*',
        method: 'GET',
        mode: 'cors',
      },
    });

    expect(r).toBeNull(); // ni siquiera llama a respondWith
    expect(entorno.caches.size).toBe(0);
  });

  it('el guardia de origen protege de verdad, no por casualidad de la ruta', async () => {
    // El test de arriba pasaría igual si el guardia `url.origin !== self.location.origin`
    // se quitara del todo, porque la URL de Supabase no contiene "/_expo/static/"
    // ni "/iconos/" y por tanto nunca entraría en cachePrimero de todos modos.
    // Este usa una URL de OTRO origen que sí imita esas rutas, para que sólo
    // pase si el guardia de origen está haciendo su trabajo.
    montarSw(SW_DE_BUILD());

    const r = await disparar('fetch', {
      request: {
        url: 'https://otro-origen-cualquiera.example/_expo/static/js/web/entry-abc.js',
        method: 'GET',
        mode: 'cors',
      },
    });

    expect(r).toBeNull();
    expect(entorno.caches.size).toBe(0);
  });

  it('tampoco intercepta escrituras del mismo origen', async () => {
    montarSw(SW_DE_BUILD());
    const r = await disparar('fetch', {
      request: { url: `${SCOPE}algo`, method: 'POST', mode: 'cors' },
    });
    expect(r).toBeNull();
  });

  it('una navegación con red devuelve lo de red y refresca el index cacheado', async () => {
    montarSw(SW_DE_BUILD());
    entorno.enRed.add(`${SCOPE}viaje`);

    const r = await disparar('fetch', {
      request: { url: `${SCOPE}viaje`, method: 'GET', mode: 'navigate' },
    });

    expect((await r!).cuerpo).toBe(`contenido de ${SCOPE}viaje`);
    // Guardado bajo la raíz, no bajo /viaje: la SPA sirve el mismo index.
    expect(entorno.caches.get('gotita-abc123')!.guardado.has(SCOPE)).toBe(true);
  });

  it('activar borra las cachés de despliegues anteriores y deja sólo la suya', async () => {
    montarSw(SW_DE_BUILD());
    entorno.caches.set('gotita-viejo', new CacheFalsa());
    entorno.caches.set('otra-cosa', new CacheFalsa()); // de otra app, no se toca
    await disparar('install', {});

    await disparar('activate', {});

    expect([...entorno.caches.keys()].sort()).toEqual(['gotita-abc123', 'otra-cosa']);
  });

  it('el nombre de la caché lleva la versión una sola vez', async () => {
    montarSw(SW_DE_BUILD());
    await disparar('install', {});
    expect([...entorno.caches.keys()]).toEqual(['gotita-abc123']);
  });

  it('dos builds distintos usan cachés distintas, así la vieja se puede borrar', () => {
    const uno = prepararServiceWorker(swFuente, ['./'], 'aaa');
    const dos = prepararServiceWorker(swFuente, ['./'], 'bbb');
    expect(uno).not.toBe(dos);
    expect(uno).toContain('"aaa"');
    expect(dos).toContain('"bbb"');
  });
});
