/**
 * Tests del estado compartido entre "Mi Viaje" y "Mis viajes".
 *
 * Se monta un componente anfitrión mínimo que sólo expone lo que devuelve
 * `useViajes()` como texto, para poder leerlo y accionarlo con
 * testing-library sin tener que montar las pantallas reales.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

const USUARIO = '11111111-1111-1111-1111-111111111111';

const viaje1 = {
  id: 1,
  nombre: 'Cangas',
  admin: USUARIO,
  fecha_creacion: '2026-09-01',
  activo: true,
  categorias: ['Gotitas'],
  usuarios: { [USUARIO]: { nombre: 'Dudu', eventos: { cacas: 3 } } },
  codigo: 'ABC-123',
  reporte_llm: null,
};
const viaje2 = { ...viaje1, id: 2, nombre: 'Oktoberfest', codigo: 'XYZ-999' };

const mockCargarMisViajes = jest.fn();
const mockActualizarAvatarEnMisViajes = jest.fn();

jest.mock('@/lib/viajes', () => ({
  cargarMisViajes: (...args: unknown[]) => mockCargarMisViajes(...args),
  actualizarAvatarEnMisViajes: (...args: unknown[]) => mockActualizarAvatarEnMisViajes(...args),
}));

const mockSesion = { valor: { user: { id: USUARIO } } as { user: { id: string } } | null };
// Mutable aparte de la sesión: varios tests necesitan variar sólo esto sin
// cambiar la identidad de `session` (que dispararía una recarga por su
// cuenta y contaminaría el recuento de llamadas de estos tests).
const mockAvatarUrl = { valor: null as string | null };

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    userId: mockSesion.valor?.user.id ?? '',
    session: mockSesion.valor,
    avatarUrl: mockAvatarUrl.valor,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ViajesProvider, useViajes } = require('@/lib/viajesContext');

/** Expone el contexto como texto plano y botones para accionarlo. */
function Sonda() {
  const { viajes, viaje, viajeActivoId, setViajeActivoId, cargando, error, recargar } = useViajes();
  return (
    <>
      <Text testID="cargando">{String(cargando)}</Text>
      <Text testID="cantidad">{viajes.length}</Text>
      <Text testID="activo">{viaje?.nombre ?? 'ninguno'}</Text>
      <Text testID="avatar-activo">{viaje?.usuarios?.[USUARIO]?.avatarUrl ?? ''}</Text>
      <Text testID="error">{error ?? ''}</Text>
      <Pressable testID="elegir-2" onPress={() => setViajeActivoId(2)} />
      <Pressable testID="recargar" onPress={() => recargar()} />
      <Pressable testID="recargar-silencioso" onPress={() => recargar(false)} />
    </>
  );
}

function arbol() {
  return (
    <ViajesProvider>
      <Sonda />
    </ViajesProvider>
  );
}

beforeEach(() => {
  mockSesion.valor = { user: { id: USUARIO } };
  mockAvatarUrl.valor = null;
  mockCargarMisViajes.mockReset().mockResolvedValue([viaje1, viaje2]);
  mockActualizarAvatarEnMisViajes.mockReset().mockResolvedValue(undefined);
});

describe('useViajes fuera de ViajesProvider', () => {
  it('revienta con un mensaje claro, no con "undefined is not a function"', async () => {
    const EsteExplota = () => {
      useViajes();
      return null;
    };
    // render() es asíncrono (RNTL 14): el error de React llega como rechazo
    // de esa promesa, no lanzado de forma síncrona por la llamada.
    await expect(render(<EsteExplota />)).rejects.toThrow(
      'useViajes tiene que usarse dentro de <ViajesProvider>'
    );
  });
});

