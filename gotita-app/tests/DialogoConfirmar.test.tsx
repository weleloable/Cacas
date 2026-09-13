// En @testing-library/react-native 14 `render` es asíncrono y las consultas se
// hacen contra `screen`, no contra lo que devuelve render.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DialogoConfirmar } from '@/componentes/DialogoConfirmar';
import { textosDeConfirmacion } from '@/lib/confirmacion';

const textos = textosDeConfirmacion('cacas', 4);

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

    fireEvent.press(screen.getByText('Sí, quitar'));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    expect(alCancelar).not.toHaveBeenCalled();
  });

  it('cancelar cierra sin confirmar', async () => {
    const alConfirmar = jest.fn();
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={alConfirmar} alCancelar={alCancelar} />
    );

    fireEvent.press(screen.getByText('Cancelar'));
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('tocar dentro del cuadro no lo cierra', async () => {
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={jest.fn()} alCancelar={alCancelar} />
    );

    fireEvent.press(screen.getByText('¿Quitar 1 de cacas?'));
    expect(alCancelar).not.toHaveBeenCalled();
  });

  it('tocar el fondo cancela', async () => {
    const alConfirmar = jest.fn();
    const alCancelar = jest.fn();
    await render(
      <DialogoConfirmar visible textos={textos} alConfirmar={alConfirmar} alCancelar={alCancelar} />
    );

    fireEvent.press(screen.getByLabelText('Cerrar sin quitar nada'));
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();
  });
});
