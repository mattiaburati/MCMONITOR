require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const si = require('systeminformation');
const { exec } = require('child_process');
const path = require('path');
const { authenticateUser, authMiddleware, initializeAuth } = require('./auth');
const { getConfig, saveConfig, buildJavaCommand, getCurrentPaths } = require('./config');
const net = require('net');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// I percorsi ora vengono gestiti dalla configurazione dinamica

let minecraftProcess = null;
let serverStatus = 'stopped';
let playerList = [];
let serverInfo = { online: 0, max: 0, version: '', motd: '' };
let serverLogs = []; // Buffer per i log del server
const MAX_LOG_LINES = 1000; // Massimo numero di righe di log da mantenere

// Funzione per aggiungere log e fare broadcast
const addServerLog = (message, type = 'info') => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: message.toString().trim(),
    type: type
  };
  
  serverLogs.push(logEntry);
  
  // Mantieni solo le ultime MAX_LOG_LINES righe
  if (serverLogs.length > MAX_LOG_LINES) {
    serverLogs.splice(0, serverLogs.length - MAX_LOG_LINES);
  }
  
  // Broadcast del log via WebSocket
  broadcastLog(logEntry);
};

// Health check endpoint (pubblico)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint di login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password richiesti' });
  }

  try {
    const token = await authenticateUser(username, password);
    if (!token) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    res.json({ token, message: 'Login effettuato con successo' });
  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint protetti
app.get('/api/status', authMiddleware, (req, res) => {
  res.json({ status: serverStatus });
});

app.post('/api/start', authMiddleware, (req, res) => {
  if (serverStatus === 'running') {
    return res.status(400).json({ error: 'Server già in esecuzione' });
  }

  const command = buildJavaCommand();
  
  // Reset dei log quando si avvia il server
  serverLogs = [];
  addServerLog('Avvio server in corso...', 'info');
  addServerLog(`Comando: ${command}`, 'system');
  
  minecraftProcess = exec(command, {
    cwd: getCurrentPaths().serverPath
  });

  // Cattura l'output del server
  minecraftProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      addServerLog(line, 'stdout');
    });
  });

  minecraftProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      addServerLog(line, 'stderr');
    });
  });

  minecraftProcess.on('spawn', () => {
    serverStatus = 'running';
    addServerLog('Server avviato con successo!', 'success');
    broadcastStatus();
  });

  minecraftProcess.on('exit', (code) => {
    serverStatus = 'stopped';
    addServerLog(`Server arrestato con codice: ${code}`, code === 0 ? 'info' : 'error');
    minecraftProcess = null;
    broadcastStatus();
  });

  minecraftProcess.on('error', (error) => {
    addServerLog(`Errore processo: ${error.message}`, 'error');
    serverStatus = 'stopped';
    broadcastStatus();
  });

  res.json({ message: 'Server Minecraft avviato', status: serverStatus });
});

app.post('/api/stop', authMiddleware, (req, res) => {
  if (serverStatus !== 'running' || !minecraftProcess) {
    return res.status(400).json({ error: 'Server non in esecuzione' });
  }

  addServerLog('Arresto server richiesto...', 'info');
  minecraftProcess.stdin.write('stop\n');
  serverStatus = 'stopping';
  broadcastStatus();

  setTimeout(() => {
    if (minecraftProcess) {
      addServerLog('Forzatura arresto server...', 'warning');
      minecraftProcess.kill('SIGTERM');
    }
  }, 10000);

  res.json({ message: 'Arresto server in corso', status: serverStatus });
});