describe('ViajesProvider', () => {
  it('carga los viajes al montar y marca el primero como activo', async () => {
    await act(async () => {
      render(arbol());
    });

    expect(screen.getByTestId('cantidad')).toHaveTextContent('2');
    expect(screen.getByTestId('activo')).toHaveTextContent('Cangas');
    expect(screen.getByTestId('cargando')).toHaveTextContent('false');
  });

  it('por defecto prefiere un viaje en marcha aunque un finalizado llegue antes', async () => {
    // Supabase no garantiza orden (no hay ORDER BY): un viaje cerrado antiguo
    // puede venir primero. Aterrizar en él dejaría al usuario sin botones.
    mockCargarMisViajes.mockResolvedValue([{ ...viaje2, activo: false }, viaje1]);
    await act(async () => {
      render(arbol());
    });

    expect(screen.getByTestId('activo')).toHaveTextContent('Cangas');
  });

  it('si todos están finalizados, elige el primero en vez de ninguno', async () => {
    mockCargarMisViajes.mockResolvedValue([
      { ...viaje1, activo: false },
      { ...viaje2, activo: false },
    ]);
    await act(async () => {
      render(arbol());
    });

    expect(screen.getByTestId('activo')).toHaveTextContent('Cangas');
  });

  it('cambiar el activo se refleja en el mismo render, sin recargar', async () => {
    await act(async () => {
      render(arbol());
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('elegir-2'));
    });

    expect(screen.getByTestId('activo')).toHaveTextContent('Oktoberfest');
    expect(mockCargarMisViajes).toHaveBeenCalledTimes(1); // no ha vuelto a pedir nada
  });

  it('un refresco de sesión (token renovado) recarga solo', async () => {
    await act(async () => {
      render(arbol());
    });
    expect(mockCargarMisViajes).toHaveBeenCalledTimes(1);

    // Supabase dispara TOKEN_REFRESHED con un objeto de sesión nuevo.
    mockSesion.valor = { user: { id: USUARIO } };
    await act(async () => {
      screen.rerender(arbol());
    });

    expect(mockCargarMisViajes).toHaveBeenCalledTimes(2);
  });

  it('recargar(false) no toca error aunque falle', async () => {
    await act(async () => {
      render(arbol());
    });

    mockCargarMisViajes.mockRejectedValueOnce(new Error('sin red'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('recargar-silencioso'));
    });

    expect(screen.getByTestId('error')).toHaveTextContent('');
  });

  it('recargar() normal sí pone el error si falla', async () => {
    await act(async () => {
      render(arbol());
    });

    mockCargarMisViajes.mockRejectedValueOnce(new Error('sin red'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('recargar'));
    });

    expect(screen.getByTestId('error')).toHaveTextContent('sin red');
  });

  it('una recarga en vuelo desde antes del logout no repuebla tras el vaciado', async () => {
    // La secuencia exacta que el vaciado por sí solo no cubre: una petición
    // de red ya en marcha desde antes de cerrar sesión, que resuelve TARDE,
    // después de que el logout ya haya vaciado el estado. Sin el guard de
    // "petición superada", esta respuesta tardía repuebla `viajes` con los
    // datos del usuario que ya se fue.
    let resolverTarde!: (v: typeof viaje1[]) => void;
    mockCargarMisViajes.mockReset().mockReturnValueOnce(
      new Promise((resolve) => {
        resolverTarde = resolve;
      })
    );

    await act(async () => {
      render(arbol());
    });
    // La carga del montaje se ha lanzado y sigue en vuelo (la promesa de
    // arriba todavía no se ha resuelto): cantidad sigue a 0.
    expect(screen.getByTestId('cantidad')).toHaveTextContent('0');

    // Se cierra sesión mientras esa petición sigue pendiente.
    mockSesion.valor = null;
    await act(async () => {
      screen.rerender(arbol());
    });
    expect(screen.getByTestId('cantidad')).toHaveTextContent('0');

    // Ahora, tarde, resuelve la petición de antes del logout.
    await act(async () => {
      resolverTarde([viaje1, viaje2]);
    });

    // No debe haber repoblado nada: sigue vacío.
    expect(screen.getByTestId('cantidad')).toHaveTextContent('0');
    expect(screen.getByTestId('activo')).toHaveTextContent('ninguno');
  });

  it('cerrar sesión vacía el estado, no lo deja colgado para el siguiente', async () => {
    // El proveedor vive en el _layout.tsx raíz: a diferencia de vivir dentro
    // de (tabs) (donde cerrar sesión lo desmontaría entero y lo limpiaría
    // gratis), aquí sigue siendo la MISMA instancia tras el logout. Sin este
    // vaciado explícito, en un móvil compartido entre varias personas del
    // viaje, la siguiente en entrar vería un parpadeo con los viajes de la
    // anterior.
    await act(async () => {
      render(arbol());
    });
    expect(screen.getByTestId('cantidad')).toHaveTextContent('2');

    mockSesion.valor = null; // logout
    await act(async () => {
      screen.rerender(arbol());
    });

    expect(screen.getByTestId('cantidad')).toHaveTextContent('0');
    expect(screen.getByTestId('activo')).toHaveTextContent('ninguno');
    expect(mockCargarMisViajes).toHaveBeenCalledTimes(1); // no se pide nada sin userId
  });
});

