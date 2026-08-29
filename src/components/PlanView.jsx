import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, CalendarX2, Download } from 'lucide-react';
import { typeColor, typeTextColor } from '../utils/theme.js';
import { getStoredLang, langToLocale, getDayShortNames } from '../utils/i18n.js';
import { isGoogleConfigured } from '../utils/googleAuthCore.js';
import { buildScheduleSvg, svgToPngBlob, downloadPng, scheduleImageFilename } from '../utils/scheduleImage.js';
import GoogleCalendarExport from './GoogleCalendarExport.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const START_H = 6, END_H = 22, TOTAL_H = END_H - START_H, ROW_H = 48;
const HOUR_LINES = Array.from({ length: TOTAL_H + 1 }, (_, i) => i);

function fmtHr(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const loc = langToLocale(getStoredLang());
  const d = new Date(2026, 0, 1, hh, mm);
  if (mm > 0) {
    return d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleTimeString(loc, { hour: 'numeric' });
}

function weekLabel(ws) {
  const [y, m, d] = ws.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const loc = langToLocale(getStoredLang());
  const s = start.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString(loc, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${s} – ${e}, ${end.getFullYear()}`;
}

function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function dayInfo(ws, dayName) {
  const [y, m, d] = ws.split('-').map(Number);
  const date = new Date(y, m - 1, d + DAYS.indexOf(dayName));
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { dateNum: date.getDate(), isToday: iso === todayIso(), isPast: iso < todayIso() };
}

/**
 * Results page — Google Calendar-style week view of the generated plan.
 * One week at a time with prev/next navigation across past and future weeks.
 * Fixed commitments render as solid chips, generated study sessions as tinted,
 * bordered chips. Weeks without generated results still show the calendar grid.
 */
export default function PlanView({ weekResults, calendarBlocks, googleBlocks = [], tasks = [], isStale, isCalculating, genProgress, onRegenerate, planVersion, T }) {
  // Build all navigable weeks: 2 weeks before today through 8 weeks after.
  // Computed per render (no memo) — it's cheap O(11) date math, and
  // recomputing keeps "today" correct across midnight while the app is open,
  // without relying on memo dependencies to refresh stale values.
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const allWeeks = [];
  for (let i = -2; i <= 8; i++) {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i * 7);
    allWeeks.push(
      d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  // Today's week index (for the Today button)
  const todayWs =
    mon.getFullYear() + '-' +
    String(mon.getMonth() + 1).padStart(2, '0') + '-' +
    String(mon.getDate()).padStart(2, '0');
  const todayIdx = allWeeks.indexOf(todayWs) >= 0 ? allWeeks.indexOf(todayWs) : 2;

  // Default to the first week that actually has scheduled sessions.
  // If every week is empty (all tasks unscheduled), fall back to the
  // first week with any result, then to today's week.
  const firstWithSessions = allWeeks.findIndex(ws => {
    const r = weekResults[ws];
    if (!r?.days) return false;
    return Object.values(r.days).some(d => d.sessions?.length > 0);
  });
  const defaultIdx = firstWithSessions >= 0
    ? firstWithSessions
    : (allWeeks.findIndex(ws => weekResults[ws]) >= 0
      ? allWeeks.findIndex(ws => weekResults[ws])
      : todayIdx);

  const [selIdx, setSelIdx] = useState(defaultIdx);
  // Re-sync when results change (e.g. async regeneration) — the default week
  // may shift to the first week with scheduled sessions
  useEffect(() => { setSelIdx(defaultIdx); }, [defaultIdx]);

  // ── Schedule image export ──
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // A regenerated plan means a previously failed export no longer reflects
  // the current data — drop any stale failure message (mirrors the GCal
  // widget, which resets its status on planVersion change).
  useEffect(() => { setSaveError(null); }, [planVersion]);

  const handleSaveImage = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      // Capture the app's CURRENT theme — the SVG must match what the user
      // sees, so the builder gets the live CSS variables as an explicit
      // palette (which also keeps it pure/deterministic for tests).
      const styles = getComputedStyle(document.documentElement);
      const read = (name, fallback) => (styles.getPropertyValue(name) || '').trim() || fallback;
      const palette = {
        bg: read('--color-mindflow-bg', '#ffffff'),
        surface: read('--color-mindflow-surface', '#ffffff'),
        surfaceAlt: read('--color-mindflow-surface-alt', '#f8f9fa'),
        border: read('--color-mindflow-border', '#dadce0'),
        borderLight: read('--color-mindflow-border-light', '#e8eaed'),
        text: read('--color-mindflow-text', '#3c4043'),
        heading: read('--color-mindflow-heading', '#202124'),
        muted: read('--color-mindflow-muted', '#5f6368'),
        accent: read('--color-mindflow-accent', '#1669d4'),
        accentSoft: read('--color-mindflow-accent-soft', '#e8f0fe'),
        onAccent: read('--color-mindflow-onaccent', '#ffffff'),
        warning: read('--color-mindflow-warning', '#c26400'),
        danger: read('--color-mindflow-danger', '#d93025'),
        typeText: {
          academic: read('--type-academic-text', '#0277bd'),
          sports: read('--type-sports-text', '#0b8043'),
          arts: read('--type-arts-text', '#7b1fa2'),
          other: read('--type-other-text', '#5f6368'),
        },
      };
      const svg = buildScheduleSvg(weekResults, calendarBlocks, {
        palette,
        locale: langToLocale(getStoredLang()),
        labels: T,
        today: todayIso(),
      });
      const blob = await svgToPngBlob(svg, 2);
      await downloadPng(blob, scheduleImageFilename(new Date()));
    } catch (err) {
      console.error('Schedule image export failed:', err);
      setSaveError(T.saveImageError || 'Could not save the image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  const idx = Math.max(0, Math.min(selIdx, allWeeks.length - 1));
  const ws = allWeeks[idx];
  const result = weekResults[ws] || null;
  const isEmpty = !result || (result.days && Object.values(result.days).every(d => !d.sessions || d.sessions.length === 0));

  const stats = result?.stats;
  const statCells = stats ? [
    [(stats.totalScheduledHours != null ? stats.totalScheduledHours + T.unitHoursShort : '—'), T.scheduled],
    [(stats.utilizationPct != null ? stats.utilizationPct + '%' : '—'), T.capacity],
    [(stats.workloadBalance != null ? stats.workloadBalance + '%' : '—'), T.balance],
    [((stats.avgFatigue != null ? stats.avgFatigue : 0) + '%'), T.avgFatigue],
  ] : [];

  // Locale-correct weekday labels; internal day keys stay English ('Mon'…'Sun').
  // Recomputes on every render (cheap 7-item Intl map) so a language switch
  // via Settings is reflected immediately.
  const dayNames = getDayShortNames(getStoredLang());

  return (
    <div className="space-y-4">
      {/* Stale banner */}
      {isStale && (
        <div className="flex items-center gap-3 rounded-lg border border-mindflow-warning/40 bg-mindflow-warning/10 px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-mindflow-warning shrink-0" />
          <p className="text-sm text-mindflow-text flex-1">{T.scheduleChanged}</p>
          {isCalculating ? (
            <div className="flex items-center gap-2" role="status">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={genProgress}
                aria-label={T.generating}
                className="w-32 h-1.5 rounded-full bg-mindflow-surface-alt overflow-hidden"
              >
                <div className="h-full rounded-full bg-mindflow-accent" style={{ width: genProgress + '%' }} />
              </div>
              <span className="text-xs text-mindflow-muted tabular-nums">{genProgress}%</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1.5 rounded-full bg-mindflow-accent px-4 py-1.5 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover"
            >
              <RefreshCw className="w-3.5 h-3.5" />{T.regen}
            </button>
          )}
        </div>
      )}

      {/* Toolbar — Today / prev / next / range + legend */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSelIdx(todayIdx)}
          className="rounded-full border border-mindflow-border px-4 py-1.5 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt"
        >
          {T.today}
        </button>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setSelIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label={T.ariaPrevWeek || 'Previous week'}
            className="rounded-full p-1.5 text-mindflow-muted hover:bg-mindflow-surface-alt disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setSelIdx(i => Math.min(allWeeks.length - 1, i + 1))}
            disabled={idx >= allWeeks.length - 1}
            aria-label={T.ariaNextWeek || 'Next week'}
            className="rounded-full p-1.5 text-mindflow-muted hover:bg-mindflow-surface-alt disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <h2 className="text-lg text-mindflow-heading font-normal">{weekLabel(ws)}</h2>

        <div className="ml-auto flex items-center gap-3">
          {/* Image export needs no Google config — always available with a plan */}
          {Object.keys(weekResults).length > 0 && (
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={isSaving}
              className="rounded-full border border-mindflow-border px-4 py-1.5 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />{T.saveImage}
            </button>
          )}
          {isGoogleConfigured && Object.keys(weekResults).length > 0 && (
            <GoogleCalendarExport weekResults={weekResults} planVersion={planVersion} tasks={tasks} T={T} />
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-mindflow-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[3px]" style={{ backgroundColor: typeColor('academic') }} />
            {T.planLegendFixed}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[3px] border" style={{ backgroundColor: typeColor('academic') + '1f', borderColor: typeColor('academic') }} />
            {T.planLegendSession}
          </span>
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-mindflow-danger">{saveError}</p>
      )}

      {/* Stats */}
      {statCells.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-mindflow-border bg-mindflow-border">
          {statCells.map(([val, label], i) => (
            <div key={i} className="bg-mindflow-surface px-4 py-3">
              <p className="text-xl font-medium text-mindflow-heading tabular-nums">{val}</p>
              <p className="text-xs text-mindflow-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty week notice — no sessions scheduled for this week */}
      {isEmpty && (
        <div className="flex items-center gap-3 rounded-lg border border-mindflow-border bg-mindflow-surface-alt px-4 py-3">
          <CalendarX2 className="w-4 h-4 shrink-0 text-mindflow-muted" />
          <p className="text-sm text-mindflow-muted">{T.noSessionsThisWeek || 'No study sessions scheduled for this week.'}</p>
        </div>
      )}

      {/* Warnings */}
      {result?.warnings?.length > 0 && (
        <div className="space-y-1.5">
          {result.warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
              w.severity === 'high' ? 'bg-mindflow-danger/10 text-mindflow-danger' :
              w.severity === 'medium' ? 'bg-mindflow-warning/10 text-mindflow-warning' :
              'bg-mindflow-surface-alt text-mindflow-muted'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{w.message}{w.detail ? ` — ${w.detail}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Week grid — single scroll container so headers and columns share geometry */}
      <div className="overflow-hidden rounded-xl border border-mindflow-border bg-mindflow-surface">
        <div className="calendar-grid overflow-x-auto">
          <div style={{ minWidth: '826px' }}>
            {/* Day headers */}
            <div className="flex border-b border-mindflow-border">
              <div className="w-14 shrink-0" />
              {DAYS.map(d => {
                const { dateNum, isToday, isPast } = dayInfo(ws, d);
                return (
                  <div key={d} className={`flex-1 min-w-[110px] border-s border-mindflow-border-light py-2 text-center ${isPast ? 'opacity-45' : ''}`}>
                    <p className={`text-[11px] font-medium uppercase tracking-wide ${isToday ? 'text-mindflow-accent' : 'text-mindflow-muted'}`}>{dayNames[d] || d}</p>
                    <p className="mt-0.5">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                        isToday ? 'bg-mindflow-accent font-medium text-mindflow-onaccent' : 'text-mindflow-heading'
                      }`}>{dateNum}</span>
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Grid body */}
            <div className="flex">
          {/* Time gutter */}
          <div className="relative w-14 shrink-0" style={{ height: TOTAL_H * ROW_H + 'px' }}>
            {HOUR_LINES.slice(1).map(i => (
              <span key={i} className="absolute right-2 -translate-y-1/2 text-[10px] text-mindflow-muted tabular-nums" style={{ top: i * ROW_H + 'px' }}>
                {fmtHr(START_H + i)}
              </span>
            ))}
          </div>
          {DAYS.map(day => {
            const { isToday, isPast } = dayInfo(ws, day);
            return (
              <div
                key={day}
                className={`relative min-w-[110px] flex-1 border-s border-mindflow-border-light ${isToday ? 'bg-mindflow-accent-soft/30' : ''} ${isPast ? 'opacity-45' : ''}`}
                style={{ height: TOTAL_H * ROW_H + 'px' }}
              >
                {HOUR_LINES.map(i => (
                  <div key={i} className="absolute left-0 right-0 border-t border-mindflow-border-light" style={{ top: i * ROW_H + 'px' }} />
                ))}

                {/* Fixed commitments — solid chips */}
                {calendarBlocks.filter(b => b.day === day).map(b => {
                  const c = typeColor(b.type);
                  const top = Math.max(0, (b.startHour - START_H) * ROW_H);
                  const end = Math.min(b.startHour + b.durationHours, END_H);
                  const h = Math.max(20, (end - Math.max(b.startHour, START_H)) * ROW_H);
                  return (
                    <div
                      key={b.id}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-0.5"
                      style={{ top: top + 1, height: h - 2, backgroundColor: c, zIndex: 5 }}
                    >
                      <p className="truncate text-[11px] font-medium leading-tight text-white">{b.label}</p>
                      {h >= 40 && <p className="text-[10px] leading-tight text-white/90">{fmtHr(b.startHour)}–{fmtHr(end)}</p>}
                    </div>
                  );
                })}

                {/* Google-imported blocks — only in today's week (they are
                    week-scoped imports; showing them in other weeks would
                    plant one-off events across the whole plan). Fixed
                    commitments like the manual blocks above. */}
                {ws === todayWs && (googleBlocks || []).filter(b => b.day === day).map(b => {
                  const c = b.googleCalendarColor || typeColor(b.type);
                  const top = Math.max(0, (b.startHour - START_H) * ROW_H);
                  const end = Math.min(b.startHour + b.durationHours, END_H);
                  const h = Math.max(20, (end - Math.max(b.startHour, START_H)) * ROW_H);
                  return (
                    <div
                      key={b.id}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-0.5"
                      style={{ top: top + 1, height: h - 2, backgroundColor: c, zIndex: 5 }}
                      title={b.label + ' — ' + (b.googleCalendarName || 'Google Calendar')}
                    >
                      <p className="truncate text-[11px] font-medium leading-tight text-white pr-3">{b.label}</p>
                      {h >= 40 && <p className="text-[10px] leading-tight text-white/90">{fmtHr(b.startHour)}–{fmtHr(end)}</p>}
                      <svg className="absolute top-0.5 right-0.5 w-2.5 h-2.5" viewBox="0 0 24 24" fill="white" opacity="0.9">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                  );
                })}

                {/* Generated study sessions — tinted, bordered chips */}
                {(result?.days?.[day]?.sessions || []).map((s, i) => {
                  const c = typeColor(s.task.type);
                  const sh = s.startTick / 6, eh = s.endTick / 6;
                  const top = (sh - START_H) * ROW_H;
                  const h = (eh - sh) * ROW_H;
                  return (
                    <div
                      key={'s' + i}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-0.5"
                      style={{ top: top + 1, height: Math.max(h - 2, 18), backgroundColor: c + '1f', borderColor: c, zIndex: 10 }}
                    >
                      <p className="truncate text-[11px] font-medium leading-tight" style={{ color: typeTextColor(s.task.type) }}>{s.task.title}</p>
                      {h >= 40 && <p className="text-[10px] leading-tight" style={{ color: typeTextColor(s.task.type) }}>{fmtHr(sh)}–{fmtHr(eh)}</p>}
                    </div>
                  );
                })}
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>

      {/* Unscheduled */}
      {result?.unscheduled?.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-mindflow-warning/40 bg-mindflow-warning/10 px-4 py-3">
          <CalendarX2 className="w-4 h-4 mt-0.5 shrink-0 text-mindflow-warning" />
          <div>
            <p className="text-sm font-medium text-mindflow-heading">
              {result.unscheduled.length} {result.unscheduled.length === 1 ? T.taskSingular : T.taskPlural} {T.couldNotFit}
            </p>
            <p className="mt-0.5 text-xs text-mindflow-muted">
              {result.unscheduled.map(t => t.title).join(', ')} — {T.tryReducing}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
