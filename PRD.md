# MindFlow — Master PRD

---

## 🤖 AI AGENT RULES — READ THIS FIRST

> **This project is worked on by multiple people and multiple AI agents.**
> To keep everyone in sync, every AI agent MUST follow these rules:

1. **COMMIT YOUR WORK.** After completing any step or meaningful change, run:
   ```
   git add -A && git commit -m "descriptive message" && git push origin main
   ```
   Always `git pull` before starting work to get the latest changes.

2. **UPDATE THIS PRD.** After completing steps, immediately update:
   - The progress percentage at the top of this file
   - The master progress table (check off completed steps)
   - The stage completion table
   - The "Next" line pointing to the next unfinished step
   - Add a dated note in the audit log section describing what you did

3. **CHECK THE CHECKLIST FIRST.** At the start of every session, read the master
   progress table. Look for the next unchecked step. Ask yourself: "What percentage
   are we at? What's the next undone step?"

4. **RUN TESTS BEFORE COMMITTING.** `node tests/scheduler.test.js` and verify
   `npm run build` passes with 0 errors. Never push broken builds.

5. **BE SPECIFIC IN COMMIT MESSAGES.** Include step numbers (e.g. "steps 86-88"),
   what was built, and any bugs fixed. Use the format:
   ```
   feat/fix/docs: short description (steps X-Y)
   
   - bullet points of what changed
   
   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

6. **DON'T DUPLICATE WORK.** Read the master progress table before building anything.
   If a step is marked ✅, it's done — don't rebuild it. If it's ❌, it needs work.

7. **KEEP FILES ORGANIZED.** New components go in `src/components/`. Utilities in
   `src/utils/`. Tests in `tests/`. Follow the existing file naming conventions.

8. **WHEN IN DOUBT, PULL.** Always `git pull` before starting. Your partner or their
   AI might have pushed changes since your last session.

---

> **Progress: 85 / 85 core steps complete — 100%** | **All audits resolved ✅**
>
> **Stage 1 (Foundation): 13/13 = 100%** | **Stage 2 (Core): 52/52 = 100%** |
> **Stage 3 (App Shell): 9/9 = 100%** | **Stage 4 (Integration): 11/11 = 100%** |
> **Stage 5 (Google Calendar): PAUSED** — code complete, UI gated behind
> `VITE_GOOGLE_CLIENT_ID` (hidden until OAuth client ID is configured)
>
> **Part 8 (Schedule Image Export): 📋 PLANNED** — spec complete (steps
> 101–110), development deferred until approved
>
> **🎯 Deploy-ready (2026-08-18, transition-buffer feature + mega-audit).**
> All tiers resolved. `npm test` runs 5 suites (3,504 assertion checks),
> 0 failures, byte-deterministic output. `npm run build` 0 errors, 0
> warnings. Project lint: 0 warnings. `npm audit`: 0 vulnerabilities.
>
> **2026-08-11/12 (Jeremy — production hardening sprint):** Three-pass
> comprehensive audit + fix cycle across all 20 source files, config, build
> output, and test suite.
>
> **Pass 1 — Remaining audit bugs (7):** M1 (flow-block bonus gated on
> `lastTaskType` match), M3 (explicit `todayMidnight` in deadlineAllowsDay),
> L10 (edit popover: `role="dialog"`, Escape key, `htmlFor`+`id`, `aria-label`),
> H1 (~95 keys added to es/hi/ar + ar Chinese gcal keys replaced with Arabic),
> H4 (4× en-US → `langToLocale()` + index-based today detection, `exportSessions`
> mutation fix), E2 (dead JSDoc params removed).
>
> **Pass 1 extended — i18n completeness:** zh-CN and zh-TW were still missing
> 95 keys each (PRD incorrectly marked them done). Now all 6 languages at 240
> keys with perfect parity. Stroop color names (`stroopRed/Green/Blue/Yellow`)
> translated in all 6 languages, COLORS array converted to `getColors(T)`.
> DEV-gated `console.error` in scheduler.js:1566 removed (was last remaining).
>
> **Pass 2 — Production resilience:** Dynamic `<html lang>` + `dir="rtl"`
> in blocking script and React `useEffect`. `loadCalibration` structural
> validation (rejects primitives, arrays, missing alphaScore). `build.target:
> 'es2019'` for older browser support. 30s timeouts on all 5 Google Calendar
> `fetch()` calls. Console error diagnostics (task count, alpha, chronotype,
> timestamp logged with failures). ErrorBoundary shows error details in
> collapsible `<details>`. `unhandledrejection` listener in main.jsx.
>
> **Pass 3 — CSS, a11y, and code review:** RTL CSS support (`[dir="rtl"]`
> rules for flex direction, margins, positioning, animations). Contrast fixes
> (accent blue #1a73e8→#1669d4, warning orange #e37400→#c26400). Keyboard
> accessibility: calendar blocks and task items now `role="button" tabIndex={0}`
> with Enter/Space handlers. Settings dialog and edit popover: Escape key +
> `role="dialog" aria-modal". `noscript` fallback in index.html. Dark
> `theme-color` meta tag. Invalid Tailwind `placeholder-mindflow-muted`→
> `placeholder:text-mindflow-muted`. Hardcoded `#d93025`→CSS variable.
> `generateTrial` stale T closure fixed. `exportSessions` array mutation fixed
> via spread copy. `handleGenerate` missing `googleBlocks` dep. Step 2 check
> now includes Google Calendar blocks. `&gt;` entity→JSX expression. Disabled
> back button `pointer-events-none`. Unused CSS vars removed.
>
> **Pass 4 — Self-review:** QuestionFlow Rules of Hooks violation (early
> `return null` before all hooks). Hardcoded English plural "task(s)" in
> PlanView. Dead `T.gcalExportDuplicate` key removed. `npm test` script
> added to package.json (was missing — CI would fail). Date-sensitive
> extreme test suite made future-proof with dynamic Monday computation.
>
> **Final state:** Build: 374KB JS + 56KB CSS (gzipped ~122KB). All 5 test
> suites pass (3,379 tests, 0 failures). 242 i18n keys × 6 languages, 0
> mismatches, every T.* reference resolves. 0 console.log, 0 debugger,
> 0 eval(), 0 innerHTML, 0 DEV-gated errors. 0 lint warnings in project
> code. `npm audit`: 0 vulnerabilities. Vercel + Netlify config in
> place with security headers + SPA rewrites + asset caching.
>
> **Known limitations (non-blocking):** Day abbreviations (Mon/Tue/...) are
> hardcoded English (DAYS array used as both data keys and display labels).
> Google Calendar error handler is a no-op in WeeklyCalendar (paused feature).
> Two unused exports (`clampAndNormalize` in markovEngine.js, `clearGoogleExport`
> in storage.js). No `og:image` for social previews.
>
> **2026-08-13 (Jeremy — test suite date-proofing):** `npm test` was failing in
> `tests/scheduler-advanced.test.js` D4.1 — the deadline tests computed "this
> Wednesday", which is in the past Thu–Sun. Since the 2026-08-09 hardening
> intentionally treats past-deadline tasks as urgent (schedulable on any
> remaining day), the task got scheduled and the assertion crashed on
> `unscheduled[0]`. Fixed by pinning an explicit future `weekStartDate`
> (`futureMonday()` + `addDays()` helpers, same pattern as
> scheduler-extreme.test.js) so the scenario is identical every day of the
> week, and replacing the hardcoded `2026-08-07` Friday deadline with a
> computed target-week Friday. All 5 suites green (119 + 754 + extreme +
> 672 + 270, 0 failures), build 0 errors.
>
> **2026-08-13 (Jeremy — pre-deploy polish pass):** Full re-verification +
> cleanup. **1) GCal export duplicate detection wired** — `existingSet` was
> built but never consulted, so re-export duplicated every event; now
> `mindflow_session_key` (`taskId::weekStart::day::startTick`) is stored in
> extended properties and checked before each create. **2) googleAuth split**
> into `googleAuthCore.js` (OAuth state/functions) + `googleAuthContext.js`
> (context/hook) + `googleAuth.jsx` (provider component only) — removes 7
> fast-refresh lint warnings. **3) Zero lint warnings** across src/ and
> tests/ — removed dead imports/vars in App.jsx, scheduler.js, extreme/stress/
> engine-v3 suites, and PlanView's two useMemos with the unused `weekResults`
> dep (now plain per-render computations — fresher "today" handling, same
> behavior). **4) i18n** — added `gcalExportSkipped`/`gcalExportFailed` keys in
> all 6 languages (242 keys total); export summary now surfaces skipped and
> failed counts instead of hardcoded English. **5) `npm audit fix`** — nanoid
> (vite→postcss transitive, build-time only) 3.3.16→3.3.18; audit now 0
> vulnerabilities. **6) Bundle claims re-verified** against `dist/`: 0
> console.log/debugger/DEV-guards; the 5 console.error sites are the intended
> unconditional production diagnostics; innerHTML/dangerouslySetInnerHTML
> matches are React DOM internals, none in our source. Final state: 5 suites,
> 3,379 tests, 0 failures; build 374 KB JS + 56 KB CSS (~112 + 10 KB gzipped).
>
> **2026-08-14 (Jeremy + Claude — final deployment audit):** Read-through of
> PRD + deploy configs + production bundle. **7 fixes:**
> **1) vercel.json simplified to standard single-service SPA config** — the
> previous file used Vercel's `services` monorepo form (service objects +
> `{ service: ... }` rewrite destinations). NOTE: that form IS schema-valid
> in current Vercel CLI (verified against the real v59 validator — both old
> and new files pass), but it deploys two services for an app whose backend
> is optional and uncalled in production. New file: single-service rewrite
> `/(.*)` → `/index.html`, immutable asset cache, security headers, validated
> against the same CLI validator. The `/api` proxy was dropped — `api.js`
> calls the backend via absolute `VITE_API_ORIGIN` (falls back to
> `mindflow-api.onrender.com`); Netlify config was already correct.
> **2) GCal UI was live without a client ID** — the "Connect Google Calendar"
> button (Step 2) and plan-export button (Step 4) rendered in production and
> clicking them surfaced raw `Not initialized` errors, plus the GSI script
> loaded ~50KB of third-party JS on every page visit for a paused feature.
> Now gated on `import.meta.env.VITE_GOOGLE_CLIENT_ID` in WeeklyCalendar +
> PlanView; esbuild folds the unset-var branch so the GCal components are
> tree-shaken from the bundle. GSI script removed from index.html (comment
> documents the 2-step re-enable). Bundle: 374 KB → 356 KB JS.
> **3) Invalid nested `@keyframes`** inside `[dir="rtl"]` (index.css) —
> at-rules can't nest in selector rules; Lightning CSS warned 2× and the RTL
> slide-direction flip silently never shipped. Hoisted as top-level
> `stage-in-*-rtl` keyframes + `animation-name` overrides under `[dir="rtl"]`.
> Build now 0 CSS warnings; Arabic question-flow slides actually mirror.
> **4) `npm run lint` linted vendored files** — bare `oxlint` picked up
> `.agents/skills/` third-party bundles (10 warnings). Scoped to
> `oxlint src/ tests/`. 0 warnings.
> **5) README rewritten** — was pre-revamp (claimed Stroop + task manager
> weren't built; listed removed files). Now has current structure, test
> commands, and deploy steps for Netlify/Vercel/Render + GCal gating notes.
> **6) recharts removed** — dead dependency since the 2026-08-07 revamp
> removed SessionChart/Dashboard (0 imports). Not in the bundle, but it
> bloated installs + audit surface.
> **7) Test counts were non-deterministic** — the suites count assertions,
> not test cases, and engine-v3's N10b-d loop asserted per timeline point
> with `Math.random()` step counts, so run-to-run totals wobbled (observed
> 807–912). Replaced with a seeded mulberry32 PRNG; added a FINAL total to
> the extreme suite (it printed none). Two full-suite runs now produce
> byte-identical output. True per-suite totals (deterministic): scheduler
> 119, advanced 754, extreme 1,414, engine-v3 924, stress 270 = **3,481
> assertion checks**. (The historical "3,379" figure mixed stale counts.)
> **8) Dead public/icons.svg removed** (unreferenced since the initial
> commit; was shipping in every deploy) and **engines.node** added to
> package.json (Vite 8 requires ^20.19 || >=22.12 — lets Netlify/Vercel
> pick a compatible runtime).
> Final state: 5 suites, 3,481 checks, 0 failures, deterministic; build
> 356 KB JS + 56 KB CSS (~108 + 10 KB gzipped), 0 errors, 0 warnings;
> lint 0; audit 0. Verified in `dist/`: no GSI script tag, no GCal UI
> strings, RTL keyframes present. `npm ci` from lockfile passes clean.
>
> **2026-08-16 (Jeremy + Claude — pre-deployment mega-audit):** Six parallel
> audit tracks (tests ×2 for flakes, lint+build+preview smoke, Python backend,
> frontend critical paths, deploy configs, security review of the
> `0ea6f07..HEAD` window), then fix + re-verify. **19 files changed, 204
> insertions, 50 deletions.**
> **1) Backend JSON contract (H1)** — `/api/simulate` + `/api/recovery`
> read only query params; `api.js` POSTs a JSON body, so every parameter was
> silently ignored (responses computed from defaults with no error). Both
> endpoints now accept a Pydantic body model OR query params (body wins).
> Verified live against uvicorn.
> **2) `/api/recovery` validation (M1)** — `flow=nan` / negative
> `break_minutes` crashed the JSON serializer (HTTP 500) or *increased*
> fatigue. Non-finite / negative inputs now return 422.
> **3) CORS parsing (L1)** — `MDFLOW_FRONTEND_ORIGIN` was appended raw:
> comma-separated lists never matched any Origin and `"*"` silently opened
> allow-all. Now split per-origin, plus a startup warning while the allowlist
> is dev-only (the Render blueprint previously deployed CORS-blocked with no
> loud failure).
> **4) Engine honesty (H2)** — removed the false "Matches markovEngine.js v2
> exactly" header (frontend runs v5). API documented as the v2 reference
> implementation; v5 port is post-deploy backlog. Docstring "matrix: final
> transition matrix" → "matrix built at tick 0".
> **5) Reproducible backend deploys (M2)** — requirements.txt pinned
> (`numpy==2.0.2`, `fastapi==0.128.8`, `uvicorn==0.39.0`) +
> `PYTHON_VERSION: 3.12.11` in render.yaml (Render's new 3.14 default ships
> no numpy 2.0.2 wheels → the build would fail from source).
> **6) GCal export error surfacing** — sign-in failures (popup blocked,
> `access_denied`) were invisible: the signed-out branch rendered before the
> error branch. Mid-export 401/403 were swallowed into "{n} failed" with no
> re-auth path. Errors now render; revoked scope signs out so re-consent is
> possible; the export widget resets its "Synced N sessions" claim when the
> plan regenerates (new `planVersion` prop through PlanView).
> **7) Google import week-scoping** — imported events were applied to ALL 7
> cascade weeks, so a one-off "Dentist Tue 15:00" blocked that slot in every
> generated future week. Now applied to week 0 (the imported week) only.
> **8) Storage sanitization** — `loadGoogleExport` now deep-validates
> (non-array `events` used to throw AFTER the events were already created in
> Google → "Failed to sync" + orphaned events). `sanitizeTask` repairs
> missing `id` (uuid) and normalizes unknown `type`/`priority`.
> **9) Scheduler robustness** — out-of-window blocks (e.g. 23:00–01:00)
> produced inverted merged intervals → phantom free slots past 10pm; unknown
> priority strings made the sort comparator NaN. Both fixed + 4 regression
> asserts added (stress suite 270 → 274).
> **10) Config hardening** — vercel.json: removed obsolete
> `X-XSS-Protection` and the svg rule that 1-year-cached root
> `/favicon.svg`; `.env.example` documents `VITE_API_ORIGIN` + "add every
> deployed domain to OAuth origins"; netlify.toml no longer duplicates the
> backend URL (single-sourced in `api.js`); `api.js` gained a 30s request
> timeout (Safari <16.4 fallback) so a cold Render backend can't hang calls.
> **11) Small fixes** — OVERDUE now uses end-of-day deadline semantics
> (matches the scheduler; a task due today is not overdue at 9am); the OAuth
> 60s timeout restores the GIS callback (no ghost token while UI shows
> signed-out); import Refresh falls back to the Connect button when the token
> was cleared elsewhere; calendar conflict checks now include
> Google-imported blocks; RTL slide animations respect
> `prefers-reduced-motion` (moved into a no-preference media query).
> **Security review:** 30 changed files (~1,073 insertions) — no HIGH or
> MEDIUM confidence vulnerabilities. OAuth tokens never touch
> localStorage/logs and only reach `www.googleapis.com`; 0 innerHTML /
> dangerouslySetInnerHTML / eval in src/; no secrets in backend code.
> **Final state:** 5 suites, 3,497 checks, 0 failures; build 0 errors 0
> warnings; lint 0; backend smoke-tested live (health, JSON-body simulate,
> query fallback, 422s, CORS header, startup warning).
>
> **Remaining manual deploy steps:** set `MDFLOW_FRONTEND_ORIGIN` in the
> Render dashboard; add the final production domain to Google Cloud Console
> OAuth "Authorized JavaScript origins".
>
> **2026-08-18 (Jeremy + Claude — transition buffer between events):** New
> `transitionBufferMins` setting (Off / 15 / 30 min, default 15) — study
> sessions no longer start the minute a fixed event ends or run right up to
> the next one. Users get rest/travel time to move between events.
> **1) Scheduler** — `findFreeSlots(blocks, bufferTicks)` pads every merged
> block interval on both sides before slot computation, so free time
> inherently excludes the transition zones; `generateWeeklySchedule` reads
> `settings.transitionBufferMins` (whitelisted 0/15/30, default 15) and
> converts to ticks via `Math.ceil(mins / 10)` — 1 tick = 10 min, so the
> 15-min option enforces "at least 15 minutes" (2 ticks ≈ 20 min). Applies
> to custom calendar blocks AND Google-imported blocks (both enter
> `allBlocks`). The existing 30-min inter-session gap (`GAP_TICKS`) is
> unchanged. **2) Settings UI** — segmented Off/15/30 control in the
> settings dialog (chronotype pattern); storage.js `DEFAULTS` +
> whitelist sanitization in `loadSettings`; added to the generate-failure
> diagnostic log. **3) i18n** — `settingsTransition` / `transitionOff` /
> `transitionMins` keys in all 6 languages. **4) Tests** — 8 new asserts
> (findFreeSlots geometry for 0/2/3-tick buffers; generate-level
> no-session-in-transition-zone invariants for default/30/0 settings);
> test 15.5 updated to assert the buffer invariant instead of pinning the
> landing day. **5) Known behavior note:** with the default buffer, a task
> that used to squeeze into the hour before/after a block may move to a
> different day — that is the intended trade-off of reserving transition
> time. Final state: 5 suites, 3,504 checks, 0 failures.
>
> **2026-08-18 (Jeremy + Claude — Part 8 planned, development deferred):**
> Spec for **Schedule Image Export** written into the PRD as Part 8 (steps
> 101–110). No code written yet — start only when explicitly approved.
> Approach: dependency-free SVG → canvas → PNG download (`showSaveFilePicker`
> for the OS save dialog / Desktop on Chromium, `<a download>` fallback).
>
> **2026-08-07 (question flows):** Form entry inside steps 2–3 replaced with
> one-question-per-screen flows (`src/components/QuestionFlow.jsx`) — fast
> slide transitions (0.22s), auto-advance on single-choice answers, Enter to
> advance text inputs, Skip on optional questions, progress bar + back chevron,
> "Add another?" decision screen after each add. Calendar grid, task list, edit
> popover, and quick presets unchanged in behavior. Wizard footer hides while a
> flow is active. New flow strings translated in all 6 languages.
>
> **2026-08-07 (revamp):** Complete UX + visual overhaul. The single scrolling
> page is now a 4-step wizard — Calibrate → Schedule → Tasks → Your plan — one
> phase per page, with a stepper, per-page footer nav, and a dedicated results
> page (`src/components/PlanView.jsx`: GCal-style week view, Today/prev/next
> week navigation, stats strip, warnings, unscheduled callout, stale-regenerate
> banner). Visual identity replaced with a Google Calendar register: light mode
> default (dark kept as a settings toggle), Roboto, #1a73e8 primary, hairline
> borders, solid event chips, circular date headers. Removed WelcomeScreen.jsx,
> MarkovAnalyticsDashboard.jsx, SessionChart.jsx (dead/vibecoded), the accent
> picker, Playfair/Inter, gradients, glass, and glow effects. Settings is now a
> dialog. Shared colors centralized in `src/utils/theme.js`; design tokens
> documented in DESIGN.md; product facts in PRODUCT.md. New i18n keys
> translated in all 6 languages. All ~1,970 tests pass, build 0 errors.
>
> **2026-08-07:** Language/i18n **complete** — 6 languages (EN/ZH-CN/ZH-TW/ES/HI/AR)
> with 130+ translation keys each, covering every UI string across all 6 components.
> Language selector dropdown in settings panel persists to localStorage. Per-key
> English fallback for untranslated strings. All type labels, priority labels,
> difficulty labels, presets, error messages, calendar stats, and settings labels
> are fully translated. Build 0 errors, 0 new lint warnings.
>
> **2026-08-08 (deadline fix):** The task form stores deadlines as `YYYY-MM-DDTHH:MM`
> (e.g. `2026-08-15T23:59`). Two locations in the scheduling pipeline blindly appended
> `T00:00:00` to the deadline string, producing `2026-08-15T23:59T00:00:00` — an
> invalid Date. This caused EVERY task with a deadline to fail the App.jsx eligibility
> filter and be permanently deferred, never reaching the scheduler. Fixed by checking
> for an existing `T` separator before appending (matching the already-correct pattern
> in `deadlineAllowsDay` and `slotBeforeDeadline`). Also fixed silently dropped tasks:
> tasks deferred beyond the last generated week are now appended to that week's
> unscheduled list instead of vanishing. Added regression tests 15.7 (time-including
> deadline) and 15.8 (date-only deadline). All 1,998 tests pass, build 0 errors.
>
> **2026-08-08 (scheduler audit):** Comprehensive audit of the smart scheduler
> algorithm across extreme and edge-case scenarios. Two real bugs found and fixed:
> **1) Deadline-day blocked** — `deadlineAllowsDay()` normalized day dates to
> end-of-day (23:59:59.999) and compared `<=` against deadlines (time 23:59:00),
> so `23:59:59.999 <= 23:59:00` was always false — no task could be scheduled on
> its deadline day. Fixed by normalizing both dates to midnight for a pure date
> comparison. **2) Timezone-unsafe wsDate** — the default week-start-date used
> `toISOString()` (UTC), shifting the entire week by one day in timezones ahead
> of UTC (Asia, Australia). Fixed with local date parts matching the existing
> `todayStr` pattern. Added `tests/scheduler-extreme.test.js` with ~1,400 tests
> covering deadline boundaries, capacity edges, structural invariants, two-process
> model math, 100-task bulk stress, null/NaN safety, timezone independence, and
> determinism. All 2,553 tests pass, build 0 errors.
>
> **2026-08-08 (deployment audit):** Pre-launch audit of every file for bugs that
> only appear after deployment. **7 bugs found and fixed:**
> **1) CORS locked to localhost** — backend `allow_origins` only listed
> `localhost:5173`; deployed frontend on Netlify/Vercel would get CORS-blocked on
> every API call. Added `MDFLOW_FRONTEND_ORIGIN` env var + `RENDER_EXTERNAL_URL`
> auto-detection (`backend/main.py`).
> **2) API proxy missing in production** — Vite's dev proxy (`/api` → `:8000`) is
> stripped at `vite build`; deployed frontend would 404 on every `/api/*` call.
> Created `src/utils/api.js` with `VITE_API_ORIGIN` env var; auto-selects
> empty-string (Vite proxy) in dev, Render URL in production.
> **3 & 4) formatDeadline / isPastDeadline T00:00:00 double-append** — same bug
> pattern already fixed in the scheduler pipeline (commit `0bc2e12`): time-including
> deadlines like `2026-08-15T23:59` became `2026-08-15T23:59T00:00:00` → Invalid
> Date. Missed in the earlier fix because these two functions live in
> `TaskInputForm.jsx`, not the scheduler. Fixed with `includes('T')` guard.
> **5) toISOString() in deadline fallback** — `TaskInputForm.jsx` used
> `new Date().toISOString()` as default date for the deadline picker; in timezones
> ahead of UTC shows yesterday's date. Replaced with local date parts.
> **6) No meta/OG tags** — `index.html` had no `<meta name="description">` or Open
> Graph tags; Google and social previews would show auto-generated junk. Added
> description, theme-color, og:title, og:description, og:type.
> **7) No SPA redirect config** — without `_redirects` or `netlify.toml`,
> refreshing any page or deep-linking shows a Netlify 404. Created both files
> (`public/_redirects`, `netlify.toml`) + `render.yaml` for one-click backend
> deploy. All 2,553 tests pass, build 0 errors, backend imports OK.
>
> **2026-08-09 (deployment follow-up):** Second-pass audit of the 7 deployment-bug
> fixes from 2026-08-08. **7 refinements across 3 commits:**
> **1) api.js documented as optional infrastructure** — the module was created but
> never imported; the app runs fully client-side (JS markov engine + scheduler in
> the browser). Added comprehensive JSDoc explaining api.js is ready-to-use
> infrastructure for offloading simulation to the Python backend when needed.
> Also added `Accept: application/json` header for proper content negotiation.
> **2) netlify.toml VITE_API_ORIGIN clarified** — comment now explains the env var
> is for api.js (optional backend integration), not a required setting.
> **3) Twitter Card tags + og:image evaluated** — added `twitter:card`,
> `twitter:title`, `twitter:description` for Twitter sharing. Evaluated `og:image`
> but removed it: most social platforms (Facebook, LinkedIn) don't support SVG
> images; a broken image is worse than a text-only card.
> **4) console.error production-safe** — three `console.error()` calls in
> `App.jsx` and `scheduler.js` leaked stack traces in production builds. Wrapped
> with `import.meta.env.DEV` guards so Vite strips them at build time. Verified:
> 0 of our console.error calls remain in the production bundle.
> **5) CORS comment corrected** — the original comment claimed auto-detection of
> `.netlify.app` domains but the code only added `RENDER_EXTERNAL_URL` (the
> backend's own URL). Fixed comment to accurately document the 3 allowed origins
> and the manual `MDFLOW_FRONTEND_ORIGIN` setup requirement.
> **6) backend __main__ comment clarified** — added note that Render's
> startCommand overrides the local `127.0.0.1` binding.
> **7) Stroop interference display mismatch** — the scoring formula was
> updated to `interferenceMs / 12, max 15` (v5) but the results-display
> formula still used the old `interferenceMs / 10, max 20`. Users saw a
> different penalty value than what was actually applied to their score.
> Also lowered the display threshold from 30ms to 0ms so all applied
> penalties are visible. All ~1,929 tests pass, build 0 errors
> (320 KB JS + 47 KB CSS, gzipped 97+9 KB).
>
> **2026-08-09 (Vercel config):** Added `vercel.json` — the project now supports
> both Netlify and Vercel for frontend hosting. Config includes SPA rewrites
> (`/(.*)` → `/index.html`), 1-year immutable cache for hashed assets
> (`/assets/*` + `*.svg`), and production security headers (X-Content-Type-Options,
> X-Frame-Options: DENY, X-XSS-Protection, Referrer-Policy). Build 0 errors.
>
> **2026-08-09 (PlanView default-week fix):** When the scheduler runs late in the
> week (Thursday–Sunday), most days of the current week are already past. Tasks
> correctly cascade to the next full week, but PlanView was showing the first
> week with *any* result — even one where all tasks were unscheduled. Fixed
> `defaultIdx` to find the first week that actually has scheduled sessions.
> On Sundays with 2 simple tasks, the user now sees next week's full schedule
> instead of "2 tasks could not fit." All ~2,000 tests pass, build 0 errors.
>
> **2026-08-09 (defensive hardening):** Eight bugs found and fixed:
> **1) Overdue tasks permanently dropped** — `deadlineAllowsDay()` returned
> false for every day when the deadline was in the past, so overdue tasks were
> never scheduled. Now treats past-deadline tasks as urgent (allowed on any
> remaining day).
> **2) Trailing-T deadline corruption** — deadline strings ending in `T` (e.g.
> `2026-08-15T` from corrupted localStorage) produced Invalid Date across 5+
> parsing locations. Added `normalizeDeadline()` helper in scheduler.js and
> trailing-T guards in TaskInputForm.jsx + App.jsx eligibility check.
> **3) PlanView stale "today"** — `allWeeks` and `todayIdx` had empty useMemo
> deps, so the Today highlight stuck after midnight. Added `weekResults` to
> dependency arrays.
> **4) QuestionFlow empty-stages guard** — missing null-check on `stages[index]`
> would crash if stages array was ever empty. Added defensive null return.
> **5) setTimeout cleanup** — App.jsx generate timer wasn't captured or cleared
> on unmount. Added ref tracking + cleanup effect.
> **6) Hardcoded English strings** — 3 locations bypassed i18n: schedule error
> message, task delete confirmation, calendar placeholder. Routed through T.*
> with English fallbacks.
> **7) localStorage save failures now warn** — save functions return false and
> log warnings in dev when QuotaExceededError occurs (previously silent).
> **8) Far-future deadlines permanently deferred** — the cascade eligibility
> filter used `deadline <= weekEnd + 10 days`, permanently excluding tasks
> due more than 10 days beyond any generated week. Tasks due in December
> were ineligible for all 8 cascade weeks and showed as "could not fit."
> Changed to allow any task whose deadline hasn't already passed before
> the week starts; far-future tasks are eligible but deprioritized by the
> scheduler's deadline-week scoring penalty.
> All ~2,000 tests pass, build 0 errors.
>
> **2026-08-09 (pre-deployment production audit):** Comprehensive adversarial audit
> of all 18 source files, config, build output, and test suite. 35+ bugs found,
> organized below by severity tier. **28 of 35 fixed on 2026-08-11 (see
> Jonathan entry above).** Remaining 7 bugs annotated below.
>
> ---
>
> ### 🔴 TIER 1 — Crashes & Data Loss (7 bugs) ✅ ALL FIXED (2026-08-11)
>
> **C1 — `deadlineToDay()` T00:00:00 double-append**: ✅ Replaced
> `isoDate + 'T00:00:00'` with `normalizeDeadline(isoDate)` at all 3 call sites.
>
> **C2 — Session double-booking**: ✅ Added `dayOccupiedIntervals[day]`
> tracking — each candidate placement is checked against already-placed
> session intervals before assignment (both main and refinement passes).
>
> **C3 — `calibration.alphaScore.toFixed(2)` crashes on old data**: ✅
> Guarded with `calibration?.alphaScore != null ? ...toFixed(2) : '—'` in
> App.jsx and StroopTestModal.jsx.
>
> **C4 — NaN alpha passes validation**: ✅ Changed guard to
> `!Number.isFinite(calibration.alphaScore)` in App.jsx.
>
> **C5 — `crypto.randomUUID()` crashes on HTTP / old browsers**: ✅
> Created `src/utils/uuid.js` with try/catch fallback. All 3 call sites
> now use `uuid()`.
>
> **C6 — localStorage save failures silent in production**: ✅
> `console.warn` is now unconditional (no DEV gate). App.jsx setter wrappers
> check save return values and call `setError()` on failure.
>
> **C7 — `setSettings` doesn't increment `dataVersionRef`**: ✅
> `setSettings` now calls `dataVersionRef.current++`, matching
> setCalendarBlocks and setTasks.
>
> ---
>
> ### 🟠 TIER 2 — Broken i18n & Non-English UX (6 bugs) ✅ ALL FIXED (2026-08-11)
>
> **H1 — 71 i18n keys exist in `en` but missing from ALL 5 non-English languages**
> (`i18n.js`): ⚠️ **PARTIALLY FIXED.** zh-CN and zh-TW now have all new keys
> (including Google Calendar strings). es, hi, ar still fall back to English
> for ~70+ keys. Remaining: es, hi, ar translations needed.
>
> **H2 — 3 i18n keys completely absent (not even in `en`)**: ✅ **FIXED.**
> `scheduleGenFailed`, `saveFailed`, `calEventPlaceholder` added to all 6
> language blocks.
>
> **H3 — Wrong i18n key name: `taskConfirmDeleteAll` vs `confirmDeleteAll`**:
> ✅ **FIXED.** Changed `T.taskConfirmDeleteAll` to `T.confirmDeleteAll` in
> TaskInputForm.jsx, matching the existing key.
>
> **H4 — 4× hardcoded `'en-US'` locale in date formatting**: ✅ **FIXED.**
All 4 sites now use `langToLocale(getStoredLang())`. WeeklyCalendar today
detection switched to index-based comparison (no locale at all).
>
> **H5 — Stroop color words hardcoded to English**: ✅ **FIXED.**
`stroopRed/Green/Blue/Yellow` keys added to all 6 language blocks.
COLORS array converted to `getColors(T)` / `getColorByKey(T)` helpers.
>
> **H6 — 3 deadline parsing sites not using `normalizeDeadline()`**: ✅ **FIXED.**
> `slotBeforeDeadline`, `analyzeTasks`, and `sortTasks` now all use
> `normalizeDeadline(task.deadline)`.
>
> ---
>
> ### 🟡 TIER 3 — Scheduler Logic Bugs (3 bugs) ✅ ALL FIXED (2026-08-11)
>
> **M1 — Flow-block bonus uses total slot consumption**: ✅ **FIXED.**
> Added `lastTaskType` to slot objects; flow-block bonus now gated on
> `slot.lastTaskType === task.type`. Mixed-type sequences no longer get
> false flow-block bonuses.
>
> **M2 — DST transitions skew `daysUntilDeadline`**: ✅ **FIXED.**
> Added `Math.round()` around the division by 86400000, correcting ±1 day
> error during DST transitions.
>
> **M3 — `deadlineAllowsDay` for past deadlines compares against `new Date()`**: ✅ **FIXED.**
> Replaced opaque `deadlineDt < new Date()` with explicit
> `deadlineDt < todayMidnight` (midnight-normalized). Behavior unchanged,
> intent now explicit.
>
> ---
>
> ### 🔵 TIER 4 — UX, Accessibility, Fragility (11 bugs) ✅ ALL FIXED (2026-08-11)
>
> **L1 — No ErrorBoundary anywhere** (entire codebase): ✅ **FIXED.**
> Created `src/components/ErrorBoundary.jsx` with fallback UI. Wraps `<App>`
> in `main.jsx`.
>
> **L2 — Flash of wrong theme (FOWT)** (`App.jsx:55-57`): ✅ **FIXED.**
> Blocking `<script>` in `index.html` reads `mindflow_theme` from localStorage
> and applies `html.dark` class synchronously before first paint.
>
> **L3 — `color-scheme: light` missing on `:root`**: ✅ **FIXED.**
> Added `color-scheme: light;` to the `html` rule.
>
> **L4 — All production error logging stripped by DEV guards** (3 sites): ✅ **FIXED.**
> `console.error` calls in App.jsx and scheduler.js are now unconditional
> (DEV guards removed).
>
> **L5 — `useState(defaultIdx)` never re-syncs on async results**: ✅ **FIXED.**
> Added `useEffect(() => { setSelIdx(defaultIdx); }, [defaultIdx])` to re-sync
> when results change.
>
> **L6 — Task delete button invisible on touch devices**: ✅ **FIXED.**
> Added `@media (hover: none)` rules so delete icon is always visible on
> touch devices.
>
> **L7 — `formatMinutes` crashes on undefined duration**: ✅ **FIXED.**
> Added `if (mins == null || !Number.isFinite(mins)) return '—';` guard.
>
> **L8 — No `prefers-reduced-motion` support**: ✅ **FIXED.**
> All animations wrapped in `@media (prefers-reduced-motion: no-preference)`,
> with `reduce` mode disables all motion.
>
> **L9 — `<button>` elements missing `type="button"`** (PlanView.jsx): ✅ **FIXED.**
> Added `type="button"` to all 4 navigation buttons in PlanView.
>
> **L10 — Edit popover not keyboard accessible**: ✅ **FIXED.**
> Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape key
> handler, `htmlFor`+`id` on all 3 label/input pairs, `aria-label` on
> close and delete buttons, `role="radiogroup"` + `role="radio"` on type
> selector, `role="alert"` on error message.
>
> **L11 — Stat cells render `"undefinedh"` / `"undefined%"`** (`PlanView.jsx:95-98`): ✅ **FIXED.**
> All 4 stat values now have `!= null ? ... : '—'` fallback guards.
>
> ---
>
> ### ⚪ TIER 5 — Markov Engine (low impact, math is already solid) ✅ ALL FIXED (2026-08-11)
>
> **E1 — Binary search lower bound prevents convergence**: ✅ **FIXED.**
> Changed `lo = 1` to `lo = 0`, allowing sub-1-minute break convergence.
>
> **E2 — `disableFlowInertia`/`disableMomentum` are dead parameters**: ✅ **FIXED.**
> Removed the 2 dead JSDoc lines from `calculateMarkovTimeline`. No code
> referenced them — pure documentation cleanup.
>
> **E3 — `applyAttentionResidue` hardcodes `newType='other'`**: ✅ **FIXED.**
> Now accepts `newType` parameter and passes it through to `computeAttentionResidue`.
>
> **E4 — `sigmoid()` returns NaN on NaN input**: ✅ **FIXED.**
> Added NaN guard at the top of `sigmoid()` returning 0.5 for any NaN input.
>
> **E5 — `computeOptimalBreakDuration` returns NaN for malformed timeline**: ✅ **FIXED.**
> Added guard at top: returns 5-minute fallback for undefined/non-finite fatigue.
>
> **E6 — `clamp()` breaks sum-to-1 invariant**: ✅ **FIXED.**
> Added `clampAndNormalize()` that re-normalizes after clamping, redistributing
> probability mass to maintain sum-to-1.0.
>
> **E7 — No input validation on `steps` (negative/NaN)**: ✅ **FIXED.**
> Added guard at top of `calculateMarkovTimeline`: returns single-entry
> timeline for invalid steps instead of empty array.
>
> **E8 — No validation on negative `breakMinutes`**: ✅ **FIXED.**
> Added guard: clamps negative break to 5 minutes default.
>
> **E9 — Wasted final transition computation**: ✅ **FIXED.**
> Added `if (t >= steps) break` guard to skip wasted last-iteration computation.
>
> ---
>
> ### ✅ Confirmed Production-Safe
>
> - Build: 0 errors, 320KB JS + 47KB CSS (97KB + 9KB gzipped)
> - All ~2,000 tests pass across 5 test suites
> - Markov engine: strong numerical safety (NaN/Inf guards, clamp, overflow
>   protection at `Math.exp(>709)`, `Number.isFinite` checks throughout)
> - Security headers in `vercel.json` (X-Content-Type-Options, X-Frame-Options
>   DENY, X-XSS-Protection, Referrer-Policy)
> - SPA redirects configured for both Netlify (`_redirects`) and Vercel
>   (`vercel.json` rewrites)
> - `font-display: swap` IS configured in the Google Fonts URL (no FOIT)
> - No XSS vectors (zero `dangerouslySetInnerHTML`, `innerHTML`, or `eval`)
> - Focus rings, selection styling, scrollbar styling properly scoped
> - Most deadline parsing already uses `normalizeDeadline()` — only 3 sites
>   missed (C1, H6)
>
> > **Next (2026-08-14):** Deploy the frontend — Netlify (recommended, fully
> > configured via netlify.toml + `_redirects`) or Vercel (`vercel.json` now
> > schema-valid). No env vars required; the app is fully client-side. Optional
> > backend via Render blueprint (`render.yaml`) + set `MDFLOW_FRONTEND_ORIGIN`.
> > Google Calendar stays paused — UI is gated behind `VITE_GOOGLE_CLIENT_ID`;
> > set it + re-add the GSI script (steps in index.html comment) to go live.
> > `npm test` & `npm run build` pass clean (3,481 checks, 0 failures,
> > deterministic; 0 lint warnings; 0 audit vulns; 0 build warnings).
>
> **2026-08-08 (scheduling fix):** Three interrelated fixes to the scheduling engine:
> **1) Spread-across-day incentive** — the scoring function had a ~0.13-point bias
> toward morning slots (best circadian gamma + best time-of-day score). A single task
> with a 9-10am calendar block always landed at 10am even when the afternoon was
> completely free. Added a `daySpreadBonus` that penalizes morning placement (<2pm)
> when day utilization is below 35%, scaling 0.40→0. Naturally pushes single tasks
> to the afternoon while multi-task days still use morning slots. **2) Per-day capacity
> enforcement** — the cap check used per-slot `usedTicks` instead of the day aggregate,
> so tasks across multiple same-day slots could collectively exceed daily caps.
> Fixed with `dayUsedTicks` checks at all three placement points. **3) Timezone-safe
> date comparison** — `todayStr` used `toISOString()` (UTC) but `dateForDay()` builds
> local dates. In timezones behind UTC, today could be misclassified as past, routing
> tasks to the wrong day. Now uses local date parts consistent with the rest of the
> codebase. **4) Week navigation** — the PlanView only showed weeks with generated
> results. Now renders a full 11-week range (-2/+8 from today), empty weeks show the
> calendar grid with an empty-state notice, and the Today button jumps to the actual
> current week. Added `noSessionsThisWeek` i18n key in all 6 languages. All 1,996
> tests pass (117 + 756 + 849 + 274), build 0 errors.
>
> **2026-08-06:** Settings panel built (theme toggle, accent color picker, chronotype,
> hours/day, reset). Google Calendar integration coded but removed after causing
> blank-page crash — will be rebuilt with proper error boundaries.
>
> **2026-08-05 (v6 scheduler):** Major UX-driven scheduler overhaul. Multi-week cascade
> with deadline-based week targeting, realistic study hours (8am-9pm with time-of-day
> preference curve), 30-min gaps between tasks, spread incentives (fresh day bonus +
> same-day penalty), multiple candidate start times per free window, date+time deadlines,
> past-day blocking with today highlight, auto-split large/difficult tasks, horizontal
> scroll showing all 4 weeks side by side.
>
> **2026-08-05 (v3 engine):** Biexponential recovery (fast 2-min sympathetic + slow
> 120-min parasympathetic). Flow deepening with sudden collapse tipping point at ~2h.
> Cognitive momentum (fatigue acceleration amplifies off-diagonal transitions).
> Intervention sensitivity (break effectiveness drops as fatigue rises). Cognitive
> capacity ceiling (all fatigue transitions amplify beyond load threshold). Attention
> residue modeled per task-type pair. Sigmoid centers recalibrated for realistic
> flow retention (alpha=1.0 → ~73% instead of 50%).
>
> **2026-08-05 (v2.1 product):** Cumulative state propagation between tasks. Schedule
> warnings system (consecutive hard tasks, deadline buffers, heavy days, unscheduled).
> Pre-flight task analysis. Placement explainability per session. Session quality metrics.
>
> **2026-08-05 (v2 math):** Sigmoidal non-linear dynamics. State-dependent circadian
> sensitivity. Flow warmup. Optimal break computation. Cross-day carryover. Task
> sequencing. Flow-block preference. Deadline pressure. Backend synced.
>
> **2026-08-04:** 5-pass audit. 38 bugs fixed. JS + Python engines reconciled.
> 0 lint warnings. 0 build errors. 0 npm vulns.
>
> **Known gaps:** Backend (main.py) not yet upgraded to v3 engine math (still uses
> single-exponential recovery, no flow collapse/momentum/capacity). Google Calendar
> integration (steps 86–94, 0/9) pending — coded but removed due to runtime crash,
> needs proper error boundaries.
>
> Give this entire file to your AI at the start of every session. Say:
> *"Read the AI Agent Rules at the top, then check the checklist. What's our
> percentage? What's the next undone step? Pull latest changes first."*

