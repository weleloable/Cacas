// En @testing-library/react-native 14 `render` es asíncrono y las consultas se
// hacen contra `screen`, no contra lo que devuelve render (ver
// DialogoConfirmar.test.tsx, el mismo patrón).
/**
 * Tests del desplegable aislado: estado no controlado (lo lleva quien lo
 * usa), abierto/cerrado enseña u oculta `children`, y el accessibilityLabel
 * cambia entre "Abrir"/"Cerrar" según toque.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { Desplegable } from '@/componentes/Desplegable';

/** Envoltorio con estado real: Desplegable no lleva el suyo propio. */
function ConEstado({ abiertoDeEntrada = false }: { abiertoDeEntrada?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoDeEntrada);
  return (
    <Desplegable abierto={abierto} onToggle={() => setAbierto((v) => !v)} titulo="Bebidas">
      <Text>Contenido de dentro</Text>
    </Desplegable>
  );
}

async function pulsar(elemento: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(elemento);
  });
}

describe('Desplegable', () => {
  it('cerrado de entrada no enseña su contenido', async () => {
    await render(<ConEstado />);
    expect(screen.queryByText('Contenido de dentro')).toBeNull();
    expect(screen.getByLabelText('Abrir Bebidas')).toBeTruthy();
  });

  it('pulsar la cabecera lo abre y enseña el contenido', async () => {
    await render(<ConEstado />);

    await pulsar(screen.getByLabelText('Abrir Bebidas'));

    expect(screen.getByText('Contenido de dentro')).toBeTruthy();
    expect(screen.getByLabelText('Cerrar Bebidas')).toBeTruthy();
  });

  it('pulsar otra vez lo vuelve a cerrar', async () => {
    await render(<ConEstado abiertoDeEntrada />);
    expect(screen.getByText('Contenido de dentro')).toBeTruthy();

    await pulsar(screen.getByLabelText('Cerrar Bebidas'));

    expect(screen.queryByText('Contenido de dentro')).toBeNull();
    expect(screen.getByLabelText('Abrir Bebidas')).toBeTruthy();
  });

  it('accessibilityState.expanded refleja el estado, para lectores de pantalla', async () => {
    await render(<ConEstado />);
    expect(screen.getByLabelText('Abrir Bebidas').props.accessibilityState.expanded).toBe(false);

    await pulsar(screen.getByLabelText('Abrir Bebidas'));

    expect(screen.getByLabelText('Cerrar Bebidas').props.accessibilityState.expanded).toBe(true);
  });

  it('con etiquetaAccesible, el label usa esa etiqueta en vez de titulo', async () => {
    function ConEtiqueta() {
      const [abierto, setAbierto] = useState(false);
      return (
        <Desplegable
          abierto={abierto}
          onToggle={() => setAbierto((v) => !v)}
          titulo="Gotitas"
          etiquetaAccesible="clasificación de Gotitas en Gotitas">
          <Text>x</Text>
        </Desplegable>
      );
    }
    await render(<ConEtiqueta />);

    expect(screen.getByLabelText('Abrir clasificación de Gotitas en Gotitas')).toBeTruthy();
    // El texto visible sigue siendo sólo "titulo", no la etiqueta larga.
    expect(screen.getByText('Gotitas')).toBeTruthy();
  });
});
