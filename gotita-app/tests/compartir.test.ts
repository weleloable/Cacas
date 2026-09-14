/**
 * Tests de lib/compartir.ts, en concreto del bug real que motivó este
 * fichero: el botón de compartir en web no hacía nada.
 *
 * `navigator.share` es un método de instancia — el spec WebIDL lo declara
 * como operación de la interfaz `Navigator`, así que exige que `this` sea el
 * propio `navigator` cuando se invoca. Sacarlo a una variable suelta y
 * llamarlo aparte (`const f = navigator.share; f(...)`) rompe ese `this`, y
 * un navegador de verdad responde con "TypeError: Illegal invocation". Este
 * test reproduce exactamente esa exigencia con un `navigator` de mentira que
 * revienta si no se le llama ligado, para que una futura refactorización que
 * vuelva a desligarlo falle aquí en vez de en el móvil de alguien.
 *
 * `compartirCodigoEnWeb` se prueba aparte (no `compartirCodigo` con
 * `Platform.OS` forzado a 'web'): React Native resuelve `Platform.OS` por una
 * tabla de plataformas de Haste antes de que corra ningún test, y bajo Jest
 * ese valor es 'ios' fijo — no algo que un `jest.mock` normal pueda cambiar
 * sin reventar media librería. `compartirCodigo` en sí (la rama nativa) se
 * prueba con `Share.share`, que es la plataforma que Jest ya resuelve aquí.
 */
import { Share } from 'react-native';

import { compartirCodigo, compartirCodigoEnWeb, copiarCodigo } from '@/lib/compartir';

const mockSetStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

/** navigator.share que exige `this === estaNavigator`, como un navegador de verdad. */
function navegadorConShareLigado() {
  const estaNavigator = {
    share(this: unknown, _datos: { title: string; text: string }): Promise<void> {
      if (this !== estaNavigator) throw new TypeError('Illegal invocation');
      return Promise.resolve();
    },
  };
  return estaNavigator;
}

beforeEach(() => {
  mockSetStringAsync.mockReset();
});

describe('compartirCodigoEnWeb', () => {
  it('llama a navigator.share ligado a navigator (regresión del botón que no hacía nada)', async () => {
    const nav = navegadorConShareLigado();

    const resultado = await compartirCodigoEnWeb(nav, 'Únete con ABC-123', 'ABC-123');

    expect(resultado).toBe('compartido');
    expect(mockSetStringAsync).not.toHaveBeenCalled(); // no hizo falta el fallback
  });

  it('sin Web Share API en el navegador, cae a copiar el código', async () => {
    mockSetStringAsync.mockResolvedValue(undefined);

    const resultado = await compartirCodigoEnWeb({}, 'Únete con ABC-123', 'ABC-123');

    expect(resultado).toBe('copiado');
    expect(mockSetStringAsync).toHaveBeenCalledWith('ABC-123');
  });

  it('sin navigator en absoluto, también cae a copiar', async () => {
    const resultado = await compartirCodigoEnWeb(undefined, 'Únete con ABC-123', 'ABC-123');
    expect(resultado).toBe('copiado');
  });

  it('si el usuario cierra el panel de compartir, no es un error', async () => {
    const nav = { share: () => Promise.reject(new DOMException('cancelado', 'AbortError')) };

    const resultado = await compartirCodigoEnWeb(nav, 'Únete con ABC-123', 'ABC-123');

    expect(resultado).toBe('cancelado');
  });
});

describe('compartirCodigo (nativo, vía Share.share)', () => {
  const spyShare = jest.spyOn(Share, 'share');

  afterEach(() => spyShare.mockReset());

  it('arma el mensaje con el nombre del viaje y el código', async () => {
    spyShare.mockResolvedValue({ action: Share.sharedAction });

    await compartirCodigo('Cangas', 'ABC-123');

    expect(spyShare).toHaveBeenCalledWith({
      message: 'Únete a "Cangas" en Gotita con el código ABC-123',
    });
  });

  it('devuelve "compartido" cuando el resultado es sharedAction', async () => {
    spyShare.mockResolvedValue({ action: Share.sharedAction });
    await expect(compartirCodigo('Cangas', 'ABC-123')).resolves.toBe('compartido');
  });

  it('devuelve "cancelado" cuando el resultado es dismissedAction', async () => {
    spyShare.mockResolvedValue({ action: Share.dismissedAction });
    await expect(compartirCodigo('Cangas', 'ABC-123')).resolves.toBe('cancelado');
  });
});

describe('copiarCodigo', () => {
  it('copia el código tal cual al portapapeles', async () => {
    mockSetStringAsync.mockResolvedValue(undefined);

    await copiarCodigo('XYZ-999');

    expect(mockSetStringAsync).toHaveBeenCalledWith('XYZ-999');
  });
});
