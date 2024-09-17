import json
from collections import defaultdict

# Ruta al archivo JSON
json_file_path = './document.json'

# Países válidos
valid_countries = ["Ecuador", "Colombia", "Chile", "España", "Regional"]

# Meses válidos (Mayo a Septiembre)
valid_months = ['05', '06', '07', '08', '09']

# Contadores por país, tipo y mes
country_counts = defaultdict(lambda: defaultdict(lambda: {'Requerimiento': 0, 'Bug': 0}))

# Leer el archivo JSON
with open(json_file_path, 'r', encoding='utf-8') as file:
    data = json.load(file)

# Procesar los datos
for version in data['data']:
    month = version['date'].split('/')[1]  # Extraer el mes de la fecha
    if month in valid_months:
        for detail in version['details']:
            country = detail['observation'] if detail['observation'] in valid_countries else 'No definido'
            type_ = detail['type']
            if type_ in ['Requerimiento', 'Bug']:
                country_counts[month][country][type_] += 1

# Mostrar los resultados en la consola
for month in valid_months:
    print(f'Month: {month}')
    for country, counts in country_counts[month].items():
        print(f'  {country}: Requerimientos: {counts["Requerimiento"]}, Bugs: {counts["Bug"]}')