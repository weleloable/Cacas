import os
import streamlit as st
from datetime import datetime
from supabase import create_client, Client
import hashlib

# Integración opcional con OpenAI (ChatGPT / Gemini compatibles vía API OpenAI)
try:
    import openai
except ImportError:
    openai = None

#EAM probando push desde vscode a github para ver si se actualiza el proyecto en streamlit cloud 

# Estilo CSS para botones y tablas compactas
st.markdown("""
    <style>
    div.stButton > button { height: 3.5em; width: 100%; border-radius: 10px; font-weight: bold; }
    .stMetric { background-color: #f0f2f6; padding: 10px; border-radius: 10px; }
    .stDataFrame td, .stDataFrame th { padding: 2px 5px !important; font-size: 14px; }
    </style>
    """, unsafe_allow_html=True)

# Configuración de Supabase
try:
    SUPABASE_URL = st.secrets["supabase"]["url"]
    SUPABASE_KEY = st.secrets["supabase"]["key"]
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except KeyError:
    st.error("Configura las secrets de Supabase en Streamlit Cloud o localmente.")
    st.stop()
except Exception as e:
    st.error(f"Error conectando a Supabase: {e}")
    st.stop() 

# Configuración de la app
st.set_page_config(
    page_title="Cacas y Pises",
    page_icon="💩",
    layout="wide"
)

# Definición de categorías y eventos
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

# Funciones auxiliares
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

def crear_viaje(nombre_viaje, admin_user, categorias_seleccionadas):
    """Crea un nuevo viaje con categorías específicas"""
    datos = cargar_datos()
    nuevo_viaje = {
        "id": len(datos["viajes"]) + 1,
        "nombre": nombre_viaje,
        "admin": admin_user,
        "fecha_creacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "activo": True,
        "categorias": categorias_seleccionadas,
        "usuarios": {}
    }
    datos["viajes"].append(nuevo_viaje)
    guardar_datos(datos)
    return nuevo_viaje

def obtener_viaje_activo():
    """Obtiene el viaje activo actual"""
    datos = cargar_datos()
    for viaje in datos["viajes"]:
        if viaje["activo"]:
            return viaje
    return None

def añadir_usuario_a_viaje(viaje_id, nombre_usuario, password):
    """Añade un usuario a un viaje específico con los eventos según las categorías y establece una contraseña"""
    datos = cargar_datos()
    for viaje in datos["viajes"]:
        if viaje["id"] == viaje_id:
            if nombre_usuario not in viaje["usuarios"]:
                # Hash de la contraseña
                hashed_password = hashlib.sha256(password.encode()).hexdigest()

                # Inicializar eventos según las categorías del viaje
                eventos_usuario = {}
                for categoria in viaje.get("categorias", ["Cacas"]):
                    if categoria in CATEGORIAS:
                        for evento_key in CATEGORIAS[categoria]["eventos"]:
                            eventos_usuario[evento_key] = 0

                viaje["usuarios"][nombre_usuario] = {
                    "password": hashed_password,
                    "eventos": eventos_usuario
                }
            guardar_datos(datos)
            return True
    return False

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

def obtener_api_key_groq():
    # Configurar en st.secrets o env var
    if isinstance(st.secrets.get("groq"), dict):
        return st.secrets["groq"].get("key")
    return os.getenv("GROQ_API_KEY")


def generar_ranking_categoria(viaje, categoria):
    event_keys = list(CATEGORIAS.get(categoria, {}).get("eventos", {}).keys())
    ranking = []

    for usuario, info in viaje.get("usuarios", {}).items():
        total_cat = sum(info.get("eventos", {}).get(k, 0) for k in event_keys)
        ranking.append({
            "usuario": usuario,
            "total": total_cat,
            "detalles": {k: info.get("eventos", {}).get(k, 0) for k in event_keys}
        })

    ranking.sort(key=lambda x: x["total"], reverse=True)
    return ranking


