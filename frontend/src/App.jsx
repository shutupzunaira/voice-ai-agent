import { useState } from "react"
import "./App.css"
import TriagePage from "./pages/TriagePage"

function App() {
  const [currentPage, setCurrentPage] = useState("landing") // landing or triage

  const handleStartMedicalTriage = () => {
    setCurrentPage("triage")
  }

  const handleBackToLanding = () => {
    setCurrentPage("landing")
  }

  return (
    <div className="app-container">
      {currentPage === "landing" && (
        <LandingPage onStartTriage={handleStartMedicalTriage} />
      )}
      {currentPage === "triage" && (
        <TriagePage
          onEndSession={handleBackToLanding}
          onBack={handleBackToLanding}
        />
      )}
    </div>
  )
}

/* Landing Page Component */
function LandingPage({ onStartTriage }) {
  return (
    <div className="landing-container">
      {/* Emergency Numbers Header */}
      <div className="emergency-header">
        <div className="emergency-badge">🚨 EMERGENCY NUMBERS</div>
        <div className="emergency-numbers">
          <div className="emergency-item">
            <span className="emergency-label">Life-Threatening:</span>
            <span className="emergency-number">911</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Poison Control:</span>
            <span className="emergency-number">1-800-222-1222</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Mental Health Crisis:</span>
            <span className="emergency-number">988</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Suicide Prevention:</span>
            <span className="emergency-number">1-800-273-8255</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Domestic Violence:</span>
            <span className="emergency-number">1-800-799-7233</span>
          </div>
        </div>
      </div>

      <div className="landing-content">
        <div className="hospital-header">
          <div className="hospital-icon">🏥</div>
          <h1>Virtual Clinic Medical Assessment</h1>
          <p className="tagline">Professional Health Triage & Urgent Care Routing</p>
        </div>

        <div className="landing-options">
          <div className="landing-card triage-card" onClick={onStartTriage}>
            <div className="card-icon">🩺</div>
            <h2>Medical Assessment</h2>
            <p>Quick health evaluation to determine care urgency and next steps for your condition</p>
            <button className="card-button">Start Assessment</button>
          </div>
        </div>

        <div className="landing-features">
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <span>Rapid Assessment</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🛡️</span>
            <span>Patient Safe</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📋</span>
            <span>Proper Routing</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔐</span>
            <span>Confidential</span>
          </div>
        </div>

        <div className="landing-footer">
          <p>⚕️ This assessment tool helps route patients to appropriate care levels</p>
          <p className="critical-warning">⚠️ For life-threatening emergencies, call 911 immediately</p>
          <p className="disclaimer">All health information is handled confidentially and securely</p>
        </div>
      </div>
    </div>
  )
}

export default App