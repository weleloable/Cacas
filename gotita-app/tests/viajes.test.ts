/**
 * Tests de lib/viajes.ts ejecutando el código real (no un mock del módulo,
 * como hacen los tests de pantalla). Sólo se mockea `supabase`, en el punto
 * exacto donde este módulo habla con la red.
 */
import {
  actualizarAvatarEnMisViajes,
  actualizarNombreEnMisViajes,
  ConflictoDeConcurrencia,
  modificarEvento,
} from '@/lib/viajes';

const USUARIO = '11111111-1111-1111-1111-111111111111';
const OTRO = '22222222-2222-2222-2222-222222222222';

function viaje(id: number, nombre: string, eventos: Record<string, number> = { cacas: 3 }) {
  return {
    id,
    nombre,
    admin: USUARIO,
    fecha_creacion: '2026-09-01',
    activo: true,
    categorias: ['Gotitas'],
    usuarios: {
      [USUARIO]: { nombre: 'Dudu', avatarUrl: null as string | null, eventos },
    },
    codigo: `COD-${id}`,
    reporte_llm: null,
  };
}

// Doble mínimo del cliente de Supabase: sólo lo que estas funciones tocan
// (`from().select()...`, `from().update().eq()`).
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => mockSelect(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    }),
  },
}));

beforeEach(() => {
  mockSingle.mockReset();
  mockUpdate.mockReset();
  mockSelect.mockReset();
  // select().eq().single() — encadenado tal cual lo usa cargarUnViaje.
  mockSelect.mockReturnValue({ eq: () => ({ single: mockSingle }) });
});

