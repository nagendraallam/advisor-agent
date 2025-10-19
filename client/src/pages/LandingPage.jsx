import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

function LandingPage({ user }) {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="nav-content">
          <div className="logo">
            <h2>🤖 Advisor AI</h2>
          </div>
          <div className="nav-actions">
            {user ? (
              <>
                <span className="user-name">Welcome, {user.name}</span>
                <button onClick={() => navigate('/dashboard')} className="btn-primary">
                  Dashboard
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className="btn-primary">
                Get Started
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="hero">
        <div className="hero-content">
          <h1>AI-Powered Business Advisor</h1>
          <p className="hero-subtitle">
            Connect your HubSpot CRM and get intelligent insights powered by AI.
            Manage your contacts, deals, and calendar seamlessly.
          </p>
          <div className="hero-actions">
            <button onClick={() => navigate('/login')} className="btn-primary btn-large">
              Get Started Free
            </button>
          </div>

          <div className="features">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>CRM Integration</h3>
              <p>Connect with HubSpot to access all your business data</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI Assistant</h3>
              <p>Get intelligent insights and recommendations</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📧</div>
              <h3>Email & Calendar</h3>
              <p>Manage Gmail and Google Calendar seamlessly</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default LandingPage;


