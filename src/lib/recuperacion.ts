import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * A dónde vuelve el usuario tras pulsar el enlace de recuperación del email.
 *
 * Pura y testable aparte de `urlRestablecerContrasena` (que sí toca
 * `window`): se deriva de la URL ACTUAL (quitando "/login" del final), no de
 * `app.json`. Así sirve igual en local (`http://192.168.x.x:8082/...`, sin
 * baseUrl) y en producción (`https://weleloable.github.io/Gotita/...`, con
 * baseUrl) sin tener que adivinar en cuál de los dos se está: la URL de la
 * pantalla que llama a esto YA lleva el prefijo correcto, sea cual sea.
 */
export function calcularUrlRestablecer(origin: string, pathname: string): string {
  const base = pathname.replace(/\/login\/?$/, '');
  return `${origin}${base}/restablecer-contrasena`;
}

/**
 * Envuelve `calcularUrlRestablecer` con la fuente real (`window.location`) en
 * web, y `Linking.createURL` en nativo.
 *
 * `Linking.createURL` en web NO vale para esto: resuelve la ruta contra la
 * RAÍZ del origen (`new URL(path, window.location.origin)`), no contra el
 * baseUrl de la app — en producción perdería el "/Gotita" y el enlace
 * apuntaría a una URL que no existe. En nativo sí vale, porque ahí construye
 * el esquema propio de la app (`gotita://restablecer-contrasena`).
 */
export function urlRestablecerContrasena(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return calcularUrlRestablecer(window.location.origin, window.location.pathname);
  }
  return Linking.createURL('restablecer-contrasena');
}

export type ParametrosRecuperacion = { accessToken: string; refreshToken: string };

/**
 * El cliente de Supabase usa el flujo implícito por defecto (no se fija
 * `flowType` en `supabase.ts`), así que el enlace de recuperación del email
 * trae los tokens de sesión en el FRAGMENTO hash de la URL, no en la query:
 * "#access_token=...&refresh_token=...&type=recovery". `detectSessionInUrl`
 * está a `false` en el cliente, así que la librería no lo procesa sola — hay
 * que leerlo a mano y pasarlo a `setSession`.
 *
 * Devuelve `null` si el hash no trae una recuperación válida (enlace ya
 * usado, caducado, roto al copiarlo, o la pantalla se abrió sin pasar por el
 * email): la pantalla lo trata como "enlace inválido", no como un error de
 * red distinto.
 */
export function parsearHashRecuperacion(hash: string): ParametrosRecuperacion | null {
  const limpio = hash.replace(/^#/, '');
  if (!limpio) return null;

  const parametros = new URLSearchParams(limpio);
  if (parametros.get('type') !== 'recovery') return null;

  const accessToken = parametros.get('access_token');
  const refreshToken = parametros.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}
