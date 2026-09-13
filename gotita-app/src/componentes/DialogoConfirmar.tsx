import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { radio, tema } from '@/lib/tema';
import type { TextosConfirmacion } from '@/lib/confirmacion';

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
 * Cancelar es lo fácil: es el botón grande, es el que responde al botón atrás
 * de Android y al toque fuera. Confirmar hay que buscarlo.
 */
export function DialogoConfirmar({ visible, textos, alConfirmar, alCancelar }: Props) {
  return (
    <Modal
      visible={visible && textos !== null}
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

          <View style={estilos.botones}>
            <Pressable
              onPress={alCancelar}
              accessibilityRole="button"
              style={({ pressed }) => [estilos.boton, estilos.cancelar, pressed && estilos.pulsado]}>
              <Text style={estilos.textoCancelar}>{textos?.etiquetaCancelar}</Text>
            </Pressable>
            <Pressable
              onPress={alConfirmar}
              accessibilityRole="button"
              style={({ pressed }) => [estilos.boton, estilos.confirmar, pressed && estilos.pulsado]}>
              <Text style={estilos.textoConfirmar}>{textos?.etiquetaConfirmar}</Text>
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
  botones: { flexDirection: 'row', gap: 10, marginTop: 24, alignSelf: 'stretch' },
  boton: {
    flex: 1,
    borderRadius: radio.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelar: { backgroundColor: tema.fondoElevado, borderWidth: 1, borderColor: tema.borde },
  confirmar: { backgroundColor: 'rgba(242,85,90,0.14)', borderWidth: 1, borderColor: tema.peligro },
  textoCancelar: { color: tema.texto, fontSize: 16, fontWeight: '800' },
  textoConfirmar: { color: tema.peligro, fontSize: 16, fontWeight: '800' },
  pulsado: { opacity: 0.7 },
});
