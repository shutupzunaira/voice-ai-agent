import { useState } from "react"
import "./App.css"
import HomePage from "./pages/HomePage"
import InterviewPage from "./pages/InterviewPage"
import ReviewPage from "./pages/ReviewPage"

function App() {
  const [currentPage, setCurrentPage] = useState("home") // home, interview, review
  const [selectedTopic, setSelectedTopic] = useState("general")
  const [reviewData, setReviewData] = useState(null) // { feedback, stats }

  const handleStartInterview = (topicId = "general") => {
    setSelectedTopic(topicId)
    setReviewData(null)
    setCurrentPage("interview")
  }

  const handleEndInterview = (data) => {
    // data = { feedback: string, stats: { totalQuestions, answered, skipped, topic } }
    setReviewData(data)
    setCurrentPage("review")
  }

  const handleBackToHome = () => {
    setCurrentPage("home")
  }

  const handleRestartInterview = () => {
    setReviewData(null)
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
          data={reviewData}
          onBackToHome={handleBackToHome}
          onRestartInterview={handleRestartInterview}
        />
      )}
    </div>
  )
}

export default App