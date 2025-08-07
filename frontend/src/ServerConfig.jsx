import { useState, useEffect } from 'react'
import axios from 'axios'
import './ServerConfig.css'

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api'

function ServerConfig({ isVisible, onClose, serverStatus }) {
  const [config, setConfig] = useState({
    minRam: 1,
    maxRam: 2,
    javaArgs: []
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
      const response = await axios.get(`${API_BASE}/config`)
      const configData = response.data
      setConfig(configData)
      setOriginalConfig(configData)
      setHasChanges(false)
    } catch (error) {
      console.error('Errore nel recupero configurazione:', error)
    }
  }

  const handleInputChange = (field, value) => {
    const numValue = field === 'javaArgs' ? value : parseFloat(value)
    const newConfig = {
      ...config,
      [field]: numValue
    }
    setConfig(newConfig)
    
    // Controlla se ci sono cambiamenti
    const changed = JSON.stringify(newConfig) !== JSON.stringify(originalConfig)
    setHasChanges(changed)
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await axios.put(`${API_BASE}/config`, config)
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
                <span className="preview-label">Comando Java:</span>
                <code className="preview-command">
                  java -Xmx{config.maxRam}G -Xms{config.minRam}G -jar server.jar nogui
                </code>
              </div>
            </div>
          </div>

          <div className="ram-recommendations">
            <h4>💡 Raccomandazioni</h4>
            <ul>
              <li><strong>Vanilla/Paper:</strong> 2-4GB per 10-20 giocatori</li>
              <li><strong>Modded:</strong> 4-8GB+ a seconda dei mod</li>
              <li><strong>RAM Sistema:</strong> Lascia almeno 2GB per il sistema operativo</li>
              <li><strong>Regola generale:</strong> MIN = MAX/2 per prestazioni ottimali</li>
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