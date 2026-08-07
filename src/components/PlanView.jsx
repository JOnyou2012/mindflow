import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, CalendarX2 } from 'lucide-react';
import { typeColor, typeTextColor } from '../utils/theme.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const START_H = 6, END_H = 22, TOTAL_H = END_H - START_H, ROW_H = 48;
const HOUR_LINES = Array.from({ length: TOTAL_H + 1 }, (_, i) => i);

function fmtHr(h) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const p = hh >= 12 ? 'pm' : 'am';
  const d = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
  return mm > 0 ? `${d}:${String(mm).padStart(2, '0')}${p}` : `${d}${p}`;
}

function weekLabel(ws) {
  const [y, m, d] = ws.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${s} – ${e}, ${end.getFullYear()}`;
}

function dayInfo(ws, dayName) {
  const [y, m, d] = ws.split('-').map(Number);
  const date = new Date(y, m - 1, d + DAYS.indexOf(dayName));
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayIso = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
  return { dateNum: date.getDate(), isToday: iso === todayIso, isPast: iso < todayIso };
}

/**
 * Results page — Google Calendar-style week view of the generated plan.
 * One week at a time with prev/next navigation; fixed commitments render as
 * solid chips, generated study sessions as tinted, bordered chips.
 */
export default function PlanView({ weekResults, calendarBlocks, isStale, isCalculating, onRegenerate, T }) {
  const weekStarts = useMemo(() => Object.keys(weekResults).sort(), [weekResults]);
  const [selIdx, setSelIdx] = useState(0);
  const idx = Math.min(selIdx, weekStarts.length - 1);
  const ws = weekStarts[idx];
  const result = weekResults[ws];

  if (!ws || !result) return null;

  const stats = result.stats;
  const statCells = stats ? [
    [stats.totalScheduledHours + 'h', T.scheduled],
    [stats.utilizationPct + '%', T.capacity],
    [stats.workloadBalance + '%', T.balance],
    [(stats.avgFatigue || 0) + '%', T.avgFatigue],
  ] : [];

  return (
    <div className="space-y-4">
      {/* Stale banner */}
      {isStale && (
        <div className="flex items-center gap-3 rounded-lg border border-mindflow-warning/40 bg-mindflow-warning/10 px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-mindflow-warning shrink-0" />
          <p className="text-sm text-mindflow-text flex-1">{T.scheduleChanged}</p>
          <button
            onClick={onRegenerate}
            disabled={isCalculating}
            className="flex items-center gap-1.5 rounded-full bg-mindflow-accent px-4 py-1.5 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />{T.regen}
          </button>
        </div>
      )}

      {/* Toolbar — Today / prev / next / range + legend */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setSelIdx(0)}
          className="rounded-full border border-mindflow-border px-4 py-1.5 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt"
        >
          {T.today}
        </button>
        <div className="flex items-center">
          <button
            onClick={() => setSelIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Previous week"
            className="rounded-full p-1.5 text-mindflow-muted hover:bg-mindflow-surface-alt disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelIdx(i => Math.min(weekStarts.length - 1, i + 1))}
            disabled={idx >= weekStarts.length - 1}
            aria-label="Next week"
            className="rounded-full p-1.5 text-mindflow-muted hover:bg-mindflow-surface-alt disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <h2 className="text-lg text-mindflow-heading font-normal">{weekLabel(ws)}</h2>

        <div className="ml-auto flex items-center gap-4 text-xs text-mindflow-muted">
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

      {/* Warnings */}
      {result.warnings?.length > 0 && (
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
                  <div key={d} className={`flex-1 min-w-[110px] border-l border-mindflow-border-light py-2 text-center ${isPast ? 'opacity-45' : ''}`}>
                    <p className={`text-[11px] font-medium uppercase tracking-wide ${isToday ? 'text-mindflow-accent' : 'text-mindflow-muted'}`}>{d}</p>
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
                className={`relative min-w-[110px] flex-1 border-l border-mindflow-border-light ${isToday ? 'bg-mindflow-accent-soft/30' : ''} ${isPast ? 'opacity-45' : ''}`}
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

                {/* Generated study sessions — tinted, bordered chips */}
                {(result.days[day]?.sessions || []).map((s, i) => {
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
      {result.unscheduled?.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-mindflow-warning/40 bg-mindflow-warning/10 px-4 py-3">
          <CalendarX2 className="w-4 h-4 mt-0.5 shrink-0 text-mindflow-warning" />
          <div>
            <p className="text-sm font-medium text-mindflow-heading">
              {result.unscheduled.length} task{result.unscheduled.length !== 1 ? 's' : ''} {T.couldNotFit}
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
