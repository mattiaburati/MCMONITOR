require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const si = require('systeminformation');
const { exec } = require('child_process');
const path = require('path');
const { authenticateUser, authMiddleware, initializeAuth } = require('./auth');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const MINECRAFT_SERVER_PATH = process.env.MINECRAFT_SERVER_PATH || '/home/minecraft/server';
const MINECRAFT_JAR = process.env.MINECRAFT_JAR || 'server.jar';

let minecraftProcess = null;
let serverStatus = 'stopped';

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

  const command = `cd ${MINECRAFT_SERVER_PATH} && java -Xmx2G -Xms1G -jar ${MINECRAFT_JAR} nogui`;
  
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
        const command = `cd ${MINECRAFT_SERVER_PATH} && java -Xmx2G -Xms1G -jar ${MINECRAFT_JAR} nogui`;
        
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
    const command = `cd ${MINECRAFT_SERVER_PATH} && java -Xmx2G -Xms1G -jar ${MINECRAFT_JAR} nogui`;
    
    minecraftProcess = exec(command);
    minecraftProcess.on('spawn', () => {
      serverStatus = 'running';
      broadcastStatus();
    });
  }

  res.json({ message: 'Restart server in corso', status: serverStatus });
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

function broadcastStatus() {
  const message = JSON.stringify({
    type: 'status',
    data: { status: serverStatus }
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