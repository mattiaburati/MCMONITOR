# 🎮 Minecraft Server Monitor

Una webapp per monitorare e controllare il tuo server Minecraft con dashboard in tempo reale.

## 🚀 Funzionalità

- **🔐 Autenticazione Sicura**: Sistema JWT con login protetto
- **Controllo Server**: Avvia, ferma e riavvia il server Minecraft
- **Monitoraggio Sistema**: CPU, RAM e spazio disco in tempo reale
- **Dashboard Real-time**: Aggiornamenti automatici via WebSocket
- **Interfaccia Moderna**: UI responsiva con React + Vite

## 📋 Requisiti

- Node.js (v14 o superiore)
- Server Minecraft installato sul sistema
- Java per eseguire il server Minecraft

## ⚙️ Configurazione

### 1. Variabili d'ambiente

Crea un file `.env` nella cartella `backend`:

```env
MINECRAFT_SERVER_PATH=/path/to/your/minecraft/server
MINECRAFT_JAR=server.jar
PORT=3001

# Autenticazione (IMPORTANTE: Cambia questi valori!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123
```

### 2. Installazione

```bash
# Backend
cd backend
npm install

# Frontend  
cd ../frontend
npm install
```

### 3. Avvio

```bash
# Backend (porta 3001)
cd backend
npm start

# Frontend (porta 5173)
cd frontend  
npm run dev
```

## 🔧 API Endpoints

### Autenticazione
- `POST /api/login` - Login (pubblico)

### Endpoints Protetti (richiedono token JWT)
- `GET /api/status` - Stato del server
- `POST /api/start` - Avvia server
- `POST /api/stop` - Ferma server  
- `POST /api/restart` - Riavvia server
- `GET /api/system` - Info sistema (CPU/RAM/Disco)

## 🌐 WebSocket

Il server invia aggiornamenti real-time su:
- Stato del server Minecraft
- Utilizzo CPU e RAM ogni 2 secondi

## 📱 Interfaccia

La webapp mostra:
- 🟢 Indicatore stato server (running/stopped/starting/etc.)
- 🎛️ Controlli per start/stop/restart
- 📊 Grafici utilizzo CPU, RAM e disco
- 📱 Design responsive per mobile

## 🔒 Sicurezza

- **Autenticazione JWT**: Tutti gli endpoint sono protetti
- **Token Expiry**: I token scadono dopo 24 ore
- **Password Hashing**: Password memorizzate con bcrypt
- **Auto-logout**: Logout automatico su token scaduto
- **CORS**: Configurato per sviluppo locale
- **Variabili Ambiente**: Credenziali in file .env

### 🚨 **IMPORTANTE PER PRODUZIONE:**
1. Cambia `JWT_SECRET` con una chiave segreta forte
2. Modifica username e password default
3. Usa HTTPS per connessioni sicure
4. Configura CORS per il tuo dominio specifico

## 🛠️ Personalizzazione

Modifica le variabili in `backend/server.js`:
- Allocazione memoria Java (`-Xmx2G -Xms1G`)
- Intervallo aggiornamenti WebSocket (attualmente 2s)
- Path e nome jar del server Minecraft