# Recuperar contraseña

Enlace "¿Olvidaste tu contraseña?" en `login.tsx` (sólo al entrar, no al
crear cuenta) y pantalla `restablecer-contrasena.tsx`, fuera de las pestañas
(como `unirme.tsx`: hace falta que sea alcanzable SIN sesión previa).

## Configuración en el panel de Supabase (manual, una vez)

**Imprescindible** — sin esto el enlace del email vuelve al Site URL en vez
de a la pantalla nueva, en silencio:

- Authentication → URL Configuration → **Redirect URLs**: añadir
  `https://weleloable.github.io/Gotita/restablecer-contrasena`. Supabase
  rechaza cualquier `redirectTo` que no esté en esta lista. Para probar en
  local (`npx expo start --web`), añadir también
  `http://localhost:8082/restablecer-contrasena`.
- Authentication → URL Configuration → **Site URL**: `https://weleloable.github.io/Gotita`.
  No bloqueante (se pasa `redirectTo` explícito), pero es el valor por
  defecto de otros flujos de auth.

No hace falta tocar la plantilla de email ("Reset Password"): la que trae
Supabase por defecto ya usa `{{ .ConfirmationURL }}`, que construye sola con
el `redirectTo` y los tokens.

El mailer compartido de Supabase (sin SMTP propio configurado) tiene un
límite bajo de envíos por hora. Si se prueba el flujo varias veces seguidas
y deja de llegar el correo, es eso, no un fallo del código.

## Por qué hay que leer el hash a mano

El cliente de Supabase usa el flujo implícito por defecto (`flowType` no se
fija en `supabase.ts`), así que el enlace del email trae los tokens de
sesión en el **fragmento hash** de la URL, no en la query:
`#access_token=...&refresh_token=...&type=recovery`.

`detectSessionInUrl` está a `false` en `supabase.ts` (ya lo estaba antes de
este flujo, sin comentario del motivo original), así que la librería NO
procesa ese hash sola al cargar la pantalla — `parsearHashRecuperacion`
(`lib/recuperacion.ts`) lo lee a mano y `iniciarSesionRecuperacion`
(`lib/auth.tsx`) llama a `setSession` con lo que saca de ahí. Una vez leído,
el hash se borra de la URL con `history.replaceState`: los tokens son de un
solo uso, pero no hay motivo para dejarlos a la vista en el historial.

## De dónde sale la URL de vuelta (`redirectTo`)

`calcularUrlRestablecer(origin, pathname)` (pura, en `lib/recuperacion.ts`)
quita `/login` del final de la URL ACTUAL y añade `/restablecer-contrasena`,
en vez de construirla a partir de `app.json`. Así sirve igual en local
(`http://192.168.x.x:8082/...`, sin baseUrl) y en producción
(`https://weleloable.github.io/Gotita/...`, con baseUrl `/Gotita`) sin tener
que adivinar en cuál de los dos se está: la URL de la pantalla que llama a
esto ya lleva el prefijo correcto, sea cual sea.

`Linking.createURL` de `expo-linking` (usado como reserva en nativo) NO vale
para esto en web: resuelve la ruta contra la RAÍZ del origen
(`window.location.origin`), no contra el baseUrl — en producción perdería el
`/Gotita` y el enlace apuntaría a una URL que no existe.

## Por qué el aviso no distingue si el correo existe

`resetPasswordForEmail` de Supabase no lanza un error distinto cuando el
correo no está registrado (mismo resultado exista la cuenta o no), así que
`login.tsx` enseña siempre el mismo texto de éxito. No hace falta ninguna
lógica aparte para no filtrar qué correos están registrados: ya viene así.

## Por qué el redirect final no relee `session` del contexto

`guardar()` en `restablecer-contrasena.tsx`, tras `actualizarContrasena`, no
comprueba `session` del contexto de auth antes de redirigir: `updateUser`
EXIGE sesión activa (Supabase la rechaza si no la hay), así que su éxito ya
es la prueba de que hay sesión. Leer `session` aparte sería redundante y
podría ir un render por detrás del `setSession` que acaba de disparar
`iniciarSesionRecuperacion`.
