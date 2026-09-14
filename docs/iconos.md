# Icono de la app

Gota dibujada por vector en `scripts/generar-iconos.py` (no un emoji, no una
imagen de origen): silueta hueca, trazo negro de grosor medio, fondo y
relleno transparentes. Cada tamaño se genera de cero con su propio grosor
proporcional — redimensionar un único master deja un trazo fino borroso o
dentado. Dos excepciones, ambas por limitación de la plataforma, no por
gusto:

- `apple-touch-icon` va sobre fondo blanco porque iOS no respeta el canal
  alfa (pinta el hueco de negro; negro sobre negro sería invisible).
- `android-icon-foreground.png` lleva trazo BLANCO, no negro: es la capa
  "foreground" del icono adaptativo de Android, que se compone sobre
  `android.adaptiveIcon.backgroundColor` de `app.json` (`#0B1020`, el mismo
  azul-negro de la app) — no sobre transparente de verdad. Negro sobre ese
  fondo da un contraste de ~1.1:1, invisible en el launcher.

Para regenerarlo tras tocar la geometría: `npm run iconos`.

# Iconos en vez de emoji

Toda la interfaz usaba emoji (💧💩🍺🏆🧳✈️👤🎉📲🔑📝🗑️). Sustituidos por
iconos de línea minimalistas: dan sensación de app cuidada, no de "hecho
deprisa con IA".

- `src/lib/iconos.tsx` es el único sitio que sabe dibujar un icono. Un
  `IconoSpec` (`{ fuente: 'gota' }` | `{ fuente: 'feather', nombre }` |
  `{ fuente: 'mci', nombre }`) es una REFERENCIA a un icono, no el icono en
  sí: así se puede guardar como dato plano en `categorias.ts` o en el
  resultado de `textosDeConfirmacion`, y decidir cómo se pinta sólo al
  llegar a `<IconoDe spec={...} />`.
- La gota (`ICONOS.gota`) es la MISMA silueta que el icono de la app —
  mismo path SVG, generado con la misma geometría de
  `scripts/generar-iconos.py` (envolvente circulo+ápice), no una imitación
  con otra librería. Verificado en `tests/iconos.test.ts` que categoría
  Gotitas y evento `pises` usan ese mismo spec, no uno parecido.
- Todo lo demás sale de `@expo/vector-icons` (Feather / MaterialCommunity),
  que ya viene con Expo. **Importar desde el submódulo, no del barrel**:
  `import Feather from '@expo/vector-icons/Feather'`, no
  `import { Feather } from '@expo/vector-icons'`. El barrel reexporta las
  ~20 familias de iconos del paquete, y Metro mete el `.ttf` de cada una en
  el bundle web aunque sólo se use una — de 4MB en 19 fuentes a 1.4MB en
  las 2 que hacen falta, comprobado inspeccionando `dist/` tras el build.
- Un nombre de icono mal escrito (`'toilett'` en vez de `'toilet'`) no lo
  pilla TypeScript de forma fiable y da un icono en blanco en producción sin
  ningún aviso. `tests/iconos.test.ts` abre el glyphmap real instalado y
  comprueba que cada nombre usado en la app existe de verdad.
