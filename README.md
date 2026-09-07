# 🧠 MindFlow — Smart Study Scheduler

MindFlow predicts mental burnout and builds an optimized weekly study schedule. Everything runs in the browser — no backend, no database. Optional Google sign-in exists solely for calendar sync. Your data stays in localStorage.

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
npm test          # 8 test files (scheduler ×3, engine, stress, image, stroop, GCal)
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
├── tests/                   # 8 Node test files (see package.json)
├── netlify.toml             # Netlify deploy config
├── vercel.json              # Vercel deploy config
├── render.yaml              # Render blueprint (backend only)
└── PRD.md                   # master PRD — read before contributing
```

## 🚢 Deployment

**Frontend (production: Vercel)** — `https://mindflow-liart.vercel.app`:

1. Push to GitHub → Vercel auto-deploys. `vercel.json` provides SPA rewrites, immutable asset caching, and security headers
2. Google Calendar sync needs `VITE_GOOGLE_CLIENT_ID` set in the Vercel project env (injected at build time). Everything else is fully client-side — no other env vars required
3. Netlify config (`netlify.toml` + `public/_redirects`) is kept as a dormant alternative

**Optional backend (Render):** `render.yaml` deploys `mindflow-api` in one click. After the frontend is live, set `MDFLOW_FRONTEND_ORIGIN` in the Render dashboard to your deployed URL (CORS).

**Google Calendar:** live. Gated only by `VITE_GOOGLE_CLIENT_ID` (the GSI script tag is already in `index.html`). Two-way sync: import real events as plan blocks, export the generated plan, per-task unsync, bulk Remove with orphan sweep.

**Custom-domain launch checklist** (when the domain is purchased):
1. **Google Cloud console** — add the new domain to the OAuth Client ID's **Authorized JavaScript origins**, or Calendar sign-in fails with `origin_mismatch` (console-only change; no repo edit).
2. **Vercel dashboard** — attach the domain; add a www→apex redirect (and optionally vercel.app→apex) via project redirects or a `redirects` block in `vercel.json`. SSL is auto-provisioned.
3. **Repo** — swap every `mindflow-liart.vercel.app` for the new domain: `index.html` (og:url, og:image, twitter:image, canonical — marked with TODO comments) and `public/sitemap.xml`.
4. Optional: revive the backend (see below) — it is dead weight today; the frontend makes no non-Google API calls.

## 🤝 Contributing

- Read **PRD.md** first — it's the source of truth and progress tracker
- `git pull` before starting; commit and push after each step
- Run `npm test` and `npm run build` before pushing — never push a broken build
- New components → `src/components/`, utilities → `src/utils/`, tests → `tests/`
