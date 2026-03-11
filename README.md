# TalkScout — AI Interview Practice Agent

AI-powered voice interview simulator. Pick a topic, answer questions by voice or text, and get comprehensive feedback at the end.

## Features

- **7 interview topics** — Behavioral, Technical, Leadership, Communication, Product/PM, System Design, HR/Culture Fit
- **Voice input** — Start/stop recording; speech is transcribed and sent automatically
- **AI-generated questions** — Adaptive follow-ups powered by Gemini (OpenAI fallback)
- **Text-to-speech** — Questions are read aloud; stops instantly when you start recording
- **Skip questions** — Move to the next question anytime
- **End-of-interview feedback** — Full AI-generated performance report with scores, strengths, and tips

## Tech Stack

| Layer    | Tech                        |
|----------|-----------------------------|
| Frontend | React 19, Vite 7            |
| Backend  | Node.js, Express 5          |
| AI       | Google Gemini (primary), OpenAI (fallback) |
| Voice    | Web Speech API (browser-native STT & TTS) |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- A **Gemini API key** — get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey)
- *(Optional)* An **OpenAI API key** for fallback — [platform.openai.com](https://platform.openai.com/api-keys)

### 1. Clone

```bash
git clone https://github.com/shutupzunaira/voice-ai-agent.git
cd voice-ai-agent
```

### 2. Install dependencies

```bash
npm install            # installs root (concurrently)
npm run install:all    # installs backend + frontend
```

### 3. Configure environment

Create `backend/.env` (copy from the example and add your keys):

```env
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here   # optional fallback
PORT=3001
```

### 4. Run

```bash
npm run dev
```

That's it. Both servers start together:

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://127.0.0.1:5175      |
| Backend  | http://localhost:3001       |

Open the frontend URL in your browser to begin.

---

## Available Scripts

| Command               | Description                              |
|-----------------------|------------------------------------------|
| `npm run dev`         | Start backend + frontend simultaneously  |
| `npm run dev:backend` | Start backend only                       |
| `npm run dev:frontend`| Start frontend only                      |
| `npm run install:all` | Install deps for both backend & frontend |

## Project Structure

```
voice-ai-agent/
├── package.json          # Root scripts (concurrently)
├── backend/
│   ├── server.js         # Express API — Gemini/OpenAI, interview logic
│   ├── .env              # API keys (not committed)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── pages/
    │       ├── HomePage.jsx       # Topic selection
    │       ├── InterviewPage.jsx  # Voice/text interview flow
    │       └── ReviewPage.jsx     # AI feedback report
    ├── vite.config.js    # Dev server + proxy config
    └── package.json
```

## How It Works

1. **Home** — Select an interview topic
2. **Interview** — AI greets you, asks the first question (spoken aloud)
3. **Record** — Press "Start Recording", speak your answer, press "Stop Recording"
4. **Repeat** — AI asks the next adaptive question; skip anytime with "Next Question"
5. **Feedback** — Press "View Feedback & Exit" to get a full AI-generated performance report

---

## License

ISC
