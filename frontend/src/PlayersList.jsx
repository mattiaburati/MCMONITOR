import { useState, useEffect } from 'react'
import axios from 'axios'
import './PlayersList.css'

// Funzione per ottenere l'URL API configurabile
const getApiBase = () => {
  return localStorage.getItem('api_base_url') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
}

function PlayersList({ serverStatus, playersData }) {
  const [players, setPlayers] = useState([])
  const [serverInfo, setServerInfo] = useState({ online: 0, max: 0, version: '', motd: '' })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchPlayers()
  }, [serverStatus])

  // Aggiorna i dati quando arrivano via WebSocket
  useEffect(() => {
    if (playersData) {
      setPlayers(playersData.players || [])
      setServerInfo(playersData.info || { online: 0, max: 0, version: '', motd: '' })
    }
  }, [playersData])

  const fetchPlayers = async () => {
    if (serverStatus !== 'running') {
      setPlayers([])
      setServerInfo({ online: 0, max: 0, version: '', motd: '' })
      return
    }

    setIsLoading(true)
    try {
      const response = await axios.get(`${getApiBase()}/players`)
      setPlayers(response.data.players || [])
      setServerInfo(response.data.info || { online: 0, max: 0, version: '', motd: '' })
    } catch (error) {
      console.error('Errore nel recupero giocatori:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchPlayers()
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return '🟢'
      case 'stopped': return '🔴'
      case 'starting': 
      case 'stopping': 
      case 'restarting': return '🟡'
      default: return '⚫'
    }
  }

  const formatMotd = (motd) => {
    if (!motd) return 'Server Minecraft'
    return motd.length > 50 ? motd.substring(0, 47) + '...' : motd
  }

  return (
    <div className="players-card">
      <div className="players-header">
        <h3>👥 Giocatori Online</h3>
        <div className="players-actions">
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading || serverStatus !== 'running'}
            title="Aggiorna lista giocatori"
          >
            {isLoading ? '🔄' : '↻'}
          </button>
        </div>
      </div>

      <div className="server-status-info">
        <div className="status-row">
          <span className="status-icon">{getStatusIcon(serverStatus)}</span>
          <span className="status-text">{serverStatus.toUpperCase()}</span>
          {serverStatus === 'running' && (
            <span className="player-count">
              {serverInfo.online}/{serverInfo.max}
            </span>
          )}
        </div>
        
        {serverStatus === 'running' && serverInfo.motd && (
          <div className="server-motd">
            "{formatMotd(serverInfo.motd)}"
          </div>
        )}

        {serverStatus === 'running' && serverInfo.version && (
          <div className="server-version">
            📦 {serverInfo.version}
          </div>
        )}
      </div>

      <div className="players-content">
        {serverStatus !== 'running' ? (
          <div className="players-empty">
            <div className="empty-icon">💤</div>
            <p>Server offline</p>
          </div>
        ) : players.length === 0 ? (
          <div className="players-empty">
            <div className="empty-icon">👻</div>
            <p>Nessun giocatore online</p>
          </div>
        ) : (
          <div className="players-list">
            {players.map((player, index) => (
              <div key={player.uuid || index} className="player-item">
                <div className="player-avatar">
                  <img 
                    src={`https://mc-heads.net/avatar/${player.name}/32`}
                    alt={player.name}
                    onError={(e) => {
                      e.target.src = 'https://mc-heads.net/avatar/Steve/32'
                    }}
                  />
                </div>
                <div className="player-info">
                  <div className="player-name">{player.name}</div>
                  <div className="player-status">🟢 Online</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {serverStatus === 'running' && (
        <div className="players-footer">
          <div className="connection-info">
            📡 Connesso a {process.env.MINECRAFT_SERVER_HOST || 'localhost'}:{process.env.MINECRAFT_SERVER_PORT || 25565}
          </div>
          <div className="last-update">
            Ultimo aggiornamento: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayersList