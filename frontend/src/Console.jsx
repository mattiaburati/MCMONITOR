import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import axios from 'axios'
import './Console.css'

// Funzione per ottenere l'URL API dal file .env
const getApiBase = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
}

const Console = forwardRef(({ serverStatus, isVisible, onClose }, ref) => {
  const [logs, setLogs] = useState([])
  const [command, setCommand] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef(null)
  const logsContainerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    handleNewLog: (logEntry) => {
      setLogs(prevLogs => [...prevLogs, logEntry])
    }
  }))

  useEffect(() => {
    if (isVisible) {
      fetchLogs()
    }
  }, [isVisible])

  // Auto-scroll quando arrivano nuovi log
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // Verifica se l'utente sta facendo scroll manualmente
  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50
      setAutoScroll(isNearBottom)
    }
  }

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${getApiBase()}/logs`)
      setLogs(response.data.logs || [])
    } catch (error) {
      console.error('Errore nel recupero log:', error)
    }
  }

  // Funzione rimossa, ora gestita tramite useImperativeHandle

  const sendCommand = async (e) => {
    e.preventDefault()
    if (!command.trim() || serverStatus !== 'running') return

    setIsLoading(true)
    try {
      await axios.post(`${getApiBase()}/command`, { command })
      setCommand('')
    } catch (error) {
      console.error('Errore invio comando:', error)
      alert(error.response?.data?.error || 'Errore nell\'invio del comando')
    } finally {
      setIsLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  const getLogTypeClass = (type) => {
    switch (type) {
      case 'error':
      case 'stderr':
        return 'log-error'
      case 'warning':
        return 'log-warning'
      case 'success':
        return 'log-success'
      case 'command':
        return 'log-command'
      case 'system':
        return 'log-system'
      default:
        return 'log-info'
    }
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  if (!isVisible) return null

  return (
    <div className="console-overlay">
      <div className="console-modal">
        <div className="console-header">
          <h2>🖥️ Console Server</h2>
          <div className="console-header-buttons">
            <button 
              className="console-btn console-btn-clear"
              onClick={clearLogs}
              title="Pulisci log"
            >
              🗑️
            </button>
            <button 
              className="console-btn console-btn-scroll"
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? "Disabilita auto-scroll" : "Abilita auto-scroll"}
            >
              {autoScroll ? '🔒' : '🔓'}
            </button>
            <button 
              className="console-btn console-btn-refresh"
              onClick={fetchLogs}
              title="Aggiorna log"
            >
              🔄
            </button>
            <button 
              className="console-btn console-btn-close"
              onClick={onClose}
              title="Chiudi console"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="console-content">
          <div 
            className="console-logs" 
            ref={logsContainerRef}
            onScroll={handleScroll}
          >
            {logs.length === 0 ? (
              <div className="console-empty">
                <div className="empty-icon">📝</div>
                <p>Nessun log disponibile</p>
                <small>I log appariranno qui quando il server verrà avviato</small>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`console-log ${getLogTypeClass(log.type)}`}>
                  <span className="log-timestamp">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span className="log-message">
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          <div className="console-input-section">
            <div className="console-status">
              <span className={`status-indicator ${serverStatus}`}>
                {serverStatus === 'running' ? '🟢' : serverStatus === 'stopped' ? '🔴' : '🟡'}
              </span>
              <span className="status-text">
                {serverStatus === 'running' ? 'Server Online' : 
                 serverStatus === 'stopped' ? 'Server Offline' : 
                 'Server in transizione'}
              </span>
            </div>

            <form onSubmit={sendCommand} className="console-form">
              <div className="console-input-wrapper">
                <span className="console-prompt">{'>'}</span>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={serverStatus === 'running' ? 'Inserisci comando server (es: say Hello!)' : 'Server non in esecuzione'}
                  disabled={serverStatus !== 'running' || isLoading}
                  className="console-input"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!command.trim() || serverStatus !== 'running' || isLoading}
                  className="console-send-btn"
                  title="Invia comando"
                >
                  {isLoading ? '⏳' : '📤'}
                </button>
              </div>
            </form>

            <div className="console-help">
              <details>
                <summary>💡 Comandi comuni</summary>
                <div className="help-commands">
                  <div><code>say &lt;messaggio&gt;</code> - Invia messaggio a tutti i giocatori</div>
                  <div><code>list</code> - Lista giocatori online</div>
                  <div><code>tp &lt;player1&gt; &lt;player2&gt;</code> - Teletrasporta giocatori</div>
                  <div><code>gamemode creative &lt;player&gt;</code> - Cambia modalità gioco</div>
                  <div><code>weather clear</code> - Cambia tempo</div>
                  <div><code>time set day</code> - Cambia ora del giorno</div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Console