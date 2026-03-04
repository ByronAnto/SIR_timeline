# Dockerfile para SIR Timeline
FROM node:18-slim

LABEL maintainer="SIR Team"
LABEL description="SIR Timeline - Sistema de control de versiones"

# unrar-free: necesario para extraer adjuntos .rar de Azure DevOps
# Provee el mismo comando "unrar x" que usa release-downloader.js
RUN apt-get update \
    && apt-get install -y --no-install-recommends unrar-free \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero (capa cacheada mientras package.json no cambie)
COPY package*.json ./
RUN npm ci --only=production

# Copiar el resto de la aplicación
COPY . .

# Asegurar que el directorio de datos existe
RUN mkdir -p /app/data

# Usuario no-root para producción
RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
