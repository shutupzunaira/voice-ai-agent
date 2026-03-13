import { useState } from "react"
import "./App.css"
import HomePage from "./pages/HomePage"
import TriagePage from "./pages/TriagePage"
import BookingPage from "./pages/BookingPage"

function App() {
  const [currentPage, setCurrentPage] = useState("home") // home, triage, booking
  const [triageMode, setTriageMode] = useState("general")

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