import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DialogoConfirmar } from '@/componentes/DialogoConfirmar';
import { CATEGORIAS } from '@/lib/categorias';
import { useAuth } from '@/lib/auth';
import { sePuedeRestar, textosDeConfirmacion } from '@/lib/confirmacion';
import { radio, tema } from '@/lib/tema';
import { cargarMisViajes, modificarEvento, totalDeUsuario, type Viaje } from '@/lib/viajes';

export default function PantallaViaje() {
  const { session, userId, nombreUsuario, salir, cargando: cargandoSesion } = useAuth();
  const insets = useSafeAreaInsets();

  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajeActivoId, setViajeActivoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Evento pendiente de confirmar al restar. null = no hay diálogo abierto.
  const [porRestar, setPorRestar] = useState<{ clave: string; cuenta: number } | null>(null);

  // Las escrituras van en fila india: si pulsas 💩 cinco veces seguidas, cada
  // guardado espera al anterior en vez de leer todos la misma cuenta vieja.
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const viaje = viajes.find((v) => v.id === viajeActivoId) ?? null;

  const recargar = useCallback(async () => {
    if (!userId) return;
    try {
      const mios = await cargarMisViajes(userId);
      setViajes(mios);
      setViajeActivoId((actual) =>
        actual && mios.some((v) => v.id === actual) ? actual : (mios[0]?.id ?? null)
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No hemos podido cargar tus viajes.');
    }
  }, [userId]);

  useEffect(() => {
    if (cargandoSesion) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    recargar().finally(() => setCargando(false));
  }, [cargandoSesion, session, recargar]);

  function alPulsar(claveEvento: string, delta: number) {
    if (!viaje) return;
    const viajeId = viaje.id;

    // Pintamos el número nuevo ya, sin esperar a la red. Esto es lo que hace
    // que se sienta como una app y no como un formulario.
    setViajes((previos) =>
      previos.map((v) => {
        if (v.id !== viajeId) return v;
        const usuario = v.usuarios[userId];
        if (!usuario) return v;
        const valor = Math.max(0, (usuario.eventos?.[claveEvento] ?? 0) + delta);
        return {
          ...v,
          usuarios: {
            ...v.usuarios,
            [userId]: { ...usuario, eventos: { ...usuario.eventos, [claveEvento]: valor } },
          },
        };
      })
    );

    const guardar = async () => {
      try {
        const actualizado = await modificarEvento(viajeId, userId, claveEvento, delta);
        setViajes((previos) => previos.map((v) => (v.id === viajeId ? actualizado : v)));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
        await recargar(); // Deshace lo pintado volviendo a lo que dice el servidor.
      }
    };
    cola.current = cola.current.then(guardar, guardar);
  }

  /** El − no resta: abre el diálogo. Restar de verdad es `alConfirmarResta`. */
  function alPedirResta(claveEvento: string, cuentaActual: number) {
    if (!sePuedeRestar(cuentaActual)) return;
    setPorRestar({ clave: claveEvento, cuenta: cuentaActual });
  }

  function alConfirmarResta() {
    if (!porRestar) return;
    alPulsar(porRestar.clave, -1);
    setPorRestar(null);
  }

  async function alRefrescar() {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  }

  if (cargando || cargandoSesion) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={tema.acento} />
      </View>
    );
  }

  const misEventos = viaje?.usuarios?.[userId]?.eventos ?? {};
  const clasificacion = viaje
    ? Object.entries(viaje.usuarios ?? {})
        .map(([clave, usuario]) => ({ clave, nombre: usuario.nombre, total: totalDeUsuario(usuario) }))
        .sort((a, b) => b.total - a.total)
    : [];

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={[
        estilos.contenido,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={tema.acento} />
      }>
      <View style={estilos.cabecera}>
        <View style={estilos.cabeceraTextos}>
          <Text style={estilos.saludo}>💧 Hola, {nombreUsuario.split(' ')[0] || 'tú'}</Text>
          {viaje ? <Text style={estilos.nombreViaje}>{viaje.nombre}</Text> : null}
        </View>
        <Pressable onPress={() => salir().then(() => router.replace('/login'))} hitSlop={10}>
          <Text style={estilos.salir}>Salir</Text>
        </Pressable>
      </View>

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      {viajes.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.selector}>
          {viajes.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setViajeActivoId(v.id)}
              style={[estilos.chip, v.id === viajeActivoId && estilos.chipActivo]}>
              <Text style={[estilos.chipTexto, v.id === viajeActivoId && estilos.chipTextoActivo]}>
                {v.nombre}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {!viaje ? (
        <View style={estilos.vacio}>
          <Text style={estilos.vacioEmoji}>🧳</Text>
          <Text style={estilos.vacioTitulo}>No estás en ningún viaje activo</Text>
          <Text style={estilos.vacioTexto}>
            Crea uno nuevo, o pide el código a quien lo haya creado y únete.
          </Text>
          <Pressable style={estilos.botonPrincipal} onPress={() => router.push('/crear')}>
            <Text style={estilos.botonPrincipalTexto}>Crear un viaje</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/unirme')} hitSlop={10}>
            <Text style={estilos.enlaceVacio}>Unirme con un código</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {(viaje.categorias ?? []).map((nombreCategoria) => {
            const categoria = CATEGORIAS[nombreCategoria];
            if (!categoria) return null;
            return (
              <View key={nombreCategoria} style={estilos.seccion}>
                <Text style={estilos.tituloSeccion}>
                  {categoria.emoji} {nombreCategoria}
                </Text>
                {Object.entries(categoria.eventos).map(([clave, evento]) => {
                  const cuenta = misEventos[clave] ?? 0;
                  return (
                    <View key={clave} style={estilos.tarjeta}>
                      <Text style={estilos.tarjetaEmoji}>{evento.emoji}</Text>
                      <View style={estilos.tarjetaTextos}>
                        <Text style={estilos.tarjetaNombre}>{evento.nombre}</Text>
                        <Text style={estilos.tarjetaCuenta}>{cuenta}</Text>
                      </View>
                      <Pressable
                        onPress={() => alPedirResta(clave, cuenta)}
                        disabled={cuenta === 0}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar uno de ${evento.nombre}`}
                        style={({ pressed }) => [
                          estilos.botonMenos,
                          cuenta === 0 && estilos.botonDeshabilitado,
                          pressed && estilos.pulsado,
                        ]}
                        hitSlop={6}>
                        <Text style={estilos.botonMenosTexto}>−</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => alPulsar(clave, 1)}
                        accessibilityRole="button"
                        accessibilityLabel={`Sumar uno a ${evento.nombre}`}
                        style={({ pressed }) => [estilos.botonMas, pressed && estilos.pulsado]}>
                        <Text style={estilos.botonMasTexto}>+</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={estilos.seccion}>
            <Text style={estilos.tituloSeccion}>🏆 Clasificación</Text>
            {clasificacion.map((fila, indice) => (
              <View key={fila.clave} style={estilos.filaRanking}>
                <Text style={estilos.puesto}>{indice + 1}</Text>
                <Text
                  style={[
                    estilos.nombreRanking,
                    fila.clave === userId && estilos.nombreRankingYo,
                  ]}
                  numberOfLines={1}>
                  {fila.nombre}
                </Text>
                <Text style={estilos.totalRanking}>{fila.total}</Text>
              </View>
            ))}
          </View>

          <View style={estilos.pie}>
            <Text style={estilos.codigo}>Código del viaje: {viaje.codigo}</Text>
            <View style={estilos.pieEnlaces}>
              <Pressable onPress={() => router.push('/crear')} hitSlop={10}>
                <Text style={estilos.enlace}>Crear otro</Text>
              </Pressable>
              <Text style={estilos.separador}>·</Text>
              <Pressable onPress={() => router.push('/unirme')} hitSlop={10}>
                <Text style={estilos.enlace}>Unirme a otro</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      <DialogoConfirmar
        visible={porRestar !== null}
        textos={porRestar ? textosDeConfirmacion(porRestar.clave, porRestar.cuenta) : null}
        alConfirmar={alConfirmarResta}
        alCancelar={() => setPorRestar(null)}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { paddingHorizontal: 18 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fondo },

  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cabeceraTextos: { flex: 1 },
  saludo: { color: tema.textoTenue, fontSize: 15, fontWeight: '600' },
  nombreViaje: { color: tema.texto, fontSize: 28, fontWeight: '800', marginTop: 2 },
  salir: { color: tema.textoTenue, fontSize: 15, fontWeight: '600', paddingTop: 2 },

  error: {
    color: tema.peligro,
    backgroundColor: 'rgba(242,85,90,0.12)',
    borderRadius: radio.sm,
    padding: 12,
    marginTop: 16,
    fontSize: 14,
  },

  selector: { gap: 8, paddingVertical: 16 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  chipActivo: { backgroundColor: tema.acento, borderColor: tema.acento },
  chipTexto: { color: tema.textoTenue, fontWeight: '700', fontSize: 14 },
  chipTextoActivo: { color: '#04121C' },

  seccion: { marginTop: 28 },
  tituloSeccion: {
    color: tema.texto,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 12,
    marginLeft: 2,
  },

  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tarjetaEmoji: { fontSize: 30 },
  tarjetaTextos: { flex: 1 },
  tarjetaNombre: { color: tema.textoTenue, fontSize: 14, fontWeight: '600' },
  tarjetaCuenta: { color: tema.texto, fontSize: 30, fontWeight: '800', lineHeight: 36 },

  botonMenos: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.fondoElevado,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  botonMenosTexto: { color: tema.textoTenue, fontSize: 26, fontWeight: '700', lineHeight: 30 },
  botonDeshabilitado: { opacity: 0.35 },
  botonMas: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.acento,
  },
  botonMasTexto: { color: '#04121C', fontSize: 32, fontWeight: '800', lineHeight: 36 },
  pulsado: { opacity: 0.7, transform: [{ scale: 0.94 }] },

  filaRanking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: tema.fondoElevado,
    borderRadius: radio.md,
    marginBottom: 8,
  },
  puesto: { color: tema.textoTenue, fontSize: 15, fontWeight: '800', width: 18 },
  nombreRanking: { color: tema.texto, fontSize: 16, flex: 1 },
  nombreRankingYo: { fontWeight: '800', color: tema.acento },
  totalRanking: { color: tema.texto, fontSize: 18, fontWeight: '800' },

  vacio: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 12 },
  vacioEmoji: { fontSize: 60 },
  vacioTitulo: {
    color: tema.texto,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },
  vacioTexto: {
    color: tema.textoTenue,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  botonPrincipal: {
    backgroundColor: tema.acento,
    borderRadius: radio.md,
    paddingVertical: 16,
    paddingHorizontal: 28,
    marginTop: 28,
  },
  botonPrincipalTexto: { color: '#04121C', fontSize: 16, fontWeight: '800' },
  enlaceVacio: { color: tema.acento, fontSize: 15, fontWeight: '700', marginTop: 22 },

  pie: { marginTop: 36, alignItems: 'center', gap: 12 },
  pieEnlaces: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codigo: { color: tema.textoTenue, fontSize: 14, letterSpacing: 0.5 },
  enlace: { color: tema.acento, fontSize: 15, fontWeight: '700' },
  separador: { color: tema.textoTenue, fontSize: 15 },
});
