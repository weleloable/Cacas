import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/lib/auth';
import { tema } from '@/lib/tema';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
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
          <Stack.Screen name="viaje" options={{ headerShown: false }} />
          <Stack.Screen name="unirme" options={{ title: 'Unirse a un viaje' }} />
          <Stack.Screen name="crear" options={{ title: 'Nuevo viaje' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