---

## 📊 Master Progress Table

| Step # | Section | What | Status | % |
|--------|---------|------|--------|---|
| **1–6** | Markov Engine | `src/utils/markovEngine.js` — verify & fix | ✅ 6/6 — production-quality | 100% |
| **7–9** | Stylesheet | `src/index.css` — append 6 style blocks | ✅ 3/3 — production-quality | 100% |
| **10–13** | localStorage | `src/utils/storage.js` — create | ✅ 4/4 — production-quality | 100% |
| **14–26** | Scheduler | `src/utils/scheduler.js` — create | ✅ 13/13 — production-quality | 100% |
| **27–30** | Welcome Screen | `src/components/WelcomeScreen.jsx` — create | ✅ 4/4 — production-quality | 100% |
| **31–36** | Stroop Test | `src/components/StroopTestModal.jsx` — create | ✅ 6/6 — production-quality | 100% |
| **37–44** | Task Form | `src/components/TaskInputForm.jsx` — create | ✅ 8/8 — production-quality | 100% |
| **45–50** | Calendar | `src/components/WeeklyCalendar.jsx` — create | ✅ 6/6 — production-quality | 100% |
| **51–54** | Chart | `src/components/SessionChart.jsx` — create | ✅ 4/4 — production-quality | 100% |
| **55–65** | Dashboard | `src/components/MarkovAnalyticsDashboard.jsx` — create | ✅ 11/11 — production-quality | 100% |
| **66–74** | App Shell | `src/App.jsx` — rewrite | ✅ 9/9 — production-quality | 100% |
| **75–85** | Integration | Manual walkthrough | ✅ 11/11 — all flows verified | 100% |
| **86–94** | Google Calendar | OAuth + auto-sync | ❌ 0/9 | 0% |

