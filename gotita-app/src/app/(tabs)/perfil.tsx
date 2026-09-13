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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { radio, tema } from '@/lib/tema';
import { actualizarNombreEnMisViajes } from '@/lib/viajes';
import { useViajes } from '@/lib/viajesContext';

export default function Perfil() {
  const { session, userId, nombreUsuario, actualizarNombre, salir } = useAuth();
  const { recargar } = useViajes();
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState(nombreUsuario);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cambiado = nombre.trim().length > 0 && nombre.trim() !== nombreUsuario;
  const inicial = (nombreUsuario.trim()[0] || '?').toUpperCase();

  async function guardar() {
    const limpio = nombre.trim();
    if (!limpio) {
      setMensaje({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      // Primero la cuenta (afecta al saludo y a los viajes a los que te unas
      // de aquí en adelante), luego los viajes en los que ya estás: son una
      // copia aparte del nombre, no se actualizan solas.
      await actualizarNombre(limpio);
      await actualizarNombreEnMisViajes(userId, limpio);
      await recargar();
      setMensaje({ tipo: 'ok', texto: 'Nombre actualizado.' });
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: e instanceof Error ? e.message : 'No se ha podido guardar el nombre.',
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>👤 Perfil</Text>

        <View style={estilos.avatar}>
          <Text style={estilos.avatarTexto}>{inicial}</Text>
        </View>

        <Text style={estilos.etiqueta}>Nombre</Text>
        <TextInput
          style={estilos.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre"
          placeholderTextColor={tema.textoTenue}
          autoCapitalize="words"
        />

        <Text style={[estilos.etiqueta, estilos.etiquetaSeparada]}>Email</Text>
        <View style={estilos.inputSoloLectura}>
          <Text style={estilos.textoSoloLectura}>{session?.user?.email ?? '—'}</Text>
        </View>

        {mensaje ? (
          <Text style={[estilos.mensaje, mensaje.tipo === 'ok' ? estilos.ok : estilos.error]}>
            {mensaje.texto}
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            estilos.boton,
            (!cambiado || guardando) && estilos.botonDeshabilitado,
            pressed && cambiado && estilos.pulsado,
          ]}
          onPress={guardar}
          disabled={!cambiado || guardando}>
          {guardando ? (
            <ActivityIndicator color="#04121C" />
          ) : (
            <Text style={estilos.botonTexto}>Guardar cambios</Text>
          )}
        </Pressable>

        <Pressable
          style={estilos.botonSalir}
          onPress={() => salir().then(() => router.replace('/login'))}>
          <Text style={estilos.botonSalirTexto}>Salir</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { paddingHorizontal: 24, paddingBottom: 48 },

  titulo: { color: tema.texto, fontSize: 28, fontWeight: '800' },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  avatarTexto: { color: tema.acento, fontSize: 34, fontWeight: '800' },

  etiqueta: { color: tema.textoTenue, fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4, marginTop: 24 },
  etiquetaSeparada: { marginTop: 20 },
  input: {
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: tema.texto,
  },
  inputSoloLectura: {
    backgroundColor: tema.fondoElevado,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textoSoloLectura: { color: tema.textoTenue, fontSize: 16 },

  mensaje: { fontSize: 14, marginTop: 16, marginLeft: 4, lineHeight: 20 },
  ok: { color: tema.exito, fontWeight: '700' },
  error: { color: tema.peligro },

  boton: {
    backgroundColor: tema.acento,
    borderRadius: radio.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 28,
  },
  botonDeshabilitado: { opacity: 0.4 },
  pulsado: { opacity: 0.75 },
  botonTexto: { color: '#04121C', fontSize: 17, fontWeight: '800' },

  botonSalir: {
    borderRadius: radio.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: tema.peligro,
  },
  botonSalirTexto: { color: tema.peligro, fontSize: 16, fontWeight: '800' },
});
