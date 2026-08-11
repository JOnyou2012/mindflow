import { useState, useMemo, useEffect } from 'react';
import { X, School, Dumbbell, Palette, Ellipsis, Trash2, AlertCircle, Plus, CheckCircle2, CalendarDays } from 'lucide-react';
import { TYPE_COLORS, typeColor } from '../utils/theme.js';
import { uuid } from '../utils/uuid.js';
import QuestionFlow from './QuestionFlow.jsx';
import GoogleCalendarImport from './GoogleCalendarImport.jsx';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri'];
const START_H = 6, END_H = 22, TOTAL_H = END_H - START_H, ROW_H = 48;

const TYPE_ICONS = {
  academic: { color: TYPE_COLORS.academic, icon: School },
  sports:   { color: TYPE_COLORS.sports, icon: Dumbbell },
  arts:     { color: TYPE_COLORS.arts, icon: Palette },
  other:    { color: TYPE_COLORS.other, icon: Ellipsis },
};

// Generate time options: 6:00, 6:30, 7:00, ... 21:30
function buildTimeOptions() {
  const opts = [];
  for (let h = START_H; h < END_H; h++) {
    for (let m = 0; m < 60; m += 30) {
      opts.push(h + m / 60);
    }
  }
  return opts;
}
const TIME_OPTIONS = buildTimeOptions();

