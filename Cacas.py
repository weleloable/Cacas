import streamlit as st
from supabase import create_client, Client, ClientOptions
from datetime import datetime
import pandas as pd
import plotly.express as px
import urllib.parse
import random
import string
import time
import extra_streamlit_components as stx  # <--- NUEVA LIBRERÍA

# --- 1. CONFIGURACIÓN DE LA APP ---
st.set_page_config(page_title="Gotita", page_icon="💧", layout="wide")
# Inicializamos el gestor de cookies
cookie_manager = stx.CookieManager()


# Estilo CSS mejorado (Sin fondo fijo en Metric para evitar errores en modo oscuro)
st.markdown("""
    <style>
    /* Estilo para botones */
    div.stButton > button { 
        height: 3.5em; 
        width: 100%; 
        border-radius: 10px; 
        font-weight: bold; 
    }
    
    /* Estilo para las métricas (ajustado para modo oscuro/claro) */
    [data-testid="stMetric"] {
        padding: 15px;
        border-radius: 10px;
        border: 1px solid rgba(128, 128, 128, 0.2); /* Un borde sutil en lugar de fondo fijo */
    }

    /* Opcional: Si quieres que el texto de la métrica sea siempre legible */
    [data-testid="stMetricValue"] {
        font-size: 1.8rem !important;
    }
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

# --- 3. GESTIÓN DE SESIÓN CON COOKIES ---
# Intentamos leer la cookie "gotita_user_id" del navegador
saved_user_id = cookie_manager.get(cookie="gotita_user_id")

if "user" not in st.session_state:
    st.session_state.user = None
# Si hay una cookie pero no está en el session_state, la recuperamos
if saved_user_id and st.session_state.user is None:
    # Opcional: Podrías buscar al usuario en la DB, pero por ahora
    # asumimos que si tiene la cookie, es que se logueó.
    st.session_state.user = saved_user_id

# --- DIAGNÓSTICO (Puedes borrar esto cuando funcione) ---
with st.sidebar:
    if st.session_state.user:
        st.write(f"✅ Sesión activa: {st.session_state.user}")
    else:
        st.write("🔒 No hay sesión iniciada")

# --- 3.1. PANTALLA DE AUTENTICACIÓN ---

if st.session_state.user is None:
    st.title("💧 Gotita")
    st.subheader("Login del Viaje")
    
    tab_login, tab_signup = st.tabs(["🔑 Entrar y recordar", "📝 Registrarse"])
    
    with tab_login:
        with st.form("l_form"):
            email_input = st.text_input("Email")
            pw_input = st.text_input("Contraseña", type="password")
            submit_l = st.form_submit_button("Iniciar Sesión", type="primary")
            
            if submit_l:
                try:
                    res = supabase.auth.sign_in_with_password({"email": email_input, "password": pw_input})
                    if res.user:
                        # ✅ GUARDAMOS LA COOKIE (Dura 30 días)
                        cookie_manager.set("gotita_user_id", res.user.id, expires_at=None)
                        st.session_state.user = res.user.id
                        st.success("¡Login correcto!")
                        st.rerun()
                except:
                    st.error("Datos incorrectos")
    st.stop()

# --- 3.2. LOGUEADO: DATOS DE USUARIO ---
curr_user = st.session_state.user
USER_ID = curr_user
USER_NAME = curr_user.user_metadata.get('full_name', curr_user.email)

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
def generar_codigo_viaje():
    # Genera un código tipo ABC-123
    letras = ''.join(random.choices(string.ascii_uppercase, k=3))
    numeros = ''.join(random.choices(string.digits, k=3))
    return f"{letras}-{numeros}"

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

def crear_viaje(nombre_viaje, categorias_sel, codigo_nuevo):
    nuevo_viaje = {
        "nombre": nombre_viaje,
        "admin": USER_NAME, # El admin es el email de Google
        "fecha_creacion": datetime.now().isoformat(),
        "activo": True,
        "categorias": categorias_sel,
        "usuarios": {
            USER_NAME: {
                "nombre": USER_NAME,
                "eventos": {ev: 0 for cat in categorias_sel for ev in CATEGORIAS[cat]["eventos"]}
            }
        },
        "codigo": codigo_nuevo, # Guardamos el código
        "reporte_llm": {}
    }
    res = supabase.table('viajes').insert(nuevo_viaje).execute()
    return res.data[0]

def cargar_datos():
    """Carga los datos desde Supabase"""
    try:
        response = supabase.table('viajes').select('*').execute()
        return {"viajes": response.data}
    except Exception as e:
        st.error(f"Error cargando datos: {e}")
        return {"viajes": []}

def guardar_datos(datos):
    """Guarda los datos en Supabase"""
    try:
        # Upsert cada viaje
        for viaje in datos["viajes"]:
            supabase.table('viajes').upsert(viaje).execute()
    except Exception as e:
        st.error(f"Error guardando datos: {e}")

def añadir_usuario_a_viaje(viaje):
    if USER_NAME in viaje["usuarios"]:
        return True # Ya está dentro
    
    eventos_init = {}
    for cat in viaje.get("categorias", []):
        for ev_key in CATEGORIAS[cat]["eventos"]:
            eventos_init[ev_key] = 0
    
    viaje["usuarios"][USER_NAME] = {
        "nombre": USER_NAME,
        "eventos": eventos_init
    }
    actualizar_viaje(viaje["id"], {"usuarios": viaje["usuarios"]})
    return True

def modificar_evento(viaje_id, tipo_evento, incremento=True):
    viaje = cargar_un_viaje(viaje_id)
    actual = viaje["usuarios"][USER_NAME]["eventos"].get(tipo_evento, 0)
    nuevo_valor = actual + 1 if incremento else max(0, actual - 1)
    
    viaje["usuarios"][USER_NAME]["eventos"][tipo_evento] = nuevo_valor
    actualizar_viaje(viaje_id, {"usuarios": viaje["usuarios"]})

def registrar_evento(viaje_id, usuario, tipo_evento):
    """Registra un evento (caca o pis) para un usuario en un viaje"""
    datos = cargar_datos()
    for viaje in datos["viajes"]:
        if viaje["id"] == viaje_id:
            if usuario in viaje["usuarios"]:
                viaje["usuarios"][usuario]["eventos"][tipo_evento] += 1
                guardar_datos(datos)
                return True
    return False

def eliminar_evento(viaje_id, usuario, tipo_evento):
    """Elimina un evento (caca o pis) para un usuario en un viaje"""
    datos = cargar_datos()
    for viaje in datos["viajes"]:
        if viaje["id"] == viaje_id:
            if usuario in viaje["usuarios"]:
                # No permite que baje de 0
                if viaje["usuarios"][usuario]["eventos"][tipo_evento] > 0:
                    viaje["usuarios"][usuario]["eventos"][tipo_evento] -= 1
                    guardar_datos(datos)
                    return True
    return False

def finalizar_viaje(viaje_id):
    """Finaliza un viaje y genera el reporte final"""
    datos = cargar_datos()
    for viaje in datos["viajes"]:
        if viaje["id"] == viaje_id:
            viaje["activo"] = False
            viaje["fecha_finalizacion"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            guardar_datos(datos)
            return viaje
    return None

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
    if st.button("Cerrar Sesión"):
        supabase.auth.sign_out()
        st.session_state.user = None
        st.rerun()
    st.divider()
    page = st.radio("Menú:", ["🏠 Inicio", "✈️ Crear Viaje", "📋 Unirme", "📊 Mi Viaje", "📈 Reportes"])

    st.write(f"Estado de Session State: {'Lleno' if st.session_state.user else 'Vacío'}")
    # Esto nos dirá si Supabase detecta algo en el navegador
    try:
        check_auth = supabase.auth.get_session()
        st.write(f"Supabase detecta sesión: {'SÍ' if check_auth.session else 'NO'}")
    except:
        st.write("Error al consultar Supabase")
if page == "🏠 Inicio":
    st.header(f"¡Hola, {USER_NAME.split()[0]}! ¡Bienvenido a Gotita!")
    st.write("""
    Esta aplicación te permite:
    - 🏖️ Crear viajes con tus amigos
    - 👥 Registrarte en un viaje activo
    - 💧 Contar tus gotitas
    - 📊 Ver estadísticas finales del viaje
    
    **¿Cómo funciona?**
    1. Un admin crea un nuevo viaje
    2. Otros usuarios se unen al viaje
    3. Cada uno registra sus eventos (Cacas, Pises, ...)
    4. Al final del viaje, se generan las estadísticas
    """)

elif page == "✈️ Crear Viaje":
    st.header("Nuevo Viaje")
    nombre_v = st.text_input("Nombre del destino")
    seleccionadas = [cat for cat in CATEGORIAS if st.checkbox(f"{CATEGORIAS[cat]['emoji']} {cat}", value=True)]
    
    if st.button("Crear", type="primary"):
        if nombre_v and seleccionadas:
            codigo_nuevo = generar_codigo_viaje() # Generamos el código único
            v = crear_viaje(nombre_v, seleccionadas, codigo_nuevo)
            st.success(f"¡Viaje creado! ID: {v['id']}")
            st.code(f"Código para compartir: {codigo_nuevo}", language="text")
            st.info("Copia este código y pásaselo a tus amigos para que se unan.")
        else: st.warning("Rellena todos los campos.")

elif page == "📋 Unirme":
    st.header("Unirse a un Viaje")
    st.write("Introduce el código que te ha pasado el administrador del viaje.")
    codigo_input = st.text_input("Código del Viaje (ej: ABC-123)").upper().strip()

    if st.button("Buscar y Unirme"):
        if codigo_input:
            # Buscamos en Supabase el viaje que tenga ese código y esté activo
            res = supabase.table('viajes').select('*').eq('codigo', codigo_input).eq('activo', True).execute()
            
            if res.data:
                viaje_encontrado = res.data[0]
                
                # Intentamos añadir al usuario
                exito = añadir_usuario_a_viaje(viaje_encontrado)
                if exito:
                    st.success(f"¡Te has unido a **{viaje_encontrado['nombre']}**!")
                    st.balloons()
            else:
                st.error("Código no encontrado o el viaje ya ha finalizado. Revisa que esté bien escrito.")
        else:
            st.warning("Escribe un código primero.")

elif page == "📊 Mi Viaje":
    activos = cargar_viajes_activos()
    viajes_donde_estoy = [v for v in activos if USER_NAME in v["usuarios"]]
    
    if viajes_donde_estoy:
        v_obj = st.selectbox("Viaje actual:", viajes_donde_estoy, format_func=lambda x: x['nombre'])
        viaje = cargar_un_viaje(v_obj["id"])
        
        # Usuario logueado, mostrar eventos
        st.subheader(f"Gotitas de {USER_NAME}")

        # Mostrar eventos dinámicamente según las categorías
        categorias = viaje.get("categorias", ["Cacas"])

        for categoria in categorias:
            if categoria in CATEGORIAS:
                st.subheader(f"{CATEGORIAS[categoria]['emoji']} {categoria}")

                eventos = CATEGORIAS[categoria]["eventos"]
                num_eventos = len(eventos)
                cols = st.columns(num_eventos)

                for idx, (evento_key, evento_info) in enumerate(eventos.items()):
                    with cols[idx]:
                        contador = viaje["usuarios"][USER_NAME]["eventos"].get(evento_key, 0)
                        st.write(f"**{evento_info['emoji']} {evento_info['nombre']}**")
                        row_cols = st.columns([1, 1, 1])
                        with row_cols[0]:
                            st.metric("Cantidad", contador)
                        with row_cols[1]:
                            if st.button(f"{evento_info['emoji']}", use_container_width=True, key=f"btn_add_{evento_key}"):
                                registrar_evento(viaje["id"], USER_NAME, evento_key)
                                st.rerun()
                        with row_cols[2]:
                            if contador > 0:
                                if st.button(f"🗑️ {evento_info['emoji']}", use_container_width=False, key=f"btn_del_{evento_key}"):
                                    eliminar_evento(viaje["id"], USER_NAME, evento_key)
                                    st.rerun()

        st.divider()

        # Admin controls - Solo el usuario admin puede finalizar
        if USER_NAME == viaje["admin"]:
            st.subheader("⚙️ Controles de Admin")
            st.sidebar.info(f"🔑 Código del viaje: **{viaje['codigo']}**")
            st.info(f"Eres el admin de este viaje. Solo tú puedes finalizarlo.")
            if st.button("🏁 Finalizar Viaje", type="secondary"):
                finalizar_viaje(viaje["id"])
                st.success("Viaje finalizado. Ve a Reportes para ver las estadísticas.")
                st.rerun()
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



