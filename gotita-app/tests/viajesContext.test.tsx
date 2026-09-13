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

jest.mock('@/lib/viajes', () => ({
  cargarMisViajes: (...args: unknown[]) => mockCargarMisViajes(...args),
}));

const mockSesion = { valor: { user: { id: USUARIO } } };

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ userId: USUARIO, session: mockSesion.valor }),
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
  mockCargarMisViajes.mockReset().mockResolvedValue([viaje1, viaje2]);
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
});
