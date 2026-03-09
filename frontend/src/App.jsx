import { useState } from "react"

function App() {

  const [response, setResponse] = useState("")

  function handleClick() {
    setResponse("Listening...")
  }

  return (
    <div style={{ textAlign: "center", marginTop: "120px" }}>

      <h1>Voice AI Assistant</h1>

      <button
        onClick={handleClick}
        style={{
          padding: "15px 30px",
          fontSize: "18px",
          borderRadius: "10px",
          cursor: "pointer",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none"
        }}
      >
        🎤 Start Talking
      </button>

      <p style={{ marginTop: "30px", fontSize: "18px" }}>
        AI Response: {response}
      </p>

    </div>
  )
}

export default App