import os
import streamlit as st
from datetime import datetime
from supabase import create_client, Client
from streamlit_supabase_auth import login_form, logout_button
import hashlib
import pandas as pd
import plotly.express as px
# Obtener la URL actual de la app dinámicamente
import urllib.parse


# Esto te mostrará si hay algo en la URL que la app no está pillando
st.write("Parámetros en la URL:", st.query_params)

# --- 1. CONFIGURACIÓN DE LA APP ---
st.set_page_config(page_title="Gotita", page_icon="💧", layout="wide")

# Estilo CSS para botones y tablas compactas
st.markdown("""
    <style>
    div.stButton > button { height: 3.5em; width: 100%; border-radius: 10px; font-weight: bold; }
    .stMetric { background-color: #f0f2f6; padding: 10px; border-radius: 10px; }
    .stDataFrame td, .stDataFrame th { padding: 2px 5px !important; font-size: 14px; }
    </style>
    """, unsafe_allow_html=True)

# --- 2. CONEXIÓN SUPABASE ---
try:
    SUPABASE_URL = st.secrets["supabase"]["url"]
    SUPABASE_KEY = st.secrets["supabase"]["key"]
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    st.error("Error de conexión. Revisa tus Secrets.")
    st.stop()

# --- 3. AUTENTICACIÓN  ---
# --- 3. LOGIN NATIVO (SIN LIBRERÍAS EXTRA) ---
if "user" not in st.session_state:
    st.session_state.user = None

# Intentamos recuperar sesión si existe en la URL
if not st.session_state.user:
    curr_session = supabase.auth.get_session()
    if curr_session and curr_session.user:
        st.session_state.user = curr_session.user

# Si seguimos sin usuario, mostramos botón manual
if not st.session_state.user:
    st.title("Gotita 💧")
    if st.button("Entrar con Google"):
        # Esto genera la URL de Google directamente
        res = supabase.auth.sign_in_with_oauth({
            "provider": "google",
            "options": {
                "redirect_to": "https://cacas.streamlit.app"
            }
        })
        # Redirigimos manualmente
        st.write(f"Redirigiendo... [Pulsa aquí si no carga]({res.url})")
        st.stop()
    st.stop()

# Si hay usuario, extraemos datos
USER_EMAIL = st.session_state.user.email
USER_NAME = st.session_state.user.user_metadata.get('full_name', 'Usuario')

# --- 4. CONSTANTES ---
CATEGORIAS = {
    "Gotitas": {
        "emoji": "💧",
        "eventos": {
            "cacas": {"nombre": "Cacas", "emoji": "💩"},
            "pises": {"nombre": "Pises", "emoji": "💧"}
        }
    },
    "Bebidas": {
        "emoji": "🍺",
        "eventos": {
            "cervezas": {"nombre": "Cerveza", "emoji": "🍺"},
            "vinos": {"nombre": "Copa de vino", "emoji": "🍷"},
            "vermouths": {"nombre": "Vermouth", "emoji": "🍸"},
            "copazos": {"nombre": "Copazo", "emoji": "🥃"}
        }
    }
}

# --- 5. FUNCIONES DE BASE DE DATOS ---

def cargar_un_viaje(viaje_id):
    res = supabase.table('viajes').select('*').eq('id', viaje_id).execute()
    return res.data[0] if res.data else None

def cargar_viajes_activos():
    res = supabase.table('viajes').select('*').eq('activo', True).execute()
    return res.data

def cargar_viajes_finalizados():
    res = supabase.table('viajes').select('*').eq('activo', False).execute()
    return res.data

def actualizar_viaje(viaje_id, campos):
    supabase.table('viajes').update(campos).eq('id', viaje_id).execute()

# --- 6. LÓGICA DE NEGOCIO (SIN CONTRASEÑAS) ---

def crear_viaje(nombre_viaje, categorias_sel):
    nuevo_viaje = {
        "nombre": nombre_viaje,
        "admin": USER_EMAIL, # El admin es el email de Google
        "fecha_creacion": datetime.now().isoformat(),
        "activo": True,
        "categorias": categorias_sel,
        "usuarios": {
            USER_EMAIL: {
                "nombre": USER_NAME,
                "eventos": {ev: 0 for cat in categorias_sel for ev in CATEGORIAS[cat]["eventos"]}
            }
        },
        "reporte_llm": {}
    }
    res = supabase.table('viajes').insert(nuevo_viaje).execute()
    return res.data[0]

def añadir_usuario_a_viaje(viaje):
    if USER_EMAIL in viaje["usuarios"]:
        return True # Ya está dentro
    
    eventos_init = {}
    for cat in viaje.get("categorias", []):
        for ev_key in CATEGORIAS[cat]["eventos"]:
            eventos_init[ev_key] = 0
    
    viaje["usuarios"][USER_EMAIL] = {
        "nombre": USER_NAME,
        "eventos": eventos_init
    }
    actualizar_viaje(viaje["id"], {"usuarios": viaje["usuarios"]})
    return True

def modificar_evento(viaje_id, tipo_evento, incremento=True):
    viaje = cargar_un_viaje(viaje_id)
    actual = viaje["usuarios"][USER_EMAIL]["eventos"].get(tipo_evento, 0)
    nuevo_valor = actual + 1 if incremento else max(0, actual - 1)
    
    viaje["usuarios"][USER_EMAIL]["eventos"][tipo_evento] = nuevo_valor
    actualizar_viaje(viaje_id, {"usuarios": viaje["usuarios"]})

# --- 7. IA CON LLAMA 3.3 ---

def generar_resumen_llm(viaje, categoria):
    from groq import Groq
    detalles = ""
    for ev_k, ev_v in CATEGORIAS[categoria]["eventos"].items():
        detalles += f"\n{ev_v['nombre']}: "
        for u_email, info in viaje["usuarios"].items():
            detalles += f"{info['nombre']} ({info['eventos'].get(ev_k, 0)}), "

    eventos = CATEGORIAS[categoria]["eventos"]
    # Prompt optimizado (Humor ácido pero sin "insultos graves" para evitar baneos)
    prompt = (
        f"Eres un cronista sarcástico y divertido. Escribe un párrafo breve (200 palabras) "
        f"sobre cada Evento '{eventos}' la categoría '{categoria}' en el viaje '{viaje['nombre']}'. "
        f"Usa un tono de 'roast' (humor ácido y picante). "
        f"Menciona quién es el líder indiscutible y quién ha dado vergüenza ajena por su bajo rendimiento. "
        f"Termina con una frase legendaria.")
    
    try:
        client = Groq(api_key=st.secrets["groq"]["key"])
        res = client.chat.completions.create(
            messages=[{"role": "system", "content": "Narrador de comedia en español."},
                      {"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.8
        )
        return res.choices[0].message.content
    except Exception as e:
        return f"Error en IA: {e}"

# --- 8. INTERFAZ ---

# Header con Logo y Título en la misma línea (Móvil OK)
st.markdown(f"""
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <img src="https://img.icons8.com/?size=100&id=3GPNVKXRHLb1&format=png&color=000000" width="50">
        <h1 style="margin: 0; font-size: 2rem; white-space: nowrap;">Gotita</h1>
    </div>
    """, unsafe_allow_html=True)

# Sidebar
with st.sidebar:
    st.write(f"👤 **{USER_NAME}**")
    if logout_button(): st.rerun()
    st.divider()
    page = st.radio("Menú:", ["🏠 Inicio", "✈️ Crear Viaje", "📋 Unirme", "📊 Mi Viaje", "📈 Reportes"])

if page == "🏠 Inicio":
    st.header(f"¡Hola, {USER_NAME.split()[0]}!")
    st.write("Gestiona tus viajes compartidos y mantén el conteo de eventos con tus amigos de forma automática.")

elif page == "✈️ Crear Viaje":
    st.header("Nuevo Viaje")
    nombre_v = st.text_input("Nombre del destino")
    seleccionadas = [cat for cat in CATEGORIAS if st.checkbox(f"{CATEGORIAS[cat]['emoji']} {cat}", value=True)]
    
    if st.button("Crear", type="primary"):
        if nombre_v and seleccionadas:
            v = crear_viaje(nombre_v, seleccionadas)
            st.success(f"¡Viaje creado! ID: {v['id']}")
        else: st.warning("Rellena todos los campos.")

elif page == "📋 Unirme":
    st.header("Unirse a un Viaje")
    activos = cargar_viajes_activos()
    if activos:
        viaje_sel = st.selectbox("Selecciona:", activos, format_func=lambda x: f"{x['nombre']} (ID: {x['id']})")
        if st.button("Unirme ahora"):
            añadir_usuario_a_viaje(viaje_sel)
            st.success("¡Te has unido correctamente!")
            st.balloons()
    else: st.info("No hay viajes activos.")

elif page == "📊 Mi Viaje":
    activos = cargar_viajes_activos()
    viajes_donde_estoy = [v for v in activos if USER_EMAIL in v["usuarios"]]
    
    if viajes_donde_estoy:
        v_obj = st.selectbox("Viaje actual:", viajes_donde_estoy, format_func=lambda x: x['nombre'])
        viaje = cargar_un_viaje(v_obj["id"])
        
        for cat in viaje["categorias"]:
            st.divider()
            st.subheader(f"{CATEGORIAS[cat]['emoji']} {cat}")
            evs = CATEGORIAS[cat]["eventos"]
            cols = st.columns(len(evs))
            for i, (ev_k, ev_v) in enumerate(evs.items()):
                with cols[i]:
                    valor = viaje["usuarios"][USER_EMAIL]["eventos"].get(ev_k, 0)
                    st.metric(ev_v["nombre"], valor)
                    c1, c2 = st.columns(2)
                    if c1.button(f"➕", key=f"add_{ev_k}"):
                        modificar_evento(viaje["id"], ev_k, True); st.rerun()
                    if c2.button(f"➖", key=f"sub_{ev_k}"):
                        modificar_evento(viaje["id"], ev_k, False); st.rerun()
        
        if USER_EMAIL == viaje["admin"]:
            if st.button("🏁 FINALIZAR VIAJE"):
                actualizar_viaje(viaje["id"], {"activo": False}); st.rerun()
    else: st.warning("No estás en ningún viaje activo.")

elif page == "📈 Reportes":
    st.header("📊 Estadísticas Finales")
    finalizados = cargar_viajes_finalizados()
    
    if finalizados:
        # Cargamos el viaje seleccionado y nos aseguramos de tener los datos más recientes
        v_f_pre = st.selectbox("Selecciona un viaje para ver los resultados:", finalizados, format_func=lambda x: x['nombre'])
        v_f = cargar_un_viaje(v_f_pre["id"]) 
        
        # 1. Preparación de datos base
        res = []
        for u, d in v_f["usuarios"].items():
            row = {"Usuario": u}
            row.update(d["eventos"])
            res.append(row)
        df_base = pd.DataFrame(res)

        st.subheader("🍰 Reparto del Pastel")

        # 2. Iterar por cada evento disponible en el viaje
        # Sacamos la lista de columnas que son eventos (todas menos 'Usuario')
        eventos_columnas = [col for col in df_base.columns if col != "Usuario"]

        import plotly.express as px

        for col_evento in eventos_columnas:
            # Buscamos el nombre amigable y emoji para el título
            nombre_label = col_evento
            for cat in CATEGORIAS.values():
                if col_evento in cat["eventos"]:
                    info = cat["eventos"][col_evento]
                    nombre_label = f"{info['emoji']} {info['nombre']}"
            
            st.markdown(f"#### {nombre_label}")
            
            # Creamos la fila: Columna izquierda (Tabla) y Columna derecha (Gráfico)
            # El ratio [1.5, 1] hace que la tabla sea un poco más ancha que el gráfico
            c_tabla, c_grafico = st.columns([1.5, 1])
            
            # Datos específicos del evento ordenados
            df_evento = df_base[["Usuario", col_evento]].sort_values(by=col_evento, ascending=False)
            
            # --- Dentro del bucle de eventos en Reportes ---
            with c_tabla:
                # Mostramos la tabla con configuración de columnas para ajustar tamaño
                st.dataframe(
                    df_evento, 
                    use_container_width=True, 
                    hide_index=True,
                    column_config={
                        "Usuario": st.column_config.TextColumn(
                            "Usuario",
                            width=100, # Puedes usar "small", "medium", o "large"
                        ),
                        col_evento: st.column_config.NumberColumn(
                            "Total",
                            format="%d",
                            width=50, # Esto estrecha la columna del número
                        )
                    }
                )
            
            with c_grafico:
                # Si todos los valores son 0, Plotly puede dar error, controlamos eso:
                if df_evento[col_evento].sum() > 0:
                    fig = px.pie(
                        df_evento, 
                        values=col_evento, 
                        names='Usuario',
                        hole=0.4,
                        color_discrete_sequence=px.colors.qualitative.Safe
                    )
                    # Ajustes para que el gráfico sea compacto y "pequeño"
                    fig.update_layout(
                        showlegend=False, 
                        margin=dict(t=0, b=0, l=0, r=0),
                        height=180 # Forzamos una altura pequeña
                    )
                    fig.update_traces(textinfo='percent') # Solo porcentaje para no saturar
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.write("No hay datos registrados 🚫")
            
            st.divider()

        # 3. Narrativa IA
        if st.button("🧠 Generar Narrativa", type="primary"):
            with st.spinner("La IA está analizando vuestros pecados..."):
                reportes = {}
                for cat in v_f["categorias"]:
                    reportes[cat] = generar_resumen_llm(v_f, cat)
                actualizar_viaje(v_f["id"], {"reporte_llm": reportes})
                st.rerun()
        
        if v_f.get("reporte_llm"):
            st.subheader("📝 Crónica del Viaje")
            for cat, texto in v_f["reporte_llm"].items():
                with st.expander(f"Crónica de {cat}", expanded=True):
                    st.write(texto)
    else:
        st.info("No hay viajes finalizados todavía.")



