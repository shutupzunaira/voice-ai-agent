import "../styles/HomePage.css"
import { useEffect, useState } from "react"

function HomePage({ onStartInterview }) {
  const [showOptions, setShowOptions] = useState(false)
  // showTopics removed; topics display immediately when showOptions true
  const [topics, setTopics] = useState([])
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [topicsError, setTopicsError] = useState(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState("")
  const [feedbackEntries, setFeedbackEntries] = useState([])

  useEffect(() => {
    if (!showOptions) return

    const loadTopics = async () => {
      setTopicsLoading(true)
      setTopicsError(null)
      try {
        const res = await fetch("/topics")
        if (!res.ok) {
          // attempt to read text in case of HTML error page
          const text = await res.text()
          throw new Error(`Failed to fetch topics (${res.status}): ${text.slice(0,100)}`)
        }
        const data = await res.json()
        if (!data?.success) {
          throw new Error(data?.message || data?.error || `HTTP error: ${res.status}`)
        }
        setTopics(Array.isArray(data.topics) ? data.topics : [])
      } catch (e) {
        let msg = e?.message || "Failed to load topics"
        // strip HTML if accidentally returned
        if (msg.trim().startsWith("<")) {
          msg = "Server returned unexpected response."
        }
        setTopicsError(msg)
        setTopics([])
      } finally {
        setTopicsLoading(false)
      }
    }

    loadTopics()
  }, [showOptions])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("talkscout_feedback_entries")
      const parsed = raw ? JSON.parse(raw) : []
      setFeedbackEntries(Array.isArray(parsed) ? parsed : [])
    } catch {
      setFeedbackEntries([])
    }
  }, [])

  const saveFeedbackEntries = (entries) => {
    setFeedbackEntries(entries)
    try {
      localStorage.setItem("talkscout_feedback_entries", JSON.stringify(entries))
    } catch {
      // ignore
    }
  }

  const submitFeedback = () => {
    if (!rating) return
    const entry = {
      id: `${Date.now()}`,
      rating,
      text: feedbackText.trim(),
      createdAt: new Date().toISOString()
    }
    const next = [entry, ...feedbackEntries]
    saveFeedbackEntries(next)
    setFeedbackText("")
    setRating(0)
    setFeedbackOpen(false)
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <h1>Hello Interviewee, This is TalkScout</h1>
        <p>Master your interview skills with AI-powered practice</p>
      </div>

      <div className="home-intro">
        <p>Start a practice interview and answer questions as you go.</p>
      </div>

      {!showOptions ? (
        <>
          <div className="home-start">
            <button className="start-button" onClick={() => setShowOptions(true)}>
              Let us start
            </button>
          </div>

          <div className="home-features">
            <h2>Why TalkScout?</h2>
            <ul>
              <li>Real-time AI interviewer (interactive questions)</li>
              <li>Topic-based interview practice</li>
              <li>Voice + text answers</li>
              <li>Track and review your session feedback</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="topics-grid">
            {topicsLoading ? (
              <p className="topic-count">Loading topics...</p>
            ) : topicsError ? (
              <p className="topic-count">Error: {topicsError}</p>
            ) : topics.length === 0 ? (
              <p className="topic-count">No topics available</p>
            ) : (
              topics.map((t) => (
                <div
                  key={t.id}
                  className="topic-card"
                  onClick={() => onStartInterview?.(t.id)}
                >
                  <h3>{t.name}</h3>
                  <p className="topic-description">{t.description}</p>
                  <p className="topic-count">
                    {t.count || 0} {t.count === 1 ? "question" : "questions"}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="feedback-section">
            <div className="feedback-header-row">
              <h2>Give Feedback</h2>
              <button
                className="start-button"
                onClick={() => setFeedbackOpen((v) => !v)}
              >
                Give Feedback
              </button>
            </div>

            {feedbackOpen && (
              <div className="feedback-portal">
                <p className="topic-count" style={{ marginTop: "0" }}>
                  Rating (out of 5)
                </p>
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
                  rows={3}
                />

                <div className="feedback-actions">
                  <button
                    className="start-button"
                    onClick={submitFeedback}
                    disabled={!rating}
                  >
                    Submit
                  </button>
                  <button
                    className="start-button secondary"
                    onClick={() => setFeedbackOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="feedback-list">
              {feedbackEntries.length === 0 ? (
                <p className="topic-count" style={{ textAlign: "center" }}>
                  No feedback submitted yet.
                </p>
              ) : (
                feedbackEntries.map((e) => (
                  <div key={e.id} className="feedback-item">
                    <div className="feedback-item-top">
                      <div className="feedback-stars" aria-label={`Rated ${e.rating} out of 5`}>
                        {"★".repeat(e.rating)}
                        {"☆".repeat(5 - e.rating)}
                      </div>
                      <div className="feedback-date">
                        {new Date(e.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {e.text ? <div className="feedback-item-text">{e.text}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default HomePage
