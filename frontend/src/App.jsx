import { useState } from "react"
import "./App.css"
import HomePage from "./pages/HomePage"
import TriagePage from "./pages/TriagePage"
import BookingPage from "./pages/BookingPage"
import LoginPage from "./pages/LoginPage"
import DoctorDashboard from "./pages/DoctorDashboard"

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userType, setUserType] = useState(null) // "patient" or "doctor"
  const [userName, setUserName] = useState("")

  // Patient navigation state
  const [currentPage, setCurrentPage] = useState("home") // home, triage, booking
  const [triageMode, setTriageMode] = useState("general")

  // Authentication handlers
  const handleLogin = (type, username) => {
    setIsAuthenticated(true)
    setUserType(type)
    setUserName(username)
    setCurrentPage("home")
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUserType(null)
    setUserName("")
    setCurrentPage("home")
  }

  // Patient navigation handlers
  const handleStartInterview = (mode) => {
    setTriageMode(mode)
    setCurrentPage("triage")
  }

  const handleBookAppointment = () => {
    setCurrentPage("booking")
  }

  const handleBackToHome = () => {
    setCurrentPage("home")
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  // If doctor, show doctor dashboard
  if (userType === "doctor") {
    return (
      <DoctorDashboard doctorName={userName} onLogout={handleLogout} />
    )
  }

  // If patient, show normal patient interface
  return (
    <div className="app-container">
      {currentPage === "home" && (
        <HomePage
          onStartInterview={handleStartInterview}
          onBookAppointment={handleBookAppointment}
        />
      )}
      {currentPage === "triage" && (
        <TriagePage
          triageMode={triageMode}
          onEndSession={handleBackToHome}
          onBack={handleBackToHome}
        />
      )}
      {currentPage === "booking" && (
        <BookingPage onBack={handleBackToHome} />
      )}
    </div>
  )
}

export default App