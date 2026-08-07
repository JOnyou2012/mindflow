# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students (and self-directed learners) planning a study week. They arrive with a
fixed weekly timetable (classes, sports, clubs) and a pile of assignments with
deadlines, and want to know *when* to work on what without burning out.

## Product Purpose

MindFlow predicts mental burnout and builds an optimized weekly study schedule.
It models the user's cognitive state as a 4-state Markov chain
(Flow → Distracted → Fatigue → Recovery), personalized by a Stroop-test
calibration score (α), task difficulty (β), and time-of-day × chronotype (γ).
Success = the user gets a realistic week plan where hard tasks land when they
are freshest and breaks appear before burnout — and can iterate on it.

## Positioning

Unlike Pomodoro timers (same 25/5 split for everyone) or plain calendar apps
(manual planning), MindFlow simulates the user's actual cognitive trajectory
per session and auto-inserts recovery breaks at predicted burnout points.

## Operating Context

Runs entirely in the browser; all data persists to localStorage. Typical
session: calibrate (or skip) → enter fixed weekly commitments → enter tasks
with difficulty/duration/deadline/priority → generate → review a multi-week
calendar → tweak and regenerate. Used repeatedly as the week evolves.

## Capabilities and Constraints

- React 19 + Vite 8 + Tailwind CSS v4 + Recharts + Lucide. Pure JS frontend,
  no backend on the primary path (`backend/` FastAPI exists but is stale/secondary).
- Scheduler: multi-week cascade (up to 8 weeks), deadline-aware week targeting,
  daily hour caps (weekday/weekend), 30-min gaps, auto-split of large tasks,
  warnings + preflight analysis, per-session quality metrics, unscheduled list.
- Stroop calibration: 60-second keyboard test → α score (skip → α = 1.0).
- i18n: 6 languages (EN/ZH-CN/ZH-TW/ES/HI/AR), per-key English fallback,
  persisted language choice. New UI strings must be translated in all 6.
- Theme: light mode is the primary/default experience; dark mode remains as a
  settings toggle.
- Data contracts: Task, CalendarBlock, UserCalibration, UserSettings,
  OptimizedWeek as defined in PRD.md Part 5.

## Brand Commitments

- Name: **MindFlow**. Brain icon as the logo mark.
- Visual direction (user-pinned for the revamp): Google Calendar / Apple-like,
  light mode first, "human-coded" appearance — no vibecoded aesthetics
  (no glow effects, no heavy gradients, no glassmorphism, no decorative serif
  wordmarks).

## Evidence on Hand

- PRD.md — master spec incl. math model (Part 3) and data contracts (Part 5).
- Working scheduler + engine with ~1,970 tests in `tests/`.
- No testimonials, users, or external proof assets; do not fabricate any.

## Product Principles

1. **Guide, don't dump.** The setup flow is a step-by-step wizard
   (Calibrate → Schedule → Tasks → Results), one phase per page; the user
   should always know where they are and what's next.
2. **The calendar is the product.** Results live in a familiar,
   Google Calendar-style week view; everything else supports getting there.
3. **Legibility over decoration.** Light, quiet, system-feeling UI; ornament
   only where it aids comprehension.
4. **Model honesty.** Show warnings, unscheduled tasks, and quality stats
   plainly instead of hiding scheduling failures.
