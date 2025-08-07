const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'server-config.json');

const defaultConfig = {
  minRam: 1,
  maxRam: 2,
  javaArgs: [],
  serverPath: process.env.MINECRAFT_SERVER_PATH || '/home/minecraft_server',
  jarFile: process.env.MINECRAFT_JAR || 'server.jar',
  serverHost: process.env.MINECRAFT_SERVER_HOST || 'localhost',
  serverPort: process.env.MINECRAFT_SERVER_PORT || '25565'
};

let currentConfig = { ...defaultConfig };

const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      currentConfig = { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Errore caricamento configurazione:', error);
    currentConfig = { ...defaultConfig };
  }
  return currentConfig;
};

const validatePaths = (config) => {
  if (config.serverPath) {
    if (!fs.existsSync(config.serverPath)) {
      throw new Error(`Directory server non trovata: ${config.serverPath}`);
    }
    
    const jarPath = path.join(config.serverPath, config.jarFile || currentConfig.jarFile);
    if (!fs.existsSync(jarPath)) {
      throw new Error(`File JAR non trovato: ${jarPath}`);
    }
  }
  
  if (config.serverPort) {
    const port = parseInt(config.serverPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Porta server deve essere un numero tra 1 e 65535');
    }
  }
};

const saveConfig = (config) => {
  try {
    // Validazione parametri RAM
    if (config.minRam && config.minRam < 0.5) {
      throw new Error('RAM minima deve essere almeno 0.5GB');
    }
    if (config.maxRam && config.maxRam < 0.5) {
      throw new Error('RAM massima deve essere almeno 0.5GB');
    }
    if (config.minRam && config.maxRam && config.minRam > config.maxRam) {
      throw new Error('RAM minima non può essere maggiore della RAM massima');
    }

    // Validazione percorsi se specificati
    if (config.serverPath || config.jarFile) {
      validatePaths(config);
    }

    currentConfig = { ...currentConfig, ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
    return currentConfig;
  } catch (error) {
    throw error;
  }
};

const getConfig = () => {
  return { ...currentConfig };
};

const buildJavaCommand = (serverPath = null, jarFile = null) => {
  const minRam = currentConfig.minRam || 1;
  const maxRam = currentConfig.maxRam || 2;
  const finalServerPath = serverPath || currentConfig.serverPath;
  const finalJarFile = jarFile || currentConfig.jarFile;
  
  let command = `cd "${finalServerPath}" && java -Xmx${maxRam}G -Xms${minRam}G`;
  
  // Aggiungi eventuali argomenti Java personalizzati
  if (currentConfig.javaArgs && currentConfig.javaArgs.length > 0) {
    command += ` ${currentConfig.javaArgs.join(' ')}`;
  }
  
  command += ` -jar "${finalJarFile}" nogui`;
  
  return command;
};

const getCurrentPaths = () => {
  return {
    serverPath: currentConfig.serverPath,
    jarFile: currentConfig.jarFile,
    serverHost: currentConfig.serverHost,
    serverPort: currentConfig.serverPort
  };
};

// Carica configurazione all'avvio
loadConfig();

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  buildJavaCommand,
  getCurrentPaths,
  validatePaths
};