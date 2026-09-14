/**
 * Tests de lib/reporte.ts: el texto que se copia al cerrar un viaje. Es lo
 * que acaba pegado en un chat o en una IA, así que un orden mal hecho o un
 * dato inventado se ve fuera de la app sin que nadie lo revise.
 */
import { formatearFecha, promptNarrativaIA, textoClasificacion } from '@/lib/reporte';
import type { Viaje } from '@/lib/viajes';

const DUDU = '11111111-1111-1111-1111-111111111111';
const RODRI = '22222222-2222-2222-2222-222222222222';

function viaje(parcial: Partial<Viaje> = {}): Viaje {
  return {
    id: 1,
    nombre: 'Cangas',
    admin: DUDU,
    fecha_creacion: '2026-09-01T10:00:00.000Z',
    activo: false,
    fecha_finalizacion: '2026-09-14T10:00:00.000Z',
    categorias: ['Gotitas', 'Bebidas'],
    usuarios: {
      [DUDU]: { nombre: 'Dudu', eventos: { cacas: 3, pises: 1, cervezas: 5 } },
      [RODRI]: { nombre: 'Rodri', eventos: { cervezas: 9 } },
    },
    codigo: 'ABC-123',
    reporte_llm: null,
    ...parcial,
  };
}

describe('formatearFecha', () => {
  it('da día, mes en letra y año, sin hora', () => {
    expect(formatearFecha('2026-09-14T10:00:00.000Z')).toBe('14 de septiembre de 2026');
  });
});

describe('textoClasificacion', () => {
  it('encabeza con el nombre y la fecha de cierre', () => {
    const lineas = textoClasificacion(viaje()).split('\n');
    expect(lineas[0]).toBe('Clasificación final de "Cangas"');
    expect(lineas[1]).toBe('Finalizado el 14 de septiembre de 2026');
  });

  it('sin fecha de cierre, no escribe una línea "Finalizado el Invalid Date"', () => {
    const texto = textoClasificacion(viaje({ fecha_finalizacion: null }));
    expect(texto).not.toContain('Finalizado');
  });

  it('ordena cada evento de mayor a menor, y un contador ausente cuenta como 0', () => {
    const texto = textoClasificacion(viaje());
    expect(texto).toContain('  Cerveza: 1º Rodri (9), 2º Dudu (5)');
    expect(texto).toContain('  Cacas: 1º Dudu (3), 2º Rodri (0)');
  });

  it('usa el nombre visible del evento, no la clave interna (pises se enseña como Gotitas)', () => {
    const texto = textoClasificacion(viaje());
    expect(texto).toContain('  Gotitas: 1º Dudu (1)');
    expect(texto).not.toContain('pises');
  });

  it('agrupa bajo cada categoría, en el orden del viaje', () => {
    const lineas = textoClasificacion(viaje()).split('\n');
    expect(lineas.indexOf('Gotitas')).toBeGreaterThan(-1);
    expect(lineas.indexOf('Bebidas')).toBeGreaterThan(lineas.indexOf('Gotitas'));
  });

  it('salta una categoría que ya no existe en vez de romper', () => {
    const texto = textoClasificacion(viaje({ categorias: ['Inventada', 'Gotitas'] }));
    expect(texto).not.toContain('Inventada');
    expect(texto).toContain('Cacas:');
  });

  it('sin participantes, dice "sin datos" en vez de dejar la línea vacía', () => {
    const texto = textoClasificacion(viaje({ usuarios: {}, categorias: ['Gotitas'] }));
    expect(texto).toContain('  Cacas: sin datos');
  });
});

describe('promptNarrativaIA', () => {
  it('lleva la instrucción de no inventar y la clasificación completa tal cual', () => {
    const v = viaje();
    const prompt = promptNarrativaIA(v);
    expect(prompt).toContain('No inventes datos');
    expect(prompt.endsWith(textoClasificacion(v))).toBe(true);
  });
});
