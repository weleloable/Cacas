# Gotita

Contador de eventos (cacas, pises, cervezas...) para viajes con amigos. Proyecto
personal de Eduardo, un solo desarrollador, sin equipo ni revisores.

## Dos apps, una en retirada

- `gotita-app/` — **la actual**. Expo SDK 57 + React Native + expo-router,
  TypeScript, salida web como SPA (`web.output: "single"`). Es la que se
  desarrolla.
- `Cacas.py` — versión Streamlit original, **en retirada**. No añadir cosas
  aquí. Sigue funcionando y sirve para comparar. Usa el esquema antiguo de
  datos (ver abajo), así que no crear viajes nuevos con ella.

## Supabase

Proyecto `jvswgdepktzbzhegugta`. URL: `https://jvswgdepktzbzhegugta.supabase.co`

- Usar siempre la clave **publishable** (`sb_publishable_...`). La secret key no
  entra nunca en el cliente, y la que había se rotó.
- Credenciales en `gotita-app/.env` (ignorado por git) como
  `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Auth: sólo email + contraseña. Google está desactivado. `disable_signup` es
  false y `mailer_autoconfirm` true, o sea que registrarse deja sesión abierta
  al instante, sin email de confirmación.
- RLS **activo** en `viajes` con políticas para el rol `authenticated`
  (select / insert / update, sin delete). Están en
  `gotita-app/supabase/politicas-rls.sql`. Sin ellas todo devuelve `[]` o 42501.

### Tabla `viajes`

`id`, `nombre`, `admin`, `fecha_creacion`, `fecha_finalizacion`, `activo`,
`categorias` (array), `usuarios` (jsonb), `codigo` (`ABC-123`), `reporte_llm`.

**La clave de `usuarios` es el `user.id` de Supabase (UUID), nunca el nombre.**
El `nombre` de dentro es sólo para mostrar y se puede cambiar sin perder
contadores. Los viajes 1, 2 y 3 son anteriores a esa decisión y siguen con
clave-nombre (`Dudu`, `Rodri`, `Peobol`, `DuduTest2`); migración pendiente en
`gotita-app/supabase/migracion-nombres-a-uuid.sql`, que necesita los UUID de
quien tenga cuenta.

## Comandos

```bash
cd gotita-app
npx expo start --web --host lan --port 8082   # dev, accesible desde el móvil
npx tsc --noEmit                              # chequeo de tipos
npx expo export --platform web                # build estático a dist/
```

Node y gh se instalaron con winget. En PowerShell hace falta recargar el PATH:
`$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`

## Decisiones tomadas

- Identidad por UUID, no por nombre. Evita perder contadores si alguien cambia
  de nombre o entra con otro proveedor.
- Escrituras de contadores: una fila, no la tabla entera, y en cola para que
  pulsaciones rápidas no se pisen. Pendiente: función RPC con `jsonb_set` para
  que dos personas a la vez no se sobrescriban.
- Los códigos de viaje se comprueban contra la tabla antes de asignarse.
- Interfaz en castellano, incluidos los nombres de variables y funciones.

## Pendiente

- Pantalla de Reportes (gráficos y estadísticas del viaje finalizado)
- Finalizar viaje desde la app
- Narrativa IA con Groq (existe en `Cacas.py`, sin portar)
- Login con Google (requiere configurarlo en Google Cloud Console y Supabase)

## Estilo

Directo, corto, concreto. Nombres de archivo y línea, no descripciones vagas.
Sin em dashes. Si algo está roto, decirlo claramente. Terminar con la siguiente
acción, no con un resumen de lo hecho.
