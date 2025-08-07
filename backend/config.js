const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'server-config.json');

const defaultConfig = {
  minRam: 1,
  maxRam: 2,
  javaArgs: []
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

const saveConfig = (config) => {
  try {
    // Validazione parametri
    if (config.minRam && config.minRam < 0.5) {
      throw new Error('RAM minima deve essere almeno 0.5GB');
    }
    if (config.maxRam && config.maxRam < 0.5) {
      throw new Error('RAM massima deve essere almeno 0.5GB');
    }
    if (config.minRam && config.maxRam && config.minRam > config.maxRam) {
      throw new Error('RAM minima non può essere maggiore della RAM massima');
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

const buildJavaCommand = (serverPath, jarFile) => {
  const minRam = currentConfig.minRam || 1;
  const maxRam = currentConfig.maxRam || 2;
  
  let command = `cd ${serverPath} && java -Xmx${maxRam}G -Xms${minRam}G`;
  
  // Aggiungi eventuali argomenti Java personalizzati
  if (currentConfig.javaArgs && currentConfig.javaArgs.length > 0) {
    command += ` ${currentConfig.javaArgs.join(' ')}`;
  }
  
  command += ` -jar ${jarFile} nogui`;
  
  return command;
};

// Carica configurazione all'avvio
loadConfig();

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  buildJavaCommand
};