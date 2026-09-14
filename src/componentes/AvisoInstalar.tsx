import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconoDe, ICONOS } from '@/lib/iconos';
import { radio, tema } from '@/lib/tema';
import {
  AYUDA_IOS_OTRO_NAVEGADOR,
  AYUDA_IOS_SAFARI,
  EVENTO_INSTALABLE_DISPONIBLE,
  esIOS,
  esSafariIOS,
  estaInstalada,
  queOfrecer,
  type EventoDeInstalacion,
} from '@/lib/instalacion';

/**
 * Ofrece instalar la app, si hay algo que ofrecer.
 *
 * En Android es un botón que abre el diálogo nativo de Chrome. En iOS no
 * existe ese diálogo, así que es una explicación de dónde está la opción.
 * Si ya está instalada, o el navegador no lo soporta, no pinta nada.
 */
export function AvisoInstalar() {
  const [evento, setEvento] = useState<EventoDeInstalacion | null>(null);
  const [instalada, setInstalada] = useState(true); // pesimista hasta comprobar
  const [ios, setIos] = useState(false);
  const [safari, setSafari] = useState(true);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const consulta = window.matchMedia?.('(display-mode: standalone)');
    setInstalada(
      estaInstalada(
        consulta?.matches ?? false,
        (window.navigator as Navigator & { standalone?: boolean }).standalone
      )
    );
    setIos(esIOS(window.navigator.userAgent, window.navigator.maxTouchPoints));
    setSafari(esSafariIOS(window.navigator.userAgent));

    // El script del <head> lo captura antes de que React exista, porque
    // Chrome dispara el evento una sola vez por carga y este componente no
    // vive fuera de la pantalla de viaje: si el usuario arrancó en /login, un
    // listener puesto aquí llegaría tarde.
    if (window.__eventoInstalable) setEvento(window.__eventoInstalable);

    const alQuedarDisponible = () => {
      if (window.__eventoInstalable) setEvento(window.__eventoInstalable);
    };
    const alInstalar = () => {
      setInstalada(true);
      setEvento(null);
    };

    window.addEventListener(EVENTO_INSTALABLE_DISPONIBLE, alQuedarDisponible);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener(EVENTO_INSTALABLE_DISPONIBLE, alQuedarDisponible);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  const ofrecer = descartado ? 'nada' : queOfrecer({ instalada, tieneEvento: evento !== null, ios });
  if (ofrecer === 'nada') return null;

  if (ofrecer === 'boton') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          const e = evento;
          if (!e) return;
          await e.prompt();
          const eleccion = await e.userChoice;
          // Se aceptó o se descartó, pero el evento ya no sirve para un
          // segundo intento en cualquiera de los dos casos. Si lo descartó,
          // window.__eventoInstalable sigue siendo el mismo objeto muerto:
          // se limpia para no ofrecer un botón que no hace nada al pulsarlo.
          window.__eventoInstalable = undefined;
          setEvento(null);
          if (eleccion.outcome === 'dismissed') setDescartado(true);
        }}
        style={({ pressed }) => [estilos.tarjeta, estilos.filaPrincipal, pressed && estilos.pulsado]}>
        <View style={estilos.iconoCirculo}>
          <IconoDe spec={ICONOS.instalar} size={20} color={tema.acento} />
        </View>
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>Instalar Gotita</Text>
          <Text style={estilos.texto}>Se abre como una app, sin barra del navegador.</Text>
        </View>
      </Pressable>
    );
  }

  // iOS. "Añadir a pantalla de inicio" sólo existe en el menú de compartir de
  // Safari: en Chrome/Firefox para iOS (que por dentro son Safari, Apple
  // obliga a WebKit, pero sin ese menú) no hay ninguna vía.
  return (
    <View style={estilos.tarjeta}>
      <Pressable
        accessibilityRole="button"
        onPress={() => (safari ? setAyudaAbierta((a) => !a) : setDescartado(true))}
        style={estilos.filaPrincipal}>
        <View style={estilos.iconoCirculo}>
          <IconoDe spec={ICONOS.instalar} size={20} color={tema.acento} />
        </View>
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>Instalar Gotita</Text>
          <Text style={estilos.texto}>
            {safari
              ? ayudaAbierta
                ? AYUDA_IOS_SAFARI
                : 'Cómo añadirla al inicio'
              : AYUDA_IOS_OTRO_NAVEGADOR}
          </Text>
        </View>
      </Pressable>
      {safari && ayudaAbierta ? (
        <Pressable accessibilityRole="button" onPress={() => setDescartado(true)} hitSlop={8}>
          <Text style={estilos.descartar}>Ya lo sé, no preguntar más</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: tema.fondoElevado,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 24,
    gap: 8,
  },
  filaPrincipal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconoCirculo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.tarjeta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1 },
  titulo: { color: tema.texto, fontSize: 15, fontWeight: '800' },
  texto: { color: tema.textoTenue, fontSize: 13, marginTop: 2, lineHeight: 18 },
  descartar: { color: tema.acento, fontSize: 12, fontWeight: '700', alignSelf: 'flex-end' },
  pulsado: { opacity: 0.7 },
});
