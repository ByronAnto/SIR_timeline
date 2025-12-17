# 🔄 Azure DevOps → Timeline SIR - Guía de Integración

## 📋 Descripción

Script de sincronización automática que extrae work items de Azure DevOps y los agrega al timeline de versiones SIR.

**Funcionalidades:**
- ✅ Busca work items por tag de versión (ej: `V.1.58.1.1`)
- ✅ Extrae automáticamente: HU, descripción, país, tipo, sprint
- ✅ Actualiza `document.json` sin trabajo manual
- ✅ Mapea países desde tags de Azure DevOps
- ✅ Identifica Defectos vs Requerimientos
- ✅ Interfaz interactiva y amigable

---

## 🚀 Instalación

### 1. Instalar Dependencias

```bash
npm install
```

Esto instalará:
- `axios` - Cliente HTTP para Azure DevOps API
- `dotenv` - Gestión de variables de entorno
- `prompts` - Interfaz interactiva CLI

### 2. Configurar Azure DevOps Token

#### a) Crear Personal Access Token (PAT)

1. Ir a: https://dev.azure.com/{tu-organizacion}/_usersSettings/tokens
2. Click en **"New Token"**
3. Configurar:
   - **Name**: Timeline SIR Sync
   - **Organization**: Grupo-KFC (o tu org)
   - **Expiration**: 90 days (o custom)
   - **Scopes**: 
     - ✅ Work Items: **Read**
4. Click **"Create"**
5. **Copiar el token** (solo se muestra una vez)

#### b) Configurar archivo .env

```bash
# Copiar el template
cp .env.example .env

# Editar .env y agregar tu token
notepad .env
```

**Contenido de `.env`:**
```env
AZURE_DEVOPS_TOKEN=tu-token-aqui
AZURE_DEVOPS_ORG=Grupo-KFC
AZURE_DEVOPS_PROJECT=SIR
```

> ⚠️ **IMPORTANTE**: Nunca subas el archivo `.env` a Git (ya está en `.gitignore`)

---

## 📖 Uso

### Comando Simple

```bash
npm run sync
```

### Flujo Interactivo

El script te hará 3 preguntas:

```
📋 Sincronización de Azure DevOps → Timeline SIR

? ¿Qué versión deseas sincronizar? (ej: V.1.58.1.1 o 1.58.1.1)
› V.1.58.1.1

? ¿Qué fecha tiene esta versión? (formato: DD/MM/YYYY)
› 17/12/2024

? ¿Año de la versión?
› 2025
```

Luego:
1. **Busca** automáticamente todos los work items con ese tag
2. **Muestra** un resumen de lo que encontró
3. **Pregunta** si quieres confirmarlo
4. **Actualiza** `document.json`
5. **¡Listo!** Recarga el timeline

---

## 🗺️ Mapeo Automático

### Tags de País → Observación

| Tag Azure DevOps | Campo `observation` |
|------------------|---------------------|
| CO | Colombia |
| ECU, EC | Ecuador |
| BR | Brasil |
| ES, ESP | España |
| VE, VEN | Venezuela |
| CHI, CH | Chile |
| AR | Argentina |
| RE | Regional |

### Work Item Type → Tipo

| Azure DevOps | Campo `type` |
|--------------|--------------|
| Bug | Defecto |
| User Story | Requerimiento |
| Feature | Requerimiento |
| Task | Requerimiento |

### Campos Extraídos

| Azure DevOps | document.json |
|--------------|---------------|
| `System.Id` | `id`, `branch` |
| `System.Title` | `description` |
| `System.Tags` (país) | `observation` |
| `System.WorkItemType` | `type` |
| `System.IterationPath` | `sprint` |
| `System.AreaPath` | `proyect` |
| Manual (usuario) | `date`, `year` |

---

## 📊 Ejemplo de Salida

