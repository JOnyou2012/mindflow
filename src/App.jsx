import { useState, useCallback, useEffect, useRef } from 'react';
import { Brain, Calendar, BarChart3, Zap, Play, AlertCircle, Settings, RefreshCw, Trash2 } from 'lucide-react';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import StroopTestModal from './components/StroopTestModal.jsx';
import WeeklyCalendar from './components/WeeklyCalendar.jsx';
import TaskInputForm from './components/TaskInputForm.jsx';
import MarkovAnalyticsDashboard from './components/MarkovAnalyticsDashboard.jsx';
import generateWeeklySchedule from './utils/scheduler.js';
import {
  saveCalibration, loadCalibration,
  saveCalendar, loadCalendar,
  saveTasks, loadTasks,
  saveSettings, loadSettings,
  clearAll,
} from './utils/storage.js';

const TABS = [
  { id: 'calibrate', label: 'Calibration', icon: Brain },
  { id: 'tasks', label: 'Schedule', icon: Calendar },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
];

const DEFAULT_SETTINGS = { chronotype: 'morning', maxHoursPerDay: 8, maxHoursWeekend: 4 };

export default function App() {
  // ── Persistent state (init from localStorage) ────────────────────
  const [calibration, setCalibrationState] = useState(() => loadCalibration());
  const [calendarBlocks, setCalendarBlocksState] = useState(() => loadCalendar());
  const [tasks, setTasksState] = useState(() => loadTasks());
  const [settings, setSettingsState] = useState(() => loadSettings());

  // ── Session state ─────────────────────────────────────────────────
  const [showWelcome, setShowWelcome] = useState(() => !loadCalibration());
  const [activeTab, setActiveTab] = useState('calibrate');
  const [optimizedWeek, setOptimizedWeek] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── Stale detection ───────────────────────────────────────────────
  const lastGeneratedRef = useRef(null);
  const dataVersionRef = useRef(0);
  const isStale = optimizedWeek && (dataVersionRef.current > 0);

  // ── Wrapped setters (save to localStorage + track staleness) ─────
  const setCalibration = (cal) => { setCalibrationState(cal); saveCalibration(cal); };
  const setCalendarBlocks = (blocks) => { setCalendarBlocksState(blocks); saveCalendar(blocks); dataVersionRef.current++; };
  const setTasks = (t) => { setTasksState(t); saveTasks(t); dataVersionRef.current++; };
  const setSettings = (s) => { setSettingsState(s); saveSettings(s); };

  // ── Generate schedule ─────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    setScheduleError(null);
    if (!calibration) {
      setScheduleError('Complete the calibration test first (or skip it).');
      setActiveTab('calibrate');
      return;
    }
    if (tasks.length === 0) {
      setScheduleError('Add at least one task first.');
      setActiveTab('tasks');
      return;
    }
    setIsCalculating(true);
    // Small delay so the loading state renders before the heavy computation
    setTimeout(() => {
      try {
        const result = generateWeeklySchedule(
          calendarBlocks, tasks, calibration.alphaScore, settings
        );
        setOptimizedWeek(result);
        lastGeneratedRef.current = Date.now();
        dataVersionRef.current = 0;
        setIsCalculating(false);
        setActiveTab('dashboard');
      } catch (err) {
        console.error('Scheduler crashed:', err);
        setScheduleError('Failed to generate schedule. Check console for details.');
        setIsCalculating(false);
      }
    }, 150);
  }, [calibration, calendarBlocks, tasks, settings]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleCalibrationComplete = (cal) => { setCalibration(cal); setShowWelcome(false); };
  const handleSkipCalibration = () => {
    setCalibration({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    setShowWelcome(false);
  };
  const handleReset = () => {
    if (confirm('Delete all your data? This cannot be undone.')) {
      clearAll();
      window.location.reload();
    }
  };
  const switchTab = (id) => { setActiveTab(id); setScheduleError(null); };
  const canGenerate = calibration && tasks.length > 0;

  // ── Welcome screen (shown once, fullscreen) ───────────────────────
  if (showWelcome) {
    return (
      <div className="min-h-screen bg-mindflow-bg flex items-center justify-center px-4">
        <WelcomeScreen onStart={() => setShowWelcome(false)} onSkip={handleSkipCalibration} />
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-mindflow-bg flex flex-col">
      {/* ═══ HEADER ═══ */}
      <header className="bg-mindflow-surface border-b border-mindflow-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-mindflow-accent" />
          <h1 className="text-xl font-bold text-mindflow-heading tracking-tight">MindFlow</h1>
          <span className="text-[10px] bg-mindflow-accent/15 text-mindflow-accent px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Beta</span>
        </div>
        <div className="flex items-center gap-3">
          {calibration && (
            <div className="flex items-center gap-2 text-sm bg-mindflow-bg rounded-lg px-3 py-1.5">
              <Zap className="w-4 h-4 text-mindflow-accent" />
              <span className="text-mindflow-muted hidden sm:inline">Focus</span>
              <span className="text-mindflow-heading font-bold">{calibration.alphaScore.toFixed(2)}</span>
            </div>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-mindflow-accent text-white' : 'text-mindflow-muted hover:text-mindflow-text hover:bg-mindflow-bg'}`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          {activeTab === 'tasks' && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="bg-mindflow-accent text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-mindflow-accent/20"
            >
              <Play className="w-4 h-4" /> Generate
            </button>
          )}
          {activeTab === 'dashboard' && isStale && (
            <button
              onClick={handleGenerate}
              className="bg-mindflow-warning text-mindflow-bg px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
          )}
        </div>
      </header>

      {/* ═══ SETTINGS PANEL ═══ */}
      {showSettings && (
        <div className="bg-mindflow-surface border-b border-mindflow-border px-6 py-4 animate-fade-in">
          <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs">Chronotype:</span>
              {['morning', 'neutral', 'night'].map(c => (
                <button
                  key={c}
                  onClick={() => setSettings(s => ({ ...s, chronotype: c }))}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${settings.chronotype === c ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs">Max hrs/day (weekday):</span>
              <input
                type="number" value={settings.maxHoursPerDay} min={1} max={16}
                onChange={e => setSettings(s => ({ ...s, maxHoursPerDay: Number(e.target.value) }))}
                className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-mindflow-muted text-xs">Weekend:</span>
              <input
                type="number" value={settings.maxHoursWeekend} min={0} max={12}
                onChange={e => setSettings(s => ({ ...s, maxHoursWeekend: Number(e.target.value) }))}
                className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none"
              />
            </div>
            <button
              onClick={handleReset}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-mindflow-danger/10 text-mindflow-danger hover:bg-mindflow-danger/20 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" /> Reset All Data
            </button>
          </div>
        </div>
      )}

      {/* ═══ TABS ═══ */}
      <nav className="flex border-b border-mindflow-border bg-mindflow-bg sticky top-[65px] z-30">
        {TABS.map(tab => {
          const I = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-all border-b-2 relative ${isActive ? 'text-mindflow-accent border-mindflow-accent bg-mindflow-accent/5' : 'text-mindflow-muted border-transparent hover:text-mindflow-text hover:bg-mindflow-surface/50'}`}
            >
              <I className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === 'calibrate' && calibration && (
                <span className="w-1.5 h-1.5 rounded-full bg-mindflow-success absolute top-2 right-2" />
              )}
              {tab.id === 'tasks' && tasks.length > 0 && (
                <span className="text-[10px] bg-mindflow-accent/15 text-mindflow-accent px-1.5 py-0.5 rounded-full font-medium">{tasks.length}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ═══ ERROR BANNER ═══ */}
      {scheduleError && (
        <div className="bg-mindflow-danger/10 border-b border-mindflow-danger/30 px-6 py-3 flex items-center gap-2 text-sm text-mindflow-danger">
          <AlertCircle className="w-4 h-4 shrink-0" /> {scheduleError}
          <button onClick={() => setScheduleError(null)} className="ml-auto text-mindflow-danger/70 hover:text-mindflow-danger text-xs">Dismiss</button>
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'calibrate' && (
          <StroopTestModal
            onComplete={handleCalibrationComplete}
            onSkip={handleSkipCalibration}
            existingCalibration={calibration}
          />
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-8">
            <div className="flex items-center gap-3 text-xs text-mindflow-muted flex-wrap">
              <div className={`flex items-center gap-1.5 ${calendarBlocks.length > 0 ? 'text-mindflow-success' : ''}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">1</span>
                Set schedule
              </div>
              <span className="opacity-30">→</span>
              <div className={`flex items-center gap-1.5 ${tasks.length > 0 ? 'text-mindflow-success' : ''}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">2</span>
                Add tasks
              </div>
              <span className="opacity-30">→</span>
              <div className={`flex items-center gap-1.5 ${canGenerate ? 'text-mindflow-accent' : ''}`}>
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">3</span>
                Generate
              </div>
            </div>
            <WeeklyCalendar blocks={calendarBlocks} onChange={setCalendarBlocks} />
            <TaskInputForm tasks={tasks} onChange={setTasks} />
            {canGenerate && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleGenerate}
                  className="bg-mindflow-accent text-white px-12 py-4 rounded-2xl text-lg font-semibold hover:opacity-90 shadow-xl shadow-mindflow-accent/20 active:scale-[0.98] flex items-center gap-3"
                >
                  <Zap className="w-5 h-5" /> Generate Optimized Schedule
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <MarkovAnalyticsDashboard
            optimizedWeek={optimizedWeek}
            alpha={calibration?.alphaScore || 1.0}
            isCalculating={isCalculating}
            isStale={isStale}
            onRegenerate={handleGenerate}
            calendarBlocks={calendarBlocks}
          />
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-mindflow-border bg-mindflow-surface/50 px-6 py-4">
        <p className="text-center text-xs text-mindflow-muted">MindFlow · v0.2.0</p>
      </footer>
    </div>
  );
}
