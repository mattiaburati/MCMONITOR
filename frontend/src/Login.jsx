import { useState } from 'react'
import axios from 'axios'
import './Login.css'

// Funzione per ottenere l'URL API configurabile
const getApiBase = () => {
  return localStorage.getItem('api_base_url') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
}

function Login({ onLogin }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await axios.post(`${getApiBase()}/login`, credentials)
      const { token } = response.data
      
      localStorage.setItem('auth_token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      onLogin(token)
    } catch (error) {
      console.error('Errore login:', error)
      setError(error.response?.data?.error || 'Errore durante il login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🎮 Minecraft Monitor</h1>
          <h2>Accesso</h2>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
              disabled={isLoading}
              placeholder="Inserisci username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              disabled={isLoading}
              placeholder="Inserisci password"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-btn"
            disabled={isLoading || !credentials.username || !credentials.password}
          >
            {isLoading ? '🔄 Accesso...' : '🔑 Accedi'}
          </button>
        </form>

        <div className="login-info">
          <p>⚠️ Accesso richiesto per utilizzare il pannello di controllo</p>
        </div>
      </div>
    </div>
  )
}

export default Login