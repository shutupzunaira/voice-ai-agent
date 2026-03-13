import { useState } from "react"
import "./App.css"
import HomePage from "./pages/HomePage"
import TriagePage from "./pages/TriagePage"

function App() {
  const [currentPage, setCurrentPage] = useState("home") // home or triage
  const [triageMode, setTriageMode] = useState("general")

  const handleStartInterview = (mode) => {
    setTriageMode(mode)
    setCurrentPage("triage")
  }

  const handleBackToHome = () => {
    setCurrentPage("home")
  }

  return (
    <div className="app-container">
      {currentPage === "home" && (
        <HomePage onStartInterview={handleStartInterview} />
      )}
      {currentPage === "triage" && (
        <TriagePage
          triageMode={triageMode}
          onEndSession={handleBackToHome}
          onBack={handleBackToHome}
        />
      )}
    </div>
  )
}

export default App