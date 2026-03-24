import os
import streamlit as st
from datetime import datetime
from supabase import create_client, Client
import hashlib
import pandas as pd

# --- CONFIGURACIÓN DE LA APP ---
st.set_page_config(
    page_title="Gotita",
    page_icon="💧",
    layout="wide"
)

# Estilo CSS personalizado para botones grandes y diseño limpio
st.markdown("""
    <style>
    div.stButton > button {
        height: 3.5em;
        width: 100%;
        border-radius: 10px;
        font-size: 18px;
        font-weight: bold;
    }
    .stMetric {
        background-color: #f0f2f6;
        padding: 10px;
        border-radius: 10px;
    }
    </style>
    """, unsafe_allow_html=True)

# --- CONFIGURACIÓN DE SUPABASE ---
try:
    SUPABASE_URL = st.secrets["supabase"]["url"]
    SUPABASE_KEY = st.secrets["supabase"]["key"]
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    st.error(f"Error de configuración (Secrets/Conexión): {e}")
    st.stop()

# --- CONSTANTES ---
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

# --- FUNCIONES DE BASE DE DATOS (OPTIMIZADAS) ---

def cargar_un_viaje(viaje_id):
    """Carga solo un viaje específico para evitar tráfico innecesario."""
    res = supabase.table('viajes').select('*').eq('id', viaje_id).execute()
    return res.data[0] if res.data else None

def cargar_viajes_activos():
    res = supabase.table('viajes').select('*').eq('activo', True).execute()
    return res.data

def cargar_viajes_finalizados():
    res = supabase.table('viajes').select('*').eq('activo', False).execute()
    return res.data

def actualizar_viaje(viaje_id, campos):
    """Actualiza campos específicos de un viaje por ID."""
    try:
        supabase.table('viajes').update(campos).eq('id', viaje_id).execute()
        return True
    except Exception as e:
        st.error(f"Error al actualizar: {e}")
        return False

# --- LÓGICA DE NEGOCIO ---

def crear_viaje(nombre_viaje, admin_user, categorias_sel):
    nuevo_viaje = {
        "nombre": nombre_viaje,
        "admin": admin_user,
        "fecha_creacion": datetime.now().isoformat(),
        "activo": True,
        "categorias": categorias_sel,
        "usuarios": {},
        "reporte_llm": {}
    }
    res = supabase.table('viajes').insert(nuevo_viaje).execute()
    return res.data[0]

def añadir_usuario_a_viaje(viaje, nombre_usuario, password):
    if nombre_usuario in viaje["usuarios"]:
        return False
    
    hashed_pw = hashlib.sha256(password.encode()).hexdigest()
    eventos_init = {}
    for cat in viaje.get("categorias", []):
        if cat in CATEGORIAS:
            for ev_key in CATEGORIAS[cat]["eventos"]:
                eventos_init[ev_key] = 0
    
    nuevos_usuarios = viaje["usuarios"]
    nuevos_usuarios[nombre_usuario] = {
        "password": hashed_pw,
        "eventos": eventos_init
    }
    return actualizar_viaje(viaje["id"], {"usuarios": nuevos_usuarios})

def modificar_evento(viaje_id, usuario, tipo_evento, incremento=True):
    viaje = cargar_un_viaje(viaje_id)
    if not viaje or usuario not in viaje["usuarios"]:
        return False
    
    actual = viaje["usuarios"][usuario]["eventos"].get(tipo_evento, 0)
    nuevo_valor = actual + 1 if incremento else max(0, actual - 1)
    
    viaje["usuarios"][usuario]["eventos"][tipo_evento] = nuevo_valor
    return actualizar_viaje(viaje_id, {"usuarios": viaje["usuarios"]})

# --- INTEGRACIÓN IA (GROQ) ---

def generar_resumen_llm(viaje, categoria):
    from groq import Groq
    
    # Preparamos el ranking
    event_keys = list(CATEGORIAS[categoria]["eventos"].keys())
    ranking = []
    for user, info in viaje["usuarios"].items():
        total = sum(info["eventos"].get(k, 0) for k in event_keys)
        ranking.append(f"- {user}: Total {total}")
    
    ranking_str = "\n".join(ranking)
    
    # Prompt optimizado (Humor ácido pero sin "insultos graves" para evitar baneos)
    prompt = (
        f"Eres un cronista sarcástico y divertido. Escribe un párrafo breve (60 palabras) "
        f"sobre la categoría '{categoria}' en el viaje '{viaje['nombre']}'. "
        f"Usa un tono de 'roast' (humor ácido y picante). "
        f"Menciona quién es el líder indiscutible y quién ha dado vergüenza ajena por su bajo rendimiento. "
        f"No uses nombres reales si no quieres, usa los datos: \n{ranking_str}\n "
        f"Termina con una frase legendaria."
    )

    try:
        api_key = st.secrets["groq"]["key"]
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Eres un narrador de comedias tipo 'Roast' en español."},
                {"role": "user", "content": prompt}
            ],
            model="llama3-8b-8192",
            temperature=0.8
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"La IA se ha quedado sin palabras (Error): {e}"

# --- INTERFAZ STREAMLIT ---
# Título principal
#st.image("https://img.icons8.com/?size=100&id=3GPNVKXRHLb1&format=png&color=000000", width=100)
#st.title("💧 Gotita")

# Creamos dos columnas. El ratio [0.2, 1] hace que la primera sea pequeña para la imagen
col_logo, col_titulo = st.columns([0.2, 1])