describe('modificarEvento', () => {
  it('aplica el delta sobre el valor real del servidor', async () => {
    mockSingle.mockResolvedValue({ data: viaje(1, 'Cangas'), error: null });
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });

    const resultado = await modificarEvento(1, USUARIO, 'cacas', 1);
    expect(resultado.usuarios[USUARIO].eventos.cacas).toBe(4);
  });

  it('lanza ConflictoDeConcurrencia si el valorEsperado no coincide con el servidor', async () => {
    mockSingle.mockResolvedValue({ data: viaje(1, 'Cangas', { cacas: 5 }), error: null });

    await expect(modificarEvento(1, USUARIO, 'cacas', -1, 3)).rejects.toThrow(ConflictoDeConcurrencia);
    expect(mockUpdate).not.toHaveBeenCalled(); // no escribe si la comprobación falla
  });

  it('con el valorEsperado correcto, escribe sin problema', async () => {
    mockSingle.mockResolvedValue({ data: viaje(1, 'Cangas', { cacas: 5 }), error: null });
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });

    const resultado = await modificarEvento(1, USUARIO, 'cacas', -1, 5);
    expect(resultado.usuarios[USUARIO].eventos.cacas).toBe(4);
  });

  it('sin valorEsperado (sumar), no comprueba nada', async () => {
    mockSingle.mockResolvedValue({ data: viaje(1, 'Cangas', { cacas: 99 }), error: null });
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });

    await expect(modificarEvento(1, USUARIO, 'cacas', 1)).resolves.toBeTruthy();
  });

  it('nunca deja el contador en negativo', async () => {
    mockSingle.mockResolvedValue({ data: viaje(1, 'Cangas', { cacas: 0 }), error: null });
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });

    const resultado = await modificarEvento(1, USUARIO, 'cacas', -1);
    expect(resultado.usuarios[USUARIO].eventos.cacas).toBe(0);
  });

  it('si no estás en el viaje, avisa en vez de escribir usuarios[undefined]', async () => {
    mockSingle.mockResolvedValue({ data: viaje(1, 'Cangas'), error: null });

    await expect(modificarEvento(1, OTRO, 'cacas', 1)).rejects.toThrow('No estás apuntado');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('actualizarNombreEnMisViajes', () => {
  // No se mockea cargarMisViajes: se deja correr de verdad, y se le da forma
  // a `mockSelect` para que sirva a las dos formas en que este fichero llama
  // a supabase (`select().eq().single()` de cargarUnViaje y
  // `select().eq()` sin single de cargarMisViajes).
  it('actualiza el nombre en cada viaje donde participas', async () => {
    // cargarMisViajes hace su propio select().eq('activo',true); sin
    // single(), así que se reconfigura aquí sólo para este describe.
    mockSelect.mockReturnValue({ eq: () => Promise.resolve({ data: [viaje(1, 'Cangas'), viaje(2, 'Oktoberfest')], error: null }) });
    const eqSpy = jest.fn(() => Promise.resolve({ error: null }));
    mockUpdate.mockReturnValue({ eq: eqSpy });

    await actualizarNombreEnMisViajes(USUARIO, 'Eduardo');

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const usuariosEnviados = mockUpdate.mock.calls.map((c) => (c[0] as { usuarios: Record<string, { nombre: string }> }).usuarios[USUARIO].nombre);
    expect(usuariosEnviados).toEqual(['Eduardo', 'Eduardo']);
  });

  it('no escribe en un viaje si ya tenía ese nombre', async () => {
    const v = viaje(1, 'Cangas');
    v.usuarios[USUARIO].nombre = 'Eduardo';
    mockSelect.mockReturnValue({ eq: () => Promise.resolve({ data: [v], error: null }) });

    await actualizarNombreEnMisViajes(USUARIO, 'Eduardo');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('si un viaje falla al escribir, los demás no se ven afectados y no revienta', async () => {
    mockSelect.mockReturnValue({
      eq: () => Promise.resolve({ data: [viaje(1, 'Cangas'), viaje(2, 'Oktoberfest')], error: null }),
    });
    let llamada = 0;
    mockUpdate.mockReturnValue({
      eq: () => {
        llamada += 1;
        return llamada === 1 ? Promise.reject(new Error('red caída')) : Promise.resolve({ error: null });
      },
    });

    await expect(actualizarNombreEnMisViajes(USUARIO, 'Eduardo')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledTimes(2); // se intentaron los dos, ninguno bloqueó al otro
  });
});

describe('actualizarAvatarEnMisViajes', () => {
  it('actualiza la URL del avatar en cada viaje donde participas', async () => {
    mockSelect.mockReturnValue({
      eq: () => Promise.resolve({ data: [viaje(1, 'Cangas'), viaje(2, 'Oktoberfest')], error: null }),
    });
    const eqSpy = jest.fn(() => Promise.resolve({ error: null }));
    mockUpdate.mockReturnValue({ eq: eqSpy });

    await actualizarAvatarEnMisViajes(USUARIO, 'https://ejemplo.test/foto.jpg');

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const urlsEnviadas = mockUpdate.mock.calls.map(
      (c) => (c[0] as { usuarios: Record<string, { avatarUrl: string }> }).usuarios[USUARIO].avatarUrl
    );
    expect(urlsEnviadas).toEqual(['https://ejemplo.test/foto.jpg', 'https://ejemplo.test/foto.jpg']);
  });

  it('no escribe en un viaje si ya tenía esa URL', async () => {
    const v = viaje(1, 'Cangas');
    v.usuarios[USUARIO] = { ...v.usuarios[USUARIO], avatarUrl: 'https://ejemplo.test/foto.jpg' };
    mockSelect.mockReturnValue({ eq: () => Promise.resolve({ data: [v], error: null }) });

    await actualizarAvatarEnMisViajes(USUARIO, 'https://ejemplo.test/foto.jpg');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('si un viaje falla al escribir, los demás no se ven afectados y no revienta', async () => {
    mockSelect.mockReturnValue({
      eq: () => Promise.resolve({ data: [viaje(1, 'Cangas'), viaje(2, 'Oktoberfest')], error: null }),
    });
    let llamada = 0;
    mockUpdate.mockReturnValue({
      eq: () => {
        llamada += 1;
        return llamada === 1 ? Promise.reject(new Error('red caída')) : Promise.resolve({ error: null });
      },
    });

    await expect(
      actualizarAvatarEnMisViajes(USUARIO, 'https://ejemplo.test/foto.jpg')
    ).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
