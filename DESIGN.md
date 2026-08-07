# Design

<!-- Recorded from the built world after the 2026-08-07 revamp. Direction: CANON — Google Calendar, user-pinned; craft bar is Google/Apple production UI. -->

## World

Google Calendar, played straight. A study planner that reads like the calendar
students already live in. Light mode is the default and primary experience;
dark mode is a secondary theme in Google's dark register (`html.dark`).
No gradients, glass, glow, serif display faces, or decorative color — ornament
only where it aids comprehension.

## Structure

Single-page wizard, one phase per page, driven by `src/App.jsx`:

1. **Calibrate** — Stroop focus test (`StroopTestModal.jsx`, inline)
2. **Schedule** — fixed weekly commitments (`WeeklyCalendar.jsx`)
3. **Tasks** — task entry (`TaskInputForm.jsx`)
4. **Your plan** — generated week view (`PlanView.jsx`), gated until generated

App bar: 56px, hairline bottom border, product mark (blue rounded square +
Brain icon) + wordmark left, settings gear right. Below it a 4-step stepper
(numbered circles, filled blue check when complete, connector lines).
Settings is a centered dialog. Step footers carry Back (text pill) /
Continue / Generate (primary pill).

## Color

Light tokens (`@theme` in `src/index.css`); dark overrides under `html.dark`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `mindflow-bg` / `surface` | `#ffffff` | `#131314` / `#1e1f20` | page, cards |
| `mindflow-surface-alt` | `#f8f9fa` | `#2d2e30` | wells, hover fills |
| `mindflow-border` / `-light` | `#dadce0` / `#e8eaed` | `#3c4043` / `#2f3133` | hairlines only |
| `mindflow-text` / `heading` / `muted` | `#3c4043` / `#202124` / `#5f6368` | `#c9cbce` / `#e8eaed` / `#9aa0a6` | type |
| `mindflow-accent` | `#1a73e8` | `#a8c7fa` | primary actions, today, stepper |
| `mindflow-accent-soft` | `#e8f0fe` | `#004a77` | selected fills, hover on text buttons |
| `mindflow-onaccent` | `#ffffff` | `#062e6f` | text on accent |
| success / warning / danger | `#188038` / `#e37400` / `#d93025` | `#81c995` / `#fdd663` / `#f28b82` | semantic |

Event/type colors live in `src/utils/theme.js` (single source of truth):
TYPE_COLORS (solid fills with white text): academic `#039be5`, sports `#0b8043`,
arts `#8e24aa`, other `#616161`. PRIORITY_COLORS: high `#d93025`, medium
`#e37400`, low `#616161`. For colored text on light surfaces use the
theme-aware `*-TEXT_COLORS` (CSS vars `--type-*-text`, `--priority-*-text`
in index.css, brightened under `html.dark`).

## Type & shape

- Font: Roboto (Google Fonts) → system stack. Headings `font-normal`/`font-medium`,
  no display face. Stats and time gutter use `tabular-nums`.
- Radius: cards `rounded-xl` (12px), inputs/buttons `rounded-lg` (8px),
  event chips `rounded-md` (6px), CTAs/text buttons `rounded-full` pills.
- Elevation: hairline borders everywhere; `shadow-xl` only on dialogs;
  `shadow-sm` only on primary pills.
- Buttons: primary `bg-mindflow-accent text-mindflow-onaccent rounded-full`;
  text button `text-mindflow-accent hover:bg-mindflow-accent-soft`; outlined
  `border-mindflow-border hover:bg-mindflow-surface-alt`.
- Inputs: `bg-mindflow-bg border-mindflow-border rounded-lg`, accent focus ring.

## Calendar grammar (PlanView + WeeklyCalendar)

- One horizontal scroll container wraps day headers + grid body so they share
  geometry (min-width 826/896px; columns `min-w-[110px]`, gutter `w-14`).
- Day headers: uppercase 11px day name + date number in a 28px circle;
  today = filled accent circle + accent day name; past days at 45% opacity.
- Fixed commitments: solid type-color chips, white label + time subline.
- Generated study sessions: tinted chips (color at 12% + 1px color border,
  darker `--type-*-text` label). Legend in the toolbar explains both.
- Stats render as one hairline-divided strip (`gap-px bg-mindflow-border`
  cells), never as nested cards.

## Motion & states

One modest fade (`animate-fade-in`, 0.2s) plus 0.15s color transitions on
interactives. Every control keeps hover/disabled/focus-visible states;
focus ring is 2px accent. Selection, scrollbars, and placeholders are themed.

## Question flows (microinteractions)

Data entry inside steps 2–3 never shows a form: each question owns the screen
via `src/components/QuestionFlow.jsx` — centered question (text-2xl/3xl), one
control, thin accent progress bar, back chevron. Advancing slides the next
question in fast (`animate-stage-in-right`, 0.22s `cubic-bezier(0.2,0.9,0.25,1)`;
`-left` when going back). Single-choice stages (type, priority, difficulty)
auto-advance on selection; text/number/date stages advance on Enter or the
Continue pill; optional stages offer a Skip pill. Completing a flow lands on a
quiet "Add another?" decision screen. While a flow or decision screen is
active the wizard footer hides (components report via `onViewChange`).
The calendar grid and the plan page stay full — density lives there only.

## Dead code removed in the revamp

`WelcomeScreen.jsx`, `MarkovAnalyticsDashboard.jsx`, `SessionChart.jsx`
(unused; contained the old dark/glow visual world). Results are intentionally
recomputed per session (localStorage persists inputs, not generated plans).
