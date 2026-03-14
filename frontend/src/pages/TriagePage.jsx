import { useState, useRef, useEffect, useCallback } from "react"
import "../styles/TriagePage.css"
import DatabaseSearchResults from "../components/DatabaseSearchResults"

function TriagePage({ triageMode = "general", onEndSession, onBack }) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [triageLevel, setTriageLevel] = useState("UNCLEAR")
  const [databaseSearchResults, setDatabaseSearchResults] = useState(null)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [showAppointmentSuggestion, setShowAppointmentSuggestion] = useState(false)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [hospitalData, setHospitalData] = useState(null)
  const [appointmentConfirmed, setAppointmentConfirmed] = useState(false)
  const [appointmentDetails, setAppointmentDetails] = useState(null)

  const recognitionRef = useRef(null)
  const recordingIntervalRef = useRef(null)
  const fullTranscriptRef = useRef("")
  const chatBoxRef = useRef(null)
  const silenceTimeoutRef = useRef(null)
  const latestSubmitAnswerRef = useRef(null)
  const requestIdRef = useRef(0)
  const autoStartListeningRef = useRef(false)
  const responseInProgressRef = useRef(false)

  /* ─── Simulated Hospital Database with GPS Coordinates ─── */
  const hospitals = [
    {
      name: "Apollo Hospital Mumbai",
      address: "Navi Mumbai, Maharashtra - 400706",
      phone: "+91-22-6755-6000",
      lat: 19.0176,
      lng: 73.1142,
      waitTime: "~15 minutes",
      specialties: "Emergency Care, Trauma Center, 24/7 ICU"
    },
    {
      name: "Fortis Healthcare Delhi",
      address: "Okhla Road, New Delhi - 110025",
      phone: "+91-11-4159-5000",
      lat: 28.5241,
      lng: 77.1788,
      waitTime: "~12 minutes",
      specialties: "Emergency Care, Multi-specialty, Ambulance Ready"
    },
    {
      name: "Max Healthcare Bangalore",
      address: "RMZ Ecoworld, Whitefield, Bangalore - 560066",
      phone: "+91-80-6788-9999",
      lat: 13.0298,
      lng: 77.6455,
      waitTime: "~18 minutes",
      specialties: "24/7 Emergency, Trauma Center, Advanced ICU"
    },
    {
      name: "AIIMS Delhi Emergency Ward",
      address: "Ansari Nagar East, New Delhi - 110029",
      phone: "+91-11-2659-3311",
      lat: 28.5669,
      lng: 77.2150,
      waitTime: "~20 minutes",
      specialties: "Government Hospital, Emergency Services, Free Care"
    },
    {
      name: "Columbia Asia Hospital Pune",
      address: "Viman Nagar, Pune - 411014",
      phone: "+91-20-6654-5000",
      lat: 18.5627,
      lng: 73.9208,
      waitTime: "~16 minutes",
      specialties: "Emergency Department, Cardiology, Neurology"
    }
  ]

  /* ─── Haversine Formula: Calculate distance between two coordinates ─── */
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLng = (lng2 - lng1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in km
  }

  /* ─── Find nearest hospitals based on user's location ─── */
  const findNearestHospitals = (userLat, userLng) => {
    const hospitalsWithDistance = hospitals.map((h) => ({
      ...h,
      distanceInKm: calculateDistance(userLat, userLng, h.lat, h.lng)
    }))
    return hospitalsWithDistance.sort((a, b) => a.distanceInKm - b.distanceInKm).slice(0, 3) // Top 3 nearest
  }

  /* ─── Helpers ─── */
  const addMessage = useCallback((sender, text, searchData = null, appointmentSlots = null, emergencyRouting = null) => {
    setMessages((prev) => [...prev, { sender, text, searchData, appointmentSlots, emergencyRouting }])
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatBoxRef.current) {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
      }
    }, 50)
  }, [])

  /* ─── TTS (Text-to-Speech) ─── */
  function stopSpeaking() {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    } catch { /* ignore */ }
    setIsSpeaking(false)
  }

  function pauseListening() {
    if (recognitionRef.current && autoStartListeningRef.current) {
      try {
        recognitionRef.current.stop()
      } catch { /* ignore */ }
    }
  }

  function speak(text) {
    return new Promise((resolve) => {
      try {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve()
          return
        }
        window.speechSynthesis.cancel()
        
        // PAUSE listening while AI speaks to avoid picking up its own voice
        pauseListening()
        
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = "en-US"
        utterance.rate = 1.8  // URGENT CARE: Fast speech for life-threatening situations
        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => { 
          setIsSpeaking(false)
          resolve() 
        }
        utterance.onerror = () => { 
          setIsSpeaking(false)
          resolve() 
        }
        window.speechSynthesis.speak(utterance)
      } catch {
        setIsSpeaking(false)
        resolve()
      }
    })
  }

  /* ─── Speech Recognition Setup ─── */
  useEffect(() => {
    const SpeechRecognition = 
      window.SpeechRecognition || 
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition
      
    if (!SpeechRecognition) {
      console.error("❌ Speech Recognition API NOT supported in this browser!")
      console.log("Supported browsers: Chrome, Edge, Firefox (latest versions)")
      return
    }
    
    console.log("✅ Speech Recognition API detected")

    try {
      recognitionRef.current = new SpeechRecognition()
      console.log("✅ SpeechRecognition instance created")
      
      recognitionRef.current.continuous = true // Keep listening continuously
      recognitionRef.current.interimResults = true // Show text as user speaks
      recognitionRef.current.lang = "en-US"
      recognitionRef.current.maxAlternatives = 1
      
      console.log("✅ Speech recognition configured: continuous=true, interimResults=true")
    } catch (e) {
      console.error("❌ Failed to create SpeechRecognition instance:", e)
      return
    }

    recognitionRef.current.onstart = () => {
      console.log("🎙️ ✅ Speech recognition STARTED - listening for audio...")
      fullTranscriptRef.current = ""
      setIsRecording(true)
      setRecordingTime(0)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    }

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = ""
      console.log(`📊 Result event received (resultIndex: ${event.resultIndex}, results.length: ${event.results.length})`)
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        const confidence = event.results[i][0].confidence
        const isFinal = event.results[i].isFinal
        
        if (isFinal) {
          console.log(`✅ FINAL: "${transcript}" (confidence: ${(confidence * 100).toFixed(0)}%)`)
          fullTranscriptRef.current += transcript + " "
          console.log("📝 Full transcript so far:", fullTranscriptRef.current.trim())

          // If the AI is currently speaking and the patient speaks,
          // immediately stop the AI (barge-in).
          if (isSpeaking) {
            console.log("🔴 User interrupted AI - stopping AI response")
            stopSpeaking()
          }

          // Each final phrase restarts a 2-second silence timer.
          if (silenceTimeoutRef.current) {
            console.log("⏰ Clearing existing silence timer")
            clearTimeout(silenceTimeoutRef.current)
          }
          
          if (latestSubmitAnswerRef.current) {
            console.log("⏱️ Setting 2-second silence timer...")
            silenceTimeoutRef.current = setTimeout(() => {
              silenceTimeoutRef.current = null
              const finalText = fullTranscriptRef.current.trim()
              console.log("⏱️ ✅ 2-second SILENCE TIMEOUT TRIGGERED - auto-submitting:", finalText)
              // Only submit if we have text and no response is currently in progress (keeps order)
              if (finalText && latestSubmitAnswerRef.current && !responseInProgressRef.current) {
                console.log("🔔 Calling submitAnswer()...")
                latestSubmitAnswerRef.current()
              } else if (responseInProgressRef.current) {
                console.log("⏸️ Skipping submit: previous response still in progress (sequential)")
              } else {
                console.warn("⚠️ Cannot submit: finalText empty or latestSubmitAnswerRef is null")
              }
            }, 2000)
          } else {
            console.warn("⚠️ latestSubmitAnswerRef.current is null - cannot set silence timer!")
          }
        } else {
          interimTranscript += transcript
          console.log(`🔤 INTERIM: "${transcript}"`)
        }
      }
      // Show both interim and final text
      const displayText = fullTranscriptRef.current.trim() || interimTranscript.trim()
      if (displayText) {
        console.log(`💬 Displaying text:`, displayText)
        setUserInput(displayText)
      }
    }

    recognitionRef.current.onerror = (event) => {
      console.error(`🔇 Speech recognition ERROR: ${event.error}`)
      
      // Don't auto-restart - only user clicking record button should control listening
      if (event.error === "no-speech") {
        console.log("⏳ No speech detected - waiting for you to speak...")
        // Don't auto-restart
        return
      }
      
      if (event.error !== "aborted") {
        console.error("❌ Fatal error:", event.error)
        setIsRecording(false)
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
      }
    }

    recognitionRef.current.onend = () => {
      console.log("🎤 Speech recognition ended")
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      
      // Don't auto-restart - only user clicking record button will start listening
      console.log("⏹️ Recording stopped")
    }

    return () => {
      // Cleanup on unmount (back button)
      stopSpeaking()  // Stop any TTS
      autoStartListeningRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
    }
  }, [])

  /* ─── Start Recording ─── */
  function handleRecordingStart() {
    if (!recognitionRef.current) {
      console.error("❌ Speech recognition not available")
      addMessage("assistant", "Speech recognition is not available in this browser.")
      return
    }

    if (isRecording) {
      console.warn("⚠️ Already recording")
      return
    }

    try {
      // Barge-in: if AI is currently speaking, stop it right away
      stopSpeaking()

      // Clear any pending auto-submit from previous utterances
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
      
      fullTranscriptRef.current = ""
      setUserInput("")
      setIsRecording(true)
      setRecordingTime(0)

      // Start recording timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      // Set flag to keep listening
      recognitionRef.current._keepAlive = true
      recognitionRef.current.start()
      console.log("🎙️ Recording started")
    } catch (error) {
      console.error("❌ Error starting recording:", error)
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      addMessage("assistant", "Could not start recording. Please check microphone permissions.")
    }
  }

  /* ─── Stop Recording ─── */
  function handleRecordingStop() {
    if (!recognitionRef.current) return

    try {
      recognitionRef.current._keepAlive = false
      recognitionRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      console.log("⏹️ Recording stopped")
    } catch (error) {
      console.error("Error stopping recording:", error)
      setIsRecording(false)
    }
  }

  /* ─── Initialize Triage Session ─── */
  async function initializeTriageSession() {
    try {
      setLoading(true)
      const res = await fetch("/api/triage/start", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: triageMode })
      })
      const data = await res.json()
      if (data.success) {
        setSessionId(data.sessionId)
        
        // For urgent mode: skip greeting and ask first question directly
        // For general mode: show greeting then first question
        if (triageMode === "urgent") {
          const urgentQuestion = "What are your most critical symptoms right now?"
          addMessage("assistant", urgentQuestion)
          await speak(urgentQuestion)
        } else {
          // Display greeting for general mode
          const greeting = data.message
          addMessage("assistant", greeting)
          await speak(greeting)
        }

        // DO NOT auto-start listening - user must click record button
        autoStartListeningRef.current = false
        setSessionStarted(true)
        
        console.log(`✅ ${triageMode === "urgent" ? "Urgent Care" : "General Health"} assessment session initialized. Waiting for user to click record button.`)
      }
    } catch (error) {
      console.error("Error initializing session:", error)
      addMessage("assistant", "Error starting session. Please try again.")
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  /* ─── Detect Emergency Response ─── */
  function isEmergencyYes(text) {
    const lower = text.toLowerCase().trim()
    const yesPatterns = [/^yes(\s|$)/i, /^yep(\s|$)/i, /^yeah(\s|$)/i, /^absolutely(\s|$)/i, /^i\s+need\s+emergency/i, /^emergency/i]
    return yesPatterns.some(p => p.test(lower))
  }

  /* ─── Handle Emergency Routing ─── */
  async function handleEmergency() {
    const emergencyMsg = "🚨 EMERGENCY DETECTED 🚨\n\nCall 102 (Ambulance) immediately or visit the nearest hospital.\n\nFinding the nearest hospital near you..."
    addMessage("assistant", emergencyMsg)
    await speak("Emergency detected. Calling ambulance service and locating nearest hospital.")
    
    // Get user location and find nearest ER
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const mapsUrl = `https://www.google.com/maps/search/hospital+emergency+room/@${latitude},${longitude},15z`
          const erInfo = `
📍 Your Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
🏥 Nearest Hospitals: https://maps.google.com/?q=hospital+near+me
📞 Emergency Number: 102 (Ambulance)

Please go to the nearest hospital immediately.
          `
          addMessage("assistant", erInfo)
          scrollToBottom()
        },
        (error) => {
          const fallbackMsg = "📞 Emergency Number: 102 (Ambulance)\n\n🏥 Please go to the nearest hospital immediately.\n\nYou can also search 'hospitals near me' on Google Maps."
          addMessage("assistant", fallbackMsg)
          scrollToBottom()
        }
      )
    }
  }

  /* ─── Route to Health Assessment ─── */
  function routeToHealthAssessment() {
    const msg = "Thank you for confirming. Let's evaluate your health. Please click the record button when ready to describe your symptoms."
    addMessage("assistant", msg)
    speak(msg)
    // User can now click record and provide health information
  }

  /* ─── Submit Answer ─── */
  const submitAnswer = useCallback(async () => {
    if (!userInput.trim() || !sessionId) {
      console.warn("⚠️ Cannot submit: No input or session")
      return
    }
    // Only one response at a time so AI replies stay sequential
    if (responseInProgressRef.current) {
      console.warn("⚠️ Skipping submit: response already in progress")
      return
    }
    responseInProgressRef.current = true

    const userMessage = userInput.trim()
    
    // For general mode: skip emergency detection, proceed directly to assessment
    // For urgent mode: process normally
    // In both cases, just submit the answer to the backend
    
    // For subsequent responses (or all responses in general mode), proceed with normal assessment
    const requestId = ++requestIdRef.current
    console.log(`\n🔥 ================================`)
    console.log(`📤 [Request #${requestId}] SUBMITTING USER INPUT`)
    console.log(`🔥 ================================`)
    console.log(`Message: "${userMessage}"`)
    console.log(`SessionID: ${sessionId}`)
    console.log(`Mode: ${triageMode}`)
    
    setLoading(true)
    addMessage("patient", userMessage)
    setUserInput("")
    fullTranscriptRef.current = ""

    try {
      const payload = { sessionId, userAnswer: userMessage }
      console.log(`📋 Payload:`, JSON.stringify(payload, null, 2))
      
      console.log(`🌐 Fetching: POST /api/triage/answer`)
      const res = await fetch("/api/triage/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      console.log(`📥 Response status: ${res.status} ${res.statusText}`)
      
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      console.log(`✅ Response data:`, JSON.stringify(data, null, 2))

      // If a newer user utterance has already been sent,
      // ignore this older response (patient speech always wins).
      if (requestId !== requestIdRef.current) {
        console.log(`🚫 [Request #${requestId}] IGNORED - newer request already sent`)
        responseInProgressRef.current = false
        return
      }
      
      console.log(`✅ [Request #${requestId}] Response received:`, {
        success: data.success,
        hasNextQuestion: !!data.nextQuestion,
        hasConfirmation: !!data.confirmationMessage,
        triageLevel: data.triageLevel
      })

      if (!data.success) {
        console.error("❌ Backend error:", data.error)
        const errorMsg = data.error || "Unable to process response"
        addMessage("assistant", errorMsg)
        setLoading(false)
        await speak(errorMsg)
        return
      }

      // Update triage level if provided
      if (data.triageLevel) {
        setTriageLevel(data.triageLevel)
      }

      // Handle emergency escalation
      if (data.nextAction === "escalate_emergency" || data.triageLevel === "EMERGENCY") {
        const emergencyMsg = data.message || "🚨 This appears to be a medical emergency. Call 102 (Ambulance) or go to nearest hospital IMMEDIATELY!"
        addMessage("assistant", emergencyMsg)
        setLoading(false)
        await speak(emergencyMsg)
        setTriageLevel("EMERGENCY")
        return
      }

      // Determine which message to display (sequential responses)
      const assistantText = 
        data.confirmationMessage || // Tool execution confirmation
        data.nextQuestion ||         // AI-generated next question
        "Thank you for that information. Tell me more about your symptoms."

      console.log(`🎯 [Request #${requestId}] Sequential response:`, assistantText.slice(0, 100) + "...")
      addMessage("assistant", assistantText, data.databaseSearch, data.appointmentSlots, data.emergencyRouting)

      // Handle appointment confirmation modal (when appointment is successfully booked)
      if (data.toolExecuted && data.toolName === "book_appointment" && data.toolResult?.success) {
        console.log("📅 Appointment successfully booked - showing confirmation")
        setAppointmentDetails({
          date: data.toolResult.appointment?.date,
          time: data.toolResult.appointment?.time,
          doctorID: data.toolResult.appointment?.doctorID,
          confirmationID: data.toolResult.appointmentID
        })
        setAppointmentConfirmed(true)
      }

      // Handle appointment suggestion modal (general mode only)
      if (data.suggestAppointment && triageMode === "general") {
        console.log("💼 Appointment suggestion triggered")
        setShowAppointmentSuggestion(true)
      }

      // Handle emergency routing modal (urgent mode only)
      if (data.emergencyRouting && triageMode === "urgent") {
        console.log("🚨 Emergency routing modal triggered")
        setShowEmergencyModal(true)
      }

      // Brief thinking pause before AI response
      // If user interrupts during this pause, a new requestId will be generated
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check if a newer request was submitted while we were thinking
      if (requestId !== requestIdRef.current) {
        console.log(`🚫 [Request #${requestId}] INTERRUPTED during thinking - canceling response`)
        setLoading(false)
        responseInProgressRef.current = false
        return
      }

      setLoading(false)
      console.log(`🔊 [Request #${requestId}] Speaking response...`)
      await speak(assistantText)
      
      // Handle sequential follow-up questions
      if (data.followUpQuestion) {
        console.log(`🎯 Sequential follow-up question: ${data.followUpQuestion.slice(0, 50)}...`)
        addMessage("assistant", data.followUpQuestion)
        await speak(data.followUpQuestion)
      }
      
      console.log(`✨ [Request #${requestId}] Response complete - restarting listening`)
      
      // Auto-restart listening after AI response (continuous listening mode)
      if (autoStartListeningRef.current && recognitionRef.current) {
        console.log("🔄 Auto-restarting recognition...")
        setTimeout(() => {
          if (autoStartListeningRef.current && recognitionRef.current) {
            try {
              console.log("▶️ Calling start() to restart recognition")
              recognitionRef.current.start()
              console.log("👂 ✅ Speech recognition restarted - ready to listen again")
            } catch (e) {
              console.warn("⚠️ Could not restart listening:", e.message)
            }
          }
        }, 500)
      } else {
        console.warn("⚠️ Cannot restart listening: autoStartListeningRef or recognitionRef is null")
      }
      
    } catch (error) {
      console.error("❌ ERROR submitting answer:", error.message)
      console.error("Full error:", error)
      const errorMsg = "I'm having technical difficulties. Please try again."
      addMessage("assistant", errorMsg)
      setLoading(false)
      await speak(errorMsg)
      
      // Restart listening even on error
      if (autoStartListeningRef.current && recognitionRef.current) {
        setTimeout(() => {
          if (autoStartListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
              console.log("👂 Listening restarted after error")
            } catch (e) {
              console.warn("Could not restart listening after error:", e)
            }
          }
        }, 500)
      }
    } finally {
      responseInProgressRef.current = false
      scrollToBottom()
    }
  }, [userInput, sessionId, addMessage, scrollToBottom, isSpeaking])

  // Keep a ref to the latest submit function so the speech-recognition
  // handler (created once) can call it without re-initializing.
  useEffect(() => {
    latestSubmitAnswerRef.current = submitAnswer
  }, [submitAnswer])

  /* ─── Initialize on Mount ─── */
  useEffect(() => {
    if (!sessionId) {
      initializeTriageSession()
    }
  }, [])

  return (
    <div className="triage-container">
      {/* Header ─── */}
      <div className="triage-header">
        <button className="back-button" onClick={onBack} title="Return to home">
          ← Back
        </button>
        <div className="header-content">
          <h1>🏥 CliniQ Medical Triage</h1>
          <p>
            Professional Health Evaluation & Care Routing
            {triageMode === "urgent" && <> — <strong>Urgent Care Evaluation</strong></>}
            {triageMode === "mental" && <> — <strong>Mental Health</strong></>}
            {triageMode === "general" && <> — <strong>General</strong></>}
          </p>
        </div>
        <div className="status-bar">
          <span className={`triage-level triage-level-${triageLevel.toLowerCase()}`}>
            {triageLevel || "Assessing..."}
          </span>
          {sessionId && <span className="session-id">Session: {sessionId.slice(0, 8)}...</span>}
        </div>
      </div>

      {/* Chat Area ─── */}
      <div className="chat-box" ref={chatBoxRef}>
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Welcome to Virtual Clinic intake. I'm here to help assess your health concern and get you the appropriate care level.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx}>
              <div className={`message message-${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === "assistant" ? "🏥" : "👤"}
                </div>
                <div className="message-content">
                  {msg.searchData && <DatabaseSearchResults searchData={msg.searchData} type="symptoms" />}
                  <p>{msg.text}</p>
                </div>
              </div>

              {/* Emergency Routing Options ─── */}
              {msg.emergencyRouting && msg.emergencyRouting.options && (
                <div className="options-section emergency-options">
                  {msg.emergencyRouting.options.map((option) => (
                    <button
                      key={option.id}
                      className={`option-button emergency-${option.id}`}
                      onClick={() => {
                        const message = option.id === "ambulance" 
                          ? "I'm calling 102 for ambulance services"
                          : "I'm going to the nearest hospital"
                        addMessage("patient", message)
                        if (option.id === "ambulance") {
                          addMessage("assistant", "🚨 EMERGENCY AMBULANCE SERVICE ACTIVATED\n\n📞 Calling 102 Ambulance Service...\n\nPlease stay on the line and provide your location. Ambulance services are being dispatched to your location. Provide them with accurate information about your symptoms and current condition.\n\n🏥 When the ambulance arrives, show them this confirmation and your Patient ID for medical records continuity.")
                        } else {
                          addMessage("assistant", "🏥 ROUTING TO NEAREST HOSPITAL\n\n📍 Opening directions to nearest hospital...\n\nPlease proceed to the hospital immediately. Bring this session confirmation for medical records. Your symptoms have been documented and will be available to the hospital staff.\n\n⏱️ Inform hospital staff of your chief complaint and symptoms for faster processing.")
                        }
                        scrollToBottom()
                      }}
                    >
                      <div className="option-label">{option.label}</div>
                      <div className="option-desc">{option.description}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Appointment Slots Options ─── */}
              {msg.appointmentSlots && msg.appointmentSlots.slots && (
                <div className="options-section appointment-slots">
                  {msg.appointmentSlots.slots.map((slot, slotIdx) => (
                    <button
                      key={slotIdx}
                      className="option-button appointment-slot"
                      onClick={async () => {
                        // Submit the selected time
                        const selectMsg = `I'd like to book the ${slot} appointment`
                        addMessage("patient", selectMsg)
                        setUserInput("")
                        fullTranscriptRef.current = ""
                        setLoading(true)
                        
                        try {
                          const payload = { sessionId, userAnswer: slot }
                          const res = await fetch("/api/triage/answer", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                          })
                          const data = await res.json()
                          
                          if (data.success && data.confirmationMessage) {
                            addMessage("assistant", data.confirmationMessage)
                            scrollToBottom()
                          }
                        } catch (error) {
                          console.error("Error booking slot:", error)
                          addMessage("assistant", "There was an error booking your appointment. Please try again.")
                        } finally {
                          setLoading(false)
                        }
                      }}
                    >
                      🕐 {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {isSpeaking && (
          <div className="message message-assistant">
            <div className="message-avatar">🏥</div>
            <div className="message-content">
              <p>
                <span className="speaking-indicator">
                  <span></span><span></span><span></span>
                </span>
                Listening to response...
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="message message-assistant">
            <div className="message-avatar">🏥</div>
            <div className="message-content">
              <p>
                <span className="loading-dots">
                  <span></span><span></span><span></span>
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input Section ─── */}
      {triageLevel !== "EMERGENCY" && (
        <div className="input-section">
          {/* Recording Status ─── */}
          {isRecording && (
            <div className="recording-status">
              🎙️ Listening... {recordingTime}s
            </div>
          )}
          {!isRecording && sessionStarted && !loading && (
            <div className="recording-status listening-idle">
              👂 Ready to listen...
            </div>
          )}

          {/* Control Buttons ─── */}
          <div className="button-group">
            {!isRecording && (
              <button
                className="btn btn-primary"
                onClick={handleRecordingStart}
                disabled={loading || isSpeaking}
                title="Click to start recording your answer"
              >
                🎤 Record Answer
              </button>
            )}
            {isRecording && (
              <button
                className="btn btn-warning"
                onClick={handleRecordingStop}
                title="Click to stop recording"
              >
                ⏹ Stop Recording
              </button>
            )}
          </div>
        </div>
      )}

      {/* Emergency Section ─── */}
      {triageLevel === "EMERGENCY" && (
        <div className="emergency-alert">
          <h2>🚨 Emergency Situation Detected</h2>
          <p>Based on your responses, you may need immediate medical attention.</p>
          <div className="emergency-actions">
            <button className="btn btn-danger btn-large">
              📞 Call 102 (Ambulance)
            </button>
            <button className="btn btn-danger btn-outline btn-large">
              🏥 Go to Nearest Hospital
            </button>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back to Menu
          </button>
        </div>
      )}

      {/* Footer ─── */}
      <div className="triage-footer">
        <small>Your health information is kept confidential. If you need immediate help, please call 102 (Ambulance) or visit your nearest hospital.</small>
      </div>

      {/* Appointment Suggestion Modal ─── */}
      {showAppointmentSuggestion && (
        <div className="modal-backdrop" onClick={() => setShowAppointmentSuggestion(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📅 Schedule an Appointment?</h2>
            </div>
            <div className="modal-body">
              <p>Based on your symptoms and health history, I'd recommend scheduling an appointment with a healthcare provider to get a professional evaluation.</p>
              <p>Would you like me to help you book an appointment?</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  addMessage("patient", "Yes, I'd like to book an appointment")
                  setShowAppointmentSuggestion(false)
                  const confirmMsg = "Confirmation successful. Your appointment booking request has been received. I'll help you choose a date and time next—just tell me when you'd like to come in."
                  addMessage("assistant", "✅ " + confirmMsg)
                  scrollToBottom()
                  speak(confirmMsg)
                }}
              >
                ✅ Yes, Book Appointment
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  addMessage("patient", "No, I'll continue with the assessment")
                  setShowAppointmentSuggestion(false)
                }}
              >
                ❌ No, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Routing Modal ─── */}
      {showEmergencyModal && (
        <div className="modal-backdrop emergency" onClick={(e) => e.stopPropagation()}>
          <div className="modal-container emergency-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header emergency-header">
              <h2>🚨 Emergency Response Required</h2>
            </div>
            <div className="modal-body emergency-body">
              <p className="emergency-message">
                Based on your symptoms, you need immediate emergency medical care. 
                Please choose how to get help right now:
              </p>
            </div>
            <div className="modal-footer emergency-footer">
              <button 
                className="btn btn-danger btn-large"
                onClick={() => {
                  addMessage("patient", "Calling 102 Ambulance Service")
                  setShowEmergencyModal(false)
                  addMessage("assistant", "🚨 EMERGENCY AMBULANCE SERVICE ACTIVATED\n\n📞 Calling 102 Ambulance Service...\n\nPlease have your location and medical history ready. Ambulance services are being dispatched. Tell the dispatcher about your critical symptoms and current location. Your symptom report has been documented.")
                }}
              >
                📞 Call 102 (Ambulance)
              </button>
              <button 
                className="btn btn-danger btn-outline btn-large"
                onClick={() => {
                  addMessage("patient", "Going to nearest hospital")
                  setShowEmergencyModal(false)
                  
                  // Detect user's location
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        const { latitude, longitude } = position.coords
                        console.log(`📍 User location detected: ${latitude}, ${longitude}`)
                        
                        // Find nearest hospitals
                        const nearestHospitals = findNearestHospitals(latitude, longitude)
                        
                        // Display message with nearest hospital(s)
                        let hospitalMsg = "🏥 HOSPITAL ROUTING ACTIVATED\n\n🗺️ **Nearest Hospitals Found:**\n\n"
                        
                        nearestHospitals.forEach((hospital, index) => {
                          hospitalMsg += `**${index + 1}. ${hospital.name}**\n`
                          hospitalMsg += `📍 Location: ${hospital.address}\n`
                          hospitalMsg += `📱 Emergency Phone: ${hospital.phone}\n`
                          hospitalMsg += `🚗 Distance: ${hospital.distanceInKm.toFixed(1)} km away\n`
                          hospitalMsg += `⏰ Wait Time: ${hospital.waitTime}\n`
                          hospitalMsg += `🏥 Specialties: ${hospital.specialties}\n\n`
                        })
                        
                        hospitalMsg += "✅ Proceed immediately to the nearest hospital. Have your ID and health insurance documents ready.\n\n⏰ If you cannot travel safely, call 102 for ambulance service."
                        
                        addMessage("assistant", hospitalMsg)
                        scrollToBottom()
                      },
                      (error) => {
                        console.error("Geolocation error:", error)
                        
                        // Fallback: Show all hospitals without location-based sorting
                        addMessage("patient", "Going to nearest hospital")
                        const hospitalsWithFallback = hospitals.map((h) => ({
                          ...h,
                          distanceInKm: "Unknown"
                        }))
                        
                        let fallbackMsg = "🏥 HOSPITAL ROUTING ACTIVATED\n\n⚠️ **Could not detect your location** - Showing available emergency hospitals:\n\n"
                        
                        hospitalsWithFallback.slice(0, 3).forEach((hospital, index) => {
                          fallbackMsg += `**${index + 1}. ${hospital.name}**\n`
                          fallbackMsg += `📍 Location: ${hospital.address}\n`
                          fallbackMsg += `📱 Emergency Phone: ${hospital.phone}\n`
                          fallbackMsg += `⏰ Wait Time: ${hospital.waitTime}\n`
                          fallbackMsg += `🏥 Specialties: ${hospital.specialties}\n\n`
                        })
                        
                        fallbackMsg += "✅ Proceed to any of these hospitals immediately.\n\n⏰ If you cannot travel safely, call 102 for ambulance service."
                        
                        addMessage("assistant", fallbackMsg)
                        scrollToBottom()
                      }
                    )
                  } else {
                    // Geolocation not supported
                    let noLocationMsg = "🏥 HOSPITAL ROUTING ACTIVATED\n\n⚠️ **Location services not available** - Available emergency hospitals:\n\n"
                    
                    hospitals.slice(0, 3).forEach((hospital, index) => {
                      noLocationMsg += `**${index + 1}. ${hospital.name}**\n`
                      noLocationMsg += `📍 Location: ${hospital.address}\n`
                      noLocationMsg += `📱 Emergency Phone: ${hospital.phone}\n`
                      noLocationMsg += `⏰ Wait Time: ${hospital.waitTime}\n`
                      noLocationMsg += `🏥 Specialties: ${hospital.specialties}\n\n`
                    })
                    
                    noLocationMsg += "✅ Proceed to any of these hospitals immediately.\n\n⏰ If you cannot travel safely, call 102 for ambulance service."
                    
                    addMessage("assistant", noLocationMsg)
                    scrollToBottom()
                  }
                }}
              >
                🏥 Go to Nearest Hospital
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Confirmation Modal ─── */}
      {appointmentConfirmed && appointmentDetails && (
        <div className="modal-backdrop appointment-success" onClick={() => setAppointmentConfirmed(false)}>
          <div className="modal-container appointment-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header appointment-success-header">
              <h2>✅ APPOINTMENT CONFIRMED!</h2>
            </div>
            <div className="modal-body appointment-success-body">
              <div className="confirmation-details">
                <p className="confirmation-title">Your appointment has been successfully booked.</p>
                <div className="detail-row">
                  <span className="detail-label">📅 Date:</span>
                  <span className="detail-value">{appointmentDetails.date}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">🕐 Time:</span>
                  <span className="detail-value">{appointmentDetails.time}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">🆔 Confirmation #:</span>
                  <span className="detail-value">{appointmentDetails.confirmationID}</span>
                </div>
                <div className="confirmation-message">
                  <p>✨ Your appointment details have been saved. You should receive a confirmation SMS/email shortly.</p>
                  <p>📍 Location: 123 Medical Center Drive, Healthcare City</p>
                  <p>⏰ Please arrive 15 minutes early for check-in. Bring your ID and any relevant medical documents.</p>
                </div>
              </div>
            </div>
            <div className="modal-footer appointment-success-footer">
              <button 
                className="btn btn-success btn-large"
                onClick={() => {
                  setAppointmentConfirmed(false)
                }}
              >
                Got it! Thanks ✨
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TriagePage
