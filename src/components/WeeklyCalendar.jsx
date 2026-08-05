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
