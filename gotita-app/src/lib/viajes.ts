import { CATEGORIAS } from './categorias';
import { supabase } from './supabase';

export type UsuarioViaje = {
  /** Nombre para mostrar. Editable sin perder nada, porque la clave es el UUID. */
  nombre: string;
  /** URL pública del avatar (bucket `avatars`), o null/ausente si no tiene.
   * Copia guardada aquí por el mismo motivo que `nombre`: la clasificación
   * necesita la foto de TODOS los participantes, y sólo la cuenta de cada
   * uno conoce la suya propia (`user_metadata.avatar_url`, no legible entre
   * usuarios sin una tabla de perfiles públicos que no existe todavía). */
  avatarUrl?: string | null;
  eventos: Record<string, number>;
};

export type Viaje = {
  id: number;
  nombre: string;
  /** UUID de quien lo creó. Sólo el admin puede finalizar el viaje. */
  admin: string;
  fecha_creacion: string;
  /** false = finalizado: nadie puede sumar ni restar, la clasificación se
   * queda fija. Quien ya estaba dentro lo sigue viendo (ver
   * `cargarMisViajes`, que ya no filtra por esto). */
  activo: boolean;
  /** Sólo tiene valor cuando `activo` es false. */
  fecha_finalizacion: string | null;
  categorias: string[];
  /** Clave = user.id de Supabase. Nunca el nombre. */
  usuarios: Record<string, UsuarioViaje>;
  codigo: string;
  reporte_llm: Record<string, string> | null;
};

export async function cargarUnViaje(viajeId: number): Promise<Viaje | null> {
  const { data, error } = await supabase.from('viajes').select('*').eq('id', viajeId).single();
  if (error) throw error;
  return (data as Viaje) ?? null;
}

/**
 * Todos los viajes (activos Y finalizados) en los que participa este
 * usuario. Antes filtraba `activo=true`: un viaje finalizado desaparecía de
 * "Mis viajes" y de "Mi Viaje" en cuanto se cerraba, que es justo lo
 * contrario de lo pedido — quien ya estaba dentro tiene que poder seguir
 * viendo la clasificación final.
 */
export async function cargarMisViajes(userId: string): Promise<Viaje[]> {
  const { data, error } = await supabase.from('viajes').select('*');
  if (error) throw error;
  return ((data ?? []) as Viaje[]).filter((viaje) => userId in (viaje.usuarios ?? {}));
}

export async function buscarPorCodigo(codigo: string): Promise<Viaje | null> {
  const { data, error } = await supabase
    .from('viajes')
    .select('*')
    .eq('codigo', codigo)
    .eq('activo', true);
  if (error) throw error;
  return ((data ?? []) as Viaje[])[0] ?? null;
}