```
🚀 Iniciando sincronización con Azure DevOps...

📋 Sincronización de Azure DevOps → Timeline SIR

? ¿Qué versión deseas sincronizar? V.1.58.1.1
? ¿Qué fecha tiene esta versión? 17/12/2024
? ¿Año de la versión? 2025

📌 Versión: 1.58.1.1
📅 Fecha: 17/12/2024
📆 Año: 2025
🏷️  Tag de búsqueda: V.1.58.1.1

🔍 Buscando work items con tag: V.1.58.1.1...
✅ Encontrados 12 work items

📊 Resumen de Work Items encontrados:

  🐛 #57743 - BR - Traducción Módulo Diarios ERPS Inventarios
  📋 #57812 - Mejora Reporte Compras Ecuador
  🐛 #57890 - Fix Inventario Colombia
  ... (9 más)

? ¿Deseas agregar estos 12 work items a la versión 1.58.1.1? Yes

⚙️  Transformando datos...
💾 Actualizando document.json...
✅ document.json actualizado correctamente

✅ ¡Sincronización completada exitosamente!

📈 Versión 1.58.1.1 agregada con 15 detalles
🔄 Recarga el timeline en http://localhost:3000 para ver los cambios
```

---

## 🔧 Troubleshooting

### Error: "AZURE_DEVOPS_TOKEN no está configurado"

**Solución:**
1. Verifica que existe el archivo `.env`
2. Verifica que tiene la variable `AZURE_DEVOPS_TOKEN=...`
3. No debe tener espacios: ❌ `AZURE_DEVOPS_TOKEN = token` ✅ `AZURE_DEVOPS_TOKEN=token`

### Error: "Error de autenticación"

**Solución:**
1. Verifica que el token no haya expirado
2. Verifica que el token tenga permisos de "Work Items: Read"
3. Genera un nuevo token si es necesario

### Error: "No se encontraron work items"

**Posibles causas:**
1. El tag de versión no existe en Azure DevOps
2. Escribiste mal la versión (verifica que tenga el formato correcto)
3. Los work items están en otro proyecto

**Solución:**
- Ve a Azure DevOps y verifica que existan work items con ese tag
- Prueba con `V.1.58.1.1` o `1.58.1.1` (ambos funcionan)

### No actualiza el timeline

**Solución:**
1. Verifica que `document.json` se haya actualizado (abre el archivo)
2. Recarga la página del timeline (Ctrl + F5)
3. Verifica que el servidor esté corriendo (`npm start`)

---

## 📁 Estructura de Archivos

```
SIR_timeline/
├── devops-sync.js        ← Script de sincronización
├── .env.example          ← Template de configuración
├── .env                  ← Tu configuración (no subir a Git)
├── package.json          ← Dependencias actualizadas
├── data/
│   └── document.json     ← Se actualiza automáticamente
└── README-DEVOPS.md      ← Esta guía
```

---

## 🎯 Workflow Recomendado

### Cuando hay una nueva versión:

1. **Los devs tagean** work items en Azure DevOps con `V.1.XX.X.X`
2. **Tú ejecutas**: `npm run sync`
3. **Ingresas** versión, fecha, año
4. **Script sincroniza** automáticamente
5. **Refrescas** el timeline
6. **¡Listo!** ✅

### Ventajas vs Manual:

| Manual ❌ | Con Script ✅ |
|-----------|---------------|
| Copiar cada HU manualmente | Automático |
| Buscar descripción en Azure | Automático |
| Identificar país del tag | Automático |
| Determinar si es Bug/Story | Automático |
| Escribir JSON a mano | Automático |
| **Tiempo: ~30 min** | **Tiempo: ~30 seg** |

---

## 🔒 Seguridad

- ✅ El token NO se incluye en el código
- ✅ `.env` está en `.gitignore`
- ✅ El script solo tiene permisos de lectura
- ✅ No modifica nada en Azure DevOps

---

## 🆘 Soporte

Si tienes problemas:
1. Lee la sección de Troubleshooting arriba
2. Verifica los logs del script (muestra errores detallados)
3. Verifica que tu token tenga los permisos correctos

---

## ✨ Próximas Mejoras

Posibles features futuras:
- [ ] Modo watch: detectar automáticamente nuevas versiones
- [ ] Webhook: sincronizar cuando se crea un tag en Azure DevOps
- [ ] Dry-run: ver qué se agregaría sin guardar
- [ ] Backup automático de document.json
- [ ] Soporte para múltiples proyectos

---

**¡Disfruta de la sincronización automática!** 🚀
