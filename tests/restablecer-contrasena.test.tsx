/**
 * Tests de la pantalla "Nueva contraseña": leer el hash del enlace del
 * email, abrir la sesión de recuperación, y el formulario de la contraseña
 * nueva en sí. No se mockea `lib/recuperacion` (es pura, se ejercita de
 * verdad con hashes reales); sólo `lib/auth` (donde vive la llamada a
 * Supabase) y `expo-router`.
 *
 * jsdom bajo este preset no trae `window.location` (comprobado: es
 * `undefined`, no un objeto con valores por defecto), así que hay que
 * ponerlo a mano en cada test con `Object.defineProperty`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockIniciarSesionRecuperacion = jest.fn();
const mockActualizarContrasena = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    iniciarSesionRecuperacion: (...args: unknown[]) => mockIniciarSesionRecuperacion(...args),
    actualizarContrasena: (...args: unknown[]) => mockActualizarContrasena(...args),
  }),
}));

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RestablecerContrasena = require('@/app/restablecer-contrasena').default;

const HASH_VALIDO =
  '#access_token=token-de-acceso&refresh_token=token-de-refresco&expires_in=3600&token_type=bearer&type=recovery';

function ponerUbicacion(hash: string, pathname = '/Gotita/restablecer-contrasena') {
  const replaceState = jest.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'https://weleloable.github.io', pathname, hash },
  });
  Object.defineProperty(window, 'history', {
    configurable: true,
    value: { replaceState },
  });
  return replaceState;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockIniciarSesionRecuperacion.mockReset().mockResolvedValue(undefined);
  mockActualizarContrasena.mockReset().mockResolvedValue(undefined);
  mockReplace.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

async function montar() {
  await act(async () => {
    render(<RestablecerContrasena />);
  });
}

describe('enlace inválido', () => {
  it('sin hash de recuperación (pantalla abierta a pelo, sin pasar por el email): error, sin formulario', async () => {
    ponerUbicacion('');
    await montar();

    expect(screen.getByText(/no es válido o ya se ha usado/)).toBeTruthy();
    expect(screen.queryByLabelText('Guardar contraseña nueva')).toBeNull();
    expect(mockIniciarSesionRecuperacion).not.toHaveBeenCalled();
  });

  it('un hash de otro flujo (type distinto de recovery): mismo error', async () => {
    ponerUbicacion('#access_token=a&refresh_token=b&type=signup');
    await montar();

    expect(screen.getByText(/no es válido o ya se ha usado/)).toBeTruthy();
  });

  it('hash válido pero el enlace ya caducó (setSession falla): lo dice y no enseña el formulario', async () => {
    ponerUbicacion(HASH_VALIDO);
    mockIniciarSesionRecuperacion.mockRejectedValue(new Error('Enlace caducado'));
    await montar();

    expect(screen.getByText('Enlace caducado')).toBeTruthy();
    expect(screen.queryByLabelText('Guardar contraseña nueva')).toBeNull();
  });
});

describe('enlace válido', () => {
  it('abre la sesión de recuperación con los tokens del hash y enseña el formulario', async () => {
    ponerUbicacion(HASH_VALIDO);
    await montar();

    expect(mockIniciarSesionRecuperacion).toHaveBeenCalledWith(
      'token-de-acceso',
      'token-de-refresco'
    );
    expect(screen.getByLabelText('Guardar contraseña nueva')).toBeTruthy();
  });

  it('limpia el hash de la URL una vez leído: los tokens no se quedan a la vista', async () => {
    const replaceState = ponerUbicacion(HASH_VALIDO);
    await montar();

    expect(replaceState).toHaveBeenCalledWith(null, '', '/Gotita/restablecer-contrasena');
  });

  it('contraseña corta: error, no llama a actualizarContrasena', async () => {
    ponerUbicacion(HASH_VALIDO);
    await montar();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), '123');
      fireEvent.changeText(screen.getByPlaceholderText('Repite la contraseña'), '123');
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar contraseña nueva'));
    });

    expect(screen.getByText('La contraseña necesita al menos 6 caracteres.')).toBeTruthy();
    expect(mockActualizarContrasena).not.toHaveBeenCalled();
  });

  it('las dos contraseñas no coinciden: error, no llama a nada', async () => {
    ponerUbicacion(HASH_VALIDO);
    await montar();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'secreto123');
      fireEvent.changeText(screen.getByPlaceholderText('Repite la contraseña'), 'otra-cosa');
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar contraseña nueva'));
    });

    expect(screen.getByText('Las dos contraseñas no coinciden.')).toBeTruthy();
    expect(mockActualizarContrasena).not.toHaveBeenCalled();
  });

  it('coincidiendo, guarda y redirige a /viaje tras el aviso de éxito', async () => {
    ponerUbicacion(HASH_VALIDO);
    await montar();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'secreto123');
      fireEvent.changeText(screen.getByPlaceholderText('Repite la contraseña'), 'secreto123');
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar contraseña nueva'));
    });

    expect(mockActualizarContrasena).toHaveBeenCalledWith('secreto123');
    expect(screen.getByText('Contraseña actualizada. Entrando…')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled(); // todavía no: espera al timeout

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockReplace).toHaveBeenCalledWith('/viaje');
  });

  it('si falla al guardar (p.ej. sesión de recuperación ya usada), lo dice y no redirige', async () => {
    ponerUbicacion(HASH_VALIDO);
    mockActualizarContrasena.mockRejectedValue(new Error('Fallo de red simulado'));
    await montar();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'secreto123');
      fireEvent.changeText(screen.getByPlaceholderText('Repite la contraseña'), 'secreto123');
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar contraseña nueva'));
    });

    expect(screen.getByText('Fallo de red simulado')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    // El formulario sigue ahí: no se ha "consumido" el intento fallido.
    expect(screen.getByLabelText('Guardar contraseña nueva')).toBeTruthy();
  });
});
