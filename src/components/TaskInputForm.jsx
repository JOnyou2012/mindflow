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
