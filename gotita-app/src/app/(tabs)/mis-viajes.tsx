import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconoDe, ICONOS } from '@/lib/iconos';
import { radio, tema } from '@/lib/tema';
import { useViajes } from '@/lib/viajesContext';

/**
 * Lista de todos los viajes del usuario, en marcha y finalizados (estos con
 * su insignia). Tocar uno lo marca como elegido (compartido con la pestaña "Mi Viaje" vía `useViajes`) y salta ahí,
 * porque ver los contadores es lo que se quiere hacer justo después de elegir
 * viaje.
 */
export default function PantallaMisViajes() {
  const { viajes, viajeActivoId, setViajeActivoId, cargando, error, recargar } = useViajes();
  const insets = useSafeAreaInsets();
  const [refrescando, setRefrescando] = useState(false);

  async function alRefrescar() {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  }

  function elegir(id: number) {
    setViajeActivoId(id);
    router.push('/viaje');
  }

  if (cargando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={tema.acento} />
      </View>
    );
  }

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
      <View style={estilos.tituloFila}>
        <IconoDe spec={ICONOS.maleta} size={24} color={tema.texto} />
        <Text style={estilos.titulo}>Mis viajes</Text>
      </View>

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      {viajes.length === 0 ? (
        <View style={estilos.vacio}>
          <IconoDe spec={ICONOS.maleta} size={56} color={tema.textoTenue} />
          <Text style={estilos.vacioTitulo}>Todavía no estás en ningún viaje</Text>
          <Text style={estilos.vacioTexto}>
            Crea uno nuevo, o pide el código a quien lo haya creado y únete.
          </Text>
        </View>
      ) : (
        viajes.map((v) => {
          // "Elegido" (esta tarjeta, la que está marcada en el contexto
          // compartido) no es lo mismo que `v.activo` (el viaje en sí no
          // está finalizado): un viaje finalizado puede perfectamente seguir
          // siendo el elegido, si es el que se estaba viendo al cerrarlo.
          const esElElegido = v.id === viajeActivoId;
          return (
            <Pressable
              key={v.id}
              testID={`viaje-${v.id}`}
              onPress={() => elegir(v.id)}
              accessibilityRole="button"
              style={[estilos.tarjeta, esElElegido && estilos.tarjetaActiva]}>
              <View style={estilos.tarjetaTextos}>
                <Text style={estilos.nombreViaje}>{v.nombre}</Text>
                <Text style={estilos.codigo}>Código: {v.codigo}</Text>
              </View>
              {esElElegido ? (
                // "Viendo", no "Activo": un viaje finalizado puede ser el
                // elegido igual que uno en marcha, y las dos insignias
                // pueden convivir en la misma tarjeta sin contradecirse.
                <View style={estilos.insignia}>
                  <Text style={estilos.insigniaTexto}>Viendo</Text>
                </View>
              ) : null}
              {!v.activo ? (
                <View style={estilos.insigniaFinalizado}>
                  <Text style={estilos.insigniaFinalizadoTexto}>Finalizado</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })
      )}

      <View style={estilos.acciones}>
        <Pressable style={estilos.botonPrincipal} onPress={() => router.push('/crear')}>
          <IconoDe spec={ICONOS.avion} size={16} color="#04121C" />
          <Text style={estilos.botonPrincipalTexto}>Crear un viaje</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/unirme')} hitSlop={10}>
          <Text style={estilos.enlace}>Unirme con un código</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { paddingHorizontal: 18 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fondo },

  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titulo: { color: tema.texto, fontSize: 28, fontWeight: '800' },

  error: {
    color: tema.peligro,
    backgroundColor: 'rgba(242,85,90,0.12)',
    borderRadius: radio.sm,
    padding: 12,
    marginTop: 16,
    fontSize: 14,
  },

  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.lg,
    padding: 18,
    marginTop: 16,
  },
  tarjetaActiva: { borderColor: tema.acento },
  tarjetaTextos: { flex: 1, gap: 4 },
  nombreViaje: { color: tema.texto, fontSize: 18, fontWeight: '800' },
  codigo: { color: tema.textoTenue, fontSize: 13, letterSpacing: 0.5 },
  insignia: {
    backgroundColor: tema.acento,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  insigniaTexto: { color: '#04121C', fontSize: 12, fontWeight: '800' },
  insigniaFinalizado: {
    backgroundColor: tema.fondoElevado,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  insigniaFinalizadoTexto: { color: tema.textoTenue, fontSize: 12, fontWeight: '700' },

  vacio: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 12 },
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

  acciones: { alignItems: 'center', marginTop: 32, gap: 16 },
  botonPrincipal: {
    flexDirection: 'row',
    backgroundColor: tema.acento,
    borderRadius: radio.md,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonPrincipalTexto: { color: '#04121C', fontSize: 16, fontWeight: '800' },
  enlace: { color: tema.acento, fontSize: 15, fontWeight: '700' },
});
