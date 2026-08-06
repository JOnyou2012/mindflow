import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Brain, Play, AlertCircle, Settings, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';
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
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const p = hh >= 12 ? 'pm' : 'am';
  const d = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
  return mm > 0 ? `${d}:${String(mm).padStart(2, '0')}${p}` : `${d}${p}`;
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
  // Compute weekStart for a given offset (0 = this week)
  const getWeekStart = (offset = 0) => {
    const [y, m, d] = getWeekMonday().split('-').map(Number);
    const date = new Date(y, m - 1, d + offset * 7);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  };
  const weekStart = getWeekStart(0);
  const [calibration, setCalibrationState] = useState(() => loadCalibration());
  const [calendarBlocks, setCalendarBlocksState] = useState(() => loadCalendar());
  const [tasks, setTasksState] = useState(() => loadTasks());
  const [settings, setSettingsState] = useState(() => loadSettings());

  const [showWelcome, setShowWelcome] = useState(() => !loadCalibration());
  const [weekResults, setWeekResults] = useState({}); // weekStart -> result
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('mindflow_theme') || 'dark'; } catch { return 'dark'; }});
  const [accent, setAccent] = useState(() => { try { return localStorage.getItem('mindflow_accent') || '#8b5cf6'; } catch { return '#8b5cf6'; }});

  // Persist theme + accent
  useEffect(() => { try { localStorage.setItem('mindflow_theme', theme); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem('mindflow_accent', accent); } catch {} }, [accent]);

  // Apply theme: toggle light class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
      root.style.setProperty('--color-mindflow-bg', '#f5f5f7');
      root.style.setProperty('--color-mindflow-surface', '#ffffff');
      root.style.setProperty('--color-mindflow-border', '#e0e0e6');
      root.style.setProperty('--color-mindflow-text', '#3a3a44');
      root.style.setProperty('--color-mindflow-heading', '#1a1a24');
      root.style.setProperty('--color-mindflow-muted', '#888899');
    } else {
      root.classList.remove('light-theme');
      root.style.removeProperty('--color-mindflow-bg');
      root.style.removeProperty('--color-mindflow-surface');
      root.style.removeProperty('--color-mindflow-border');
      root.style.removeProperty('--color-mindflow-text');
      root.style.removeProperty('--color-mindflow-heading');
      root.style.removeProperty('--color-mindflow-muted');
    }
  }, [theme]);

  // Apply accent as CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--color-mindflow-accent', accent);
  }, [accent]);

  const allBlocks = useMemo(() => [...calendarBlocks], [calendarBlocks]);

  const dataVersionRef = useRef(0);
  const isStale = Object.keys(weekResults).length > 0 && (dataVersionRef.current > 0);

  const setCalibration = (cal) => { setCalibrationState(cal); saveCalibration(cal); };
  const setCalendarBlocks = (blocks) => { setCalendarBlocksState(blocks); saveCalendar(blocks); dataVersionRef.current++; };
  const setTasks = (t) => { setTasksState(t); saveTasks(t); dataVersionRef.current++; };
  const setSettings = (s) => { setSettingsState(s); saveSettings(s); };

  const handleGenerate = useCallback(() => {
    if (isCalculating) return;
    setError(null);
    if (!calibration || typeof calibration.alphaScore !== 'number') {
      setError('Take the calibration test first.');
      return;
    }
    if (tasks.length === 0) { setError('Add at least one task first.'); return; }
    setIsCalculating(true);
    setTimeout(() => {
      try {
        const results = {};
        let remaining = [...tasks];
        let w = 0;
        // Cascade with per-week capacity limit. Don't fill any week
        // beyond 70% — forces tasks to spread into future weeks when
        // deadlines allow it. Later weeks use higher limits.
        while (remaining.length > 0 && w < 8) {
          const ws = getWeekStart(w);
          // Filter: only pass tasks whose deadline is within range of this week.
          // Tasks due > 10 days after this week's end wait for a later week.
          const weekEndDate = new Date(ws + 'T00:00:00');
          weekEndDate.setDate(weekEndDate.getDate() + 6);
          const eligible = remaining.filter(t => {
            if (!t.deadline) return true; // no deadline = can go any week
            const dl = new Date(t.deadline + 'T00:00:00');
            return !isNaN(dl.getTime()) && dl <= new Date(weekEndDate.getTime() + 10 * 86400000);
          });
          const deferred = remaining.filter(t => !eligible.includes(t));
          // Light capacity cap
          const weekCap = 0.80 + Math.min(w * 0.10, 0.20);
          const cappedSettings = { ...settings, maxHoursPerDay: Math.round((settings.maxHoursPerDay || 8) * weekCap) };
          const result = generateWeeklySchedule(allBlocks, eligible, calibration.alphaScore, cappedSettings, ws);
          // Combine: deferred tasks + any unscheduled from this week
          remaining = [...(result.unscheduled || []), ...deferred];
          results[ws] = result;
          w++;
        }
        setWeekResults(results);
        dataVersionRef.current = 0;
        setIsCalculating(false);
      } catch (err) {
        console.error(err);
        setError('Failed to generate schedule.');
        setIsCalculating(false);
      }
    }, 100);
  }, [calibration, allBlocks, tasks, settings, isCalculating, weekStart]);

  const handleCalibrationComplete = (cal) => { setCalibration(cal); setShowWelcome(false); };
  const handleSkipCalibration = () => {
    setCalibration({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    setShowWelcome(false);
  };
  const handleReset = () => {
    if (confirm('Delete all your data? This cannot be undone.')) {
      clearAll();
      try { localStorage.removeItem('mindflow_theme'); } catch {}
      try { localStorage.removeItem('mindflow_accent'); } catch {}
      window.location.reload();
    }
  };
  const canGenerate = calibration && tasks.length > 0;
  const hasResults = Object.keys(weekResults).length > 0;

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
    if (!currentResult) return null;
    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am–10pm
    const ROW_H = 52; // px per hour

    return (
      <div className="space-y-4">
        {/* Stats row */}
        {currentResult.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              [currentResult.stats.totalScheduledHours + 'h', 'Scheduled'],
              [currentResult.stats.utilizationPct + '%', 'Capacity'],
              [currentResult.stats.workloadBalance + '%', 'Balance'],
              [(currentResult.stats.avgFatigue || 0) + '%', 'Avg Fatigue'],
            ].map(([val, label], i) => (
              <div key={i} className="bg-mindflow-surface border border-mindflow-border rounded-lg py-2">
                <p className="text-lg font-bold text-mindflow-heading">{val}</p>
                <p className="text-[10px] text-mindflow-muted">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {currentResult.warnings?.length > 0 && (
          <div className="space-y-1">
            {currentResult.warnings.map((w, i) => (
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
              const n = calendarBlocks.filter(b => b.day === d).length + (currentResult.days[d]?.sessions?.length || 0);
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
                {(currentResult.days[day]?.sessions || []).map((s, i) => {
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
        {currentResult.unscheduled?.length > 0 && (
          <div className="bg-mindflow-warning/10 border border-mindflow-warning/30 rounded-xl p-4">
            <p className="text-sm font-medium text-mindflow-warning flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {currentResult.unscheduled.length} task{currentResult.unscheduled.length !== 1 ? 's' : ''} couldn't fit
            </p>
            <p className="text-xs text-mindflow-muted mt-1">
              {currentResult.unscheduled.map(t => t.title).join(', ')} — try reducing duration or freeing up calendar space.
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
          {hasResults && isStale && (
            <button onClick={handleGenerate} className="text-xs bg-mindflow-warning/15 text-mindflow-warning px-3 py-1.5 rounded-lg font-medium hover:opacity-90">
              <RefreshCw className="w-3 h-3 inline mr-1" />Regen
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
        <div className="bg-mindflow-surface border-b border-mindflow-border px-6 py-4 animate-fade-in">
          <div className="max-w-2xl mx-auto space-y-4 text-sm">
            {/* Theme */}
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs w-20 shrink-0">Theme</span>
              {['dark', 'light'].map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${theme === t ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}>{t}</button>
              ))}
            </div>

            {/* Accent color */}
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs w-20 shrink-0">Accent</span>
              {['#8b5cf6','#3b82f6','#22c55e','#f97316','#ec4899','#06b6d4'].map(c => (
                <button key={c} onClick={() => setAccent(c)}
                  className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                  style={{ backgroundColor: c, borderColor: accent === c ? '#fff' : 'transparent', boxShadow: accent === c ? '0 0 0 2px ' + c + '40' : 'none' }} />
              ))}
            </div>

            {/* Chronotype */}
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs w-20 shrink-0">Chronotype</span>
              {['morning', 'neutral', 'night'].map(c => (
                <button key={c} onClick={() => setSettings(s => ({ ...s, chronotype: c }))}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${settings.chronotype === c ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}>{c}</button>
              ))}
            </div>

            {/* Daily hours */}
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs w-20 shrink-0">Hours/day</span>
              <span className="text-mindflow-muted text-[10px]">Weekday</span>
              <input type="number" value={settings.maxHoursPerDay} min={1} max={16}
                onChange={e => setSettings(s => ({ ...s, maxHoursPerDay: Number(e.target.value) }))}
                className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none" />
              <span className="text-mindflow-muted text-[10px] ml-2">Weekend</span>
              <input type="number" value={settings.maxHoursWeekend} min={0} max={12}
                onChange={e => setSettings(s => ({ ...s, maxHoursWeekend: Number(e.target.value) }))}
                className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none" />
            </div>

            {/* Reset */}
            <div className="pt-2 border-t border-mindflow-border">
              <button onClick={handleReset} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-mindflow-danger/10 text-mindflow-danger hover:bg-mindflow-danger/20 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" />Reset All Data
              </button>
            </div>
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
          <WeeklyCalendar blocks={allBlocks} onChange={setCalendarBlocks} weekStart={weekStart} />
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
          {canGenerate && !hasResults && (
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

        {/* Results — ALWAYS show 4 weeks, scroll horizontally */}
        {hasResults && (
          <div className="overflow-x-auto pb-4 -mx-4 px-4" style={{ scrollSnapType: 'x mandatory' }}>
            <div className="flex gap-6" style={{ minWidth: '3500px' }}>
              {[0, 1, 2, 3].map(weekNum => {
                const ws = getWeekStart(weekNum);
                const result = weekResults[ws];
                const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
                const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
                const ROW_H = 60;
                const d = new Date(ws + 'T00:00:00');
                const end = new Date(d); end.setDate(end.getDate() + 6);
                const isThisWeek = weekNum === 0;

                return (
                  <div key={ws} className="shrink-0 space-y-3 snap-start" style={{ width: '860px' }}>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-mindflow-heading">
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </h3>
                      {isThisWeek && <span className="text-[10px] bg-mindflow-accent/15 text-mindflow-accent px-2 py-0.5 rounded-full">This week</span>}
                      {result?.stats && <span className="text-xs text-mindflow-muted">{result.stats.totalScheduledHours}h scheduled</span>}
                      {!result && <span className="text-xs text-mindflow-muted">(empty)</span>}
                    </div>

                    <div className="bg-mindflow-surface border border-mindflow-border rounded-xl overflow-hidden">
                      <div className="grid grid-cols-7 border-b border-mindflow-border bg-mindflow-bg/50">
                        {DAYS.map(day => {
                          const dayFullDate = (() => { const [y,m,d]=ws.split('-').map(Number); const dt=new Date(y,m-1,d+DAYS.indexOf(day)); return dt.toISOString().split('T')[0]; })();
                          const isPast = dayFullDate < new Date().toISOString().split('T')[0];
                          return (
                          <div key={day} className={`px-1 py-1.5 text-center border-r border-mindflow-border last:border-r-0 ${isPast ? 'opacity-40' : ''}`}>
                            <span className="text-[11px] font-semibold text-mindflow-heading">{day}</span>
                            <span className="block text-[9px] text-mindflow-muted">{isPast ? 'Past' : getDateForDay(day, ws)}</span>
                          </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-7">
                        {DAYS.map(day => {
                          const dayDate = getDateForDay(day, ws);
                          const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          const isTodayCol = dayDate === todayStr;
                          const dayFullDate = (() => { const [y,m,d]=ws.split('-').map(Number); const dt=new Date(y,m-1,d+DAYS.indexOf(day)); return dt.toISOString().split('T')[0]; })();
                          const isPastCol = dayFullDate < new Date().toISOString().split('T')[0];
                          return (
                          <div key={day} className={`relative border-r border-mindflow-border last:border-r-0 ${isTodayCol ? 'bg-mindflow-accent/5' : ''} ${isPastCol ? 'opacity-40' : ''}`} style={{ height: 17 * ROW_H + 'px' }}>
                            {HOURS.map((h, i) => (
                              <div key={h} className="absolute left-0 right-0 border-t border-mindflow-border/30" style={{ top: i * ROW_H + 'px' }}>
                                {day === 'Mon' && <span className="absolute -left-12 top-0 text-[9px] text-mindflow-muted w-10 text-right pr-1 -translate-y-1/2">{fmtHr(h)}</span>}
                              </div>
                            ))}
                            {allBlocks.filter(b => b.day === day).map(b => {
                              const c = TYPE_COLORS[b.type] || TYPE_COLORS.other;
                              const top = (b.startHour - 6) * ROW_H, bh = b.durationHours * ROW_H;
                              return <div key={b.id} className="absolute left-1 right-1 rounded px-1.5 py-0.5 overflow-hidden" style={{ top: top + 1, height: Math.max(bh - 2, 18), backgroundColor: c + '1a', borderLeft: '2px solid ' + c, zIndex: 5 }}>
                                <p className="text-[10px] font-medium text-white/80 truncate">{b.label}</p>
                                {bh >= 36 && <p className="text-[9px] text-white/50">{fmtHr(b.startHour)}–{fmtHr(b.startHour + b.durationHours)}</p>}
                              </div>;
                            })}
                            {(result?.days?.[day]?.sessions || []).map((s, i) => {
                              const c = TYPE_COLORS[s.task.type] || TYPE_COLORS.other;
                              const sh = s.startTick / 6, eh = s.endTick / 6;
                              const top = (sh - 6) * ROW_H, bh = (eh - sh) * ROW_H;
                              const startLabel = fmtHr(sh), endLabel = fmtHr(eh);
                              return <div key={'s'+i} className="absolute left-2 right-2 rounded px-1.5 py-0.5 overflow-hidden" style={{ top: top + 2, height: Math.max(bh - 4, 16), backgroundColor: c + '44', borderLeft: '3px solid ' + c, zIndex: 10 }}>
                                <p className="text-[10px] font-semibold text-white truncate">{s.task.title}</p>
                                <p className="text-[9px] text-white/70">{startLabel}–{endLabel}</p>
                              </div>;
                            })}
                          </div>
                          );
                        })}
                      </div>
                    </div>

                    {result?.warnings?.length > 0 && result.warnings.map((w,i) => (
                      <div key={i} className="text-[10px] text-mindflow-warning bg-mindflow-warning/10 rounded px-2 py-1">⚠ {w.message}</div>
                    ))}
                    {result?.unscheduled?.length > 0 && (
                      <div className="text-[10px] text-mindflow-muted">+{result.unscheduled.length} task{result.unscheduled.length!==1?'s':''} rolled to next week</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-mindflow-border bg-mindflow-surface/50 px-6 py-3">
        <p className="text-center text-[10px] text-mindflow-muted">MindFlow v5</p>
      </footer>
    </div>
  );
}
