import streamlit as st
import json
import os
from datetime import datetime
from pathlib import Path

# Configuración de la app
st.set_page_config(
    page_title="Cacas y Pises",
    page_icon="💩",
    layout="wide"
)

# Archivo de almacenamiento de datos
DATA_FILE = "viajes_data.json"

# Definición de categorías y eventos
CATEGORIAS = {
    "Cacas": {
        "emoji": "💩",
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
    """Carga los datos de los viajes desde el archivo JSON"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {"viajes": []}

def guardar_datos(datos):
    """Guarda los datos de los viajes en el archivo JSON"""
    with open(DATA_FILE, 'w') as f:
        json.dump(datos, f, indent=2)

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

def añadir_usuario_a_viaje(viaje_id, nombre_usuario):
    """Añade un usuario a un viaje específico con los eventos según las categorías"""
    datos = cargar_datos()
    for viaje in datos["viajes"]:
        if viaje["id"] == viaje_id:
            if nombre_usuario not in viaje["usuarios"]:
                # Inicializar eventos según las categorías del viaje
                eventos_usuario = {}
                for categoria in viaje.get("categorias", ["Cacas"]):
                    if categoria in CATEGORIAS:
                        for evento_key in CATEGORIAS[categoria]["eventos"]:
                            eventos_usuario[evento_key] = 0
                
                viaje["usuarios"][nombre_usuario] = eventos_usuario
            guardar_datos(datos)
            return True
    return False

def registrar_evento(viaje_id, usuario, tipo_evento):
    """Registra un evento (caca o pis) para un usuario en un viaje"""
    datos = cargar_datos()
    for viaje in datos["viajes"]:
        if viaje["id"] == viaje_id:
            if usuario in viaje["usuarios"]:
                viaje["usuarios"][usuario][tipo_evento] += 1
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
                if viaje["usuarios"][usuario][tipo_evento] > 0:
                    viaje["usuarios"][usuario][tipo_evento] -= 1
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

# Título principal
st.title("💩 Cacas & Pises")
st.write("Controla los eventos de tu viaje de forma divertida")

# Sidebar para navegación
page = st.sidebar.radio(
    "Menú Principal",
    ["🏠 Inicio", "✈️ Crear Viaje", "📋 Unirse a Viaje", "📊 Mi Viaje", "📈 Reportes"]
)

# Página: Inicio
if page == "🏠 Inicio":
    st.header("¡Bienvenido a Cacas & Pises!")
    st.write("""
    Esta aplicación te permite:
    - 🏖️ Crear viajes con tus amigos
    - 👥 Registrarte en un viaje activo
    - 💩 Contar tus eventos diarios
    - 📊 Ver estadísticas finales del viaje
    
    **¿Cómo funciona?**
    1. Un admin crea un nuevo viaje
    2. Otros usuarios se unen al viaje
    3. Cada uno registra sus eventos (Cacas y Pises)
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
                st.info(f"ID del viaje: {viaje['id']} - Comparte este número con tus amigos")
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
        
        if st.button("Unirme al Viaje", type="primary", use_container_width=True):
            if nombre_usuario:
                if añadir_usuario_a_viaje(viaje_seleccionado["id"], nombre_usuario):
                    st.success(f"✅ ¡Te has unido al viaje '{viaje_seleccionado['nombre']}'!")
                    st.balloons()
                else:
                    st.error("Error al unirse al viaje")
            else:
                st.error("Por favor ingresa tu nombre")
    else:
        st.warning("No hay viajes activos. ¡Crea uno primero!")

# Página: Mi Viaje
elif page == "📊 Mi Viaje":
    st.header("Mi Viaje - Registrar Eventos")
    
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
            
            st.subheader(f"Eventos de {usuario}")
            
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
                            contador = viaje["usuarios"][usuario].get(evento_key, 0)
                            st.metric(
                                f"{evento_info['emoji']} {evento_info['nombre']}",
                                contador
                            )
                            
                            if st.button(f"➕ {evento_info['emoji']}", use_container_width=True, key=f"btn_add_{evento_key}"):
                                registrar_evento(viaje["id"], usuario, evento_key)
                                st.rerun()
                            
                            if contador > 0:
                                if st.button(f"🗑️ {evento_info['emoji']}", use_container_width=True, key=f"btn_del_{evento_key}"):
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
        for usuario, eventos in viaje["usuarios"].items():
            resultado_usuario = {"Usuario": usuario}
            resultado_usuario.update(eventos)
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
    else:
        st.info("No hay viajes finalizados aún")

