import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/** Copia el código al portapapeles. Igual en web y en nativo. */
export async function copiarCodigo(codigo: string): Promise<void> {
  await Clipboard.setStringAsync(codigo);
}

export type ResultadoCompartir = 'compartido' | 'copiado' | 'cancelado';

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
    const compartirWeb = (globalThis as { navigator?: { share?: (datos: unknown) => Promise<void> } })
      .navigator?.share;
    if (compartirWeb) {
      try {
        await compartirWeb({ title: 'Gotita', text: mensaje });
        return 'compartido';
      } catch {
        return 'cancelado'; // el usuario cerró el panel, no es un error
      }
    }
    await copiarCodigo(codigo);
    return 'copiado';
  }

  const resultado = await Share.share({ message: mensaje });
  return resultado.action === Share.sharedAction ? 'compartido' : 'cancelado';
}
