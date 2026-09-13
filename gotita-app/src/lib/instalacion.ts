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

export const AYUDA_IOS =
  'Toca Compartir abajo y luego "Añadir a pantalla de inicio". Se abrirá como una app, sin la barra del navegador.';
