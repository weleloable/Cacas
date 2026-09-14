import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/** Copia el código al portapapeles. Igual en web y en nativo. */
export async function copiarCodigo(codigo: string): Promise<void> {
  await Clipboard.setStringAsync(codigo);
}

export type ResultadoCompartir = 'compartido' | 'copiado' | 'cancelado';

/**
 * La rama web de `compartirCodigo`, aparte para poder probarla sin depender
 * de qué `Platform.OS` resuelva Jest (que en este proyecto es 'ios' por
 * defecto: React Native decide esa resolución por una tabla de plataformas
 * de Haste, no algo que se pueda forzar a 'web' con un `jest.mock` normal).
 *
 * `navigator.share` es un método que exige que `this` sea el propio
 * `navigator` (WebIDL lo declara como operación de la interfaz, no una
 * función suelta). Sacarlo a una variable y llamarlo aparte
 * (`const f = navigator.share; f(...)`) lo desliga de ese `this` y el
 * navegador lanza "TypeError: Illegal invocation" en cuanto se invoca: el
 * botón no hacía nada porque esa excepción caía en el catch de más abajo y
 * se confundía con un panel cancelado. Se llama pues como `nav.share(...)`,
 * en la misma expresión, para que el acceso a la propiedad y la llamada
 * queden ligados al mismo objeto.
 */
export async function compartirCodigoEnWeb(
  nav: { share?: (datos: { title: string; text: string }) => Promise<void> } | undefined,
  mensaje: string,
  codigo: string
): Promise<ResultadoCompartir> {
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: 'Gotita', text: mensaje });
      return 'compartido';
    } catch {
      return 'cancelado'; // el usuario cerró el panel, no es un error
    }
  }
  await copiarCodigo(codigo);
  return 'copiado';
}

/**
 * Comparte el código de invitación por lo que tenga el sistema (WhatsApp,
 * correo, SMS...).
 *
 * En nativo usa `Share.share` de react-native, que abre el panel del sistema.
 * En web no existe ese panel: se usa la Web Share API (`navigator.share`) si
 * el navegador la trae (Chrome/Edge/Safari en móvil, y también en escritorio
 * en máquinas con soporte de "compartir" del sistema operativo); si no
 * existe (el caso típico de un navegador de escritorio sin ese soporte), no
 * hay ningún panel nativo posible y lo único universal es copiar el código,
 * así que se cae a eso.
 */
export async function compartirCodigo(
  nombreViaje: string,
  codigo: string
): Promise<ResultadoCompartir> {
  const mensaje = `Únete a "${nombreViaje}" en Gotita con el código ${codigo}`;

  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    return compartirCodigoEnWeb(nav, mensaje, codigo);
  }

  const resultado = await Share.share({ message: mensaje });
  return resultado.action === Share.sharedAction ? 'compartido' : 'cancelado';
}
