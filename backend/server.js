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
const mcstatus = require('mcstatus');

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

  res.json({ message: 'Server Minecraft avviato', status: serverStatus });
});

app.post('/api/stop', authMiddleware, (req, res) => {
  if (serverStatus !== 'running' || !minecraftProcess) {
    return res.status(400).json({ error: 'Server non in esecuzione' });
  }

  minecraftProcess.stdin.write('stop\n');
  serverStatus = 'stopping';
  broadcastStatus();

  setTimeout(() => {
    if (minecraftProcess) {
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

// Funzione per query server Minecraft
async function queryMinecraftServer() {
  if (serverStatus !== 'running') {
    playerList = [];
    serverInfo = { online: 0, max: 0, version: '', motd: '' };
    return;
  }

  try {
    // Query del server usando mcstatus con percorsi dinamici
    const paths = getCurrentPaths();
    const response = await mcstatus.statusJava(paths.serverHost, parseInt(paths.serverPort));
    
    if (response) {
      serverInfo = {
        online: response.players?.online || 0,
        max: response.players?.max || 0,
        version: response.version?.name || 'Unknown',
        motd: response.motd?.clean || ''
      };

      // Lista giocatori (se disponibile)
      if (response.players?.sample) {
        playerList = response.players.sample.map(player => ({
          name: player.name,
          uuid: player.id
        }));
      } else {
        // Se sample non è disponibile, usiamo solo il conteggio
        playerList = Array.from({ length: response.players?.online || 0 }, (_, i) => ({
          name: `Player ${i + 1}`,
          uuid: `unknown-${i}`
        }));
      }
    }
  } catch (error) {
    console.error('Errore query server Minecraft:', error.message);
    // Mantieni i dati precedenti in caso di errore temporaneo
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