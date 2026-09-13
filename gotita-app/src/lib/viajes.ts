import { CATEGORIAS } from './categorias';
import { supabase } from './supabase';

export type UsuarioViaje = {
  /** Nombre para mostrar. Editable sin perder nada, porque la clave es el UUID. */
  nombre: string;
  eventos: Record<string, number>;
};

export type Viaje = {
  id: number;
  nombre: string;
  /** UUID de quien lo creó. */
  admin: string;
  fecha_creacion: string;
  activo: boolean;
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

/** Viajes activos en los que participa este usuario. */
export async function cargarMisViajes(userId: string): Promise<Viaje[]> {
  const { data, error } = await supabase.from('viajes').select('*').eq('activo', true);
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
  nombreUsuario: string
): Promise<Viaje> {
  const codigo = await generarCodigoLibre();

  const nuevo = {
    nombre: nombreViaje,
    admin: userId,
    fecha_creacion: new Date().toISOString(),
    activo: true,
    categorias,
    usuarios: {
      [userId]: { nombre: nombreUsuario, eventos: eventosIniciales(categorias) },
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
  nombreUsuario: string
): Promise<Viaje> {
  if (viaje.usuarios?.[userId]) return viaje; // Ya estaba dentro.

  const usuarios = {
    ...viaje.usuarios,
    [userId]: { nombre: nombreUsuario, eventos: eventosIniciales(viaje.categorias ?? []) },
  };

  const { error } = await supabase.from('viajes').update({ usuarios }).eq('id', viaje.id);
  if (error) throw error;
  return { ...viaje, usuarios };
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
export async function modificarEvento(
  viajeId: number,
  userId: string,
  claveEvento: string,
  delta: number
): Promise<Viaje> {
  const viaje = await cargarUnViaje(viajeId);
  if (!viaje) throw new Error('El viaje ya no existe');

  const usuarioActual = viaje.usuarios?.[userId];
  if (!usuarioActual) throw new Error('No estás apuntado a este viaje');

  const valorActual = usuarioActual.eventos?.[claveEvento] ?? 0;
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

/** Total de todos los eventos de un usuario, para la clasificación. */
export function totalDeUsuario(usuario: UsuarioViaje): number {
  return Object.values(usuario.eventos ?? {}).reduce((suma, n) => suma + (n ?? 0), 0);
}
