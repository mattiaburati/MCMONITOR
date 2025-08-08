import { useState, useEffect } from 'react';
import axios from 'axios';
import './ModManager.css';

const getApiBase = () => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
};

const ModManager = ({ isVisible, onClose }) => {
  const [mods, setMods] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      fetchMods();
    }
  }, [isVisible]);

  const fetchMods = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get(`${getApiBase()}/mods`);
      setMods(response.data.mods);
    } catch (error) {
      console.error('Errore recupero mods:', error);
      setError('Errore nel recupero delle mod');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.jar')) {
      setError('Solo file .jar sono supportati');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('modFile', file);

    try {
      const response = await axios.post(`${getApiBase()}/mods/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log(response.data.message);
      await fetchMods();
      event.target.value = '';
    } catch (error) {
      console.error('Errore upload mod:', error);
      setError(error.response?.data?.error || 'Errore nel caricamento del file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMod = async (filename) => {
    if (!confirm(`Sei sicuro di voler eliminare la mod "${filename}"?`)) {
      return;
    }

    try {
      await axios.delete(`${getApiBase()}/mods/${encodeURIComponent(filename)}`);
      console.log('Mod eliminata con successo');
      await fetchMods();
    } catch (error) {
      console.error('Errore eliminazione mod:', error);
      setError(error.response?.data?.error || 'Errore nell\'eliminazione della mod');
    }
  };

  const formatFileSize = (sizeKB) => {
    if (sizeKB < 1024) {
      return `${sizeKB} KB`;
    } else {
      return `${(sizeKB / 1024).toFixed(1)} MB`;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  if (!isVisible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content mod-manager-modal">
        <div className="modal-header">
          <h2>🔧 Gestione Mod</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="upload-section">
            <h3>Carica Nuova Mod</h3>
            <div className="upload-area">
              <input
                type="file"
                accept=".jar"
                onChange={handleFileUpload}
                disabled={uploading}
                className="file-input"
                id="mod-file"
              />
              <label htmlFor="mod-file" className={`file-label ${uploading ? 'uploading' : ''}`}>
                {uploading ? (
                  <>
                    <span className="loading-spinner">⏳</span>
                    Caricamento...
                  </>
                ) : (
                  <>
                    📁 Scegli file .jar
                  </>
                )}
              </label>
            </div>
            <p className="upload-hint">
              Solo file .jar sono supportati (max 100MB)
            </p>
          </div>

          <div className="mods-section">
            <div className="mods-header">
              <h3>Mod Installate ({mods.length})</h3>
              <button 
                onClick={fetchMods} 
                disabled={isLoading}
                className="refresh-btn"
              >
                {isLoading ? '🔄' : '🔄'} Aggiorna
              </button>
            </div>

            {isLoading ? (
              <div className="loading-state">
                <span className="loading-spinner">⏳</span>
                Caricamento mod...
              </div>
            ) : mods.length === 0 ? (
              <div className="empty-state">
                <p>📦 Nessuna mod installata</p>
                <p>Carica il tuo primo file .jar per iniziare!</p>
              </div>
            ) : (
              <div className="mods-list">
                {mods.map((mod, index) => (
                  <div key={index} className="mod-item">
                    <div className="mod-info">
                      <div className="mod-name">
                        📦 {mod.filename}
                      </div>
                      <div className="mod-details">
                        <span className="mod-size">{formatFileSize(mod.size)}</span>
                        <span className="mod-date">
                          Modificato: {formatDate(mod.lastModified)}
                        </span>
                      </div>
                    </div>
                    <div className="mod-actions">
                      <button
                        onClick={() => handleDeleteMod(mod.filename)}
                        className="delete-btn"
                        title="Elimina mod"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="info-text">
            ⚠️ Le modifiche alle mod richiedono il riavvio del server per essere applicate
          </div>
          <button onClick={onClose} className="btn-secondary">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModManager;