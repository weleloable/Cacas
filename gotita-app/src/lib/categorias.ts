/**
 * Catálogo de categorías y eventos.
 *
 * Es la traducción literal del diccionario CATEGORIAS de Cacas.py. Las claves
 * (`cacas`, `pises`, `cervezas`...) son las mismas que ya hay guardadas dentro
 * del JSON `usuarios` en Supabase, así que no se pueden renombrar sin migrar
 * los viajes existentes.
 */

export type EventoInfo = {
  nombre: string;
  emoji: string;
};

export type CategoriaInfo = {
  emoji: string;
  eventos: Record<string, EventoInfo>;
};

export const CATEGORIAS: Record<string, CategoriaInfo> = {
  Gotitas: {
    emoji: '💧',
    eventos: {
      cacas: { nombre: 'Cacas', emoji: '💩' },
      pises: { nombre: 'Pises', emoji: '💧' },
    },
  },
  Bebidas: {
    emoji: '🍺',
    eventos: {
      cervezas: { nombre: 'Cerveza', emoji: '🍺' },
      vinos: { nombre: 'Copa de vino', emoji: '🍷' },
      vermouths: { nombre: 'Vermouth', emoji: '🍸' },
      copazos: { nombre: 'Copazo', emoji: '🥃' },
    },
  },
};

/** Busca la info de un evento por su clave, mire en la categoría que mire. */
export function infoDeEvento(claveEvento: string): EventoInfo | null {
  for (const categoria of Object.values(CATEGORIAS)) {
    const evento = categoria.eventos[claveEvento];
    if (evento) return evento;
  }
  return null;
}
