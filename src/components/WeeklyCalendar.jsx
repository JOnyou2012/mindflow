import { useState, useEffect, useMemo } from 'react';
import { X, School, Dumbbell, Palette, Ellipsis, Trash2, Clock, AlertCircle, Utensils, Moon, Plus } from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri'];
const START_H = 6, END_H = 22, TOTAL_H = END_H - START_H, ROW_H = 48;

const TYPE_CFG = {
  academic: { color: '#3b82f6', icon: School, label: 'Academic' },
  sports:   { color: '#22c55e', icon: Dumbbell, label: 'Sports' },
  arts:     { color: '#8b5cf6', icon: Palette, label: 'Arts' },
  other:    { color: '#6b7280', icon: Ellipsis, label: 'Other' },
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

const QUICK_PRESETS = [
  { label: 'School Day', type: 'academic', start: 8, end: 15, days: WEEKDAYS },
  { label: 'Half Day', type: 'academic', start: 8, end: 12, days: WEEKDAYS },
  { label: 'Dinner', type: 'other', start: 18, end: 19, days: DAYS },
  { label: 'Sleep', type: 'other', start: 22, end: 6, days: DAYS },
  { label: 'Sports Practice', type: 'sports', start: 15, end: 17, days: ['Mon','Wed','Fri'] },
];

export default function WeeklyCalendar({ blocks = [], onChange }) {
  // -- Form state --
  const [label, setLabel] = useState('');
  const [type, setType] = useState('academic');
  const [startTime, setStartTime] = useState(9);   // 9:00 AM default
  const [endTime, setEndTime] = useState(10);       // 10:00 AM default
  const [selectedDays, setSelectedDays] = useState([...WEEKDAYS]);
  const [error, setError] = useState('');

  // -- Edit popover --
  const [pop, setPop] = useState(null);
  const [popLabel, setPopLabel] = useState('');
  const [popType, setPopType] = useState('academic');
  const [popStart, setPopStart] = useState(9);
  const [popEnd, setPopEnd] = useState(10);
  const [popMsg, setPopMsg] = useState('');

  // -- First-visit: auto-add dinner --
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized || blocks.length > 0) return;
    setInitialized(true);
    const preset = QUICK_PRESETS[2]; // Dinner
    onChange(preset.days.map(d => ({
      id: crypto.randomUUID(), day: d,
      startHour: preset.start, durationHours: preset.end - preset.start,
      label: preset.label, type: preset.type, isFixed: true,
    })));
  }, [blocks.length, initialized, onChange]);

  // -- Stats --
  const stats = useMemo(() => {
    const totalHours = blocks.reduce((s, b) => s + (b.durationHours || 0), 0);
    const daysUsed = new Set(blocks.map(b => b.day)).size;
    return { totalBlocks: blocks.length, totalHours, daysUsed };
  }, [blocks]);

  // -- Add event --
  const handleAdd = () => {
    if (!label.trim()) { setError('Enter an event name.'); return; }
    if (selectedDays.length === 0) { setError('Select at least one day.'); return; }
    const dur = endTime - startTime;
    if (dur <= 0) { setError('End time must be after start time.'); return; }
    if (dur > 16) { setError('Duration cannot exceed 16 hours.'); return; }

    // Check for overlaps on each selected day
    const conflicts = [];
    for (const d of selectedDays) {
      const dayBlocks = blocks.filter(b => b.day === d);
      for (const b of dayBlocks) {
        if (overlaps(startTime, endTime, b.startHour, b.startHour + b.durationHours)) {
          conflicts.push(`${b.label} on ${d}`);
        }
      }
    }
    if (conflicts.length > 0) {
      setError(`Time conflict with: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? ` +${conflicts.length - 3} more` : ''}. Adjust the time or remove the conflicting block first.`);
      return;
    }

    const newBlocks = selectedDays.map(d => ({
      id: crypto.randomUUID(),
      day: d,
      startHour: startTime,
      durationHours: dur,
      label: label.trim(),
      type,
      isFixed: true,
    }));

    onChange([...blocks, ...newBlocks]);
    setLabel('');
    setError('');
  };

  // -- Quick preset --
  const applyPreset = (preset) => {
    const dur = preset.end - preset.start;
    const newBlocks = [];
    for (const d of preset.days) {
      const dayBlocks = blocks.filter(b => b.day === d);
      const conflict = dayBlocks.some(b =>
        overlaps(preset.start, preset.end, b.startHour, b.startHour + b.durationHours)
      );
      if (!conflict) {
        newBlocks.push({
          id: crypto.randomUUID(), day: d, startHour: preset.start,
          durationHours: dur, label: preset.label, type: preset.type, isFixed: true,
        });
      }
    }
    if (newBlocks.length > 0) onChange([...blocks, ...newBlocks]);
  };

  // -- Day toggle --
  const toggleDay = (d) => {
    setSelectedDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
    );
    setError('');
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
    if (dur <= 0) { setPopMsg('End time must be after start time.'); return; }

    const conflicts = blocks.filter(b =>
      b.day === pop.day && b.id !== pop.id &&
      overlaps(popStart, popEnd, b.startHour, b.startHour + b.durationHours)
    );
    if (conflicts.length > 0) {
      setPopMsg(`Conflicts with: ${conflicts.map(b => b.label).join(', ')}`);
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

  // -- Render --
  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* ADD FIXED EVENT FORM */}
      {/* ================================================================ */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-mindflow-heading flex items-center gap-2">
          <Plus className="w-4 h-4 text-mindflow-accent" />Add Fixed Event
        </h3>
        <p className="text-xs text-mindflow-muted -mt-2">
          These are your non-negotiable commitments — classes, work, meals. The scheduler works around them.
        </p>

        {/* Event name + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-3">
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Event Name</label>
            <input
              type="text"
              value={label}
              onChange={e => { setLabel(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); handleAdd(); } }}
              placeholder="e.g. Physics 101, Work shift, Dinner"
              className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5
                         text-mindflow-text placeholder-mindflow-muted text-sm
                         focus:border-mindflow-accent focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Type</label>
            <div className="flex gap-1">
              {Object.entries(TYPE_CFG).map(([k, c]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setType(k)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all
                    ${type === k ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                  style={type === k ? { backgroundColor: c.color } : {}}
                  title={c.label}
                >
                  <c.icon className="w-3 h-3" />{c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Time range + Days */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Time</label>
            <div className="flex items-center gap-2">
              <select
                value={startTime}
                onChange={e => { setStartTime(Number(e.target.value)); setError(''); }}
                className="bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2
                           text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t} value={t}>{fmtHr(t)}</option>
                ))}
              </select>
              <span className="text-mindflow-muted text-xs">to</span>
              <select
                value={endTime}
                onChange={e => { setEndTime(Number(e.target.value)); setError(''); }}
                className="bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2
                           text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none"
              >
                {TIME_OPTIONS.filter(t => t > startTime).map(t => (
                  <option key={t} value={t}>{fmtHr(t)}</option>
                ))}
              </select>
              <span className="text-xs text-mindflow-muted ml-1">
                ({((endTime - startTime) * 60).toFixed(0)}m)
              </span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Days</label>
            <div className="flex flex-wrap gap-1">
              {DAYS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all
                    ${selectedDays.includes(d) ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error + Submit */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-mindflow-danger bg-mindflow-danger/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
          </div>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="w-full bg-mindflow-accent text-white py-2.5 rounded-lg font-medium
                     hover:opacity-90 transition-opacity text-sm"
        >
          Add to Schedule
        </button>
      </div>

      {/* ================================================================ */}
      {/* QUICK PRESETS */}
      {/* ================================================================ */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-mindflow-muted uppercase tracking-wide mr-1">Quick:</span>
        {QUICK_PRESETS.map((p, i) => {
          const c = TYPE_CFG[p.type];
          const dur = p.end - p.start;
          return (
            <button
              key={i}
              type="button"
              onClick={() => applyPreset(p)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                         hover:scale-105 active:scale-95 transition-all"
              style={{ backgroundColor: c.color + '22', color: c.color, border: '1px solid ' + c.color + '33' }}
              title={`${p.label}: ${fmtHr(p.start)}–${fmtHr(p.end)} on ${p.days.length} days`}
            >
              <c.icon className="w-3 h-3" />{p.label} ({fmtHr(p.start)}–{fmtHr(p.end)})
            </button>
          );
        })}
      </div>

      {/* ================================================================ */}
      {/* VISUAL CALENDAR GRID */}
      {/* ================================================================ */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-mindflow-border bg-mindflow-bg/50">
          {DAYS.map(d => {
            const n = blocks.filter(b => b.day === d).length;
            const hrs = blocks.filter(b => b.day === d).reduce((s, b) => s + b.durationHours, 0);
            return (
              <div key={d} className="px-2 py-2.5 text-center border-r border-mindflow-border last:border-r-0">
                <span className="text-xs font-semibold text-mindflow-heading">{d}</span>
                <span className="block text-[10px] text-mindflow-muted">
                  {n > 0 ? `${n} · ${hrs}h` : 'Free'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grid body */}
        <div className="grid grid-cols-7 calendar-grid overflow-x-auto" style={{ minWidth: '840px' }}>
          {DAYS.map(day => (
            <div key={day} className="relative border-r border-mindflow-border last:border-r-0" style={{ height: TOTAL_H * ROW_H + 'px' }}>
              {/* Hour grid lines */}
              {Array.from({ length: TOTAL_H + 1 }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-mindflow-border/40" style={{ top: i * ROW_H + 'px' }}>
                  {day === 'Mon' && i < TOTAL_H && (
                    <span className="absolute -left-14 top-0 text-[10px] text-mindflow-muted w-12 text-right pr-2 leading-3 -translate-y-1/2">
                      {fmtHr(START_H + i)}
                    </span>
                  )}
                </div>
              ))}

              {/* Blocks */}
              {blocks.filter(b => b.day === day).map(b => {
                const c = TYPE_CFG[b.type] || TYPE_CFG.other;
                const top = Math.max(0, (b.startHour - START_H) * ROW_H);
                const blockEnd = Math.min(b.startHour + b.durationHours, END_H);
                const blockH = Math.max(24, (blockEnd - Math.max(b.startHour, START_H)) * ROW_H);
                return (
                  <div
                    key={b.id}
                    onClick={() => openEdit(b)}
                    className="absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer
                               hover:brightness-110 transition-all overflow-hidden group"
                    style={{
                      top: top + 1 + 'px',
                      height: blockH - 2 + 'px',
                      backgroundColor: c.color + '1a',
                      borderLeft: '3px solid ' + c.color,
                      zIndex: 10,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <c.icon className="w-3 h-3 shrink-0" style={{ color: c.color }} />
                      <p className="text-[11px] font-semibold text-white truncate leading-tight">{b.label}</p>
                    </div>
                    {blockH >= 40 && (
                      <p className="text-[10px] text-mindflow-muted mt-0.5 ml-4">
                        {fmtHr(b.startHour)} – {fmtHr(blockEnd)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Stats footer */}
      {stats.totalBlocks > 0 && (
        <div className="flex items-center justify-between text-xs text-mindflow-muted">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {stats.totalHours}h scheduled · {stats.totalBlocks} block{stats.totalBlocks !== 1 ? 's' : ''} · {stats.daysUsed} day{stats.daysUsed !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remove all ${stats.totalBlocks} calendar blocks?`)) onChange([]);
            }}
            className="hover:text-mindflow-danger transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* EDIT POPOVER */}
      {/* ================================================================ */}
      {pop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closePop}>
          <div className="bg-mindflow-surface border border-mindflow-border rounded-2xl p-6 w-80 shadow-2xl space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-mindflow-heading font-semibold text-sm">Edit Event</h3>
              <button type="button" onClick={closePop} className="p-1 rounded-lg text-mindflow-muted hover:text-mindflow-text hover:bg-mindflow-bg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-mindflow-bg rounded-lg px-3 py-2 text-xs">
              <span className="font-medium text-mindflow-heading">{pop.day}</span>
              <span className="text-mindflow-muted"> · </span>
              <span className="font-medium text-mindflow-heading">{fmtHr(pop.startHour)} – {fmtHr(pop.startHour + pop.durationHours)}</span>
            </div>

            <div>
              <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Label</label>
              <input type="text" value={popLabel} onChange={e => { setPopLabel(e.target.value); setPopMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); saveEdit(); } }}
                className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none" autoFocus />
            </div>

            <div>
              <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Time</label>
              <div className="flex items-center gap-2">
                <select value={popStart} onChange={e => { setPopStart(Number(e.target.value)); setPopMsg(''); }}
                  className="bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-2 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none flex-1">
                  {TIME_OPTIONS.map(t => (<option key={t} value={t}>{fmtHr(t)}</option>))}
                </select>
                <span className="text-mindflow-muted text-xs">to</span>
                <select value={popEnd} onChange={e => { setPopEnd(Number(e.target.value)); setPopMsg(''); }}
                  className="bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-2 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none flex-1">
                  {TIME_OPTIONS.filter(t => t > popStart).map(t => (<option key={t} value={t}>{fmtHr(t)}</option>))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Type</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CFG).map(([k, c]) => (
                  <button key={k} type="button" onClick={() => setPopType(k)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all
                      ${popType === k ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
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
                className="flex-1 bg-mindflow-accent text-white py-2.5 rounded-lg text-sm font-medium
                           hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                Save Changes
              </button>
              <button type="button" onClick={deleteBlock}
                className="px-3 py-2.5 bg-mindflow-danger/15 text-mindflow-danger rounded-lg text-sm
                           hover:bg-mindflow-danger/25 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
