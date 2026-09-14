import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { tema } from '@/lib/tema';

/** Decide a dónde va la persona al abrir la app: al login o a sus viajes. */
export default function Index() {
  const { session, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={tema.acento} />
      </View>
    );
  }

  return <Redirect href={session ? '/viaje' : '/login'} />;
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.fondo,
  },
});
