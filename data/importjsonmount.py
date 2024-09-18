import requests
from requests.auth import HTTPBasicAuth

# URL de la API para obtener los detalles de las solicitudes a partir de un ID de vista
url = "https://mesadeservicios.degasa.com.ar/service-desk/api/incidents.details.by.view"

# Credenciales de autenticación
username = "metricas"
password = "oKZdhTidAKRSy2IE8GdZm6n6"

# Parámetros requeridos y opcionales
view_id = 123  # Reemplaza este valor con el ID de la vista que deseas consultar
sort_by = "id"  # Opcional: "id" o "last_update"
page_key = None  # Opcional: clave de la página de resultados
order_by = "asc"  # Opcional: "asc" o "desc"

# Parámetros de la solicitud
params = {
    'view_id': view_id,
    'sort_by': sort_by,
    'page_key': page_key,
    'order_by': order_by
}

# Hacer una solicitud GET a la URL de la API con autenticación básica y los parámetros
response = requests.get(url, params=params, auth=HTTPBasicAuth(username, password))

# Verificar si la solicitud fue exitosa
if response.status_code == 200:
    # Procesar la respuesta (por ejemplo, imprimir el contenido)
    incidents_details = response.json()  # Asumiendo que la respuesta es JSON
    for incident in incidents_details:
        print(f"ID: {incident['id']}, Title: {incident['title']}")
else:
    print(f"Error: {response.status_code}")