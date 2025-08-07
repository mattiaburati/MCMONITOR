import { useState, useEffect } from 'react'
import axios from 'axios'
import './ServerConfig.css'

// Funzione per ottenere l'URL API configurabile
const getApiBase = () => {
  return localStorage.getItem('api_base_url') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
}

function ServerConfig({ isVisible, onClose, serverStatus }) {
  const [config, setConfig] = useState({
    minRam: 1,
    maxRam: 2,
    javaArgs: [],
    serverPath: '',
    jarFile: '',
    serverHost: '',
    serverPort: ''
  })
  const [originalConfig, setOriginalConfig] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (isVisible) {
      fetchConfig()
    }
  }, [isVisible])

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${getApiBase()}/config`)
      const configData = response.data
      setConfig(configData)
      setOriginalConfig(configData)
      setHasChanges(false)
    } catch (error) {
      console.error('Errore nel recupero configurazione:', error)
    }
  }

  const handleInputChange = (field, value) => {
    let processedValue = value
    
    if (field === 'minRam' || field === 'maxRam') {
      processedValue = parseFloat(value)
    } else if (field === 'serverPort') {
      processedValue = value.toString()
    }
    
    const newConfig = {
      ...config,
      [field]: processedValue
    }
    setConfig(newConfig)
    
    // Controlla se ci sono cambiamenti
    const changed = JSON.stringify(newConfig) !== JSON.stringify(originalConfig)
    setHasChanges(changed)
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await axios.put(`${getApiBase()}/config`, config)
      setOriginalConfig(config)
      setHasChanges(false)
      alert('Configurazione salvata con successo!')
    } catch (error) {
      console.error('Errore salvataggio:', error)
      alert(error.response?.data?.error || 'Errore nel salvataggio')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setConfig(originalConfig)
    setHasChanges(false)
  }

  const isServerRunning = serverStatus === 'running'

  if (!isVisible) return null

  return (
    <div className="config-overlay">
      <div className="config-modal">
        <div className="config-header">
          <h2>⚙️ Configurazione Server</h2>
          <button 
            className="close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="config-content">
          {isServerRunning && (
            <div className="warning-banner">
              ⚠️ Server in esecuzione - Ferma il server per modificare la configurazione
            </div>
          )}

          <div className="config-section">
            <h3>📁 Percorsi Server</h3>
            
            <div className="config-row">
              <label htmlFor="serverPath">Directory Server Minecraft</label>
              <input
                type="text"
                id="serverPath"
                value={config.serverPath}
                onChange={(e) => handleInputChange('serverPath', e.target.value)}
                disabled={isServerRunning || isLoading}
                className="path-input"
                placeholder="/home/minecraft_server"
              />
            </div>

            <div className="config-row">
              <label htmlFor="jarFile">Nome file JAR</label>
              <input
                type="text"
                id="jarFile"
                value={config.jarFile}
                onChange={(e) => handleInputChange('jarFile', e.target.value)}
                disabled={isServerRunning || isLoading}
                className="path-input"
                placeholder="server.jar"
              />
            </div>

            <div className="config-row">
              <label htmlFor="serverHost">Host Server (per monitoraggio)</label>
              <input
                type="text"
                id="serverHost"
                value={config.serverHost}
                onChange={(e) => handleInputChange('serverHost', e.target.value)}
                disabled={isServerRunning || isLoading}
                className="path-input"
                placeholder="localhost"
              />
            </div>

            <div className="config-row">
              <label htmlFor="serverPort">Porta Server</label>
              <input
                type="number"
                id="serverPort"
                min="1"
                max="65535"
                value={config.serverPort}
                onChange={(e) => handleInputChange('serverPort', e.target.value)}
                disabled={isServerRunning || isLoading}
                className="port-input"
                placeholder="25565"
              />
            </div>
          </div>

          <div className="config-section">
            <h3>🧠 Configurazione RAM</h3>
            
            <div className="config-row">
              <label htmlFor="minRam">RAM Minima (GB)</label>
              <input
                type="number"
                id="minRam"
                min="0.5"
                max="32"
                step="0.5"
                value={config.minRam}
                onChange={(e) => handleInputChange('minRam', e.target.value)}
                disabled={isServerRunning || isLoading}
                className="ram-input"
              />
            </div>

            <div className="config-row">
              <label htmlFor="maxRam">RAM Massima (GB)</label>
              <input
                type="number"
                id="maxRam"
                min="0.5"
                max="32"
                step="0.5"
                value={config.maxRam}
                onChange={(e) => handleInputChange('maxRam', e.target.value)}
                disabled={isServerRunning || isLoading}
                className="ram-input"
              />
            </div>

            <div className="ram-preview">
              <div className="preview-item">
                <span className="preview-label">Percorso completo JAR:</span>
                <code className="preview-command">
                  {config.serverPath}/{config.jarFile}
                </code>
              </div>
              <div className="preview-item">
                <span className="preview-label">Comando Java:</span>
                <code className="preview-command">
                  cd "{config.serverPath}" && java -Xmx{config.maxRam}G -Xms{config.minRam}G -jar "{config.jarFile}" nogui
                </code>
              </div>
            </div>
          </div>

          <div className="ram-recommendations">
            <h4>💡 Raccomandazioni</h4>
            <ul>
              <li><strong>Percorso Server:</strong> Assicurati che la directory esista e contenga il server</li>
              <li><strong>File JAR:</strong> Specifica il nome esatto del file server (es. server.jar, paper.jar)</li>
              <li><strong>Host/Porta:</strong> Usa localhost:25565 se il server è sulla stessa macchina</li>
              <li><strong>RAM:</strong> 2-4GB per vanilla, 4-8GB+ per server modded</li>
              <li><strong>Sistema:</strong> Lascia almeno 2GB per il sistema operativo</li>
            </ul>
          </div>
        </div>

        <div className="config-footer">
          <button 
            className="btn-secondary"
            onClick={handleReset}
            disabled={!hasChanges || isLoading}
          >
            🔄 Reset
          </button>
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={!hasChanges || isServerRunning || isLoading}
          >
            {isLoading ? '💾 Salvando...' : '💾 Salva Configurazione'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ServerConfig