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
  serverPort: process.env.MINECRAFT_SERVER_PORT || '25565',
  serverType: 'vanilla' // 'vanilla', 'forge', 'neoforge', 'fabric'
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

const detectServerType = (serverPath) => {
  try {
    // Controlla per NeoForge
    if (fs.existsSync(path.join(serverPath, 'run.sh')) && 
        fs.existsSync(path.join(serverPath, 'user_jvm_args.txt'))) {
      return 'neoforge';
    }
    
    // Controlla per Forge (versioni più vecchie)
    if (fs.existsSync(path.join(serverPath, 'forge-*.jar')) || 
        fs.readdirSync(serverPath).some(file => file.includes('forge'))) {
      return 'forge';
    }
    
    // Controlla per Fabric
    if (fs.existsSync(path.join(serverPath, 'fabric-server-launch.properties'))) {
      return 'fabric';
    }
    
    // Default a vanilla
    return 'vanilla';
  } catch (error) {
    console.warn('Errore nel rilevamento tipo server:', error);
    return 'vanilla';
  }
};

const validatePaths = (config) => {
  if (config.serverPath) {
    if (!fs.existsSync(config.serverPath)) {
      throw new Error(`Directory server non trovata: ${config.serverPath}`);
    }
    
    // Per NeoForge controlla run.sh invece del JAR
    if (config.serverType === 'neoforge') {
      const runScriptPath = path.join(config.serverPath, 'run.sh');
      if (!fs.existsSync(runScriptPath)) {
        throw new Error(`Script di avvio run.sh non trovato: ${runScriptPath}`);
      }
    } else {
      const jarPath = path.join(config.serverPath, config.jarFile || currentConfig.jarFile);
      if (!fs.existsSync(jarPath)) {
        throw new Error(`File JAR non trovato: ${jarPath}`);
      }
    }
  }
  
  if (config.serverPort) {
    const port = parseInt(config.serverPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Porta server deve essere un numero tra 1 e 65535');
    }
  }
};

const updateNeoForgeJvmArgs = (serverPath, minRam, maxRam) => {
  const jvmArgsPath = path.join(serverPath, 'user_jvm_args.txt');
  
  try {
    let content = '';
    if (fs.existsSync(jvmArgsPath)) {
      content = fs.readFileSync(jvmArgsPath, 'utf8');
    }
    
    // Rimuovi eventuali impostazioni RAM esistenti
    content = content.replace(/-Xm[sx]\d+[GM]/g, '').trim();
    
    // Aggiungi nuove impostazioni RAM
    const ramArgs = `-Xmx${maxRam}G\n-Xms${minRam}G`;
    
    // Se il file aveva già contenuto, aggiungi le nuove impostazioni
    if (content) {
      content = `${ramArgs}\n${content}`;
    } else {
      content = ramArgs;
    }
    
    fs.writeFileSync(jvmArgsPath, content);
    console.log(`Aggiornato ${jvmArgsPath} con RAM: ${minRam}GB-${maxRam}GB`);
  } catch (error) {
    console.error('Errore aggiornamento user_jvm_args.txt:', error);
    throw new Error('Impossibile aggiornare il file delle impostazioni JVM');
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

    // Auto-rileva tipo server se il percorso è cambiato
    if (config.serverPath && config.serverPath !== currentConfig.serverPath) {
      config.serverType = detectServerType(config.serverPath);
      console.log(`Rilevato tipo server: ${config.serverType}`);
    }

    // Validazione percorsi se specificati
    if (config.serverPath || config.jarFile) {
      validatePaths({ ...currentConfig, ...config });
    }

    currentConfig = { ...currentConfig, ...config };

    // Per NeoForge, aggiorna anche user_jvm_args.txt
    if (currentConfig.serverType === 'neoforge' && (config.minRam || config.maxRam)) {
      updateNeoForgeJvmArgs(
        currentConfig.serverPath, 
        currentConfig.minRam, 
        currentConfig.maxRam
      );
    }

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
  const finalServerPath = serverPath || currentConfig.serverPath;
  const serverType = currentConfig.serverType || 'vanilla';
  
  let command;
  
  switch (serverType) {
    case 'neoforge':
      // Per NeoForge usa run.sh che gestisce automaticamente i parametri
      command = `cd "${finalServerPath}" && chmod +x run.sh && ./run.sh`;
      break;
      
    case 'forge':
      // Per Forge usa il launcher forge
      const finalJarFile = jarFile || currentConfig.jarFile;
      command = `cd "${finalServerPath}" && java -jar "${finalJarFile}" nogui`;
      break;
      
    case 'fabric':
      // Per Fabric usa il launcher fabric
      const fabricJar = jarFile || currentConfig.jarFile;
      command = `cd "${finalServerPath}" && java -jar "${fabricJar}" nogui`;
      break;
      
    case 'vanilla':
    default:
      // Per Vanilla usa il metodo tradizionale
      const minRam = currentConfig.minRam || 1;
      const maxRam = currentConfig.maxRam || 2;
      const vanillaJar = jarFile || currentConfig.jarFile;
      
      command = `cd "${finalServerPath}" && java -Xmx${maxRam}G -Xms${minRam}G`;
      
      // Aggiungi eventuali argomenti Java personalizzati
      if (currentConfig.javaArgs && currentConfig.javaArgs.length > 0) {
        command += ` ${currentConfig.javaArgs.join(' ')}`;
      }
      
      command += ` -jar "${vanillaJar}" nogui`;
      break;
  }
  
  return command;
};

const getCurrentPaths = () => {
  return {
    serverPath: currentConfig.serverPath,
    jarFile: currentConfig.jarFile,
    serverHost: currentConfig.serverHost,
    serverPort: currentConfig.serverPort,
    serverType: currentConfig.serverType
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
  validatePaths,
  detectServerType,
  updateNeoForgeJvmArgs
};