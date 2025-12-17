# 🐳 SIR Timeline - Docker Guide

## 📦 Construir la Imagen

```bash
docker build -t sir-timeline:latest .
```

## 🚀 Ejecutar con Docker

### Opción 1: Docker Run

```bash
docker run -d \
  --name sir-timeline \
  -p 3000:3000 \
  -e AZURE_DEVOPS_ORG="Grupo-KFC" \
  -e AZURE_DEVOPS_PROJECT="SIR" \
  -e AZURE_DEVOPS_TOKEN="your-token-here" \
  -v $(pwd)/data:/app/data \
  sir-timeline:latest
```

### Opción 2: Docker Compose (Recomendado)

```bash
# 1. Asegúrate de tener .env configurado
cp .env.example .env
# Edita .env y agrega tu token

# 2. Levantar el servicio
docker-compose up -d

# 3. Ver logs
docker-compose logs -f

# 4. Detener
docker-compose down
```

## 🔧 Comandos Útiles

```bash
# Ver logs
docker logs sir-timeline -f

# Entrar al contenedor
docker exec -it sir-timeline sh

# Reiniciar contenedor
docker restart sir-timeline

# Eliminar contenedor
docker stop sir-timeline
docker rm sir-timeline

# Eliminar imagen
docker rmi sir-timeline:latest
```

## 🌐 Acceder a la Aplicación

- **Timeline**: http://localhost:3000
- **Sync UI**: http://localhost:3000/sync.html

## 📊 Variables de Entorno

Requeridas:
- `AZURE_DEVOPS_ORG`: Organización de Azure DevOps
- `AZURE_DEVOPS_PROJECT`: Nombre del proyecto
- `AZURE_DEVOPS_TOKEN`: Personal Access Token

## 💾 Persistencia de Datos

El directorio `./data` se monta como volumen para persistir:
- `document.json`: Base de datos de versiones

## 🔄 Actualizar la Aplicación

```bash
# 1. Detener contenedor
docker-compose down

# 2. Reconstruir imagen
docker-compose build

# 3. Levantar de nuevo
docker-compose up -d
```

## 📝 Notas

- El contenedor corre en el puerto 3000
- Los datos persisten en el volumen montado
- El token de Azure DevOps se pasa como variable de entorno