/** Contadores a cero para todos los eventos de las categorías del viaje. */
function eventosIniciales(categorias: string[]): Record<string, number> {
  const eventos: Record<string, number> = {};
  for (const categoria of categorias) {
    for (const claveEvento of Object.keys(CATEGORIAS[categoria]?.eventos ?? {})) {
      eventos[claveEvento] = 0;
    }
  }
  return eventos;
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function codigoAlAzar(): string {
  let letras = '';
  for (let i = 0; i < 3; i++) letras += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  let numeros = '';
  for (let i = 0; i < 3; i++) numeros += Math.floor(Math.random() * 10);
  return `${letras}-${numeros}`;
}

/**
 * Genera un código libre tipo ABC-123.
 *
 * La versión Python no comprobaba si el código ya existía, así que dos viajes
 * podían acabar con el mismo y unirse al equivocado. Aquí se reintenta.
 */
async function generarCodigoLibre(): Promise<string> {
  for (let intento = 0; intento < 8; intento++) {
    const codigo = codigoAlAzar();
    const { data, error } = await supabase.from('viajes').select('id').eq('codigo', codigo).limit(1);
    if (error) throw error;
    if (!data?.length) return codigo;
  }
  throw new Error('No hemos encontrado un código libre. Vuelve a intentarlo.');
}

export async function crearViaje(
  nombreViaje: string,
  categorias: string[],
  userId: string,
  nombreUsuario: string,
  avatarUrl?: string | null
): Promise<Viaje> {
  const codigo = await generarCodigoLibre();

  const nuevo = {
    nombre: nombreViaje,
    admin: userId,
    fecha_creacion: new Date().toISOString(),
    activo: true,
    categorias,
    usuarios: {
      [userId]: { nombre: nombreUsuario, avatarUrl: avatarUrl ?? null, eventos: eventosIniciales(categorias) },
    },
    codigo,
    reporte_llm: {},
  };

  const { data, error } = await supabase.from('viajes').insert(nuevo).select().single();
  if (error) throw error;
  return data as Viaje;
}

export async function unirseAViaje(
  viaje: Viaje,
  userId: string,
  nombreUsuario: string,
  avatarUrl?: string | null
): Promise<Viaje> {
  if (viaje.usuarios?.[userId]) return viaje; // Ya estaba dentro.

  const usuarios = {
    ...viaje.usuarios,
    [userId]: {
      nombre: nombreUsuario,
      avatarUrl: avatarUrl ?? null,
      eventos: eventosIniciales(viaje.categorias ?? []),
    },
  };

  const { error } = await supabase.from('viajes').update({ usuarios }).eq('id', viaje.id);
  if (error) throw error;
  return { ...viaje, usuarios };
}

/**
 * Propaga un cambio de nombre a los viajes activos del usuario.
 *
 * El nombre para mostrar es una copia dentro del JSON `usuarios` de cada
 * viaje (ver el comentario de `UsuarioViaje.nombre`): cambiarlo sólo en la
 * cuenta (`auth.updateUser`) no actualiza la clasificación de los viajes en
 * los que ya está metido. Se limita a los viajes ACTIVOS: los finalizados se
 * quedan con el nombre que tenían en su momento, como registro histórico.
 * `cargarMisViajes` trae también los finalizados (para poder seguir viéndolos),
 * así que el filtro tiene que estar aquí; antes lo daba gratis esa consulta.
 */
export async function actualizarNombreEnMisViajes(
  userId: string,
  nuevoNombre: string
): Promise<void> {
  const mios = (await cargarMisViajes(userId)).filter((v) => v.activo);
  // allSettled, no all: esto se llama después de que el nombre de la CUENTA
  // ya se ha guardado con éxito. Si un solo viaje fallase al escribir con
  // Promise.all, el error de esa fila taparía que la cuenta y el resto de
  // viajes sí se actualizaron, y el usuario vería "no se ha podido guardar"
  // con el nombre ya cambiado por debajo. Los viajes que no se actualicen se
  // quedan con el nombre viejo hasta el próximo intento; no es peor que el
  // estado antes de llamar a esto.
  await Promise.allSettled(
    mios.map((v) => {
      const usuario = v.usuarios?.[userId];
      if (!usuario || usuario.nombre === nuevoNombre) return Promise.resolve();
      const usuarios = { ...v.usuarios, [userId]: { ...usuario, nombre: nuevoNombre } };
      return supabase.from('viajes').update({ usuarios }).eq('id', v.id);
    })
  );
}

/**
 * Igual que `actualizarNombreEnMisViajes`, pero para la foto de perfil.
 *
 * Mismo motivo: `avatarUrl` es una copia por viaje (ver el comentario en
 * `UsuarioViaje`), así que subir una foto nueva y guardarla en la cuenta
 * (`actualizarAvatar` de `lib/auth`) no basta para que la clasificación de
 * los viajes ya existentes la enseñe. Igual que el nombre, sólo en los
 * viajes activos: un viaje finalizado es un registro cerrado.
 */
export async function actualizarAvatarEnMisViajes(userId: string, nuevaUrl: string): Promise<void> {
  const mios = (await cargarMisViajes(userId)).filter((v) => v.activo);
  await Promise.allSettled(
    mios.map((v) => {
      const usuario = v.usuarios?.[userId];
      if (!usuario || usuario.avatarUrl === nuevaUrl) return Promise.resolve();
      const usuarios = { ...v.usuarios, [userId]: { ...usuario, avatarUrl: nuevaUrl } };
      return supabase.from('viajes').update({ usuarios }).eq('id', v.id);
    })
  );
}

/**
 * Suma o resta 1 a un contador y guarda.
 *
 * A diferencia de registrar_evento() en Cacas.py, esto lee y escribe UNA fila,
 * no la tabla entera. Sigue siendo un read-modify-write sobre el JSON
 * `usuarios`, así que dos personas escribiendo en el mismo instante pueden
 * pisarse; la solución definitiva es una función RPC en Postgres con
 * jsonb_set, pendiente para más adelante.
 */
/**
 * Se lanza cuando quien pide restar tenía en pantalla un número que ya no es
 * el del servidor. Pasa de verdad: dos móviles en el mismo viaje, o el mismo
 * móvil con una pestaña vieja de fondo. Comparar contra el estado local del
 * cliente no lo detecta, porque el cliente puede llevar el mismo retraso que
 * el diálogo; sólo lo detecta comparar contra lo que el servidor tiene en el
 * momento de escribir.
 */
export class ConflictoDeConcurrencia extends Error {
  constructor(public valorEnServidor: number) {
    super(`La cuenta en el servidor es ${valorEnServidor}, no la que se esperaba.`);
    this.name = 'ConflictoDeConcurrencia';
  }
}

// `modificarEvento` sigue siendo lectura-y-luego-escritura en dos llamadas
// HTTP separadas, no una operación atómica: reduce la ventana de la carrera
// (de "todo el tiempo que el diálogo de confirmación estuvo abierto" a "un
// round-trip de red"), pero no la elimina. Dos escrituras concurrentes con el
// mismo `valorEsperado` pueden las dos leer el mismo valor, las dos pasar la
// comprobación, y la segunda pisar a la primera. El arreglo de verdad es la
// RPC con `jsonb_set` que ya está pendiente en el CLAUDE.md del proyecto.

export async function modificarEvento(
  viajeId: number,
  userId: string,
  claveEvento: string,
  delta: number,
  /**
   * Si se pasa, la escritura se rechaza cuando el valor en el servidor no es
   * exactamente este, en vez de aplicar el delta a ciegas sobre lo que haya.
   * Lo usa la confirmación al restar: sin esto, el diálogo puede prometer
   * "de 3 a 2" y el resultado real ser 4, porque otro dispositivo sumó entre
   * medias y el delta se aplicaría igual sobre el 5 real del servidor.
   */
  valorEsperado?: number
): Promise<Viaje> {
  const viaje = await cargarUnViaje(viajeId);
  if (!viaje) throw new Error('El viaje ya no existe');
  // La pantalla oculta +/− en cuanto ve `activo=false`, pero otro móvil puede
  // tener todavía el viaje pintado como activo (no se ha enterado del cierre)
  // y seguir sumando. Esta fila recién leída del servidor es la única que
  // sabe la verdad, así que el cierre se hace cumplir aquí.
  if (!viaje.activo) throw new Error('Este viaje ya está finalizado: la clasificación no se puede tocar.');

  const usuarioActual = viaje.usuarios?.[userId];
  if (!usuarioActual) throw new Error('No estás apuntado a este viaje');

  const valorActual = usuarioActual.eventos?.[claveEvento] ?? 0;
  if (valorEsperado !== undefined && valorActual !== valorEsperado) {
    throw new ConflictoDeConcurrencia(valorActual);
  }
  const nuevoValor = Math.max(0, valorActual + delta);

  const usuarios = {
    ...viaje.usuarios,
    [userId]: {
      ...usuarioActual,
      eventos: { ...usuarioActual.eventos, [claveEvento]: nuevoValor },
    },
  };

  const { error } = await supabase.from('viajes').update({ usuarios }).eq('id', viajeId);
  if (error) throw error;
  return { ...viaje, usuarios };
}

/**
 * Cierra el viaje: nadie podrá sumar ni restar más (viaje.tsx oculta los
 * botones +/− en cuanto `activo` es false), la clasificación se queda fija.
 * Quien ya estaba dentro lo sigue viendo — `cargarMisViajes` ya no filtra
 * por `activo`, así que desaparecer de la lista no es un riesgo.
 *
 * No hay comprobación de "sólo el admin" aquí ni en RLS: el modelo de
 * confianza de este proyecto (ver `politicas-rls.sql`) ya es "cualquier
 * autenticado puede escribir cualquier viaje", así que la comprobación de
 * quién puede pulsar el botón vive en la pantalla (`viaje.admin === userId`),
 * igual que ya pasa con sumar/restar.
 */
export async function finalizarViaje(viajeId: number): Promise<Viaje> {
  const { data, error } = await supabase
    .from('viajes')
    .update({ activo: false, fecha_finalizacion: new Date().toISOString() })
    .eq('id', viajeId)
    .select()
    .single();
  if (error) throw error;
  return data as Viaje;
}
