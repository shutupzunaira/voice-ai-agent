import "../styles/HomePage.css"
import { useEffect, useState } from "react"

function HomePage({ onStartInterview, onBookAppointment }) {
  const [showOptions, setShowOptions] = useState(false)

  return (
    <div className="home-page">
      {/* Emergency Numbers Header */}
      <div className="emergency-header">
        <div className="emergency-badge">🚨 EMERGENCY NUMBERS</div>
        <div className="emergency-numbers">
          <div className="emergency-item">
            <span className="emergency-label">National Emergency (Police/Fire/Ambulance):</span>
            <span className="emergency-number">112</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Police:</span>
            <span className="emergency-number">100</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Fire:</span>
            <span className="emergency-number">101</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Ambulance:</span>
            <span className="emergency-number">102</span>
          </div>
          <div className="emergency-item">
            <span className="emergency-label">Mental Health / Suicide Helpline:</span>
            <span className="emergency-number">14416</span>
          </div>
        </div>
      </div>

      <div className="home-header">
        <div className="hospital-icon">🏥</div>
        <h1>CliniQ Medical Triage</h1>
        <p>Emergency Assessment & Urgent Care Routing</p>
      </div>

      <div className="home-intro">
        <p>Quick health evaluation with AI assistance. Book appointments, check availability, and manage your care through natural conversation.</p>
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
              <li>� Conversational appointment booking</li>
              <li>🔄 Easy rescheduling and cancellation</li>
              <li>ℹ️ Real-time clinic information and availability</li>
              <li>�🔐 Confidential and secure health information handling</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="assessment-options">
            <div className="assessment-card" onClick={() => onStartInterview('general')}>
              <h3>🩺 General Health Assessment</h3>
              <p>Evaluate general health concerns and determine appropriate care level</p>
              <p className="assessment-count">AI-powered triage • Voice/text support • Appointment booking</p>
            </div>

            <div className="assessment-card" onClick={() => onStartInterview('urgent')}>
              <h3>🚨 Urgent Care Evaluation</h3>
              <p>Assess potentially serious symptoms requiring immediate attention</p>
              <p className="assessment-count">Emergency detection • Priority routing • Urgent booking</p>
            </div>

            <div className="assessment-card" onClick={onBookAppointment}>
              <h3>📅 Book an Appointment</h3>
              <p>Schedule a direct appointment with available doctors</p>
              <p className="assessment-count">Flexible scheduling • Instant confirmation • Easy rescheduling</p>
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
