import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvisoInstalar } from '@/componentes/AvisoInstalar';
import { DialogoConfirmar } from '@/componentes/DialogoConfirmar';
import { Desplegable } from '@/componentes/Desplegable';
import { CATEGORIAS } from '@/lib/categorias';
import { useAuth } from '@/lib/auth';
import { compartirCodigo, copiarCodigo, copiarTexto } from '@/lib/compartir';
import { sePuedeRestar, textosDeConfirmacion } from '@/lib/confirmacion';
import { IconoDe, ICONOS } from '@/lib/iconos';
import { formatearFecha, promptNarrativaIA, textoClasificacion } from '@/lib/reporte';
import { radio, tema } from '@/lib/tema';
import { ConflictoDeConcurrencia, finalizarViaje, modificarEvento } from '@/lib/viajes';
import { useViajes } from '@/lib/viajesContext';
import type { TextosConfirmacion } from '@/lib/confirmacion';

/**
 * El viaje activo y sus contadores. Cambiar de viaje o gestionar la lista
 * completa vive en la pestaña "Mis viajes"; esta pantalla siempre muestra
 * el que esté marcado como activo en el contexto compartido.
 */
export default function PantallaViaje() {
  const { userId, nombreUsuario } = useAuth();
  const { viaje, viajes, cargando, error, setError, recargar, setViajes } = useViajes();
  const insets = useSafeAreaInsets();

  const [refrescando, setRefrescando] = useState(false);
  // Evento pendiente de confirmar al restar. null = no hay diálogo abierto.
  const [porRestar, setPorRestar] = useState<{ clave: string; cuenta: number } | null>(null);
  // Aviso corto tras copiar o compartir el código ("Código copiado"). null =
  // no hay nada que enseñar.
  const [avisoCodigo, setAvisoCodigo] = useState<string | null>(null);
  // Confirmación de "Finalizar viaje" (sólo el admin la ve). Reusa
  // DialogoConfirmar con unos textos propios, no los de restar un evento.
  const [porFinalizar, setPorFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  // Aviso corto tras copiar la clasificación o el prompt de IA.
  const [avisoReporte, setAvisoReporte] = useState<string | null>(null);
  const avisoReporteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clasificación cerrada por defecto en sus tres niveles (la sección
  // entera, cada categoría, cada evento dentro de ella): que un primer
  // vistazo a "Mi Viaje" no enseñe ya los resultados de nadie, pedido
  // explícito. `categoriasAbiertas`/`eventosAbiertos` son mapas, no un único
  // "cuál está abierto": varias categorías (o varios eventos) pueden estar
  // desplegados a la vez.
  const [clasificacionAbierta, setClasificacionAbierta] = useState(false);
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Record<string, boolean>>({});
  const [eventosAbiertos, setEventosAbiertos] = useState<Record<string, boolean>>({});

  function alternarCategoria(nombreCategoria: string) {
    setCategoriasAbiertas((previas) => ({ ...previas, [nombreCategoria]: !previas[nombreCategoria] }));
  }

  function alternarEvento(claveGlobal: string) {
    setEventosAbiertos((previos) => ({ ...previos, [claveGlobal]: !previos[claveGlobal] }));
  }

  // Las escrituras van en fila india: si pulsas 💩 cinco veces seguidas, cada
  // guardado espera al anterior en vez de leer todos la misma cuenta vieja.
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const scroll = useRef<ScrollView>(null);
  const avisoCodigoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (avisoCodigoTimeout.current) clearTimeout(avisoCodigoTimeout.current);
      if (avisoReporteTimeout.current) clearTimeout(avisoReporteTimeout.current);
    };
  }, []);

  function mostrarAvisoCodigo(texto: string) {
    setAvisoCodigo(texto);
    if (avisoCodigoTimeout.current) clearTimeout(avisoCodigoTimeout.current);
    avisoCodigoTimeout.current = setTimeout(() => setAvisoCodigo(null), 2000);
  }

  async function alPulsarCodigo() {
    if (!viaje) return;
    await copiarCodigo(viaje.codigo);
    mostrarAvisoCodigo('Código copiado');
  }

  async function alCompartirCodigo() {
    if (!viaje) return;
    const resultado = await compartirCodigo(viaje.nombre, viaje.codigo);
    if (resultado === 'copiado') mostrarAvisoCodigo('Código copiado');
  }

  function mostrarAvisoReporte(texto: string) {
    setAvisoReporte(texto);
    if (avisoReporteTimeout.current) clearTimeout(avisoReporteTimeout.current);
    avisoReporteTimeout.current = setTimeout(() => setAvisoReporte(null), 2500);
  }

  async function alCopiarClasificacion() {
    if (!viaje) return;
    await copiarTexto(textoClasificacion(viaje));
    mostrarAvisoReporte('Clasificación copiada');
  }

  async function alCopiarPrompt() {
    if (!viaje) return;
    await copiarTexto(promptNarrativaIA(viaje));
    mostrarAvisoReporte('Prompt copiado: pégalo en tu IA favorita');
  }

  const textosFinalizar: TextosConfirmacion = {
    titulo: '¿Finalizar el viaje?',
    mensaje:
      'Nadie podrá sumar ni restar más, ni tú. La clasificación se queda fija y todos la seguirán viendo.',
    etiquetaConfirmar: 'Sí, finalizar',
    etiquetaCancelar: 'Cancelar',
    icono: ICONOS.trofeo,
  };

  function alPedirFinalizar() {
    setPorFinalizar(true);
  }

  async function alConfirmarFinalizar() {
    setPorFinalizar(false);
    if (!viaje) return;
    setFinalizando(true);
    try {
      const actualizado = await finalizarViaje(viaje.id);
      setViajes((previos) => previos.map((v) => (v.id === actualizado.id ? actualizado : v)));
      setError(null);
    } catch (e) {
      mostrarError(e instanceof Error ? e.message : 'No se ha podido finalizar el viaje.');
    } finally {
      setFinalizando(false);
    }
  }

  /** Sube al principio, que es donde vive el aviso de error. Sin esto, un
   * error al confirmar una resta (el − suele estar lejos del principio, al
   * final de una lista larga de categorías) no lo ve nadie: el diálogo se
   * cierra, no cambia ningún número visible, y parece que no ha pasado nada. */
  function mostrarError(mensaje: string) {
    setError(mensaje);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  function alPulsar(claveEvento: string, delta: number) {
    if (!viaje) return;
    const viajeId = viaje.id;

    // Pintamos el número nuevo ya, sin esperar a la red. Esto es lo que hace
    // que se sienta como una app y no como un formulario.
    setViajes((previos) =>
      previos.map((v) => {
        if (v.id !== viajeId) return v;
        const usuario = v.usuarios[userId];
        if (!usuario) return v;
        const valor = Math.max(0, (usuario.eventos?.[claveEvento] ?? 0) + delta);
        return {
          ...v,
          usuarios: {
            ...v.usuarios,
            [userId]: { ...usuario, eventos: { ...usuario.eventos, [claveEvento]: valor } },
          },
        };
      })
    );

    const guardar = async () => {
      try {
        const actualizado = await modificarEvento(viajeId, userId, claveEvento, delta);
        setViajes((previos) => previos.map((v) => (v.id === viajeId ? actualizado : v)));
        setError(null);
      } catch (e) {
        mostrarError(e instanceof Error ? e.message : 'No se ha podido guardar.');
        await recargar(false); // Deshace lo pintado volviendo a lo que dice el servidor.
      }
    };
    cola.current = cola.current.then(guardar, guardar);
  }

  /** El − no resta: abre el diálogo. Restar de verdad es `alConfirmarResta`. */
  // Si el viaje activo cambia con el diálogo abierto (p.ej. desde la pestaña
  // "Mis viajes"), la resta caería en otro viaje. Se cierra y se empieza de
  // nuevo.
  useEffect(() => {
    setPorRestar(null);
  }, [viaje?.id]);

  function alPedirResta(claveEvento: string, cuentaActual: number) {
    if (!sePuedeRestar(cuentaActual)) return;
    setPorRestar({ clave: claveEvento, cuenta: cuentaActual });
  }

  /**
   * Confirmar no aplica el delta a ciegas.
   *
   * No basta con comparar contra `viaje` (el estado local del cliente):
   * el escenario real que esto protege es que OTRO dispositivo haya sumado
   * entre que se abrió el diálogo y se confirmó, y el cliente local puede
   * llevar el mismo retraso que el diálogo. `modificarEvento` recibe el valor
   * que el diálogo prometió y lo comprueba contra lo que el servidor tenga en
   * el instante de escribir, no contra lo que hay pintado en pantalla.
   */
  function alConfirmarResta() {
    if (!porRestar) return;
    const { clave, cuenta } = porRestar;
    if (!viaje) {
      setPorRestar(null);
      return;
    }
    const viajeId = viaje.id;
    setPorRestar(null);

    // Optimista igual que alPulsar, pero desde el valor prometido por el
    // diálogo: si el cliente ya iba desfasado, esto puede pintar un número
    // que la respuesta del servidor corrija enseguida, en vez de aplicar el
    // delta sobre lo que haya en pantalla en ese instante.
    setViajes((previos) =>
      previos.map((v) => {
        if (v.id !== viajeId) return v;
        const usuario = v.usuarios[userId];
        if (!usuario) return v;
        return {
          ...v,
          usuarios: {
            ...v.usuarios,
            [userId]: {
              ...usuario,
              eventos: { ...usuario.eventos, [clave]: Math.max(0, cuenta - 1) },
            },
          },
        };
      })
    );

    const guardar = async () => {
      try {
        const actualizado = await modificarEvento(viajeId, userId, clave, -1, cuenta);
        setViajes((previos) => previos.map((v) => (v.id === viajeId ? actualizado : v)));
        setError(null);
      } catch (e) {
        if (e instanceof ConflictoDeConcurrencia) {
          mostrarError(
            `La cuenta cambió mientras confirmabas: ahora hay ${e.valorEnServidor}, no ${cuenta}. No se ha quitado nada, vuelve a intentarlo.`
          );
        } else {
          mostrarError(e instanceof Error ? e.message : 'No se ha podido guardar.');
        }
        await recargar(false); // Deshace lo pintado volviendo a lo que dice el servidor.
      }
    };
    cola.current = cola.current.then(guardar, guardar);
  }

  async function alRefrescar() {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  }

  if (cargando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={tema.acento} />
      </View>
    );
  }

  const misEventos = viaje?.usuarios?.[userId]?.eventos ?? {};
  // Una clasificación por CADA EVENTO (Cacas, Pises, Cerveza...), agrupadas
  // bajo su categoría (Gotitas, Bebidas...), no un total único que mezcla
  // cacas con cervezas ni uno por categoría que mezcla cacas con pises.
  const clasificacionPorCategoria = viaje
    ? (viaje.categorias ?? [])
        .map((nombreCategoria) => {
          const categoria = CATEGORIAS[nombreCategoria];
          if (!categoria) return null;
          const eventos = Object.entries(categoria.eventos).map(([claveEvento, infoEvento]) => {
            const filas = Object.entries(viaje.usuarios ?? {})
              .map(([clave, usuario]) => ({
                clave,
                nombre: usuario.nombre,
                avatarUrl: usuario.avatarUrl ?? null,
                total: usuario.eventos?.[claveEvento] ?? 0,
              }))
              .sort((a, b) => b.total - a.total);
            return { claveEvento, nombreEvento: infoEvento.nombre, iconoEvento: infoEvento.icono, filas };
          });
          return { nombreCategoria, icono: categoria.icono, eventos };
        })
        .filter((entrada): entrada is NonNullable<typeof entrada> => entrada !== null)
    : [];

  return (
    <ScrollView
      ref={scroll}
      testID="scroll-viaje"
      style={estilos.pantalla}
      contentContainerStyle={[
        estilos.contenido,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 },
      ]}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={tema.acento} />
      }>
      <View style={estilos.cabecera}>
        <View style={estilos.saludoFila}>
          <IconoDe spec={ICONOS.gota} size={16} color={tema.textoTenue} />
          <Text style={estilos.saludo}>Hola, {nombreUsuario.split(' ')[0] || 'tú'}</Text>
        </View>
        {viaje ? <Text style={estilos.nombreViaje}>{viaje.nombre}</Text> : null}
      </View>

      {viaje && !viaje.activo ? (
        <View style={estilos.avisoFinalizado}>
          <IconoDe spec={ICONOS.trofeo} size={16} color={tema.textoTenue} />
          <Text style={estilos.avisoFinalizadoTexto}>
            Viaje finalizado
            {viaje.fecha_finalizacion ? ` el ${formatearFecha(viaje.fecha_finalizacion)}` : ''}. La
            clasificación se queda fija.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={estilos.error}>{error}</Text> : null}

      {!viaje ? (
        <View style={estilos.vacio}>
          <IconoDe spec={ICONOS.maleta} size={56} color={tema.textoTenue} />
          <Text style={estilos.vacioTitulo}>
            {viajes.length > 0 ? 'Elige un viaje en "Mis viajes"' : 'No estás en ningún viaje'}
          </Text>
          <Text style={estilos.vacioTexto}>
            Crea uno nuevo, o pide el código a quien lo haya creado y únete.
          </Text>
          <Pressable style={estilos.botonPrincipal} onPress={() => router.push('/crear')}>
            <Text style={estilos.botonPrincipalTexto}>Crear un viaje</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/unirme')} hitSlop={10}>
            <Text style={estilos.enlaceVacio}>Unirme con un código</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {(viaje.categorias ?? []).map((nombreCategoria) => {
            const categoria = CATEGORIAS[nombreCategoria];
            if (!categoria) return null;
            return (
              <View key={nombreCategoria} style={estilos.seccion}>
                <View style={estilos.tituloSeccionFila}>
                  <IconoDe spec={categoria.icono} size={18} color={tema.texto} />
                  <Text style={estilos.tituloSeccion}>{nombreCategoria}</Text>
                </View>
                {Object.entries(categoria.eventos).map(([clave, evento]) => {
                  const cuenta = misEventos[clave] ?? 0;
                  return (
                    <View key={clave} style={estilos.tarjeta}>
                      <View style={estilos.tarjetaIcono}>
                        <IconoDe spec={evento.icono} size={22} color={tema.acento} />
                      </View>
                      <View style={estilos.tarjetaTextos}>
                        <Text style={estilos.tarjetaNombre}>{evento.nombre}</Text>
                        <Text style={estilos.tarjetaCuenta}>{cuenta}</Text>
                      </View>
                      {/* Viaje finalizado: sólo lectura para todos, admin
                          incluido. La clasificación se queda fija; no hay
                          "sólo el admin puede seguir sumando", nadie suma. */}
                      {viaje.activo ? (
                        <>
                          <Pressable
                            onPress={() => alPedirResta(clave, cuenta)}
                            disabled={cuenta === 0}
                            accessibilityRole="button"
                            accessibilityLabel={`Quitar uno de ${evento.nombre}`}
                            style={({ pressed }) => [
                              estilos.botonMenos,
                              cuenta === 0 && estilos.botonDeshabilitado,
                              pressed && estilos.pulsado,
                            ]}
                            hitSlop={6}>
                            <Text style={estilos.botonMenosTexto}>−</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => alPulsar(clave, 1)}
                            accessibilityRole="button"
                            accessibilityLabel={`Sumar uno a ${evento.nombre}`}
                            style={({ pressed }) => [estilos.botonMas, pressed && estilos.pulsado]}>
                            <Text style={estilos.botonMasTexto}>+</Text>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={estilos.seccion}>
            <Desplegable
              abierto={clasificacionAbierta}
              onToggle={() => setClasificacionAbierta((v) => !v)}
              titulo="Clasificación"
              icono={ICONOS.trofeo}
              estiloCabecera={estilos.tituloSeccionFila}
              estiloTitulo={estilos.tituloSeccion}>
              <View style={estilos.contenidoDesplegable}>
                {clasificacionPorCategoria.map(({ nombreCategoria, icono, eventos }) => (
                  <Desplegable
                    key={nombreCategoria}
                    abierto={!!categoriasAbiertas[nombreCategoria]}
                    onToggle={() => alternarCategoria(nombreCategoria)}
                    titulo={nombreCategoria}
                    etiquetaAccesible={`clasificación de ${nombreCategoria}`}
                    icono={icono}
                    estiloCabecera={estilos.cabeceraCategoria}
                    estiloTitulo={estilos.tituloCategoria}>
                    <View style={estilos.contenidoDesplegable}>
                      {eventos.map(({ claveEvento, nombreEvento, iconoEvento, filas }) => {
                        const claveGlobal = `${nombreCategoria}:${claveEvento}`;
                        return (
                          <Desplegable
                            key={claveEvento}
                            abierto={!!eventosAbiertos[claveGlobal]}
                            onToggle={() => alternarEvento(claveGlobal)}
                            titulo={nombreEvento}
                            // "en {categoría}", no sólo el nombre del evento:
                            // el evento "pises" se llama igual que su
                            // categoría ("Gotitas"), y sin este sufijo la
                            // cabecera del evento y la de su propia categoría
                            // compartirían el mismo accessibilityLabel en
                            // cuanto las dos estuvieran abiertas a la vez.
                            etiquetaAccesible={`clasificación de ${nombreEvento} en ${nombreCategoria}`}
                            icono={iconoEvento}
                            estiloCabecera={estilos.cabeceraEvento}
                            estiloTitulo={estilos.tituloEvento}>
                            <View style={estilos.subseccion}>
                              {filas.map((fila, indice) => (
                                <View key={fila.clave} style={estilos.filaRanking}>
                                  <Text style={estilos.puesto}>{indice + 1}</Text>
                                  <View style={estilos.avatarMini}>
                                    {fila.avatarUrl ? (
                                      <Image
                                        source={{ uri: fila.avatarUrl }}
                                        style={estilos.avatarMiniFoto}
                                        contentFit="cover"
                                      />
                                    ) : (
                                      <Text style={estilos.avatarMiniTexto}>
                                        {(fila.nombre.trim()[0] || '?').toUpperCase()}
                                      </Text>
                                    )}
                                  </View>
                                  <Text
                                    style={[
                                      estilos.nombreRanking,
                                      fila.clave === userId && estilos.nombreRankingYo,
                                    ]}
                                    numberOfLines={1}>
                                    {fila.nombre}
                                  </Text>
                                  <Text style={estilos.totalRanking}>{fila.total}</Text>
                                </View>
                              ))}
                            </View>
                          </Desplegable>
                        );
                      })}
                    </View>
                  </Desplegable>
                ))}
              </View>
            </Desplegable>
          </View>

          {viaje.activo && viaje.admin === userId ? (
            <View style={estilos.seccion}>
              <Pressable
                onPress={alPedirFinalizar}
                disabled={finalizando}
                accessibilityRole="button"
                accessibilityLabel="Finalizar viaje"
                style={({ pressed }) => [
                  estilos.botonFinalizar,
                  pressed && estilos.pulsado,
                  finalizando && estilos.botonDeshabilitado,
                ]}>
                {finalizando ? (
                  <ActivityIndicator color={tema.peligro} />
                ) : (
                  <Text style={estilos.botonFinalizarTexto}>Finalizar viaje</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {!viaje.activo && viaje.admin === userId ? (
            <View style={estilos.seccion}>
              <View style={estilos.tituloSeccionFila}>
                <IconoDe spec={ICONOS.compartir} size={18} color={tema.texto} />
                <Text style={estilos.tituloSeccion}>Compartir el resultado</Text>
              </View>
              <Pressable
                onPress={alCopiarClasificacion}
                accessibilityRole="button"
                accessibilityLabel="Copiar clasificación en texto"
                style={({ pressed }) => [estilos.botonReporte, pressed && estilos.pulsado]}>
                <IconoDe spec={ICONOS.copiar} size={16} color={tema.acento} />
                <Text style={estilos.botonReporteTexto}>Copiar clasificación</Text>
              </Pressable>
              <Pressable
                onPress={alCopiarPrompt}
                accessibilityRole="button"
                accessibilityLabel="Copiar prompt para IA"
                style={({ pressed }) => [estilos.botonReporte, pressed && estilos.pulsado]}>
                <IconoDe spec={ICONOS.ia} size={16} color={tema.acento} />
                <Text style={estilos.botonReporteTexto}>Copiar prompt para una IA</Text>
              </Pressable>
              {avisoReporte ? <Text style={estilos.avisoCodigo}>{avisoReporte}</Text> : null}
            </View>
          ) : null}

          <View style={estilos.pie}>
            <View style={estilos.filaCodigo}>
              <Pressable
                onPress={alPulsarCodigo}
                accessibilityRole="button"
                accessibilityLabel="Copiar código del viaje"
                hitSlop={8}>
                <Text style={estilos.codigo}>Código del viaje: {viaje.codigo}</Text>
              </Pressable>
              <Pressable
                onPress={alCompartirCodigo}
                accessibilityRole="button"
                accessibilityLabel="Compartir código del viaje"
                hitSlop={8}
                style={estilos.botonCompartirCodigo}>
                <IconoDe spec={ICONOS.compartir} size={16} color={tema.textoTenue} />
              </Pressable>
            </View>
            {avisoCodigo ? <Text style={estilos.avisoCodigo}>{avisoCodigo}</Text> : null}
          </View>
        </>
      )}

      <AvisoInstalar />

      <DialogoConfirmar
        visible={porRestar !== null}
        textos={porRestar ? textosDeConfirmacion(porRestar.clave, porRestar.cuenta) : null}
        alConfirmar={alConfirmarResta}
        alCancelar={() => setPorRestar(null)}
      />

      <DialogoConfirmar
        visible={porFinalizar}
        textos={textosFinalizar}
        alConfirmar={alConfirmarFinalizar}
        alCancelar={() => setPorFinalizar(false)}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { paddingHorizontal: 18 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fondo },

  cabecera: { gap: 2 },
  saludoFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saludo: { color: tema.textoTenue, fontSize: 15, fontWeight: '600' },
  nombreViaje: { color: tema.texto, fontSize: 28, fontWeight: '800', marginTop: 2 },

  avisoFinalizado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: tema.fondoElevado,
    borderRadius: radio.sm,
    padding: 12,
  },
  avisoFinalizadoTexto: { color: tema.textoTenue, fontSize: 13, flex: 1, lineHeight: 18 },

  error: {
    color: tema.peligro,
    backgroundColor: 'rgba(242,85,90,0.12)',
    borderRadius: radio.sm,
    padding: 12,
    marginTop: 16,
    fontSize: 14,
  },

  seccion: { marginTop: 28 },
  tituloSeccionFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginLeft: 2,
  },
  tituloSeccion: { color: tema.texto, fontSize: 19, fontWeight: '800' },

  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tarjetaIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.fondoElevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjetaTextos: { flex: 1 },
  tarjetaNombre: { color: tema.textoTenue, fontSize: 14, fontWeight: '600' },
  tarjetaCuenta: { color: tema.texto, fontSize: 30, fontWeight: '800', lineHeight: 36 },

  botonMenos: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.fondoElevado,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  botonMenosTexto: { color: tema.textoTenue, fontSize: 26, fontWeight: '700', lineHeight: 30 },
  botonDeshabilitado: { opacity: 0.35 },
  botonMas: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tema.acento,
  },
  botonMasTexto: { color: '#04121C', fontSize: 32, fontWeight: '800', lineHeight: 36 },
  pulsado: { opacity: 0.7, transform: [{ scale: 0.94 }] },

  // Los tres niveles del desplegable de Clasificación: la sección entera
  // (tituloSeccionFila/tituloSeccion, ya definidos arriba, reusados como
  // cabecera pulsable), cada categoría, y cada evento dentro de ella. Cada
  // nivel indenta un poco más, para que se note que uno vive dentro del
  // otro sin necesitar una línea de separación.
  contenidoDesplegable: { marginTop: 4 },
  cabeceraCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 8,
  },
  tituloCategoria: { color: tema.texto, fontSize: 16, fontWeight: '700' },
  cabeceraEvento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 22,
  },
  tituloEvento: { color: tema.textoTenue, fontSize: 14, fontWeight: '600' },
  subseccion: { marginBottom: 4, paddingLeft: 8 },

  filaRanking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: tema.fondoElevado,
    borderRadius: radio.md,
    marginBottom: 8,
  },
  puesto: { color: tema.textoTenue, fontSize: 15, fontWeight: '800', width: 18 },
  avatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarMiniFoto: { width: '100%', height: '100%' },
  avatarMiniTexto: { color: tema.acento, fontSize: 12, fontWeight: '800' },
  nombreRanking: { color: tema.texto, fontSize: 16, flex: 1 },
  nombreRankingYo: { fontWeight: '800', color: tema.acento },
  totalRanking: { color: tema.texto, fontSize: 18, fontWeight: '800' },

  vacio: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 12 },
  vacioTitulo: {
    color: tema.texto,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },
  vacioTexto: {
    color: tema.textoTenue,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  botonPrincipal: {
    backgroundColor: tema.acento,
    borderRadius: radio.md,
    paddingVertical: 16,
    paddingHorizontal: 28,
    marginTop: 28,
  },
  botonPrincipalTexto: { color: '#04121C', fontSize: 16, fontWeight: '800' },
  enlaceVacio: { color: tema.acento, fontSize: 15, fontWeight: '700', marginTop: 22 },

  pie: { marginTop: 36, alignItems: 'center', gap: 8 },
  filaCodigo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codigo: { color: tema.textoTenue, fontSize: 14, letterSpacing: 0.5 },
  botonCompartirCodigo: { padding: 4 },
  avisoCodigo: { color: tema.acento, fontSize: 13, fontWeight: '700' },

  botonFinalizar: {
    borderRadius: radio.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tema.peligro,
  },
  botonFinalizarTexto: { color: tema.peligro, fontSize: 15, fontWeight: '800' },

  botonReporte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tema.tarjeta,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: radio.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  botonReporteTexto: { color: tema.texto, fontSize: 15, fontWeight: '700' },
});
