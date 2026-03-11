import "../styles/HomePage.css"

function HomePage({ onStartInterview }) {
  return (
    <div className="home-page">
      <div className="home-header">
        <h1>🎤 TalkScout</h1>
        <p>Master your interview skills with AI-powered practice</p>
      </div>

      <div className="home-intro">
        <p>Start a practice interview and answer questions as you go.</p>
      </div>

      <div className="topics-grid">
        <div className="topic-card" onClick={() => onStartInterview()}>
          <h3>General Interview</h3>
          <p className="topic-description">
            Adaptive questions based on your previous answers.
          </p>
          <p className="topic-count">Unlimited questions</p>
          <button className="start-button">Start Practice</button>
        </div>
      </div>

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
