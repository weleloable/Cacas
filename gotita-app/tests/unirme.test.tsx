/**
 * Tests de unirse a un viaje por código, montado junto a "Mi Viaje" bajo el
 * MISMO ViajesProvider sin desmontar entre medias — así es como funciona de
 * verdad: unirme.tsx es una ruta hermana de (tabs) en el Stack raíz, no una
 * descendiente, y el contexto compartido vive por encima de las dos. Un test
 * que renderizase unirme.tsx sola no habría pillado el bug real: que
 * unirseAViaje() no avisaba al contexto, así que "Mi Viaje" seguía
 * enseñando el viaje anterior hasta un refresco manual.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

const USUARIO = '11111111-1111-1111-1111-111111111111';

const viajeViejo = {
  id: 1,
  nombre: 'Cangas',
  admin: USUARIO,
  fecha_creacion: '2026-09-01',
  activo: true,
  categorias: ['Gotitas'],
  usuarios: { [USUARIO]: { nombre: 'Dudu', eventos: { cacas: 2 } } },
  codigo: 'ABC-123',
  reporte_llm: null,
};
const viajeNuevo = {
  ...viajeViejo,
  id: 2,
  nombre: 'Oktoberfest',
  codigo: 'XYZ-999',
  usuarios: { [USUARIO]: { nombre: 'Dudu', eventos: {} } },
};

const mockCargarMisViajes = jest.fn();
const mockBuscarPorCodigo = jest.fn();
const mockUnirseAViaje = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/lib/viajes', () => ({
  cargarMisViajes: (...a: unknown[]) => mockCargarMisViajes(...a),
  buscarPorCodigo: (...a: unknown[]) => mockBuscarPorCodigo(...a),
  unirseAViaje: (...a: unknown[]) => mockUnirseAViaje(...a),
  totalDeUsuario: (u: { eventos: Record<string, number> }) =>
    Object.values(u.eventos ?? {}).reduce((a, b) => a + b, 0),
}));

// Objeto estable a propósito: si el mock devolviera `{ user: {...} }` nuevo
// en cada llamada, el efecto de viajesContext.tsx que recarga cuando cambia
// la IDENTIDAD de `session` se dispararía en cada render (no sólo cuando
// Supabase refresca el token de verdad) y pisaría el `setViajes` optimista
// de unirme.tsx con la respuesta vieja de `cargarMisViajes`.
const SESION_ESTABLE = { user: { id: USUARIO } };

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    session: SESION_ESTABLE,
    userId: USUARIO,
    nombreUsuario: 'Dudu',
    salir: jest.fn(),
    cargando: false,
  }),
}));

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ViajesProvider } = require('@/lib/viajesContext');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Unirme = require('@/app/unirme').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PantallaViaje = require('@/app/(tabs)/viaje').default;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Las dos pantallas dentro del mismo proveedor, ambas montadas a la vez, tal
 * como conviven de verdad dos rutas en un Stack (la de abajo no se desmonta
 * al navegar a la de arriba). El test decide cuál "mirar" en cada momento.
 */
function arbol() {
  return (
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ViajesProvider>
        <Unirme />
        <PantallaViaje />
      </ViajesProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockCargarMisViajes.mockReset().mockResolvedValue([viajeViejo]);
  mockBuscarPorCodigo.mockReset().mockResolvedValue(viajeNuevo);
  mockUnirseAViaje.mockReset().mockResolvedValue(viajeNuevo);
  mockReplace.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('unirse a un viaje', () => {
  it('tras unirse, Mi Viaje enseña el viaje nuevo sin esperar a un refresco', async () => {
    await act(async () => {
      render(arbol());
    });

    // De entrada, Mi Viaje muestra el único viaje que ya había.
    expect(screen.getByText('Cangas')).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('ABC-123'), 'XYZ-999');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Buscar y unirme'));
      // alUnirse encadena buscarPorCodigo -> unirseAViaje -> setViajes/
      // setViajeActivoId -> el re-render de PantallaViaje: varias vueltas de
      // microtask, no una.
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });

    expect(mockUnirseAViaje).toHaveBeenCalledWith(viajeNuevo, USUARIO, 'Dudu');
    // Antes del arreglo esto seguía en "Cangas": unirseAViaje() escribía en
    // Supabase pero nadie avisaba al contexto compartido, y como las pestañas
    // no se desmontan al navegar, "Mi Viaje" nunca volvía a preguntar.
    expect(screen.getByText('Oktoberfest')).toBeTruthy();
  });

  it('el mensaje de éxito nombra el viaje y luego navega', async () => {
    await act(async () => {
      render(arbol());
    });

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('ABC-123'), 'XYZ-999');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Buscar y unirme'));
    });

    expect(screen.getByText('¡Dentro de Oktoberfest!')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    expect(mockReplace).toHaveBeenCalledWith('/viaje');
  });

  it('un código que no existe no toca el contexto ni el viaje activo', async () => {
    mockBuscarPorCodigo.mockResolvedValue(null);
    await act(async () => {
      render(arbol());
    });

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('ABC-123'), 'NADA-00');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Buscar y unirme'));
    });

    expect(mockUnirseAViaje).not.toHaveBeenCalled();
    expect(screen.getByText('Cangas')).toBeTruthy(); // sigue el de siempre
  });
});
