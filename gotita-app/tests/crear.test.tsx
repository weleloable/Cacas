/**
 * Tests de "Crear viaje", sobre todo del bug real reproducido a mano contra
 * la app de verdad (Playwright, no adivinado): las pestañas no se desmontan
 * al navegar entre ellas, así que `router.replace('/viaje')` cambiaba la
 * pestaña activa pero dejaba esta pantalla con `creado` todavía puesto. La
 * próxima vez que se volvía a "Crear viaje" reaparecía la pantalla de éxito
 * del viaje anterior (código incluido) en vez de un formulario en blanco.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const USUARIO = '11111111-1111-1111-1111-111111111111';

const mockCrearViaje = jest.fn();
const mockReplace = jest.fn();
const mockSetViajes = jest.fn();
const mockSetViajeActivoId = jest.fn();

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ userId: USUARIO, nombreUsuario: 'Dudu', avatarUrl: null }),
}));

jest.mock('@/lib/viajes', () => ({
  crearViaje: (...args: unknown[]) => mockCrearViaje(...args),
}));

jest.mock('@/lib/viajesContext', () => ({
  useViajes: () => ({ setViajes: mockSetViajes, setViajeActivoId: mockSetViajeActivoId }),
}));

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Crear = require('@/app/(tabs)/crear').default;

const viajeCreado = {
  id: 1,
  nombre: 'Viaje de prueba',
  admin: USUARIO,
  fecha_creacion: '2026-09-14',
  activo: true,
  fecha_finalizacion: null,
  categorias: ['Gotitas', 'Bebidas'],
  usuarios: { [USUARIO]: { nombre: 'Dudu', avatarUrl: null, eventos: {} } },
  codigo: 'ABC-123',
  reporte_llm: {},
};

beforeEach(() => {
  mockCrearViaje.mockReset().mockResolvedValue(viajeCreado);
  mockReplace.mockReset();
  mockSetViajes.mockReset();
  mockSetViajeActivoId.mockReset();
});

async function crearUnViaje() {
  await act(async () => {
    render(<Crear />);
  });
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('Navidades Leon'), 'Viaje de prueba');
  });
  await act(async () => {
    fireEvent.press(screen.getByText('Crear viaje'));
  });
}

describe('Crear viaje', () => {
  it('al crear, enseña la pantalla de éxito con el código', async () => {
    await crearUnViaje();

    expect(screen.getByText('ABC-123')).toBeTruthy();
    expect(screen.getByText('Empezar a contar')).toBeTruthy();
  });

  it('"Empezar a contar" navega a Mi Viaje', async () => {
    await crearUnViaje();

    await act(async () => {
      fireEvent.press(screen.getByText('Empezar a contar'));
    });

    expect(mockReplace).toHaveBeenCalledWith('/viaje');
  });

  it('bug real: tras "Empezar a contar", vuelve a mostrar el formulario en blanco, no la pantalla de éxito vieja', async () => {
    // Las pestañas no se desmontan al navegar (ver CLAUDE.md): esta MISMA
    // instancia sigue montada después del replace, así que comprobar que su
    // estado se reseteó es exactamente lo que hace falta para no reproducir
    // el bug (antes, `creado` se quedaba puesto para siempre).
    await crearUnViaje();

    await act(async () => {
      fireEvent.press(screen.getByText('Empezar a contar'));
    });

    expect(screen.queryByText('ABC-123')).toBeNull();
    expect(screen.queryByText('Empezar a contar')).toBeNull();
    expect(screen.getByPlaceholderText('Navidades Leon')).toBeTruthy();
    // Y en blanco de verdad, no con el nombre del viaje anterior todavía puesto.
    expect(screen.getByPlaceholderText('Navidades Leon')).toHaveDisplayValue('');
  });
});
