import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Cópialas en el archivo .env (mira .env.example) y reinicia el servidor.'
  );
}

/**
 * En el móvil y en el navegador `window` existe; en un render de Node (build
 * estático, prerender) no. Sin esta guarda, AsyncStorage intenta tocar
 * localStorage durante el render de servidor y peta con "window is not
 * defined" antes de que arranque nada.
 */
const enNavegador = typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // AsyncStorage guarda el token de sesión en el teléfono (y en localStorage
    // en web), así que la sesión sobrevive a cerrar y abrir la app. Sustituye
    // al apaño de la cookie "gotita_auth" de la versión Streamlit, y además es
    // un JWT que el servidor verifica de verdad.
    ...(enNavegador ? { storage: AsyncStorage } : {}),
    autoRefreshToken: enNavegador,
    persistSession: enNavegador,
    detectSessionInUrl: false,
  },
});
