import Constants from 'expo-constants';
import { Image } from 'expo-image';
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

import { elegirDeGaleria, hacerFoto, subirAvatar } from '@/lib/avatar';
import { useAuth } from '@/lib/auth';
import { IconoDe, ICONOS } from '@/lib/iconos';
import { radio, tema } from '@/lib/tema';
import { actualizarAvatarEnMisViajes, actualizarNombreEnMisViajes } from '@/lib/viajes';
import { useViajes } from '@/lib/viajesContext';

/** La versión declarada en app.json (expo.version), leída vía expo-constants
 * en vez de importar el JSON directamente: es la fuente de verdad en tiempo
 * de ejecución, la misma que usan las stores para identificar el build. */
const VERSION_APP = Constants.expoConfig?.version ?? '—';

export default function Perfil() {
  const { session, userId, nombreUsuario, avatarUrl, actualizarNombre, actualizarAvatar, salir } =
    useAuth();
  const { recargar } = useViajes();
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState(nombreUsuario);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cambiado = nombre.trim().length > 0 && nombre.trim() !== nombreUsuario;
  const inicial = (nombreUsuario.trim()[0] || '?').toUpperCase();

  /**
   * Común a "elegir de galería" y "hacer foto": lo único que cambia entre
   * las dos es de dónde sale el `uri` (`origen`). Subir a Storage y guardar
   * la URL en la cuenta es el mismo paso en los dos casos.
   */
  async function alElegirFoto(origen: () => Promise<string | null>) {
    setMensaje(null);
    const uri = await origen();
    if (!uri) return; // canceló el selector o no dio permiso

    setSubiendoFoto(true);
    let url: string;
    try {
      url = await subirAvatar(userId, uri);
      await actualizarAvatar(url);
    } catch (e) {
      setSubiendoFoto(false);
      setMensaje({
        tipo: 'error',
        texto: e instanceof Error ? e.message : 'No se ha podido subir la foto.',
      });
      return;
    }
    // Igual que con el nombre: la cuenta ya se guardó (pasos separados, no un
    // único try), así que un fallo aquí no es "no se ha podido guardar" —
    // sólo la copia dentro de los viajes ya existentes no llegó.
    try {
      await actualizarAvatarEnMisViajes(userId, url);
      await recargar();
      setMensaje({ tipo: 'ok', texto: 'Foto de perfil actualizada.' });
    } catch (e) {
      setMensaje({
        tipo: 'error',
        texto: `Se guardó la foto, pero no llegó a tus viajes ya existentes (${
          e instanceof Error ? e.message : 'fallo de red'
        }). La clasificación de esos viajes seguirá enseñando la foto anterior.`,
      });
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function guardar() {
    const limpio = nombre.trim();
    if (!limpio) {
      setMensaje({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    // Primero la cuenta (afecta al saludo y a los viajes a los que te unas de
    // aquí en adelante); luego los viajes en los que ya estás, que son una
    // copia aparte del nombre y no se actualizan solas. Van en pasos
    // separados, no en un único try, porque si el segundo paso falla la
    // cuenta ya se guardó: decir "no se ha podido guardar" sería mentira.
    try {
      await actualizarNombre(limpio);
    } catch (e) {
      setGuardando(false);
      setMensaje({
        tipo: 'error',
        texto: e instanceof Error ? e.message : 'No se ha podido guardar el nombre.',
      });
      return;
    }
    try {
      await actualizarNombreEnMisViajes(userId, limpio);
      await recargar();
      setMensaje({ tipo: 'ok', texto: 'Nombre actualizado.' });
    } catch (e) {
      // La cuenta ya se guardó (el saludo ya dice el nombre nuevo, así que el
      // botón se deshabilita solo); lo que falló es sólo la copia dentro de
      // los viajes ya existentes. No se pide "reintentar": con el nombre ya
      // guardado, este mismo botón no tiene nada nuevo que enviar.
      setMensaje({
        tipo: 'error',
        texto: `Se guardó el nombre, pero no llegó a tus viajes ya existentes (${
          e instanceof Error ? e.message : 'fallo de red'
        }). La clasificación de esos viajes seguirá enseñando el nombre anterior.`,
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
        <View style={estilos.tituloFila}>
          <IconoDe spec={ICONOS.persona} size={24} color={tema.texto} />
          <Text style={estilos.titulo}>Perfil</Text>
        </View>

        <View style={estilos.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={estilos.avatarFoto} contentFit="cover" />
          ) : (
            <Text style={estilos.avatarTexto}>{inicial}</Text>
          )}
          {subiendoFoto ? (
            <View style={estilos.avatarCargando}>
              <ActivityIndicator color={tema.acento} />
            </View>
          ) : null}
        </View>

        <View style={estilos.filaFoto}>
          <Pressable
            style={({ pressed }) => [estilos.botonFoto, pressed && estilos.pulsado]}
            onPress={() => alElegirFoto(elegirDeGaleria)}
            disabled={subiendoFoto}
            accessibilityRole="button"
            accessibilityLabel="Elegir foto de perfil de la galería">
            <IconoDe spec={ICONOS.imagen} size={16} color={tema.acento} />
            <Text style={estilos.botonFotoTexto}>Galería</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [estilos.botonFoto, pressed && estilos.pulsado]}
            onPress={() => alElegirFoto(hacerFoto)}
            disabled={subiendoFoto}
            accessibilityRole="button"
            accessibilityLabel="Hacer una foto de perfil con la cámara">
            <IconoDe spec={ICONOS.camara} size={16} color={tema.acento} />
            <Text style={estilos.botonFotoTexto}>Cámara</Text>
          </Pressable>
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

        <Text style={estilos.version}>Gotita v{VERSION_APP}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { paddingHorizontal: 24, paddingBottom: 48 },

  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    overflow: 'hidden',
  },
  avatarTexto: { color: tema.acento, fontSize: 34, fontWeight: '800' },
  avatarFoto: { width: '100%', height: '100%' },
  avatarCargando: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,16,32,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filaFoto: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  botonFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  botonFotoTexto: { color: tema.acento, fontSize: 13, fontWeight: '700' },

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

  version: {
    color: tema.textoTenue,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 0.5,
  },
});
