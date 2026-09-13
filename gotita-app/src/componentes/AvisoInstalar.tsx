import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { radio, tema } from '@/lib/tema';
import {
  AYUDA_IOS,
  esIOS,
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
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

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

    const alPoderInstalar = (e: Event) => {
      e.preventDefault(); // sin esto Chrome enseña su propia infobar y se pierde el evento
      setEvento(e as EventoDeInstalacion);
    };
    const alInstalar = () => {
      setInstalada(true);
      setEvento(null);
    };

    window.addEventListener('beforeinstallprompt', alPoderInstalar);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  const ofrecer = queOfrecer({ instalada, tieneEvento: evento !== null, ios });
  if (ofrecer === 'nada') return null;

  if (ofrecer === 'boton') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          const e = evento;
          if (!e) return;
          setEvento(null); // el evento sólo se puede usar una vez
          await e.prompt();
        }}
        style={({ pressed }) => [estilos.tarjeta, pressed && estilos.pulsado]}>
        <Text style={estilos.emoji}>📲</Text>
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>Instalar Gotita</Text>
          <Text style={estilos.texto}>Se abre como una app, sin barra del navegador.</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => setAyudaAbierta((a) => !a)}
      style={({ pressed }) => [estilos.tarjeta, pressed && estilos.pulsado]}>
      <Text style={estilos.emoji}>📲</Text>
      <View style={estilos.textos}>
        <Text style={estilos.titulo}>Instalar Gotita</Text>
        <Text style={estilos.texto}>{ayudaAbierta ? AYUDA_IOS : 'Cómo añadirla al inicio'}</Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tema.fondoElevado,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 24,
  },
  emoji: { fontSize: 24 },
  textos: { flex: 1 },
  titulo: { color: tema.texto, fontSize: 15, fontWeight: '800' },
  texto: { color: tema.textoTenue, fontSize: 13, marginTop: 2, lineHeight: 18 },
  pulsado: { opacity: 0.7 },
});