app.post('/api/restart', authMiddleware, (req, res) => {
  if (serverStatus === 'running' && minecraftProcess) {
    minecraftProcess.stdin.write('stop\n');
    
    minecraftProcess.on('exit', () => {
      setTimeout(() => {
        const command = buildJavaCommand();
        
        minecraftProcess = exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Errore: ${error}`);
            serverStatus = 'stopped';
            broadcastStatus();
          }
        });

        minecraftProcess.on('spawn', () => {
          serverStatus = 'running';
          broadcastStatus();
        });

        minecraftProcess.on('exit', () => {
          serverStatus = 'stopped';
          minecraftProcess = null;
          broadcastStatus();
        });
      }, 2000);
    });

    serverStatus = 'restarting';
  } else {
    const command = buildJavaCommand();
    
    minecraftProcess = exec(command);
    minecraftProcess.on('spawn', () => {
      serverStatus = 'running';
      broadcastStatus();
    });
  }

  res.json({ message: 'Restart server in corso', status: serverStatus });
});

// Endpoints per configurazione server
app.get('/api/config', authMiddleware, (req, res) => {
  try {
    const config = getConfig();
    res.json(config);
  } catch (error) {
    console.error('Errore recupero configurazione:', error);
    res.status(500).json({ error: 'Errore nel recupero della configurazione' });
  }
});

app.put('/api/config', authMiddleware, (req, res) => {
  try {
    const { minRam, maxRam, javaArgs, serverPath, jarFile, serverHost, serverPort, serverType } = req.body;
    
    if (serverStatus === 'running') {
      return res.status(400).json({ 
        error: 'Non è possibile modificare la configurazione mentre il server è in esecuzione' 
      });
    }

    const updatedConfig = saveConfig({ 
      minRam, 
      maxRam, 
      javaArgs, 
      serverPath, 
      jarFile, 
      serverHost, 
      serverPort,
      serverType
    });
    
    res.json({ 
      message: 'Configurazione aggiornata con successo',
      config: updatedConfig 
    });
  } catch (error) {
    console.error('Errore salvataggio configurazione:', error);
    res.status(400).json({ error: error.message });
  }
});

// Endpoint per giocatori online
app.get('/api/players', authMiddleware, (req, res) => {
  res.json({
    players: playerList,
    info: serverInfo,
    serverStatus: serverStatus
  });
});

// Endpoint per ottenere i log del server
app.get('/api/logs', authMiddleware, (req, res) => {
  res.json({
    logs: serverLogs,
    serverStatus: serverStatus
  });
});

// Endpoint per inviare comandi al server
app.post('/api/command', authMiddleware, (req, res) => {
  const { command } = req.body;
  
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Comando richiesto' });
  }
  
  if (serverStatus !== 'running' || !minecraftProcess) {
    return res.status(400).json({ error: 'Server non in esecuzione' });
  }
  
  try {
    // Invia comando al processo del server
    minecraftProcess.stdin.write(command + '\n');
    
    // Log del comando inviato
    addServerLog(`> ${command}`, 'command');
    
    res.json({ 
      message: 'Comando inviato con successo',
      command: command
    });
  } catch (error) {
    console.error('Errore invio comando:', error);
    res.status(500).json({ error: 'Errore nell\'invio del comando' });
  }
});

app.get('/api/system', authMiddleware, async (req, res) => {
  try {
    const cpu = await si.currentLoad();
    const memory = await si.mem();
    const disk = await si.fsSize();

    res.json({
      cpu: {
        usage: Math.round(cpu.currentLoad),
        cores: cpu.cpus?.length || 0
      },
      memory: {
        total: Math.round(memory.total / 1024 / 1024 / 1024),
        used: Math.round(memory.used / 1024 / 1024 / 1024),
        usage: Math.round((memory.used / memory.total) * 100)
      },
      disk: disk.map(d => ({
        filesystem: d.fs,
        size: Math.round(d.size / 1024 / 1024 / 1024),
        used: Math.round(d.used / 1024 / 1024 / 1024),
        usage: Math.round(d.use)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero dati sistema' });
  }
});

// Funzione semplificata per simulare query server Minecraft
async function queryMinecraftServer() {
  if (serverStatus !== 'running') {
    playerList = [];
    serverInfo = { online: 0, max: 0, version: '', motd: '' };
    return;
  }

  try {
    const paths = getCurrentPaths();
    
    // Per ora usiamo dati simulati quando il server è online
    // In futuro potremo implementare una vera query quando troveremo una libreria stabile
    if (serverStatus === 'running') {
      serverInfo = {
        online: 0, // Placeholder - aggiornato dinamicamente se ci sono giocatori
        max: 20,
        version: 'NeoForge 1.21.1',
        motd: 'Server NeoForge'
      };
      
      // Lista giocatori vuota per ora - verrà popolata se implementeremo query reali
      playerList = [];
      
      console.log('Query server simulata - server online su', `${paths.serverHost}:${paths.serverPort}`);
    }
  } catch (error) {
    console.error('Errore query server:', error.message);
    playerList = [];
    serverInfo = { online: 0, max: 0, version: 'Unknown', motd: 'Server non raggiungibile' };
  }
}

function broadcastStatus() {
  const message = JSON.stringify({
    type: 'status',
    data: { 
      status: serverStatus,
      players: playerList,
      info: serverInfo
    }
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastLog(logEntry) {
  const message = JSON.stringify({
    type: 'log',
    data: logEntry
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function broadcastSystemInfo() {
  try {
    const cpu = await si.currentLoad();
    const memory = await si.mem();

    const message = JSON.stringify({
      type: 'system',
      data: {
        cpu: Math.round(cpu.currentLoad),
        memory: Math.round((memory.used / memory.total) * 100),
        timestamp: new Date().toISOString()
      }
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } catch (error) {
    console.error('Errore invio dati sistema:', error);
  }
}

wss.on('connection', (ws) => {
  console.log('Nuova connessione WebSocket');
  
  ws.send(JSON.stringify({
    type: 'status',
    data: { status: serverStatus }
  }));

  ws.on('close', () => {
    console.log('Connessione WebSocket chiusa');
  });
});

setInterval(broadcastSystemInfo, 2000);
setInterval(async () => {
  await queryMinecraftServer();
  broadcastStatus();
}, 5000); // Query server Minecraft ogni 5 secondi

// Inizializza autenticazione
initializeAuth().then(() => {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
    console.log(`Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
  });
}).catch(error => {
  console.error('Errore inizializzazione autenticazione:', error);
  process.exit(1);
});