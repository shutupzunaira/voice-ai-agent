import "../styles/HomePage.css"
import { useEffect, useState } from "react"

function HomePage({ onStartInterview }) {
  const [showOptions, setShowOptions] = useState(false)

  return (
    <div className="home-page">
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

      <div className="home-header">
        <div className="hospital-icon">🏥</div>
        <h1>CliniQ Medical Triage</h1>
        <p>Emergency Assessment & Urgent Care Routing</p>
      </div>

      <div className="home-intro">
        <p>Quick health evaluation to determine care urgency and next steps for your condition.</p>
      </div>

      {!showOptions ? (
        <>
          <div className="home-start">
            <button className="start-button" onClick={() => setShowOptions(true)}>
              Start Medical Assessment
            </button>
          </div>

          <div className="home-features">
            <h2>Why Choose CliniQ?</h2>
            <ul>
              <li>⚡ Rapid triage assessment with AI assistance</li>
              <li>🩺 Professional medical evaluation and routing</li>
              <li>🎤 Voice and text input options</li>
              <li>🔐 Confidential and secure health information handling</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="assessment-options">
            <div className="assessment-card" onClick={() => onStartInterview('general')}>
              <h3>🩺 General Health Assessment</h3>
              <p>Evaluate general health concerns and determine appropriate care level</p>
              <p className="assessment-count">AI-powered triage • Voice/text support</p>
            </div>

            <div className="assessment-card" onClick={() => onStartInterview('urgent')}>
              <h3>🚨 Urgent Care Evaluation</h3>
              <p>Assess potentially serious symptoms requiring immediate attention</p>
              <p className="assessment-count">Emergency detection • Priority routing</p>
            </div>

            <div className="assessment-card" onClick={() => onStartInterview('mental')}>
              <h3>🧠 Mental Health Screening</h3>
              <p>Initial assessment for mental health concerns and crisis support</p>
              <p className="assessment-count">Crisis detection • Support resources</p>
            </div>
          </div>

          <div className="assessment-notice">
            <p className="critical-warning">
              ⚠️ For life-threatening emergencies, call 911 immediately
            </p>
            <p className="disclaimer">
              This assessment tool helps route patients to appropriate care levels.
              All health information is handled confidentially and securely.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default HomePage
