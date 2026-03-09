# Voice AI Agent - TalkScout

An AI-powered interview practice platform with voice input/output using OpenAI's Whisper and TTS.

## Features

✨ **Voice-First Experience**
- 🎤 Record your answers using your microphone
- 🔊 Listen to AI feedback through text-to-speech
- 📝 Fallback to text input if preferred
- ⏱️ Real-time recording timer

🤖 **AI-Powered**
- Smart interview question generation
- Voice transcription with OpenAI Whisper
- Natural speech synthesis with OpenAI TTS
- Intelligent feedback based on answer quality

📱 **Responsive Design**
- Works on desktop, tablet, and mobile
- Microphone access for all modern browsers
- Fluid layout adapts to any screen size

## Setup

### Prerequisites

- Node.js 14+ 
- npm or yarn
- OpenAI API key (get one at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys))

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file with your OpenAI API key
cp .env.example .env

# Edit .env and add your API key:
# OPENAI_API_KEY=sk_your_api_key_here

# Start the server
npm run dev
# Server runs on http://localhost:3001
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Frontend runs on http://localhost:5173
```

## API Endpoints

### Core Endpoints

**GET** `/health`
- Health check endpoint
- Response: `{ status, timestamp, openaiConfigured }`

**GET** `/api`
- Get a random interview question
- Response: `{ success, question, timestamp }`

**POST** `/answer`
- Analyze user's text answer
- Body: `{ answer: string }`
- Response: `{ success, feedback, wordCount, timestamp }`

### Voice Endpoints (Require OpenAI API Key)

**POST** `/speech-to-text`
- Convert audio to text using Whisper
- Form data: `audio` (audio file)
- Response: `{ success, text, timestamp }`

**POST** `/text-to-speech`
- Convert text to speech
- Body: `{ text: string }`
- Response: Audio MP3 stream

## Usage

### Recording Your Answer

1. Click the **"🎤 Start Recording"** button
2. Speak your answer clearly
3. Click **"⏹ Stop"** when done
4. The app will transcribe and analyze your response
5. Listen to AI feedback

### Asking a Question

1. Click the **"❓ Ask Question"** button
2. The AI will provide a new interview question
3. Record or type your answer

### Text Input

If microphone is unavailable:
1. Type your answer in the input field
2. Click **"Send"** to submit
3. Get feedback with optional speech synthesis

## Environment Variables

```env
# Required for voice features
OPENAI_API_KEY=sk_your_api_key_here

# Optional
NODE_ENV=development
PORT=3001
```

## Project Structure

```
voice-ai-agent/
├── backend/
│   ├── server.js          # Express server with all endpoints
│   ├── package.json
│   ├── .env.example       # Environment variables template
│   └── uploads/           # Temporary audio file storage
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component with voice logic
│   │   ├── App.css        # Responsive styling
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Troubleshooting

### Microphone Not Working

- Check browser permissions (chrome://settings/privacy/voiceAndAudio)
- Ensure HTTPS is used (some browsers require it)
- Test microphone with system settings first
- Try a different browser

### OpenAI API Errors

- Verify API key is valid and active
- Check API usage limits in OpenAI dashboard
- Ensure model availability (whisper-1, tts-1)

### Audio Playback Issues

- Check browser's autoplay policies
- Verify speaker/headphone connectivity
- Check browser console for errors

### Backend Won't Start

- Ensure port 3001 is available
- Check all dependencies are installed: `npm install`
- Verify Node version: `node --version` (should be 14+)

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Microphone | ✅ | ✅ | ✅ | ✅ |
| Audio Playback | ✅ | ✅ | ✅ | ✅ |
| Web API | ✅ | ✅ | ✅ | ✅ |

## Performance Notes

- Audio files are streamed and cleaned up automatically
- Maximum audio file size: 25MB
- Typical transcription time: 2-5 seconds
- TTS generation time: 1-3 seconds

## Future Enhancements

- [ ] Voice-based conversation turns
- [ ] Multi-language support
- [ ] Interview recording and playback
- [ ] Progress tracking and analytics
- [ ] Customizable question sets
- [ ] Advanced feedback using GPT

## License

MIT

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review console errors (F12)
3. Verify environment setup
