import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

import { useAuth } from '@/lib/auth';
import { IconoDe, ICONOS } from '@/lib/iconos';
import { parsearHashRecuperacion } from '@/lib/recuperacion';
import { radio, tema } from '@/lib/tema';

type Estado = 'cargando' | 'listo' | 'invalido';

/**
 * A donde llega quien pulsa el enlace del email de "¿Olvidaste tu
 * contraseña?" (login.tsx). Fuera de las pestañas, como `unirme.tsx`: es una
 * acción puntual, no un sitio en el que uno "vive", y hace falta que sea
 * alcanzable SIN sesión previa (el usuario llega aquí para conseguir una).
 */
export default function RestablecerContrasena() {
  const { iniciarSesionRecuperacion, actualizarContrasena } = useAuth();

  const [estado, setEstado] = useState<Estado>('cargando');
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null);
  // El efecto de abajo corre una vez, pero StrictMode (dev) lo invoca dos
  // veces al montar; sin este guard, la segunda pasada reenviaría los mismos
  // tokens a setSession con la sesión ya abierta de la primera, y punto es
  // que no hace falta reenviar nada, no que vaya a fallar.
  const yaProcesado = useRef(false);

  useEffect(() => {
    if (yaProcesado.current) return;
    yaProcesado.current = true;

    const hash = typeof window !== 'undefined' && window.location ? window.location.hash : '';
    const parametros = parsearHashRecuperacion(hash);
    if (!parametros) {
      setEstado('invalido');
      setErrorEnlace(
        'Este enlace no es válido o ya se ha usado. Pide uno nuevo desde ' +
          '"¿Olvidaste tu contraseña?" en la pantalla de entrar.'
      );
      return;
    }

    iniciarSesionRecuperacion(parametros.accessToken, parametros.refreshToken)
      .then(() => {
        // Los tokens son de un solo uso, pero no hay motivo para dejarlos
        // visibles en la barra de direcciones ni en el historial una vez
        // leídos.
        if (typeof window !== 'undefined' && window.history && window.location) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setEstado('listo');
      })
      .catch((e) => {
        setEstado('invalido');
        setErrorEnlace(
          e instanceof Error ? e.message : 'Este enlace ha caducado o ya se ha usado.'
        );
      });
  }, [iniciarSesionRecuperacion]);

  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function guardar() {
    if (password.length < 6) {
      setError('La contraseña necesita al menos 6 caracteres.');
      return;
    }
    if (password !== confirmacion) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await actualizarContrasena(password);
      // `actualizarContrasena` exige sesión activa (updateUser la exige, la
      // rechaza si no la hay): que haya tenido éxito ES la prueba de que hay
      // sesión, así que no hace falta releer `session` del contexto aparte
      // (que además podría ir un render por detrás de lo que acaba de pasar).
      setHecho(true);
      setTimeout(() => router.replace('/viaje'), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <View style={estilos.logo}>
          <IconoDe spec={ICONOS.gota} size={40} color={tema.acento} />
        </View>
        <Text style={estilos.titulo}>Nueva contraseña</Text>

        {estado === 'cargando' ? (
          <View style={estilos.centro}>
            <ActivityIndicator size="large" color={tema.acento} />
          </View>
        ) : null}

        {estado === 'invalido' ? <Text style={estilos.error}>{errorEnlace}</Text> : null}

        {estado === 'listo' && hecho ? (
          <View style={estilos.mensajeFila}>
            <IconoDe spec={ICONOS.exito} size={16} color={tema.exito} />
            <Text style={estilos.mensajeOk}>Contraseña actualizada. Entrando…</Text>
          </View>
        ) : null}

        {estado === 'listo' && !hecho ? (
          <View style={estilos.formulario}>
            <Text style={estilos.etiqueta}>Contraseña nueva</Text>
            <TextInput
              style={estilos.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={tema.textoTenue}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
            />

            <Text style={[estilos.etiqueta, estilos.etiquetaSeparada]}>Repítela</Text>
            <TextInput
              style={estilos.input}
              value={confirmacion}
              onChangeText={setConfirmacion}
              placeholder="Repite la contraseña"
              placeholderTextColor={tema.textoTenue}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              onSubmitEditing={guardar}
              returnKeyType="go"
            />

            {error ? <Text style={estilos.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [estilos.boton, pressed && estilos.botonPulsado]}
              onPress={guardar}
              disabled={guardando}
              accessibilityRole="button"
              accessibilityLabel="Guardar contraseña nueva">
              {guardando ? (
                <ActivityIndicator color="#04121C" />
              ) : (
                <Text style={estilos.botonTexto}>Guardar contraseña</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    color: tema.texto,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },

  centro: { alignItems: 'center', marginTop: 24 },

  mensajeFila: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  mensajeOk: { color: tema.exito, fontSize: 15, fontWeight: '700' },

  formulario: { gap: 8 },
  etiqueta: {
    color: tema.textoTenue,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginLeft: 4,
  },
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
  error: {
    color: tema.peligro,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
  },
  boton: {
    backgroundColor: tema.acento,
    borderRadius: radio.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 26,
  },
  botonPulsado: { opacity: 0.75 },
  botonTexto: { color: '#04121C', fontSize: 17, fontWeight: '800' },
});
