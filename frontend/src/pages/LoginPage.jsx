import { useState } from "react"
import "../styles/LoginPage.css"

function LoginPage({ onLogin }) {
  const [userType, setUserType] = useState(null) // "patient" or "doctor"
  const [formData, setFormData] = useState({ username: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleTypeSelect = (type) => {
    setUserType(type)
    setError("")
    setFormData({ username: "", password: "" })
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError("Please enter both username and password")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Simple validation - in production, verify against backend
      if (userType === "patient") {
        // Patient login
        if (formData.password.length < 3) {
          setError("Invalid credentials")
          setLoading(false)
          return
        }
        onLogin("patient", formData.username)
      } else if (userType === "doctor") {
        // Doctor login (doctors typically have stricter validation)
        if (!formData.username.includes("@") && formData.username.length < 5) {
          setError("Invalid doctor credentials")
          setLoading(false)
          return
        }
        onLogin("doctor", formData.username)
      }
    } catch (err) {
      setError("Login failed. Please try again.")
      setLoading(false)
    }
  }

  const handleBack = () => {
    setUserType(null)
    setError("")
    setFormData({ username: "", password: "" })
  }

  return (
    <div className="login-container">
      <div className="login-card">
        {!userType ? (
          /* Role Selection Screen */
          <>
            <div className="login-header">
              <h1>🏥 CliniQ Healthcare</h1>
              <p>Medical Triage & Appointment System</p>
            </div>

            <div className="role-selection">
              <p className="role-prompt">Who are you?</p>
              
              <button
                className="role-button patient-button"
                onClick={() => handleTypeSelect("patient")}
              >
                <div className="role-icon">👤</div>
                <div className="role-text">
                  <h3>Patient</h3>
                  <p>Book appointments & triage</p>
                </div>
              </button>

              <button
                className="role-button doctor-button"
                onClick={() => handleTypeSelect("doctor")}
              >
                <div className="role-icon">👨‍⚕️</div>
                <div className="role-text">
                  <h3>Doctor</h3>
                  <p>View patients & appointments</p>
                </div>
              </button>
            </div>
          </>
        ) : (
          /* Login Form Screen */
          <>
            <button className="back-button" onClick={handleBack}>
              ← Back
            </button>

            <div className="login-header">
              <h1>
                {userType === "patient" ? "👤 Patient Login" : "👨‍⚕️ Doctor Login"}
              </h1>
              <p>
                {userType === "patient"
                  ? "Access your health information and appointments"
                  : "View your patient list and appointments"}
              </p>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="username">
                  {userType === "patient" ? "Phone Number or Email" : "Doctor ID or Email"}
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder={
                    userType === "patient"
                      ? "Enter your phone number or email"
                      : "Enter your doctor ID (e.g., dr_sharma)"
                  }
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              <div className="demo-credentials">
                <p className="demo-title">Demo Credentials:</p>
                {userType === "patient" ? (
                  <>
                    <p>📱 Phone: 9876543210</p>
                    <p>🔑 Password: demo</p>
                  </>
                ) : (
                  <>
                    <p>👨‍⚕️ Doctor ID: dr_sharma</p>
                    <p>🔑 Password: doctor123</p>
                  </>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      <div className="login-footer">
        <p>🔒 Your health information is secure and confidential</p>
      </div>
    </div>
  )
}

export default LoginPage
