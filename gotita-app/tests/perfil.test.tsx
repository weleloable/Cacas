/**
 * Tests de Perfil, sobre todo de lo no obvio: cambiar el nombre no sólo
 * afecta a la cuenta, también tiene que llegar a los viajes en los que ya
 * estás, porque el nombre de cada viaje es una COPIA guardada en su JSON
 * `usuarios`, no una referencia a la cuenta.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

const USUARIO = '11111111-1111-1111-1111-111111111111';

const mockActualizarNombre = jest.fn();
const mockSalir = jest.fn();
const mockActualizarNombreEnMisViajes = jest.fn();
const mockCargarMisViajes = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    session: { user: { id: USUARIO, email: 'dudu@example.com' } },
    userId: USUARIO,
    nombreUsuario: 'Dudu',
    actualizarNombre: (...args: unknown[]) => mockActualizarNombre(...args),
    salir: (...args: unknown[]) => mockSalir(...args),
  }),
}));

jest.mock('@/lib/viajes', () => ({
  actualizarNombreEnMisViajes: (...args: unknown[]) => mockActualizarNombreEnMisViajes(...args),
  cargarMisViajes: (...args: unknown[]) => mockCargarMisViajes(...args),
}));

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

// Bajo Jest, expo-constants nunca lleva el manifest real (eso lo inyecta el
// build de Expo en tiempo de bundle, no algo que exista en un entorno de
// test): sin este mock, expoConfig llega como `{}` y no hay forma de probar
// que la versión se pinta de verdad, sólo el "—" del fallback.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ViajesProvider } = require('@/lib/viajesContext');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Perfil = require('@/app/(tabs)/perfil').default;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderPantalla() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ViajesProvider>
        <Perfil />
      </ViajesProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockActualizarNombre.mockReset().mockResolvedValue(undefined);
  mockActualizarNombreEnMisViajes.mockReset().mockResolvedValue(undefined);
  mockCargarMisViajes.mockReset().mockResolvedValue([]);
  mockSalir.mockReset().mockResolvedValue(undefined);
  mockReplace.mockReset();
});

describe('Perfil', () => {
  it('muestra el nombre y el email actuales', async () => {
    await act(async () => {
      renderPantalla();
    });

    expect(screen.getByDisplayValue('Dudu')).toBeTruthy();
    expect(screen.getByText('dudu@example.com')).toBeTruthy();
  });

  it('guardar está deshabilitado si no se ha cambiado nada', async () => {
    await act(async () => {
      renderPantalla();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });
    expect(mockActualizarNombre).not.toHaveBeenCalled();
  });

  it('guardar actualiza la cuenta Y los viajes, en ese orden', async () => {
    await act(async () => {
      renderPantalla();
    });

    await act(async () => {
      fireEvent.changeText(screen.getByDisplayValue('Dudu'), 'Eduardo');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });

    expect(mockActualizarNombre).toHaveBeenCalledWith('Eduardo');
    expect(mockActualizarNombreEnMisViajes).toHaveBeenCalledWith(USUARIO, 'Eduardo');
    // La cuenta se actualiza antes que los viajes: si el orden se invirtiera,
    // un fallo en la cuenta dejaría los viajes con un nombre que la sesión no
    // tiene.
    const ordenCuenta = mockActualizarNombre.mock.invocationCallOrder[0];
    const ordenViajes = mockActualizarNombreEnMisViajes.mock.invocationCallOrder[0];
    expect(ordenCuenta).toBeLessThan(ordenViajes);

    expect(screen.getByText('Nombre actualizado.')).toBeTruthy();
  });

  it('un nombre en blanco no se envía a ningún sitio', async () => {
    await act(async () => {
      renderPantalla();
    });

    await act(async () => {
      fireEvent.changeText(screen.getByDisplayValue('Dudu'), '   ');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });

    expect(mockActualizarNombre).not.toHaveBeenCalled();
  });

  it('si falla la cuenta, no se toca ningún viaje', async () => {
    mockActualizarNombre.mockRejectedValue(new Error('email no verificado'));
    await act(async () => {
      renderPantalla();
    });

    await act(async () => {
      fireEvent.changeText(screen.getByDisplayValue('Dudu'), 'Eduardo');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });

    expect(mockActualizarNombreEnMisViajes).not.toHaveBeenCalled();
    expect(screen.getByText('email no verificado')).toBeTruthy();
  });

  it('si falla sólo la propagación a los viajes, el mensaje deja claro que la cuenta SÍ se guardó', async () => {
    // La cuenta puede tener éxito y el segundo paso fallar por separado (un
    // corte de red justo entre medias). El mensaje de "no se ha podido
    // guardar" sería mentira: el nombre de la cuenta ya cambió.
    mockActualizarNombreEnMisViajes.mockRejectedValue(new Error('sin red'));
    await act(async () => {
      renderPantalla();
    });

    await act(async () => {
      fireEvent.changeText(screen.getByDisplayValue('Dudu'), 'Eduardo');
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });

    expect(mockActualizarNombre).toHaveBeenCalledWith('Eduardo'); // sí se llamó, y con éxito
    expect(screen.getByText(/Se guardó el nombre/)).toBeTruthy();
    expect(screen.queryByText('Nombre actualizado.')).toBeNull();
  });

  it('salir cierra sesión y manda al login', async () => {
    await act(async () => {
      renderPantalla();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Salir'));
    });

    expect(mockSalir).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('enseña la versión de la app, abajo del todo', async () => {
    await act(async () => {
      renderPantalla();
    });

    expect(screen.getByText('Gotita v1.0.0')).toBeTruthy();
  });

});
