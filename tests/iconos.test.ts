/**
 * Gate test de los iconos que sustituyen a los emoji.
 *
 * El nombre de un icono de Feather/MaterialCommunityIcons es una cadena
 * suelta: si se escribe mal, TypeScript sólo lo pilla si el paquete declara
 * un tipo de unión con los nombres válidos. Este test no se fía de eso: abre
 * el glyphmap real instalado y comprueba que cada nombre usado en la app
 * existe de verdad, para no descubrir un icono en blanco en producción.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CATEGORIAS } from '@/lib/categorias';
import { textosDeConfirmacion } from '@/lib/confirmacion';
import { ICONOS, type IconoSpec } from '@/lib/iconos';

const RAIZ = join(__dirname, '..');

function glyphmap(fuente: 'feather' | 'mci'): Set<string> {
  const fichero = fuente === 'feather' ? 'Feather.json' : 'MaterialCommunityIcons.json';
  const ruta = join(
    RAIZ,
    'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps',
    fichero
  );
  return new Set(Object.keys(JSON.parse(readFileSync(ruta, 'utf8'))));
}

const GLYPHS_FEATHER = glyphmap('feather');
const GLYPHS_MCI = glyphmap('mci');

function comprobarSpec(spec: IconoSpec, contexto: string) {
  if (spec.fuente === 'gota') return; // vectorial propio, no depende de ningún glyphmap
  const glyphs = spec.fuente === 'feather' ? GLYPHS_FEATHER : GLYPHS_MCI;
  if (!glyphs.has(spec.nombre)) {
    throw new Error(
      `${contexto}: "${spec.nombre}" no existe en el glyphmap de ${spec.fuente}. ` +
        `Icono en blanco en producción si esto no revienta aquí.`
    );
  }
}

describe('ICONOS (referencias sueltas: pestañas, títulos, botones)', () => {
  it('cada spec apunta a un glyph que existe de verdad', () => {
    for (const [nombre, spec] of Object.entries(ICONOS)) {
      comprobarSpec(spec, `ICONOS.${nombre}`);
    }
  });
});

describe('CATEGORIAS (el catálogo de eventos)', () => {
  it('cada categoría y cada evento tienen un icono válido', () => {
    for (const [nombreCategoria, categoria] of Object.entries(CATEGORIAS)) {
      comprobarSpec(categoria.icono, `categoría ${nombreCategoria}`);
      for (const [claveEvento, evento] of Object.entries(categoria.eventos)) {
        comprobarSpec(evento.icono, `evento ${claveEvento}`);
      }
    }
  });

  it('ya no queda ningún emoji colgado en los datos (regresión)', () => {
    // Si alguien vuelve a escribir `icono: '💧'` en vez de un IconoSpec,
    // TypeScript ya lo pillaría por el tipo — este test es la red para el
    // día en que alguien lo fuerce con un `as any`.
    for (const categoria of Object.values(CATEGORIAS)) {
      expect(typeof categoria.icono).toBe('object');
      for (const evento of Object.values(categoria.eventos)) {
        expect(typeof evento.icono).toBe('object');
      }
    }
  });
});

describe('textosDeConfirmacion', () => {
  it('el icono de cada evento del catálogo es válido en el diálogo', () => {
    for (const categoria of Object.values(CATEGORIAS)) {
      for (const claveEvento of Object.keys(categoria.eventos)) {
        const t = textosDeConfirmacion(claveEvento, 5);
        comprobarSpec(t.icono, `diálogo de ${claveEvento}`);
      }
    }
  });

  it('el icono de repuesto (clave desconocida) también es válido', () => {
    const t = textosDeConfirmacion('esto-no-existe', 5);
    comprobarSpec(t.icono, 'diálogo de repuesto');
  });
});

describe('la gota es la misma silueta en toda la app', () => {
  it('ICONOS.gota, la categoría Gotitas y el evento pises usan el mismo spec', () => {
    // El pedido explícito era "en todos lados donde hay un emoji de gota,
    // usa la misma gota del icono de la app": una sola fuente, no tres
    // specs distintos que por casualidad se parezcan.
    expect(ICONOS.gota).toEqual({ fuente: 'gota' });
    expect(CATEGORIAS.Gotitas.icono).toEqual(ICONOS.gota);
    expect(CATEGORIAS.Gotitas.eventos.pises.icono).toEqual(ICONOS.gota);
  });
});
