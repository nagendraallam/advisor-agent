import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

function Dashboard({ user }) {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    if (user.hubspotConnected) {
      fetchSyncStatus();
    }
  }, [user.hubspotConnected]);

  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get('/api/sync/status', { withCredentials: true });
      setSyncStatus(response.data.statuses);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.post('/api/sync/all', {}, { withCredentials: true });
      await axios.post('/api/embeddings/generate', {}, { withCredentials: true });
      await fetchSyncStatus();
      alert('Data synced successfully!');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleHubSpotConnect = () => {
    setConnecting(true);
    window.location.href = '/auth/hubspot';
  };

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  return (
    <div className="dashboard-page">
      <nav className="dashboard-nav">
        <div className="nav-content">
          <div className="logo">
            <h2>🤖 Advisor AI</h2>
          </div>
          <div className="nav-actions">
            <div className="user-info">
              {user.avatar && <img src={user.avatar} alt={user.name} className="user-avatar" />}
              <span className="user-name">{user.name}</span>
            </div>
            <button onClick={handleLogout} className="btn-outline">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="dashboard-container">
          {!user.hubspotConnected ? (
            <div className="connect-section">
              <div className="connect-card">
                <div className="connect-header">
                  <div className="hubspot-logo">
                    <svg viewBox="0 0 24 24" width="60" height="60">
                      <path fill="#ff7a59" d="M18.9 20.6c-1.4 1.4-3.7 1.4-5.1 0l-2.8-2.8c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0l2.8 2.8c.6.6 1.5.6 2.1 0 .6-.6.6-1.5 0-2.1l-2.8-2.8c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0l2.8 2.8c1.4 1.4 1.4 3.6 0 5.1zm-6.4-6.4l-2.8 2.8c-.6.6-1.5.6-2.1 0-.6-.6-.6-1.5 0-2.1l2.8-2.8c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0l-2.8 2.8c-1.4 1.4-3.7 1.4-5.1 0-1.4-1.4-1.4-3.7 0-5.1l2.8-2.8c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4L2.5 9c-.6.6-.6 1.5 0 2.1.6.6 1.5.6 2.1 0l2.8-2.8c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4zm9.9-9.8c-1.4-1.4-3.7-1.4-5.1 0l-2.8 2.8c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l2.8-2.8c.6-.6 1.5-.6 2.1 0 .6.6.6 1.5 0 2.1l-2.8 2.8c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l2.8-2.8c1.4-1.4 1.4-3.7 0-5.1z"/>
                    </svg>
                  </div>
                  <h1>Connect to HubSpot CRM</h1>
                  <p>To unlock the full power of your AI advisor, connect your HubSpot account</p>
                </div>

                <div className="connect-benefits">
                  <h3>What you'll get access to:</h3>
                  <div className="benefit-list">
                    <div className="benefit-item">
                      <span className="benefit-icon">👥</span>
                      <div>
                        <h4>Contacts</h4>
                        <p>Access all your customer and lead information</p>
                      </div>
                    </div>
                    <div className="benefit-item">
                      <span className="benefit-icon">🏢</span>
                      <div>
                        <h4>Companies</h4>
                        <p>View and manage company records</p>
                      </div>
                    </div>
                    <div className="benefit-item">
                      <span className="benefit-icon">💼</span>
                      <div>
                        <h4>Deals</h4>
                        <p>Track your sales pipeline and opportunities</p>
                      </div>
                    </div>
                    <div className="benefit-item">
                      <span className="benefit-icon">🤖</span>
                      <div>
                        <h4>AI Insights</h4>
                        <p>Get intelligent recommendations based on your data</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="connect-actions">
                  <button 
                    onClick={handleHubSpotConnect} 
                    className="btn-primary btn-large"
                    disabled={connecting}
                  >
                    {connecting ? 'Connecting...' : 'Connect HubSpot Account'}
                  </button>
                  <p className="connect-note">
                    🔒 Your data is secure. We only request read access to provide insights.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="connected-section">
              <div className="success-card">
                <div className="success-icon">✅</div>
                <h1>HubSpot Connected!</h1>
                <p>Your account is successfully connected and ready to go.</p>
                
                {syncStatus && (
                  <div className="sync-status-section">
                    <h3>📊 Sync Status</h3>
                    <div className="sync-status-grid">
                      {syncStatus.gmail && (
                        <div className="status-item">
                          <div className="status-header">
                            <span className="status-icon">📧</span>
                            <span className="status-label">Gmail</span>
                          </div>
                          <div className={`status-badge ${syncStatus.gmail.status}`}>
                            {syncStatus.gmail.status}
                          </div>
                          {syncStatus.gmail.lastSyncAt && (
                            <div className="status-time">
                              Last synced: {new Date(syncStatus.gmail.lastSyncAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {syncStatus.hubspot && (
                        <div className="status-item">
                          <div className="status-header">
                            <span className="status-icon">🏢</span>
                            <span className="status-label">HubSpot</span>
                          </div>
                          <div className={`status-badge ${syncStatus.hubspot.status}`}>
                            {syncStatus.hubspot.status}
                          </div>
                          {syncStatus.hubspot.lastSyncAt && (
                            <div className="status-time">
                              Last synced: {new Date(syncStatus.hubspot.lastSyncAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={handleSync} 
                      className="btn-outline"
                      disabled={syncing}
                    >
                      {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
                    </button>
                  </div>
                )}
                
                <button 
                  onClick={() => navigate('/chat')} 
                  className="btn-primary btn-large"
                >
                  Start Chatting with AI
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;

