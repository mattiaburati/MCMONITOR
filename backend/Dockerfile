# Backend Dockerfile
FROM node:20-alpine

# Installa dipendenze di sistema necessarie per systeminformation
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers

WORKDIR /app

# Copia i file package per installare le dipendenze
COPY package*.json ./

# Installa le dipendenze
RUN npm install --only=production

# Copia il codice sorgente
COPY . .

# Esponi la porta
EXPOSE 3001

# Crea utente non-root per sicurezza
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Cambia ownership dei file
RUN chown -R nodejs:nodejs /app
USER nodejs

# Comando di avvio
CMD ["npm", "start"]