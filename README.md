# V.A.S.C.O. ⚡
### Voice-Activated Strength Correlation Oracle

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev/)
[![Google Gemini](https://img.shields.io/badge/Gemini_AI-2.5_Flash_Lite-orange?logo=google)](https://deepmind.google/technologies/gemini/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime_Postgres-3ECF8E?logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless_&_Cron-black?logo=vercel)](https://vercel.com/)

> An AI-powered strength training & calisthenics telemetry engine that correlates wearable recovery biometrics (Deep Sleep, REM, HRV, Resting HR) directly against athletic performance, personal bests, and neuromuscular readiness.

---

## 🌟 Key Features

* **🎙️ Natural Language & Voice Logging:** Speak or type multi-movement training sets (e.g. *"20 dips with +10kg, 14 fat grip pullups, felt fresh"*). Parsed through Google Gemini 2.5 Flash with Model Context Protocol (MCP) function calling into structured blueprints.
* **🧠 Real-Time Oracle Coaching & QA:** Conversational data analysis answering athlete queries (e.g. *"Should I push for a PR today?"*, *"What was my REM sleep average across the last week?"*, *"Why did I struggle in my last workout?"*), computed directly from authentic 14-day biometric records.
* **📈 Dual-Axis Correlation Chart:** Overlay up to 4 variables (sleep duration, deep sleep, REM, HRV, pullup volume, squat loads) on a normalized 0–100% canvas to uncover physiological performance ceilings.
* **⚡ Continuous Wearable Telemetry:** Automated 8:00 AM daily sync integrating Google Health & Fitbit Air wearable stages into cloud storage.
* **🔐 Token-Gated Privacy:** Secured personal dashboard with password authentication, session token persistence, and backend API shields.
* **📱 Mobile-First Native PWA:** Sub-100ms global edge delivery optimized for quick logging and voice input at the gym.

---

## 🏗️ Architecture

```
                   ┌───────────────────────────────┐
                   │    Mobile PWA (vasco.fit)     │
                   └──────────────┬────────────────┘
                                  │ HTTPS / JSON
                                  ▼
                   ┌───────────────────────────────┐
                   │    Vercel Serverless Edge     │
                   └──────┬───────────────┬────────┘
                          │               │
            ┌─────────────┴─────┐   ┌─────┴──────────────┐
            │ Google Gemini API │   │ Google Health API  │
            │ (MCP Agent & QA)  │   │ (Fitbit Air Sync)  │
            └───────────────────┘   └────────────────────┘
                          │
                          ▼
                   ┌───────────────────────────────┐
                   │  Supabase Cloud Database      │
                   │  (Postgres & Realtime WS)     │
                   └───────────────────────────────┘
```

---

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts.
* **AI Intelligence:** Google Generative AI (Gemini 2.5 Flash Lite), MCP Function Calling.
* **Backend:** Express.js, Vercel Serverless Functions, Vercel Cron.
* **Database & Realtime:** Supabase (PostgreSQL + Realtime WebSockets), Local JSON Cache.
* **Telemetry:** Google Health API / Fitbit Web API.

---

## 🚀 Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vascodify/vasco-fit.git
   cd vasco-fit
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in your free API keys for Gemini, Supabase, and Google Health.

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📄 License
All rights reserved © 2026 Vasco Dimitroff.
