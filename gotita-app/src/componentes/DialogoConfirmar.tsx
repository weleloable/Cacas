import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radio, tema } from '@/lib/tema';
import type { TextosConfirmacion } from '@/lib/confirmacion';

/**
 * Milisegundos que el diálogo ignora cualquier pulsación al abrirse.
 *
 * react-native-web monta el modal a pantalla completa y clicable desde el
 * primer frame: `animatedOut` lleva `pointerEvents: 'none'` pero `animatedIn`
 * no (ModalAnimation.js), y el fundido dura 250ms. Sin esta ventana, el
 * segundo toque de un doble toque sobre el botón − cae encima de "Sí, quitar"
 * cuando todavía es invisible, y se resta sin que el usuario llegue a ver el
 * diálogo. Peor que no tener confirmación.
 *
 * 350 > 250 del fundido, con margen para un frame perdido.
 */
export const MS_DE_ARMADO = 350;

type Props = {
  visible: boolean;
  textos: TextosConfirmacion | null;
  alConfirmar: () => void;
  alCancelar: () => void;
};

/**
 * Diálogo de confirmación propio.
 *
 * No se usa `Alert` de react-native porque en web no está implementado: en
 * react-native-web `Alert.alert` no hace nada, y la web es la forma en que se
 * usa esta app desde el móvil.
 *
 * Cancelar es lo fácil: es el botón ancho, está donde cae el pulgar, funciona
 * desde el primer instante y también cancela tocando fuera o con Escape.
 * Cancelar pronto nunca es un problema (no destruye nada), así que no lleva
 * la espera de armado.
 *
 * Confirmar es estrecho, está en el lado contrario al del botón − para que un
 * toque de más no lo encuentre, y no acepta pulsaciones hasta pasados
 * `MS_DE_ARMADO` **desde que se suelta el dedo, no desde que se apoya**: es
 * `onPress`, que en react-native-web dispara al soltar.
 *
 * Ojo: `onRequestClose` sólo se dispara con Escape en react-native-web. El
 * botón atrás de Android NO cancela en el build web, que es el único que se
 * distribuye; hace history back.
 */
export function DialogoConfirmar({ visible, textos, alConfirmar, alCancelar }: Props) {
  const abierto = visible && textos !== null;
  const [armado, setArmado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!abierto) {
      setArmado(false);
      return;
    }
    setArmado(false);
    temporizador.current = setTimeout(() => setArmado(true), MS_DE_ARMADO);
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [abierto]);

  const confirmar = () => armado && alConfirmar();

  return (
    <Modal
      visible={abierto}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={alCancelar}>
      <Pressable
        style={estilos.fondo}
        onPress={alCancelar}
        accessibilityLabel="Cerrar sin quitar nada">
        {/* Un Pressable sin onPress se come el toque, para que tocar dentro
            del cuadro no cuente como tocar fuera y lo cierre. */}
        <Pressable style={estilos.cuadro} onPress={() => {}}>
          <Text style={estilos.emoji}>{textos?.emoji}</Text>
          <Text style={estilos.titulo} accessibilityRole="header">
            {textos?.titulo}
          </Text>
          <Text style={estilos.mensaje}>{textos?.mensaje}</Text>

          {/* Confirmar a la izquierda a propósito: el botón − vive en la
              columna derecha de las tarjetas, y esto evita que quede debajo. */}
          <View style={estilos.botones}>
            <Pressable
              onPress={confirmar}
              disabled={!armado}
              accessibilityRole="button"
              accessibilityState={{ disabled: !armado }}
              accessibilityLabel={textos?.etiquetaConfirmar}
              style={({ pressed }) => [
                estilos.boton,
                estilos.confirmar,
                !armado && estilos.desarmado,
                pressed && armado && estilos.pulsado,
              ]}>
              <Text style={estilos.textoConfirmar}>{textos?.etiquetaConfirmar}</Text>
            </Pressable>
            <Pressable
              onPress={alCancelar}
              accessibilityRole="button"
              accessibilityLabel={textos?.etiquetaCancelar}
              style={({ pressed }) => [
                estilos.boton,
                estilos.cancelar,
                pressed && estilos.pulsado,
              ]}>
              <Text style={estilos.textoCancelar}>{textos?.etiquetaCancelar}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(4,7,16,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cuadro: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.lg,
    padding: 24,
    alignItems: 'center',
  },
  emoji: { fontSize: 44 },
  titulo: {
    color: tema.texto,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },
  mensaje: {
    color: tema.textoTenue,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  botones: { flexDirection: 'row', gap: 12, marginTop: 24, alignSelf: 'stretch' },
  boton: {
    borderRadius: radio.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cancelar ocupa casi el doble que confirmar. La asimetría es el mensaje.
  cancelar: { flex: 1.8, backgroundColor: tema.acento },
  confirmar: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: tema.peligro },
  desarmado: { opacity: 0.4 },
  textoCancelar: { color: '#04121C', fontSize: 16, fontWeight: '800' },
  textoConfirmar: { color: tema.peligro, fontSize: 15, fontWeight: '700' },
  pulsado: { opacity: 0.7 },
});
