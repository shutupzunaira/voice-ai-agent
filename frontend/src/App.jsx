import { useState } from "react"
import "./App.css"
import HomePage from "./pages/HomePage"
import InterviewPage from "./pages/InterviewPage"
import ReviewPage from "./pages/ReviewPage"

function App() {
  const [currentPage, setCurrentPage] = useState("home") // home, interview, review
  const [interviewData, setInterviewData] = useState([])

  const handleStartInterview = () => {
    setInterviewData([])
    setCurrentPage("interview")
  }

  const handleEndInterview = (data) => {
    setInterviewData(data)
    setCurrentPage("review")
  }

  const handleBackToHome = () => {
    setCurrentPage("home")
    setInterviewData([])
  }

  const handleRestartInterview = () => {
    setInterviewData([])
    setCurrentPage("interview")
  }

  return (
    <div className="app-container">
      {currentPage === "home" && (
        <HomePage onStartInterview={handleStartInterview} />
      )}
      {currentPage === "interview" && (
        <InterviewPage
          onEndInterview={handleEndInterview}
          onBack={handleBackToHome}
        />
      )}
      {currentPage === "review" && (
        <ReviewPage
          topic={"General"}
          data={interviewData}
          onBackToHome={handleBackToHome}
          onRestartInterview={handleRestartInterview}
        />
      )}
    </div>
  )
}

export default App