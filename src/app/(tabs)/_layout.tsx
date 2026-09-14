import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { IconoDe, ICONOS } from '@/lib/iconos';
import { tema } from '@/lib/tema';

/**
 * Las cuatro pestañas de la app, sólo para quien ha iniciado sesión.
 *
 * La comprobación de sesión vive aquí, una sola vez, en vez de repetida en
 * cada pantalla: antes cada pantalla (viaje.tsx) hacía su propio
 * `router.replace('/login')` dentro de un efecto. Centralizarlo evita que
 * cuatro pantallas tengan cuatro copias de la misma lógica y cuatro
 * oportunidades de que se desincronicen.
 */
export default function LayoutPestanas() {
  const { session, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={tema.acento} />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;

  // El estado de los viajes (ViajesProvider) vive en el _layout.tsx raíz, no
  // aquí: "unirme" es una ruta hermana de este grupo de pestañas, no una
  // descendiente, y también necesita alcanzarlo.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tema.acento,
        tabBarInactiveTintColor: tema.textoTenue,
        tabBarStyle: {
          backgroundColor: tema.fondoElevado,
          borderTopColor: tema.borde,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="viaje"
        options={{
          title: 'Mi Viaje',
          tabBarIcon: ({ color, size }) => <IconoDe spec={ICONOS.gota} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mis-viajes"
        options={{
          title: 'Mis viajes',
          tabBarIcon: ({ color, size }) => <IconoDe spec={ICONOS.maleta} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crear"
        options={{
          title: 'Crear viaje',
          tabBarIcon: ({ color, size }) => <IconoDe spec={ICONOS.avion} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <IconoDe spec={ICONOS.persona} size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fondo },
});
