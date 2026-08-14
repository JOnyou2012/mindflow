# 🧠 MindFlow — Smart Study Scheduler

MindFlow predicts mental burnout and builds an optimized weekly study schedule. Everything runs in the browser — no backend, no accounts, no database. Your data stays in localStorage.

Hard tasks land when you're freshest, breaks appear right before you'd burn out, and the result is a Google-Calendar-style week plan you can iterate on.

## ✨ How It Works

1. **Calibrate** — a 60-second Stroop color game measures your focus score (α), or skip it (α = 1.0)
2. **Schedule** — add your fixed weekly commitments (classes, work, meals)
3. **Tasks** — add homework with type, difficulty, duration, deadline, priority
4. **Generate** — a 4-state Markov chain simulates your brain state every 10 minutes; the scheduler fits tasks into calendar gaps across the week, inserts recovery breaks at burnout thresholds, and respects your chronotype via a two-process circadian model
5. **Plan** — GCal-style week view with navigation, stats, warnings, and unscheduled-task callouts

## 🚀 Quick Start

```bash
npm install     # one-time
npm run dev     # starts at http://localhost:5173
```

That's it. There is no required backend — the Markov engine and scheduler run entirely in the browser.

### Optional Python API

`backend/main.py` (FastAPI) is an optional mirror of the engine for offloading simulation server-side. The client-side app doesn't call it by default; `src/utils/api.js` is ready-to-use infrastructure if you ever want to (`VITE_API_ORIGIN` selects the origin).

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://127.0.0.1:8000
```

## 🧪 Testing & Verification

```bash
npm test          # 5 suites, 3,481 assertion checks (deterministic), 0 failures
npm run build     # production build → dist/ (0 errors expected)
npm run lint      # oxlint over src/ and tests/ (0 warnings expected)
npm audit         # 0 vulnerabilities expected
```

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS v4, Lucide Icons |
| Engine | 4-state non-homogeneous Markov chain (JS, `src/utils/markovEngine.js`) |
| Scheduler | Deadline-aware multi-week cascade + two-process model (`src/utils/scheduler.js`) |
| i18n | 6 languages (EN / ZH-CN / ZH-TW / ES / HI / AR), RTL support |
| Optional API | Python, FastAPI, NumPy (`backend/`) |

## 📁 Project Structure

```
mindflow/
├── index.html               # entry + pre-paint theme/language script
├── src/
│   ├── main.jsx             # React entry (ErrorBoundary + GoogleAuthProvider)
│   ├── App.jsx              # wizard state machine (Calibrate → Schedule → Tasks → Plan)
│   ├── index.css            # Tailwind + MindFlow theme tokens + animations
│   ├── components/
│   │   ├── QuestionFlow.jsx          # one-question-per-screen flows
│   │   ├── WeeklyCalendar.jsx        # 7-column calendar grid + presets
│   │   ├── TaskInputForm.jsx         # task list + form + edit popover
│   │   ├── PlanView.jsx              # GCal-style results week view
│   │   ├── StroopTestModal.jsx       # focus calibration
│   │   ├── GoogleSyncButton.jsx      # GCal connect (gated, see below)
│   │   ├── GoogleCalendarImport.jsx  # GCal → MindFlow blocks (gated)
│   │   ├── GoogleCalendarExport.jsx  # MindFlow plan → GCal (gated)
│   │   └── ErrorBoundary.jsx
│   └── utils/
│       ├── markovEngine.js  # Markov chain math (v5)
│       ├── scheduler.js     # weekly schedule generation (v6)
│       ├── storage.js       # localStorage persistence
│       ├── i18n.js          # 6-language translation system
│       ├── theme.js         # event/priority colors
│       ├── uuid.js          # UUID with legacy fallback
│       ├── api.js           # optional Python-backend bridge
│       ├── googleAuthCore.js / googleAuthContext.js / googleAuth.jsx
│       └── googleCalendar.js # GCal OAuth + import/export (paused)
├── backend/                 # optional FastAPI mirror (main.py)
├── tests/                   # 5 Node test suites
├── netlify.toml             # Netlify deploy config
├── vercel.json              # Vercel deploy config
├── render.yaml              # Render blueprint (backend only)
└── PRD.md                   # master PRD — read before contributing
```

## 🚢 Deployment

**Frontend (recommended: Netlify)** — repo is fully configured:

1. Push to GitHub
2. Netlify: **Add new site → Import from Git** — build command `npm run build`, publish dir `dist` (already in `netlify.toml`; SPA rewrites via `public/_redirects`)
3. Vercel: **New Project → Import** — `vercel.json` provides SPA rewrites, immutable asset caching, and security headers
4. No environment variables required — the app is fully client-side

**Optional backend (Render):** `render.yaml` deploys `mindflow-api` in one click. After the frontend is live, set `MDFLOW_FRONTEND_ORIGIN` in the Render dashboard to your deployed URL (CORS).

**Google Calendar (paused):** code is complete but gated behind `VITE_GOOGLE_CLIENT_ID`. Set that env var at build time (and re-add the GSI script line documented in `index.html`) to light up connect/import/export.

## 🤝 Contributing

- Read **PRD.md** first — it's the source of truth and progress tracker
- `git pull` before starting; commit and push after each step
- Run `npm test` and `npm run build` before pushing — never push a broken build
- New components → `src/components/`, utilities → `src/utils/`, tests → `tests/`
