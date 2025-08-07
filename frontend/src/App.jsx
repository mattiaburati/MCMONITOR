import { useState, useEffect } from 'react'
import axios from 'axios'
import Login from './Login'
import ServerConfig from './ServerConfig'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [serverStatus, setServerStatus] = useState('stopped')
  const [systemInfo, setSystemInfo] = useState({
    cpu: { usage: 0, cores: 0 },
    memory: { total: 0, used: 0, usage: 0 },
    disk: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [ws, setWs] = useState(null)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    // Verifica token esistente
    const token = localStorage.getItem('auth_token')
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setIsAuthenticated(true)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
    const websocket = new WebSocket(wsUrl)
    
    websocket.onopen = () => {
      console.log('Connessione WebSocket stabilita')
      setWs(websocket)
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'status') {
        setServerStatus(data.data.status)
      } else if (data.type === 'system') {
        setSystemInfo(prev => ({
          ...prev,
          cpu: { ...prev.cpu, usage: data.data.cpu },
          memory: { ...prev.memory, usage: data.data.memory }
        }))
      }
    }

    websocket.onclose = () => {
      console.log('Connessione WebSocket chiusa')
    }

    fetchSystemInfo()
    const interval = setInterval(fetchSystemInfo, 5000)

    return () => {
      clearInterval(interval)
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close()
      }
    }
  }, [isAuthenticated])

  const handleLogin = (token) => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    delete axios.defaults.headers.common['Authorization']
    setIsAuthenticated(false)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  const fetchSystemInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE}/system`)
      setSystemInfo(response.data)
    } catch (error) {
      console.error('Errore nel recupero dati sistema:', error)
      if (error.response?.status === 401) {
        handleLogout()
      }
    }
  }

  const handleServerAction = async (action) => {
    setIsLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/${action}`)
      console.log(response.data.message)
    } catch (error) {
      console.error(`Errore ${action}:`, error.response?.data?.error || error.message)
      if (error.response?.status === 401) {
        handleLogout()
      } else {
        alert(error.response?.data?.error || 'Errore nell\'operazione')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#4CAF50'
      case 'stopped': return '#f44336'
      case 'starting': 
      case 'stopping': 
      case 'restarting': return '#ff9800'
      default: return '#9e9e9e'
    }
  }

  const getUsageColor = (usage) => {
    if (usage < 50) return '#4CAF50'
    if (usage < 80) return '#ff9800'
    return '#f44336'
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 Minecraft Server Monitor</h1>
        <div className="header-buttons">
          <button 
            className="config-btn"
            onClick={() => setShowConfig(true)}
            title="Configurazione"
          >
            ⚙️ Config
          </button>
          <button 
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
          >
            🚪 Esci
          </button>
        </div>
      </header>

      <main className="main">
        <div className="status-section">
          <div className="status-card">
            <h2>Stato Server</h2>
            <div 
              className="status-indicator"
              style={{ backgroundColor: getStatusColor(serverStatus) }}
            >
              {serverStatus.toUpperCase()}
            </div>
            
            <div className="server-controls">
              <button 
                onClick={() => handleServerAction('start')}
                disabled={isLoading || serverStatus === 'running'}
                className="btn btn-start"
              >
                ▶️ Avvia
              </button>
              <button 
                onClick={() => handleServerAction('stop')}
                disabled={isLoading || serverStatus === 'stopped'}
                className="btn btn-stop"
              >
                ⏹️ Ferma
              </button>
              <button 
                onClick={() => handleServerAction('restart')}
                disabled={isLoading}
                className="btn btn-restart"
              >
                🔄 Restart
              </button>
            </div>
          </div>
        </div>

        <div className="metrics-section">
          <div className="metric-card">
            <h3>💻 CPU</h3>
            <div className="metric-value">
              <span className="percentage" style={{ color: getUsageColor(systemInfo.cpu.usage) }}>
                {systemInfo.cpu.usage}%
              </span>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${systemInfo.cpu.usage}%`,
                    backgroundColor: getUsageColor(systemInfo.cpu.usage)
                  }}
                />
              </div>
              <small>{systemInfo.cpu.cores} cores</small>
            </div>
          </div>

          <div className="metric-card">
            <h3>🧠 RAM</h3>
            <div className="metric-value">
              <span className="percentage" style={{ color: getUsageColor(systemInfo.memory.usage) }}>
                {systemInfo.memory.usage}%
              </span>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${systemInfo.memory.usage}%`,
                    backgroundColor: getUsageColor(systemInfo.memory.usage)
                  }}
                />
              </div>
              <small>{systemInfo.memory.used}GB / {systemInfo.memory.total}GB</small>
            </div>
          </div>

          {systemInfo.disk.map((disk, index) => (
            <div key={index} className="metric-card">
              <h3>💾 Disco {disk.filesystem}</h3>
              <div className="metric-value">
                <span className="percentage" style={{ color: getUsageColor(disk.usage) }}>
                  {disk.usage}%
                </span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${disk.usage}%`,
                      backgroundColor: getUsageColor(disk.usage)
                    }}
                  />
                </div>
                <small>{disk.used}GB / {disk.size}GB</small>
              </div>
            </div>
          ))}
        </div>
      </main>
      
      <ServerConfig
        isVisible={showConfig}
        onClose={() => setShowConfig(false)}
        serverStatus={serverStatus}
      />
    </div>
  )
}

export default App