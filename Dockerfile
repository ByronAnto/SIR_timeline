# Dockerfile para SIR Timeline
FROM node:18-alpine

# Metadata
LABEL maintainer="SIR Team"
LABEL description="SIR Timeline - Sistema de control de versiones"

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto de la aplicación
COPY . .

# Crear directorio para datos si no existe
RUN mkdir -p /app/data

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
