import { useState } from "react"
import "./App.css"
import HomePage from "./pages/HomePage"
import InterviewPage from "./pages/InterviewPage"
import ReviewPage from "./pages/ReviewPage"

function App() {
  const [currentPage, setCurrentPage] = useState("home") // home, interview, review
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [interviewData, setInterviewData] = useState([])

  const handleStartInterview = (topic) => {
    setSelectedTopic(topic)
    setInterviewData([])
    setCurrentPage("interview")
  }

  const handleEndInterview = (data) => {
    setInterviewData(data)
    setCurrentPage("review")
  }

  const handleBackToHome = () => {
    setCurrentPage("home")
    setSelectedTopic(null)
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
          topic={selectedTopic}
          onEndInterview={handleEndInterview}
          onBack={handleBackToHome}
        />
      )}
      {currentPage === "review" && (
        <ReviewPage
          topic={selectedTopic}
          data={interviewData}
          onBackToHome={handleBackToHome}
          onRestartInterview={handleRestartInterview}
        />
      )}
    </div>
  )
}

export default App