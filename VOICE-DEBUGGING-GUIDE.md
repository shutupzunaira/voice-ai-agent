# 🎙️ Voice Interaction Debugging Guide

## **Step-by-Step Debugging (Use Browser Console - F12)**

### **STEP 1: Check if Speech Recognition Starts**
When page loads and greeting is spoken:
```
✅ Speech Recognition API detected
✅ SpeechRecognition instance created
✅ Speech recognition configured: continuous=true
🚀 Starting speech recognition...
🎤 ✅ Speech recognition STARTED - listening for audio...
```

**IF YOU DON'T SEE THIS:**
- ❌ Browser doesn't support Speech API (use Chrome, Edge, Safari, Firefox)
- ❌ Microphone permission denied (See Step 3)

---

### **STEP 2: Check if STT Captures Your Speech**
When you speak:
```
📊 Result event received (resultIndex: 0, results.length: 1)
🔤 INTERIM: "what you are saying"
✅ FINAL: "complete phrase" (confidence: 95%)
📝 Full transcript so far: complete phrase
💬 Displaying text: complete phrase
```

**IF YOU DON'T SEE FINAL:**
- ❌ Microphone not working (check system audio settings)
- ❌ Speech is too quiet
- ❌ Using wrong language (should be en-US)

---

### **STEP 3: Check if Silence Timer Triggers**
After you stop speaking (should see after ~2 seconds):
```
⏰ Clearing existing silence timer
⏱️ Setting 2-second silence timer...
⏱️ ✅ 2-second SILENCE TIMEOUT TRIGGERED - auto-submitting: [your text]
🔔 Calling submitAnswer()...
```

**IF YOU DON'T SEE THIS:**
- ❌ Silence timer not being set (check Step 2 worked)
- ❌ Speech recognition ended before final result
- ❌ `latestSubmitAnswerRef.current is null` warning

---

### **STEP 4: Check if Submission to Backend Works**
Should see immediately after Step 3:
```
🔥 ================================
📤 [Request #1] SUBMITTING USER INPUT
🔥 ================================
Message: "[what you said]"
SessionID: [sessionId]

📋 Payload: 
{
  "sessionId": "...",
  "userAnswer": "[what you said]"
}

🌐 Fetching: POST /api/triage/answer
📥 Response status: 200 OK
✅ Response data: {...response from backend...}
```

**IF YOU SEE ERROR:**

**Error: `HTTP Error: 404`**
- ❌ Backend endpoint `/api/triage/answer` doesn't exist
- ✅ Solution: Restart backend server

**Error: `HTTP Error: 500`**
- ❌ Backend crashed or error processing request
- ✅ Solution: Check backend terminal for error
- ✅ Solution: Check if sessionId is still valid

**Error: Network/Connection error**
- ❌ Cannot reach backend
- ✅ Solution: Is backend running? `npm start` in `/backend` folder
- ✅ Solution: Is frontend on `http://localhost:5173` and backend on `http://localhost:3001`?

---

### **STEP 5: Check if AI Response is Displayed & Spoken**
Should see after Step 4:
```
✅ [Request #1] Response received: {
  "success": true,
  "hasNextQuestion": true,
  "hasConfirmation": false,
  "triageLevel": "UNCLEAR"
}

🎯 [Request #1] Sequential response: [AI's next question...]
[message is added to chat]

🔊 [Request #1] Speaking response...
[AI speaks the response]

✨ [Request #1] Response complete - restarting listening
🔄 Auto-restarting recognition...
▶️ Calling start() to restart recognition
👂 ✅ Speech recognition restarted - ready to listen again
```

**IF RESPONSE NOT DISPLAYED:**
- ❌ Backend returned error (check `data.success`)
- ❌ `data.nextQuestion` is empty
- ✅ Solution: Send longer, more descriptive response to AI

**IF RESPONSE NOT SPOKEN:**
- ❌ Text-to-Speech failed
- ❌ Browser volume muted
- ✅ Solution: Check browser audio (should be enabled)

---

### **STEP 6: Check if Listening Restarts**
After AI finishes speaking:
```
👂 ✅ Speech recognition restarted - ready to listen again
```

**IF YOU DON'T SEE THIS:**
- ❌ Listening didn't restart
- ⚠️ You must say something again manually
- ✅ Solution: Wait a moment (there's a 500ms delay)
- ✅ Solution: Check browser console for errors

---

## **Complete Flow - What You Should See**

```
1. Page loads
   ✅ Speech Recognition API detected
   ✅ SpeechRecognition instance created

2. Greeting spoken
   🚀 Starting speech recognition...
   🎤 ✅ Speech recognition STARTED

3. You speak
   📊 Result event received
   🔤 INTERIM: [partial text]
   ✅ FINAL: [complete phrase]
   👂 Display text on screen

4. You stop (silence 2 seconds)
   ⏱️ Setting 2-second silence timer...
   ⏱️ ✅ 2-second SILENCE TIMEOUT TRIGGERED
   🔔 Calling submitAnswer()

5. Submit to AI
   📤 [Request #1] SUBMITTING USER INPUT
   🌐 Fetching: POST /api/triage/answer
   📥 Response status: 200 OK

6. Response displayed & spoken
   🎯 Sequential response: [AI text...]
   🔊 Speaking response...
   💬 [AI speaks]

7. Listening restarts
   ✨ Response complete - restarting listening
   👂 ✅ Speech recognition restarted
   
8. Loop back to Step 3
```

---

## **Quick Troubleshooting Checklist**

| Issue | Check in Console | Solution |
|-------|-----------------|----------|
| STT not capturing | Step 2 logs | Check microphone permissions (F12 → Site permissions) |
| AI not responding | Step 4 logs | Verify backend is running, check response error |
| Response not spoken | Step 5 logs | Check browser volume, check if TTS failed |
| Listening doesn't restart | Step 6 logs | Refresh page, check for JavaScript errors |
| Nothing works | Everything | Clear browser cache, hard refresh (Ctrl+Shift+R) |

---

## **To Check Microphone Permission**

1. Open **Browser Console** (F12)
2. Type: `navigator.permissions.query({name: "microphone"})` and press Enter
3. You'll see the result:
   - `"granted"` → ✅ Allowed
   - `"denied"` → ❌ Blocked
   - `"prompt"` → ⚠️ Will ask next time

**To fix permission denied:**
- Click 🔒 or 🔧 in address bar
- Find "Microphone" → Change to "Allow"
- Refresh page

---

## **Backend Debug Info**

If responses aren't coming from AI, check **backend terminal**:

```bash
cd backend
npm start
```

Should show:
```
✅ Firebase app initialized successfully
✅ Firestore database connected successfully
Server running on port 3001
```

When you speak, backend should log:
```
POST /api/triage/answer
🔍 Searching database for related symptoms...
✅ Database search completed...
```

If you see errors, share that output for help!

---

## **Browser Console Tips**

- **Clear logs:** `console.clear()`
- **Filter by keyword:** Use search box (magnifying glass icon)
- **See all emoji:** Filter by "🎙️" or "📤" or "✅"
- **Expand objects:** Click the `>` arrow next to `{...}`

