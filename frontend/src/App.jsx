import { useState } from "react"
import "./App.css"
import HomePage from "./pages/HomePage"
import InterviewPage from "./pages/InterviewPage"
import ReviewPage from "./pages/ReviewPage"
import FeedbackPage from "./pages/FeedbackPage"

function App() {
  const [currentPage, setCurrentPage] = useState("home") // home, interview, review, feedback
  const [interviewData, setInterviewData] = useState([])
  const [selectedTopic, setSelectedTopic] = useState("general")
  const [feedbackEntries, setFeedbackEntries] = useState([])

  const handleStartInterview = (topicId = "general") => {
    setInterviewData([])
    setSelectedTopic(topicId)
    setCurrentPage("interview")
  }

  const handleEndInterview = (data) => {
    setInterviewData(data)
    setCurrentPage("review")
  }

  const handleBackToHome = () => {
    setCurrentPage("home")
  }

  const handleRestartInterview = () => {
    setInterviewData([])
    setCurrentPage("interview")
  }

  const handleOpenFeedback = () => {
    setCurrentPage("feedback")
  }

  const handleFeedbackSubmit = (entry) => {
    setFeedbackEntries((prev) => [entry, ...prev])
    setCurrentPage("interview")
  }

  const handleFeedbackBack = () => {
    setCurrentPage("interview")
  }

  return (
    <div className="app-container">
      {currentPage === "home" && (
        <HomePage
          onStartInterview={handleStartInterview}
        />
      )}
      {currentPage === "interview" && (
        <InterviewPage
          topic={selectedTopic}
          onEndInterview={handleEndInterview}
          onBack={handleBackToHome}
          onOpenFeedback={handleOpenFeedback}
          feedbackEntries={feedbackEntries}
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
      {currentPage === "feedback" && (
        <FeedbackPage
          onSubmit={handleFeedbackSubmit}
          onBack={handleFeedbackBack}
        />
      )}
    </div>
  )
}

export default App