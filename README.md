# 🚽 Cacas & Pises - Trip Counter

Una app divertida para registrar eventos durante tus viajes con amigos.

## Características

- ✈️ **Crear viajes** - El admin crea un nuevo viaje
- 👥 **Unirse a viajes** - Otros usuarios se unen usando el ID del viaje
- 🚽 **Registrar eventos** - Cuenta tus eventos (Cacas y Pises)
- 📊 **Ver estadísticas** - Al final del viaje, obtén un reporte completo

## Instalación Local

1. **Clonar o descargar el repositorio**
   ```bash
   git clone <tu-repo>
   cd Cacas
   ```

2. **Crear un entorno virtual** (opcional pero recomendado)
   ```bash
   python -m venv venv
   # En Windows:
   venv\Scripts\activate
   # En Mac/Linux:
   source venv/bin/activate
   ```

3. **Instalar dependencias**
   ```bash
   pip install -r requirements.txt
   ```

4. **Ejecutar la app**
   ```bash
   streamlit run Cacas.py
   ```

La app se abrirá en `http://localhost:8501`

## Desplegar en Streamlit Cloud

1. **Sube tu código a GitHub**
   - Crea un repositorio en GitHub
   - Sube los archivos `Cacas.py` y `requirements.txt`

2. **Crea una cuenta en Streamlit Cloud**
   - Ve a https://streamlit.io/cloud
   - Haz clic en "Sign up"

3. **Despliega tu app**
   - En Streamlit Cloud, haz clic en "New app"
   - Selecciona tu repositorio y rama
   - Especifica el archivo principal: `Cacas.py`
   - Haz clic en "Deploy"

4. **Comparte el link con tus amigos**
   - Streamlit Cloud te proporcionará una URL pública
   - Comparte esta URL con tus amigos

## Uso

### Para el Admin (Creador del viaje):
1. Ve a "Crear Viaje"
2. Ingresa el nombre del viaje y tu nombre
3. Crea el viaje
4. Comparte el ID del viaje con tus amigos

### Para otros usuarios:
1. Ve a "Unirse a Viaje"
2. Selecciona el viaje de la lista
3. Ingresa tu nombre
4. ¡Únete al viaje!

### Registrar eventos:
1. Ve a "Mi Viaje"
2. Selecciona tu viaje y tu usuario
3. Usa los botones ➕ para registrar eventos
4. Los eventos se guardan automáticamente

### Ver resultados:
1. El admin finaliza el viaje desde "Mi Viaje"
2. Ve a "Reportes" para ver las estadísticas finales
3. Visualiza gráficos y tabla de resultados

## Estructura de datos

Los datos se guardan en `viajes_data.json` con la siguiente estructura:

```json
{
  "viajes": [
    {
      "id": 1,
      "nombre": "Viaje a Cancún",
      "admin": "Juan",
      "fecha_creacion": "2025-03-21 10:30:45",
      "activo": false,
      "fecha_finalizacion": "2025-03-28 14:20:15",
      "usuarios": {
        "María": {"cacas": 5, "pises": 12},
        "Pedro": {"cacas": 3, "pises": 8}
      }
    }
  ]
}
```

## Tecnologías

- **Streamlit** - Framework web para Python
- **Pandas** - Procesamiento de datos
- **JSON** - Almacenamiento de datos

## Notas

- Los datos se almacenan localmente en `viajes_data.json`
- En Streamlit Cloud, los datos persisten mientras la app esté activa
- Para borrar datos, elimina el archivo `viajes_data.json`

## Contribuciones

¡Siéntete libre de mejorar la app y hacer pull requests!

## Licencia

MIT