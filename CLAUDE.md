# Gotita

Contador de eventos (cacas, pises, cervezas...) para viajes con amigos. Proyecto
personal de Eduardo, un solo desarrollador, sin equipo ni revisores.

Repo: `weleloable/Gotita` (se llamaba `Cacas`). Web:
https://weleloable.github.io/Gotita/. La versión original era Streamlit
(`Cacas.py`); se retiró y se borró del repo, sustituida del todo por esta app
(Expo SDK 57 + React Native + expo-router, TypeScript, salida web como SPA con
`web.output: "single"`). El evento "Cacas" del contador no tiene nada que ver
con el nombre del repo.

@AGENTS.md

El detalle técnico (PWA, navegación, iconos, confirmación al restar,
finalizar viaje, tests) vive en `docs/`, indexado en `AGENTS.md`: se carga
bajo demanda cuando la tarea lo toca, no de golpe en cada sesión. Este
fichero se queda con lo que no cambia según la tarea: Supabase, las
decisiones de diseño y lo pendiente.

## Supabase

Proyecto `jvswgdepktzbzhegugta`. URL: `https://jvswgdepktzbzhegugta.supabase.co`

- Usar siempre la clave **publishable** (`sb_publishable_...`). La secret key no
  entra nunca en el cliente, y la que había se rotó.
- Credenciales en `.env` (ignorado por git) como `EXPO_PUBLIC_SUPABASE_URL` y
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Auth: sólo email + contraseña. Google está desactivado. `disable_signup` es
  false y `mailer_autoconfirm` true, o sea que registrarse deja sesión abierta
  al instante, sin email de confirmación.
- RLS **activo** en `viajes` con políticas para el rol `authenticated`
  (select / insert / update, sin delete). Están en `supabase/politicas-rls.sql`.
  Sin ellas todo devuelve `[]` o 42501.
- Bucket de Storage `avatars` (público, para la foto de perfil) con sus
  políticas en `supabase/politicas-storage-avatars.sql`. **Hay que ejecutar
  ese SQL a mano en el panel** (crea el bucket si no existe); sin él, subir
  una foto da 42501 igual que `viajes` sin sus políticas.

### Tabla `viajes`

`id`, `nombre`, `admin`, `fecha_creacion`, `fecha_finalizacion`, `activo`,
`categorias` (array), `usuarios` (jsonb), `codigo` (`ABC-123`), `reporte_llm`.

**La clave de `usuarios` es el `user.id` de Supabase (UUID), nunca el nombre.**
El `nombre` de dentro es sólo para mostrar y se puede cambiar sin perder
contadores. Los viajes 1, 2 y 3 son anteriores a esa decisión y siguen con
clave-nombre (`Dudu`, `Rodri`, `Peobol`, `DuduTest2`); migración pendiente en
`supabase/migracion-nombres-a-uuid.sql`, que necesita los UUID de quien tenga
cuenta.

## Decisiones tomadas

- Identidad por UUID, no por nombre. Evita perder contadores si alguien cambia
  de nombre o entra con otro proveedor.
- Escrituras de contadores: una fila, no la tabla entera, y en cola para que
  pulsaciones rápidas no se pisen. Pendiente: función RPC con `jsonb_set` para
  que dos personas a la vez no se sobrescriban.
- Los códigos de viaje se comprueban contra la tabla antes de asignarse.
- Interfaz en castellano, incluidos los nombres de variables y funciones.
- La clasificación es una subclasificación por CADA EVENTO (Cacas, Gotitas,
  Cerveza, Copa de vino, Vermouth, Copazo), agrupadas bajo su categoría
  (Gotitas, Bebidas), no un total por categoría (mezclaría cacas con pises) ni
  un total único (mezclaría cacas con cervezas). Desplegable en sus tres
  niveles (sección entera / categoría / evento), cerrado por defecto en los
  tres: pedido explícito para que un primer vistazo a "Mi Viaje" no enseñe ya
  resultados de nadie. `src/componentes/Desplegable.tsx` es la cabecera
  pulsable reusada en los tres niveles (estado no controlado, lo lleva
  `viaje.tsx` en tres `Record<string, boolean>`).
- El evento `pises` se ENSEÑA como "Gotitas" (mismo nombre que su categoría,
  pedido explícito, no un descuido) pero su CLAVE interna sigue siendo
  `pises` — ya está guardada así en el JSON `usuarios` de Supabase, renombrar
  la clave exigiría migrar datos.
- Foto de perfil: `expo-image-picker` (galería o cámara) sube a Storage
  (`src/lib/avatar.ts`) y la URL pública se guarda en
  `user_metadata.avatar_url` (`actualizarAvatar` en `lib/auth.tsx`), igual de
  copia-no-referencia que ya hace `full_name`. Esa copia (`avatarUrl` dentro
  de `usuarios[userId]` en cada viaje) es la que pinta la foto al lado del
  nombre en la clasificación, y sólo se escribe cuando alguien SUBE una foto
  — quien ya tenía cuenta y foto de antes de que esa propagación existiera se
  quedaría con viajes sin la copia para siempre. `ViajesProvider.recargar()`
  (`src/lib/viajesContext.tsx`) se autocorrige: si la cuenta ya tiene foto y
  algún viaje activo no la refleja, la propaga sola, sin que el usuario tenga
  que volver a subir la misma foto sólo para "tocar" el guardado.

## Pendiente

- Pantalla de Reportes (gráficos y estadísticas del viaje finalizado)
- Narrativa IA generada dentro de la app (existía con Groq en la versión
  Streamlit retirada). De momento el admin de un viaje finalizado copia un
  prompt con los datos reales (`src/lib/reporte.ts`) y lo pega en la IA que
  quiera: la app es una SPA estática sin backend y no puede llevar una clave
  de API.
- Login con Google (requiere configurarlo en Google Cloud Console y Supabase)

## Estilo

Directo, corto, concreto. Nombres de archivo y línea, no descripciones vagas.
Sin em dashes. Si algo está roto, decirlo claramente. Terminar con la siguiente
acción, no con un resumen de lo hecho.