with col_logo:
    st.image("https://img.icons8.com/?size=100&id=3GPNVKXRHLb1&format=png&color=000000", width=80)

with col_titulo:
    # Añadimos un poco de espacio superior con HTML si quieres centrarlo perfectamente
    st.markdown("<h1 style='margin-top: -50px;'>Gotita</h1>", unsafe_allow_html=True)

st.sidebar.title("💧 Menú principal")
page = st.sidebar.radio("Ir a:", ["🏠 Inicio", "✈️ Crear Viaje", "📋 Unirme", "📊 Mi Viaje", "📈 Reportes"])

# Página: Inicio
if page == "🏠 Inicio":
    
    st.header("¡Bienvenido a Gotita!")
    st.info("Registra los hitos más... orgánicos de tus viajes con amigos.")
    
    st.write("""
    Esta aplicación te permite:
    - 🏖️ Crear viajes con tus amigos
    - 👥 Unirte a un viaje activo
    - 💧 Contar tus gotitas
    - 📊 Ver estadísticas finales del viaje
    
    **¿Cómo funciona?**
    1. Un admin crea un nuevo viaje
    2. Otros usuarios se unen al viaje
    3. Cada uno registra sus eventos (Cacas, Pises, ...)
    4. Al final del viaje, se generan las estadísticas
    """)


elif page == "✈️ Crear Viaje":
    st.header("Crear Nuevo Viaje")
    nombre_v = st.text_input("Nombre del viaje")
    admin_v = st.text_input("Tu nombre (Admin)")
    
    st.write("Categorías:")
    c_cols = st.columns(len(CATEGORIAS))
    seleccionadas = []
    for i, (cat_n, cat_i) in enumerate(CATEGORIAS.items()):
        if c_cols[i].checkbox(f"{cat_i['emoji']} {cat_n}", value=True):
            seleccionadas.append(cat_n)
            
    if st.button("Crear Viaje", type="primary"):
        if nombre_v and admin_v and seleccionadas:
            v = crear_viaje(nombre_v, admin_v, seleccionadas)
            st.success(f"¡Viaje '{v['nombre']}' creado! ID: {v['id']}")
        else:
            st.warning("Faltan datos.")

elif page == "📋 Unirme":
    st.header("Únete a la aventura")
    activos = cargar_viajes_activos()
    if activos:
        viaje_sel = st.selectbox("Viaje:", activos, format_func=lambda x: f"{x['nombre']} (ID: {x['id']})")
        u_name = st.text_input("Tu nombre")
        u_pass = st.text_input("Contraseña", type="password")
        if st.button("Unirme"):
            if añadir_usuario_a_viaje(viaje_sel, u_name, u_pass):
                st.success("¡Bienvenido al equipo!")
                st.balloons()
            else:
                st.error("Nombre ya en uso o error de conexión.")
    else:
        st.warning("No hay viajes activos.")

elif page == "📊 Mi Viaje":
    activos = cargar_viajes_activos()
    if activos:
        v_obj = st.selectbox("Selecciona viaje:", activos, format_func=lambda x: x['nombre'])
        viaje = cargar_un_viaje(v_obj["id"]) # Recarga fresca
        
        user_list = list(viaje["usuarios"].keys())
        if user_list:
            usuario = st.selectbox("¿Quién eres?", user_list)
            
            # Login simple con session_state
            login_key = f"auth_{viaje['id']}_{usuario}"
            if login_key not in st.session_state:
                st.session_state[login_key] = False
            
            if not st.session_state[login_key]:
                pw_input = st.text_input("Contraseña:", type="password")
                if st.button("Entrar"):
                    if hashlib.sha256(pw_input.encode()).hexdigest() == viaje["usuarios"][usuario]["password"]:
                        st.session_state[login_key] = True
                        st.rerun()
                    else:
                        st.error("Incorrecta.")
            else:
                st.subheader(f"Panel de {usuario}")
                for cat in viaje["categorias"]:
                    st.divider()
                    st.write(f"### {CATEGORIAS[cat]['emoji']} {cat}")
                    evs = CATEGORIAS[cat]["eventos"]
                    cols = st.columns(len(evs))
                    for i, (ev_k, ev_v) in enumerate(evs.items()):
                        with cols[i]:
                            cant = viaje["usuarios"][usuario]["eventos"].get(ev_k, 0)
                            st.metric(ev_v["nombre"], cant)
                            c1, c2 = st.columns(2)
                            if c1.button(f"➕ {ev_v['emoji']}", key=f"add_{ev_k}"):
                                modificar_evento(viaje["id"], usuario, ev_k, True)
                                st.rerun()
                            if c2.button(f"➖", key=f"sub_{ev_k}"):
                                modificar_evento(viaje["id"], usuario, ev_k, False)
                                st.rerun()
                
                if usuario == viaje["admin"]:
                    if st.button("🏁 FINALIZAR VIAJE", type="secondary"):
                        actualizar_viaje(viaje["id"], {"activo": False, "fecha_finalizacion": datetime.now().isoformat()})
                        st.rerun()
        else:
            st.info("Aún no hay usuarios.")
    else:
        st.warning("Nada por aquí.")

# --- "📈 Reportes": ---

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
                            width="small", # Puedes usar "small", "medium", o "large"
                        ),
                        col_evento: st.column_config.NumberColumn(
                            "Total",
                            format="%d",
                            width="small", # Esto estrecha la columna del número
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
        if st.button("🧠 Generar Narrativa con IA", type="primary"):
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