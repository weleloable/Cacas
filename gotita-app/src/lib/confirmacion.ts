/**
 * Textos y reglas del diálogo que aparece al restar.
 *
 * Sumar es un toque. Restar borra algo que ya pasó, y en un viaje eso acaba
 * en discusión, así que pide confirmación. La lógica vive aquí, separada de
 * la pantalla, para poder probarla sin montar React.
 */

import { infoDeEvento } from './categorias';

export type TextosConfirmacion = {
  titulo: string;
  mensaje: string;
  etiquetaConfirmar: string;
  etiquetaCancelar: string;
  emoji: string;
};

/**
 * Restar sólo tiene sentido si hay algo que restar. La pantalla además
 * deshabilita el botón, pero el diálogo no se fía de eso: si llega un 0
 * (por una carrera con otro dispositivo, por ejemplo) no se abre.
 */
export function sePuedeRestar(cuentaActual: number): boolean {
  return Number.isFinite(cuentaActual) && cuentaActual > 0;
}

/** Lo que dice el diálogo para un evento y una cuenta dados. */
export function textosDeConfirmacion(
  claveEvento: string,
  cuentaActual: number
): TextosConfirmacion {
  const info = infoDeEvento(claveEvento);
  const nombre = info?.nombre ?? claveEvento;
  const emoji = info?.emoji ?? '🗑️';
  const restante = Math.max(0, cuentaActual - 1);

  return {
    titulo: `¿Quitar 1 de ${nombre.toLowerCase()}?`,
    mensaje:
      restante === 0
        ? `Te quedarías a 0. Esto no se puede deshacer solo, habría que volver a sumarlo.`
        : `Pasarías de ${cuentaActual} a ${restante}.`,
    etiquetaConfirmar: 'Sí, quitar',
    etiquetaCancelar: 'Cancelar',
    emoji,
  };
}
