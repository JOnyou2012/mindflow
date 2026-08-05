import { useState, useEffect, useMemo } from 'react';
import { X, School, Dumbbell, Palette, Ellipsis, Trash2, Clock, AlertCircle, Utensils, Moon, Plus, Search } from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri'];
const START_H = 6, END_H = 22, TOTAL_H = END_H - START_H, ROW_H = 48;

const TYPE_CFG = {
  academic: { color: '#3b82f6', icon: School, label: 'Academic' },
  sports:   { color: '#22c55e', icon: Dumbbell, label: 'Sports' },
  arts:     { color: '#8b5cf6', icon: Palette, label: 'Arts' },
  other:    { color: '#6b7280', icon: Ellipsis, label: 'Other' },
};

const DURATION_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8];

const DEFAULT_PRESETS = [
  { label: 'Dinner', type: 'other', dur: 1, start: 18, days: DAYS, icon: Utensils },
  { label: 'School Day', type: 'academic', dur: 6.5, start: 8, days: WEEKDAYS, icon: School },
  { label: 'Half Day', type: 'academic', dur: 4, start: 8, days: WEEKDAYS, icon: School },
  { label: 'Sports Practice', type: 'sports', dur: 2, start: 15, days: ['Mon','Wed','Fri'], icon: Dumbbell },
  { label: 'Art Studio', type: 'arts', dur: 1.5, start: 14, days: ['Tue','Thu'], icon: Palette },
];