function fmtHr(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const p = hh >= 12 ? 'pm' : 'am';
  const d = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
  return mm > 0 ? `${d}:${mm.toString().padStart(2, '0')}${p}` : `${d}${p}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const FRESH_ANSWERS = () => ({ label: '', type: 'academic', time: { start: 9, end: 10 }, days: [...WEEKDAYS] });

export default function WeeklyCalendar({ blocks = [], googleBlocks = [], onChange, onGoogleImport, weekStart = null, onViewChange, T }) {
  const TYPE_CFG = {
    academic: { ...TYPE_ICONS.academic, label: T.typeAcademic },
    sports:   { ...TYPE_ICONS.sports, label: T.typeSports },
    arts:     { ...TYPE_ICONS.arts, label: T.typeArts },
    other:    { ...TYPE_ICONS.other, label: T.typeOther },
  };

  const QUICK_PRESETS = [
    { label: T.presetSchool, type: 'academic', start: 8, end: 15, days: WEEKDAYS },
    { label: T.presetHalf, type: 'academic', start: 8, end: 12, days: WEEKDAYS },
    { label: T.presetDinner, type: 'other', start: 18, end: 19, days: DAYS },
    { label: T.presetSleep, type: 'other', start: 22, end: 6, days: DAYS },
    { label: T.presetSports, type: 'sports', start: 15, end: 17, days: ['Mon','Wed','Fri'] },
  ];

  // Day-of-month number for the GCal-style date circle (timezone-safe)
  const getDayNum = (dayName) => {
    if (!weekStart) return null;
    const [y, m, d] = weekStart.split('-').map(Number);
    const idx = DAYS.indexOf(dayName);
    return new Date(y, m - 1, d + idx).getDate();
  };

  // -- View state: calendar overview ⇄ question flow ⇄ added prompt --
  const [view, setView] = useState('calendar');
  const [flowSeed, setFlowSeed] = useState(0); // remounts the flow for a fresh run

  // Let the parent wizard hide its footer while a sub-view owns the screen
  useEffect(() => {
    onViewChange?.(view === 'calendar' ? 'overview' : 'flow');
  }, [view, onViewChange]);

  // -- Edit popover --
  const [pop, setPop] = useState(null);
  const [popLabel, setPopLabel] = useState('');
  const [popType, setPopType] = useState('academic');
  const [popStart, setPopStart] = useState(9);
  const [popEnd, setPopEnd] = useState(10);
  const [popMsg, setPopMsg] = useState('');

  // -- Stats --
  const stats = useMemo(() => {
    const totalHours = blocks.reduce((s, b) => s + (b.durationHours || 0), 0);
    const daysUsed = new Set(blocks.map(b => b.day)).size;
    return { totalBlocks: blocks.length, totalHours, daysUsed };
  }, [blocks]);

  // -- Question flow stages --
  const stages = [
    {
      key: 'label',
      question: T.qEventName,
      manual: true,
      validate: (a) => (a.label || '').trim() ? null : T.calErrEventName,
      render: ({ value, set, inputRef }) => (
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={e => set(e.target.value)}
          placeholder={T.calEventPlaceholder || 'e.g. Physics 101, Work shift, Dinner'}
          className="w-full bg-transparent border-b-2 border-mindflow-border focus:border-mindflow-accent focus:outline-none text-xl text-mindflow-heading placeholder-mindflow-muted py-2 text-center"
        />
      ),
    },
    {
      key: 'type',
      question: T.qEventType,
      render: ({ value, set, advance }) => (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(TYPE_CFG).map(([k, c]) => (
            <button
              key={k}
              type="button"
              onClick={() => { set(k); advance(); }}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors
                ${value === k ? 'border-mindflow-accent bg-mindflow-accent-soft text-mindflow-accent' : 'border-mindflow-border text-mindflow-text hover:bg-mindflow-surface-alt'}`}
            >
              <c.icon className="w-5 h-5" style={{ color: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'time',
      question: T.qEventTime,
      manual: true,
      validate: (a) => {
        const { start, end } = a.time || {};
        if (end - start <= 0) return T.calErrEndAfterStart;
        if (end - start > 16) return T.calErrDurationMax;
        return null;
      },
      render: ({ value, set }) => {
        const v = value || { start: 9, end: 10 };
        return (
          <div className="flex items-center justify-center gap-3">
            <select
              value={v.start}
              onChange={e => set({ ...v, start: Number(e.target.value) })}
              className="bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5 text-mindflow-text text-base focus:border-mindflow-accent focus:outline-none"
            >
              {TIME_OPTIONS.map(t => (<option key={t} value={t}>{fmtHr(t)}</option>))}
            </select>
            <span className="text-mindflow-muted text-sm">{T.calTo}</span>
            <select
              value={v.end}
              onChange={e => set({ ...v, end: Number(e.target.value) })}
              className="bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5 text-mindflow-text text-base focus:border-mindflow-accent focus:outline-none"
            >
              {TIME_OPTIONS.filter(t => t > v.start).map(t => (<option key={t} value={t}>{fmtHr(t)}</option>))}
            </select>
            <span className="text-sm text-mindflow-muted tabular-nums">
              ({((v.end - v.start) * 60).toFixed(0)}m)
            </span>
          </div>
        );
      },
    },
    {
      key: 'days',
      question: T.qEventDays,
      manual: true,
      doneLabel: T.calAdd,
      validate: (a) => {
        if (!a.days || a.days.length === 0) return T.calErrSelectDay;
        const { start, end } = a.time;
        const conflicts = [];
        for (const d of a.days) {
          for (const b of blocks.filter(x => x.day === d)) {
            if (overlaps(start, end, b.startHour, b.startHour + b.durationHours)) {
              conflicts.push(`${b.label} (${d})`);
            }
          }
        }
        if (conflicts.length > 0) {
          return `${T.calErrTimeConflict} ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? ` +${conflicts.length - 3} ${T.calMore}` : ''}`;
        }
        return null;
      },
      render: ({ value, set }) => {
        const sel = value || [];
        const toggle = (d) => set(sel.includes(d) ? sel.filter(x => x !== d) : [...sel, d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)));
        return (
          <div className="flex flex-wrap justify-center gap-2">
            {DAYS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${sel.includes(d) ? 'bg-mindflow-accent text-mindflow-onaccent' : 'border border-mindflow-border text-mindflow-muted hover:text-mindflow-text'}`}
              >
                {d}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  const handleFlowComplete = (a) => {
    const dur = a.time.end - a.time.start;
    const newBlocks = a.days.map(d => ({
      id: uuid(),
      day: d,
      startHour: a.time.start,
      durationHours: dur,
      label: a.label.trim(),
      type: a.type,
      isFixed: true,
    }));
    onChange([...blocks, ...newBlocks]);
    setView('added');
  };

  // -- Quick preset --
  const applyPreset = (preset) => {
    const dur = preset.end - preset.start;
    const newBlocks = [];
    for (const d of preset.days) {
      const conflict = blocks.filter(b => b.day === d).some(b =>
        overlaps(preset.start, preset.end, b.startHour, b.startHour + b.durationHours)
      );
      if (!conflict) {
        newBlocks.push({
          id: uuid(), day: d, startHour: preset.start,
          durationHours: dur, label: preset.label, type: preset.type, isFixed: true,
        });
      }
    }
    if (newBlocks.length > 0) onChange([...blocks, ...newBlocks]);
  };

  // -- Edit popover handlers --
  const openEdit = (b) => {
    setPop(b);
    setPopLabel(b.label);
    setPopType(b.type);
    setPopStart(b.startHour);
    setPopEnd(b.startHour + b.durationHours);
    setPopMsg('');
  };
  const closePop = () => setPop(null);

  const saveEdit = () => {
    if (!popLabel.trim()) return;
    const dur = popEnd - popStart;
    if (dur <= 0) { setPopMsg(T.calErrEndAfterStart); return; }

    const conflicts = blocks.filter(b =>
      b.day === pop.day && b.id !== pop.id &&
      overlaps(popStart, popEnd, b.startHour, b.startHour + b.durationHours)
    );
    if (conflicts.length > 0) {
      setPopMsg(`${T.calConflictsWith} ${conflicts.map(b => b.label).join(', ')}`);
      return;
    }

    onChange(blocks.map(b => b.id === pop.id
      ? { ...b, label: popLabel.trim(), startHour: popStart, durationHours: dur, type: popType }
      : b));
    closePop();
  };

  const deleteBlock = () => {
    if (pop) onChange(blocks.filter(b => b.id !== pop.id));
    closePop();
  };

  // ================================================================
  // QUESTION FLOW VIEW
  // ================================================================
  if (view === 'flow') {
    return (
      <QuestionFlow
        key={flowSeed}
        stages={stages}
        initial={FRESH_ANSWERS()}
        onComplete={handleFlowComplete}
        T={T}
      />
    );
  }

  // ================================================================
  // ADDED CONFIRMATION
  // ================================================================
  if (view === 'added') {
    return (
      <div className="flex flex-col items-center justify-center text-center animate-fade-in" style={{ minHeight: 'min(60vh, 560px)' }}>
        <CheckCircle2 className="w-10 h-10 text-mindflow-success mb-4" />
        <p className="text-sm text-mindflow-muted">{T.flowAddAnotherHint}</p>
        <h2 className="text-2xl sm:text-3xl font-normal text-mindflow-heading mt-2">{T.flowAddAnother}</h2>
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={() => { setFlowSeed(s => s + 1); setView('flow'); }}
            className="rounded-full bg-mindflow-accent px-6 py-2.5 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm"
          >
            {T.calAddEvent}
          </button>
          <button
            onClick={() => setView('calendar')}
            className="rounded-full border border-mindflow-border px-6 py-2.5 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt"
          >
            {T.flowViewCalendar}
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  // CALENDAR VIEW
  // ================================================================
  return (
    <div className="space-y-5">
      {/* Action row: presets + add */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-mindflow-muted">{T.calQuick}</span>
        {QUICK_PRESETS.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => applyPreset(p)}
            className="flex items-center gap-1.5 rounded-full border border-mindflow-border px-3 py-1.5 text-xs text-mindflow-text hover:bg-mindflow-surface-alt transition-colors"
            title={`${p.label}: ${fmtHr(p.start)}–${fmtHr(p.end)} on ${p.days.length} days`}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: typeColor(p.type) }} />
            {p.label} ({fmtHr(p.start)}–{fmtHr(p.end)})
          </button>
        ))}
        <button
          type="button"
          onClick={() => setView('flow')}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-mindflow-accent px-5 py-2 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm"
        >
          <Plus className="w-4 h-4" />{T.calAddEvent}
        </button>
      </div>

      {/* Google Calendar import */}
      <div className="mb-3">
        <GoogleCalendarImport
          weekStart={weekStart}
          onImport={onGoogleImport}
          onError={(msg) => {}} // App handles errors via setError
          T={T}
        />
      </div>

      {/* Empty state */}
      {blocks.length === 0 && googleBlocks.length === 0 && (
        <div className="flex flex-col items-center text-center py-14">
          <div className="w-12 h-12 rounded-xl bg-mindflow-surface-alt flex items-center justify-center mb-4">
            <CalendarDays className="w-6 h-6 text-mindflow-muted" />
          </div>
          <p className="text-mindflow-heading font-medium">{T.flowEmptyCalendar}</p>
          <p className="text-sm text-mindflow-muted mt-1 max-w-sm">{T.flowEmptyCalendarHint}</p>
        </div>
      )}

      {/* Week grid — single scroll container so headers and columns share geometry */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
        <div className="calendar-grid overflow-x-auto">
          <div style={{ minWidth: '896px' }}>
            {/* Day headers */}
            <div className="flex border-b border-mindflow-border-light">
              <div className="w-14 shrink-0" />
              {DAYS.map(d => {
                const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short' });
                const isToday = d === todayStr.slice(0, 3);
                const dayNum = getDayNum(d);
                return (
                  <div key={d} className="flex-1 min-w-[110px] px-2 py-2 text-center border-l border-mindflow-border-light">
                    <span className={`block text-[11px] font-medium uppercase tracking-wide ${isToday ? 'text-mindflow-accent' : 'text-mindflow-muted'}`}>{d}</span>
                    <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${isToday ? 'bg-mindflow-accent text-mindflow-onaccent' : 'text-mindflow-heading'}`}>
                      {dayNum ?? ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Grid body */}
            <div className="flex">
              {/* Time gutter */}
              <div className="w-14 shrink-0 relative" style={{ height: TOTAL_H * ROW_H + 'px' }}>
                {Array.from({ length: TOTAL_H + 1 }, (_, i) => (
                  i > 0 && (
                    <span
                      key={i}
                      className="absolute right-2 text-[10px] text-mindflow-muted tabular-nums leading-3 -translate-y-1/2"
                      style={{ top: i * ROW_H + 'px' }}
                    >
                      {fmtHr(START_H + i)}
                    </span>
                  )
                ))}
              </div>

              {/* Day columns */}
              {DAYS.map(day => (
                <div key={day} className="relative flex-1 min-w-[110px] border-l border-mindflow-border-light" style={{ height: TOTAL_H * ROW_H + 'px' }}>
                  {Array.from({ length: TOTAL_H + 1 }, (_, i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-mindflow-border-light" style={{ top: i * ROW_H + 'px' }} />
                  ))}

                  {blocks.filter(b => b.day === day).map(b => {
                    const c = TYPE_CFG[b.type] || TYPE_CFG.other;
                    const top = Math.max(0, (b.startHour - START_H) * ROW_H);
                    const blockEnd = Math.min(b.startHour + b.durationHours, END_H);
                    const blockH = Math.max(24, (blockEnd - Math.max(b.startHour, START_H)) * ROW_H);
                    return (
                      <div
                        key={b.id}
                        onClick={() => openEdit(b)}
                        className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 overflow-hidden cursor-pointer hover:brightness-95"
                        style={{
                          top: top + 1 + 'px',
                          height: blockH - 2 + 'px',
                          backgroundColor: c.color,
                          zIndex: 10,
                        }}
                      >
                        <p className="text-[11px] font-medium text-white truncate">{b.label}</p>
                        {blockH >= 40 && (
                          <p className="text-[10px] text-white/90">
                            {fmtHr(b.startHour)} – {fmtHr(blockEnd)}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Google-synced blocks — readonly, with "G" badge */}
                  {(googleBlocks || []).filter(b => b.day === day).map(b => {
                    const c = TYPE_CFG[b.type] || TYPE_CFG.other;
                    const top = Math.max(0, (b.startHour - START_H) * ROW_H);
                    const blockEnd = Math.min(b.startHour + b.durationHours, END_H);
                    const blockH = Math.max(24, (blockEnd - Math.max(b.startHour, START_H)) * ROW_H);
                    return (
                      <div
                        key={b.id}
                        className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 overflow-hidden cursor-default opacity-85"
                        style={{
                          top: top + 1 + 'px',
                          height: blockH - 2 + 'px',
                          backgroundColor: c.color,
                          zIndex: 5,
                        }}
                        title={b.label + ' — ' + (T.gcalGoogleBlockTooltip || 'synced from Google Calendar')}
                      >
                        <p className="text-[11px] font-medium text-white truncate pr-3">{b.label}</p>
                        {blockH >= 40 && (
                          <p className="text-[10px] text-white/90">
                            {fmtHr(b.startHour)} – {fmtHr(blockEnd)}
                          </p>
                        )}
                        {/* Google "G" badge */}
                        <svg className="absolute top-0.5 right-0.5 w-3 h-3" viewBox="0 0 24 24" fill="white" opacity="0.9">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats footer */}
      {stats.totalBlocks > 0 && (
        <div className="flex items-center justify-between text-xs text-mindflow-muted pt-1">
          <span className="flex items-center gap-2">
            <span>{stats.totalBlocks} {stats.totalBlocks !== 1 ? T.calBlocks : T.calBlock}</span>
            <span className="text-mindflow-border">·</span>
            <span>{stats.totalHours}h</span>
            <span className="text-mindflow-border">·</span>
            <span>{stats.daysUsed} {stats.daysUsed !== 1 ? T.calDaysUnit : T.calDay}</span>
          </span>
          <button
            type="button"
            onClick={() => { if (window.confirm(T.confirmRemoveAll)) onChange([]); }}
            className="text-mindflow-muted hover:text-mindflow-danger transition-colors"
          >
            {T.clearAllEvents}
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* EDIT POPOVER */}
      {/* ================================================================ */}
      {pop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closePop}>
          <div className="w-80 rounded-xl bg-mindflow-surface shadow-xl p-5 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-mindflow-heading font-medium text-sm">{T.calEditEvent}</h3>
              <button type="button" onClick={closePop} className="p-1 rounded-full text-mindflow-muted hover:text-mindflow-text hover:bg-mindflow-surface-alt transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-mindflow-surface-alt rounded-lg px-3 py-2 text-xs">
              <span className="font-medium text-mindflow-heading">{pop.day}</span>
              <span className="text-mindflow-muted"> · </span>
              <span className="font-medium text-mindflow-heading">{fmtHr(pop.startHour)} – {fmtHr(pop.startHour + pop.durationHours)}</span>
            </div>

            <div>
              <label className="text-xs font-medium text-mindflow-muted block mb-1">{T.calLabel}</label>
              <input type="text" value={popLabel} onChange={e => { setPopLabel(e.target.value); setPopMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); saveEdit(); } }}
                className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none" autoFocus />
            </div>

            <div>
              <label className="text-xs font-medium text-mindflow-muted block mb-1">{T.calTime}</label>
              <div className="flex items-center gap-2">
                <select value={popStart} onChange={e => { setPopStart(Number(e.target.value)); setPopMsg(''); }}
                  className="bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-2 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none flex-1">
                  {TIME_OPTIONS.map(t => (<option key={t} value={t}>{fmtHr(t)}</option>))}
                </select>
                <span className="text-mindflow-muted text-xs">{T.calTo}</span>
                <select value={popEnd} onChange={e => { setPopEnd(Number(e.target.value)); setPopMsg(''); }}
                  className="bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-2 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none flex-1">
                  {TIME_OPTIONS.filter(t => t > popStart).map(t => (<option key={t} value={t}>{fmtHr(t)}</option>))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-mindflow-muted block mb-1">{T.calType}</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CFG).map(([k, c]) => (
                  <button key={k} type="button" onClick={() => setPopType(k)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors
                      ${popType === k ? 'text-white' : 'border border-mindflow-border text-mindflow-muted hover:text-mindflow-text'}`}
                    style={popType === k ? { backgroundColor: c.color } : {}}>
                    <c.icon className="w-3 h-3" />{c.label}
                  </button>
                ))}
              </div>
            </div>

            {popMsg && (
              <div className="flex items-start gap-2 text-xs text-mindflow-warning bg-mindflow-warning/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{popMsg}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={saveEdit} disabled={!popLabel.trim()}
                className="flex-1 rounded-full bg-mindflow-accent text-mindflow-onaccent py-2 text-sm font-medium
                           hover:bg-mindflow-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {T.calSaveChanges}
              </button>
              <button type="button" onClick={deleteBlock}
                className="rounded-full px-3 py-2 text-mindflow-danger hover:bg-mindflow-danger/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
