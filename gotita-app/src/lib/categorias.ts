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
      cacas: { nombre: 'Cacas', icono: { fuente: 'mci', nombre: 'emoticon-poop' } },
      // El nombre de este evento es "Gotitas", igual que su categoría: es
      // deliberado (pedido explícito), no un duplicado accidental. La clave
      // interna sigue siendo `pises` porque es la que ya hay guardada en el
      // JSON `usuarios` de Supabase — renombrar la clave exigiría migrar
      // datos, renombrar sólo lo que se enseña no.
      pises: { nombre: 'Gotitas', icono: ICONOS.gota },
    },
  },
  Bebidas: {
    icono: { fuente: 'mci', nombre: 'beer' },
    eventos: {
      cervezas: { nombre: 'Cerveza', icono: { fuente: 'mci', nombre: 'beer' } },
      vinos: { nombre: 'Copa de vino', icono: { fuente: 'mci', nombre: 'glass-wine' } },
      vermouths: { nombre: 'Vermouth', icono: { fuente: 'mci', nombre: 'glass-cocktail' } },
      // MCI no tiene un vaso de whisky/rocks propiamente dicho; `cup-outline`
      // (ancho y bajo, sin pie) es lo más parecido que trae el set, y no se
      // confunde con `glass-wine` (con pie, para vino) como pasaba con
      // `glass-tulip`, que también lleva pie y parecía otra copa de vino.
      copazos: { nombre: 'Copazo', icono: { fuente: 'mci', nombre: 'cup-outline' } },
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
