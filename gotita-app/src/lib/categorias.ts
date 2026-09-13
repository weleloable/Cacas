/**
 * Catálogo de categorías y eventos.
 *
 * Es la traducción literal del diccionario CATEGORIAS de Cacas.py. Las claves
 * (`cacas`, `pises`, `cervezas`...) son las mismas que ya hay guardadas dentro
 * del JSON `usuarios` en Supabase, así que no se pueden renombrar sin migrar
 * los viajes existentes.
 */

import { ICONOS, type IconoSpec } from './iconos';

export type EventoInfo = {
  nombre: string;
  icono: IconoSpec;
};

export type CategoriaInfo = {
  icono: IconoSpec;
  eventos: Record<string, EventoInfo>;
};

export const CATEGORIAS: Record<string, CategoriaInfo> = {
  Gotitas: {
    icono: ICONOS.gota,
    eventos: {
      cacas: { nombre: 'Cacas', icono: { fuente: 'mci', nombre: 'toilet' } },
      pises: { nombre: 'Pises', icono: ICONOS.gota },
    },
  },
  Bebidas: {
    icono: { fuente: 'mci', nombre: 'beer' },
    eventos: {
      cervezas: { nombre: 'Cerveza', icono: { fuente: 'mci', nombre: 'beer' } },
      vinos: { nombre: 'Copa de vino', icono: { fuente: 'mci', nombre: 'glass-wine' } },
      vermouths: { nombre: 'Vermouth', icono: { fuente: 'mci', nombre: 'glass-cocktail' } },
      copazos: { nombre: 'Copazo', icono: { fuente: 'mci', nombre: 'glass-tulip' } },
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
