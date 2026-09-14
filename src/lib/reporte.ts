import { CATEGORIAS } from './categorias';
import type { Viaje } from './viajes';

/** `2026-09-14T10:00:00Z` -> "14 de septiembre de 2026". Para el aviso de
 * viaje finalizado y la cabecera del reporte; sin hora, que no aporta nada
 * aquí (nadie necesita saber A QUÉ HORA se cerró el viaje). */
export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Clasificación final en texto plano, evento por evento dentro de cada
 * categoría (el mismo desglose que la pantalla), para copiar y pegar donde
 * sea: un chat, una nota, un mensaje.
 */
export function textoClasificacion(viaje: Viaje): string {
  const lineas: string[] = [`Clasificación final de "${viaje.nombre}"`];
  if (viaje.fecha_finalizacion) {
    lineas.push(`Finalizado el ${formatearFecha(viaje.fecha_finalizacion)}`);
  }

  for (const nombreCategoria of viaje.categorias ?? []) {
    const categoria = CATEGORIAS[nombreCategoria];
    if (!categoria) continue; // viaje viejo con una categoría que ya no existe
    lineas.push('', nombreCategoria);
    for (const [claveEvento, infoEvento] of Object.entries(categoria.eventos)) {
      const filas = Object.values(viaje.usuarios ?? {})
        .map((usuario) => ({ nombre: usuario.nombre, total: usuario.eventos?.[claveEvento] ?? 0 }))
        .sort((a, b) => b.total - a.total);
      const ranking = filas.map((f, i) => `${i + 1}º ${f.nombre} (${f.total})`).join(', ');
      lineas.push(`  ${infoEvento.nombre}: ${ranking || 'sin datos'}`);
    }
  }

  return lineas.join('\n');
}

/**
 * Prompt para pegar en cualquier IA de texto (Claude, ChatGPT...) y que
 * escriba un comunicado gracioso de cierre de viaje.
 *
 * A propósito NO llama a ninguna IA desde aquí: la app no tiene backend
 * propio para eso (es una SPA estática en GitHub Pages) y las reglas del
 * proyecto prohíben meter una clave de API de un proveedor de IA en un
 * cliente que se descarga cualquiera. Lo que hace esto es preparar el texto
 * para que la persona lo pegue donde quiera — Claude, ChatGPT, el propio
 * Claude Code — sin que Gotita necesite saber nada de IA por su cuenta.
 */
export function promptNarrativaIA(viaje: Viaje): string {
  return [
    `Eres un cronista deportivo con un humor ácido pero cariñoso. Con estos datos reales de "${viaje.nombre}", escribe un comunicado oficial y gracioso de cierre de viaje, en español, con emojis, al estilo de un parte de prensa deportivo: clasificación final con medallas, "premios" curiosos por categoría, un MVP, y algún comentario punzante para cada participante según sus números. No inventes datos que no estén aquí abajo: usa sólo estos.`,
    '',
    textoClasificacion(viaje),
  ].join('\n');
}
