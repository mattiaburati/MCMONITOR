# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copia i file package per installare le dipendenze
COPY package*.json ./

# Installa le dipendenze
RUN npm ci

# Copia il codice sorgente
COPY . .

# Build dell'applicazione
RUN npm run build

# Fase di produzione con Nginx
FROM nginx:alpine

# Copia la build dalla fase precedente
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia configurazione Nginx personalizzata
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Esponi la porta 80
EXPOSE 80

# Comando di avvio (default di nginx)
CMD ["nginx", "-g", "daemon off;"]