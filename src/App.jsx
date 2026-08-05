import { useState, useCallback, useRef } from 'react';
import { Brain, Play, AlertCircle, Settings, RefreshCw, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import StroopTestModal from './components/StroopTestModal.jsx';
import WeeklyCalendar from './components/WeeklyCalendar.jsx';
import TaskInputForm from './components/TaskInputForm.jsx';
import generateWeeklySchedule from './utils/scheduler.js';
import {
  saveCalibration, loadCalibration,
  saveCalendar, loadCalendar,
  saveTasks, loadTasks,
  saveSettings, loadSettings,
  clearAll,
} from './utils/storage.js';

const TYPE_COLORS = { academic: '#3b82f6', sports: '#22c55e', arts: '#8b5cf6', other: '#6b7280' };

function fmtHr(h) {
  const hh = Math.floor(h), p = hh >= 12 ? 'pm' : 'am';
  const d = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
  return `${d}${p}`;
}

// Compute this week's Monday as ISO date string (timezone-safe)
function getWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const y = mon.getFullYear(), m = String(mon.getMonth() + 1).padStart(2, '0'), d = String(mon.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function getDateForDay(dayName, weekStart) {
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const idx = DAYS.indexOf(dayName);
  if (idx < 0) return '';
  const [y, m, d] = weekStart.split('-').map(Number);
  const date = new Date(y, m - 1, d + idx);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function App() {
  const weekStart = getWeekMonday();
  const [calibration, setCalibrationState] = useState(() => loadCalibration());
  const [calendarBlocks, setCalendarBlocksState] = useState(() => loadCalendar());
  const [tasks, setTasksState] = useState(() => loadTasks());
  const [settings, setSettingsState] = useState(() => loadSettings());

  const [showWelcome, setShowWelcome] = useState(() => !loadCalibration());
  const [optimizedWeek, setOptimizedWeek] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const dataVersionRef = useRef(0);
  const isStale = optimizedWeek && (dataVersionRef.current > 0);

  const setCalibration = (cal) => { setCalibrationState(cal); saveCalibration(cal); };
  const setCalendarBlocks = (blocks) => { setCalendarBlocksState(blocks); saveCalendar(blocks); dataVersionRef.current++; };
  const setTasks = (t) => { setTasksState(t); saveTasks(t); dataVersionRef.current++; };
  const setSettings = (s) => { setSettingsState(s); saveSettings(s); };

  const handleGenerate = useCallback(() => {
    if (isCalculating) return;
    setError(null);
    if (!calibration || typeof calibration.alphaScore !== 'number') {
      setError('Take the calibration test first (Calibrate tab).');
      return;
    }
    if (tasks.length === 0) { setError('Add at least one task first.'); return; }
    setIsCalculating(true);
    setTimeout(() => {
      try {
        const result = generateWeeklySchedule(calendarBlocks, tasks, calibration.alphaScore, settings, weekStart);
        setOptimizedWeek(result);
        dataVersionRef.current = 0;
        setIsCalculating(false);
      } catch (err) {
        console.error(err);
        setError('Failed to generate schedule.');
        setIsCalculating(false);
      }
    }, 100);
  }, [calibration, calendarBlocks, tasks, settings, isCalculating]);

  const handleCalibrationComplete = (cal) => { setCalibration(cal); setShowWelcome(false); };
  const handleSkipCalibration = () => {
    setCalibration({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    setShowWelcome(false);
  };
  const handleReset = () => {
    if (confirm('Delete all your data? This cannot be undone.')) { clearAll(); window.location.reload(); }
  };
  const canGenerate = calibration && tasks.length > 0;

  // ── Welcome ──
  if (showWelcome) {
    return (
      <div className="min-h-screen bg-mindflow-bg flex items-center justify-center px-4">
        <WelcomeScreen onStart={() => setShowWelcome(false)} onSkip={handleSkipCalibration} />
      </div>
    );
  }

  // ── Result calendar: fixed blocks + scheduled study tasks ──
  const renderResultCalendar = () => {
    if (!optimizedWeek) return null;
    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am–10pm
    const ROW_H = 52; // px per hour

    return (
      <div className="space-y-4">
        {/* Stats row */}
        {optimizedWeek.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              [optimizedWeek.stats.totalScheduledHours + 'h', 'Scheduled'],
              [optimizedWeek.stats.utilizationPct + '%', 'Capacity'],
              [optimizedWeek.stats.workloadBalance + '%', 'Balance'],
              [(optimizedWeek.stats.avgFatigue || 0) + '%', 'Avg Fatigue'],
            ].map(([val, label], i) => (
              <div key={i} className="bg-mindflow-surface border border-mindflow-border rounded-lg py-2">
                <p className="text-lg font-bold text-mindflow-heading">{val}</p>
                <p className="text-[10px] text-mindflow-muted">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {optimizedWeek.warnings?.length > 0 && (
          <div className="space-y-1">
            {optimizedWeek.warnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
                w.severity === 'high' ? 'bg-mindflow-danger/10 text-mindflow-danger' :
                w.severity === 'medium' ? 'bg-mindflow-warning/10 text-mindflow-warning' :
                'bg-mindflow-bg text-mindflow-muted'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{w.message}{w.detail ? ` — ${w.detail}` : ''}</span>
              </div>
            ))}
          </div>
        )}

        {/* Calendar grid with everything */}
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-mindflow-border bg-mindflow-bg/50">
            {DAYS.map(d => {
              const n = calendarBlocks.filter(b => b.day === d).length + (optimizedWeek.days[d]?.sessions?.length || 0);
              return (
                <div key={d} className="px-2 py-2 text-center border-r border-mindflow-border last:border-r-0">
                  <span className="text-[10px] font-semibold text-mindflow-heading">{d}</span>
                  <span className="block text-[9px] text-mindflow-muted">{getDateForDay(d, weekStart)}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 overflow-x-auto" style={{ minWidth: '840px' }}>
            {DAYS.map(day => (
              <div key={day} className="relative border-r border-mindflow-border last:border-r-0" style={{ height: 17 * ROW_H + 'px' }}>
                {/* Hour lines */}
                {HOURS.map((h, i) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-mindflow-border/30" style={{ top: i * ROW_H + 'px' }}>
                    {day === 'Mon' && (
                      <span className="absolute -left-12 top-0 text-[9px] text-mindflow-muted w-10 text-right pr-1 -translate-y-1/2">{fmtHr(h)}</span>
                    )}
                  </div>
                ))}

                {/* Fixed calendar blocks */}
                {calendarBlocks.filter(b => b.day === day).map(b => {
                  const c = TYPE_COLORS[b.type] || TYPE_COLORS.other;
                  const top = (b.startHour - 6) * ROW_H;
                  const h = b.durationHours * ROW_H;
                  return (
                    <div key={b.id} className="absolute left-1 right-1 rounded-md px-2 py-0.5 overflow-hidden"
                      style={{ top: top + 1, height: Math.max(h - 2, 18), backgroundColor: c + '1a', borderLeft: '3px solid ' + c, zIndex: 5 }}>
                      <p className="text-[10px] font-medium text-white/80 truncate">{b.label}</p>
                      {h >= 40 && <p className="text-[9px] text-mindflow-muted">{fmtHr(b.startHour)}–{fmtHr(b.startHour + b.durationHours)}</p>}
                    </div>
                  );
                })}

                {/* Scheduled study sessions */}
                {(optimizedWeek.days[day]?.sessions || []).map((s, i) => {
                  const c = TYPE_COLORS[s.task.type] || TYPE_COLORS.other;
                  const startH = s.startTick / 6;
                  const endH = s.endTick / 6;
                  const top = (startH - 6) * ROW_H;
                  const h = (endH - startH) * ROW_H;
                  return (
                    <div key={'sess-' + i} className="absolute left-3 right-3 rounded-md px-2 py-0.5 overflow-hidden"
                      style={{ top: top + 3, height: Math.max(h - 6, 16), backgroundColor: c + '44', borderLeft: '4px solid ' + c, zIndex: 10 }}>
                      <p className="text-[10px] font-semibold text-white truncate">{s.task.title}</p>
                      {h >= 36 && <p className="text-[9px] opacity-70">{fmtHr(startH)}–{fmtHr(endH)} · {'★'.repeat(s.task.difficulty)}</p>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Unscheduled */}
        {optimizedWeek.unscheduled?.length > 0 && (
          <div className="bg-mindflow-warning/10 border border-mindflow-warning/30 rounded-xl p-4">
            <p className="text-sm font-medium text-mindflow-warning flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {optimizedWeek.unscheduled.length} task{optimizedWeek.unscheduled.length !== 1 ? 's' : ''} couldn't fit
            </p>
            <p className="text-xs text-mindflow-muted mt-1">
              {optimizedWeek.unscheduled.map(t => t.title).join(', ')} — try reducing duration or freeing up calendar space.
            </p>
          </div>
        )}

        {/* Stale + regenerate */}
        {isStale && (
          <div className="flex justify-center">
            <button onClick={handleGenerate} className="bg-mindflow-warning text-mindflow-bg px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Schedule Changed — Regenerate
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Main app ──
  return (
    <div className="min-h-screen bg-mindflow-bg flex flex-col">
      {/* Header */}
      <header className="bg-mindflow-surface border-b border-mindflow-border px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-mindflow-accent" />
          <h1 className="text-lg font-bold text-mindflow-heading">MindFlow</h1>
          <span className="text-[11px] text-mindflow-muted">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          {calibration && (
            <span className="text-xs bg-mindflow-accent/10 text-mindflow-accent px-2 py-0.5 rounded-full">
              α {calibration.alphaScore.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {optimizedWeek && isStale && (
            <button onClick={handleGenerate} className="text-xs bg-mindflow-warning/15 text-mindflow-warning px-3 py-1.5 rounded-lg font-medium hover:opacity-90">
              <RefreshCw className="w-3 h-3 inline mr-1" />Regenerate
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-mindflow-accent text-white' : 'text-mindflow-muted hover:text-mindflow-text'}`}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-mindflow-surface border-b border-mindflow-border px-6 py-3 animate-fade-in">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-mindflow-muted">Chronotype:</span>
            {['morning', 'neutral', 'night'].map(c => (
              <button key={c} onClick={() => setSettings(s => ({ ...s, chronotype: c }))}
                className={`px-2.5 py-1 rounded-md capitalize ${settings.chronotype === c ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}>{c}</button>
            ))}
            <span className="text-mindflow-muted ml-2">Hrs/day:</span>
            <input type="number" value={settings.maxHoursPerDay} min={1} max={16}
              onChange={e => setSettings(s => ({ ...s, maxHoursPerDay: Number(e.target.value) }))}
              className="w-12 bg-mindflow-bg border border-mindflow-border rounded px-2 py-1 text-mindflow-text focus:border-mindflow-accent focus:outline-none" />
            <span className="text-mindflow-muted">Weekend:</span>
            <input type="number" value={settings.maxHoursWeekend} min={0} max={12}
              onChange={e => setSettings(s => ({ ...s, maxHoursWeekend: Number(e.target.value) }))}
              className="w-12 bg-mindflow-bg border border-mindflow-border rounded px-2 py-1 text-mindflow-text focus:border-mindflow-accent focus:outline-none" />
            <button onClick={handleReset} className="ml-auto px-3 py-1 rounded-md bg-mindflow-danger/10 text-mindflow-danger hover:bg-mindflow-danger/20 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />Reset All
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-mindflow-danger/10 border-b border-mindflow-danger/30 px-6 py-2 flex items-center gap-2 text-sm text-mindflow-danger">
          <AlertCircle className="w-4 h-4" />{error}
          <button onClick={() => setError(null)} className="ml-auto text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Calibration */}
        <section>
          <h2 className="text-sm font-medium text-mindflow-heading mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-mindflow-accent text-white text-[10px] font-bold flex items-center justify-center">1</span>
            Calibration
            {calibration && <CheckCircle2 className="w-4 h-4 text-mindflow-success" />}
          </h2>
          {!calibration ? (
            <StroopTestModal onComplete={handleCalibrationComplete} onSkip={handleSkipCalibration} existingCalibration={calibration} />
          ) : (
            <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm text-mindflow-text">Focus Score: <strong className="text-mindflow-heading">{calibration.alphaScore.toFixed(2)}</strong></span>
              <button onClick={() => { setCalibrationState(null); try { localStorage.removeItem('mindflow_calibration'); } catch {} }}
                className="text-xs text-mindflow-muted hover:text-mindflow-text underline">Retake</button>
            </div>
          )}
        </section>

        {/* Fixed Schedule */}
        <section>
          <h2 className="text-sm font-medium text-mindflow-heading mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-mindflow-accent text-white text-[10px] font-bold flex items-center justify-center">2</span>
            Fixed Weekly Schedule
            {calendarBlocks.length > 0 && <CheckCircle2 className="w-4 h-4 text-mindflow-success" />}
          </h2>
          <WeeklyCalendar blocks={calendarBlocks} onChange={setCalendarBlocks} weekStart={weekStart} />
        </section>

        {/* Tasks */}
        <section>
          <h2 className="text-sm font-medium text-mindflow-heading mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-mindflow-accent text-white text-[10px] font-bold flex items-center justify-center">3</span>
            Study Tasks
            {tasks.length > 0 && <CheckCircle2 className="w-4 h-4 text-mindflow-success" />}
          </h2>
          <TaskInputForm tasks={tasks} onChange={setTasks} />
        </section>

        {/* Generate */}
        <div className="text-center">
          {canGenerate && !optimizedWeek && (
            <button onClick={handleGenerate} disabled={isCalculating}
              className="bg-mindflow-accent text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:opacity-90 shadow-xl shadow-mindflow-accent/20 active:scale-[0.98] flex items-center gap-3 mx-auto disabled:opacity-50">
              {isCalculating ? (
                <><span className="animate-pulse">Generating...</span></>
              ) : (
                <><Play className="w-5 h-5" /> Generate Schedule</>
              )}
            </button>
          )}
        </div>

        {/* Results */}
        {optimizedWeek && renderResultCalendar()}
      </main>

      <footer className="border-t border-mindflow-border bg-mindflow-surface/50 px-6 py-3">
        <p className="text-center text-[10px] text-mindflow-muted">MindFlow v5</p>
      </footer>
    </div>
  );
}