def generar_prompt_resumen(viaje, categoria, ranking):
    if not ranking:
        return "Sin datos suficientes para generar un resumen."

    viaje_nombre = viaje.get("nombre", "este viaje")
    texto_evento = CATEGORIAS.get(categoria, {}).get("eventos", {})
    evento_lista = ", ".join([evt.get("nombre", k) for k, evt in texto_evento.items()])

    top1 = ranking[0]
    top2 = ranking[1] if len(ranking) > 1 else None
    ultimo = ranking[-1]

    prompt = (
        f"Eres un narrador divertido y graciosete. En español escribe un párrafo breve (50-100 palabras) "
        f"para el reporte de viaje '{viaje_nombre}' en la categoría '{categoria}', incluyendo cada evento: {evento_lista}. "
        f"Menciona claramente al líder (más alto) y al último (más bajo), con humor suave. "
        f"Utiliza humor ácido. sarcasmo picante y lenguaje ofensivo. "
        f"Menciona claramente al líder (más alto) y al último (más bajo), con humor picante. "
        f"Ejemplo: 'En la categoría {categoria}, el más cagon del viaje...' "
        f"No incluyas nombres presentes en los datos y un remate final estilo 'que la próxima aventura sea aún más legendaria'.\n\n"
    )

    prompt += "Datos por usuario:\n"
    for item in ranking:
        details = ", ".join([f"{k}: {v}" for k, v in item["detalles"].items()])
        prompt += f"- {item['usuario']}: total {item['total']} ({details})\n"

    return prompt


# Integración con Groq (gratuito online)
try:
    from groq import Groq
except ImportError:
    Groq = None


def generar_resumen_local(prompt):
    if pipeline is None:
        return "No disponible: instala transformers y torch para usar modelo local."

    # Usar T5 para mejor generación de texto coherente
    modelo = "t5-small"
    try:
        gen = pipeline(
            "text2text-generation",
            model=modelo,
            device=-1,
            max_length=150,
            do_sample=True,
            temperature=0.8,
            top_p=0.9,
        )
        # T5 espera input formateado, pero para generación libre, usar directamente
        salida = gen(prompt, max_length=150, num_return_sequences=1)
        texto = salida[0]["generated_text"].strip()

        # Limpiar si repite partes del prompt
        if "Por favor, asegúrate" in texto:
            texto = texto.split("Por favor, asegúrate")[0].strip()

        return texto
    except Exception as e:
        # Fallback a GPT-2 si T5 falla
        try:
            gen = pipeline(
                "text-generation",
                model="sshleifer/tiny-gpt2",
                device=-1,
                do_sample=True,
                temperature=0.7,
                top_p=0.95,
                return_full_text=False,
            )
            prompt_corto = prompt[:500]  # Limitar prompt para evitar repetición
            salida = gen(prompt_corto, max_new_tokens=80, num_return_sequences=1)
            texto = salida[0]["generated_text"].strip()
            if "Por favor, asegúrate" in texto:
                texto = texto.split("Por favor, asegúrate")[0].strip()
            return texto
        except Exception as e2:
            return f"Error generando texto local: {e} | fallback: {e2}"


def generar_resumen_llm(viaje, categoria, ranking):
    """Genera texto usando Groq (gratuito online)."""
    prompt = generar_prompt_resumen(viaje, categoria, ranking)

    api_key = obtener_api_key_groq()
    if not api_key or Groq is None:
        return "Configura GROQ_API_KEY en st.secrets o env var, e instala groq."

    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "Eres un narrador divertido y respetuoso. Genera texto en español."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama3-8b-8192",  # Modelo gratuito en Groq
            max_tokens=200,
            temperature=0.8
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Error con Groq: {e}"


# Título principal
st.title("💧 Gotita")
#st.write("Controla los eventos de tu viaje de forma divertida")

# Sidebar para navegación
page = st.sidebar.radio(
    "Menú Principal",
    ["🏠 Inicio", "✈️ Crear Viaje", "📋 Unirse a Viaje", "📊 Mi Viaje", "📈 Reportes"]
)

# Página: Inicio
if page == "🏠 Inicio":
    st.header("¡Bienvenido a Gotita!")
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

# Página: Crear Viaje
elif page == "✈️ Crear Viaje":
    st.header("Crear Nuevo Viaje")

    col1, col2 = st.columns(2)
    with col1:
        nombre_viaje = st.text_input("Nombre del viaje:", placeholder="Ej: Viaje a Cancún")
        nombre_admin = st.text_input("Tu nombre (Admin):", placeholder="Ej: Juan")

    st.subheader("Selecciona las categorías que aplican en este viaje:")
    categorias_seleccionadas = []
    cols = st.columns(len(CATEGORIAS))

    for i, (categoria_nombre, categoria_info) in enumerate(CATEGORIAS.items()):
        with cols[i]:
            if st.checkbox(f"{categoria_info['emoji']} {categoria_nombre}", value=True, key=f"cat_{categoria_nombre}"):
                categorias_seleccionadas.append(categoria_nombre)

    if st.button("Crear Viaje", type="primary", use_container_width=True):
        if nombre_viaje and nombre_admin:
            if not categorias_seleccionadas:
                st.error("Por favor selecciona al menos una categoría")
            else:
                viaje = crear_viaje(nombre_viaje, nombre_admin, categorias_seleccionadas)
                st.success(f"✅ ¡Viaje '{nombre_viaje}' creado exitosamente!")
                st.info(f"ID del viaje: {viaje['id']} - Comparte este viaje con tus amigos")
        else:
            st.error("Por favor completa todos los campos")

# Página: Unirse a Viaje
elif page == "📋 Unirse a Viaje":
    st.header("Unirse a un Viaje")

    datos = cargar_datos()
    viajes_activos = [v for v in datos["viajes"] if v["activo"]]

    if viajes_activos:
        col1, col2 = st.columns(2)
        with col1:
            viaje_seleccionado = st.selectbox(
                "Selecciona un viaje activo:",
                options=viajes_activos,
                format_func=lambda x: f"{x['nombre']} (ID: {x['id']}) - Admin: {x['admin']}"
            )

        with col2:
            nombre_usuario = st.text_input("Tu nombre:", placeholder="Ej: María")
            password = st.text_input("Contraseña:", type="password", placeholder="Crea una contraseña")

        if st.button("Unirme al Viaje", type="primary", use_container_width=True):
            if nombre_usuario and password:
                if añadir_usuario_a_viaje(viaje_seleccionado["id"], nombre_usuario, password):
                    st.success(f"✅ ¡Te has unido al viaje '{viaje_seleccionado['nombre']}'!")
                    st.balloons()
                else:
                    st.error("Error al unirse al viaje o usuario ya existe")
            else:
                st.error("Por favor ingresa tu nombre y una contraseña")
    else:
        st.warning("No hay viajes activos. ¡Crea uno primero!")

