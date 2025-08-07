import { useState, useEffect } from 'react'
import './ApiConfig.css'

function ApiConfig({ isVisible, onClose, onConfigChange }) {
  const [config, setConfig] = useState({
    apiUrl: '',
    wsUrl: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Carica configurazione corrente
      const currentApiUrl = localStorage.getItem('api_base_url') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
      const currentWsUrl = localStorage.getItem('ws_url') || import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
      
      setConfig({
        apiUrl: currentApiUrl,
        wsUrl: currentWsUrl
      })
    }
  }, [isVisible])

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    setIsLoading(true)
    
    // Salva in localStorage
    localStorage.setItem('api_base_url', config.apiUrl)
    localStorage.setItem('ws_url', config.wsUrl)
    
    // Notifica il componente parent del cambiamento
    onConfigChange({
      apiUrl: config.apiUrl,
      wsUrl: config.wsUrl
    })
    
    setTimeout(() => {
      setIsLoading(false)
      onClose()
      // Ricarica la pagina per applicare le nuove configurazioni
      window.location.reload()
    }, 500)
  }

  const handleReset = () => {
    const defaultApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
    const defaultWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
    
    setConfig({
      apiUrl: defaultApiUrl,
      wsUrl: defaultWsUrl
    })
  }

  const getExampleUrls = () => {
    const currentHost = window.location.hostname
    const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1'
    
    if (isLocalhost) {
      return {
        api: 'http://localhost:3001/api',
        ws: 'ws://localhost:3001'
      }
    } else {
      return {
        api: `https://${currentHost}/api`,
        ws: `wss://${currentHost}/ws`
      }
    }
  }

  const examples = getExampleUrls()

  if (!isVisible) return null

  return (
    <div className="api-config-overlay">
      <div className="api-config-modal">
        <div className="api-config-header">
          <h2>🔧 Configurazione API</h2>
          <button 
            className="close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="api-config-content">
          <div className="config-info">
            <p>🔄 Configura gli URL per connetterti al backend in produzione</p>
          </div>

          <div className="config-section">
            <h3>🌐 URL Backend</h3>
            
            <div className="config-row">
              <label htmlFor="apiUrl">API Base URL</label>
              <input
                type="url"
                id="apiUrl"
                value={config.apiUrl}
                onChange={(e) => handleInputChange('apiUrl', e.target.value)}
                disabled={isLoading}
                className="api-input"
                placeholder={examples.api}
              />
              <small>Esempio: {examples.api}</small>
            </div>

            <div className="config-row">
              <label htmlFor="wsUrl">WebSocket URL</label>
              <input
                type="text"
                id="wsUrl"
                value={config.wsUrl}
                onChange={(e) => handleInputChange('wsUrl', e.target.value)}
                disabled={isLoading}
                className="api-input"
                placeholder={examples.ws}
              />
              <small>Esempio: {examples.ws}</small>
            </div>
          </div>

          <div className="config-examples">
            <h4>💡 Esempi comuni</h4>
            <div className="example-buttons">
              <button 
                className="example-btn"
                onClick={() => setConfig({
                  apiUrl: 'http://localhost:3001/api',
                  wsUrl: 'ws://localhost:3001'
                })}
              >
                🏠 Locale
              </button>
              <button 
                className="example-btn"
                onClick={() => setConfig({
                  apiUrl: `https://${window.location.hostname}/api`,
                  wsUrl: `wss://${window.location.hostname}/ws`
                })}
              >
                🌍 Produzione
              </button>
            </div>
          </div>

          <div className="config-warning">
            <p>⚠️ La pagina si ricaricherà automaticamente dopo il salvataggio</p>
          </div>
        </div>

        <div className="api-config-footer">
          <button 
            className="btn-secondary"
            onClick={handleReset}
            disabled={isLoading}
          >
            🔄 Default
          </button>
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={isLoading || !config.apiUrl || !config.wsUrl}
          >
            {isLoading ? '💾 Salvando...' : '💾 Salva e Ricarica'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ApiConfig