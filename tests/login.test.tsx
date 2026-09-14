/**
 * Tests de la pantalla de login, centrados en "¿Olvidaste tu contraseña?":
 * que sólo aparece al entrar (no al crear cuenta), que usa el email ya
 * escrito si lo hay, que pide uno si está vacío en vez de llamar a nada, y
 * que el aviso final no distingue si el correo existe o no.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

const mockEntrar = jest.fn();
const mockRegistrar = jest.fn();
const mockRecuperarContrasena = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    entrar: (...args: unknown[]) => mockEntrar(...args),
    registrar: (...args: unknown[]) => mockRegistrar(...args),
    recuperarContrasena: (...args: unknown[]) => mockRecuperarContrasena(...args),
  }),
}));

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Login = require('@/app/login').default;

// La pantalla usa useSafeAreaInsets, que sin proveedor revienta (no hay
// pantalla real de la que medir en un test).
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function arbol() {
  return (
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Login />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockEntrar.mockReset();
  mockRegistrar.mockReset();
  mockRecuperarContrasena.mockReset().mockResolvedValue(undefined);
  mockReplace.mockReset();
});

async function pulsar(elemento: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(elemento);
  });
}

describe('¿Olvidaste tu contraseña?', () => {
  it('aparece al entrar', async () => {
    await act(async () => {
      render(arbol());
    });
    expect(screen.getByLabelText('¿Olvidaste tu contraseña?')).toBeTruthy();
  });

  it('no aparece al crear cuenta: ahí no tiene sentido recuperar nada todavía', async () => {
    await act(async () => {
      render(arbol());
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Crear cuenta'));
    });
    expect(screen.queryByLabelText('¿Olvidaste tu contraseña?')).toBeNull();
  });

  it('con el email vacío, pide que se escriba primero y no llama a nada', async () => {
    await act(async () => {
      render(arbol());
    });

    await pulsar(screen.getByLabelText('¿Olvidaste tu contraseña?'));

    expect(screen.getByText('Escribe tu email arriba primero.')).toBeTruthy();
    expect(mockRecuperarContrasena).not.toHaveBeenCalled();
  });

  it('con el email ya escrito en el formulario, lo usa sin pedir nada más', async () => {
    await act(async () => {
      render(arbol());
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('tu@email.com'), '  dudu@ejemplo.test  ');
    });

    await pulsar(screen.getByLabelText('¿Olvidaste tu contraseña?'));

    expect(mockRecuperarContrasena).toHaveBeenCalledWith('dudu@ejemplo.test');
  });

  it('al enviarlo con éxito, el aviso no dice si la cuenta existe o no', async () => {
    await act(async () => {
      render(arbol());
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('tu@email.com'), 'cualquiera@ejemplo.test');
    });

    await pulsar(screen.getByLabelText('¿Olvidaste tu contraseña?'));

    expect(
      screen.getByText(
        'Si ese correo está registrado, te hemos enviado un enlace para recuperar tu contraseña.'
      )
    ).toBeTruthy();
  });

  it('si el envío falla de verdad (red, formato...), lo dice con el mensaje del servidor', async () => {
    mockRecuperarContrasena.mockRejectedValue(new Error('Fallo de red simulado'));
    await act(async () => {
      render(arbol());
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('tu@email.com'), 'dudu@ejemplo.test');
    });

    await pulsar(screen.getByLabelText('¿Olvidaste tu contraseña?'));

    expect(screen.getByText('Fallo de red simulado')).toBeTruthy();
  });

  it('entrar y crear cuenta con el formulario normal siguen funcionando igual', async () => {
    mockEntrar.mockResolvedValue(undefined);
    await act(async () => {
      render(arbol());
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('tu@email.com'), 'dudu@ejemplo.test');
      fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'secreto123');
    });

    // "Entrar" aparece dos veces (la pestaña y el botón de enviar): el botón
    // es el último en el árbol.
    const botones = screen.getAllByText('Entrar');
    await pulsar(botones[botones.length - 1]);

    expect(mockEntrar).toHaveBeenCalledWith('dudu@ejemplo.test', 'secreto123');
    expect(mockReplace).toHaveBeenCalledWith('/viaje');
  });
});