# Página: Mi Viaje
elif page == "📊 Mi Viaje":
    st.header("Mi Viaje - Registrar Gotitas")

    datos = cargar_datos()
    viajes_activos = [v for v in datos["viajes"] if v["activo"]]

    if viajes_activos:
        # Mantener la selección de viaje en session_state
        if 'selected_viaje_id' not in st.session_state:
            st.session_state.selected_viaje_id = viajes_activos[0]["id"]
        if 'selected_usuario' not in st.session_state:
            st.session_state.selected_usuario = None

        viaje_obj = st.selectbox(
            "Selecciona tu viaje:",
            options=viajes_activos,
            format_func=lambda x: f"{x['nombre']} (ID: {x['id']})",
            index=next((i for i, v in enumerate(viajes_activos) if v['id'] == st.session_state.selected_viaje_id), 0),
            key="viaje_select"
        )

        # Actualizar session_state con el viaje seleccionado
        st.session_state.selected_viaje_id = viaje_obj["id"]

        # Recargar datos para obtener el viaje actualizado
        viaje = next((v for v in datos["viajes"] if v["id"] == viaje_obj["id"]), None)

        if viaje and viaje["usuarios"]:
            # Inicializar session_state para logins
            if 'logged_in' not in st.session_state:
                st.session_state.logged_in = {}

            # Mantener la selección de usuario en session_state
            if st.session_state.selected_usuario not in viaje["usuarios"]:
                st.session_state.selected_usuario = list(viaje["usuarios"].keys())[0]

            usuario = st.selectbox(
                "Selecciona tu usuario:",
                options=list(viaje["usuarios"].keys()),
                index=list(viaje["usuarios"].keys()).index(st.session_state.selected_usuario) if st.session_state.selected_usuario in viaje["usuarios"] else 0,
                key="usuario_select"
            )

            # Actualizar session_state con el usuario seleccionado
            st.session_state.selected_usuario = usuario

            # Verificar si el usuario está logueado para este viaje
            viaje_key = f"{viaje['id']}_{usuario}"
            if st.session_state.logged_in.get(viaje_key, False):
                # Usuario logueado, mostrar eventos
                st.subheader(f"Gotitas de {usuario}")

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
                                contador = viaje["usuarios"][usuario]["eventos"].get(evento_key, 0)
                                st.write(f"**{evento_info['emoji']} {evento_info['nombre']}**")
                                row_cols = st.columns([1, 1, 1])
                                with row_cols[0]:
                                    st.metric("Cantidad", contador)
                                with row_cols[1]:
                                    if st.button(f"{evento_info['emoji']}", use_container_width=True, key=f"btn_add_{evento_key}"):
                                        registrar_evento(viaje["id"], usuario, evento_key)
                                        st.rerun()
                                with row_cols[2]:
                                    if contador > 0:
                                        if st.button(f"🗑️ {evento_info['emoji']}", use_container_width=False, key=f"btn_del_{evento_key}"):
                                            eliminar_evento(viaje["id"], usuario, evento_key)
                                            st.rerun()

                st.divider()

                # Admin controls - Solo el usuario admin puede finalizar
                if usuario == viaje["admin"]:
                    st.subheader("⚙️ Controles de Admin")
                    st.info(f"Eres el admin de este viaje. Solo tú puedes finalizarlo.")
                    if st.button("🏁 Finalizar Viaje", type="secondary"):
                        finalizar_viaje(viaje["id"])
                        st.success("Viaje finalizado. Ve a Reportes para ver las estadísticas.")
                        st.rerun()
            else:
                # Pedir contraseña
                st.subheader(f"Autenticación para {usuario}")
                password_input = st.text_input("Ingresa tu contraseña:", type="password", key=f"password_{viaje_key}")
                if st.button("Iniciar Sesión", key=f"login_{viaje_key}"):
                    hashed_input = hashlib.sha256(password_input.encode()).hexdigest()
                    if hashed_input == viaje["usuarios"][usuario]["password"]:
                        st.session_state.logged_in[viaje_key] = True
                        st.success("¡Sesión iniciada! Recarga la página para ver tus eventos.")
                        st.rerun()
                    else:
                        st.error("Contraseña incorrecta")
        else:
            st.warning("No hay usuarios registrados en este viaje")
    else:
        st.warning("No hay viajes activos")