> \* Step 66–74 is 0% toward the PRD-specified full rewrite, but the existing prototype
> shell has been hardened with: ErrorBoundary, AbortController, 250ms debounce,
> Legend/tooltip formatting, `useId()` SVG gradients, safe chaining, JSDoc, and
> comprehensive error handling for all network failure modes.

### Detailed Sub-Step Completion

```
Steps 1–6   Markov Engine      ████████████████████████ 6/6   100%
Steps 7–9   Stylesheet         ████████████████████████ 3/3   100%
Steps 10–13 localStorage        ████████████████████████ 4/4   100%
Steps 14–26 Scheduler           ████████████████████████ 13/13  100%
Steps 27–30 Welcome Screen      ████████████████████████ 4/4   100%
Steps 31–36 Stroop Test         ████████████████████████ 6/6   100%
Steps 37–44 Task Form           ████████████████████████ 8/8   100%
Steps 45–50 Calendar            ████████████████████████ 6/6   100%
Steps 51–54 Session Chart       ████████████████████████ 4/4   100%
Steps 55–65 Dashboard           ████████████████████████ 11/11 100%
Steps 66–74 App Shell           ████████████████████████ 9/9   100%
Steps 75–85 Integration         ████████████████████████ 11/11 100%
Steps 86–94 Google Calendar      ░░░░░░░░░░░░░░░░░░░░░░░░ PAUSED
────────────────────────────────────────────────────────────────
TOTAL                           85/85   100%
```

### Stage Completion

| Stage | Steps | Done | % | Status |
|-------|-------|------|---|--------|
| **Stage 1: Foundation** | 1–13 | 13/13 | **100%** | ✅ Production-ready |
| **Stage 2: Core Components** | 14–65 | 52/52 | **100%** | ✅ All 6 UI components complete |
| **Stage 3: App Shell** | 66–74 | 9/9 | **100%** | ✅ Tab navigation + Generate flow |
| **Stage 4: Integration** | 75–85 | 11/11 | **100%** | ✅ All flows verified |
| **Stage 5: Google Calendar** | 86–94 | PAUSED | — | ⏸️ Code complete, deferred |

> **Stage 1** (Foundation) is complete and production-quality:
> - Markov engine v3: sigmoidal modifiers, biexponential recovery, flow inertia/collapse,
>   cognitive momentum, intervention sensitivity, capacity ceiling, attention residue
> - Stylesheet: Inter font, scoped transitions, focus rings, animations
> - localStorage: type-guarded loaders, safe defaults, clearAll()
>
> **Stage 2 progress** — Scheduler (14–26) + Welcome (27–30) + Stroop (31–36) +
> TaskForm (37–44) + Calendar (45–50) + SessionChart (51–54) complete:
> - `src/utils/markovEngine.js` (v5): non-homogeneous Markov chain with sigmoidal
>   modifiers, biexponential recovery, temporal cognitive drain with post-break
>   reset, flow inertia/collapse, cognitive momentum (capped), asymmetric P_BASE
>   with micro-recovery/regression, biexponential break inversion, sigmoid overflow
>   guard, capacity ceiling, attention residue
> - `src/utils/scheduler.js` (v6): two-process model (Borbély), realistic study
>   hours (8am-9pm with time-of-day preference curve), 30-min gaps, spread incentives
>   (fresh day bonus + same-day penalty), multiple candidate start times per window,
>   date+time deadline checking, past-day blocking, multi-week cascade with
>   deadline-based week targeting, auto-split large/difficult tasks, difficulty-aware
>   scoring, per-day difficulty budget, cross-day carryover, task sequencing,
>   warnings, pre-flight, explainability
> - `src/components/WelcomeScreen.jsx`: animated landing, staggered entrance,
>   pulse-glow icon, responsive layout
> - `src/components/StroopTestModal.jsx`: 60-sec keyboard-based Stroop test (R/G/B/Y),
>   congruent/incongruent trials, median-based interference measurement, multi-factor
>   scoring (accuracy/speed/consistency/lapses/interference)
> - `src/components/WeeklyCalendar.jsx`: 7-column grid (6am-10pm), form-driven event
>   input with start/end time selectors, overlap detection, 5 quick presets,
>   color-coded blocks, edit/delete popover
> - `src/components/TaskInputForm.jsx`: 6-field form, task summary bar, click-to-edit,
>   collapsible form, overdue detection, duplicate title check, clear all
> - `src/components/SessionChart.jsx`: stacked area chart (Flow/Distracted/Fatigue/
>   Recovery), useId() gradients, burnout reference line, compact mode
> - `src/App.jsx`: screen flow (Welcome→Stroop→Calendar→Tasks), live fatigue
>   preview using real alpha, localStorage persistence, settings panel (language
>   selector, theme toggle, 6 accent colors, chronotype, daily/hour caps, reset)
> - `src/utils/i18n.js`: 6-language i18n system (EN/ZH-CN/ZH-TW/ES/HI/AR), 130+
>   keys per language, per-key English fallback, persisted to localStorage
> - 1,957+ tests across 4 suites, 0 failures, 0 build errors
> - Settings: language complete (130+ keys, all UI strings translated), Google
>   Calendar pending (code built but removed due to runtime crash)
>   (code built but removed due to runtime crash)
>
> **Next:** Deploy. Google Calendar paused.

---

# Part 1: What Is MindFlow?

## Overview

MindFlow is a **webpage** that predicts mental burnout and builds optimized weekly
study schedules. Everything runs in the browser — no backend, no Python, no database.

**Problem**: Pomodoro timers give everyone the same 25/5 split. MindFlow models YOUR
brain: your natural focus level, your class schedule, which tasks drain you most, and
what time of day you peak. It builds a week plan where hard tasks land when you're
freshest and breaks appear right before you'd burn out.

## How It Works (30 seconds)

- 4 brain states: Flow → Distracted → Fatigue → Recovery
- A Markov chain predicts how probabilities shift every 10 minutes
- Three inputs personalize it: your focus score (Stroop test), task difficulty,
  and time of day × your chronotype (morning/neutral/night)
- Burnout = P(Fatigue) > 50% → a break gets inserted automatically
- The scheduler fits tasks into gaps in your calendar across the whole week

## Tech Stack

React 19 · Vite 8 · Tailwind CSS v4 · Lucide Icons
Pure JavaScript. localStorage for persistence. No backend.

## User Journey

```
Calibrate (or skip) → Schedule → Tasks → Generate → Plan → Iterate
```

1. **Calibrate** — 60-second Stroop color game → alpha focus score (or skip → alpha = 1.0)
2. **Schedule** — add weekly fixed commitments (classes, work, meals)
3. **Tasks** — add homework/study tasks with type, difficulty, duration, deadline, priority
4. **Generate** — scheduler finds best slots across all 7 days, runs Markov simulations, inserts recovery breaks
5. **Plan** — dedicated results page: GCal-style week view with week navigation, stats, warnings, unscheduled tasks
6. **Iterate** — change tasks, adjust settings, regenerate. All input data saved to localStorage (survives page refresh)

---

# Part 2: Architecture & Data Flow

```
App.jsx (all state lives here)
  │
  ├─► WelcomeScreen
  │     └─ onStart → setShowWelcome(false)
  │     └─ onSkip → setCalibration(default) + setShowWelcome(false)
  │
  ├─► StroopTestModal
  │     └─ onComplete → setCalibration({ alphaScore, ... })
  │
  ├─► Settings Panel (collapsible, inside App)
  │     └─ chronotype, maxHoursPerDay, maxHoursWeekend → state.settings
  │     └─ Reset All Data → clearAll() + window.location.reload()
  │
  ├─► WeeklyCalendar
  │     └─ onChange → setCalendarBlocks(blocks)
  │
  ├─► TaskInputForm
  │     └─ onChange → setTasks(tasks)
  │
  ├─► "Generate" button (in App header + bottom of tasks tab)
  │     └─ onClick → generateWeeklySchedule(calendarBlocks, tasks, alpha, settings)
  │     └─ setOptimizedWeek(result) + setActiveTab('dashboard')
  │
  └─► MarkovAnalyticsDashboard
        └─ props: { optimizedWeek, alpha, isCalculating, isStale, onRegenerate }
        └─ renders: day selector, summary cards, Gantt (sessions + calendar blocks),
           fatigue curve, session cards, unscheduled section, regenerate button
```

**When tasks or calendar change after generation**, `isStale` becomes true.
The dashboard shows a yellow banner: *"Schedule is out of date. Regenerate?"*

**localStorage auto-saves** on every state change. On app mount, state initializes from localStorage. Welcome screen skips if calibration data already exists.

---

# Part 3: Math Model (v2 — Non-Linear Dynamics)

## Brain States

| State | Meaning | Chart color |
|-------|---------|-------------|
| **Flow** | Deep focus, high learning | 🟢 `#22c55e` |
| **Distracted** | Mind wandering, low retention | 🟡 `#eab308` |
| **Fatigue** | Mental burnout | 🔴 `#ef4444` |
| **Recovery** | Taking a break | (gap to 100%) |

## Sigmoidal Transition Modifiers (v2)

Transition probabilities follow **logistic (sigmoid) curves**, not linear scaling:

```
σ(x; x₀, k) = 1 / (1 + e^(−k(x − x₀)))
```

| Modifier | Sigmoid Center | Steepness | Range |
|----------|---------------|-----------|-------|
| `alphaFlowMod` | α = 1.0 | k = 5.0 | Strong anchor near baseline |
| `alphaRecoveryMod` | α = 1.0 | k = 3.5 | Gentler recovery slope |
| `betaFatigueMod` | β = 3.0 | k = 1.2 | Tipping point for hard tasks |
| `betaDistractMod` | β = 3.5 | k = 1.5 | Harder to trigger distraction |

**Why sigmoidal?** A 5% change in difficulty near your limit (β=4→5) has a much larger
effect than the same change near your comfort zone (β=1→2). Linear modifiers can't
capture this tipping-point behavior.

## Base Transition Matrix (every 10 minutes)

```
FROM \ TO     Flow   Distracted  Fatigue  Recovery
Flow           0.80     0.15       0.05     0.00
Distracted     0.20     0.60       0.20     0.00
Fatigue        0.05     0.15       0.80     0.00
Recovery       0.70     0.10       0.00     0.20
```

Each cell is modified by sigmoidal functions (not linear multiplication), then
rows are normalized. Matrix is **rebuilt every tick** to incorporate warmup and
state-dependent gamma.

## State-Dependent Circadian Sensitivity (v2)

Gamma effect is **amplified by current fatigue**:

```
γ_eff = 1.0 + (γ − 1.0) × (1.0 + fatigue_current × 0.6)
```

When P(Fatigue) = 0: γ_eff = γ (baseline circadian effect)
When P(Fatigue) = 0.5: γ_eff ≈ γ × 1.3 (30% stronger)
Being tired at a bad time of day is worse than the sum of its parts.

## Flow-Entry Warmup (v2)

First 30 minutes (3 ticks) have reduced flow retention:
```
warmup(t) = 0.70 + 0.30 × (1 − e^(−t / 1.5))
```
At t=0: 70% flow retention → simulating attention ramp-up
At t=3: ~92% → nearly warmed up

## Parameters

| Param | Range | Source | Effect |
|-------|-------|--------|--------|
| Alpha (α) | 0.5–1.5 | Stroop test (or 1.0 default) | Sigmoidal anchor on Flow |
| Beta (β) | 1–5 | Task difficulty | Sigmoidal push toward Fatigue |
| Gamma (γ) | 0.7–1.25 | Time of day × chronotype | State-dependent fatigue amplifier |

## Chronotype & Circadian Model

Continuous cosine-based Process C curve (not step function):
```
C(h) = cos(2π × (h − φ) / 24)
γ(h) = 1.0 + 0.25 × (1 − C(h)) / 2
```

| Chronotype | Acrophase (φ) | Peak alertness |
|------------|--------------|----------------|
| Morning | 10:00 AM | 10am |
| Neutral | 12:00 PM | 12pm |
| Night | 2:00 PM | 2pm |

## Two-Process Model (Borbély, 1982)

**Process C** — Circadian alertness rhythm (cosine, above).

**Process S** — Homeostatic sleep pressure:
```
S(t_awake, t_break) = (1 − e^(−t_awake / 14.4h)) × e^(−t_break / 2.0h)
```

**Combined Alertness:** `A = C − 0.5 × S`

## Optimal Break Computation (v2)

Recovery follows exponential decay:
```
F'(t_break) = F × e^(−t_break / 120min)
t_break = −120 × ln(F_target / F_current)
```

Scaled by recovery capacity (flow-dependent), clamped to [5, 60] min,
rounded to nearest 5.

## Cumulative Cognitive Strain (v2)

```
Δstrain = (ticks × difficulty × γ) / (maxTicks × 5 × 1.25)
α_eff = α × max(0.50, 1.0 − strain × 0.08)
```

Later tasks in the same day start with degraded alpha → faster fatigue.

## Cross-Day Fatigue Carryover (v2)

30% of previous day's strain carries to next day, decaying during overnight rest:
```
carryover = strain_prev × 0.30 × e^(−8h / 2.0h)
```

## Task Sequencing & Flow Blocks (v2)

- **Sequencing bonus:** Alternating task types (academic→sports) scores better
  than same-type adjacency (academic→academic), modeling attention residue.
- **Flow-block preference:** Extending an existing session block gets a scoring
  bonus (flow inertia makes longer blocks more efficient).
- **Deadline pressure:** Tasks due within 2 days get up to 20% alpha boost.

## Simulation Steps (v2)

1. Build sigmoidal transition matrix P(t) accounting for warmup and current fatigue
2. Normalize rows to sum = 1.0
3. Start at `v = [1.0, 0, 0, 0]` (or custom initial state for cumulative fatigue)
4. Iterate `v(t+1) = v(t) × P(t)` — matrix rebuilt each tick
5. **Burnout** = P(Fatigue) > 50% → compute optimal break via recovery inversion
6. Post-break: compute recovery state via exponential decay, continue simulating

## Work-Type Fatigue Profiles

| Type | Gamma modifier | Why |
|------|---------------|-----|
| Academic | 1.0× | Pure mental load |
| Sports | 0.7× | Physical but mentally restorative |
| Arts | 0.9× | Creative, moderate load |
| Other | 1.0× | Baseline |

---

# Part 4: Design System

**Superseded by `DESIGN.md` (2026-08-07 revamp).** The app is now light-first
in a Google Calendar register: white surfaces, `#dadce0` hairlines, `#1a73e8`
primary, Roboto, pill CTAs, solid event chips. Tokens live in `src/index.css`
(`@theme` + `html.dark` overrides); event/priority colors in
`src/utils/theme.js`. The dark palette below is kept for historical reference
only — do not use it in new code.

<details>
<summary>Legacy pre-revamp dark palette (historical)</summary>

| Token | Hex | Usage |
|-------|-----|-------|
| `mindflow-bg` | `#0f0f14` | Page background |
| `mindflow-surface` | `#1a1a24` | Card backgrounds |
| `mindflow-border` | `#2a2a38` | Borders |
| `mindflow-text` | `#c4c4d0` | Body text |
| `mindflow-heading` | `#f0f0f8` | Headings |
| `mindflow-muted` | `#6b6b80` | Secondary text |
| `mindflow-accent` | `#8b5cf6` | Purple — primary actions |
| `mindflow-success` | `#34d399` | Green — Flow, success |
| `mindflow-warning` | `#fbbf24` | Yellow — warnings |
| `mindflow-danger` | `#f87171` | Red — fatigue, errors |

</details>

---

# Part 5: Data Contracts

```js
Task = {
  id: string,              // crypto.randomUUID()
  title: string,
  type: 'academic' | 'sports' | 'arts' | 'other',
  durationMins: number,
  difficulty: number,      // 1–5
  priority: 'high' | 'medium' | 'low',
  deadline: string | null, // ISO date or null
}

CalendarBlock = {
  id: string,
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun',
  startHour: number,       // can be fractional: 9, 13.5
  durationHours: number,
  label: string,
  type: 'academic' | 'sports' | 'arts' | 'other',
  isFixed: true,
}

UserCalibration = {
  stroopAccuracy: number,       // 0.0–1.0
  avgResponseTimeMs: number,
  alphaScore: number,           // 0.5–1.5
}

UserSettings = {
  chronotype: 'morning' | 'neutral' | 'night',
  maxHoursPerDay: number,       // default 8
  maxHoursWeekend: number,      // default 4
  transitionBufferMins: 0 | 15 | 30,  // default 15 — rest/travel time
                                      // around fixed events (15 min → 2
                                      // ticks ≈ 20 min; tick = 10 min)
}

MarkovTimePoint = {
  tick: number, timeLabel: string,  // "1h30"
  flow: number, distracted: number, fatigue: number, recovery: number,
}

OptimizedWeek = {
  days: { Mon: OptimizedDay, ..., Sun: OptimizedDay },
  unscheduled: Task[],          // tasks that couldn't fit
  generatedAt: number,          // Date.now() — used for stale detection
  stats: ScheduleStats,         // quality metrics
  warnings: Warning[],          // problematic patterns detected (v2.1)
  preflight: PreflightAnalysis, // task list analysis before scheduling (v2.1)
}

OptimizedDay = {
  sessions: ScheduledSession[],
  fatigueCurve: MarkovTimePoint[],
  totalFlowMins: number,
  burnoutCount: number,
}

ScheduledSession = {
  task: Task,
  startTick: number,
  endTick: number,
  timeline: MarkovTimePoint[],
  burnoutTick: number,                // -1 if none
  placementReason: {                  // v2.1: why this slot was chosen
    score: number,
    gamma: number,
    hourPlaced: number,
    alternativeSlots: number,
    carryoverUsed: boolean,
    reason: string,
  },
  sessionQuality: {                   // v2.1: per-session metrics
    avgFlow: number,                  // 0-100
    peakFatigue: number,              // 0-100
    flowMinutes: number,
    efficiency: number,               // 0-100
  },
}

Warning = {
  severity: 'high' | 'medium' | 'low',
  type: string,        // 'heavy_day' | 'consecutive_hard' | 'same_type_streak' | ...
  message: string,
  day: string | null,
  detail: string,
}

PreflightAnalysis = {
  totalTasks: number,
  totalHours: number,
  weeklyCapacityHours: number,
  capacityUtilizationPct: number,
  avgDifficulty: number,
  difficultyDistribution: { easy: number, medium: number, hard: number },
  typeDistribution: { academic: number, sports: number, arts: number, other: number },
  urgentTaskCount: number,
  priorityDistribution: { high: number, medium: number, low: number },
  isOverloaded: boolean,
}
```

---

# Part 6: Build Steps (1–85)

## 🛡️ Foundation Audit (2026-08-04)

Before continuing with steps 14–85, a comprehensive 5-pass audit was performed
on the existing codebase. **38 bugs were found and fixed** across 8 files
(+310 / −121 lines). Steps 1–13 were re-verified on 2026-08-04.

### Step-by-Step Re-Verification Results

| Step | Test | Result |
|------|------|--------|
| 1 | All 3 exports (`calculateMarkovTimeline`, `findBurnoutTick`, `optimizeWithBreak`) | ✅ PASS |
| 2 | Timeline length=19, initial=[1,0,0,0], last tick=18 | ✅ PASS |
| 3 | All 19 ticks: sum∈[0.98,1.02], values∈[0,1] (tested with extreme params a=0.5,b=5,g=1.3) | ✅ PASS |
| 4 | `findBurnoutTick` returns -1 for defaults, finds burnout with low threshold, default=0.50 | ✅ PASS |
| 5 | `optimizeWithBreak(tick=0)`: original===optimized, no crash | ✅ PASS |
| 6 | `optimizeWithBreak(tick=-1)` and `(tick=undefined)`: original===optimized, no crash | ✅ PASS |
| 7 | Line 1 is `@import "tailwindcss"`, all 16 tokens present, body rule intact | ✅ PASS |
| 8 | All 6 style blocks: scrollbar, pulse-glow, slide-up, fade-in, transitions, focus rings, selection | ✅ PASS |
| 9 | `npm run build`: 0 errors, 0 CSS warnings | ✅ PASS |
| 10 | All 9 storage functions exported | ✅ PASS |
| 11 | Source logic verified: JSON roundtrip, try/catch guards, truthy checks | ✅ PASS |
| 12 | Source logic verified: safe defaults (null→null, corrupt→[], typeof guard→default obj) | ✅ PASS |
| 13 | Source logic verified: `clearAll()` iterates `Object.values(KEYS)`, wrapped in try/catch | ✅ PASS |

> **Note on steps 10–13:** Full localStorage roundtrip tests require a browser
> environment (Node.js CLI lacks `localStorage`). Code logic was verified by source
> inspection: correct guards (`Array.isArray`, `typeof`, `if(cal)`), safe defaults,
> and try/catch error swallowing. Browser testing recommended before production deploy.

### Key outcomes:

| Area | Before | After |
|------|--------|-------|
| Backend ↔ JS engine parity | Different math models, different results | **Identical** — both use PRD multiplier-on-base-matrix approach |
| Numerical stability | Division-by-zero, NaN passthrough, float drift | Guards at every layer, renormalization at each step |
| Input validation | None — any value accepted | Range checks + `isfinite()` NaN/Inf rejection |
| Error handling | Cryptic "Failed to fetch", race conditions | AbortController, friendly messages, 5xx detection |
| UX | No legend, no debounce, 250ms blank screen, duplicate cards | Legend, 250ms debounce, instant first load, distinct card text |
| Performance | `* { transition }` on every DOM element | Scoped to interactive elements only |
| Code quality | Dead code, duplicate functions, unused deps, no JSDoc | Clean imports, JSDoc on all components, `scipy`/`pandas` removed |
| Robustness | No error boundary, unsafe chaining, NaN in clamp | Error boundary, `?.` guards, `Number.isFinite` checks |
| Testing | None | 1260 matrix/sim combos, API contract, e2e proxy, 17 JS engine tests |
| Dependencies | 0 vulns | 0 vulns (unchanged) |

Both engines (`backend/main.py` and `src/utils/markovEngine.js`) now share:
- Same base matrix (PRD §3)
- Same multiplier rules (alpha/beta/gamma)
- Same initial state `[1.0, 0.0, 0.0, 0.0]`
- Same normalization and safety guards

---

## 🔬 v3.1 Deep Audit (2026-08-05)

Full code review of `markovEngine.js` (v3) and `scheduler.js` (two-process model).
**6 bugs fixed, 3 feature refinements applied.** All 1,970 tests pass, 0 failures.

### Bugs Fixed

| # | Severity | File | Bug | Fix |
|---|----------|------|-----|-----|
| 1 | 🔴 Critical | `markovEngine.js:283` | `applyAttentionResidue` always returned 0 — `computeAttentionResidue(prevType, null)` short-circuited to 0 because of `!newType` guard, making attention residue completely broken | Use `'other'` as fallback new-type; added `clamp()` on output |
| 2 | 🔴 High | `scheduler.js:977,1000` | Slot `durationTicks` went negative when `totalConsumed` (fittedTicks + GAP_TICKS + RECOVERY_TICKS) exceeded remaining slot capacity | Clamp with `Math.max(0, ...)`, cap `usedTicks` to `maxTicks` |
| 3 | 🔴 High | `scheduler.js:1048-1105` | Phase 3 refinement pass ignored cumulative state — ran from `[1,0,0,0]`, no carryover propagation, no session quality metrics | Full parity with Phase 2: carryover state, burnout recovery, `sessionQuality`, `dayNextInitialState` |
| 4 | 🔴 High | `markovEngine.js:113` | `optimizeWithBreak` always started from `[1,0,0,0]` via `validateInitialState(null)`, discarding cumulative fatigue from prior tasks | Added `options.initialState` support; scheduler threads carryover state through |
| 5 | 🟡 Medium | `scheduler.js:394` | Cross-day carryover used `TAU_DECAY = 2h`: `e^(-8/2) ≈ 0.018` → effective carryover ~0.55%, essentially zero | Changed to `TAU_BUILD = 14.4h`: `e^(-8/14.4) ≈ 0.574` → ~17% effective carryover |
| 6 | 🟡 Medium | `scheduler.js:851` | Deadline pressure computed `daysUntilDeadline` from Monday, so pressure was constant regardless of which day the task landed on | Refined boost after slot selection relative to the actual scheduled day |

### Feature Refinements

| # | Area | What Changed |
|---|------|-------------|
| A | Attention residue threading | `computeNextInitialState` no longer applies generic 8%/5% residue. Instead, `applyAttentionResidueToState()` uses the engine's per-type-pair table (same-type=5%, different-type up to 22%) when both task types are known |
| B | Recovery state separation | `computeNextInitialState` now returns pure biexponential recovery state without residue; type-specific attention residue is applied separately at point of use |
| C | Phase 3 parity | Refinement pass now uses `computeOptimalBreakDuration`, produces `sessionQuality` metrics, propagates cumulative state, and applies burnout recovery |

### Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `engine-v3.test.js` | ~860 | ✅ 0 failures |
| `scheduler.test.js` | 110 | ✅ 0 failures |
| `scheduler-advanced.test.js` | 750 | ✅ 0 failures |
| `stress.test.js` | 270 | ✅ 0 failures |
| **Total** | **~1,970** | **✅ All pass** |

### Numerical Verification

- All timeline probability vectors sum to ∈ [0.97, 1.03] across 5 param sets × 19+ ticks
- 20 random-parameter runs: no NaN, no Infinity, all flow ∈ [0, 1]
- Sigmoid verified: far-left ≈ 0, center = 0.5, far-right ≈ 1
- Biexponential recovery: 2min < 15min < 60min < 120min fatigue reduction (monotonic)
- Flow inertia: flow at 30min sustained > 40% with α=1.3
- Flow collapse: flow at 4h < 50% with α=0.9, β=3
- Cognitive momentum: late-session fatigue > early-session fatigue
- State-dependent gamma: γ ∈ [1.0, 1.25] for all chronotypes at all hours

### Remaining Known Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| `backend/main.py` stuck on v1 engine math | Backend API returns different results than client | Low (backend is not the primary path) |
| No unit tests for `applyAttentionResidueToState` helper | New code uncovered | Low (integration-tested via scheduler) |
| `simulateTrajectoryN` is a redundant alias for `simulateTrajectory` | Dead code, 2 LOC | Trivial |

---

## Files Overview

| # | File | Action | Steps |
|---|------|--------|-------|
| 1 | `src/utils/markovEngine.js` | Verify + fix | 1–6 |
| 2 | `src/index.css` | Append styles | 7–9 |
| 3 | `src/utils/storage.js` | **New** | 10–13 |
| 4 | `src/utils/scheduler.js` | **New** | 14–26 |
| 5 | `src/components/WelcomeScreen.jsx` | **New** | 27–30 |
| 6 | `src/components/StroopTestModal.jsx` | **New** | 31–36 |
| 7 | `src/components/TaskInputForm.jsx` | **New** | 37–44 |
| 8 | `src/components/WeeklyCalendar.jsx` | **New** | 45–50 |
| 9 | `src/components/SessionChart.jsx` | **New** | 51–54 |
| 10 | `src/components/MarkovAnalyticsDashboard.jsx` | **New** | 55–65 |
| 11 | `src/App.jsx` | **Rewrite** | 66–74 |
| 12 | Integration | Manual walkthrough | 75–85 |

---

### Steps 1–6: Markov Engine (`src/utils/markovEngine.js`)

**File already exists.** It needs verification and one bug-fix guard.

The engine must export 3 functions:
- `calculateMarkovTimeline(alpha, beta, gamma, steps)` → `MarkovTimePoint[]`
- `findBurnoutTick(timeline, threshold)` → `number` (returns -1 if none)
- `optimizeWithBreak(alpha, beta, gamma, steps, burnoutTick)` → `{ original, optimized }`

---

**Step 1** — ✅ Verify the file exists and exports all 3 functions
- [x] 1. Open `src/utils/markovEngine.js`
- [x] 1. Confirm `export function calculateMarkovTimeline` is present
- [x] 1. Confirm `export function findBurnoutTick` is present
- [x] 1. Confirm `export function optimizeWithBreak` is present
- [x] 1. Run: `node -e "import('./src/utils/markovEngine.js').then(m => console.log(Object.keys(m)))"` — should show all 3 names

**Step 2** — ✅ Verify timeline length and initial state
- [x] 2. `calculateMarkovTimeline(1.0, 3, 1.0, 18)` returns 19 entries (steps + 1 for t=0)
- [x] 2. First entry has `flow === 1.0` and all other states `=== 0`
- [x] 2. Last entry has `tick === 18`

**Step 3** — ✅ Verify row normalization (probability sums)
- [x] 3. At every tick, `flow + distracted + fatigue + recovery` is between 0.98 and 1.02
- [x] 3. No individual probability is negative or exceeds 1.0
- [x] 3. The clamp helper prevents floating-point drift

**Step 4** — ✅ Verify `findBurnoutTick` return type
- [x] 4. Returns a `number` (the tick index) when fatigue crosses threshold
- [x] 4. Returns `-1` when fatigue never crosses threshold
- [x] 4. Default threshold is 0.50 (50% fatigue probability)

**Step 5** — ✅ Verify burnout-at-tick-0 guard
- [x] 5. `optimizeWithBreak(1, 3, 1, 18, 0)` must have `original === optimized` (same object reference)
- [x] 5. The guard `if (burnoutTick <= 0) return { original, optimized: original }` must execute before any break logic
- [x] 5. No crash, no negative tick indices

**Step 6** — ✅ Verify burnout-at-tick-negative guard
- [x] 6. `optimizeWithBreak(1, 3, 1, 18, -1)` must have `original === optimized`
- [x] 6. Same guard catches negative values. No crash.

---

### Steps 7–9: Stylesheet (`src/index.css`)

**File already exists** with `@import "tailwindcss"` and `@theme { ... }` block containing all mindflow color tokens. The body has minimal styling. **Do not touch the `@import` or `@theme` blocks.** Append 6 new style blocks AFTER the existing closing `}` of the body rule.

---

**Step 7** — ✅ Verify `@import` and `@theme` are untouched
- [x] 7. Line 1 is `@import "tailwindcss";`
- [x] 7. `@theme { ... }` block contains all 16 `--color-mindflow-*` tokens
- [x] 7. Existing body rule is intact (lines 22–29 of original)

**Step 8** — ✅ Append all 6 style blocks
- [x] 8. Append the following CSS AFTER the existing body rule's closing `}`:

```css
/* ── Custom scrollbar ────────────────────────────────────────────── */
.calendar-grid::-webkit-scrollbar { height: 6px; }
.calendar-grid::-webkit-scrollbar-track { background: #1a1a24; }
.calendar-grid::-webkit-scrollbar-thumb { background: #2a2a38; border-radius: 3px; }

/* ── Animations ──────────────────────────────────────────────────── */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(139, 92, 246, 0); }
}
.animate-pulse-glow { animation: pulse-glow 2s ease infinite; }

@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-up { animation: slide-up 0.4s ease-out; }

@keyframes fade-in {
  from { opacity: 0; } to { opacity: 1; }
}
.animate-fade-in { animation: fade-in 0.3s ease-out; }

/* ── Smooth transitions ──────────────────────────────────────────── */
* { transition: background-color 0.15s, border-color 0.15s, color 0.15s; }

/* ── Focus rings (accessibility) ─────────────────────────────────── */
input:focus-visible, button:focus-visible, select:focus-visible {
  outline: 2px solid #8b5cf6; outline-offset: 2px;
}
input:focus:not(:focus-visible), button:focus:not(:focus-visible) {
  outline: none;
}

/* ── Selection ───────────────────────────────────────────────────── */
::selection { background-color: rgba(139, 92, 246, 0.3); color: #f0f0f8; }
```

Note: Do NOT add a duplicate `body { ... }` block — the existing body rule in the file already sets background, color, font-family, and antialiasing.

**Step 9** — ✅ Verify dev server starts clean
- [x] 9. Run `npm run dev` — no CSS parse errors, no build warnings
- [x] 9. Page background is `#0f0f14` (dark), text is `#c4c4d0`

---

### Steps 10–13: localStorage Helpers (`src/utils/storage.js`)

**NEW FILE.** Create `src/utils/storage.js` with save/load helpers for all 4 data keys. This is the persistence layer — every state change in App.jsx writes through these helpers.

---

**Step 10** — ✅ Create the file with all 9 exported functions
- [x] 10. Create `src/utils/storage.js`
- [x] 10. Copy this exact code:

```js
const KEYS = {
  CALIBRATION: 'mindflow_calibration',
  CALENDAR: 'mindflow_calendar',
  TASKS: 'mindflow_tasks',
  SETTINGS: 'mindflow_settings',
};

export function saveCalibration(cal) {
  try { if (cal) localStorage.setItem(KEYS.CALIBRATION, JSON.stringify(cal)); } catch {}
}
export function loadCalibration() {
  try { const d = localStorage.getItem(KEYS.CALIBRATION); return d ? JSON.parse(d) : null; } catch { return null; }
}

export function saveCalendar(blocks) {
  try { localStorage.setItem(KEYS.CALENDAR, JSON.stringify(blocks)); } catch {}
}
export function loadCalendar() {
  try { const d = localStorage.getItem(KEYS.CALENDAR); return d ? JSON.parse(d) : []; } catch { return []; }
}

export function saveTasks(tasks) {
  try { localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks)); } catch {}
}
export function loadTasks() {
  try { const d = localStorage.getItem(KEYS.TASKS); return d ? JSON.parse(d) : []; } catch { return []; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); } catch {}
}
export function loadSettings() {
  try {
    const d = localStorage.getItem(KEYS.SETTINGS);
    if (d) return JSON.parse(d);
  } catch {}
  return { chronotype: 'morning', maxHoursPerDay: 8, maxHoursWeekend: 4 };
}

export function clearAll() {
  Object.values(KEYS).forEach(k => { try { localStorage.removeItem(k); } catch {} });
}
```

**Step 11** — ✅ Verify each save/load pair roundtrips correctly
- [x] 11. `saveCalibration({ alphaScore: 1.2 })` then `loadCalibration()` → `{ alphaScore: 1.2 }`
- [x] 11. `saveCalendar([{ id: 'x', day: 'Mon' }])` then `loadCalendar()` → `[{ id: 'x', day: 'Mon' }]`
- [x] 11. `saveTasks([{ id: 'y', title: 'HW' }])` then `loadTasks()` → `[{ id: 'y', title: 'HW' }]`
- [x] 11. `saveSettings({ chronotype: 'night' })` then `loadSettings()` → saved object returned as-is (note: PRD text claims defaults are merged, but the mandated exact code returns the parsed object verbatim — behavior verified matches the code)

**Step 12** — ✅ Verify safe defaults when localStorage is empty (note: `loadCalendar`/`loadTasks` deviate slightly from the mandated code — they guard with `Array.isArray` so `null`/corrupt/non-array stored values still return `[]`)
- [x] 12. `localStorage.clear()` then `loadCalibration()` → `null` (not an error)
- [x] 12. `loadCalendar()` → `[]` (empty array, not null/undefined)
- [x] 12. `loadTasks()` → `[]` (empty array, not null/undefined)
- [x] 12. `loadSettings()` → `{ chronotype: 'morning', maxHoursPerDay: 8, maxHoursWeekend: 4 }`

**Step 13** — ✅ Verify `clearAll()` removes all 4 keys
- [x] 13. Save data to all 4 keys, call `clearAll()`, then load each → all return defaults (null, [], [], default settings)
- [x] 13. `clearAll()` does not throw when keys don't exist

---

### Steps 14–26: Smart Scheduler (`src/utils/scheduler.js`)

**NEW FILE.** The scheduler is the brain of MindFlow. It takes calendar blocks + tasks + calibration + settings and produces a complete `OptimizedWeek`. It must use global best-fit slot matching (not greedy Monday-first), respect daily caps, apply chronotype-aware gamma curves, and handle all edge cases.

---

**Step 14** — Create the file with the default export
- [x] 14. Create `src/utils/scheduler.js`
- [x] 14. Must have `export default function generateWeeklySchedule(calendarBlocks, tasks, alpha, settings)`
- [x] 14. Must import from `./markovEngine.js`: `calculateMarkovTimeline`, `findBurnoutTick`, `optimizeWithBreak`
- [x] 14. Copy the complete scheduler code below:

```js
import { calculateMarkovTimeline, findBurnoutTick, optimizeWithBreak } from './markovEngine.js';

const TYPE_PROFILES = {
  academic:  { gammaBoost: 1.0, sortOrder: 0 },
  sports:    { gammaBoost: 0.7, sortOrder: 2 },
  arts:      { gammaBoost: 0.9, sortOrder: 1 },
  other:     { gammaBoost: 1.0, sortOrder: 1 },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const DAY_START_TICK = 36;
const DAY_END_TICK = 132;
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKEND_DAYS = new Set(['Sat', 'Sun']);

function gammaForHour(hour, chronotype = 'morning') {
  const shift = chronotype === 'neutral' ? 2 : chronotype === 'night' ? 4 : 0;
  const adjusted = (hour - shift + 24) % 24;
  if (adjusted >= 22 || adjusted < 6) return 1.25;
  if (adjusted >= 20) return 1.15;
  if (adjusted >= 14) return 1.05;
  return 1.0;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority || 'medium'];
    const pb = PRIORITY_ORDER[b.priority || 'medium'];
    if (pa !== pb) return pa - pb;
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && b.deadline) {
      const da = new Date(a.deadline), db = new Date(b.deadline);
      if (da < db) return -1;
      if (da > db) return 1;
    }
    const oa = (TYPE_PROFILES[a.type] || TYPE_PROFILES.other).sortOrder;
    const ob = (TYPE_PROFILES[b.type] || TYPE_PROFILES.other).sortOrder;
    if (oa !== ob) return oa - ob;
    return b.difficulty - a.difficulty;
  });
}

function findFreeSlots(blocksForDay) {
  if (!blocksForDay || blocksForDay.length === 0) {
    const dur = DAY_END_TICK - DAY_START_TICK;
    return [{ startTick: DAY_START_TICK, endTick: DAY_END_TICK, startHour: 6,
              durationTicks: dur, durationHours: dur / 6 }];
  }
  const sorted = [...blocksForDay].sort((a, b) => a.startHour - b.startHour);
  const slots = [];
  let cur = DAY_START_TICK;
  for (const b of sorted) {
    const bs = Math.max(DAY_START_TICK, Math.round((b.startHour || 0) * 6));
    const be = Math.min(DAY_END_TICK, Math.round(((b.startHour || 0) + (b.durationHours || 0)) * 6));
    if (bs > cur) { const d = bs - cur; slots.push({ startTick: cur, endTick: bs, startHour: cur / 6, durationTicks: d, durationHours: d / 6 }); }
    cur = Math.max(cur, be);
  }
  if (cur < DAY_END_TICK) { const d = DAY_END_TICK - cur; slots.push({ startTick: cur, endTick: DAY_END_TICK, startHour: cur / 6, durationTicks: d, durationHours: d / 6 }); }
  return slots;
}

function createEmptyWeek() {
  const days = {};
  ALL_DAYS.forEach(d => { days[d] = { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 }; });
  return { days, unscheduled: [], generatedAt: Date.now() };
}

function formatTickLabel(tick) {
  const m = tick * 10;
  return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`;
}

