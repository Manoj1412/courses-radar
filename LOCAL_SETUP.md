# Local Development Setup (VS Code / your laptop)

The app has **two services** that both need to run:

| Service | Port | What it does |
|---|---|---|
| **Frontend** (TanStack Start + Vite + Node) | `3000` | UI, YouTube search, lazy-loads VideoPlayer. |
| **Backend** (FastAPI + Python) | `8001` | AI endpoints (`/api/ai/chat`, `/api/ai/summarize`, `/api/ai/quiz`, `/api/ai/quiz-eval`, `/api/ai/feedback`) using the Emergent LLM key (Gemini 2.5 Flash). |

If you only run the frontend, AI features will return **404** (nothing serving `/api/ai/*` locally).

---

## 1) Prerequisites

- **Node.js ≥ 20** (`node -v`)
- **Python 3.11+** (`python3 --version`)
- **MongoDB** running locally (only required because `server.py` boots a Mongo client. AI endpoints don't actually use it). Easiest options:
  - macOS / Linux: `brew install mongodb-community` then `brew services start mongodb-community`
  - Docker: `docker run -d -p 27017:27017 --name mongo mongo:7`
- **Yarn** (`npm i -g yarn`)

---

## 2) Backend setup

```bash
cd backend

# 2a. Create virtualenv & install
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# emergentintegrations needs an extra index URL (the official PyPI doesn't host it)
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

### 2b. Create `backend/.env`

```dotenv
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
EMERGENT_LLM_KEY=sk-emergent-1E087Ea2d517603280
```

> The `EMERGENT_LLM_KEY` is a hosted proxy key for OpenAI/Anthropic/Gemini. It works from any machine — you don't need your own Gemini key. Replace it later if you want to use your own provider keys.

### 2c. Run the backend

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Verify:
```bash
curl -X POST http://localhost:8001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"hi","history":[]}'
```
Should return `{"reply": "...", "error": null}`.

---

## 3) Frontend setup

```bash
cd frontend
yarn install --ignore-engines
```

### 3a. Create `frontend/.env`

```dotenv
YOUTUBE_API_KEY=YOUR_OWN_YOUTUBE_DATA_API_KEY
REACT_APP_BACKEND_URL=http://localhost:8001
```

> Get a YouTube key at https://console.cloud.google.com → "YouTube Data API v3" → Create credentials → API key.
> 
> `REACT_APP_BACKEND_URL` must point to the **Python backend**, NOT to Vite. Locally that's `http://localhost:8001`.

### 3b. Run the frontend (two modes)

**Dev mode** (hot reload, slower first paint due to Vite serving 100+ modules):
```bash
yarn dev
# open http://localhost:3000
```

**Production mode** (~1s interactive, recommended for testing real performance):
```bash
yarn start
# this runs `vite build && node prod-server.mjs`
# open http://localhost:3000
```

---

## 4) Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `failed to fetch` / `404` on chat/summary/quiz | Frontend can't reach Python backend | Make sure backend is running on `:8001` and `REACT_APP_BACKEND_URL=http://localhost:8001` is set in `frontend/.env`. Restart frontend after edits. |
| AI calls hang forever | `REACT_APP_BACKEND_URL` points to a remote/sleeping URL | Point it to your local `http://localhost:8001`. |
| Backend boot crashes with "MONGO_URL not set" | Missing `backend/.env` or env vars | Confirm `backend/.env` has `MONGO_URL` and `DB_NAME`. Restart uvicorn. |
| Backend boots but `/api/ai/*` returns 500 | `EMERGENT_LLM_KEY` missing or wrong | Add the key shown above to `backend/.env`. Restart uvicorn. |
| Camera doesn't open | Browsers block camera on `http://` (except localhost). | Use `localhost`, not `127.0.0.1` or LAN IP. |
| YouTube returns "API key is not configured" | `frontend/.env` missing `YOUTUBE_API_KEY` | Add the key, restart frontend. |
| Yarn install fails on `miniflare` engine check | Wrangler peer dependency wants Node ≥22 | Run `yarn install --ignore-engines`. The app itself runs fine on Node 20+. |

---

## 5) Want to skip the Python backend entirely?

If you'd rather run only the frontend, you have two paths:

### Option B: Use your own Gemini key (no backend, no Emergent)

You'd revert the AI calls to call Google's Gemini API directly from a TanStack server function (similar to what existed earlier in `gemini.functions.ts`). That works but you pay any rate-limits yourself. Ping the agent in Emergent if you want this swapped back.

### Option C: Use the Emergent preview backend

Keep `REACT_APP_BACKEND_URL=https://face-engage-edu.preview.emergentagent.com`. This works as long as the preview pod is awake. It will fail when the pod is asleep or the URL changes — not great for a portfolio demo.

---

## TL;DR

1. Run **MongoDB** locally
2. `cd backend && uvicorn server:app --port 8001` with the `EMERGENT_LLM_KEY` in `backend/.env`
3. `cd frontend && yarn start` with `REACT_APP_BACKEND_URL=http://localhost:8001` in `frontend/.env`

That's it. Both services need to be running for AI features to work.
