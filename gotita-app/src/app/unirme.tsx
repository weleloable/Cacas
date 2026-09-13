import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { useAuth } from '@/lib/auth';
import { radio, tema } from '@/lib/tema';
import { buscarPorCodigo, unirseAViaje } from '@/lib/viajes';
import { useViajes } from '@/lib/viajesContext';

export default function Unirme() {
  const { userId, nombreUsuario } = useAuth();
  const { setViajes, setViajeActivoId } = useViajes();

  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function alUnirse() {
    const limpio = codigo.trim().toUpperCase();
    if (!limpio) {
      setMensaje({ tipo: 'error', texto: 'Escribe un código primero.' });
      return;
    }

    setEnviando(true);
    setMensaje(null);
    try {
      const viaje = await buscarPorCodigo(limpio);
      if (!viaje) {
        setMensaje({
          tipo: 'error',
          texto: 'Código no encontrado o el viaje ya ha terminado. Revisa que esté bien escrito.',
        });
        return;
      }
      const actualizado = await unirseAViaje(viaje, userId, nombreUsuario);
      // "Mi Viaje" lee del contexto compartido, no vuelve a pedir nada al
      // montarse (las pestañas no se desmontan al navegar entre ellas): sin
      // esto, el viaje recién unido no aparecía ahí hasta un pull-to-refresh.
      setViajes((previos) =>
        previos.some((v) => v.id === actualizado.id)
          ? previos.map((v) => (v.id === actualizado.id ? actualizado : v))
          : [actualizado, ...previos]
      );
      setViajeActivoId(actualizado.id);
      setMensaje({ tipo: 'ok', texto: `¡Dentro de ${viaje.nombre}!` });
      setTimeout(() => router.replace('/viaje'), 700);
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: e instanceof Error ? e.message : 'Algo ha fallado al unirte.',
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.texto}>
          Introduce el código que te ha pasado quien creó el viaje.
        </Text>

        <TextInput
          style={estilos.input}
          value={codigo}
          onChangeText={(t) => setCodigo(t.toUpperCase())}
          placeholder="ABC-123"
          placeholderTextColor={tema.textoTenue}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          onSubmitEditing={alUnirse}
          returnKeyType="go"
        />

        {mensaje ? (
          <Text style={[estilos.mensaje, mensaje.tipo === 'ok' ? estilos.ok : estilos.error]}>
            {mensaje.texto}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}
          onPress={alUnirse}
          disabled={enviando}>
          {enviando ? (
            <ActivityIndicator color="#04121C" />
          ) : (
            <Text style={estilos.botonTexto}>Buscar y unirme</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { padding: 24 },
  texto: { color: tema.textoTenue, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  input: {
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.md,
    paddingVertical: 18,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    color: tema.texto,
    textAlign: 'center',
  },
  mensaje: { fontSize: 15, marginTop: 18, textAlign: 'center', lineHeight: 21 },
  ok: { color: tema.exito, fontWeight: '700' },
  error: { color: tema.peligro },
  boton: {
    backgroundColor: tema.acento,
    borderRadius: radio.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 28,
  },
  pulsado: { opacity: 0.75 },
  botonTexto: { color: '#04121C', fontSize: 17, fontWeight: '800' },
});
