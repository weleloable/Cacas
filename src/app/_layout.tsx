import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/auth';
import { tema } from '@/lib/tema';
import { ViajesProvider } from '@/lib/viajesContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Aquí arriba, no dentro de (tabs)/_layout.tsx: "unirme" es una ruta
            HERMANA de (tabs) en este mismo Stack, no una descendiente suya.
            Si el contexto sólo envolviera <Tabs>, unirme.tsx no podría
            alcanzarlo (fuera del árbol, aunque ambas rutas convivan en el
            mismo Stack) y no tendría forma de avisar de un viaje nuevo hasta
            que otra pantalla recargase por su cuenta. Vive bien aquí:
            `recargar` no hace nada mientras no hay `userId` (login/index),
            así que montarlo antes de tener sesión es gratis. */}
        <ViajesProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: tema.fondo },
              headerTintColor: tema.texto,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: tema.fondo },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="unirme" options={{ title: 'Unirse a un viaje' }} />
          </Stack>
        </ViajesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
