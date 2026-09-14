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
const mockCopiarCodigo = jest.fn();
const mockCompartirCodigo = jest.fn();

// viaje.tsx hace `e instanceof ConflictoDeConcurrencia`, así que el mock del
// módulo tiene que exportar y lanzar la misma clase o ese `catch` nunca entra.
jest.mock('@/lib/viajes', () => {
  class ConflictoDeConcurrencia extends Error {
    valorEnServidor: number;
    constructor(valorEnServidor: number) {
      super('conflicto');
      this.name = 'ConflictoDeConcurrencia';
      this.valorEnServidor = valorEnServidor;
    }
  }
  return {
    cargarMisViajes: (...args: unknown[]) => mockCargarMisViajes(...args),
    modificarEvento: (...args: unknown[]) => mockModificarEvento(...args),
    ConflictoDeConcurrencia,
  };
});

jest.mock('@/lib/compartir', () => ({
  copiarCodigo: (...args: unknown[]) => mockCopiarCodigo(...args),
  compartirCodigo: (...args: unknown[]) => mockCompartirCodigo(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ConflictoDeConcurrencia } = require('@/lib/viajes');

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
const PantallaViaje = require('@/app/(tabs)/viaje').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ViajesProvider } = require('@/lib/viajesContext');

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
      <ViajesProvider>
        <PantallaViaje />
      </ViajesProvider>
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
    // Vacía varias vueltas de microtask: el camino de error de
    // alConfirmarResta encadena `await modificarEvento` (rechaza) → catch →
    // `await recargar()` → `await cargarMisViajes`, y una sola vuelta no basta
    // para que el estado de la última vuelta llegue a pintarse.
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

/** Deja pasar la ventana de armado del diálogo. */
async function armar() {
  await act(async () => {
    jest.advanceTimersByTime(MS_DE_ARMADO + 50);
  });
}

/**
 * Servidor de mentira con estado propio, para que `modificarEvento` pueda
 * comprobar el `valorEsperado` contra "lo que hay ahora mismo" en vez de
 * contra una fórmula fija. Es lo único que puede reproducir de verdad el
 * conflicto de concurrencia: el cliente pide restar de 3, pero el servidor ya
 * tiene 5 porque otro dispositivo sumó entre medias.
 */
function servidorDeMentira(cacasIniciales: number) {
  const estado = { cacas: cacasIniciales };
  mockModificarEvento.mockImplementation(
    async (_id: number, _u: string, clave: string, delta: number, valorEsperado?: number) => {
      const actual = estado[clave as keyof typeof estado] ?? 0;
      if (valorEsperado !== undefined && actual !== valorEsperado) {
        throw new ConflictoDeConcurrencia(actual);
      }
      estado[clave as keyof typeof estado] = Math.max(0, actual + delta);
      return {
        ...viajeBase,
        usuarios: {
          [USUARIO]: {
            nombre: 'Dudu',
            eventos: { ...viajeBase.usuarios[USUARIO].eventos, [clave]: estado[clave as keyof typeof estado] },
          },
        },
      };
    }
  );
  return estado;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSesion.valor = { user: { id: USUARIO } };
  mockCargarMisViajes.mockReset().mockResolvedValue([viajeBase]);
  mockModificarEvento.mockReset();
  mockCopiarCodigo.mockReset().mockResolvedValue(undefined);
  mockCompartirCodigo.mockReset().mockResolvedValue('compartido');
  servidorDeMentira(3);
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

  it('confirmar sí resta, con delta -1 y el valor esperado que prometió el diálogo', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await armar();
    await pulsar(screen.getByLabelText('Sí, quitar'));

    expect(mockModificarEvento).toHaveBeenCalledTimes(1);
    expect(mockModificarEvento).toHaveBeenCalledWith(1, USUARIO, 'cacas', -1, 3);
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

  it('cancelar sí funciona dentro de la ventana: cancelar pronto nunca es un problema', async () => {
    // A diferencia de confirmar, cancelar no lleva la espera de armado: no
    // destruye nada, así que no hay doble toque que proteger.
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await pulsar(screen.getByLabelText('Cancelar'));

    expect(screen.queryByText('¿Quitar 1 de cacas?')).toBeNull();
    expect(mockModificarEvento).not.toHaveBeenCalled();
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

  it('si otro dispositivo sumó mientras el diálogo estaba abierto, no resta y lo dice', async () => {
    // El caso real que esto protege: no hace falta que la pantalla local se
    // entere de nada (sin ese `recargar` de por medio también tiene que
    // funcionar), basta con que el SERVIDOR ya no tenga el valor que el
    // diálogo prometió. Es `modificarEvento` quien lo descubre al escribir.
    const servidor = servidorDeMentira(3);
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await armar();

    servidor.cacas = 5; // alguien sumó 2 desde otro móvil, sin que esta pantalla se entere

    await pulsar(screen.getByLabelText('Sí, quitar'));

    expect(screen.getByText(/La cuenta cambió mientras confirmabas/)).toBeTruthy();
    expect(screen.getByText(/ahora hay 5/)).toBeTruthy();
    expect(servidor.cacas).toBe(5); // no se ha tocado
  });

  it('un error normal de guardado también avisa con el mensaje del servidor', async () => {
    servidorDeMentira(3);
    mockModificarEvento.mockRejectedValueOnce(new Error('Fallo de red simulado'));
    await renderPantalla();

    await pulsar(screen.getByLabelText('Quitar uno de Cacas'));
    await armar();
    await pulsar(screen.getByLabelText('Sí, quitar'));

    expect(screen.getByText('Fallo de red simulado')).toBeTruthy();
  });
});

describe('código del viaje: copiar y compartir', () => {
  it('pulsar el código lo copia y enseña un aviso', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Copiar código del viaje'));

    expect(mockCopiarCodigo).toHaveBeenCalledWith('ABC-123');
    expect(screen.getByText('Código copiado')).toBeTruthy();
  });

  it('el aviso desaparece pasado un tiempo', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Copiar código del viaje'));
    expect(screen.getByText('Código copiado')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2100);
    });

    expect(screen.queryByText('Código copiado')).toBeNull();
  });

  it('el botón de compartir llama a compartirCodigo con el nombre y el código', async () => {
    await renderPantalla();

    await pulsar(screen.getByLabelText('Compartir código del viaje'));

    expect(mockCompartirCodigo).toHaveBeenCalledWith('Cangas', 'ABC-123');
  });

  it('si compartir cae al fallback de copiar (web sin Web Share API), también avisa', async () => {
    mockCompartirCodigo.mockResolvedValue('copiado');
    await renderPantalla();

    await pulsar(screen.getByLabelText('Compartir código del viaje'));

    expect(screen.getByText('Código copiado')).toBeTruthy();
  });

  it('si el usuario cancela el panel de compartir, no hay ningún aviso falso', async () => {
    mockCompartirCodigo.mockResolvedValue('cancelado');
    await renderPantalla();

    await pulsar(screen.getByLabelText('Compartir código del viaje'));

    expect(screen.queryByText('Código copiado')).toBeNull();
  });
});