describe('autocorrección de avatarUrl (viajes de antes de que la propagación existiera)', () => {
  it('sin foto en la cuenta, no comprueba ni propaga nada', async () => {
    mockAvatarUrl.valor = null;
    await act(async () => {
      render(arbol());
    });

    expect(mockActualizarAvatarEnMisViajes).not.toHaveBeenCalled();
    expect(mockCargarMisViajes).toHaveBeenCalledTimes(1); // una sola lectura, no dos
  });

  it('con foto en la cuenta y los viajes ya sincronizados, tampoco propaga', async () => {
    mockAvatarUrl.valor = 'https://ejemplo.test/foto.jpg';
    const sincronizado = (v: typeof viaje1) => ({
      ...v,
      usuarios: { [USUARIO]: { ...v.usuarios[USUARIO], avatarUrl: 'https://ejemplo.test/foto.jpg' } },
    });
    mockCargarMisViajes.mockResolvedValue([sincronizado(viaje1), sincronizado(viaje2)]);

    await act(async () => {
      render(arbol());
    });

    expect(mockActualizarAvatarEnMisViajes).not.toHaveBeenCalled();
    expect(mockCargarMisViajes).toHaveBeenCalledTimes(1);
  });

  it('con foto en la cuenta y un viaje sin ella, propaga y recarga con el resultado', async () => {
    mockAvatarUrl.valor = 'https://ejemplo.test/foto.jpg';
    // Primera lectura: el viaje activo no tiene avatarUrl (el caso real que
    // motivó esto: se creó antes de que la propagación existiera). Segunda
    // lectura (tras la propagación): ya la tiene.
    mockCargarMisViajes
      .mockResolvedValueOnce([viaje1, viaje2])
      .mockResolvedValueOnce([
        {
          ...viaje1,
          usuarios: { [USUARIO]: { ...viaje1.usuarios[USUARIO], avatarUrl: 'https://ejemplo.test/foto.jpg' } },
        },
        viaje2,
      ]);

    await act(async () => {
      render(arbol());
    });

    expect(mockActualizarAvatarEnMisViajes).toHaveBeenCalledWith(
      USUARIO,
      'https://ejemplo.test/foto.jpg'
    );
    expect(mockCargarMisViajes).toHaveBeenCalledTimes(2); // la de siempre + la de después de reparar
    expect(screen.getByTestId('avatar-activo')).toHaveTextContent('https://ejemplo.test/foto.jpg');
  });

  it('un viaje finalizado sin foto no cuenta como desincronizado', async () => {
    // Regresión: actualizarAvatarEnMisViajes no toca finalizados (a
    // propósito), así que si este chequeo los contara, cada recarga haría una
    // propagación inútil y una segunda lectura, para siempre.
    mockAvatarUrl.valor = 'https://ejemplo.test/foto.jpg';
    const conFoto = {
      ...viaje1,
      usuarios: { [USUARIO]: { ...viaje1.usuarios[USUARIO], avatarUrl: 'https://ejemplo.test/foto.jpg' } },
    };
    mockCargarMisViajes.mockResolvedValue([conFoto, { ...viaje2, activo: false }]);

    await act(async () => {
      render(arbol());
    });

    expect(mockActualizarAvatarEnMisViajes).not.toHaveBeenCalled();
    expect(mockCargarMisViajes).toHaveBeenCalledTimes(1);
  });

  it('si la propagación falla, no rompe la carga normal (best-effort)', async () => {
    mockAvatarUrl.valor = 'https://ejemplo.test/foto.jpg';
    mockActualizarAvatarEnMisViajes.mockRejectedValue(new Error('sin red'));

    await act(async () => {
      render(arbol());
    });

    expect(screen.getByTestId('cantidad')).toHaveTextContent('2');
    expect(screen.getByTestId('error')).toHaveTextContent(''); // no es un error de carga
  });
});
