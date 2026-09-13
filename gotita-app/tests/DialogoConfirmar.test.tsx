// En @testing-library/react-native 14 `render` es asíncrono y las consultas se
// hacen contra `screen`, no contra lo que devuelve render.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DialogoConfirmar, MS_DE_ARMADO } from '@/componentes/DialogoConfirmar';
import { textosDeConfirmacion } from '@/lib/confirmacion';

const textos = textosDeConfirmacion('cacas', 4);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Deja pasar la ventana en la que el diálogo ignora pulsaciones. */
async function armar() {
  await act(async () => {
    jest.advanceTimersByTime(MS_DE_ARMADO + 50);
  });
}

async function pulsar(elemento: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(elemento);
  });
}

describe('DialogoConfirmar', () => {
  it('no pinta nada si no está visible', async () => {
    await render(
      <DialogoConfirmar
        visible={false}
        textos={textos}
        alConfirmar={jest.fn()}
        alCancelar={jest.fn()}
      />
    );
    expect(screen.queryByText('¿Quitar 1 de cacas?')).toBeNull();
  });

  it('tampoco pinta nada sin textos, aunque le digan que sea visible', async () => {
    await render(
      <DialogoConfirmar visible textos={null} alConfirmar={jest.fn()} alCancelar={jest.fn()} />
    );
    expect(screen.queryByText('Sí, quitar')).toBeNull();
  });

  it('confirmar sólo se dispara al pulsar el botón de confirmar', async () => {
    const alConfirmar = jest.fn();
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={alConfirmar} alCancelar={alCancelar} />
    );
    await armar();

    await pulsar(screen.getByText('Sí, quitar'));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    expect(alCancelar).not.toHaveBeenCalled();
  });

  it('cancelar cierra sin confirmar', async () => {
    const alConfirmar = jest.fn();
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={alConfirmar} alCancelar={alCancelar} />
    );
    await armar();

    await pulsar(screen.getByText('Cancelar'));
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('tocar dentro del cuadro no lo cierra', async () => {
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={jest.fn()} alCancelar={alCancelar} />
    );
    await armar();

    await pulsar(screen.getByText('¿Quitar 1 de cacas?'));
    expect(alCancelar).not.toHaveBeenCalled();
  });

  it('tocar el fondo cancela', async () => {
    const alConfirmar = jest.fn();
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={alConfirmar} alCancelar={alCancelar} />
    );
    await armar();

    await pulsar(screen.getByLabelText('Cerrar sin quitar nada'));
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('cancelar funciona de inmediato, sin esperar a la ventana de armado', async () => {
    // Cancelar pronto nunca destruye nada, así que no lleva la espera de
    // confirmar. Gatearlo también dejaba el botón dimándose al pulsarlo sin
    // hacer nada durante 350ms: una confirmación visual falsa.
    const alConfirmar = jest.fn();
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={alConfirmar} alCancelar={alCancelar} />
    );

    await pulsar(screen.getByText('Cancelar'));
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('tocar el fondo también cancela de inmediato', async () => {
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={jest.fn()} alCancelar={alCancelar} />
    );

    await pulsar(screen.getByLabelText('Cerrar sin quitar nada'));
    expect(alCancelar).toHaveBeenCalledTimes(1);
  });

  describe('ventana de armado', () => {
    // react-native-web monta el modal a pantalla completa y clicable desde el
    // primer frame mientras se funde durante 250ms: animatedOut lleva
    // pointerEvents 'none' y animatedIn no. Sin esta ventana, el segundo toque
    // de un doble toque cae sobre un botón invisible. Sólo protege a
    // confirmar: cancelar pronto es siempre seguro.
    it('ignora la pulsación de confirmar nada más abrirse', async () => {
      const alConfirmar = jest.fn();
      await render(
        <DialogoConfirmar visible textos={textos} alConfirmar={alConfirmar} alCancelar={jest.fn()} />
      );

      await pulsar(screen.getByText('Sí, quitar'));

      expect(alConfirmar).not.toHaveBeenCalled();
    });

    it('sigue ignorando justo antes de que expire', async () => {
      const alConfirmar = jest.fn();
      await render(
        <DialogoConfirmar
          visible
          textos={textos}
          alConfirmar={alConfirmar}
          alCancelar={jest.fn()}
        />
      );
      await act(async () => {
        jest.advanceTimersByTime(MS_DE_ARMADO - 1);
      });

      await pulsar(screen.getByText('Sí, quitar'));
      expect(alConfirmar).not.toHaveBeenCalled();
    });

    it('la ventana cubre el fundido de react-native-web, que dura 250ms', () => {
      expect(MS_DE_ARMADO).toBeGreaterThan(250);
    });

    it('se rearma al volver a abrirse, no sólo la primera vez', async () => {
      const alConfirmar = jest.fn();
      const props = {
        textos,
        alConfirmar,
        alCancelar: jest.fn(),
      };
      await render(<DialogoConfirmar visible {...props} />);
      await armar();

      // Se cierra y se vuelve a abrir: un segundo diálogo tiene que protegerse
      // igual que el primero.
      await act(async () => {
        screen.rerender(<DialogoConfirmar visible={false} {...props} />);
      });
      await act(async () => {
        screen.rerender(<DialogoConfirmar visible {...props} />);
      });

      await pulsar(screen.getByText('Sí, quitar'));
      expect(alConfirmar).not.toHaveBeenCalled();

      await armar();
      await pulsar(screen.getByText('Sí, quitar'));
      expect(alConfirmar).toHaveBeenCalledTimes(1);
    });
  });
});