function fmtHr(h) { const hh = Math.floor(h), p = hh >= 12 ? 'pm' : 'am', d = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh); return `${d}${p}`; }

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export default function WeeklyCalendar({ blocks = [], onChange }) {
  // -- Form state (always visible) --
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState('academic');
  const [formDur, setFormDur] = useState(1);
  const [formDays, setFormDays] = useState(['Mon','Tue','Wed','Thu','Fri']);
  const [formTime, setFormTime] = useState('auto'); // 'auto' | 'morning' | 'afternoon' | 'evening' | number
  const [formError, setFormError] = useState('');

  // -- Edit popover state --
  const [pop, setPop] = useState(null);
  const [popLabel, setPopLabel] = useState('');
  const [popDur, setPopDur] = useState(1);
  const [popType, setPopType] = useState('academic');
  const [popOverlap, setPopOverlap] = useState('');

  // -- First-visit defaults --
  const [hasInitialized, setHasInitialized] = useState(false);
  useEffect(() => {
    if (hasInitialized || blocks.length > 0) return;
    setHasInitialized(true);
    // Auto-add dinner blocks on first visit with empty calendar
    const dinnerPreset = DEFAULT_PRESETS[0];
    const dinnerBlocks = dinnerPreset.days.map(d => ({
      id: crypto.randomUUID(), day: d, startHour: dinnerPreset.start,
      durationHours: dinnerPreset.dur, label: dinnerPreset.label,
      type: dinnerPreset.type, isFixed: true,
    }));
    onChange(dinnerBlocks);
  }, [blocks.length, hasInitialized, onChange]);

  // -- Stats --
  const stats = useMemo(() => {
    const totalHours = blocks.reduce((s, b) => s + (b.durationHours || 0), 0);
    const daysUsed = new Set(blocks.map(b => b.day)).size;
    return { totalBlocks: blocks.length, totalHours, daysUsed };
  }, [blocks]);

  // -- Slot finding --
  const findFreeSlots = (day, durationH) => {
    const dayBlocks = blocks
      .filter(b => b.day === day)
      .sort((a, b) => a.startHour - b.startHour);

    const slots = [];
    let cursor = START_H;

    for (const b of dayBlocks) {
      if (cursor + durationH <= b.startHour + 0.01) {
        slots.push(cursor);
      }
      cursor = Math.max(cursor, b.startHour + b.durationHours);
    }
    if (cursor + durationH <= END_H + 0.01) {
      slots.push(cursor);
    }
    return slots;
  };

  const findBestSlot = (durationH, preferredTime) => {
    const results = [];
    for (const day of formDays) {
      const slots = findFreeSlots(day, durationH);
      if (slots.length === 0) continue;

      // Score each slot: prefer slots near the preferred time
      let bestSlot = slots[0];
      let bestScore = Infinity;
      for (const s of slots) {
        let score;
        if (preferredTime === 'morning') {
          score = Math.abs(s - 9); // prefer 9am
        } else if (preferredTime === 'afternoon') {
          score = Math.abs(s - 14); // prefer 2pm
        } else if (preferredTime === 'evening') {
          score = Math.abs(s - 17); // prefer 5pm
        } else if (typeof preferredTime === 'number') {
          score = Math.abs(s - preferredTime);
        } else {
          score = s; // 'auto': earliest slot
        }
        if (score < bestScore) { bestScore = score; bestSlot = s; }
      }
      results.push({ day, startHour: bestSlot, score: bestScore });
    }
    return results.sort((a, b) => a.score - b.score);
  };

  // -- Add event --
  const handleAdd = () => {
    if (!formLabel.trim()) { setFormError('Enter an event name.'); return; }
    if (formDays.length === 0) { setFormError('Select at least one day.'); return; }

    const durationH = formDur;
    const preferred = formTime === 'auto' ? null
      : formTime === 'morning' ? 'morning'
      : formTime === 'afternoon' ? 'afternoon'
      : formTime === 'evening' ? 'evening'
      : Number(formTime);

    const placements = findBestSlot(durationH, preferred);

    if (placements.length < formDays.length) {
      const missing = formDays.filter(d => !placements.find(p => p.day === d));
      setFormError(`No room on ${missing.join(', ')} for a ${durationH}h block. Try a shorter duration or fewer days.`);
      return;
    }

    const newBlocks = placements.map(p => ({
      id: crypto.randomUUID(),
      day: p.day,
      startHour: p.startHour,
      durationHours: durationH,
      label: formLabel.trim(),
      type: formType,
      isFixed: true,
    }));

    onChange([...blocks, ...newBlocks]);
    setFormLabel('');
    setFormError('');
  };

  // -- Quick preset --
  const applyPreset = (preset) => {
    const newBlocks = [];
    for (const d of preset.days) {
      const dayBlocks = blocks.filter(b => b.day === d);
      const conflicts = dayBlocks.filter(b =>
        overlaps(preset.start, preset.start + preset.dur, b.startHour, b.startHour + b.durationHours)
      );
      if (conflicts.length === 0) {
        newBlocks.push({
          id: crypto.randomUUID(), day: d, startHour: preset.start,
          durationHours: preset.dur, label: preset.label, type: preset.type, isFixed: true,
        });
      }
    }
    if (newBlocks.length > 0) onChange([...blocks, ...newBlocks]);
  };

  // -- Edit popover --
  const openEdit = (b) => {
    setPop(b);
    setPopLabel(b.label);
    setPopDur(b.durationHours);
    setPopType(b.type);
    setPopOverlap('');
  };
  const closePop = () => setPop(null);

  const saveEdit = () => {
    if (!popLabel.trim()) return;

    const maxDur = END_H - pop.startHour;
    const clampedDur = Math.min(popDur, maxDur);

    const conflicts = blocks.filter(b =>
      b.day === pop.day && b.id !== pop.id &&
      overlaps(pop.startHour, pop.startHour + clampedDur, b.startHour, b.startHour + b.durationHours)
    );
    if (conflicts.length > 0) {
      setPopOverlap(`Overlaps with: ${conflicts.map(b => b.label).join(', ')}`);
      return;
    }

    onChange(blocks.map(b => b.id === pop.id
      ? { ...b, label: popLabel.trim(), durationHours: clampedDur, type: popType }
      : b));
    closePop();
  };

  const deleteBlock = () => {
    if (pop) onChange(blocks.filter(b => b.id !== pop.id));
    closePop();
  };

  const handlePopKeyDown = (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); saveEdit(); }
  };

  // -- Day toggle --
  const toggleDay = (d) => {
    setFormDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)));
    setFormError('');
  };

  // -- Render --
  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* ADD EVENT FORM */}
      {/* ================================================================ */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-mindflow-heading flex items-center gap-2">
          <Plus className="w-4 h-4 text-mindflow-accent" />Add Event
        </h3>

        {/* Row 1: Name + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Event Name</label>
            <input
              type="text"
              value={formLabel}
              onChange={e => { setFormLabel(e.target.value); setFormError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); handleAdd(); } }}
              placeholder="e.g. Physics lecture, Soccer practice"
              className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5
                         text-mindflow-text placeholder-mindflow-muted text-sm
                         focus:border-mindflow-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Type</label>
            <div className="flex gap-1">
              {Object.entries(TYPE_CFG).map(([k, c]) => {
                const I = c.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFormType(k)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all
                      ${formType === k ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                    style={formType === k ? { backgroundColor: c.color } : {}}
                    title={c.label}
                  >
                    <I className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Duration + Time preference + Days */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Duration</label>
            <div className="flex flex-wrap gap-1">
              {DURATION_OPTIONS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setFormDur(h)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${formDur === h ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Preferred Time</label>
            <div className="grid grid-cols-2 gap-1">
              {[
                { value: 'auto', label: 'Auto-fit', icon: Search },
                { value: 'morning', label: 'Morning', icon: null },
                { value: 'afternoon', label: 'Afternoon', icon: null },
                { value: 'evening', label: 'Evening', icon: null },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormTime(opt.value)}
                  className={`py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1
                    ${formTime === opt.value ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                >
                  {opt.icon && <opt.icon className="w-3 h-3" />}
                  {opt.label}
                </button>
              ))}
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
                  className={`px-2 py-1.5 rounded-md text-[11px] font-medium transition-all
                    ${formDays.includes(d) ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error + Submit */}
        {formError && (
          <div className="flex items-center gap-2 text-sm text-mindflow-danger bg-mindflow-danger/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{formError}
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
        <span className="text-[10px] text-mindflow-muted uppercase tracking-wide mr-1">Quick Add:</span>
        {DEFAULT_PRESETS.map((p, i) => {
          const c = TYPE_CFG[p.type], I = p.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={() => applyPreset(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         hover:scale-105 active:scale-95 transition-all"
              style={{ backgroundColor: c.color + '22', color: c.color, border: '1px solid ' + c.color + '33' }}
              title={`Add ${p.label} to ${p.days.length} day${p.days.length !== 1 ? 's' : ''}`}
            >
              <I className="w-3.5 h-3.5" />{p.label}
            </button>
          );
        })}
      </div>

      {/* ================================================================ */}
      {/* VISUAL GRID */}
      {/* ================================================================ */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-mindflow-border bg-mindflow-bg/50">
          {DAYS.map(d => {
            const n = blocks.filter(b => b.day === d).length;
            const dayHours = blocks.filter(b => b.day === d).reduce((s, b) => s + b.durationHours, 0);
            return (
              <div key={d} className="px-2 py-2.5 text-center border-r border-mindflow-border last:border-r-0">
                <span className="text-xs font-semibold text-mindflow-heading">{d}</span>
                <span className="block text-[10px] text-mindflow-muted">
                  {n > 0 ? `${n} block · ${dayHours}h` : 'Free'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grid body */}
        <div className="grid grid-cols-7 calendar-grid overflow-x-auto" style={{ minWidth: '840px' }}>
          {DAYS.map(day => (
            <div key={day} className="relative border-r border-mindflow-border last:border-r-0" style={{ height: TOTAL_H * ROW_H + 'px' }}>
              {/* Hour lines */}
              {Array.from({ length: TOTAL_H }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-mindflow-border/40" style={{ top: i * ROW_H + 'px' }}>
                  {day === 'Mon' && (
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
                const blockH = Math.max(20, Math.min(b.durationHours * ROW_H, (END_H - Math.max(b.startHour, START_H)) * ROW_H));
                const I = c.icon;
                return (
                  <div
                    key={b.id}
                    onClick={() => openEdit(b)}
                    className="absolute left-1 right-1 rounded-lg px-2 py-1.5 cursor-pointer
                               hover:brightness-110 transition-all overflow-hidden group"
                    style={{
                      top: top + 2 + 'px',
                      height: blockH - 4 + 'px',
                      backgroundColor: c.color + '22',
                      borderLeft: '3px solid ' + c.color,
                      zIndex: 10,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <I className="w-3 h-3 shrink-0" style={{ color: c.color }} />
                      <p className="text-xs font-semibold text-white truncate leading-tight">{b.label}</p>
                    </div>
                    {blockH >= 48 && (
                      <p className="text-[10px] text-mindflow-muted mt-0.5 ml-4">
                        {fmtHr(b.startHour)} – {fmtHr(Math.min(b.startHour + b.durationHours, END_H))}
                      </p>
                    )}
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <span className="text-[10px] text-white/70">Click to edit</span>
                    </div>
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
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{stats.totalHours}h scheduled across {stats.daysUsed} day{stats.daysUsed !== 1 ? 's' : ''}</span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remove all ${stats.totalBlocks} calendar blocks?`)) onChange([]);
            }}
            className="text-mindflow-muted hover:text-mindflow-danger transition-colors"
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
              <h3 className="text-mindflow-heading font-semibold text-sm">Edit Block</h3>
              <button type="button" onClick={closePop} className="p-1 rounded-lg text-mindflow-muted hover:text-mindflow-text hover:bg-mindflow-bg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-mindflow-bg rounded-lg px-3 py-2 text-xs text-mindflow-text">
              <span className="font-medium text-mindflow-heading">{pop.day}</span>
              <span className="text-mindflow-muted"> · </span>
              <span className="font-medium text-mindflow-heading">{fmtHr(pop.startHour)} – {fmtHr(Math.min(pop.startHour + pop.durationHours, END_H))}</span>
            </div>

            <div>
              <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Label</label>
              <input
                type="text"
                value={popLabel}
                onChange={e => { setPopLabel(e.target.value); setPopOverlap(''); }}
                onKeyDown={handlePopKeyDown}
                className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2
                           text-mindflow-text placeholder-mindflow-muted text-sm
                           focus:border-mindflow-accent focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Duration</label>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map(h => (
                  <button key={h} type="button" onClick={() => setPopDur(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                      ${popDur === h ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-mindflow-muted uppercase tracking-wide font-medium block mb-1">Type</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CFG).map(([k, c]) => {
                  const I = c.icon;
                  return (
                    <button key={k} type="button" onClick={() => setPopType(k)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all
                        ${popType === k ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                      style={popType === k ? { backgroundColor: c.color } : {}}>
                      <I className="w-3.5 h-3.5" />{c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {popOverlap && (
              <div className="flex items-start gap-2 text-xs text-mindflow-warning bg-mindflow-warning/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{popOverlap}
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
                           hover:bg-mindflow-danger/25 transition-colors" title="Delete block">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
