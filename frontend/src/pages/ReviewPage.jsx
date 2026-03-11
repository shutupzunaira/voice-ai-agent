import "../styles/ReviewPage.css"

function ReviewPage({ topic, data, onBackToHome, onRestartInterview }) {
  // data = { feedback: string, stats: { totalQuestions, answered, skipped, topic } }
  const feedback = data?.feedback || "No feedback available."
  const stats = data?.stats || {}

  // Convert markdown-ish feedback text into paragraphs
  const feedbackLines = feedback.split("\n").filter((l) => l.trim())

  return (
    <div className="review-page">
      <div className="review-header">
        <button className="back-button-home" onClick={onBackToHome}>
          ← Back to Home
        </button>
        <h1>Interview Feedback</h1>
        <p className="topic-name">Topic: {stats.topic || topic}</p>
      </div>

      <div className="review-container">
        {/* STATISTICS SECTION */}
        <div className="review-section stats-section">
          <h2>Session Summary</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <p className="stat-label">Total Questions</p>
              <p className="stat-value">{stats.totalQuestions || 0}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Answered</p>
              <p className="stat-value">{stats.answered || 0}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Skipped</p>
              <p className="stat-value">{stats.skipped || 0}</p>
            </div>
          </div>
        </div>

        {/* AI FEEDBACK */}
        <div className="review-section feedback-detail-section">
          <h2>AI Feedback Report</h2>
          <div className="feedback-content">
            {feedbackLines.map((line, i) => {
              // Bold lines that look like headings (numbered or starting with **)
              const isHeading = /^\d+\.\s|^\*\*/.test(line.trim())
              return (
                <p key={i} className={isHeading ? "feedback-heading" : "feedback-line"}>
                  {line}
                </p>
              )
            })}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="review-actions">
          <button className="action-button home-button" onClick={onBackToHome}>
            🏠 Back to Home
          </button>
          <button className="action-button restart-button" onClick={onRestartInterview}>
            🔄 Practice Again
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReviewPage
