import { useState, useMemo } from 'react';
import { Plus, Trash2, Star, Clock, Calendar, AlertCircle, Edit3, X, ChevronUp, ChevronDown, BarChart3 } from 'lucide-react';

const QUICK_DURATIONS = [15, 30, 60, 90, 120];

// -- Helpers ------------------------------------------------------------------

function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDeadline(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function isPastDeadline(iso) {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(iso + 'T00:00:00');
  return !isNaN(dl.getTime()) && dl < today;
}

// -- Component ----------------------------------------------------------------

export default function TaskInputForm({ tasks = [], onChange, T }) {
  const TYPES = [
    { value: 'academic', label: T.typeAcademic, color: '#7eb8a0' },
    { value: 'sports', label: T.typeSports, color: '#d4a574' },
    { value: 'arts', label: T.typeArts, color: '#9b7eb8' },
    { value: 'other', label: T.typeOther, color: '#8899aa' },
  ];
  const PRIORITIES = [
    { value: 'high', label: T.priorityHigh, color: '#d4786e' },
    { value: 'medium', label: T.priorityMedium, color: '#e0b870' },
    { value: 'low', label: T.priorityLow, color: '#8899aa' },
  ];
  const DIFFICULTY_LABELS = ['', T.diffVeryEasy, T.diffEasy, T.diffMedium, T.diffHard, T.diffVeryHard];

  const [title, setTitle] = useState('');
  const [type, setType] = useState('academic');
  const [difficulty, setDifficulty] = useState(3);
  const [durationMins, setDurationMins] = useState(30);
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);   // null = adding new, string = editing
  const [formOpen, setFormOpen] = useState(true);

  const isEditing = editingId !== null;

  // -- Derived stats ----------------------------------------------------------

  const stats = useMemo(() => {
    if (tasks.length === 0) return null;
    const totalMins = tasks.reduce((s, t) => s + (t.durationMins || 0), 0);
    const withDeadlines = tasks.filter(t => t.deadline).length;
    const pastDeadline = tasks.filter(t => isPastDeadline(t.deadline)).length;
    const avgDifficulty = tasks.reduce((s, t) => s + (t.difficulty || 3), 0) / tasks.length;
    let hardest = tasks[0];
    for (const t of tasks) {
      if ((t.difficulty || 3) > (hardest.difficulty || 3)) hardest = t;
    }
    return { totalMins, withDeadlines, pastDeadline, avgDifficulty, hardest, count: tasks.length };
  }, [tasks]);

  const typeMeta = (t) => TYPES.find(o => o.value === t) || TYPES[3];
  const priorityMeta = (p) => PRIORITIES.find(o => o.value === p) || PRIORITIES[1];

  // -- Actions ----------------------------------------------------------------

  const reset = () => {
    setTitle(''); setType('academic'); setDifficulty(3);
    setDurationMins(30); setPriority('medium'); setDeadline('');
    setError(''); setEditingId(null);
  };

  const validate = () => {
    if (!title.trim()) return T.taskErrTitle;
    if (durationMins < 5) return T.taskErrDurationMin;
    if (durationMins > 480) return T.taskErrDurationMax;
    const dup = tasks.find(t => t.title.toLowerCase() === title.trim().toLowerCase() && t.id !== editingId);
    if (dup) return `${T.taskErrDuplicate} "${dup.title}" ${T.taskErrDuplicateSuffix}`;
    return null;
  };

  const handleSubmit = () => {
    const err = validate(); if (err) { setError(err); return; }
    if (isEditing) {
      onChange(tasks.map(t => t.id === editingId
        ? { ...t, title: title.trim(), type, durationMins, difficulty, priority, deadline: deadline || null }
        : t
      ));
    } else {
      onChange([...tasks, {
        id: crypto.randomUUID(), title: title.trim(), type,
        durationMins, difficulty, priority, deadline: deadline || null,
      }]);
    }
    reset();
  };

  const startEdit = (task) => {
    setTitle(task.title);
    setType(task.type || 'academic');
    setDifficulty(task.difficulty || 3);
    setDurationMins(task.durationMins || 30);
    setPriority(task.priority || 'medium');
    setDeadline(task.deadline || '');
    setError('');
    setEditingId(task.id);
    setFormOpen(true);
    // Scroll form into view on mobile
    document.getElementById('task-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleDelete = (taskId) => {
    if (editingId === taskId) reset();
    onChange(tasks.filter(t => t.id !== taskId));
  };

  const handleClearAll = () => {
    if (tasks.length === 0) return;
    if (window.confirm(`Delete all ${tasks.length} task${tasks.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
      reset();
      onChange([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // -- Render -----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ── Task summary bar ── */}
      {stats && (
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-mindflow-accent" />
            <h3 className="text-sm font-medium text-mindflow-heading">{T.taskSummary}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-mindflow-bg rounded-lg py-2 px-3">
              <p className="text-lg font-bold text-mindflow-heading">{stats.count}</p>
              <p className="text-[10px] text-mindflow-muted">{T.taskTotal}</p>
            </div>
            <div className="bg-mindflow-bg rounded-lg py-2 px-3">
              <p className="text-lg font-bold text-mindflow-heading">{formatMinutes(stats.totalMins)}</p>
              <p className="text-[10px] text-mindflow-muted">{T.taskTotalTime}</p>
            </div>
            <div className="bg-mindflow-bg rounded-lg py-2 px-3">
              <p className="text-lg font-bold text-mindflow-heading">{stats.avgDifficulty.toFixed(1)}</p>
              <p className="text-[10px] text-mindflow-muted">{T.taskAvgDiff}</p>
            </div>
            <div className="bg-mindflow-bg rounded-lg py-2 px-3">
              <p className={`text-lg font-bold ${stats.pastDeadline > 0 ? 'text-mindflow-danger' : 'text-mindflow-heading'}`}>
                {stats.withDeadlines}
                {stats.pastDeadline > 0 && <span className="text-[10px] ml-0.5">({stats.pastDeadline} {T.taskOverdue.toLowerCase()})</span>}
              </p>
              <p className="text-[10px] text-mindflow-muted">{T.taskWithDeadlines}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Task list ── */}
      {tasks.length > 0 ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-mindflow-heading">
              {T.yourTasks} ({tasks.length})
            </h3>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-mindflow-muted hover:text-mindflow-danger transition-colors"
            >
              {T.taskClearAll}
            </button>
          </div>
          {tasks.map(task => {
            const tm = typeMeta(task.type), pm = priorityMeta(task.priority);
            const overdue = isPastDeadline(task.deadline);
            return (
              <div
                key={task.id}
                onClick={() => startEdit(task)}
                className="flex items-start justify-between group cursor-pointer transition-all
                  pl-4 pr-4 py-3.5 rounded-r-lg mb-2"
                style={{
                  backgroundColor: editingId === task.id ? 'rgba(212,165,116,0.06)' : 'transparent',
                  borderLeft: '3px solid ' + (overdue ? '#d4786e' : tm.color),
                  opacity: overdue ? 0.6 : 1,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-mindflow-heading font-medium truncate">{task.title}</p>
                    {overdue && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-mindflow-danger/15 text-mindflow-danger shrink-0">
                        {T.taskOverdue}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: tm.color + '26', color: tm.color }}>{tm.label}</span>
                    <span className="px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: pm.color + '26', color: pm.color }}>
                      {pm.label}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-mindflow-bg text-mindflow-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatMinutes(task.durationMins)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-mindflow-bg text-yellow-400">
                      {'★'.repeat(task.difficulty)}{'☆'.repeat(5 - task.difficulty)}
                    </span>
                    {task.deadline && (
                      <span className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${overdue ? 'bg-mindflow-danger/10 text-mindflow-danger' : 'bg-mindflow-bg text-mindflow-muted'}`}>
                        <Calendar className="w-3 h-3" />{formatDeadline(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                    className="p-2 rounded-lg text-mindflow-muted hover:text-mindflow-accent hover:bg-mindflow-accent/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Edit task"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                    className="p-2 rounded-lg text-mindflow-muted hover:text-mindflow-danger hover:bg-mindflow-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.15), rgba(212,165,116,0.05))', border: '1px solid rgba(212,165,116,0.12)' }}>
            <Plus className="w-6 h-6 text-mindflow-accent" />
          </div>
          <p className="text-mindflow-heading font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{T.taskNoTasks}</p>
          <p className="text-sm text-mindflow-muted max-w-sm mx-auto leading-relaxed">
            {T.taskNoTasksDesc}
          </p>
        </div>
      )}

      {/* ── Add / Edit form ── */}
      <div id="task-form" className="rounded-xl overflow-hidden border border-mindflow-border/60"
        style={{ background: 'linear-gradient(180deg, rgba(212,165,116,0.02) 0%, transparent 50%)' }}>
        <button
          type="button"
          onClick={() => setFormOpen(o => !o)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-mindflow-bg/30 transition-colors"
        >
          <h3 className="text-sm font-medium text-mindflow-heading flex items-center gap-2">
            {isEditing ? (
              <><Edit3 className="w-4 h-4 text-mindflow-accent" />{T.taskEdit}</>
            ) : (
              <><Plus className="w-4 h-4 text-mindflow-accent" />{T.taskAdd}</>
            )}
          </h3>
          <span className="text-mindflow-muted">
            {formOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {formOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-mindflow-border pt-4">
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder={T.taskTitle}
              className="w-full bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5
                         text-mindflow-text placeholder-mindflow-muted focus:border-mindflow-accent
                         focus:outline-none text-sm"
              autoFocus={isEditing}
            />

            {/* Type */}
            <div>
              <p className="text-xs text-mindflow-muted mb-2 font-medium">{T.calType}</p>
              <div className="flex gap-2">
                {TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                      ${type === t.value ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                    style={type === t.value ? { backgroundColor: t.color } : {}}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs text-mindflow-muted mb-2 font-medium">{T.taskPriority}</p>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                      ${priority === p.value ? 'text-white shadow-lg' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                    style={priority === p.value ? { backgroundColor: p.color } : {}}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <p className="text-xs text-mindflow-muted mb-2 font-medium">{T.taskDifficulty}</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDifficulty(s)}
                    className="p-1 rounded hover:scale-110 transition-transform"
                    title={DIFFICULTY_LABELS[s]}
                  >
                    <Star
                      className={`w-7 h-7 ${s <= difficulty ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-600'}`}
                      fill={s <= difficulty ? 'currentColor' : 'none'}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs text-mindflow-muted self-center">
                  {DIFFICULTY_LABELS[difficulty]}
                </span>
              </div>
            </div>

            {/* Duration */}
            <div>
              <p className="text-xs text-mindflow-muted mb-2 font-medium">{T.taskDuration}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  value={durationMins}
                  onChange={e => setDurationMins(Number(e.target.value))}
                  min={5} max={480} step={5}
                  className="w-28 bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2
                             text-mindflow-text focus:border-mindflow-accent focus:outline-none text-sm"
                />
                <span className="text-sm text-mindflow-muted">{T.taskMinutes}</span>
                {QUICK_DURATIONS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDurationMins(m)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors
                      ${durationMins === m ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-muted hover:text-mindflow-text'}`}
                  >
                    {formatMinutes(m)}
                  </button>
                ))}
              </div>
            </div>

            {/* Deadline */}
            <div>
              <p className="text-xs text-mindflow-muted mb-2 font-medium">
                {T.taskDeadline} <span className="opacity-60">{T.taskDeadlineOpt}</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={deadline ? deadline.split('T')[0] : ''}
                  onChange={e => {
                    const d = e.target.value;
                    const t = (deadline && deadline.includes('T')) ? deadline.split('T')[1] : '23:59';
                    setDeadline(d ? d + 'T' + t : '');
                  }}
                  className="flex-1 bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5
                             text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none
                             [color-scheme:dark]"
                />
                <input
                  type="time"
                  value={(deadline && deadline.includes('T')) ? deadline.split('T')[1] : '23:59'}
                  onChange={e => {
                    const d = (deadline && deadline.includes('T')) ? deadline.split('T')[0] : new Date().toISOString().split('T')[0];
                    setDeadline(d + 'T' + e.target.value);
                  }}
                  className="w-32 bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5
                             text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none
                             [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-mindflow-danger bg-mindflow-danger/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            {/* Submit + Cancel */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 bg-mindflow-accent text-white py-2.5 rounded-lg font-medium
                           hover:opacity-90 transition-opacity text-sm"
              >
                {isEditing ? T.taskSave : T.taskAdd}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2.5 rounded-lg border border-mindflow-border text-mindflow-text
                             text-sm hover:bg-mindflow-surface transition-colors flex items-center gap-1"
                >
                  <X className="w-4 h-4" />{T.taskCancel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