describe('clasificación por categoría, con subclasificación por evento', () => {
  function viajeConDosUsuarios(usuarios: Record<string, unknown>) {
    return [{ ...viajeBase, categorias: ['Gotitas', 'Bebidas'], usuarios }];
  }

  it('separa la clasificación por categoría Y por cada evento dentro de ella', async () => {
    mockCargarMisViajes.mockResolvedValue(
      viajeConDosUsuarios({
        [USUARIO]: {
          nombre: 'Dudu',
          eventos: { cacas: 3, pises: 1, cervezas: 5, vinos: 0, vermouths: 0, copazos: 0 },
        },
        OTRO: {
          nombre: 'Rodri',
          eventos: { cacas: 0, pises: 0, cervezas: 9, vinos: 0, vermouths: 1, copazos: 0 },
        },
      })
    );
    await renderPantalla();

    // Un encabezado por categoría...
    expect(screen.getByText('Clasificación · Gotitas')).toBeTruthy();
    expect(screen.getByText('Clasificación · Bebidas')).toBeTruthy();
    // ...y una subclasificación por cada evento de esa categoría, no un total
    // que mezcle cacas con pises o cerveza con vermú. Cada nombre de evento
    // aparece dos veces: la tarjeta de contador de arriba y el título de su
    // subclasificación.
    for (const nombreEvento of ['Cacas', 'Pises', 'Cerveza', 'Copa de vino', 'Vermouth', 'Copazo']) {
      expect(screen.getAllByText(nombreEvento).length).toBe(2);
    }

    // Dudu manda en Cacas (3 contra 0), pero Rodri manda en Cerveza (9 contra
    // 5 de Dudu): sólo se comprueba que "9" existe (aparece una sola vez, a
    // diferencia de "3" que también es el contador de arriba), justo lo que
    // una clasificación por categoría (que sumaría cerveza+vino+vermú+copazo)
    // no distinguiría evento a evento.
    expect(screen.getByText('9')).toBeTruthy();
  });

  it('enseña la foto de quien la tiene y la inicial de quien no', async () => {
    mockCargarMisViajes.mockResolvedValue(
      viajeConDosUsuarios({
        [USUARIO]: {
          nombre: 'Dudu',
          avatarUrl: 'https://ejemplo.test/dudu.jpg',
          eventos: { cacas: 1, pises: 0 },
        },
        OTRO: { nombre: 'Rodri', eventos: { cacas: 0, pises: 0 } },
      })
    );
    await renderPantalla();

    // Rodri no tiene avatarUrl: cae a la inicial.
    expect(screen.getAllByText('R').length).toBeGreaterThan(0);
    // Dudu sí: se usa un <Image>, no la inicial "D" dentro de una fila de
    // clasificación (la "D" del avatar grande de arriba del todo no existe
    // en esta pantalla, sólo en Perfil).
    expect(screen.queryByText('D')).toBeNull();
  });
});
