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

st.sidebar.title("💩 Menú")
page = st.sidebar.radio("Ir a:", ["🏠 Inicio", "✈️ Crear Viaje", "📋 Unirme", "📊 Mi Viaje", "📈 Reportes"])

if page == "🏠 Inicio":
    st.header("¡Bienvenido a Gotita!")
    st.info("Registra los hitos más... orgánicos de tus viajes con amigos.")
    st.image("https://img.icons8.com/emoji/96/000000/pile-of-poo.png", width=100)

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

elif page == "📈 Reportes":
    st.header("Estadísticas Finales")
    finalizados = cargar_viajes_finalizados()
    if finalizados:
        v_f = st.selectbox("Viaje finalizado:", finalizados, format_func=lambda x: x['nombre'])
        
        # Tabla de datos
        res = []
        for u, d in v_f["usuarios"].items():
            row = {"Usuario": u}
            row.update(d["eventos"])
            res.append(row)
        df = pd.DataFrame(res)
        
        st.dataframe(df, use_container_width=True, hide_index=True)
        
        # Gráfico rápido
        st.bar_chart(df.set_index("Usuario"))

        if st.button("🧠 Generar Narrativa con IA", type="primary"):
            with st.spinner("La IA está analizando vuestros registros..."):
                reportes = {}
                for cat in v_f["categorias"]:
                    reportes[cat] = generar_resumen_llm(v_f, cat)
                actualizar_viaje(v_f["id"], {"reporte_llm": reportes})
                st.rerun()
        
        if v_f.get("reporte_llm"):
            st.subheader("Crónica del Viaje")
            for cat, texto in v_f["reporte_llm"].items():
                with st.expander(f"Resumen de {cat}", expanded=True):
                    st.write(texto)
    else:
        st.info("No hay reportes disponibles.")