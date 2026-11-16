# V.A.S.C.O. (Voice-Activated Strength & Correlation Oracle)
*Technical Specification & Architecture Document*

---

## 1. Executive Summary
**V.A.S.C.O.** is a personalized fitness tracking and correlation engine built for an experienced, instinctive lifter (Vasco) who relies on internal feedback rather than rigid, automated periodization programs. 

Instead of manual data entry or wearing continuous monitors, V.A.S.C.O. enables **lazy voice-driven logging** via Telegram. Raw, unstructured brain dumps (e.g., sleep quality, nutrition timing, life stress, and workout PRs) are parsed by an LLM, structured via a custom Model Context Protocol (MCP) server, stored persistently in Supabase, and visualized in real-time on a web dashboard. Over time, V.A.S.C.O. acts as a correlation oracle, uncovering hidden patterns between lifestyle variables and physical performance (e.g., predicting strength drops based on sleep deficits).

---

## 2. Core Architecture & Technology Stack

```
[ Telegram Voice Note ] 
         ↓
 [ Whisper Transcription ]
         ↓
   [ LLM Agent ] 
         ↓ (Extracts JSON / Calls Tool)
 [ Custom MCP Server ]
         ↓ (Inserts/Updates)
 [ Supabase PostgreSQL ] 
         ↓ (Real-time WebSocket Push)
 [ Web Dashboard (Auto-Redraws) ]
```

*   **User Interface (Input):** Telegram Bot API configured to accept voice notes, transcribe them via Whisper (or Telegram's native transcription), and forward the text to the LLM agent.
*   **Intelligence Layer (Parser):** An LLM configured with the custom V.A.S.C.O. MCP client to interpret chaotic, unstructured human speech and map it into explicit structured tool calls.
*   **MCP Server (Router/Backend):** A custom Node.js or Python server built in Antigravity that exposes deterministic tools (`log_habit`, `log_lift`, `log_sleep`, `run_correlation_analysis`) to the LLM.
*   **Database & Real-time Layer:** **Supabase (PostgreSQL)**. Chosen over ephemeral SQLite on Render to ensure permanent cloud storage and leverage **Supabase Realtime WebSockets** for instant UI reactivity.
*   **Dashboard (Output):** A lightweight web app (React/Vite or Next.js) subscribed directly to Supabase tables, instantly updating timeline feeds and correlation charts when data changes.

---

## 3. Data Pipeline & Flow (Handling "Messy Data")

When Vasco sends a voice note like:
> *"Ate a massive bowl of pasta at 9 PM, slept like garbage, maybe 5 hours, but somehow hit a 100kg bench PR today."*

1. **Parsing:** The LLM receives the text and extracts discrete data points using the MCP tool definitions:
   * `log_nutrition(meal="pasta", timing="late 9 PM", category="high_carb")`
   * `log_sleep(hours=5.0, quality="poor")`
   * `log_lift(exercise="bench_press", weight=100.0, unit="kg", is_pr=true)`
2. **Execution:** The MCP server executes the database writes to Supabase.
3. **Reactivity:** Supabase pushes the new rows via WebSockets to the web dashboard.
4. **Visualization:** The dashboard components (Timeline Feed, Sleep vs. Strength Scatter Plot) update dynamically without a manual page refresh.

---

## 4. The Proof of Concept (PoC) Test
To validate the architecture, the primary milestone is the **Real-Time Dashboard Redraw Test**:
1. Open the V.A.S.C.O. web dashboard on a laptop screen (featuring a live feed and a performance trend widget).
2. Send a voice note into the Telegram bot: *"Felt great today, got 8.5 hours of sleep last night and managed to hit 4 plates on the deadlift for a triple."*
3. **Success Criteria:** Within 3 to 5 seconds, without touching the keyboard or refreshing the browser:
   * The live timeline widget appends the parsed sleep and deadlift entry.
   * The performance chart instantly updates with the new data point.

---

## 5. Future Development Phases
*   **Phase 1 (MVP):** Telegram bot ingestion + LLM parsing + MCP server + Supabase DB + Real-time web dashboard (Achieving the PoC test).
*   **Phase 2 (Correlation Engine):** Writing custom analytical queries/scripts in the MCP server to answer natural language prompts like: *"Why am I stalling on bench press?"* by identifying cross-variable trends in the historical data.