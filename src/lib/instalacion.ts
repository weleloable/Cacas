/**
 * Saber si la app se puede instalar, y cómo se dice.
 *
 * Chrome en Android avisa solo con `beforeinstallprompt` y deja lanzar el
 * diálogo desde un botón. Safari en iOS no tiene nada de eso: la única forma
 * es Compartir → Añadir a pantalla de inicio, y si la app no lo cuenta, nadie
 * lo descubre. De ahí que haya dos caminos.
 *
 * Las funciones de aquí son puras a propósito, para poder probarlas sin
 * navegador. El hook con estado vive en componentes/AvisoInstalar.tsx.
 */

/** El evento que dispara Chrome cuando la web cumple los criterios. */
export type EventoDeInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    /**
     * Capturado por el script inyectado en el <head> (scripts/preparar-web.js),
     * no por React. Chrome dispara `beforeinstallprompt` una sola vez por
     * carga, normalmente antes de que la app monte nada; un listener puesto
     * dentro de un componente que sólo existe en la pantalla de viaje se lo
     * pierde si el usuario arrancó en /login.
     */
    __eventoInstalable?: EventoDeInstalacion;
  }
}

/** Nombre del evento con el que el script del head avisa de que ya hay uno. */
export const EVENTO_INSTALABLE_DISPONIBLE = 'gotita:instalable';

/**
 * iOS, incluido el iPad moderno, que se presenta como Mac.
 * `maxTouchPoints` es lo que lo distingue de un Mac de verdad.
 */
export function esIOS(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Ya abierta como app, o sea que no hay nada que ofrecer. */
export function estaInstalada(
  coincideStandalone: boolean,
  navegadorStandalone?: boolean
): boolean {
  return coincideStandalone || navegadorStandalone === true;
}

/**
 * Qué enseñar, si es que hay algo.
 *
 * - `boton`: Chrome nos dio el evento, hay diálogo nativo.
 * - `ayudaIOS`: no hay evento y estamos en iOS, toca explicarlo a mano.
 * - `nada`: ya está instalada, o es un navegador que no lo soporta.
 */
export function queOfrecer(opciones: {
  instalada: boolean;
  tieneEvento: boolean;
  ios: boolean;
}): 'boton' | 'ayudaIOS' | 'nada' {
  if (opciones.instalada) return 'nada';
  if (opciones.tieneEvento) return 'boton';
  return opciones.ios ? 'ayudaIOS' : 'nada';
}

export const AYUDA_IOS_SAFARI =
  'Toca Compartir abajo y luego "Añadir a pantalla de inicio". Se abrirá como una app, sin la barra del navegador.';

export const AYUDA_IOS_OTRO_NAVEGADOR =
  'En iPhone/iPad, "Añadir a pantalla de inicio" sólo está en Safari. Abre esta página con Safari para instalarla.';

/** Chrome o Firefox en iOS son Safari por dentro (Apple obliga a WebKit), pero sin el menú de compartir de Safari. */
export function esSafariIOS(userAgent: string): boolean {
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}
