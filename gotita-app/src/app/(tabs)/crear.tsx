import * as Clipboard from 'expo-clipboard';
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

import { useAuth } from '@/lib/auth';
import { CATEGORIAS } from '@/lib/categorias';
import { radio, tema } from '@/lib/tema';
import { crearViaje, type Viaje } from '@/lib/viajes';
import { useViajes } from '@/lib/viajesContext';

export default function Crear() {
  const { userId, nombreUsuario } = useAuth();
  const { setViajes, setViajeActivoId } = useViajes();

  const [nombre, setNombre] = useState('');
  const [seleccionadas, setSeleccionadas] = useState<string[]>(Object.keys(CATEGORIAS));
  const [creado, setCreado] = useState<Viaje | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function alternar(categoria: string) {
    setSeleccionadas((previas) =>
      previas.includes(categoria)
        ? previas.filter((c) => c !== categoria)
        : [...previas, categoria]
    );
  }

  async function crear() {
    if (!nombre.trim()) {
      setError('Ponle un nombre al destino.');
      return;
    }
    if (!seleccionadas.length) {
      setError('Elige al menos una categoría para contar.');
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const viaje = await crearViaje(nombre.trim(), seleccionadas, userId, nombreUsuario);
      setCreado(viaje);
      // Se añade directo al contexto compartido y se marca activo, sin
      // esperar a un recargar(): así "Mi Viaje" ya lo tiene en cuanto se
      // navegue ahí, sin depender de que la escritura ya se vea en una
      // lectura posterior.
      setViajes((previos) => [viaje, ...previos]);
      setViajeActivoId(viaje.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido crear el viaje.');
    } finally {
      setEnviando(false);
    }
  }

  async function copiarCodigo() {
    if (!creado) return;
    await Clipboard.setStringAsync(creado.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // Una vez creado, la pantalla se convierte en "comparte este código".
  if (creado) {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.exitoEmoji}>🎉</Text>
        <Text style={estilos.exitoTitulo}>{creado.nombre}</Text>
        <Text style={estilos.exitoTexto}>
          Pásales este código a tus amigos para que se unan:
        </Text>

        <Pressable onPress={copiarCodigo} style={estilos.codigoCaja}>
          <Text style={estilos.codigoTexto}>{creado.codigo}</Text>
          <Text style={estilos.codigoPista}>{copiado ? '¡Copiado!' : 'Tocar para copiar'}</Text>
        </Pressable>

        <Pressable style={estilos.boton} onPress={() => router.replace('/viaje')}>
          <Text style={estilos.botonTexto}>Empezar a contar</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={estilos.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.etiqueta}>Nombre del destino</Text>
        <TextInput
          style={estilos.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Oktoberfest 2026"
          placeholderTextColor={tema.textoTenue}
          autoCapitalize="sentences"
        />

        <Text style={[estilos.etiqueta, estilos.etiquetaSeparada]}>¿Qué queréis contar?</Text>
        {Object.entries(CATEGORIAS).map(([nombreCategoria, categoria]) => {
          const activa = seleccionadas.includes(nombreCategoria);
          const eventos = Object.values(categoria.eventos)
            .map((e) => e.nombre)
            .join(' · ');
          return (
            <Pressable
              key={nombreCategoria}
              onPress={() => alternar(nombreCategoria)}
              style={[estilos.opcion, activa && estilos.opcionActiva]}>
              <Text style={estilos.opcionEmoji}>{categoria.emoji}</Text>
              <View style={estilos.opcionTextos}>
                <Text style={estilos.opcionNombre}>{nombreCategoria}</Text>
                <Text style={estilos.opcionDetalle}>{eventos}</Text>
              </View>
              <View style={[estilos.marca, activa && estilos.marcaActiva]}>
                {activa ? <Text style={estilos.marcaTexto}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}

        {error ? <Text style={estilos.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}
          onPress={crear}
          disabled={enviando}>
          {enviando ? (
            <ActivityIndicator color="#04121C" />
          ) : (
            <Text style={estilos.botonTexto}>Crear viaje</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { padding: 24, paddingBottom: 48 },

  etiqueta: { color: tema.textoTenue, fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  etiquetaSeparada: { marginTop: 28 },
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

  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.lg,
    padding: 16,
    marginBottom: 10,
  },
  opcionActiva: { borderColor: tema.acento },
  opcionEmoji: { fontSize: 28 },
  opcionTextos: { flex: 1 },
  opcionNombre: { color: tema.texto, fontSize: 17, fontWeight: '700' },
  opcionDetalle: { color: tema.textoTenue, fontSize: 13, marginTop: 3 },
  marca: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: tema.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaActiva: { backgroundColor: tema.acento, borderColor: tema.acento },
  marcaTexto: { color: '#04121C', fontSize: 15, fontWeight: '900' },

  error: { color: tema.peligro, fontSize: 14, marginTop: 16, marginLeft: 4, lineHeight: 20 },
  boton: {
    backgroundColor: tema.acento,
    borderRadius: radio.md,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 28,
  },
  pulsado: { opacity: 0.75 },
  botonTexto: { color: '#04121C', fontSize: 17, fontWeight: '800' },

  exitoEmoji: { fontSize: 60, textAlign: 'center', marginTop: 24 },
  exitoTitulo: {
    color: tema.texto,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },
  exitoTexto: {
    color: tema.textoTenue,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  codigoCaja: {
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.acento,
    borderRadius: radio.lg,
    paddingVertical: 26,
    alignItems: 'center',
    marginTop: 28,
  },
  codigoTexto: { color: tema.texto, fontSize: 40, fontWeight: '900', letterSpacing: 6 },
  codigoPista: { color: tema.textoTenue, fontSize: 13, marginTop: 10 },
});
