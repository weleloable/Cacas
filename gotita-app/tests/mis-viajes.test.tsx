/**
 * Tests de la pestaña "Mis viajes": listar, marcar como activo y navegar a
 * "Mi Viaje" al elegir uno.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

const USUARIO = '11111111-1111-1111-1111-111111111111';

const viaje1 = {
  id: 1,
  nombre: 'Cangas',
  admin: USUARIO,
  fecha_creacion: '2026-09-01',
  activo: true,
  categorias: ['Gotitas'],
  usuarios: { [USUARIO]: { nombre: 'Dudu', eventos: {} } },
  codigo: 'ABC-123',
  reporte_llm: null,
};
const viaje2 = { ...viaje1, id: 2, nombre: 'Oktoberfest', codigo: 'XYZ-999' };

const mockCargarMisViajes = jest.fn();
const mockPush = jest.fn();

jest.mock('@/lib/viajes', () => ({
  cargarMisViajes: (...args: unknown[]) => mockCargarMisViajes(...args),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ userId: USUARIO, session: { user: { id: USUARIO } } }),
}));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ViajesProvider } = require('@/lib/viajesContext');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PantallaMisViajes = require('@/app/(tabs)/mis-viajes').default;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderPantalla() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ViajesProvider>
        <PantallaMisViajes />
      </ViajesProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockCargarMisViajes.mockReset().mockResolvedValue([viaje1, viaje2]);
});

describe('Mis viajes', () => {
  it('lista los viajes y marca el primero como activo por defecto', async () => {
    await act(async () => {
      renderPantalla();
    });

    expect(screen.getByText('Cangas')).toBeTruthy();
    expect(screen.getByText('Oktoberfest')).toBeTruthy();
    // No basta con que exista una insignia "Activo" en algún sitio de la
    // pantalla: tiene que colgar de la tarjeta correcta. Contar sólo el
    // total dejaría pasar la insignia congelada en la tarjeta equivocada.
    expect(within(screen.getByTestId('viaje-1')).getByText('Activo')).toBeTruthy();
    expect(within(screen.getByTestId('viaje-2')).queryByText('Activo')).toBeNull();
  });

  it('tocar un viaje distinto mueve la insignia a su tarjeta y navega a Mi Viaje', async () => {
    await act(async () => {
      renderPantalla();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('viaje-2'));
    });

    expect(mockPush).toHaveBeenCalledWith('/viaje');
    expect(within(screen.getByTestId('viaje-2')).getByText('Activo')).toBeTruthy();
    expect(within(screen.getByTestId('viaje-1')).queryByText('Activo')).toBeNull();
  });

  it('sin viajes, enseña el estado vacío y no una lista rota', async () => {
    mockCargarMisViajes.mockResolvedValue([]);
    await act(async () => {
      renderPantalla();
    });

    expect(screen.getByText('Todavía no estás en ningún viaje')).toBeTruthy();
    expect(screen.queryByText('Activo')).toBeNull();
  });

  it('siempre ofrece crear o unirse, haya o no viajes', async () => {
    await act(async () => {
      renderPantalla();
    });

    expect(screen.getByText('Crear un viaje')).toBeTruthy();
    expect(screen.getByText('Unirme con un código')).toBeTruthy();
  });
});
