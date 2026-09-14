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
import { IconoDe, ICONOS } from '@/lib/iconos';
import { radio, tema } from '@/lib/tema';

type Modo = 'entrar' | 'registrar';

export default function Login() {
  const { entrar, registrar, recuperarContrasena } = useAuth();
  const insets = useSafeAreaInsets();

  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Aparte de `error` (el del formulario de entrar/crear cuenta): "olvidé mi
  // contraseña" es una acción distinta con su propio resultado, y mezclarlos
  // haría que enviar el enlace borrase un error de login a medio escribir, o
  // al revés.
  const [avisoRecuperacion, setAvisoRecuperacion] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);
  const [recuperando, setRecuperando] = useState(false);

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError(null);
  }

  async function enviar() {
    if (!email.trim() || !password) {
      setError('Escribe tu email y tu contraseña.');
      return;
    }
    if (modo === 'registrar') {
      if (!nombre.trim()) {
        setError('Pon el nombre con el que quieres aparecer en la clasificación.');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña necesita al menos 6 caracteres.');
        return;
      }
    }

    setEnviando(true);
    setError(null);
    try {
      if (modo === 'registrar') {
        await registrar(email.trim(), password, nombre.trim());
      } else {
        await entrar(email.trim(), password);
      }
      router.replace('/viaje');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido continuar. Revisa los datos.');
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Si el email del formulario ya tiene algo, lo usa (pedido explícito: es
   * el mismo campo). Si está vacío, no llama a nada — pide que se escriba
   * primero, ahí mismo, en vez de abrir un cuadro de diálogo aparte.
   *
   * El aviso de éxito es siempre el mismo texto exista o no esa cuenta:
   * Supabase no distingue el caso en el resultado (no lanza un error
   * distinto si el correo no está registrado), así que no hay nada que
   * filtrar aquí tampoco.
   */
  async function alOlvidarContrasena() {
    const correo = email.trim();
    if (!correo) {
      setAvisoRecuperacion({ tipo: 'error', texto: 'Escribe tu email arriba primero.' });
      return;
    }

    setRecuperando(true);
    setAvisoRecuperacion(null);
    try {
      await recuperarContrasena(correo);
      setAvisoRecuperacion({
        tipo: 'ok',
        texto: 'Si ese correo está registrado, te hemos enviado un enlace para recuperar tu contraseña.',
      });
    } catch (e) {
      setAvisoRecuperacion({
        tipo: 'error',
        texto: e instanceof Error ? e.message : 'No hemos podido enviar el enlace. Inténtalo de nuevo.',
      });
    } finally {
      setRecuperando(false);
    }
  }

  const esRegistro = modo === 'registrar';

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.logo}>
          <IconoDe spec={ICONOS.gota} size={80} color={tema.acento} />
        </View>
        <Text style={estilos.titulo}>GOTITA</Text>
        <Text style={estilos.subtitulo}>Lo que pasa en el viaje, se cuenta.</Text>

        <View style={estilos.pestanas}>
          <Pressable
            style={[estilos.pestana, !esRegistro && estilos.pestanaActiva]}
            onPress={() => cambiarModo('entrar')}>
            <IconoDe
              spec={ICONOS.entrar}
              size={15}
              color={!esRegistro ? tema.texto : tema.textoTenue}
            />
            <Text style={[estilos.pestanaTexto, !esRegistro && estilos.pestanaTextoActivo]}>
              Entrar
            </Text>
          </Pressable>
          <Pressable
            style={[estilos.pestana, esRegistro && estilos.pestanaActiva]}
            onPress={() => cambiarModo('registrar')}>
            <IconoDe
              spec={ICONOS.crearCuenta}
              size={15}
              color={esRegistro ? tema.texto : tema.textoTenue}
            />
            <Text style={[estilos.pestanaTexto, esRegistro && estilos.pestanaTextoActivo]}>
              Crear cuenta
            </Text>
          </Pressable>
        </View>

        <View style={estilos.formulario}>
          {esRegistro ? (
            <>
              <Text style={estilos.etiqueta}>Tu nombre</Text>
              <TextInput
                style={estilos.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Eduardo"
                placeholderTextColor={tema.textoTenue}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Text style={estilos.ayuda}>
                Así es como te verán los demás en la clasificación del viaje.
              </Text>
            </>
          ) : null}

          <Text style={estilos.etiqueta}>Email</Text>
          <TextInput
            style={estilos.input}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            placeholderTextColor={tema.textoTenue}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
          />

          <Text style={estilos.etiqueta}>Contraseña</Text>
          <TextInput
            style={estilos.input}
            value={password}
            onChangeText={setPassword}
            placeholder={esRegistro ? 'Mínimo 6 caracteres' : '••••••••'}
            placeholderTextColor={tema.textoTenue}
            secureTextEntry
            autoCapitalize="none"
            textContentType={esRegistro ? 'newPassword' : 'password'}
            onSubmitEditing={enviar}
            returnKeyType="go"
          />

          {error ? <Text style={estilos.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [estilos.boton, pressed && estilos.botonPulsado]}
            onPress={enviar}
            disabled={enviando}>
            {enviando ? (
              <ActivityIndicator color="#04121C" />
            ) : (
              <Text style={estilos.botonTexto}>
                {esRegistro ? 'Crear mi cuenta' : 'Entrar'}
              </Text>
            )}
          </Pressable>

          {!esRegistro ? (
            <Pressable
              style={estilos.enlaceOlvidada}
              onPress={alOlvidarContrasena}
              disabled={recuperando}
              accessibilityRole="button"
              accessibilityLabel="¿Olvidaste tu contraseña?">
              <Text style={estilos.enlaceOlvidadaTexto}>
                {recuperando ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
              </Text>
            </Pressable>
          ) : null}

          {avisoRecuperacion ? (
            <Text
              style={[
                estilos.avisoRecuperacion,
                avisoRecuperacion.tipo === 'ok' ? estilos.avisoRecuperacionOk : estilos.error,
              ]}>
              {avisoRecuperacion.texto}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { paddingHorizontal: 24, paddingBottom: 40 },
  logo: {
    // Círculo proporcional al doble del icono (antes 76 para un icono de
    // 40): mismo margen relativo alrededor de la gota, no un icono de 80
    // recortado dentro de un círculo pensado para uno de 40.
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  titulo: { fontSize: 18, fontWeight: '800', color: tema.texto, textAlign: 'center', marginTop: 6 },
  subtitulo: {
    fontSize: 15,
    color: tema.textoTenue,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },

  pestanas: {
    flexDirection: 'row',
    backgroundColor: tema.fondoElevado,
    borderRadius: radio.md,
    padding: 4,
    gap: 4,
  },
  pestana: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radio.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pestanaActiva: { backgroundColor: tema.tarjeta },
  pestanaTexto: { color: tema.textoTenue, fontWeight: '700', fontSize: 14 },
  pestanaTextoActivo: { color: tema.texto },

  formulario: { gap: 8 },
  etiqueta: {
    color: tema.textoTenue,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginLeft: 4,
  },
  ayuda: { color: tema.textoTenue, fontSize: 12, marginTop: 6, marginLeft: 4, lineHeight: 17 },
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
    marginTop: 14,
    marginLeft: 4,
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

  // Sutil a propósito: es un enlace secundario, no otro botón compitiendo
  // con "Entrar" por la atención.
  enlaceOlvidada: { alignItems: 'center', marginTop: 16, padding: 4 },
  enlaceOlvidadaTexto: { color: tema.textoTenue, fontSize: 13, fontWeight: '600' },
  avisoRecuperacion: { fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  avisoRecuperacionOk: { color: tema.exito, fontWeight: '600' },
});
