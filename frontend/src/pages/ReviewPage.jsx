import "../styles/ReviewPage.css"

function ReviewPage({ topic, data, onBackToHome, onRestartInterview }) {
  const wordCounts = data.map((item) => {
    const count = (item.answer || "").split(/\s+/).filter((w) => w).length
    return count
  })

  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0)
  const averageWords = data.length > 0 ? Math.round(totalWords / data.length) : 0

  // Count feedback indicators
  let criticalCount = 0
  let warningCount = 0
  let positiveCount = 0

  data.forEach((item) => {
    const feedback = item.feedback || ""
    criticalCount += (feedback.match(/❌/g) || []).length
    warningCount += (feedback.match(/⚠️/g) || []).length
    positiveCount += (feedback.match(/✅/g) || []).length
  })

  // Simple score calculation
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        ((positiveCount * 2 - criticalCount * 3 - warningCount) /
          Math.max(1, data.length)) *
          20 +
          50
      )
    )
  )

  return (
    <div className="review-page">
      <div className="review-header">
        <button className="back-button-home" onClick={onBackToHome}>
          ← Back to Home
        </button>
        <h1>Interview Review</h1>
        <p className="topic-name">Topic: {topic}</p>
      </div>

      <div className="review-container">
        {/* SCORE SECTION */}
        <div className="review-section score-section">
          <h2>Your Score</h2>
          <div className="score-display">
            <div className="score-circle">{score}</div>
            <p className="score-label">
              {score >= 80
                ? "Excellent! 🌟"
                : score >= 60
                  ? "Good work! 👍"
                  : score >= 40
                    ? "Keep practicing 💪"
                    : "Room to improve 📈"}
            </p>
          </div>
        </div>

        {/* STATISTICS SECTION */}
        <div className="review-section stats-section">
          <h2>Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <p className="stat-label">Questions Answered</p>
              <p className="stat-value">{data.length}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Total Words Used</p>
              <p className="stat-value">{totalWords}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Average Words/Answer</p>
              <p className="stat-value">{averageWords}</p>
            </div>
            <div className="stat-item">
              <p className="stat-label">Feedback Points</p>
              <p className="stat-value">{data.length * 8}</p>
            </div>
          </div>
        </div>

        {/* FEEDBACK OVERVIEW */}
        <div className="review-section feedback-overview">
          <h2>Feedback Analysis</h2>
          <div className="feedback-summary">
            <div className="feedback-item critical">
              <p className="feedback-emoji">❌</p>
              <p className="feedback-text">Critical Issues: {criticalCount}</p>
            </div>
            <div className="feedback-item warning">
              <p className="feedback-emoji">⚠️</p>
              <p className="feedback-text">Warnings: {warningCount}</p>
            </div>
            <div className="feedback-item positive">
              <p className="feedback-emoji">✅</p>
              <p className="feedback-text">Strengths: {positiveCount}</p>
            </div>
          </div>
        </div>

        {/* DETAILED ANSWERS */}
        <div className="review-section answers-section">
          <h2>Your Answers & Feedback</h2>
          <div className="answers-list">
            {data.map((item, index) => {
              const wordCount = wordCounts[index] || 0
              return (
                <div key={index} className="answer-item">
                  <div className="answer-header">
                    <h3>Question {index + 1}</h3>
                    <p className="word-count">{wordCount} words</p>
                  </div>

                  <div className="answer-content">
                    <div className="your-answer">
                      <p className="answer-label">Your Answer:</p>
                      <p className="answer-text">{item.answer}</p>
                    </div>

                    <div className="ai-feedback">
                      <p className="feedback-label">AI Feedback:</p>
                      <div className="feedback-text">
                        {item.feedback.split("\n").map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="review-actions">
          <button className="action-button home-button" onClick={onBackToHome}>
            🏠 Back to Home
          </button>
          <button
            className="action-button restart-button"
            onClick={onRestartInterview}
          >
            🔄 Practice Again
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReviewPage
