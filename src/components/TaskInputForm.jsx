import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Star, Clock, Calendar, Edit3, CheckCircle2, ListChecks } from 'lucide-react';
import { TYPE_COLORS, TYPE_TEXT_COLORS, PRIORITY_COLORS, PRIORITY_TEXT_COLORS } from '../utils/theme.js';
import { uuid } from '../utils/uuid.js';
import QuestionFlow from './QuestionFlow.jsx';

const QUICK_DURATIONS = [15, 30, 60, 90, 120];

// -- Helpers ------------------------------------------------------------------

function formatMinutes(mins) {
  if (mins == null || !Number.isFinite(mins)) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDeadline(iso) {
  if (!iso) return null;
  try {
    // Deadline may already include time (e.g. '2026-08-15T23:59') —
    // don't blindly append T00:00:00 which produces an invalid date.
    // Also strip trailing 'T' (e.g. '2026-08-15T') — an edge case
    // that can arise from corrupted localStorage.
    let dlStr = iso;
    if (dlStr.endsWith('T')) dlStr = dlStr.slice(0, -1);
    if (!dlStr.includes('T')) dlStr += 'T00:00:00';
    const d = new Date(dlStr);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function isPastDeadline(iso) {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let dlStr = iso;
  if (dlStr.endsWith('T')) dlStr = dlStr.slice(0, -1);
  if (!dlStr.includes('T')) dlStr += 'T00:00:00';
  const dl = new Date(dlStr);
  return !isNaN(dl.getTime()) && dl < today;
}

const FRESH_ANSWERS = () => ({
  title: '', type: 'academic', priority: 'medium', difficulty: 3,
  durationMins: 30, deadline: '',
});

// -- Component ----------------------------------------------------------------

export default function TaskInputForm({ tasks = [], onChange, onViewChange, T }) {
  const TYPES = [
    { value: 'academic', label: T.typeAcademic, color: TYPE_COLORS.academic, textColor: TYPE_TEXT_COLORS.academic },
    { value: 'sports', label: T.typeSports, color: TYPE_COLORS.sports, textColor: TYPE_TEXT_COLORS.sports },
    { value: 'arts', label: T.typeArts, color: TYPE_COLORS.arts, textColor: TYPE_TEXT_COLORS.arts },
    { value: 'other', label: T.typeOther, color: TYPE_COLORS.other, textColor: TYPE_TEXT_COLORS.other },
  ];
  const PRIORITIES = [
    { value: 'high', label: T.priorityHigh, color: PRIORITY_COLORS.high, textColor: PRIORITY_TEXT_COLORS.high },
    { value: 'medium', label: T.priorityMedium, color: PRIORITY_COLORS.medium, textColor: PRIORITY_TEXT_COLORS.medium },
    { value: 'low', label: T.priorityLow, color: PRIORITY_COLORS.low, textColor: PRIORITY_TEXT_COLORS.low },
  ];
  const DIFFICULTY_LABELS = ['', T.diffVeryEasy, T.diffEasy, T.diffMedium, T.diffHard, T.diffVeryHard];

  // -- View state: list ⇄ flow ⇄ added ---------------------------------------
  const [view, setView] = useState('list');
  const [flowSeed, setFlowSeed] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const isEditing = editingId !== null;

  // Let the parent wizard hide its footer while a sub-view owns the screen
  useEffect(() => {
    onViewChange?.(view === 'list' ? 'overview' : 'flow');
  }, [view, onViewChange]);

  // -- Derived stats ----------------------------------------------------------

  const stats = useMemo(() => {
    if (tasks.length === 0) return null;
    const totalMins = tasks.reduce((s, t) => s + (t.durationMins || 0), 0);
    const withDeadlines = tasks.filter(t => t.deadline).length;
    const pastDeadline = tasks.filter(t => isPastDeadline(t.deadline)).length;
    const avgDifficulty = tasks.reduce((s, t) => s + (t.difficulty || 3), 0) / tasks.length;
    return { totalMins, withDeadlines, pastDeadline, avgDifficulty, count: tasks.length };
  }, [tasks]);

  const typeMeta = (t) => TYPES.find(o => o.value === t) || TYPES[3];
  const priorityMeta = (p) => PRIORITIES.find(o => o.value === p) || PRIORITIES[1];

  // -- Question flow stages ----------------------------------------------------

  const stages = [
    {
      key: 'title',
      question: T.qTaskTitle,
      manual: true,
      validate: (a) => {
        if (!(a.title || '').trim()) return T.taskErrTitle;
        const dup = tasks.find(t => t.title.toLowerCase() === a.title.trim().toLowerCase() && t.id !== editingId);
        if (dup) return `${T.taskErrDuplicate} "${dup.title}" ${T.taskErrDuplicateSuffix}`;
        return null;
      },
      render: ({ value, set, inputRef }) => (
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={e => set(e.target.value)}
          placeholder={T.taskTitle}
          className="w-full bg-transparent border-b-2 border-mindflow-border focus:border-mindflow-accent focus:outline-none text-xl text-mindflow-heading placeholder-mindflow-muted py-2 text-center"
        />
      ),
    },
    {
      key: 'type',
      question: T.qTaskType,
      render: ({ value, set, advance }) => (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => { set(t.value); advance(); }}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors
                ${value === t.value ? 'border-mindflow-accent bg-mindflow-accent-soft text-mindflow-accent' : 'border-mindflow-border text-mindflow-text hover:bg-mindflow-surface-alt'}`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'priority',
      question: T.qTaskPriority,
      render: ({ value, set, advance }) => (
        <div className="flex justify-center gap-3">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => { set(p.value); advance(); }}
              className={`flex items-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-medium transition-colors
                ${value === p.value ? 'border-mindflow-accent bg-mindflow-accent-soft text-mindflow-accent' : 'border-mindflow-border text-mindflow-text hover:bg-mindflow-surface-alt'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'difficulty',
      question: T.qTaskDifficulty,
      render: ({ value, set, advance }) => (
        <div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { set(s); advance(); }}
                className="p-1.5 rounded-lg hover:bg-mindflow-surface-alt"
                title={DIFFICULTY_LABELS[s]}
              >
                <Star
                  className={`w-8 h-8 ${s <= (value || 3) ? 'text-amber-500' : 'text-mindflow-border'}`}
                  fill={s <= (value || 3) ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>
          <p className="text-sm text-mindflow-muted mt-3">{DIFFICULTY_LABELS[value || 3]}</p>
        </div>
      ),
    },
    {
      key: 'durationMins',
      question: T.qTaskDuration,
      manual: true,
      validate: (a) => {
        if (a.durationMins < 5) return T.taskErrDurationMin;
        if (a.durationMins > 480) return T.taskErrDurationMax;
        return null;
      },
      render: ({ value, set }) => (
        <div>
          <div className="flex items-center justify-center gap-2">
            <input
              type="number"
              value={value}
              onChange={e => set(Number(e.target.value))}
              min={5} max={480} step={5}
              className="w-28 bg-transparent border-b-2 border-mindflow-border focus:border-mindflow-accent focus:outline-none text-2xl text-mindflow-heading text-center py-1 tabular-nums"
            />
            <span className="text-base text-mindflow-muted">{T.taskMinutes}</span>
          </div>
          <div className="flex justify-center gap-2 mt-5">
            {QUICK_DURATIONS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set(m)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors
                  ${value === m ? 'bg-mindflow-accent-soft text-mindflow-accent border-transparent font-medium' : 'border-mindflow-border text-mindflow-muted hover:bg-mindflow-surface-alt'}`}
              >
                {formatMinutes(m)}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'deadline',
      question: T.qTaskDeadline,
      manual: true,
      optional: true,
      doneLabel: isEditing ? T.taskSave : T.taskAdd,
      render: ({ value, set }) => {
        const datePart = value && value.includes('T') ? value.split('T')[0] : (value || '');
        const timePart = value && value.includes('T') ? value.split('T')[1] : '23:59';
        return (
          <div className="flex justify-center gap-2">
            <input
              type="date"
              value={datePart}
              onChange={e => set(e.target.value ? e.target.value + 'T' + timePart : '')}
              className="bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none"
            />
            <input
              type="time"
              value={timePart}
              onChange={e => {
                // Use local date parts, NOT toISOString() which is UTC —
                // in timezones ahead of UTC it returns yesterday's date.
                const now = new Date();
                const d = datePart || (
                  now.getFullYear() + '-' +
                  String(now.getMonth() + 1).padStart(2, '0') + '-' +
                  String(now.getDate()).padStart(2, '0')
                );
                set(d + 'T' + e.target.value);
              }}
              className="w-32 bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2.5 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none"
            />
          </div>
        );
      },
    },
  ];

  const handleFlowComplete = (a) => {
    const task = {
      title: a.title.trim(),
      type: a.type,
      durationMins: a.durationMins,
      difficulty: a.difficulty,
      priority: a.priority,
      deadline: a.deadline || null,
    };
    if (isEditing) {
      onChange(tasks.map(t => t.id === editingId ? { ...t, ...task } : t));
      setEditingId(null);
      setView('list');
    } else {
      onChange([...tasks, { id: uuid(), ...task }]);
      setView('added');
    }
  };

  const startAdd = () => { setEditingId(null); setFlowSeed(s => s + 1); setView('flow'); };
  const startEdit = (task) => {
    setEditingId(task.id);
    setFlowSeed(s => s + 1);
    setView('flow');
  };

  const handleDelete = (taskId) => {
    onChange(tasks.filter(t => t.id !== taskId));
  };

  const handleClearAll = () => {
    if (tasks.length === 0) return;
    if (window.confirm(T.confirmDeleteAll || `Delete all ${tasks.length} task${tasks.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
      onChange([]);
    }
  };

  const editInitial = () => {
    const t = tasks.find(x => x.id === editingId);
    if (!t) return FRESH_ANSWERS();
    return {
      title: t.title, type: t.type || 'academic', priority: t.priority || 'medium',
      difficulty: t.difficulty || 3, durationMins: t.durationMins || 30, deadline: t.deadline || '',
    };
  };

  // ================================================================
  // QUESTION FLOW VIEW
  // ================================================================
  if (view === 'flow') {
    return (
      <QuestionFlow
        key={flowSeed + (editingId || 'new')}
        stages={stages}
        initial={editInitial()}
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
      <div className="flex flex-col items-center justify-center text-center animate-fade-in" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <CheckCircle2 className="w-10 h-10 text-mindflow-success mb-4" />
        <p className="text-sm text-mindflow-muted">{T.flowAddedTaskHint}</p>
        <h2 className="text-2xl sm:text-3xl font-normal text-mindflow-heading mt-2">{T.flowAddAnother}</h2>
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={startAdd}
            className="rounded-full bg-mindflow-accent px-6 py-2.5 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm"
          >
            {T.taskAdd}
          </button>
          <button
            onClick={() => setView('list')}
            className="rounded-full border border-mindflow-border px-6 py-2.5 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt"
          >
            {T.flowReviewTasks}
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  // LIST VIEW
  // ================================================================
  return (
    <div className="space-y-6">
      {/* Action row */}
      <div className="flex items-center justify-between">
        {tasks.length > 0 ? (
          <h3 className="text-sm font-medium text-mindflow-heading">{T.yourTasks} ({tasks.length})</h3>
        ) : <span />}
        <div className="flex items-center gap-3">
          {tasks.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-mindflow-muted hover:text-mindflow-danger transition-colors"
            >
              {T.taskClearAll}
            </button>
          )}
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center gap-1.5 rounded-full bg-mindflow-accent px-5 py-2 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm"
          >
            <Plus className="w-4 h-4" />{T.taskAdd}
          </button>
        </div>
      </div>

      {/* Task list */}
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-mindflow-border bg-mindflow-border mb-4">
              {[
                [stats.count, T.taskTotal],
                [formatMinutes(stats.totalMins), T.taskTotalTime],
                [stats.avgDifficulty.toFixed(1), T.taskAvgDiff],
                [stats.withDeadlines + (stats.pastDeadline > 0 ? ` (${stats.pastDeadline} ${T.taskOverdue.toLowerCase()})` : ''), T.taskWithDeadlines],
              ].map(([val, label], i) => (
                <div key={i} className="bg-mindflow-surface px-4 py-3">
                  <p className={`text-xl font-medium tabular-nums ${stats.pastDeadline > 0 && i === 3 ? 'text-mindflow-danger' : 'text-mindflow-heading'}`}>{val}</p>
                  <p className="text-xs text-mindflow-muted mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
          {tasks.map(task => {
            const tm = typeMeta(task.type), pm = priorityMeta(task.priority);
            const overdue = isPastDeadline(task.deadline);
            return (
              <div
                key={task.id}
                onClick={() => startEdit(task)}
                className="flex items-start justify-between gap-3 rounded-lg border border-mindflow-border-light bg-mindflow-surface px-4 py-3 hover:bg-mindflow-surface-alt cursor-pointer group transition-colors"
                style={{ opacity: overdue ? 0.6 : 1 }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: overdue ? '#d93025' : tm.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-mindflow-heading font-medium truncate">{task.title}</p>
                    {overdue && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-mindflow-danger/10 text-mindflow-danger shrink-0">
                        {T.taskOverdue}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="rounded-full bg-mindflow-surface-alt px-2 py-0.5 text-[11px] font-medium flex items-center gap-1.5" style={{ color: tm.textColor }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tm.color }} />
                      {tm.label}
                    </span>
                    <span className="rounded-full bg-mindflow-surface-alt px-2 py-0.5 text-[11px] font-medium" style={{ color: pm.textColor }}>
                      {pm.label}
                    </span>
                    <span className="rounded-full bg-mindflow-surface-alt px-2 py-0.5 text-[11px] text-mindflow-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatMinutes(task.durationMins)}
                    </span>
                    <span className="rounded-full bg-mindflow-surface-alt px-2 py-0.5 flex items-center gap-px" title={DIFFICULTY_LABELS[task.difficulty]}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= task.difficulty ? 'text-amber-500' : 'text-mindflow-border'}`} fill={s <= task.difficulty ? 'currentColor' : 'none'} />
                      ))}
                    </span>
                    {task.deadline && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] flex items-center gap-1 ${overdue ? 'bg-mindflow-danger/10 text-mindflow-danger' : 'bg-mindflow-surface-alt text-mindflow-muted'}`}>
                        <Calendar className="w-3 h-3" />{formatDeadline(task.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                    className="p-1.5 rounded-full text-mindflow-muted hover:bg-mindflow-surface-alt hover:text-mindflow-text opacity-0 group-hover:opacity-100 transition-all"
                    title={T.taskEdit}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                    className="p-1.5 rounded-full text-mindflow-muted hover:text-mindflow-danger opacity-0 group-hover:opacity-100 transition-all"
                    title={T.taskClearAll}
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
        <div className="flex flex-col items-center text-center py-14">
          <div className="w-12 h-12 rounded-xl bg-mindflow-surface-alt flex items-center justify-center mb-4">
            <ListChecks className="w-6 h-6 text-mindflow-muted" />
          </div>
          <p className="text-mindflow-heading font-medium">{T.taskNoTasks}</p>
          <p className="text-sm text-mindflow-muted mt-1 max-w-sm">{T.taskNoTasksDesc}</p>
        </div>
      )}
    </div>
  );
}
