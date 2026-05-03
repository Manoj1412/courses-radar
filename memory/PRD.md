# Product Requirements — CourseRadar (Syllabus Radar)

## Original Problem Statement
Smart YouTube course finder with AI-driven features:
1. AI chatbot for doubt clarification with Summarize and Play Quiz options.
2. Auto pause/resume video based on facial detection when a user leaves/returns.
3. End-of-video understanding feedback based on aggregated facial expressions.

### Feb 3, 2026 — Iteration (this fork)
User feedback to fix 4 issues:
1. Homepage hero text delay (visible after ~10s) and auto-hide toggling.
2. Remove auto camera off / home redirection on face loss.
3. Gemini API "Limit Exceeded" (429) errors despite subscription.
4. "AI Study Buddy" button hidden behind laptop bookmarks bar.

## Users
Learners browsing YouTube for educational courses who want ranked, emotion-aware study sessions.

## Tech Stack
- **Frontend**: TanStack Start (React 19 + Vite), Tailwind CSS, shadcn/ui, framer-motion, face-api.js, YouTube IFrame API.
- **Backend**: FastAPI + MongoDB (minimal). New AI endpoints powered by `emergentintegrations` (Emergent Universal LLM Key — Gemini 2.5 Flash).
- **Integrations**: YouTube Data API (user key), Emergent LLM Key (Gemini).

## Implemented
- YouTube search + ranking (like ratio, sentiment, recency, syllabus match).
- Bookmarks + compare drawer.
- Syllabus upload + topic match.
- In-app YouTube iframe player with face-api emotion monitor.
- Auto pause/resume on face loss/return (2.5s grace).
- AI Chatbot panel (Chat / Summary / Quiz tabs).
- End-of-video Understanding Feedback dashboard.

### Feb 3, 2026 fixes (this fork)
- **Issue 1 fix**: Removed framer-motion initial opacity:0 on homepage hero → hero text is SSR-visible instantly (confirmed opacity=1 at t=200ms).
- **Issue 2 fix**: Video player Dialog now ignores Escape key and outside clicks; only the explicit X button closes it (so camera/face-detection never trigger accidental close/redirect).
- **Issue 3 fix**: Moved ALL Gemini calls from TanStack server functions (user's rate-limited key) to FastAPI backend using `emergentintegrations` + Emergent Universal Key with `gemini-2.5-flash`. New endpoints: `/api/ai/summarize`, `/api/ai/quiz`, `/api/ai/quiz-eval`, `/api/ai/chat`, `/api/ai/feedback`. Old `frontend/src/lib/gemini.functions.ts` deleted. New thin client: `frontend/src/lib/aiApi.ts`.
- **Issue 4 fix**: AI Chatbot panel repositioned from `bottom-4` with `h-[600px]` to `top-20 bottom-4` with `max-h-[calc(100vh-6rem)]` → header ("AI Study Buddy" label) now always visible, well below any browser bookmarks bar.
- **Issue 5 fix (uninterrupted playback)**: Removed `NO_FACE_PAUSE_MS` auto-pause logic, the "Video paused" overlay, and the "Welcome back" toast. Camera + emotion detection still run silently in the background so Understanding Report still aggregates emotions and counts "breaks taken". `lg:w-72` → `lg:w-96` and `min-h-[220px]` on the webcam preview. Dialog max width `max-w-5xl` → `max-w-6xl`.
- **Issue 6 fix (hydration delay)**: Replaced `yarn start` (`vite dev`, ships ~111 module files) with `vite build && node prod-server.mjs`. New `prod-server.mjs` (Hono + @hono/node-server) serves the built client assets statically and proxies other routes to the built TanStack Start SSR handler. `.env` is loaded manually at server startup for `YOUTUBE_API_KEY`. `VideoPlayer` is `React.lazy()` so the homepage chunk stays small. Result (measured): DOMLoaded 0.27s, fully interactive **0.72s** (was ~10s), only **3 JS files** shipped on first load.

## Architecture
- `backend/server.py` — FastAPI app, registers `ai_routes.router` at `/api/ai/*`.
- `backend/ai_routes.py` — 5 AI endpoints, all using `LlmChat` with `gemini-2.5-flash`.
- `frontend/src/lib/aiApi.ts` — Browser fetch wrappers.
- `frontend/src/components/AIChatbotPanel.tsx` — Chat/Summary/Quiz UI.
- `frontend/src/components/UnderstandingFeedback.tsx` — Emotion dashboard.
- `frontend/src/components/VideoPlayer.tsx` — YouTube IFrame API + face-api integration + locked dialog.
- `frontend/src/hooks/useEmotionDetector.ts` — Face-api wrapper.

## Env Vars (do NOT remove)
- `backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `EMERGENT_LLM_KEY`.
- `frontend/.env`: `REACT_APP_BACKEND_URL`, `YOUTUBE_API_KEY`, `GEMINI_API_KEY` (legacy, unused).

## Backlog / Roadmap
### P1
- Persist chat history and quiz attempts in MongoDB per session.
- Add loading skeletons for suggestion cards.

### P2
- Offline-friendly face-api bundle (currently CDN on load).
- Keyboard shortcut to reopen chatbot (`Shift+A`).

## Known Issues
- None currently. Backend AI verified via curl (all 4 endpoints return real Gemini output).
