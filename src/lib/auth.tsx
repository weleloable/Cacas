import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { urlRestablecerContrasena } from './recuperacion';
import { supabase } from './supabase';

/**
 * Nombre para MOSTRAR. Nunca para identificar.
 *
 * La versión Streamlit usaba esto como clave dentro del JSON `usuarios`, y era
 * una trampa: en cuanto alguien cambia de nombre —o entra con Google, que trae
 * el suyo propio— la clave cambia y sus contadores quedan huérfanos. Aquí la
 * identidad es `user.id` (un UUID que no cambia jamás) y el nombre es sólo
 * texto que se pinta en pantalla y se puede editar sin consecuencias.
 */
export function nombreDeUsuario(user: User | null | undefined): string {
  if (!user) return '';
  const fullName = user.user_metadata?.full_name;
  return typeof fullName === 'string' && fullName.length > 0 ? fullName : (user.email ?? '');
}

type AuthContexto = {
  session: Session | null;
  /** Identidad estable: la clave real dentro del JSON `usuarios`. */
  userId: string;
  /** Sólo para pintar en pantalla. */
  nombreUsuario: string;
  /** URL pública de la foto de perfil (bucket `avatars`), o null si no hay. */
  avatarUrl: string | null;
  cargando: boolean;
  entrar: (email: string, password: string) => Promise<void>;
  registrar: (email: string, password: string, nombre: string) => Promise<void>;
  /** Sólo cambia el nombre en la cuenta (`user_metadata.full_name`). No toca
   * los viajes ya existentes: eso lo hace `actualizarNombreEnMisViajes` de
   * `lib/viajes`, aparte, porque el nombre de cada viaje es una copia propia. */
  actualizarNombre: (nombre: string) => Promise<void>;
  /** Guarda la URL de la foto ya subida (`lib/avatar.subirAvatar`) en
   * `user_metadata.avatar_url`. No sube el fichero: eso es aparte, porque
   * subir a Storage no tiene nada que ver con la sesión de auth. */
  actualizarAvatar: (url: string) => Promise<void>;
  /** Envía el enlace de recuperación a ese correo. Supabase no confirma ni
   * niega si existe una cuenta con él (no lanza un error distinto en ese
   * caso): a propósito, para no filtrar qué correos están registrados. */
  recuperarContrasena: (email: string) => Promise<void>;
  /** Abre la sesión de recuperación a partir de los tokens que trae el hash
   * del enlace del email (ver `lib/recuperacion`). Hace falta llamarla a
   * mano: `detectSessionInUrl` está a `false` en `supabase.ts`, así que la
   * librería no la abre sola al cargar la pantalla. */
  iniciarSesionRecuperacion: (accessToken: string, refreshToken: string) => Promise<void>;
  /** Cambia la contraseña de la sesión activa (la de recuperación, o
   * cualquier otra). Exige sesión: sin ella Supabase la rechaza. */
  actualizarContrasena: (password: string) => Promise<void>;
  salir: () => Promise<void>;
};

const Contexto = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Sesión guardada de la última vez (si la hay).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });

    // Y cualquier cambio posterior: login, logout, refresco de token.
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const valor = useMemo<AuthContexto>(
    () => ({
      session,
      userId: session?.user?.id ?? '',
      nombreUsuario: nombreDeUsuario(session?.user),
      avatarUrl:
        typeof session?.user?.user_metadata?.avatar_url === 'string'
          ? session.user.user_metadata.avatar_url
          : null,
      cargando,
      entrar: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      registrar: async (email, password, nombre) => {
        // `full_name` es la clave con la que se guardan los contadores dentro
        // del JSON `usuarios`, así que se fija aquí, al crear la cuenta.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: nombre } },
        });
        if (error) throw error;

        // El proyecto tiene mailer_autoconfirm activado, así que signUp ya deja
        // la sesión abierta. Si algún día se activa la confirmación por email,
        // este signIn fallará y habrá que avisar de que revisen el correo.
        const { error: errorEntrada } = await supabase.auth.signInWithPassword({ email, password });
        if (errorEntrada) {
          throw new Error(
            'Cuenta creada, pero hace falta confirmarla. Revisa tu email y luego entra.'
          );
        }
      },
      actualizarNombre: async (nombre) => {
        const { error } = await supabase.auth.updateUser({ data: { full_name: nombre } });
        if (error) throw error;
      },
      actualizarAvatar: async (url) => {
        const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
        if (error) throw error;
      },
      recuperarContrasena: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: urlRestablecerContrasena(),
        });
        if (error) throw error;
      },
      iniciarSesionRecuperacion: async (accessToken, refreshToken) => {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
      },
      actualizarContrasena: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      salir: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, cargando]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): AuthContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  return contexto;
}
