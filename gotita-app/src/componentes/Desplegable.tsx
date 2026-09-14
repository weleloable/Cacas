import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { IconoDe, ICONOS, type IconoSpec } from '@/lib/iconos';
import { tema } from '@/lib/tema';

/**
 * Cabecera pulsable que muestra u oculta `children`. Se usa anidado (la
 * Clasificación entera es uno, cada categoría dentro es otro, cada evento
 * dentro de la categoría es otro más): cerrado por defecto en los tres
 * niveles, para que un primer vistazo a "Mi Viaje" no enseñe ya los
 * resultados de nadie.
 *
 * Estado no controlado aquí a propósito: `abierto` y `onToggle` los lleva
 * quien lo usa (viaje.tsx necesita un `Record` con una entrada por categoría
 * y otro por evento, no algo que este componente pueda guardar él solo).
 */
export function Desplegable({
  abierto,
  onToggle,
  titulo,
  etiquetaAccesible,
  icono,
  estiloCabecera,
  estiloTitulo,
  children,
}: {
  abierto: boolean;
  onToggle: () => void;
  titulo: string;
  /** Para accessibilityLabel cuando `titulo` sólo no basta para distinguir
   * este desplegable de otros iguales en otra rama (dos categorías podrían,
   * en teoría, compartir nombre de evento). */
  etiquetaAccesible?: string;
  icono?: IconoSpec;
  estiloCabecera?: StyleProp<ViewStyle>;
  estiloTitulo?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${abierto ? 'Cerrar' : 'Abrir'} ${etiquetaAccesible ?? titulo}`}
        style={estiloCabecera}
        hitSlop={4}>
        {icono ? <IconoDe spec={icono} size={16} color={tema.textoTenue} /> : null}
        <Text style={estiloTitulo}>{titulo}</Text>
        <View style={{ marginLeft: 'auto' }}>
          <IconoDe
            spec={abierto ? ICONOS.chevronAbajo : ICONOS.chevronDerecha}
            size={16}
            color={tema.textoTenue}
          />
        </View>
      </Pressable>
      {abierto ? children : null}
    </View>
  );
}
