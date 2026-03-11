import { useState } from "react"

function FeedbackPage({ onSubmit, onBack }) {
  const [rating, setRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!rating) return

    const entry = {
      id: `${Date.now()}`,
      rating,
      text: feedbackText.trim(),
      createdAt: new Date().toISOString()
    }

    onSubmit?.(entry)
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <button className="back-button-home" onClick={onBack}>
          ← Back
        </button>
        <h1>Give Feedback</h1>
        <p>Rate your TalkScout experience and share your thoughts.</p>
      </div>

      <form
        className="feedback-section"
        onSubmit={handleSubmit}
        style={{ maxWidth: 700 }}
      >
        <h2>Your Rating</h2>
        <p className="topic-count">Rating (out of 5)</p>

        <div className="star-row" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`star-button ${n <= rating ? "active" : ""}`}
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className="feedback-textarea"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Optional: write your feedback here..."
          rows={4}
        />

        <div className="feedback-actions">
          <button className="start-button" type="submit" disabled={!rating}>
            Submit Feedback
          </button>
          <button
            type="button"
            className="start-button secondary"
            onClick={onBack}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default FeedbackPage

