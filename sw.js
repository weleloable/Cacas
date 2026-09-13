/**
 * Service worker de Gotita.
 *
 * Dos razones para que exista:
 *  1. Chrome en Android no ofrece "Instalar aplicación" sin un service worker
 *     que tenga un manejador de `fetch`. El manifest solo no basta.
 *  2. Estando instalada, la app abre aunque el móvil no tenga cobertura. Los
 *     contadores no se guardan sin red, pero la pantalla no es un dinosaurio.
 *
 * Estrategia, y el porqué de cada rama:
 *  - Navegaciones: red primero. El index.html apunta a un bundle con hash en
 *    el nombre, así que servirlo de caché dejaría la app clavada en la versión
 *    vieja para siempre. Si no hay red, cae al index cacheado.
 *  - Estáticos de /_expo/static/: caché primero. Llevan hash en el nombre, o
 *    sea que un nombre dado nunca cambia de contenido.
 *  - Todo lo demás (Supabase, cualquier otro origen): ni se toca. Cachear
 *    respuestas de la API serviría contadores viejos como si fueran buenos.
 */

const VERSION = 'gotita-v1';
const CACHE = `gotita-${VERSION}`;

// Rutas relativas al scope, que es donde está el sw. Así funciona igual en
// /Cacas/ que en la raíz si algún día cambia el baseUrl.
const DEL_ARRANQUE = [
  './',
  './manifest.json',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
];

const INDICE = new URL('./', self.registration.scope).href;

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll aborta entero si una sola falla, y una instalación fallida deja
      // la app sin service worker. Cada una por su cuenta y las que fallen
      // ya se cachearán al primer uso.
      await Promise.all(
        DEL_ARRANQUE.map((ruta) => cache.add(ruta).catch(() => undefined))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => n.startsWith('gotita-') && n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'saltar-espera') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return; // Supabase y demás, de largo.

  if (peticion.mode === 'navigate') {
    evento.respondWith(redPrimero(peticion));
    return;
  }

  if (url.pathname.includes('/_expo/static/') || url.pathname.includes('/iconos/')) {
    evento.respondWith(cachePrimero(peticion));
  }
});

async function redPrimero(peticion) {
  const cache = await caches.open(CACHE);
  try {
    const respuesta = await fetch(peticion);
    // La SPA sirve el mismo index para toda ruta, así que se guarda bajo una
    // clave única en vez de bajo la URL navegada.
    if (respuesta.ok) cache.put(INDICE, respuesta.clone());
    return respuesta;
  } catch (error) {
    const guardada = await cache.match(INDICE);
    if (guardada) return guardada;
    throw error;
  }
}

async function cachePrimero(peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (respuesta.ok) cache.put(peticion, respuesta.clone());
  return respuesta;
}