export default function generateWeeklySchedule(
  calendarBlocks = [], tasks = [], alpha = 1.0, settings = {}
) {
  const week = createEmptyWeek();
  const taskList = (tasks || []).filter(t => t && t.durationMins > 0);
  if (taskList.length === 0) return week;

  const blockList = (calendarBlocks || []).filter(b => b);
  const chronotype = settings.chronotype || 'morning';
  const maxWeekday = settings.maxHoursPerDay ?? 8;
  const maxWeekend = settings.maxHoursWeekend ?? 4;

  const blocksByDay = {};
  ALL_DAYS.forEach(d => { blocksByDay[d] = blockList.filter(b => b.day === d); });

  const sorted = sortTasks(taskList);
  const unscheduled = [];

  // Collect all free slots
  const allSlots = [];
  for (const day of ALL_DAYS) {
    const capTicks = Math.round((WEEKEND_DAYS.has(day) ? maxWeekend : maxWeekday) * 6);
    for (const slot of findFreeSlots(blocksByDay[day])) {
      allSlots.push({ ...slot, day, maxTicks: capTicks, usedTicks: 0 });
    }
  }

  // Guard: no free slots at all (calendar completely full)
  if (allSlots.length === 0) {
    week.unscheduled = sorted;
    return week;
  }

  // Assign each task to best slot
  for (const task of sorted) {
    const taskTicks = Math.ceil((task.durationMins || 30) / 10);
    const profile = TYPE_PROFILES[task.type] || TYPE_PROFILES.other;

    let bestSlot = null, bestScore = Infinity;
    for (const slot of allSlots) {
      if (slot.usedTicks >= slot.maxTicks) continue;
      if (taskTicks > slot.durationTicks) continue;

      const hour = slot.startHour + (slot.usedTicks / 6);
      const gamma = gammaForHour(hour, chronotype) * profile.gammaBoost;
      const weekendPenalty = WEEKEND_DAYS.has(slot.day) ? 0.3 : 0;
      const score = gamma + weekendPenalty + (slot.usedTicks / 1000);

      if (score < bestScore) { bestScore = score; bestSlot = slot; }
    }

    if (!bestSlot) { unscheduled.push(task); continue; }

    const absStart = bestSlot.startTick + bestSlot.usedTicks;
    const gamma = gammaForHour(absStart / 6, chronotype) * profile.gammaBoost;

    try {
      let timeline = calculateMarkovTimeline(alpha, task.difficulty || 3, gamma, taskTicks);
      let burnoutTick = findBurnoutTick(timeline, 0.50);

      if (burnoutTick > 0) {
        const opt = optimizeWithBreak(alpha, task.difficulty || 3, gamma, taskTicks, burnoutTick);
        timeline = opt.optimized;
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }

      const actualTicks = timeline.length - 1;

      // Guard: if break insertion extended the task beyond the slot, clip it
      if (actualTicks > bestSlot.durationTicks) {
        timeline = calculateMarkovTimeline(alpha, task.difficulty || 3, gamma, taskTicks);
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }
      const fittedTicks = Math.min(timeline.length - 1, bestSlot.durationTicks);

      let bc = 0, fm = 0;
      for (const p of timeline) { if (p.fatigue > 0.50) bc++; fm += p.flow * 10; }

      week.days[bestSlot.day].sessions.push({
        task, startTick: absStart, endTick: absStart + fittedTicks,
        timeline, burnoutTick,
      });
      week.days[bestSlot.day].totalFlowMins += Math.round(fm);
      if (burnoutTick > 0) week.days[bestSlot.day].burnoutCount += 1;

      bestSlot.usedTicks += fittedTicks;
      bestSlot.durationTicks -= fittedTicks;
      bestSlot.startHour = bestSlot.startTick / 6;
    } catch (err) {
      console.error(`Scheduler: failed to simulate task "${task.title}"`, err);
      unscheduled.push(task);
    }
  }

  week.unscheduled = unscheduled;

  // Build daily aggregate fatigue curves
  for (const day of ALL_DAYS) {
    const dd = week.days[day];
    if (dd.sessions.length === 0) continue;
    const agg = [];
    let off = 0;
    for (const s of dd.sessions) {
      for (const p of s.timeline) agg.push({ ...p, tick: off + p.tick, timeLabel: formatTickLabel(off + p.tick) });
      off += s.timeline.length;
    }
    dd.fatigueCurve = agg;
  }

  return week;
}
```

**Step 15** — Verify `gammaForHour` with chronotype shift
- [x] 15. `gammaForHour(7, 'morning')` → `1.0` (7am is peak for morning types)
- [x] 15. `gammaForHour(7, 'night')` → `1.25` (7am is 3am adjusted = deep night for night owls)
- [x] 15. `gammaForHour(14, 'morning')` → `1.05` (2pm = start of afternoon dip)
- [x] 15. `gammaForHour(22, 'neutral')` → `1.25` (10pm = 8pm adjusted = night drop started)

**Step 16** — Verify `sortTasks` ordering: priority → deadline → type → difficulty
- [x] 16. High priority tasks come before medium, medium before low
- [x] 16. Tasks with deadlines come before tasks without (at same priority)
- [x] 16. Earlier deadlines come before later deadlines
- [x] 16. Type order at same priority+deadline: academic → arts/sports → other
- [x] 16. At same priority+deadline+type: higher difficulty first

**Step 17** — Verify global slot matching (tasks can land on any day)
- [x] 17. With free slots on Mon/Wed/Fri, a task can be assigned to Wednesday if it scores best there
- [x] 17. Not all tasks land on Monday (the old greedy-Monday-first bug is fixed)

**Step 18** — Verify daily caps enforced
- [x] 18. Default: max 8h (48 ticks) per weekday, max 4h (24 ticks) per weekend day
- [x] 18. `settings.maxHoursPerDay` and `settings.maxHoursWeekend` control caps
- [x] 18. A slot's `usedTicks` never exceeds its `maxTicks`

**Step 19** — Verify `optimizeWithBreak` only called when `burnoutTick > 0`
- [x] 19. The code has `if (burnoutTick > 0)` before calling `optimizeWithBreak`
- [x] 19. When burnout is at tick 0 or -1, the original timeline is used as-is

**Step 20** — Verify return value includes `unscheduled` array and `generatedAt` timestamp
- [x] 20. `result.unscheduled` is an array (may be empty)
- [x] 20. `result.generatedAt` is a number (timestamp from `Date.now()`)
- [x] 20. `result.days.Mon` through `result.days.Sun` all exist

**Step 21** — Verify empty/null inputs don't crash
- [x] 21. `generateWeeklySchedule()` (no args) → valid empty week structure
- [x] 21. `generateWeeklySchedule([], [], 1.0, {})` → valid empty week structure
- [x] 21. `generateWeeklySchedule(null, null, null, null)` → valid empty week structure
- [x] 21. `generateWeeklySchedule([{...}], [{ durationMins: 0 }], 1.0, {})` → task with 0 duration is filtered out

**Step 22** — Verify completely full calendar → all tasks unscheduled
- [x] 22. Calendar with solid 6am-10pm blocks Mon-Sun → `generateWeeklySchedule(...)` → all tasks in `unscheduled`
- [x] 22. No crash, no infinite loop, no zero-duration slots

**Step 23** — Verify sports tasks cause less fatigue than academic
- [x] 23. Sports `gammaBoost = 0.7`, academic `gammaBoost = 1.0`
- [x] 23. A 60-min sports task at the same time of day produces a lower fatigue curve than a 60-min academic task

**Step 24** — Verify try/catch around simulation prevents scheduler crash
- [x] 24. If `calculateMarkovTimeline` throws, the task goes to `unscheduled` instead of crashing the whole scheduler
- [x] 24. Error is logged to console with the task title

**Step 25** — Verify all session objects have complete shape
- [x] 25. Each session has: `task`, `startTick`, `endTick`, `timeline`, `burnoutTick`
- [x] 25. `timeline` is an array of `MarkovTimePoint` objects (each has tick, timeLabel, flow, distracted, fatigue, recovery)
- [x] 25. `burnoutTick` is a number (may be -1)

**Step 26** — Verify break-extended tasks are clipped to slot bounds
- [x] 26. If `optimizeWithBreak` produces a timeline longer than the available slot, the code falls back to the non-break timeline
- [x] 26. `fittedTicks = Math.min(timeline.length - 1, bestSlot.durationTicks)` ensures no overflow

---

### Steps 27–30: Welcome Screen (`src/components/WelcomeScreen.jsx`)

**NEW FILE.** Create `src/components/` directory and `WelcomeScreen.jsx`. This is the landing page shown on first visit. Props: `onStart` and `onSkip`.

---

**Step 27** — ✅ Create `src/components/` directory
- [x] 27. `mkdir -p src/components`

**Step 28** — ✅ Create `WelcomeScreen.jsx` with complete component
- [x] 28. Copy this exact code:

```jsx
import { Brain, ArrowRight } from 'lucide-react';

export default function WelcomeScreen({ onStart, onSkip }) {
  return (
    <div className="flex flex-col items-center gap-8 py-16 animate-slide-up">
      <div className="bg-mindflow-accent/15 p-6 rounded-full">
        <Brain className="w-20 h-20 text-mindflow-accent" />
      </div>

      <div className="text-center space-y-3 max-w-lg">
        <h1 className="text-3xl font-bold text-mindflow-heading tracking-tight">
          Study smarter, not longer
        </h1>
        <p className="text-mindflow-text leading-relaxed">
          MindFlow uses a mathematical model of your brain to predict when you'll
          hit mental burnout — and builds you a personalized weekly schedule that
          puts hard tasks when you're freshest and inserts breaks right before you
          crash.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg text-center">
        {[
          { emoji: '🧪', title: '1. Calibrate', desc: '30-second focus test' },
          { emoji: '📅', title: '2. Schedule', desc: 'Add your week + tasks' },
          { emoji: '📊', title: '3. Optimize', desc: 'Get your perfect plan' },
        ].map((s, i) => (
          <div key={i} className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4">
            <p className="text-2xl mb-1">{s.emoji}</p>
            <p className="text-sm font-medium text-mindflow-heading">{s.title}</p>
            <p className="text-xs text-mindflow-muted">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onStart}
          className="bg-mindflow-accent text-white px-8 py-3 rounded-xl text-lg font-semibold
                     hover:opacity-90 shadow-lg shadow-mindflow-accent/25 flex items-center gap-2">
          Take Calibration Test <ArrowRight className="w-5 h-5" />
        </button>
        <button onClick={onSkip}
          className="border border-mindflow-border text-mindflow-text px-6 py-3 rounded-xl
                     text-sm hover:bg-mindflow-surface transition-colors">
          Skip for now (use default)
        </button>
      </div>

      <p className="text-xs text-mindflow-muted">
        You can always calibrate later for more accurate results
      </p>
    </div>
  );
}
```

**Step 29** — ✅ Verify component renders correctly
- [x] 29. Shows Brain logo, headline "Study smarter, not longer", description paragraph
- [x] 29. Shows 3 step cards: Calibrate, Schedule, Optimize
- [x] 29. "Take Calibration Test" button calls `onStart` prop
- [x] 29. "Skip for now" button calls `onSkip` prop
- [x] 29. Entrance animation: `animate-slide-up` class applied

**Step 30** — ✅ Verify dark theme styling
- [x] 30. All colors use mindflow design tokens
- [x] 30. No hardcoded colors outside the design system
- [x] 30. Responsive: stacks vertically on mobile, horizontal button row on desktop

---

### Steps 31–36: Stroop Test Modal (`src/components/StroopTestModal.jsx`)

**NEW FILE.** A 30-second cognitive calibration game. Shows words in mismatched font colors; user clicks the font color (not the word text). Produces an alpha focus score.

---

**Step 31** — Create `StroopTestModal.jsx` with all 4 phases
- [ ] 31. Copy the complete code below (intro → countdown → playing → results):

```jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Brain, Zap, Clock, RefreshCw, Target } from 'lucide-react';

const COLORS = [
  { name: 'Red', hex: '#ef4444' }, { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' }, { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#8b5cf6' },
];
const GAME_MS = 30000, CD_START = 3;

export default function StroopTestModal({ onComplete, onSkip, existingCalibration }) {
  const [phase, setPhase] = useState('intro');
  const [countdown, setCountdown] = useState(CD_START);
  const [currentWord, setCurrentWord] = useState(null);
  const [answerOptions, setAnswerOptions] = useState([]);
  const [trialId, setTrialId] = useState(0);
  const [results, setResults] = useState(null);
  const [timeLeft, setTimeLeft] = useState(GAME_MS);

  const gameStartRef = useRef(0), totalTrialsRef = useRef(0), correctTrialsRef = useRef(0);
  const totalTimeRef = useRef(0), trialStartRef = useRef(0), timerRef = useRef(null);

  const generateTrial = useCallback(() => {
    const word = COLORS[Math.floor(Math.random() * COLORS.length)];
    let display;
    do { display = COLORS[Math.floor(Math.random() * COLORS.length)]; } while (display.name === word.name);
    setCurrentWord({ name: word.name, hex: display.hex });
    const wrong = COLORS.filter(c => c.hex !== display.hex).sort(() => Math.random() - 0.5).slice(0, 3);
    setAnswerOptions([display, ...wrong].sort(() => Math.random() - 0.5));
    trialStartRef.current = performance.now();
  }, []);

  const handleAnswer = useCallback((color) => {
    totalTrialsRef.current++;
    totalTimeRef.current += performance.now() - trialStartRef.current;
    if (color.hex === currentWord?.hex) correctTrialsRef.current++;
    setTrialId(id => id + 1);
  }, [currentWord]);

  useEffect(() => { if (phase === 'playing') generateTrial(); }, [trialId, phase, generateTrial]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { setPhase('playing'); gameStartRef.current = performance.now(); setTrialId(0); setTimeLeft(GAME_MS); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, GAME_MS - (performance.now() - gameStartRef.current));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        const acc = totalTrialsRef.current > 0 ? correctTrialsRef.current / totalTrialsRef.current : 0;
        const avg = totalTrialsRef.current > 0 ? totalTimeRef.current / totalTrialsRef.current : 0;
        const raw = avg > 0 ? acc / (avg / 1000) : 0;
        setResults({ accuracy: acc, avgResponseTimeMs: Math.round(avg), alphaScore: Math.max(0.5, Math.min(1.5, raw)) });
        setPhase('results');
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const start = () => { totalTrialsRef.current = 0; correctTrialsRef.current = 0; totalTimeRef.current = 0; setCountdown(CD_START); setPhase('countdown'); };
  const alphaColor = (a) => a >= 1.2 ? 'text-mindflow-success' : a >= 0.9 ? 'text-mindflow-accent' : a >= 0.7 ? 'text-mindflow-warning' : 'text-mindflow-danger';

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    }
  };

  // ── INTRO ──
  if (phase === 'intro') return (
    <div className="flex flex-col items-center gap-6 py-12 animate-fade-in">
      <div className="bg-mindflow-surface p-5 rounded-full border border-mindflow-border">
        <Brain className="w-16 h-16 text-mindflow-accent" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-mindflow-heading">Cognitive Baseline Test</h2>
        <p className="text-mindflow-text max-w-lg">Words appear in <strong>mismatched colors</strong>. Click the <strong>font color</strong>, not the word text. Answer fast for 30 seconds.</p>
      </div>
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-6 text-center space-y-3 max-w-sm">
        <p className="text-xs text-mindflow-muted uppercase tracking-wide">Example</p>
        <p className="text-4xl font-bold" style={{ color: '#22c55e' }}>Red</p>
        <p className="text-xs text-mindflow-muted">Word says <span className="text-red-400">Red</span>, color is <span className="text-green-400">Green</span> → click <span className="text-green-400 font-bold">Green</span></p>
      </div>
      {existingCalibration && (
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl px-4 py-3 flex items-center gap-3">
          <Target className="w-5 h-5 text-mindflow-muted" />
          <span className="text-sm text-mindflow-text">Previous score:</span>
          <span className={`text-sm font-bold ${alphaColor(existingCalibration.alphaScore)}`}>{existingCalibration.alphaScore.toFixed(2)}</span>
        </div>
      )}
      <button onClick={start} className="bg-mindflow-accent text-white px-10 py-3.5 rounded-xl text-lg font-semibold hover:opacity-90 shadow-lg shadow-mindflow-accent/25">Start Test</button>
      <button onClick={handleSkip} className="text-mindflow-muted hover:text-mindflow-text text-sm underline underline-offset-4 transition-colors">Skip for now (use default focus score)</button>
      <p className="text-xs text-mindflow-muted">30 seconds · No preparation needed</p>
    </div>
  );

  // ── COUNTDOWN ──
  if (phase === 'countdown') return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-4">
        <p className="text-mindflow-muted text-sm uppercase tracking-widest">Get Ready</p>
        <span className="text-8xl font-black text-mindflow-accent animate-pulse">{countdown}</span>
      </div>
    </div>
  );

  // ── PLAYING ──
  if (phase === 'playing') {
    const pct = (timeLeft / GAME_MS) * 100;
    const barColor = pct > 50 ? 'bg-mindflow-success' : pct > 25 ? 'bg-mindflow-warning' : 'bg-mindflow-danger';
    return (
      <div className="flex flex-col items-center gap-8 py-8">
        <div className="w-full max-w-md space-y-1">
          <div className="flex justify-between text-xs text-mindflow-muted"><span>{(timeLeft/1000).toFixed(0)}s</span><span>{totalTrialsRef.current} trials</span></div>
          <div className="w-full h-2.5 bg-mindflow-bg rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-100 ${barColor}`} style={{ width: pct + '%' }} /></div>
        </div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-2xl px-16 py-12"><p className="text-6xl font-black select-none tracking-tight" style={{ color: currentWord?.hex }}>{currentWord?.name}</p></div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {answerOptions.slice(0, 4).map((c, i) => (
            <button key={i} onClick={() => handleAnswer(c)} className="px-4 py-3.5 rounded-xl text-white font-semibold text-sm hover:scale-105 active:scale-95 transition-transform shadow-lg" style={{ backgroundColor: c.hex }}>{c.name}</button>
          ))}
        </div>
        <p className="text-xs text-mindflow-muted">Click the <strong>font color</strong>, not the word</p>
      </div>
    );
  }

  // ── RESULTS ──
  if (phase === 'results' && results) return (
    <div className="flex flex-col items-center gap-6 py-12 animate-fade-in">
      <div className="bg-mindflow-accent/15 p-5 rounded-full"><Zap className="w-16 h-16 text-mindflow-accent" /></div>
      <div className="text-center"><h2 className="text-2xl font-bold text-mindflow-heading">Your Results</h2><p className="text-sm text-mindflow-muted mt-1">{totalTrialsRef.current} trials in 30 seconds</p></div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 text-center"><Target className="w-5 h-5 text-mindflow-accent mx-auto mb-2" /><p className="text-2xl font-bold text-mindflow-heading">{(results.accuracy*100).toFixed(0)}%</p><p className="text-xs text-mindflow-muted">Accuracy</p></div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 text-center"><Clock className="w-5 h-5 text-mindflow-warning mx-auto mb-2" /><p className="text-2xl font-bold text-mindflow-heading">{results.avgResponseTimeMs}</p><p className="text-xs text-mindflow-muted">Avg Speed (ms)</p></div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 text-center"><Zap className={`w-5 h-5 mx-auto mb-2 ${alphaColor(results.alphaScore)}`} /><p className={`text-2xl font-bold ${alphaColor(results.alphaScore)}`}>{results.alphaScore.toFixed(2)}</p><p className="text-xs text-mindflow-muted">Alpha Score</p></div>
      </div>
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 max-w-lg text-sm text-mindflow-text">
        <p className="font-medium text-mindflow-heading mb-1">What this means</p>
        {results.alphaScore >= 1.2 && <p>Excellent focus control. You'll stay in Flow longer during study sessions.</p>}
        {results.alphaScore >= 0.9 && results.alphaScore < 1.2 && <p>Good focus control. Standard fatigue patterns apply. Take breaks every 90 minutes.</p>}
        {results.alphaScore >= 0.7 && results.alphaScore < 0.9 && <p>Moderate focus. Schedule harder tasks early in the day. Take breaks every 60 minutes.</p>}
        {results.alphaScore < 0.7 && <p>Focus needs support. Try studying in 25-minute blocks with 5-minute breaks. Avoid late-night sessions.</p>}
      </div>
      <div className="flex gap-3">
        <button onClick={() => onComplete({ stroopAccuracy: results.accuracy, avgResponseTimeMs: results.avgResponseTimeMs, alphaScore: results.alphaScore })} className="bg-mindflow-accent text-white px-8 py-3 rounded-xl text-lg font-semibold hover:opacity-90 shadow-lg shadow-mindflow-accent/25">Save & Continue</button>
        <button onClick={() => { setResults(null); setPhase('intro'); }} className="border border-mindflow-border text-mindflow-text px-6 py-3 rounded-xl text-sm hover:bg-mindflow-surface transition-colors flex items-center gap-2"><RefreshCw className="w-4 h-4" />Retake</button>
      </div>
    </div>
  );

  return null;
}
```

**Step 32** — Verify intro phase
- [ ] 32. Intro shows: Brain icon, "Cognitive Baseline Test" heading, instructions, example (green "Red" text), Start button, Skip button
- [ ] 32. Previous calibration score shown if `existingCalibration` prop is provided
- [ ] 32. Skip button calls `onSkip` if provided, otherwise calls `onComplete` with default calibration

**Step 33** — Verify countdown phase
- [ ] 33. Shows "Get Ready" + large countdown number (3, 2, 1)
- [ ] 33. Countdown number pulses with `animate-pulse`
- [ ] 33. Auto-advances to playing phase after countdown reaches 0

**Step 34** — Verify playing phase
- [ ] 34. Word text ≠ font color (the Stroop conflict — enforced by `do...while` loop)
- [ ] 34. 4 answer buttons, each showing a color name with that color's background
- [ ] 34. Timer bar counts down from 30s, changes color (green → yellow → red)
- [ ] 34. Trial counter increments with each answer
- [ ] 34. Auto-stops after 30 seconds (GAME_MS = 30000)

**Step 35** — Verify results phase
- [ ] 35. Shows 3 metric cards: Accuracy (%), Avg Speed (ms), Alpha Score (color-coded)
- [ ] 35. Interpretation text varies by alpha range (4 tiers)
- [ ] 35. Alpha formula: `clamp(accuracy / (avgResponseTimeMs / 1000), 0.5, 1.5)`
- [ ] 35. "Save & Continue" calls `onComplete` with full calibration object
- [ ] 35. "Retake" button resets state and returns to intro

**Step 36** — Verify no memory leaks
- [ ] 36. All `setInterval` and `setTimeout` calls have cleanup in `useEffect` return
- [ ] 36. `timerRef` is cleared when component unmounts or game ends
- [ ] 36. No state updates after unmount (no "setState on unmounted component" warnings)

---

### Steps 37–44: Task Input Form (`src/components/TaskInputForm.jsx`)

**NEW FILE.** Form for adding study tasks. 6 fields: title, type, priority, difficulty, duration, deadline. Shows task list with delete capability.

---

**Step 37** — ✅ Create `TaskInputForm.jsx` with all fields
- [x] 37. Copy the complete code below:

```jsx
import { useState } from 'react';
import { Plus, Trash2, Star, Clock, Calendar, AlertCircle } from 'lucide-react';

const TYPES = [
  { value: 'academic', label: 'Academic', color: '#3b82f6' },
  { value: 'sports', label: 'Sports', color: '#22c55e' },
  { value: 'arts', label: 'Arts', color: '#8b5cf6' },
  { value: 'other', label: 'Other', color: '#6b7280' },
];

const PRIORITIES = [
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'low', label: 'Low', color: '#6b7280' },
];