# Página: Reportes
elif page == "📈 Reportes":
    st.header("Reportes Finales")

    datos = cargar_datos()
    viajes_finalizados = [v for v in datos["viajes"] if not v["activo"]]

    if viajes_finalizados:
        viaje = st.selectbox(
            "Selecciona un viaje finalizado:",
            options=viajes_finalizados,
            format_func=lambda x: f"{x['nombre']} (Finalizado: {x.get('fecha_finalizacion', 'N/A')})"
        )

        st.subheader(f"Reporte Final - {viaje['nombre']}")
        st.write(f"**Admin:** {viaje['admin']}")
        st.write(f"**Creado:** {viaje['fecha_creacion']}")
        st.write(f"**Finalizado:** {viaje.get('fecha_finalizacion', 'N/A')}")

        st.divider()

        # Crear tabla de resultados
        import pandas as pd

        resultados = []
        for usuario, data in viaje["usuarios"].items():
            resultado_usuario = {"Usuario": usuario}
            resultado_usuario.update(data["eventos"])
            resultados.append(resultado_usuario)

        # Mostrar tablas dinámicamente según las categorías
        categorias = viaje.get("categorias", ["Cacas"])

        # Crear columnas para mostrar las tablas lado a lado
        cols_count = len(categorias)
        cols = st.columns(cols_count)

        for idx, categoria in enumerate(categorias):
            if categoria in CATEGORIAS:
                with cols[idx]:
                    st.subheader(f"{CATEGORIAS[categoria]['emoji']} TOTAL {categoria.upper()}")

                    # Crear tabla para esta categoría
                    eventos_keys = list(CATEGORIAS[categoria]["eventos"].keys())

                    # Si hay múltiples eventos en la categoría, mostrar una tabla por evento
                    if len(eventos_keys) > 1:
                        for evento_key in eventos_keys:
                            df_evento = pd.DataFrame(resultados)[["Usuario", evento_key]].copy()
                            df_evento = df_evento.sort_values(evento_key, ascending=False)
                            df_evento.columns = ["Usuario", CATEGORIAS[categoria]["eventos"][evento_key]["nombre"]]

                            evento_nombre = CATEGORIAS[categoria]["eventos"][evento_key]["nombre"]
                            evento_emoji = CATEGORIAS[categoria]["eventos"][evento_key]["emoji"]
                            st.write(f"**{evento_emoji} {evento_nombre}**")
                            st.dataframe(df_evento, use_container_width=False, hide_index=True)
                            st.write("")
                    else:
                        # Si solo hay un evento, mostrar una sola tabla
                        evento_key = eventos_keys[0]
                        df_evento = pd.DataFrame(resultados)[["Usuario", evento_key]].copy()
                        df_evento = df_evento.sort_values(evento_key, ascending=False)
                        df_evento.columns = ["Usuario", CATEGORIAS[categoria]["eventos"][evento_key]["nombre"]]
                        st.dataframe(df_evento, use_container_width=False, hide_index=True)

        # Generar resumen IA por categoría
        viaje_reporte_llm = viaje.get("reporte_llm", {}) if isinstance(viaje, dict) else {}
        if st.button("🧠 Generar resumen de este viaje", type="primary"):
            with st.spinner("Generando narrativa..."):
                if not isinstance(viaje_reporte_llm, dict):
                    viaje_reporte_llm = {}

                for categoria in categorias:
                    if categoria in CATEGORIAS:
                        try:
                            ranking = generar_ranking_categoria(viaje, categoria)
                            texto_categoria = generar_resumen_llm(viaje, categoria, ranking)
                            viaje_reporte_llm[categoria] = texto_categoria
                        except Exception as e:
                            viaje_reporte_llm[categoria] = f"Error generando resumen: {e}"

                # Guardar texto generado en Supabase en campo json
                try:
                    supabase.table('viajes').update({'reporte_llm': viaje_reporte_llm}).eq('id', viaje['id']).execute()
                    st.success("Se generó el reporte y se guardó en la base de datos.")
                except Exception as e:
                    st.error(f"Error guardando reporte en Supabase: {e}")

        if viaje_reporte_llm:
            st.subheader("📝 Narrativa del viaje")
            for categoria, texto in viaje_reporte_llm.items():
                st.markdown(f"**{categoria}**")
                st.write(texto)

    else:
        st.info("No hay viajes finalizados aún")




# Prompt optimizado (Humor ácido pero sin "insultos graves" para evitar baneos)
    prompt = (
        f"Eres un cronista sarcástico y divertido. Escribe un párrafo breve (200 palabras) "
        f"sobre cada Evento '{CATEGORIAS[categoria]["eventos"]}' la categoría '{categoria}' en el viaje '{viaje['nombre']}'. "
        f"Usa un tono de 'roast' (humor ácido y picante). "
        f"Menciona quién es el líder indiscutible y quién ha dado vergüenza ajena por su bajo rendimiento. "
        f"No uses nombres reales si no quieres, usa los datos: \n{ranking_str}\n "
        f"Termina con una frase legendaria.")