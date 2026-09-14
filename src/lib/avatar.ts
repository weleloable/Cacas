import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

const BUCKET = 'avatars';

/**
 * Abre el selector de fotos de la galería. `null` si cancela o si no se
 * concede el permiso (Android/iOS piden permiso explícito; en web
 * `requestMediaLibraryPermissionsAsync` siempre concede, es sólo el
 * `<input type="file">` del navegador).
 */
export async function elegirDeGaleria(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return null;

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (resultado.canceled) return null;
  return resultado.assets[0]?.uri ?? null;
}

/**
 * Abre la cámara para hacer una foto al momento. En web usa el `capture` del
 * `<input type="file">` (funciona en móvil; en escritorio sin cámara cae al
 * selector de ficheros normal, comportamiento del propio navegador).
 */
export async function hacerFoto(): Promise<string | null> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) return null;

  const resultado = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (resultado.canceled) return null;
  return resultado.assets[0]?.uri ?? null;
}

/**
 * Sube la imagen de `uri` al bucket `avatars` y devuelve su URL pública.
 *
 * Carpeta por usuario (`${userId}/...`) porque las políticas de Storage
 * (`supabase/politicas-storage-avatars.sql`) comprueban el dueño mirando el
 * primer segmento de la ruta, no hay otra forma de saber de quién es un
 * fichero dentro de un bucket. El nombre lleva la hora: si se reusara
 * siempre el mismo nombre, la foto vieja se quedaría cacheada en el
 * navegador con la misma URL y el cambio no se vería hasta forzar una
 * recarga.
 */
export async function subirAvatar(userId: string, uri: string): Promise<string> {
  const respuesta = await fetch(uri);
  const blob = await respuesta.blob();
  const extension = blob.type === 'image/png' ? 'png' : 'jpg';
  const ruta = `${userId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}
