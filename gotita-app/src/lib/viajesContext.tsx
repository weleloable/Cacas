import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { useAuth } from './auth';
import { cargarMisViajes, type Viaje } from './viajes';

type ViajesContextoValor = {
  viajes: Viaje[];
  setViajes: Dispatch<SetStateAction<Viaje[]>>;
  viajeActivoId: number | null;
  setViajeActivoId: (id: number | null) => void;
  /** El viaje activo, ya resuelto contra `viajes`. Conveniencia. */
  viaje: Viaje | null;
  /** Sólo la primera carga. Pull-to-refresh usa su propio estado local. */
  cargando: boolean;
  error: string | null;
  setError: (mensaje: string | null) => void;
  /**
   * Trae los viajes del servidor. `tocarError` es false cuando se llama para
   * deshacer un pintado optimista tras un fallo de escritura: ese fallo ya
   * dejó su propio mensaje, y esta recarga suele tener éxito (el problema
   * estaba en la escritura, no en la lectura). Si tocara `error` aquí, su
   * propio éxito borraría el aviso justo después de haberlo puesto.
   */
  recargar: (tocarError?: boolean) => Promise<void>;
};

const Contexto = createContext<ViajesContextoValor | null>(null);

/**
 * Qué viajes tiene el usuario y cuál es el activo, compartido entre las
 * pestañas "Mi Viaje" y "Mis viajes": cambiar el activo en una pestaña tiene
 * que reflejarse en la otra sin depender de que ambas monten y recarguen por
 * su cuenta.
 *
 * Vive en el _layout.tsx RAÍZ, montado ya desde /login e /index: `recargar`
 * no hace nada sin `userId`, así que existir antes de tener sesión es
 * gratis. Eso sí importa aquí: al no vivir dentro de (tabs) (donde cerrar
 * sesión desmontaría el proveedor entero y limpiaría su estado gratis), un
 * logout no lo desmonta — sigue siendo la misma instancia, con el `viajes`
 * del usuario anterior todavía en memoria, hasta que este efecto lo nota y
 * lo vacía explícitamente. Sin ese vaciado, en un móvil compartido entre
 * varias personas del viaje, quien entrase después vería un parpadeo con
 * los viajes de quien usó la app justo antes.
 */
export function ViajesProvider({ children }: { children: ReactNode }) {
  const { userId, session } = useAuth();
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajeActivoId, setViajeActivoIdInterno] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cuenta la petición de carga más reciente. Sin esto, una `recargar()`
  // lanzada por el usuario A que sigue en vuelo cuando A cierra sesión (o B
  // entra detrás en el mismo móvil) puede resolver DESPUÉS del vaciado de
  // logout y repoblar `viajes` con los datos de A: justo lo que el vaciado
  // de abajo dice estar evitando. Cada llamada se apunta un número; al
  // resolver, sólo aplica su resultado si sigue siendo la más reciente que
  // se ha pedido, sea por lo que sea (logout, otro recargar, un cambio de
  // usuario).
  const idPeticion = useRef(0);

  const recargar = useCallback(
    async (tocarError = true) => {
      if (!userId) return;
      const miId = ++idPeticion.current;
      try {
        const mios = await cargarMisViajes(userId);
        if (idPeticion.current !== miId) return; // superada mientras estaba en vuelo
        setViajes(mios);
        setViajeActivoIdInterno((actual) =>
          actual && mios.some((v) => v.id === actual) ? actual : (mios[0]?.id ?? null)
        );
        if (tocarError) setError(null);
      } catch (e) {
        if (idPeticion.current !== miId) return;
        if (tocarError) {
          setError(e instanceof Error ? e.message : 'No hemos podido cargar tus viajes.');
        }
      }
    },
    [userId]
  );

  // `session` como dependencia, no sólo al montar: Supabase dispara
  // TOKEN_REFRESHED al volver a la pestaña, lo que cambia la identidad del
  // objeto `session` (ver auth.tsx). Es la señal que ya usaba viaje.tsx para
  // ponerse al día con lo que hayan cambiado otros dispositivos; perderla
  // aquí dejaría la app sólo actualizándose al hacer pull-to-refresh o tras
  // escribir. `cargando` sólo se ve reflejado en la primera vuelta: ya vale
  // false para cuando llega un refresco de fondo, así que no vuelve a
  // enseñar el spinner de carga completo.
  useEffect(() => {
    if (!userId) {
      // Sesión cerrada (o todavía no iniciada). No basta con no pedir nada:
      // hay que soltar lo que hubiera de una sesión anterior, o se queda
      // colgado en memoria para quien entre después en el mismo dispositivo.
      // El incremento invalida cualquier `recargar()` que siguiera en vuelo
      // desde antes del logout: aunque resuelva después, su guard de arriba
      // verá que ya no es la petición más reciente y no pisará este vaciado.
      idPeticion.current++;
      setViajes([]);
      setViajeActivoIdInterno(null);
      setError(null);
      setCargando(false);
      return;
    }
    recargar().finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const viaje = viajes.find((v) => v.id === viajeActivoId) ?? null;

  return (
    <Contexto.Provider
      value={{
        viajes,
        setViajes,
        viajeActivoId,
        setViajeActivoId: setViajeActivoIdInterno,
        viaje,
        cargando,
        error,
        setError,
        recargar,
      }}>
      {children}
    </Contexto.Provider>
  );
}

export function useViajes(): ViajesContextoValor {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useViajes tiene que usarse dentro de <ViajesProvider>');
  return contexto;
}
