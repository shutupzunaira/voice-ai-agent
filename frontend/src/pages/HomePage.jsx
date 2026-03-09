import { useState, useEffect } from "react"
import "../styles/HomePage.css"

function HomePage({ onStartInterview }) {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch("/topics")
        if (!response.ok) {
          throw new Error("Failed to fetch topics")
        }
        const data = await response.json()
        setTopics(data.topics || [])
      } catch (err) {
        console.error("Error fetching topics:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTopics()
  }, [])

  return (
    <div className="home-page">
      <div className="home-header">
        <h1>🎤 TalkScout</h1>
        <p>Master your interview skills with AI-powered practice</p>
      </div>

      <div className="home-intro">
        <p>Select an interview topic to get started:</p>
      </div>

      {loading && <p className="loading-message">Loading topics...</p>}
      {error && <p className="error-message">Error: {error}</p>}

      <div className="topics-grid">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="topic-card"
            onClick={() => onStartInterview(topic.id)}
          >
            <h3>{topic.name}</h3>
            <p className="topic-description">{topic.description}</p>
            <p className="topic-count">
              {topic.count || 0} {topic.count === 1 ? "question" : "questions"}
            </p>
            <button className="start-button">Start Practice</button>
          </div>
        ))}
      </div>

      {topics.length === 0 && !loading && !error && (
        <p className="no-topics">No topics available. Please try again later.</p>
      )}

      <div className="home-features">
        <h2>Why TalkScout?</h2>
        <ul>
          <li>✨ Real-time AI feedback on your answers</li>
          <li>🎯 Topic-specific interview questions</li>
          <li>📊 Track your progress and improvements</li>
          <li>🎤 Practice with voice or text input</li>
        </ul>
      </div>
    </div>
  )
}

export default HomePage
