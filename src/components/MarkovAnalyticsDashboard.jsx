import { useState } from 'react';
import { Brain, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import SessionChart from './SessionChart';

const TYPE_COLORS = { academic: '#3b82f6', sports: '#22c55e', arts: '#8b5cf6', other: '#6b7280' };
const TYPE_LABELS = { academic: 'Academic', sports: 'Sports', arts: 'Arts', other: 'Other' };

function getToday() {
  const idx = (new Date().getDay() + 6) % 7;
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][idx];
}

export default function MarkovAnalyticsDashboard({ optimizedWeek, alpha, isCalculating, isStale, onRegenerate, calendarBlocks = [] }) {
  const [selectedDay, setSelectedDay] = useState(() => getToday());
  const [expanded, setExpanded] = useState({});

  // ── LOADING ──
  if (isCalculating) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="relative">
        <Brain className="w-16 h-16 text-mindflow-accent animate-pulse" />
        <div className="absolute inset-0 rounded-full animate-pulse-glow" />
      </div>
      <p className="text-mindflow-heading text-lg font-medium">Calculating your schedule...</p>
      <p className="text-mindflow-muted text-sm text-center max-w-sm">
        Running Markov simulations across all 7 days to find the best task order and break placement.
      </p>
    </div>
  );

  // ── EMPTY ──
  if (!optimizedWeek || !optimizedWeek.days) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="bg-mindflow-surface p-5 rounded-full border border-mindflow-border">
        <Brain className="w-12 h-12 text-mindflow-muted" />
      </div>
      <p className="text-mindflow-heading text-lg font-medium">No schedule generated yet</p>
      <p className="text-mindflow-muted text-sm text-center max-w-md">To see your optimized week:</p>
      <div className="flex items-center gap-4 mt-2 text-xs text-mindflow-muted">
        <span className="bg-mindflow-surface border border-mindflow-border rounded-lg px-3 py-2">1. 🧪 Calibrate</span><span>→</span>
        <span className="bg-mindflow-surface border border-mindflow-border rounded-lg px-3 py-2">2. 📅 Add schedule + tasks</span><span>→</span>
        <span className="bg-mindflow-surface border border-mindflow-border rounded-lg px-3 py-2">3. ⚡ Generate</span>
      </div>
    </div>
  );

  const dd = optimizedWeek.days[selectedDay];
  if (!dd) return null;
  const { sessions, fatigueCurve, totalFlowMins, burnoutCount } = dd;
  const activeDays = Object.values(optimizedWeek.days).filter(d => d.sessions.length > 0).length;

  // Day's calendar blocks (for Gantt)
  const dayBlocks = (calendarBlocks || []).filter(b => b.day === selectedDay);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Stale schedule banner ── */}
      {isStale && (
        <div className="bg-mindflow-warning/10 border border-mindflow-warning/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-mindflow-warning">
            <AlertTriangle className="w-5 h-5" />
            <span>Your tasks or schedule have changed since the last generation.</span>
          </div>
          {onRegenerate && (
            <button onClick={onRegenerate} className="bg-mindflow-warning text-mindflow-bg px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2 shrink-0 ml-4">
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
          )}
        </div>
      )}

      {/* ── Day selector ── */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-1.5 flex gap-1.5">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => {
          const has = optimizedWeek.days[d].sessions.length > 0;
          const n = optimizedWeek.days[d].sessions.length;
          const isToday = d === getToday();
          return (
            <button key={d} onClick={() => setSelectedDay(d)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                selectedDay === d ? 'bg-mindflow-accent text-white shadow-lg shadow-mindflow-accent/25'
                  : has ? 'text-mindflow-text hover:bg-mindflow-border/50' : 'text-mindflow-muted/50 hover:text-mindflow-muted'
              }`}>
              <span className="block">{d}</span>
              {has ? <span className="block text-[10px] opacity-70">{n} task{n !== 1 ? 's' : ''}</span>
                : <span className="block text-[10px] opacity-40">—</span>}
              {isToday && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-mindflow-accent" />}
            </button>
          );
        })}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center gap-4">
          <div className="bg-mindflow-success/15 p-3 rounded-lg shrink-0">
            <Zap className="w-6 h-6 text-mindflow-success" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-mindflow-heading">{totalFlowMins}</p>
            <p className="text-xs text-mindflow-muted">Flow Minutes</p>
          </div>
        </div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg shrink-0 ${burnoutCount > 0 ? 'bg-mindflow-danger/15' : 'bg-mindflow-success/15'}`}>
            <AlertTriangle className={`w-6 h-6 ${burnoutCount > 0 ? 'text-mindflow-danger' : 'text-mindflow-success'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-mindflow-heading">{burnoutCount}</p>
            <p className="text-xs text-mindflow-muted">Burnout Events</p>
            <p className="text-[10px] text-mindflow-muted mt-0.5 truncate">
              {burnoutCount === 0 ? 'No fatigue spikes!' : 'Breaks auto-inserted'}
            </p>
          </div>
        </div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center gap-4">
          <div className="bg-mindflow-accent/15 p-3 rounded-lg shrink-0">
            <CheckCircle2 className="w-6 h-6 text-mindflow-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-mindflow-heading">{sessions.length}</p>
            <p className="text-xs text-mindflow-muted">Tasks on {selectedDay}</p>
            <p className="text-[10px] text-mindflow-muted mt-0.5 truncate">
              {activeDays} active day{activeDays !== 1 ? 's' : ''} this week
            </p>
          </div>
        </div>
      </div>

      {/* ── Gantt timeline (sessions + calendar blocks) ── */}
      {((sessions.length > 0) || (dayBlocks.length > 0)) && (
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-mindflow-heading mb-3">{selectedDay} Timeline</h3>
          <div className="flex justify-between text-[10px] text-mindflow-muted mb-1.5 px-1">
            <span>6am</span><span>8am</span><span>10am</span><span>12pm</span><span>2pm</span><span>4pm</span><span>6pm</span><span>8pm</span><span>10pm</span>
          </div>
          <div className="relative h-14 bg-mindflow-bg rounded-lg overflow-hidden">
            {/* Calendar blocks (gray, full height, slightly transparent) */}
            {dayBlocks.map(b => {
              const sp = ((b.startHour - 6) / 16) * 100;
              const wp = (b.durationHours / 16) * 100;
              const c = TYPE_COLORS[b.type] || TYPE_COLORS.other;
              return (
                <div key={b.id} className="absolute top-0 bottom-0 flex items-center px-2 overflow-hidden"
                  style={{ left: sp + '%', width: Math.max(2, wp) + '%', backgroundColor: c + '18', borderLeft: '2px solid ' + c, borderRight: '2px solid ' + c }}>
                  <span className="text-[9px] text-mindflow-muted truncate w-full">{b.label}</span>
                </div>
              );
            })}
            {/* Sessions (colored, positioned on top half) */}
            {sessions.map((s, i) => {
              const sp = ((s.startTick - 36) / 96) * 100;
              const wp = ((s.endTick - s.startTick) / 96) * 100;
              const c = TYPE_COLORS[s.task.type] || TYPE_COLORS.other;
              return (
                <div key={i} className="absolute top-1 h-6 rounded flex items-center px-2 overflow-hidden"
                  style={{ left: Math.max(0, sp) + '%', width: Math.max(2, Math.min(wp, 100 - Math.max(0, sp))) + '%', backgroundColor: c + '55', borderLeft: '3px solid ' + c }}
                  title={`${s.task.title} · ${TYPE_LABELS[s.task.type]} · ${s.task.difficulty}⭐`}>
                  <span className="text-[9px] text-white truncate w-full font-medium">{s.task.title}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-mindflow-muted">
            {Object.entries(TYPE_COLORS).map(([t, c]) => (
              <div key={t} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />{TYPE_LABELS[t]}
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm border border-mindflow-muted bg-transparent" />Class
            </div>
          </div>
        </div>
      )}

      {/* ── Daily fatigue curve ── */}
      {fatigueCurve.length > 0 && (
        <SessionChart
          timeline={fatigueCurve}
          burnoutTick={-1}
          showReferenceLine={false}
          height={280}
          title={`${selectedDay} — Aggregate Fatigue Curve`}
        />
      )}

      {/* ── Session cards ── */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-mindflow-heading">{selectedDay} Study Sessions</h3>
          {sessions.map((s, i) => (
            <div key={i} className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
                className="w-full p-4 flex items-center justify-between hover:bg-mindflow-bg/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[s.task.type] || TYPE_COLORS.other }} />
                  <div className="min-w-0">
                    <p className="text-mindflow-heading font-medium truncate">{s.task.title}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-xs text-mindflow-muted">
                      <span>{TYPE_LABELS[s.task.type]}</span><span className="opacity-50">·</span>
                      <span className={s.task.priority === 'high' ? 'text-red-400' : s.task.priority === 'medium' ? 'text-yellow-400' : ''}>
                        {s.task.priority === 'high' ? '🔴 High' : s.task.priority === 'medium' ? '🟡 Medium' : '⚪ Low'}
                      </span>
                      <span className="opacity-50">·</span>
                      <span className="text-yellow-400">{'★'.repeat(s.task.difficulty)}</span>
                      <span className="opacity-50">·</span>
                      <span>{s.task.durationMins}min</span>
                      {s.burnoutTick > 0 && (
                        <><span className="opacity-50">·</span><span className="text-mindflow-danger flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Break inserted</span></>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 ml-3">
                  {expanded[i] ? <ChevronUp className="w-5 h-5 text-mindflow-muted" /> : <ChevronDown className="w-5 h-5 text-mindflow-muted" />}
                </div>
              </button>
              {expanded[i] && (
                <div className="px-4 pb-4 border-t border-mindflow-border pt-3 space-y-3">
                  <SessionChart timeline={s.timeline} burnoutTick={s.burnoutTick} height={150} />
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {(() => {
                      const fv = s.timeline.map(p => p.flow);
                      const fatv = s.timeline.map(p => p.fatigue);
                      const af = fv.reduce((a, b) => a + b, 0) / fv.length;
                      return (<>
                        <div className="bg-mindflow-bg rounded-lg py-2.5">
                          <p className="text-[10px] text-mindflow-muted uppercase">Peak Flow</p>
                          <p className="text-sm font-semibold text-mindflow-success mt-0.5">{Math.round(Math.max(...fv) * 100)}%</p>
                        </div>
                        <div className="bg-mindflow-bg rounded-lg py-2.5">
                          <p className="text-[10px] text-mindflow-muted uppercase">Peak Fatigue</p>
                          <p className="text-sm font-semibold text-mindflow-danger mt-0.5">{Math.round(Math.max(...fatv) * 100)}%</p>
                        </div>
                        <div className="bg-mindflow-bg rounded-lg py-2.5">
                          <p className="text-[10px] text-mindflow-muted uppercase">Avg Flow</p>
                          <p className="text-sm font-semibold text-mindflow-accent mt-0.5">{Math.round(af * 100)}%</p>
                        </div>
                      </>);
                    })()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Unscheduled tasks ── */}
      {optimizedWeek.unscheduled && optimizedWeek.unscheduled.length > 0 && (
        <div className="bg-mindflow-surface border border-mindflow-warning/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-mindflow-warning" />
            <h3 className="text-sm font-medium text-mindflow-heading">
              Couldn't Schedule ({optimizedWeek.unscheduled.length} task{optimizedWeek.unscheduled.length !== 1 ? 's' : ''})
            </h3>
          </div>
          <p className="text-xs text-mindflow-muted mb-3">
            These tasks are too long for your available free time. Try reducing their estimated duration,
            lowering the priority of other tasks, or freeing up calendar space.
          </p>
          <div className="space-y-2">
            {optimizedWeek.unscheduled.map((task, i) => (
              <div key={i} className="bg-mindflow-bg rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-mindflow-text font-medium">{task.title}</p>
                  <p className="text-xs text-mindflow-muted">
                    {task.type} · {task.difficulty}⭐ · {task.durationMins}min ·{' '}
                    {task.priority === 'high' ? '🔴 High' : task.priority === 'medium' ? '🟡 Medium' : '⚪ Low'} priority
                  </p>
                </div>
                <span className="text-xs text-mindflow-warning font-medium">
                  Needs {Math.ceil(task.durationMins / 60)}h{task.durationMins % 60 > 0 ? ` ${task.durationMins % 60}m` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty day ── */}
      {sessions.length === 0 && (
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-10 text-center">
          <p className="text-mindflow-muted text-sm">No tasks scheduled for {selectedDay}.</p>
          <p className="text-xs text-mindflow-muted mt-1">
            {selectedDay === 'Sat' || selectedDay === 'Sun'
              ? 'Rest day — enjoy your weekend! 🎉'
              : 'Free day. Add more tasks or adjust your calendar.'}
          </p>
        </div>
      )}
    </div>
  );
}
