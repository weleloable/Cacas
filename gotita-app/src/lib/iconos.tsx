// Import directo del submódulo, no del barrel `@expo/vector-icons`: el
// barrel reexporta las ~20 familias de iconos que trae el paquete, y Metro
// mete el TTF de cada una en el bundle aunque sólo se use una. Importando
// `@expo/vector-icons/Feather` y `.../MaterialCommunityIcons` directamente,
// sólo esos dos ficheros de fuente entran en el build (de 4MB en 19 fuentes
// a las 2 que hacen falta).
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Sustituto de los emoji por iconos de línea minimalistas.
 *
 * Los emoji dan la sensación de "hecho por una IA a toda prisa"; un set de
 * iconos consistente da la contraria. Dos fuentes:
 *
 * - La gota es la MISMA silueta del icono de la app (ver
 *   `scripts/generar-iconos.py`), como contorno vectorial: en cualquier
 *   sitio donde antes había 💧, ahora es literalmente el mismo dibujo, no
 *   una imitación con otra librería.
 * - Todo lo demás sale de `@expo/vector-icons` (Feather / MaterialCommunity),
 *   que ya viene con Expo — no hace falta dibujar a mano un set entero de
 *   iconos para "cerveza" o "maleta" cuando ya existe uno bueno y mantenido.
 */

/**
 * Una referencia a un icono, no el icono en sí: así se puede guardar como
 * dato plano (en `categorias.ts`, en el resultado de `textosDeConfirmacion`)
 * y decidir cómo se dibuja sólo al llegar a pantalla, con `<IconoDe>`.
 */
export type IconoSpec =
  | { fuente: 'gota' }
  | { fuente: 'feather'; nombre: ComponentProps<typeof Feather>['name'] }
  | { fuente: 'mci'; nombre: ComponentProps<typeof MaterialCommunityIcons>['name'] };

/**
 * Contorno exacto de la gota, generado a partir de la misma geometría que
 * `scripts/generar-iconos.py` (envolvente de un círculo y un ápice), en un
 * viewBox de 24x24. No es una aproximación a mano: son los mismos puntos.
 */
const PATH_GOTA =
  'M 12.00 4.07 L 16.17 9.80 L 16.17 9.80 L 16.37 10.10 L 16.55 10.40 L 16.70 10.72 ' +
  'L 16.84 11.05 L 16.95 11.38 L 17.04 11.73 L 17.10 12.08 L 17.14 12.43 L 17.16 12.78 ' +
  'L 17.15 13.14 L 17.11 13.49 L 17.06 13.84 L 16.98 14.18 L 16.87 14.52 L 16.74 14.85 ' +
  'L 16.59 15.17 L 16.42 15.48 L 16.23 15.78 L 16.02 16.07 L 15.79 16.33 L 15.54 16.59 ' +
  'L 15.27 16.82 L 14.99 17.04 L 14.69 17.23 L 14.39 17.41 L 14.07 17.56 L 13.74 17.69 ' +
  'L 13.40 17.80 L 13.06 17.88 L 12.71 17.94 L 12.35 17.98 L 12.00 17.99 L 11.65 17.98 ' +
  'L 11.29 17.94 L 10.94 17.88 L 10.60 17.80 L 10.26 17.69 L 9.93 17.56 L 9.61 17.41 ' +
  'L 9.31 17.23 L 9.01 17.04 L 8.73 16.82 L 8.46 16.59 L 8.21 16.33 L 7.98 16.07 ' +
  'L 7.77 15.78 L 7.58 15.48 L 7.41 15.17 L 7.26 14.85 L 7.13 14.52 L 7.02 14.18 ' +
  'L 6.94 13.84 L 6.89 13.49 L 6.85 13.14 L 6.84 12.78 L 6.86 12.43 L 6.90 12.08 ' +
  'L 6.96 11.73 L 7.05 11.38 L 7.16 11.05 L 7.30 10.72 L 7.45 10.40 L 7.63 10.10 ' +
  'L 7.83 9.80 L 7.83 9.80 Z';

// ColorValue, no sólo string: expo-router pasa el color de la pestaña activa
// como ColorValue (puede ser un OpaqueColorValue en iOS con colores
// dinámicos del sistema), y react-native-svg/vector-icons lo aceptan igual.
type PropsTamano = { size?: number; color?: ColorValue };

export function IconoGota({ size = 20, color = '#000' }: PropsTamano) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={PATH_GOTA}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Dibuja lo que diga `spec`, sea de la fuente que sea. Un único punto de
 * entrada para no repetir el switch en cada pantalla. */
export function IconoDe({
  spec,
  size = 20,
  color = '#000',
  testID,
}: { spec: IconoSpec; testID?: string } & PropsTamano) {
  switch (spec.fuente) {
    case 'gota':
      return <IconoGota size={size} color={color} />;
    case 'feather':
      return <Feather name={spec.nombre} size={size} color={color} testID={testID} />;
    case 'mci':
      return (
        <MaterialCommunityIcons name={spec.nombre} size={size} color={color} testID={testID} />
      );
  }
}

// Referencias sueltas para los sitios que no cuelgan de categorias.ts (títulos
// de pantalla, pestañas, botones). Un nombre por concepto, no por emoji: si
// mañana cambia el icono de "maleta" sólo se toca aquí.
export const ICONOS = {
  gota: { fuente: 'gota' } as IconoSpec,
  trofeo: { fuente: 'mci', nombre: 'trophy-outline' } as IconoSpec,
  maleta: { fuente: 'mci', nombre: 'bag-suitcase-outline' } as IconoSpec,
  avion: { fuente: 'feather', nombre: 'send' } as IconoSpec,
  persona: { fuente: 'feather', nombre: 'user' } as IconoSpec,
  exito: { fuente: 'feather', nombre: 'check-circle' } as IconoSpec,
  instalar: { fuente: 'feather', nombre: 'download' } as IconoSpec,
  entrar: { fuente: 'feather', nombre: 'log-in' } as IconoSpec,
  crearCuenta: { fuente: 'feather', nombre: 'user-plus' } as IconoSpec,
  papelera: { fuente: 'feather', nombre: 'trash-2' } as IconoSpec,
  compartir: { fuente: 'feather', nombre: 'share-2' } as IconoSpec,
  camara: { fuente: 'feather', nombre: 'camera' } as IconoSpec,
  imagen: { fuente: 'feather', nombre: 'image' } as IconoSpec,
  chevronAbajo: { fuente: 'feather', nombre: 'chevron-down' } as IconoSpec,
  chevronDerecha: { fuente: 'feather', nombre: 'chevron-right' } as IconoSpec,
} satisfies Record<string, IconoSpec>;