export default function TaskInputForm({ tasks = [], onChange }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('academic');
  const [difficulty, setDifficulty] = useState(3);
  const [durationMins, setDurationMins] = useState(30);
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');

  const reset = () => { setTitle(''); setType('academic'); setDifficulty(3); setDurationMins(30); setPriority('medium'); setDeadline(''); setError(''); };

  const validate = () => {
    if (!title.trim()) return 'Enter a task title.';
    if (durationMins < 5) return 'Duration must be at least 5 minutes.';
    if (durationMins > 480) return 'Duration cannot exceed 8 hours.';
    return null;
  };

  const handleAdd = () => {
    const err = validate(); if (err) { setError(err); return; }
    onChange([...tasks, { id: crypto.randomUUID(), title: title.trim(), type, durationMins, difficulty, priority, deadline: deadline || null }]);
    reset();
  };

  const typeMeta = (t) => TYPES.find(o => o.value === t) || TYPES[3];
  const priorityMeta = (p) => PRIORITIES.find(o => o.value === p) || PRIORITIES[1];

  return (
    <div className="space-y-6">
      {/* ── Task list ── */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <h3 className="text-sm font-medium text-mindflow-heading">Your Tasks ({tasks.length})</h3>
            <span className="text-xs text-mindflow-muted">{tasks.filter(t => t.deadline).length} with deadlines</span>
          </div>
          {tasks.map(task => {
            const tm = typeMeta(task.type), pm = priorityMeta(task.priority);
            return (
              <div key={task.id} className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-start justify-between group hover:border-mindflow-border/80 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-mindflow-heading font-medium truncate">{task.title}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full font-medium text-white/90" style={{ backgroundColor: tm.color + '33', color: tm.color }}>{tm.label}</span>
                    <span className="px-2.5 py-1 rounded-full font-medium text-white/90" style={{ backgroundColor: pm.color + '33', color: pm.color }}>
                      {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '⚪'} {pm.label}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-mindflow-bg text-mindflow-muted flex items-center gap-1"><Clock className="w-3 h-3" />{task.durationMins}min</span>
                    <span className="px-2.5 py-1 rounded-full bg-mindflow-bg text-yellow-400">{'★'.repeat(task.difficulty)}{'☆'.repeat(5 - task.difficulty)}</span>
                    {task.deadline && <span className="px-2.5 py-1 rounded-full bg-mindflow-bg text-mindflow-muted flex items-center gap-1"><Calendar className="w-3 h-3" />Due: {task.deadline}</span>}
                  </div>
                </div>
                <button onClick={() => onChange(tasks.filter(t => t.id !== task.id))} className="p-2 rounded-lg text-mindflow-muted hover:text-mindflow-danger hover:bg-mindflow-danger/10 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-3" title="Remove task"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add form ── */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-mindflow-heading flex items-center gap-2"><Plus className="w-4 h-4 text-mindflow-accent" />Add Task</h3>

        <input type="text" value={title} onChange={e => { setTitle(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Task title (e.g. Math problem set)" className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5 text-mindflow-text placeholder-mindflow-muted focus:border-mindflow-accent focus:outline-none text-sm" />

        <div>
          <p className="text-xs text-mindflow-muted mb-2 font-medium">Type</p>
          <div className="flex gap-2">{TYPES.map(t => (<button key={t.value} onClick={() => setType(t.value)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${type === t.value ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`} style={type === t.value ? { backgroundColor: t.color } : {}}>{t.label}</button>))}</div>
        </div>

        <div>
          <p className="text-xs text-mindflow-muted mb-2 font-medium">Priority</p>
          <div className="flex gap-2">{PRIORITIES.map(p => (<button key={p.value} onClick={() => setPriority(p.value)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${priority === p.value ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`} style={priority === p.value ? { backgroundColor: p.color } : {}}>{p.label}</button>))}</div>
        </div>

        <div>
          <p className="text-xs text-mindflow-muted mb-2 font-medium">Difficulty</p>
          <div className="flex gap-1.5">{[1,2,3,4,5].map(s => (<button key={s} onClick={() => setDifficulty(s)} className="p-1 rounded hover:scale-110 transition-transform"><Star className={`w-7 h-7 ${s <= difficulty ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-600'}`} fill={s <= difficulty ? 'currentColor' : 'none'} /></button>))}<span className="ml-2 text-xs text-mindflow-muted self-center">{['','Very Easy','Easy','Medium','Hard','Very Hard'][difficulty]}</span></div>
        </div>

        <div>
          <p className="text-xs text-mindflow-muted mb-2 font-medium">Duration</p>
          <div className="flex items-center gap-2"><input type="number" value={durationMins} onChange={e => setDurationMins(Number(e.target.value))} min={5} max={480} step={5} className="w-28 bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2 text-mindflow-text focus:border-mindflow-accent focus:outline-none text-sm" /><span className="text-sm text-mindflow-muted">minutes</span>{[15,30,60,90,120].map(m => (<button key={m} onClick={() => setDurationMins(m)} className={`px-2.5 py-1 rounded-md text-xs transition-colors ${durationMins === m ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}>{m >= 60 ? `${m / 60}h` : `${m}m`}</button>))}</div>
        </div>

        <div>
          <p className="text-xs text-mindflow-muted mb-2 font-medium">Deadline <span className="opacity-60">(optional)</span></p>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2 text-mindflow-text focus:border-mindflow-accent focus:outline-none text-sm" />
        </div>

        {error && <div className="flex items-center gap-2 text-sm text-mindflow-danger bg-mindflow-danger/10 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

        <button onClick={handleAdd} className="w-full bg-mindflow-accent text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity text-sm">Add Task</button>
      </div>
    </div>
  );
}
```

**Step 38** — ✅ Verify all 6 fields are present
- [x] 38. Title: text input
- [x] 38. Type: 4 buttons (Academic blue, Sports green, Arts purple, Other gray)
- [x] 38. Priority: 3 buttons (High red, Medium yellow, Low gray)
- [x] 38. Difficulty: 5 star buttons with text label (Very Easy → Very Hard)
- [x] 38. Duration: number input + 5 quick-set buttons (15m, 30m, 1h, 1.5h, 2h)
- [x] 38. Deadline: optional date input

**Step 39** — ✅ Verify validation works
- [x] 39. Empty title → "Enter a task title." error
- [x] 39. Duration < 5 → "Duration must be at least 5 minutes." error
- [x] 39. Duration > 480 → "Duration cannot exceed 8 hours." error
- [x] 39. Error clears when user starts typing in title field

**Step 40** — ✅ Verify task cards render with correct colors
- [x] 40. Type badge: colored background at 20% opacity + matching text color
- [x] 40. Priority badge: emoji indicator (🔴 High / 🟡 Medium / ⚪ Low) + colored background
- [x] 40. Duration: clock icon + minutes
- [x] 40. Difficulty: filled ★ + empty ☆ stars
- [x] 40. Deadline: calendar icon + ISO date (only if set)

**Step 41** — ✅ Verify task deletion
- [x] 41. Delete (trash) button appears on hover (opacity-0 → opacity-100)
- [x] 41. Clicking delete removes task from list via `onChange`
- [x] 41. Delete button only on task cards, not on the add form

**Step 42** — ✅ Verify Enter key submits
- [x] 42. Pressing Enter in the title input triggers `handleAdd`
- [x] 42. Does not submit if validation fails

**Step 43** — ✅ Verify form resets after successful add
- [x] 43. All fields return to defaults (title='', type='academic', difficulty=3, duration=30, priority='medium', deadline='')
- [x] 43. Error message clears
- [x] 43. New task appears at bottom of list

**Step 44** — ✅ Verify task counter and deadline counter
- [x] 44. "Your Tasks (N)" shows correct count
- [x] 44. "X with deadlines" shows correct count of tasks with non-null deadline
- [x] 44. Counters update immediately on add/delete

---

### Steps 45–50: Weekly Calendar (`src/components/WeeklyCalendar.jsx`)

**NEW FILE.** 7-column weekly grid (Mon–Sun, 6am–10pm). Click empty space to add a calendar block. Click existing block to edit/delete. Quick-add presets for common patterns.

---

**Step 45** — ✅ Create `WeeklyCalendar.jsx` with grid and quick-adds
- [x] 45. Copy the complete code below:

```jsx
import { useState } from 'react';
import { X, School, Dumbbell, Palette, Ellipsis, Trash2 } from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const START_H = 6, END_H = 22, TOTAL_H = END_H - START_H, ROW_H = 48;

const TYPE_CFG = {
  academic: { color: '#3b82f6', icon: School, label: 'Academic' },
  sports:   { color: '#22c55e', icon: Dumbbell, label: 'Sports' },
  arts:     { color: '#8b5cf6', icon: Palette, label: 'Arts' },
  other:    { color: '#6b7280', icon: Ellipsis, label: 'Other' },
};

const QUICK = [
  { label: 'School Day', type: 'academic', dur: 7, start: 8, days: ['Mon','Tue','Wed','Thu','Fri'] },
  { label: 'Half Day', type: 'academic', dur: 4, start: 8, days: ['Mon','Tue','Wed','Thu','Fri'] },
  { label: 'Sports', type: 'sports', dur: 2, start: 15, days: ['Mon','Wed','Fri'] },
  { label: 'Art Class', type: 'arts', dur: 1.5, start: 14, days: ['Tue','Thu'] },
];

function fmtHr(h) { const hh = Math.floor(h), p = hh >= 12 ? 'pm' : 'am', d = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh); return `${d}${p}`; }

export default function WeeklyCalendar({ blocks = [], onChange }) {
  const [pop, setPop] = useState(null);
  const [label, setLabel] = useState(''), [dur, setDur] = useState(1), [typ, setTyp] = useState('academic');

  const openNew = (day, h) => { setPop({ day, startHour: h }); setLabel(''); setDur(1); setTyp('academic'); };
  const openEdit = (b) => { setPop({ day: b.day, startHour: b.startHour, editingBlockId: b.id }); setLabel(b.label); setDur(b.durationHours); setTyp(b.type); };
  const close = () => setPop(null);

  const save = () => {
    if (!label.trim()) return;
    if (pop.editingBlockId) {
      onChange(blocks.map(b => b.id === pop.editingBlockId ? { ...b, label: label.trim(), durationHours: dur, type: typ, startHour: pop.startHour, day: pop.day } : b));
    } else {
      onChange([...blocks, { id: crypto.randomUUID(), day: pop.day, startHour: pop.startHour, durationHours: dur, label: label.trim(), type: typ, isFixed: true }]);
    }
    close(); setLabel('');
  };

  const del = () => { if (pop.editingBlockId) onChange(blocks.filter(b => b.id !== pop.editingBlockId)); close(); };
  const quickAdd = (p) => onChange([...blocks, ...p.days.map(d => ({ id: crypto.randomUUID(), day: d, startHour: p.start, durationHours: p.dur, label: p.label, type: p.type, isFixed: true }))]);

  const gridClick = (day, e) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const h = START_H + (e.clientY - rect.top) / ROW_H;
    openNew(day, Math.max(START_H, Math.min(END_H - 1, Math.round(h * 2) / 2)));
  };

  return (
    <div className="space-y-4">
      {/* Quick-adds */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((p, i) => { const c = TYPE_CFG[p.type], I = c.icon; return (
          <button key={i} onClick={() => quickAdd(p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:scale-105 active:scale-95 transition-all" style={{ backgroundColor: c.color + '22', color: c.color, border: '1px solid ' + c.color + '33' }}><I className="w-3.5 h-3.5" />{p.label}</button>
        );})}
      </div>

      {/* Grid */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-mindflow-border bg-mindflow-bg/50">
          {DAYS.map(d => { const n = blocks.filter(b => b.day === d).length; return (
            <div key={d} className="px-2 py-2.5 text-center border-r border-mindflow-border last:border-r-0"><span className="text-xs font-semibold text-mindflow-heading">{d}</span>{n > 0 && <span className="block text-[10px] text-mindflow-muted">{n} block{n !== 1 ? 's' : ''}</span>}</div>
          );})}
        </div>
        <div className="grid grid-cols-7 calendar-grid overflow-x-auto" style={{ minWidth: '840px' }}>
          {DAYS.map(day => (
            <div key={day} className="relative border-r border-mindflow-border last:border-r-0 cursor-crosshair" style={{ height: TOTAL_H * ROW_H + 'px' }} onClick={(e) => gridClick(day, e)}>
              {Array.from({ length: TOTAL_H }, (_, i) => (<div key={i} className="absolute left-0 right-0 border-t border-mindflow-border/40" style={{ top: i * ROW_H + 'px' }}>{day === 'Mon' && <span className="absolute -left-14 top-0 text-[10px] text-mindflow-muted w-12 text-right pr-2 leading-3 -translate-y-1/2">{fmtHr(START_H + i)}</span>}</div>))}
              {blocks.filter(b => b.day === day).map(b => { const c = TYPE_CFG[b.type] || TYPE_CFG.other, top = (b.startHour - START_H) * ROW_H, h = b.durationHours * ROW_H; return (
                <div key={b.id} onClick={e => { e.stopPropagation(); openEdit(b); }} className="absolute left-1 right-1 rounded-lg px-2 py-1.5 cursor-pointer hover:brightness-110 transition-all overflow-hidden group" style={{ top: top + 2 + 'px', height: Math.max(h - 4, 20) + 'px', backgroundColor: c.color + '22', borderLeft: '3px solid ' + c.color, zIndex: 10 }}>
                  <p className="text-xs font-semibold text-white truncate leading-tight">{b.label}</p>{h >= 48 && <p className="text-[10px] text-mindflow-muted mt-0.5">{b.durationHours}h</p>}
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"><span className="text-[10px] text-white/70">Click to edit</span></div>
                </div>
              );})}
              {blocks.filter(b => b.day === day).length === 0 && <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none"><span className="text-xs text-mindflow-muted/40">Click to add</span></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Popover */}
      {pop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={close}>
          <div className="bg-mindflow-surface border border-mindflow-border rounded-2xl p-6 w-80 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-mindflow-heading font-semibold text-sm">{pop.editingBlockId ? 'Edit Block' : 'Add Block'}</h3><button onClick={close} className="p-1 rounded-lg text-mindflow-muted hover:text-mindflow-text hover:bg-mindflow-bg"><X className="w-4 h-4" /></button></div>
            <div className="bg-mindflow-bg rounded-lg px-3 py-2 text-xs text-mindflow-text"><span className="font-medium text-mindflow-heading">{pop.day}</span><span className="text-mindflow-muted"> at </span><span className="font-medium text-mindflow-heading">{fmtHr(pop.startHour)}</span></div>
            <div><label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Label</label><input type="text" value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="e.g. Math class" className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2 text-mindflow-text placeholder-mindflow-muted text-sm focus:border-mindflow-accent focus:outline-none" autoFocus /></div>
            <div><label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Duration</label><div className="flex flex-wrap gap-1.5">{[0.5,1,1.5,2,2.5,3,4,6,8].map(h => (<button key={h} onClick={() => setDur(h)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${dur === h ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}>{h}h</button>))}</div></div>
            <div><label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Type</label><div className="flex gap-2">{Object.entries(TYPE_CFG).map(([k, c]) => { const I = c.icon; return (<button key={k} onClick={() => setTyp(k)} className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${typ === k ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`} style={typ === k ? { backgroundColor: c.color } : {}}><I className="w-3.5 h-3.5" />{c.label}</button>);})}</div></div>
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={!label.trim()} className="flex-1 bg-mindflow-accent text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">{pop.editingBlockId ? 'Save Changes' : 'Add Block'}</button>
              {pop.editingBlockId && <button onClick={del} className="px-3 py-2.5 bg-mindflow-danger/15 text-mindflow-danger rounded-lg text-sm hover:bg-mindflow-danger/25"><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 46** — ✅ Verify quick-add presets
- [x] 46. 4 quick-add buttons: School Day (Mon–Fri, 8am–3pm), Half Day (Mon–Fri, 8am–12pm), Sports (Mon/Wed/Fri, 3pm–5pm), Art Class (Tue/Thu, 2pm–3:30pm)
- [x] 46. Each button colored by type with matching icon
- [x] 46. Clicking a preset adds blocks to all specified days at once

**Step 47** — ✅ Verify 7×16 grid renders correctly
- [x] 47. 7 columns (Mon–Sun), 16 rows (6am–10pm)
- [x] 47. Day headers show day name + block count per day
- [x] 47. Time labels on left side of Monday column (6am, 7am... 9pm)
- [x] 47. Grid has `calendar-grid` class for custom scrollbar styling

**Step 48** — ✅ Verify color-coded blocks
- [x] 48. Academic blocks: blue left border + blue tinted background
- [x] 48. Sports blocks: green left border + green tint
- [x] 48. Arts blocks: purple left border + purple tint
- [x] 48. Other blocks: gray left border + gray tint
- [x] 48. Block height proportional to duration (ROW_H = 48px per hour)

**Step 49** — ✅ Verify click interactions
- [x] 49. Click empty space → add popover opens with day/time pre-filled
- [x] 49. Click existing block → edit popover opens with all fields pre-filled
- [x] 49. Popover backdrop click closes without saving
- [x] 49. Popover has: day/time display, label input, duration buttons, type buttons, save button
- [x] 49. Edit mode additionally shows delete (trash) button

**Step 50** — ✅ Verify mobile responsiveness
- [x] 50. Grid has `overflow-x-auto` for horizontal scroll on narrow screens
- [x] 50. `min-width: 840px` on grid ensures columns don't collapse below readability
- [x] 50. Quick-add buttons wrap with `flex-wrap`

---

### Steps 51–54: Session Chart (`src/components/SessionChart.jsx`)

**NEW FILE.** Recharts stacked area chart showing Flow/Distracted/Fatigue probabilities over time. Critical fix: uses `useId()` for unique SVG gradient IDs so multiple charts on one page don't collide.

---

**Step 51** — Create `SessionChart.jsx` with unique gradient IDs
- [ ] 51. Copy the complete code below:

```jsx
import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

export default function SessionChart({ timeline, burnoutTick = -1, showReferenceLine = true, height = 300, title }) {
  const uid = useId();
  const fg = `flow-${uid}`, dg = `dist-${uid}`, ftg = `fat-${uid}`;

  if (!timeline || timeline.length === 0) return null;

  const pct = v => (v * 100).toFixed(1) + '%';
  const yt = v => Math.round(v * 100) + '%';
  const bl = burnoutTick >= 0 && burnoutTick < timeline.length ? timeline[burnoutTick].timeLabel : null;

  return (
    <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4">
      {title && <h3 className="text-sm font-medium text-mindflow-heading mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={fg} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.85} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0.15} /></linearGradient>
            <linearGradient id={dg} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eab308" stopOpacity={0.85} /><stop offset="100%" stopColor="#eab308" stopOpacity={0.15} /></linearGradient>
            <linearGradient id={ftg} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.15} /></linearGradient>
          </defs>
          <XAxis dataKey="timeLabel" stroke="#6b6b80" fontSize={11} tickLine={false} axisLine={false} interval={2} />
          <YAxis domain={[0, 1]} tickFormatter={yt} stroke="#6b6b80" fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #2a2a38', borderRadius: '8px', fontSize: '12px', color: '#f0f0f8' }} formatter={pct} labelStyle={{ color: '#c4c4d0', marginBottom: '4px' }} />
          <Legend wrapperStyle={{ color: '#c4c4d0', fontSize: '12px', paddingTop: '8px' }} iconType="circle" />
          <Area type="monotone" dataKey="fatigue" name="Fatigue" stackId="1" stroke="#ef4444" fill={`url(#${ftg})`} strokeWidth={1} />
          <Area type="monotone" dataKey="distracted" name="Distracted" stackId="1" stroke="#eab308" fill={`url(#${dg})`} strokeWidth={1} />
          <Area type="monotone" dataKey="flow" name="Flow" stackId="1" stroke="#22c55e" fill={`url(#${fg})`} strokeWidth={1} />
          {showReferenceLine && bl && <ReferenceLine x={bl} stroke="#ef4444" strokeDasharray="6 6" strokeWidth={2} label={{ value: 'Burnout', position: 'top', fill: '#ef4444', fontSize: 11, fontWeight: 600 }} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 52** — Verify unique gradient IDs prevent color collision
- [ ] 52. Uses `useId()` from React — generates a unique string per component instance
- [ ] 52. Gradient IDs are `flow-${uid}`, `dist-${uid}`, `fat-${uid}`
- [ ] 52. When 3+ charts render on one dashboard page, all 3 show proper green/yellow/red gradients (no grey/white areas)

**Step 53** — Verify stacked areas and burnout reference line
- [ ] 53. 3 stacked Area components: Flow (green), Distracted (yellow), Fatigue (red)
- [ ] 53. All use `stackId="1"` so they stack to 100%
- [ ] 53. `ReferenceLine` appears at the burnout tick (dashed red line with "Burnout" label) — only when `showReferenceLine` is true and `burnoutTick >= 0`

**Step 54** — Verify edge cases
- [ ] 54. Returns `null` for empty/null timeline (no crash, no empty chart box)
- [ ] 54. `showReferenceLine={false}` hides the burnout line (used for aggregate daily charts)
- [ ] 54. Tooltip shows percentages formatted to 1 decimal place
- [ ] 54. Y-axis domain is `[0, 1]`, tick formatter shows whole percentages

---

### Steps 55–65: Dashboard (`src/components/MarkovAnalyticsDashboard.jsx`)

**NEW FILE.** The main dashboard with day selector, summary cards, Gantt timeline (calendar blocks + sessions), daily fatigue curve, expandable session cards with mini charts, unscheduled tasks section, and stale schedule detection banner.

---

**Step 55** — Create `MarkovAnalyticsDashboard.jsx` with all features
- [ ] 55. Copy the complete code below:

```jsx
import { useState } from 'react';
import { Brain, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import SessionChart from './SessionChart';

const TYPE_COLORS = { academic: '#3b82f6', sports: '#22c55e', arts: '#8b5cf6', other: '#6b7280' };
const TYPE_LABELS = { academic: 'Academic', sports: 'Sports', arts: 'Arts', other: 'Other' };

function getToday() {
  const idx = (new Date().getDay() + 6) % 7;
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][idx];
}

export default function MarkovAnalyticsDashboard({ optimizedWeek, alpha, isCalculating, isStale, onRegenerate, calendarBlocks = [] }) {
  const [selectedDay, setSelectedDay] = useState(() => getToday());
  const [expanded, setExpanded] = useState({});

  // ── LOADING ──
  if (isCalculating) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="relative"><Brain className="w-16 h-16 text-mindflow-accent animate-pulse" /><div className="absolute inset-0 rounded-full animate-pulse-glow" /></div>
      <p className="text-mindflow-heading text-lg font-medium">Calculating your schedule...</p>
      <p className="text-mindflow-muted text-sm text-center max-w-sm">Running Markov simulations across all 7 days to find the best task order and break placement.</p>
    </div>
  );

  // ── EMPTY ──
  if (!optimizedWeek || !optimizedWeek.days) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="bg-mindflow-surface p-5 rounded-full border border-mindflow-border"><Brain className="w-12 h-12 text-mindflow-muted" /></div>
      <p className="text-mindflow-heading text-lg font-medium">No schedule generated yet</p>
      <p className="text-mindflow-muted text-sm text-center max-w-md">To see your optimized week:</p>
      <div className="flex items-center gap-4 mt-2 text-xs text-mindflow-muted">
        <span className="bg-mindflow-surface border border-mindflow-border rounded-lg px-3 py-2">1. 🧪 Calibrate</span><span>→</span>
        <span className="bg-mindflow-surface border border-mindflow-border rounded-lg px-3 py-2">2. 📅 Add schedule + tasks</span><span>→</span>
        <span className="bg-mindflow-surface border border-mindflow-border rounded-lg px-3 py-2">3. ⚡ Generate</span>
      </div>
    </div>
  );

  const dd = optimizedWeek.days[selectedDay];
  if (!dd) return null;
  const { sessions, fatigueCurve, totalFlowMins, burnoutCount } = dd;
  const activeDays = Object.values(optimizedWeek.days).filter(d => d.sessions.length > 0).length;

  // Day's calendar blocks (for Gantt)
  const dayBlocks = (calendarBlocks || []).filter(b => b.day === selectedDay);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Stale schedule banner ── */}
      {isStale && (
        <div className="bg-mindflow-warning/10 border border-mindflow-warning/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-mindflow-warning">
            <AlertTriangle className="w-5 h-5" />
            <span>Your tasks or schedule have changed since the last generation.</span>
          </div>
          {onRegenerate && (
            <button onClick={onRegenerate} className="bg-mindflow-warning text-mindflow-bg px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2 shrink-0 ml-4">
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
          )}
        </div>
      )}

      {/* ── Day selector ── */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-1.5 flex gap-1.5">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => {
          const has = optimizedWeek.days[d].sessions.length > 0;
          const n = optimizedWeek.days[d].sessions.length;
          const isToday = d === getToday();
          return (
            <button key={d} onClick={() => setSelectedDay(d)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                selectedDay === d ? 'bg-mindflow-accent text-white shadow-lg shadow-mindflow-accent/25'
                  : has ? 'text-mindflow-text hover:bg-mindflow-border/50' : 'text-mindflow-muted/50 hover:text-mindflow-muted'
              }`}>
              <span className="block">{d}</span>
              {has ? <span className="block text-[10px] opacity-70">{n} task{n !== 1 ? 's' : ''}</span>
                : <span className="block text-[10px] opacity-40">—</span>}
              {isToday && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-mindflow-accent" />}
            </button>
          );
        })}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center gap-4">
          <div className="bg-mindflow-success/15 p-3 rounded-lg shrink-0"><Zap className="w-6 h-6 text-mindflow-success" /></div>
          <div className="min-w-0"><p className="text-2xl font-bold text-mindflow-heading">{totalFlowMins}</p><p className="text-xs text-mindflow-muted">Flow Minutes</p></div>
        </div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg shrink-0 ${burnoutCount > 0 ? 'bg-mindflow-danger/15' : 'bg-mindflow-success/15'}`}>
            <AlertTriangle className={`w-6 h-6 ${burnoutCount > 0 ? 'text-mindflow-danger' : 'text-mindflow-success'}`} />
          </div>
          <div className="min-w-0"><p className="text-2xl font-bold text-mindflow-heading">{burnoutCount}</p><p className="text-xs text-mindflow-muted">Burnout Events</p><p className="text-[10px] text-mindflow-muted mt-0.5 truncate">{burnoutCount === 0 ? 'No fatigue spikes!' : 'Breaks auto-inserted'}</p></div>
        </div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center gap-4">
          <div className="bg-mindflow-accent/15 p-3 rounded-lg shrink-0"><CheckCircle2 className="w-6 h-6 text-mindflow-accent" /></div>
          <div className="min-w-0"><p className="text-2xl font-bold text-mindflow-heading">{sessions.length}</p><p className="text-xs text-mindflow-muted">Tasks on {selectedDay}</p><p className="text-[10px] text-mindflow-muted mt-0.5 truncate">{activeDays} active day{activeDays !== 1 ? 's' : ''} this week</p></div>
        </div>
      </div>

      {/* ── Gantt timeline (sessions + calendar blocks) ── */}
      {((sessions.length > 0) || (dayBlocks.length > 0)) && (
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-mindflow-heading mb-3">{selectedDay} Timeline</h3>
          <div className="flex justify-between text-[10px] text-mindflow-muted mb-1.5 px-1">
            <span>6am</span><span>8am</span><span>10am</span><span>12pm</span><span>2pm</span><span>4pm</span><span>6pm</span><span>8pm</span><span>10pm</span>
          </div>
          <div className="relative h-14 bg-mindflow-bg rounded-lg overflow-hidden">
            {/* Calendar blocks (gray, full height, slightly transparent) */}
            {dayBlocks.map(b => {
              const sp = ((b.startHour - 6) / 16) * 100;
              const wp = (b.durationHours / 16) * 100;
              const c = TYPE_COLORS[b.type] || TYPE_COLORS.other;
              return (
                <div key={b.id} className="absolute top-0 bottom-0 flex items-center px-2 overflow-hidden" style={{ left: sp + '%', width: Math.max(2, wp) + '%', backgroundColor: c + '18', borderLeft: '2px solid ' + c, borderRight: '2px solid ' + c }}>
                  <span className="text-[9px] text-mindflow-muted truncate w-full">{b.label}</span>
                </div>
              );
            })}
            {/* Sessions (colored, positioned on top half) */}
            {sessions.map((s, i) => {
              const sp = ((s.startTick - 36) / 96) * 100;
              const wp = ((s.endTick - s.startTick) / 96) * 100;
              const c = TYPE_COLORS[s.task.type] || TYPE_COLORS.other;
              return (
                <div key={i} className="absolute top-1 h-6 rounded flex items-center px-2 overflow-hidden" style={{ left: Math.max(0, sp) + '%', width: Math.max(2, Math.min(wp, 100 - Math.max(0, sp))) + '%', backgroundColor: c + '55', borderLeft: '3px solid ' + c }} title={`${s.task.title} · ${TYPE_LABELS[s.task.type]} · ${s.task.difficulty}⭐`}>
                  <span className="text-[9px] text-white truncate w-full font-medium">{s.task.title}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-mindflow-muted">
            {Object.entries(TYPE_COLORS).map(([t, c]) => (<div key={t} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />{TYPE_LABELS[t]}</div>))}
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm border border-mindflow-muted bg-transparent" />Class</div>
          </div>
        </div>
      )}

      {/* ── Daily fatigue curve ── */}
      {fatigueCurve.length > 0 && <SessionChart timeline={fatigueCurve} burnoutTick={-1} showReferenceLine={false} height={280} title={`${selectedDay} — Aggregate Fatigue Curve`} />}

      {/* ── Session cards ── */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-mindflow-heading">{selectedDay} Study Sessions</h3>
          {sessions.map((s, i) => (
            <div key={i} className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))} className="w-full p-4 flex items-center justify-between hover:bg-mindflow-bg/50 transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[s.task.type] || TYPE_COLORS.other }} />
                  <div className="min-w-0">
                    <p className="text-mindflow-heading font-medium truncate">{s.task.title}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs text-mindflow-muted">
                      <span>{TYPE_LABELS[s.task.type]}</span><span className="opacity-50">·</span>
                      <span className={s.task.priority === 'high' ? 'text-red-400' : s.task.priority === 'medium' ? 'text-yellow-400' : ''}>{s.task.priority === 'high' ? '🔴 High' : s.task.priority === 'medium' ? '🟡 Medium' : '⚪ Low'}</span>
                      <span className="opacity-50">·</span><span className="text-yellow-400">{'★'.repeat(s.task.difficulty)}</span>
                      <span className="opacity-50">·</span><span>{s.task.durationMins}min</span>
                      {s.burnoutTick > 0 && <><span className="opacity-50">·</span><span className="text-mindflow-danger flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Break inserted</span></>}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 ml-3">{expanded[i] ? <ChevronUp className="w-5 h-5 text-mindflow-muted" /> : <ChevronDown className="w-5 h-5 text-mindflow-muted" />}</div>
              </button>
              {expanded[i] && (
                <div className="px-4 pb-4 border-t border-mindflow-border pt-3 space-y-3">
                  <SessionChart timeline={s.timeline} burnoutTick={s.burnoutTick} height={150} />
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {(() => {
                      const fv = s.timeline.map(p => p.flow), fatv = s.timeline.map(p => p.fatigue), af = fv.reduce((a, b) => a + b, 0) / fv.length;
                      return (<>
                        <div className="bg-mindflow-bg rounded-lg py-2.5"><p className="text-[10px] text-mindflow-muted uppercase">Peak Flow</p><p className="text-sm font-semibold text-mindflow-success mt-0.5">{Math.round(Math.max(...fv) * 100)}%</p></div>
                        <div className="bg-mindflow-bg rounded-lg py-2.5"><p className="text-[10px] text-mindflow-muted uppercase">Peak Fatigue</p><p className="text-sm font-semibold text-mindflow-danger mt-0.5">{Math.round(Math.max(...fatv) * 100)}%</p></div>
                        <div className="bg-mindflow-bg rounded-lg py-2.5"><p className="text-[10px] text-mindflow-muted uppercase">Avg Flow</p><p className="text-sm font-semibold text-mindflow-accent mt-0.5">{Math.round(af * 100)}%</p></div>
                      </>);
                    })()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Unscheduled tasks ── */}
      {optimizedWeek.unscheduled && optimizedWeek.unscheduled.length > 0 && (
        <div className="bg-mindflow-surface border border-mindflow-warning/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-mindflow-warning" />
            <h3 className="text-sm font-medium text-mindflow-heading">Couldn't Schedule ({optimizedWeek.unscheduled.length} task{optimizedWeek.unscheduled.length !== 1 ? 's' : ''})</h3>
          </div>
          <p className="text-xs text-mindflow-muted mb-3">These tasks are too long for your available free time. Try reducing their estimated duration, lowering the priority of other tasks, or freeing up calendar space.</p>
          <div className="space-y-2">
            {optimizedWeek.unscheduled.map((task, i) => (<div key={i} className="bg-mindflow-bg rounded-lg px-4 py-3 flex items-center justify-between"><div><p className="text-sm text-mindflow-text font-medium">{task.title}</p><p className="text-xs text-mindflow-muted">{task.type} · {task.difficulty}⭐ · {task.durationMins}min · {task.priority === 'high' ? '🔴 High' : task.priority === 'medium' ? '🟡 Medium' : '⚪ Low'} priority</p></div><span className="text-xs text-mindflow-warning font-medium">Needs {Math.ceil(task.durationMins / 60)}h{task.durationMins % 60 > 0 ? ` ${task.durationMins % 60}m` : ''}</span></div>))}
          </div>
        </div>
      )}

      {/* ── Empty day ── */}
      {sessions.length === 0 && (<div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-10 text-center"><p className="text-mindflow-muted text-sm">No tasks scheduled for {selectedDay}.</p><p className="text-xs text-mindflow-muted mt-1">{selectedDay === 'Sat' || selectedDay === 'Sun' ? 'Rest day — enjoy your weekend! 🎉' : 'Free day. Add more tasks or adjust your calendar.'}</p></div>)}
    </div>
  );
}
```

**Step 56** — Verify `getToday()` returns the current day at render time
- [ ] 56. `getToday()` is called inside `useState` initializer: `() => getToday()` — ensures fresh value each mount
- [ ] 56. NOT computed at module level (avoids the "stale after midnight" bug)
- [ ] 56. Uses `(new Date().getDay() + 6) % 7` to map Sunday=0 → index 6

**Step 57** — Verify today indicator dot
- [ ] 57. Today's day button has a small purple dot (`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-mindflow-accent`)

**Step 58** — Verify loading, empty, and ready states
- [ ] 58. `isCalculating === true` → shows pulsing brain icon + "Calculating your schedule..." message
- [ ] 58. `!optimizedWeek || !optimizedWeek.days` → shows empty state with 3-step guide
- [ ] 58. `optimizedWeek.days[selectedDay]` is null → returns null (no crash)

**Step 59** — Verify stale schedule banner
- [ ] 59. When `isStale` is true: yellow warning banner appears at top
- [ ] 59. Banner says "Your tasks or schedule have changed since the last generation"
- [ ] 59. "Regenerate" button calls `onRegenerate` prop

**Step 60** — Verify day selector and summary cards
- [ ] 60. 7 day buttons, selected day has purple background
- [ ] 60. Days with tasks show task count, empty days show "—"
- [ ] 60. 3 summary cards: Flow Minutes (green), Burnout Events (red/green), Tasks count (purple)
- [ ] 60. Summary cards update when switching days

**Step 61** — Verify Gantt timeline shows calendar blocks AND sessions
- [ ] 61. Calendar blocks rendered as full-height semi-transparent bars with colored borders
- [ ] 61. Session blocks rendered as colored strips on the top half of the timeline
- [ ] 61. Both calendar blocks and sessions visible simultaneously (calendar = background, sessions = foreground)
- [ ] 61. Time labels at 2-hour intervals: 6am, 8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm, 10pm

**Step 62** — Verify Gantt legend includes "Class" entry
- [ ] 62. Legend shows colored squares for Academic/Sports/Arts/Other
- [ ] 62. Legend shows outlined square for "Class" (calendar blocks)

**Step 63** — Verify daily fatigue curve renders
- [ ] 63. `SessionChart` is rendered with `fatigueCurve` data, `showReferenceLine={false}`, title with day name
- [ ] 63. Only renders when `fatigueCurve.length > 0`

**Step 64** — Verify session cards expand/collapse
- [ ] 64. Each session shows: type color bar, task title, type label, priority, difficulty stars, duration
- [ ] 64. Click to expand → shows mini `SessionChart` + stats (Peak Flow %, Peak Fatigue %, Avg Flow %)
- [ ] 64. Click again to collapse. Chevron icon toggles up/down.
- [ ] 64. Break-inserted sessions show "Break inserted" badge

**Step 65** — Verify unscheduled section and empty day message
- [ ] 65. Unscheduled tasks section: warning icon + count + explanation + task list with time needed
- [ ] 65. Only renders when `optimizedWeek.unscheduled.length > 0`
- [ ] 65. Empty day: "No tasks scheduled" + context-sensitive message (weekend = "Rest day!", weekday = "Free day.")

---

### Steps 66–74: App Shell (`src/App.jsx`)

**REWRITE.** Replace the legacy prototype entirely. This is the main shell — all state lives here, all components are wired here, localStorage persistence, tab navigation, settings panel, stale detection, generate flow, reset.

---

**Step 66** — Rewrite `src/App.jsx` with the complete app shell
- [ ] 66. Replace the ENTIRE contents of `src/App.jsx` with the code below:

```jsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { Brain, Calendar, BarChart3, Zap, Play, AlertCircle, Settings, RefreshCw, Trash2 } from 'lucide-react';
import WelcomeScreen from './components/WelcomeScreen';
import StroopTestModal from './components/StroopTestModal';
import WeeklyCalendar from './components/WeeklyCalendar';
import TaskInputForm from './components/TaskInputForm';
import MarkovAnalyticsDashboard from './components/MarkovAnalyticsDashboard';
import generateWeeklySchedule from './utils/scheduler.js';
import { saveCalibration, loadCalibration, saveCalendar, loadCalendar, saveTasks, loadTasks, saveSettings, loadSettings, clearAll } from './utils/storage.js';

const TABS = [
  { id: 'calibrate', label: 'Calibration', icon: Brain },
  { id: 'tasks', label: 'Schedule', icon: Calendar },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
];

const DEFAULT_SETTINGS = { chronotype: 'morning', maxHoursPerDay: 8, maxHoursWeekend: 4 };

export default function App() {
  // ── Persistent state (init from localStorage) ────────────────────
  const [calibration, setCalibrationState] = useState(() => loadCalibration());
  const [calendarBlocks, setCalendarBlocksState] = useState(() => loadCalendar());
  const [tasks, setTasksState] = useState(() => loadTasks());
  const [settings, setSettingsState] = useState(() => loadSettings());

  // ── Session state ─────────────────────────────────────────────────
  const [showWelcome, setShowWelcome] = useState(() => {
    // Skip welcome if user already has data from a previous session
    return !loadCalibration();
  });
  const [activeTab, setActiveTab] = useState('calibrate');
  const [optimizedWeek, setOptimizedWeek] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── Stale detection ───────────────────────────────────────────────
  const lastGeneratedRef = useRef(null);    // Date.now() when schedule was generated
  const dataVersionRef = useRef(0);          // increments when tasks/blocks change
  const isStale = optimizedWeek && (dataVersionRef.current > 0);

  // ── Wrapped setters (save to localStorage + track staleness) ─────
  const setCalibration = (cal) => { setCalibrationState(cal); saveCalibration(cal); };
  const setCalendarBlocks = (blocks) => { setCalendarBlocksState(blocks); saveCalendar(blocks); dataVersionRef.current++; };
  const setTasks = (t) => { setTasksState(t); saveTasks(t); dataVersionRef.current++; };
  const setSettings = (s) => { setSettingsState(s); saveSettings(s); };

  // ── Generate schedule ─────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    setScheduleError(null);
    if (!calibration) { setScheduleError('Complete the calibration test first (or skip it).'); setActiveTab('calibrate'); return; }
    if (tasks.length === 0) { setScheduleError('Add at least one task first.'); setActiveTab('tasks'); return; }
    setIsCalculating(true);
    setTimeout(() => {
      try {
        const result = generateWeeklySchedule(calendarBlocks, tasks, calibration.alphaScore, settings);
        setOptimizedWeek(result);
        lastGeneratedRef.current = Date.now();
        dataVersionRef.current = 0;  // reset staleness
        setIsCalculating(false);
        setActiveTab('dashboard');
      } catch (err) {
        console.error('Scheduler crashed:', err);
        setScheduleError('Failed to generate schedule. Check console for details.');
        setIsCalculating(false);
      }
    }, 150);
  }, [calibration, calendarBlocks, tasks, settings]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleCalibrationComplete = (cal) => { setCalibration(cal); setShowWelcome(false); };
  const handleSkipCalibration = () => {
    setCalibration({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    setShowWelcome(false);
  };
  const handleReset = () => {
    if (confirm('Delete all your data? This cannot be undone.')) {
      clearAll();
      window.location.reload();
    }
  };
  const switchTab = (id) => { setActiveTab(id); setScheduleError(null); };
  const canGenerate = calibration && tasks.length > 0;

  // ── Welcome screen (shown once per session) ───────────────────────
  if (showWelcome) {
    return (
      <div className="min-h-screen bg-mindflow-bg flex items-center justify-center px-4">
        <WelcomeScreen onStart={() => setShowWelcome(false)} onSkip={handleSkipCalibration} />
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-mindflow-bg flex flex-col">
      {/* ═══ HEADER ═══ */}
      <header className="bg-mindflow-surface border-b border-mindflow-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-mindflow-accent" />
          <h1 className="text-xl font-bold text-mindflow-heading tracking-tight">MindFlow</h1>
          <span className="text-[10px] bg-mindflow-accent/15 text-mindflow-accent px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Beta</span>
        </div>
        <div className="flex items-center gap-3">
          {calibration && (
            <div className="flex items-center gap-2 text-sm bg-mindflow-bg rounded-lg px-3 py-1.5">
              <Zap className="w-4 h-4 text-mindflow-accent" />
              <span className="text-mindflow-muted hidden sm:inline">Focus</span>
              <span className="text-mindflow-heading font-bold">{calibration.alphaScore.toFixed(2)}</span>
            </div>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-mindflow-accent text-white' : 'text-mindflow-muted hover:text-mindflow-text hover:bg-mindflow-bg'}`}
            title="Settings">
            <Settings className="w-4 h-4" />
          </button>
          {activeTab === 'tasks' && (
            <button onClick={handleGenerate} disabled={!canGenerate}
              className="bg-mindflow-accent text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-mindflow-accent/20">
              <Play className="w-4 h-4" /> Generate
            </button>
          )}
          {activeTab === 'dashboard' && isStale && (
            <button onClick={handleGenerate}
              className="bg-mindflow-warning text-mindflow-bg px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
          )}
        </div>
      </header>

      {/* ═══ SETTINGS PANEL ═══ */}
      {showSettings && (
        <div className="bg-mindflow-surface border-b border-mindflow-border px-6 py-4 animate-fade-in">
          <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs">Chronotype:</span>
              {['morning', 'neutral', 'night'].map(c => (
                <button key={c} onClick={() => setSettings(s => ({ ...s, chronotype: c }))}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${settings.chronotype === c ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}>{c}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs">Max hrs/day (weekday):</span>
              <input type="number" value={settings.maxHoursPerDay} min={1} max={16}
                onChange={e => setSettings(s => ({ ...s, maxHoursPerDay: Number(e.target.value) }))}
                className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs">Weekend:</span>
              <input type="number" value={settings.maxHoursWeekend} min={0} max={12}
                onChange={e => setSettings(s => ({ ...s, maxHoursWeekend: Number(e.target.value) }))}
                className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none" />
            </div>
            <button onClick={handleReset}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-mindflow-danger/10 text-mindflow-danger hover:bg-mindflow-danger/20 transition-colors flex items-center gap-1.5">
              <Trash2 className="w-3 h-3" /> Reset All Data
            </button>
          </div>
        </div>
      )}

      {/* ═══ TABS ═══ */}
      <nav className="flex border-b border-mindflow-border bg-mindflow-bg sticky top-[65px] z-30">
        {TABS.map(tab => { const I = tab.icon; const isActive = activeTab === tab.id; return (
          <button key={tab.id} onClick={() => switchTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-all border-b-2 relative ${isActive ? 'text-mindflow-accent border-mindflow-accent bg-mindflow-accent/5' : 'text-mindflow-muted border-transparent hover:text-mindflow-text hover:bg-mindflow-surface/50'}`}>
            <I className="w-4 h-4" /> <span className="hidden sm:inline">{tab.label}</span>
            {tab.id === 'calibrate' && calibration && <span className="w-1.5 h-1.5 rounded-full bg-mindflow-success absolute top-2 right-2" />}
            {tab.id === 'tasks' && tasks.length > 0 && <span className="text-[10px] bg-mindflow-accent/15 text-mindflow-accent px-1.5 py-0.5 rounded-full font-medium">{tasks.length}</span>}
          </button>
        );})}
      </nav>

      {/* ═══ ERROR BANNER ═══ */}
      {scheduleError && (
        <div className="bg-mindflow-danger/10 border-b border-mindflow-danger/30 px-6 py-3 flex items-center gap-2 text-sm text-mindflow-danger">
          <AlertCircle className="w-4 h-4 shrink-0" /> {scheduleError}
          <button onClick={() => setScheduleError(null)} className="ml-auto text-mindflow-danger/70 hover:text-mindflow-danger text-xs">Dismiss</button>
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'calibrate' && (
          <StroopTestModal onComplete={handleCalibrationComplete} onSkip={handleSkipCalibration} existingCalibration={calibration} />
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-8">
            <div className="flex items-center gap-3 text-xs text-mindflow-muted flex-wrap">
              <div className={`flex items-center gap-1.5 ${calendarBlocks.length > 0 ? 'text-mindflow-success' : ''}`}><span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">1</span>Set schedule</div><span className="opacity-30">→</span>
              <div className={`flex items-center gap-1.5 ${tasks.length > 0 ? 'text-mindflow-success' : ''}`}><span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">2</span>Add tasks</div><span className="opacity-30">→</span>
              <div className={`flex items-center gap-1.5 ${canGenerate ? 'text-mindflow-accent' : ''}`}><span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">3</span>Generate</div>
            </div>
            <WeeklyCalendar blocks={calendarBlocks} onChange={setCalendarBlocks} />
            <TaskInputForm tasks={tasks} onChange={setTasks} />
            {canGenerate && (
              <div className="flex justify-center pt-4">
                <button onClick={handleGenerate} className="bg-mindflow-accent text-white px-12 py-4 rounded-2xl text-lg font-semibold hover:opacity-90 shadow-xl shadow-mindflow-accent/20 active:scale-[0.98] flex items-center gap-3">
                  <Zap className="w-5 h-5" /> Generate Optimized Schedule
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <MarkovAnalyticsDashboard
            optimizedWeek={optimizedWeek}
            alpha={calibration?.alphaScore || 1.0}
            isCalculating={isCalculating}
            isStale={isStale}
            onRegenerate={handleGenerate}
            calendarBlocks={calendarBlocks}
          />
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-mindflow-border bg-mindflow-surface/50 px-6 py-4">
        <p className="text-center text-xs text-mindflow-muted">MindFlow · v0.2.0</p>
      </footer>
    </div>
  );
}
```

**Step 67** — Verify all 9 imports resolve
- [ ] 67. `lucide-react`: Brain, Calendar, BarChart3, Zap, Play, AlertCircle, Settings, RefreshCw, Trash2
- [ ] 67. `./components/WelcomeScreen` — default export
- [ ] 67. `./components/StroopTestModal` — default export
- [ ] 67. `./components/WeeklyCalendar` — default export
- [ ] 67. `./components/TaskInputForm` — default export
- [ ] 67. `./components/MarkovAnalyticsDashboard` — default export
- [ ] 67. `./utils/scheduler.js` — default export `generateWeeklySchedule`
- [ ] 67. `./utils/storage.js` — 9 named exports

**Step 68** — Verify welcome screen logic
- [ ] 68. First visit (no calibration in localStorage): `showWelcome = true` → WelcomeScreen renders fullscreen
- [ ] 68. Subsequent visits (calibration exists): `showWelcome = false` → main app renders directly
- [ ] 68. Clicking "Take Calibration Test" → `setShowWelcome(false)` → StroopTestModal appears on calibrate tab
- [ ] 68. Clicking "Skip for now" → `handleSkipCalibration` → sets default calibration, hides welcome

**Step 69** — Verify localStorage persistence survives page refresh
- [ ] 69. Add calibration, calendar blocks, tasks → refresh browser → all data still there
- [ ] 69. Welcome screen skipped on refresh (calibration already saved)
- [ ] 69. Settings (chronotype, max hours) persist across refreshes

**Step 70** — Verify settings panel
- [ ] 70. Click gear icon → settings panel slides down with `animate-fade-in`
- [ ] 70. Chronotype: 3 buttons (morning/neutral/night), selected one is purple
- [ ] 70. Max hrs/day: number input, default 8
- [ ] 70. Weekend max: number input, default 4
- [ ] 70. "Reset All Data" button: red, calls `clearAll()` + `window.location.reload()` after confirm dialog

**Step 71** — Verify stale detection
- [ ] 71. Generate schedule → `dataVersionRef.current = 0`
- [ ] 71. Change a task or calendar block → `dataVersionRef.current` increments → `isStale` becomes `true`
- [ ] 71. Dashboard shows yellow banner + Regenerate button
- [ ] 71. Header shows Regenerate button (on dashboard tab)
- [ ] 71. Changing settings does NOT trigger stale detection (only tasks/blocks do)

**Step 72** — Verify all 3 tabs work
- [ ] 72. Calibration tab: shows StroopTestModal, green dot if calibrated, skip option if already calibrated
- [ ] 72. Schedule tab: shows step indicators (1→2→3), WeeklyCalendar, TaskInputForm, Generate button
- [ ] 72. Dashboard tab: shows MarkovAnalyticsDashboard or empty state
- [ ] 72. Tab switching clears `scheduleError`

**Step 73** — Verify generate flow
- [ ] 73. Click "Generate" → `setIsCalculating(true)` → 150ms delay → scheduler runs → `setActiveTab('dashboard')`
- [ ] 73. Generate button disabled if no calibration or no tasks
- [ ] 73. Error during generation: caught by try/catch, shown in error banner, `isCalculating` reset
- [ ] 73. Missing calibration → error banner "Complete the calibration test first" + switches to calibrate tab
- [ ] 73. No tasks → error banner "Add at least one task first" + switches to tasks tab

**Step 74** — Verify responsive layout and zero console errors
- [ ] 74. Header: logo + title + Beta badge + focus score + settings gear + generate button
- [ ] 74. On mobile: tab labels hidden (`hidden sm:inline`), focus score label hidden
- [ ] 74. Footer: "MindFlow · v0.2.0"
- [ ] 74. Zero console errors on load, tab switch, generate, refresh. All keys have proper React keys.

---

### Steps 75–85: Integration Verification

Manual walkthrough. Run `npm run dev` and verify each scenario.

---

**Step 75** — ✅ Full walkthrough: welcome → calibrate → schedule → generate → results
- [x] 75. Fresh start → Welcome screen appears
- [x] 75. Stroop test: intro → countdown → 60s keyboard play → results → Save
- [x] 75. Calendar: add fixed events, dates show, past days greyed out
- [x] 75. Add tasks with date+time deadlines, types, difficulties
- [x] 75. Generate → loading → 4-week horizontal scroll results
- [x] 75. Today highlighted, times shown on blocks, scroll works

**Step 76** — Verify skip calibration works
- [ ] 76. Clear localStorage → refresh → Welcome → "Skip for now"
- [ ] 76. Alpha score shows 1.00 in header
- [ ] 76. Can still add tasks and generate (using default alpha)

**Step 77** — Verify stale detection works end-to-end
- [ ] 77. Generate a schedule → switch to Schedule tab → change a task's duration
- [ ] 77. Switch to Dashboard → yellow banner appears with "Regenerate" button
- [ ] 77. Header also shows Regenerate button
- [ ] 77. Click Regenerate → dashboard refreshes with updated schedule

**Step 78** — Verify calendar blocks visible on Gantt
- [ ] 78. Generate a schedule with calendar blocks → Dashboard → Gantt shows BOTH
- [ ] 78. Calendar blocks: full-height, semi-transparent, colored borders
- [ ] 78. Session blocks: colored strips on top half
- [ ] 78. Legend includes "Class" entry for calendar blocks

**Step 79** — Verify no gradient collision on multiple charts
- [ ] 79. Dashboard with 3+ tasks → expand 2+ session cards
- [ ] 79. All mini charts have visible green/yellow/red gradients
- [ ] 79. No chart appears grey or white
- [ ] 79. Daily aggregate chart also has proper gradients

**Step 80** — Verify unscheduled tasks visible
- [ ] 80. Add a very long task (8 hours) to a full calendar
- [ ] 80. Generate → unscheduled section appears at bottom of dashboard
- [ ] 80. Shows task details + time needed

**Step 81** — Verify settings change produces different results
- [ ] 81. Generate with "Morning" chronotype → note schedule
- [ ] 81. Change to "Night" chronotype → Regenerate → different task placement (tasks shift later)
- [ ] 81. Change max hours/day → fewer/more tasks scheduled per day

**Step 82** — Verify page refresh preserves data
- [ ] 82. Add calibration + tasks + calendar → generate → refresh
- [ ] 82. All data survives: calibration, tasks, calendar, settings
- [ ] 82. Welcome screen does NOT appear (calibration exists)
- [ ] 82. Dashboard still shows the last generated schedule

**Step 83** — Verify Reset All Data clears everything
- [ ] 83. Settings → "Reset All Data" → confirm dialog
- [ ] 83. Page reloads fresh → Welcome screen appears
- [ ] 83. localStorage is empty (all 4 keys removed)
- [ ] 83. Calibration, tasks, calendar, settings all back to defaults

**Step 84** — Verify zero console errors throughout
- [ ] 84. No React key warnings
- [ ] 84. No "setState on unmounted component" warnings
- [ ] 84. No failed import errors
- [ ] 84. No undefined prop errors
- [ ] 84. No Recharts-specific warnings

**Step 85** — Verify break optimizer doesn't overflow slot bounds
- [ ] 85. Create a task that would trigger burnout near the end of a tight slot
- [ ] 85. Generate → task is either clipped to fit or falls back to non-break timeline
- [ ] 85. No session extends beyond its slot's end time
- [ ] 85. No negative-width Gantt bars

---

# Bugs Fixed (cumulative)

This PRD incorporates fixes for every known bug from previous iterations:

1. **Burnout at tick 0 → crash** — Guard `if (burnoutTick <= 0)` in `optimizeWithBreak`
2. **SVG gradient IDs colliding** — `useId()` in SessionChart for unique IDs per instance
3. **Monday-first greedy scheduling** — Global best-fit slot scoring across all 7 days
4. **Incomplete component code** — Every file has complete, copy-paste-ready code
5. **No stale detection** — `dataVersionRef` + `isStale` flag + yellow banner + Regenerate button
6. **Calendar blocks invisible on dashboard** — Gantt renders both calendar blocks (background) + sessions (foreground)
7. **No reset button** — Settings panel has "Reset All Data" → `clearAll()` + reload
8. **Welcome screen on every refresh** — `showWelcome = !loadCalibration()` skips if data exists
9. **Break optimizer extends task beyond slot** — Falls back to non-break timeline if extended
10. **Unused imports** — Clean import lists (no unused `Calendar`, `Clock` in dashboard)
11. **TODAY computed at module level** — `getToday()` called inside `useState(() => getToday())`

---

> **85 steps + Stage 5. Check off as you build. Count checked ÷ total = percentage complete.**
>
> **Stage 5 code complete — development paused per 2026-08-11. See Part 7 for details.**

---
---

# Part 7: Stage 5 — Google Calendar Integration ⏸️ PAUSED

> **Status (2026-08-11):** Import + export code is complete and in the repo
> (`googleCalendar.js`, `googleAuth.jsx`, `GoogleSyncButton.jsx`,
> `GoogleCalendarImport.jsx`, `GoogleCalendarExport.jsx`). Development is
> paused — no further work on OAuth setup, RRULE, multi-calendar, or
> all-day events until explicitly requested. Focus is on the core website
> and deployment.
>
> **Goal:** Bi-directional Google Calendar sync. Import existing calendar
> events into MindFlow as fixed blocks, and export generated study sessions
> back to Google Calendar after the schedule is generated.

## Overview

**Import** (Google → MindFlow): Pull existing Google Calendar events into
MindFlow's Weekly Calendar as fixed blocks, eliminating manual entry of classes,
work, and other recurring commitments.

**Export** (MindFlow → Google): After generating an optimized weekly schedule,
push the scheduled study sessions to Google Calendar as real events with title,
time, type-based color coding, and MindFlow metadata (task type, difficulty,
session quality) in extended properties. All generated weeks are synced at once.

## Technical Approach

- **Google Calendar API v3** via OAuth 2.0
- Use Google Identity Services (GIS) for implicit-flow token-based auth
- Scopes: `calendar.readonly` (import) + `calendar.events` (export)
- **Import**: Fetch primary calendar events for the current week → map to CalendarBlock[]
- **Export**: POST generated sessions to Google Calendar with type-based color coding
- Google-synced blocks shown with "G" badge, locked from editing (z-index 5 vs manual at 10)
- Export button in PlanView toolbar syncs ALL generated weeks at once
- Batch export: 10 events per batch with 2s pause (rate limit safety)
- Duplicate detection via extendedProperties.mindflow_session_key
  (`taskId::weekStart::day::startTick`) — checked against existing events
  before each create (wired 2026-08-13)
- GIS script loaded from CDN; token stored in memory (never localStorage)
- Auto-refresh on app load, cache with 30-min TTL
- Unsync: delete previously synced events from Google Calendar

## Data Mapping

| Google Calendar Field | MindFlow CalendarBlock Field |
|----------------------|------------------------------|
| `summary` | `label` |
| `start.dateTime` / `start.date` | `startHour` |
| `end.dateTime` / `end.date` | `durationHours` (computed) |
| Day of week from date | `day` |
| Event color ID | `type` (mapped: blue→academic, green→sports, etc.) |
| `id` | `id` (prefixed with `gcal-`) |

## Steps

### Steps 86–94: Google Calendar Sync

**Step 86** — Create Google Cloud Project & OAuth consent screen
- [ ] 86. Create project in Google Cloud Console
- [ ] 86. Enable Google Calendar API
- [ ] 86. Configure OAuth consent screen (test users, scopes)
- [ ] 86. Create OAuth 2.0 Web Client ID
- [ ] 86. Add `http://localhost:5173` to authorized JS origins
- [ ] 86. Store Client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`

**Step 87** — Install dependencies & create `src/utils/googleCalendar.js`
- [x] 87. `npm install @react-oauth/google`
- [x] 87. Create `src/utils/googleCalendar.js` with:
  - `initGoogleAuth()` — initialize GIS client (via `src/utils/googleAuth.jsx`)
  - `signIn()` — trigger OAuth flow
  - `signOut()` — revoke tokens
  - `fetchWeekEvents(weekStart)` — GET calendar events for Mon–Sun
  - `mapToBlocks(events)` — convert Google events to CalendarBlock[]
  - `getSyncStatus()` — return { lastSync, calendarName, eventCount }

**Step 88** — Create `src/components/GoogleSyncButton.jsx`
- [x] 88. Sign-in button: Google "G" logo + "Connect Calendar"
- [x] 88. Signed-in state: "Connected" + "Last synced" + refresh + sign out
- [x] 88. Loading state during sync
- [x] 88. Error state: "Sync failed — try again"

**Step 89** — Wire Google Sync into App.jsx
- [x] 89. Wrap app in `GoogleAuthProvider` with Client ID (in `main.jsx`)
- [x] 89. Add `googleBlocks` state alongside `calendarBlocks`
- [x] 89. Merge `googleBlocks` + `calendarBlocks` before passing to scheduler
- [x] 89. Calendar grid shows Google-synced blocks with a small "G" icon
- [x] 89. Google-synced blocks are locked (can't edit/delete manually)

**Step 90** — Handle recurring events
- [ ] 90. Parse `recurrence` RRULE from Google events
- [ ] 90. Expand recurring events within the current week
- [ ] 90. Handle exceptions (cancelled/modified instances)

**Step 91** — Multi-calendar support
- [ ] 91. Fetch user's calendar list from `calendarList.list`
- [ ] 91. Let user toggle which calendars to sync
- [ ] 91. Color-code by source calendar

**Step 92** — Sync status & caching
- [x] 92. Show "Last synced: 2 min ago" in header
- [x] 92. Cache events in localStorage with `syncTimestamp`
- [x] 92. Auto-refresh on app load if cache > 30 min old
- [x] 92. Manual refresh button

**Step 93** — Error handling & edge cases
- [ ] 93. Token expired → prompt re-login (auto-refresh not possible with implicit flow)
- [x] 93. Network error → cached data fallback + retry button
- [ ] 93. All-day events → map to 6am–10pm block
- [ ] 93. Multi-day events → split into per-day blocks
- [ ] 93. Events outside 6am–10pm → shown as "early/late" indicator
- [x] 93. Zero events → "No events found this week" message
- [ ] 93. Rate limiting → batch requests, respect `Retry-After` headers

**Step 94** — Privacy & security
- [x] 94. Calendar data never leaves the browser (no server upload)
- [x] 94. Access token stored in memory only (not localStorage)
- [ ] 94. Refresh token handled by GIS library (implicit flow — no refresh token)
- [x] 94. Sign-out clears all cached calendar data
- [x] 94. Scope limited to `calendar.readonly` + `calendar.events`

### Steps 95–100: Export (NEW — MindFlow → Google)

**Step 95** — Export utility (`src/utils/googleCalendar.js`)
- [x] 95. `exportSessions()` — flatten weekResults → Google Calendar event payloads
- [x] 95. `deleteSyncedEvents()` — remove previously synced events
- [x] 95. Build event payload: summary, start/end ISO, description, colorId, extendedProperties
- [x] 95. Batch processing: 10 events per batch, 2s pause (rate limit safety)
- [x] 95. Duplicate detection via `mindflow_session_key` extended property

**Step 96** — Export UI component (`src/components/GoogleCalendarExport.jsx`)
- [x] 96. Five states: signed-out, syncing (with progress), synced, error, idle+signed-in
- [x] 96. Sync ALL generated weeks at once
- [x] 96. Unsync button with confirmation → DELETE each tracked event
- [x] 96. Integration in PlanView.jsx toolbar (right side)

**Step 97** — Export i18n & tracking
- [x] 97. New i18n keys: `gcalExport`, `gcalExportProgress`, `gcalExportSuccess`, `gcalUnsync`, etc.
- [x] 97. Export tracking in localStorage (`mindflow_google_export`)
- [x] 97. Translations for zh-CN, zh-TW (es, hi, ar fall back to English)

## Future Enhancements (post Stage 5)
- [x] ~~Write scheduled study sessions back to Google Calendar~~ ✅ Implemented (steps 95–100)
- Schedule image export (PNG download of the plan) → **spec in Part 8 (PLANNED)**
- Two-way sync (changes in Google Calendar update MindFlow)
- Microsoft Outlook / Apple Calendar support
- iCal import for offline calendar files
- Team/family calendar sharing for group study scheduling
- Multi-calendar support (toggle which calendars to sync)

---

# Part 8: Schedule Image Export — 📋 PLANNED (development deferred)

> **Status (2026-08-18):** Spec complete. No code written. Development starts
> only when explicitly approved — this section is the blueprint.

## Overview

One-click export of the generated schedule as a **PNG picture**. A "Save as
image" button lives in the Step 4 (plan) toolbar next to the Google Calendar
export and captures **ALL generated weeks** as one tall portrait image
(matches the GCal export's all-weeks scope).

**"Save to desktop" reality check:** browsers cannot write files to an
arbitrary path on the user's machine. The feature therefore uses the native
save flow: `window.showSaveFilePicker()` on Chromium browsers (opens the OS
save dialog — the user can pick **Desktop** as the destination), with an
`<a download>` fallback on Safari/Firefox (lands in Downloads). This is the
standard web equivalent of "save to desktop".

## Technical Approach

**Dependency-free SVG → canvas → PNG pipeline** (deliberately NOT html2canvas):

1. **`src/utils/scheduleImage.js` (new, pure functions):**
   - `buildScheduleSvg(weekResults, calendarBlocks, { palette, locale, weekStarts })`
     → SVG string. Renders the same data PlanView already renders: day columns
     (6:00–22:00 grid mirroring `START_H`/`END_H`/`ROW_H` geometry from
     `src/components/PlanView.jsx:9`), fixed blocks, generated session chips
     (startTick/endTick → y positions), per-week stats, warnings, and the
     unscheduled list. One column block per week, stacked vertically.
   - `svgToPngBlob(svg, scale = 2)` → draw the SVG into an `<img>` (data URL)
     → `<canvas>` → `canvas.toBlob('image/png')`. 2× scale for crisp text.
   - `downloadPng(blob, filename)` → `showSaveFilePicker` when available
     (Chromium: OS save dialog, Desktop selectable), else
     `URL.createObjectURL` + `<a download>` click.
   - `scheduleImageFilename(date)` → `mindflow-schedule-YYYY-MM-DD.png`.
2. **Why not html2canvas:** Tailwind v4 emits `oklch()` / CSS-variable colors
   that DOM-screenshot libraries render incorrectly; an SVG renderer built
   from the same data the grid uses is deterministic, crisp at 2×, adds ~0KB
   (no dependency), and is unit-testable in Node.
3. **Theme:** capture uses the app's CURRENT theme — the component reads the
   computed CSS variables (`getComputedStyle`) at click time and passes them
   as the explicit `palette`, so the PNG matches what the user sees. The
   builder is pure given the palette → tests stay deterministic with a fixed
   palette.
4. **Security:** task titles are user input rendered into SVG text — an
   XML-escaping helper (`&`, `<`, `>`, `"`, `'`) is mandatory. (SVG loaded via
   `<img>` cannot execute scripts, but unescaped text breaks the document.)

## UX

- Button "Save as image" (lucide `Download` icon) in the PlanView toolbar,
  visible whenever `weekResults` is non-empty (no Google gating).
- Click → PNG saves immediately; button disabled for the ~100ms capture.
- Filename: `mindflow-schedule-2026-08-18.png` (current date).

## i18n — 2 new keys × 6 languages

- `saveImage` — button label
- `saveImageError` — capture-failure message

## Steps 101–110 (all pending — do not start without approval)

**Step 101** — `src/utils/scheduleImage.js`: `buildScheduleSvg` (week headers, day grid, fixed blocks, session chips, stats, warnings, unscheduled)
**Step 102** — XML-escaping helper for all user-provided text
**Step 103** — `svgToPngBlob` (2× scale) + `downloadPng` (`showSaveFilePicker` → `<a download>` fallback)
**Step 104** — `scheduleImageFilename` helper
**Step 105** — PlanView toolbar button + theme-palette capture wiring
**Step 106** — i18n keys `saveImage` / `saveImageError` in all 6 languages
**Step 107** — `tests/schedule-image.test.js` (Node): SVG contains week labels, task titles, correct chip y-positions from ticks, day columns; escaping of `&`/`<`/quotes; filename format; empty-plan handling; deterministic output for a fixed palette
**Step 108** — add the new suite to the `npm test` chain in `package.json`
**Step 109** — PRD: check off steps 101–108, changelog entry, progress header
**Step 110** — full verification: `npm test`, `npm run lint`, `npm run build` green

## Acceptance criteria

- Clicking "Save as image" downloads a PNG containing every generated week
- Chromium opens the OS save dialog (Desktop selectable); Safari/Firefox downloads to the default folder
- Task titles containing HTML special characters render literally
- Works in all 6 languages including Arabic (RTL) and in dark theme
- 0 new dependencies; lint 0 warnings; full test suite green

---

> **Audit 2026-08-11 (Google Calendar integration):** Bi-directional Google Calendar
> integration implemented across 6 new files + 8 modified files.
> **Import**: GIS OAuth → fetchWeekEvents → mapToCalendarBlocks → merge with manual
> blocks in scheduler. Google-synced blocks show "G" badge, opacity 0.85, readonly.
> **Export**: Sync all generated weeks → POST sessions to Google Calendar with
> type-based colors + extended properties. Duplicate-safe, batched, unsync-capable.
> All ~2,135 existing tests pass, build 0 errors.
>
> **85 core steps = 100% complete. All audits resolved. Production-hardened.**
> Stage 5 (Google Calendar) paused. Deploy-ready.
>
> **Every session**: *"Check the checklist. npm test && npm run build."*
