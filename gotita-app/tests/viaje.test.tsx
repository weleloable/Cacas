/**
 * Tests de la pantalla, que es donde vive lo que se pidió: que el botón −
 * pida confirmación en vez de restar.
 *
 * Los tests del diálogo aislado no cubren esto: se puede tener un diálogo
 * perfecto y el − cableado directamente a la resta.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MS_DE_ARMADO } from '@/componentes/DialogoConfirmar';

const USUARIO = '11111111-1111-1111-1111-111111111111';

const viajeBase = {
  id: 1,
  nombre: 'Cangas',
  admin: USUARIO,
  fecha_creacion: '2026-09-01',
  activo: true,
  categorias: ['Gotitas'],
  usuarios: { [USUARIO]: { nombre: 'Dudu', eventos: { cacas: 3, pises: 0 } } },
  codigo: 'ABC-123',
  reporte_llm: null,
};

// jest.mock se iza al principio del fichero, así que su factoría sólo puede
// referenciar variables cuyo nombre empiece por `mock`.
const mockCargarMisViajes = jest.fn();
const mockModificarEvento = jest.fn();

jest.mock('@/lib/viajes', () => ({
  cargarMisViajes: (...args: unknown[]) => mockCargarMisViajes(...args),
  modificarEvento: (...args: unknown[]) => mockModificarEvento(...args),
  totalDeUsuario: (u: { eventos: Record<string, number> }) =>
    Object.values(u.eventos ?? {}).reduce((a, b) => a + b, 0),
}));

// La sesión es un objeto mutable a propósito: cambiar su identidad es lo que
// hace Supabase al refrescar el token, y es lo que dispara la recarga.
const mockSesion = { valor: { user: { id: USUARIO } } };

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    session: mockSesion.valor,
    userId: USUARIO,
    nombreUsuario: 'Dudu',
    salir: jest.fn(),
    cargando: false,
  }),
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

// Se importa después de los mocks, que es como jest los engancha.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PantallaViaje = require('@/app/viaje').default;

// La pantalla usa useSafeAreaInsets, que sin proveedor revienta. En un test no
// hay pantalla real de la que medir, así que se le dan métricas fijas.
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Un elemento nuevo cada vez: reusar el mismo objeto hace que React se salte
// el re-render por completo, y entonces el rerender del test no prueba nada.
function arbol() {
  return (
    <SafeAreaProvider initialMetrics={METRICAS}>
      <PantallaViaje />
    </SafeAreaProvider>
  );
}

function renderPantalla() {
  return render(arbol());
}

/**
 * Pulsa y deja que se asiente lo que la pulsación dispara.
 *
 * Las escrituras van encoladas en una promesa (`cola` en viaje.tsx), o sea que
 * `modificarEvento` se llama en un microtask posterior al press. Sin vaciar la
 * cola aquí, cualquier assert sobre la escritura se haría antes de que ocurra.
 */
async function pulsar(elemento: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(elemento);
  });
}

/** Deja pasar la ventana de armado del diálogo. */
async function armar() {
  await act(async () => {
    jest.advanceTimersByTime(MS_DE_ARMADO + 50);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSesion.valor = { user: { id: USUARIO } };
  mockCargarMisViajes.mockReset().mockResolvedValue([viajeBase]);
  mockModificarEvento.mockReset().mockImplementation(async (_id, _u, clave, delta) => ({
    ...viajeBase,
    usuarios: {
      [USUARIO]: {
        nombre: 'Dudu',
        eventos: { ...viajeBase.usuarios[USUARIO].eventos, [clave]: 3 + delta },
      },
    },
  }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('botón − de la pantalla de viaje', () => {
  it('no resta al pulsarlo: abre el diálogo y no escribe nada', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));

    expect(screen.getByText('¿Quitar 1 de cacas?')).toBeTruthy();
    expect(screen.getByText('Pasarías de 3 a 2.')).toBeTruthy();
    expect(mockModificarEvento).not.toHaveBeenCalled();
  });

  it('confirmar sí resta, con delta -1', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await armar();
    await pulsar(screen.getByLabelText('Sí, quitar'));

    expect(mockModificarEvento).toHaveBeenCalledTimes(1);
    expect(mockModificarEvento).toHaveBeenCalledWith(1, USUARIO, 'cacas', -1);
  });

  it('cancelar no escribe nada y cierra el diálogo', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await armar();
    await pulsar(screen.getByLabelText('Cancelar'));

    expect(mockModificarEvento).not.toHaveBeenCalled();
    expect(screen.queryByText('¿Quitar 1 de cacas?')).toBeNull();
  });

  it('un toque nada más abrirse no confirma: es la ventana del doble toque', async () => {
    // react-native-web monta el modal clicable desde el frame 0 mientras se
    // funde durante 250ms (animatedIn no lleva pointerEvents: 'none'). Sin la
    // ventana de armado, el segundo toque de un doble toque en − cae sobre
    // "Sí, quitar" cuando todavía es invisible y resta a ciegas.
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await act(async () => {
      jest.advanceTimersByTime(80); // doble toque humano rápido
    });
    await pulsar(screen.getByLabelText('Sí, quitar'));

    expect(mockModificarEvento).not.toHaveBeenCalled();
    // Y el diálogo sigue abierto, para que el usuario lo vea.
    expect(screen.getByText('¿Quitar 1 de cacas?')).toBeTruthy();
  });

  it('cancelar tampoco funciona dentro de la ventana, para que no se cierre a ciegas', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await pulsar(screen.getByLabelText('Cancelar'));

    expect(screen.getByText('¿Quitar 1 de cacas?')).toBeTruthy();
  });

  it('pasada la ventana, el mismo toque sí confirma', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await armar();
    await pulsar(screen.getByLabelText('Sí, quitar'));

    expect(mockModificarEvento).toHaveBeenCalledTimes(1);
  });

  it('el − está deshabilitado a 0, y no abre nada', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Pises')); // está a 0
    expect(screen.queryByText('¿Quitar 1 de pises?')).toBeNull();
    expect(mockModificarEvento).not.toHaveBeenCalled();
  });

  it('sumar sigue siendo un solo toque, sin diálogo', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Sumar uno a Cacas'));

    expect(screen.queryByText(/¿Quitar/)).toBeNull();
    expect(mockModificarEvento).toHaveBeenCalledWith(1, USUARIO, 'cacas', 1);
  });

  it('si la cuenta cambia con el diálogo abierto, no resta y lo dice', async () => {
    // Pasa de verdad: Supabase dispara TOKEN_REFRESHED al volver a la pestaña,
    // cambia la identidad de `session` y la pantalla recarga sola.
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await armar();

    // Alguien suma desde otro móvil, y al volver a la pestaña Supabase
    // refresca el token: `session` cambia de identidad y la pantalla recarga.
    mockCargarMisViajes.mockResolvedValue([
      { ...viajeBase, usuarios: { [USUARIO]: { nombre: 'Dudu', eventos: { cacas: 5, pises: 0 } } } },
    ]);
    mockSesion.valor = { user: { id: USUARIO } };
    await act(async () => {
      screen.rerender(arbol());
    });

    // El 5 sale dos veces: el contador de la tarjeta y el total del ranking.
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);

    await pulsar(screen.getByLabelText('Sí, quitar'));

    expect(mockModificarEvento).not.toHaveBeenCalled();
    expect(screen.getByText(/La cuenta cambió mientras confirmabas/)).toBeTruthy();
  });
});
