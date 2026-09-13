import { sePuedeRestar, textosDeConfirmacion } from '@/lib/confirmacion';

describe('sePuedeRestar', () => {
  it('deja restar cuando hay algo que restar', () => {
    expect(sePuedeRestar(1)).toBe(true);
    expect(sePuedeRestar(37)).toBe(true);
  });

  it('no deja restar de 0 ni de un número imposible', () => {
    expect(sePuedeRestar(0)).toBe(false);
    expect(sePuedeRestar(-1)).toBe(false);
    expect(sePuedeRestar(NaN)).toBe(false);
  });
});

describe('textosDeConfirmacion', () => {
  it('nombra el evento y dice a cuánto se quedaría', () => {
    const t = textosDeConfirmacion('cacas', 5);
    expect(t.titulo).toBe('¿Quitar 1 de cacas?');
    expect(t.mensaje).toBe('Pasarías de 5 a 4.');
    expect(t.icono).toEqual({ fuente: 'mci', nombre: 'toilet' });
  });

  it('avisa distinto cuando la cuenta se queda a cero', () => {
    const t = textosDeConfirmacion('cervezas', 1);
    expect(t.mensaje).toContain('a 0');
    expect(t.mensaje).not.toContain('Pasarías');
  });

  it('no revienta con una clave que no está en el catálogo', () => {
    // Un viaje viejo puede traer claves que ya no existen en CATEGORIAS.
    const t = textosDeConfirmacion('inventado', 3);
    expect(t.titulo).toBe('¿Quitar 1 de inventado?');
    expect(t.icono).toEqual({ fuente: 'feather', nombre: 'trash-2' });
  });

  it('el botón de cancelar existe siempre y no es el destructivo', () => {
    const t = textosDeConfirmacion('pises', 2);
    expect(t.etiquetaCancelar).toBe('Cancelar');
    expect(t.etiquetaConfirmar).toBe('Sí, quitar');
  });
});
