import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Brain, Settings, Check, AlertCircle, Trash2, Play, X } from 'lucide-react';
import StroopTestModal from './components/StroopTestModal.jsx';
import WeeklyCalendar from './components/WeeklyCalendar.jsx';
import TaskInputForm from './components/TaskInputForm.jsx';
import PlanView from './components/PlanView.jsx';
import generateWeeklySchedule from './utils/scheduler.js';
import {
  saveCalibration, loadCalibration,
  saveCalendar, loadCalendar,
  saveTasks, loadTasks,
  saveSettings, loadSettings,
  clearAll, clearGoogleCache,
  loadGoogleExport, saveGoogleExport,
} from './utils/storage.js';
import { unsyncTaskEvents } from './utils/googleCalendar.js';
import { useGoogleAuth } from './utils/googleAuthContext.js';
import { isGoogleConfigured } from './utils/googleAuthCore.js';
import { LANGUAGES, getTranslations, getStoredLang, setStoredLang } from './utils/i18n.js';

// Last commit hash + commit time (UTC), injected at build time via vite
// define — the footer watermark that identifies the deployed build.
const BUILD_STAMP = __BUILD_STAMP__;

// Compute this week's Monday as ISO date string (timezone-safe)
function getWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const y = mon.getFullYear(), m = String(mon.getMonth() + 1).padStart(2, '0'), d = String(mon.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

export default function App() {
  const { isSignedIn: googleSignedIn, getToken: getGoogleToken, refreshToken: refreshGoogleToken } = useGoogleAuth();
  const getWeekStart = (offset = 0) => {
    const [y, m, d] = getWeekMonday().split('-').map(Number);
    const date = new Date(y, m - 1, d + offset * 7);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  };

  const [calibration, setCalibrationState] = useState(() => loadCalibration());
  const [calendarBlocks, setCalendarBlocksState] = useState(() => loadCalendar());
  const [tasks, setTasksState] = useState(() => loadTasks());
  const [settings, setSettingsState] = useState(() => loadSettings());
  // Google blocks are NOT restored from cache on load: the OAuth token is
  // memory-only and therefore gone on every reload, so cached blocks would
  // render next to a "Connect" button with no way to refresh them — the
  // grid and the connection state must never disagree (production bug E).
  // Re-connecting re-imports the current week.
  const [googleBlocks, setGoogleBlocks] = useState([]);

  const [step, setStep] = useState(() => (loadCalibration() ? 2 : 1));
  const [weekResults, setWeekResults] = useState({}); // weekStart -> result
  const [planVersion, setPlanVersion] = useState(0); // bumps on every generate
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [subView, setSubView] = useState('overview'); // 'overview' | sub-flow active inside steps 2–3
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('mindflow_theme') || 'light'; } catch { return 'light'; } });
  const [lang, setLang] = useState(() => getStoredLang());

  const T = useMemo(() => getTranslations(lang), [lang]);

  // Persist + apply theme (light default; dark via .dark class on <html>)
  useEffect(() => { try { localStorage.setItem('mindflow_theme', theme); } catch {} }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Sync <html lang> and dir for screen readers / search engines
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Leaving a step resets any active sub-flow
  useEffect(() => { setSubView('overview'); }, [step]);

  // Clean up the generate/hold timers on unmount
  useEffect(() => () => {
    if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  }, []);

  const dataVersionRef = useRef(0);
  const generateTimerRef = useRef(null);
  // Reveal-hold timers: generation is near-instant, so the plan reveal is
  // held for a random 0.5–3s while a progress bar fills (see handleGenerate).
  const holdTimerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const [genProgress, setGenProgress] = useState(0);
  const isStale = Object.keys(weekResults).length > 0 && dataVersionRef.current > 0;

  const setCalibration = (cal) => { setCalibrationState(cal); const ok = saveCalibration(cal); if (!ok && cal) { setError(T.saveFailed || 'Failed to save data. Storage may be full.'); } dataVersionRef.current++; };
  const setCalendarBlocks = (blocks) => { setCalendarBlocksState(blocks); const ok = saveCalendar(blocks); if (!ok) { setError(T.saveFailed || 'Failed to save data. Storage may be full.'); } dataVersionRef.current++; };
  const setTasks = (t) => {
    // Task deletions must propagate to Google Calendar: every event mapped
    // to a removed task is calendar.events.delete'd (per-event unsync).
    const removedIds = tasks.filter(old => !t.some(n => n.id === old.id)).map(x => x.id);
    setTasksState(t);
    const ok = saveTasks(t);
    if (!ok) { setError(T.saveFailed || 'Failed to save data. Storage may be full.'); }
    dataVersionRef.current++;
    if (removedIds.length > 0 && isGoogleConfigured) handleGoogleTaskUnsync(removedIds);
  };
  const setSettings = (s) => { setSettingsState(s); saveSettings(s); dataVersionRef.current++; };

  /**
   * Delete the Google Calendar events belonging to deleted tasks.
   * Mappings are cleared ONLY for events the API confirmed gone — on any
   * failure they stay tracked so a later retry or bulk Remove can still
   * clean them up (we never claim an unsync that didn't happen).
   * Signed-out (no token at all) → skip silently rather than surprise the
   * user with a consent popup during task management.
   */
  const handleGoogleTaskUnsync = useCallback(async (taskIds) => {
    if (!getGoogleToken() && !googleSignedIn) return;
    try {
      const token = await refreshGoogleToken();
      let tracking = loadGoogleExport();
      for (const id of taskIds) {
        const res = await unsyncTaskEvents(token, id, tracking);
        tracking = res.tracking;
        if (res.failed > 0) {
          setError(T.gcalUnsyncRetry);
          break;
        }
      }
      saveGoogleExport(tracking);
    } catch {
      // Token refresh failed — mappings stay in the tracking store so the
      // events can be removed later (bulk Remove after reconnecting).
    }
  }, [getGoogleToken, googleSignedIn, refreshGoogleToken, T]);

  // Google Calendar import handler
  const handleGoogleImport = (importedBlocks) => {
    setGoogleBlocks(importedBlocks);
    dataVersionRef.current++;
  };

  const handleGenerate = useCallback((onDone) => {
    if (isCalculating) return;
    setError(null);
    if (!calibration || typeof calibration.alphaScore !== 'number' || !Number.isFinite(calibration.alphaScore)) {
      setError(T.noCalibration);
      return;
    }
    if (tasks.length === 0) { setError(T.noTasks); return; }
    setIsCalculating(true);
    // Randomized reveal hold: an instant flip to the plan reads as
    // "nothing happened". Hold the reveal for a random 0.5–3s while the
    // progress bar fills, then commit.
    const holdMs = 500 + Math.random() * 2500;
    const startedAt = performance.now();
    if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    generateTimerRef.current = setTimeout(() => {
      generateTimerRef.current = null;
      try {
        const results = {};
        let remaining = [...tasks];
        let w = 0;
        // Cascade with per-week capacity limit. Don't fill any week
        // beyond ~80% — forces tasks to spread into future weeks when
        // deadlines allow it. Later weeks use higher limits.
        while (remaining.length > 0 && w < 8) {
          const ws = getWeekStart(w);
          // Only pass tasks whose deadline is within range of this week.
          const eligible = remaining.filter(t => {
            if (!t.deadline) return true;
            // Non-string deadlines (corrupted localStorage) → treat as no deadline.
            if (typeof t.deadline !== 'string') return true;
            // Normalize deadline (handles date-only, datetime, trailing-T).
            let dlStr = t.deadline;
            if (dlStr.endsWith('T')) dlStr = dlStr.slice(0, -1);
            if (!dlStr.includes('T')) dlStr += 'T23:59';
            const dl = new Date(dlStr);
            if (isNaN(dl.getTime())) return true;
            // Task is eligible if its deadline hasn't already passed before
            // this week starts.  Overdue tasks are always eligible (schedule
            // ASAP).  Far-future tasks are eligible but score lower via the
            // scheduler's deadline-week penalty — they naturally drift to
            // later weeks without being forced there by the filter.
            const weekStartDate = new Date(ws + 'T00:00:00');
            return dl >= weekStartDate || dl < new Date();
          });
          // Deferred tasks have deadlines that fall before this week starts
          // but haven't passed yet. They were unscheduled in the previous
          // week (they came from its result.unscheduled), so they are
          // already recorded there — drop them from the pool instead of
          // re-attaching (which would duplicate them in a far-away week's
          // list, miles from where the user looks).
          const deferred = remaining.filter(t => !eligible.includes(t));
          const weekCap = 0.80 + Math.min(w * 0.10, 0.20);
          const cappedSettings = { ...settings, maxHoursPerDay: Math.round((settings.maxHoursPerDay || 8) * weekCap) };
          // Google-imported blocks are week-scoped (imported for the current
          // week only). Applying them to every cascade week planted a
          // one-off event (e.g. "Dentist Tue 15:00") in all 7 future weeks.
          const allBlocks = w === 0 ? [...calendarBlocks, ...googleBlocks] : [...calendarBlocks];
          const result = generateWeeklySchedule(allBlocks, eligible, calibration.alphaScore, cappedSettings, ws);
          results[ws] = result;
          if (w === 0 && deferred.length > 0) {
            // Mathematically unreachable (this week's Monday is never in the
            // future), but never drop a task silently.
            results[ws].unscheduled = [...(results[ws].unscheduled || []), ...deferred];
          }
          remaining = [...(result.unscheduled || [])];
          w++;
        }
        // No post-loop attach needed: on exit, `remaining` is either empty
        // or exactly the last generated week's own unscheduled list, which
        // is already recorded in results.
        const commit = () => {
          if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
          if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
          setWeekResults(results);
          setPlanVersion(v => v + 1);
          dataVersionRef.current = 0;
          setIsCalculating(false);
          setGenProgress(0);
          if (onDone) onDone();
        };
        // Fill the bar over the hold window, then reveal once it elapses.
        progressTimerRef.current = setInterval(() => {
          setGenProgress(Math.min(100, Math.round(((performance.now() - startedAt) / holdMs) * 100)));
        }, 50);
        const remainingHold = Math.max(0, holdMs - (performance.now() - startedAt));
        if (remainingHold > 0) holdTimerRef.current = setTimeout(commit, remainingHold);
        else commit();
      } catch (err) {
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
        if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
        setGenProgress(0);
        console.error('Schedule generation failed:', err, {
          taskCount: tasks.length,
          blockCount: calendarBlocks.length,
          googleBlockCount: googleBlocks.length,
          alpha: calibration?.alphaScore,
          chronotype: settings?.chronotype,
          maxHoursPerDay: settings?.maxHoursPerDay,
          transitionBufferMins: settings?.transitionBufferMins,
          timestamp: new Date().toISOString(),
        });
        setError(T.scheduleGenFailed || 'Failed to generate schedule.');
        setIsCalculating(false);
      }
    }, 100);
  }, [calibration, calendarBlocks, tasks, googleBlocks, settings, isCalculating, T]);

  const handleCalibrationComplete = (cal) => { setCalibration(cal); setStep(2); };
  const handleSkipCalibration = () => {
    setCalibration({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    setStep(2);
  };
  // (setCalibration bumps dataVersionRef, so a skipped re-calibration also
  // marks an existing plan stale — alpha may have changed.)
  const handleReset = () => {
    if (confirm(T.settingsResetConfirm)) {
      clearAll();
      try { localStorage.removeItem('mindflow_theme'); } catch {}
      try { localStorage.removeItem('mindflow_accent'); } catch {}
      try { localStorage.removeItem('mindflow_lang'); } catch {}
      window.location.reload();
    }
  };

  // Logo click — go "home": a FRESH start, exactly like first launch.
  // Wipes the wizard's data (calibration, tasks, calendar, Google import
  // cache, generated plan) and lands on step 1 with the Stroop start
  // screen. App preferences (theme, language, schedule settings) are kept.
  const goHome = () => {
    if (generateTimerRef.current) { clearTimeout(generateTimerRef.current); generateTimerRef.current = null; }
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    setGenProgress(0);
    setWeekResults({});
    setIsCalculating(false);
    setError(null);
    setShowSettings(false);
    setSubView('overview');
    dataVersionRef.current = 0;
    setCalibrationState(null);
    try { localStorage.removeItem('mindflow_calibration'); } catch {}
    setTasksState([]);
    saveTasks([]);
    setCalendarBlocksState([]);
    saveCalendar([]);
    setGoogleBlocks([]);
    clearGoogleCache();
    setStep(1);
  };

  const hasResults = Object.keys(weekResults).length > 0;
  const canGenerate = calibration && tasks.length > 0;

  const STEPS = [
    { n: 1, label: T.stepCalibrate, done: !!calibration },
    { n: 2, label: T.stepSchedule, done: (calendarBlocks.length + googleBlocks.length) > 0 },
    { n: 3, label: T.stepTasks, done: tasks.length > 0 },
    { n: 4, label: T.stepPlan, done: hasResults },
  ];
  const canVisit = (n) => (n === 4 ? hasResults : true);

  const stepMeta = {
    1: { title: T.stepCalibrate, desc: T.calStepDesc },
    2: { title: T.stepSchedule, desc: T.calDesc },
    3: { title: T.stepTasks, desc: T.tasksStepDesc },
    4: { title: T.planTitle, desc: null },
  };

  return (
    <div className="min-h-screen bg-mindflow-bg flex flex-col">
      {/* ── App bar ── */}
      <header className="h-14 shrink-0 px-4 sm:px-6 flex items-center justify-between border-b border-mindflow-border bg-mindflow-bg sticky top-0 z-40">
        <button
          type="button"
          onClick={goHome}
          aria-label="MindFlow — home"
          title="MindFlow — home"
          className="flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-mindflow-accent flex items-center justify-center">
            <Brain className="w-5 h-5 text-mindflow-onaccent" />
          </div>
          <span className="text-xl text-mindflow-text leading-none">MindFlow</span>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          aria-label={T.settings}
          className="p-2 rounded-full text-mindflow-muted hover:bg-mindflow-surface-alt hover:text-mindflow-text"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* ── Stepper ── */}
      <nav className="border-b border-mindflow-border bg-mindflow-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <button
                onClick={() => canVisit(s.n) && setStep(s.n)}
                disabled={!canVisit(s.n)}
                className="flex items-center gap-2 group disabled:cursor-default"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                  step === s.n
                    ? 'border-mindflow-accent text-mindflow-accent'
                    : s.done
                      ? 'border-mindflow-accent bg-mindflow-accent text-mindflow-onaccent'
                      : 'border-mindflow-border text-mindflow-muted'
                }`}>
                  {s.done && step !== s.n ? <Check className="w-4 h-4" /> : s.n}
                </span>
                <span className={`text-sm hidden sm:inline ${
                  step === s.n ? 'text-mindflow-heading font-medium' : 'text-mindflow-muted group-hover:text-mindflow-text'
                }`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 rounded ${STEPS[i + 1].done || step > s.n ? 'bg-mindflow-accent' : 'bg-mindflow-border-light'}`} />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Error banner */}
      {error && (
        <div className="bg-mindflow-danger/10 border-b border-mindflow-danger/30 px-6 py-2 flex items-center gap-2 text-sm text-mindflow-danger">
          <AlertCircle className="w-4 h-4" />{error}
          <button onClick={() => setError(null)} className="ml-auto text-xs hover:underline">{T.dismiss}</button>
        </div>
      )}

      {/* ── Step content ── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl text-mindflow-heading font-normal">{stepMeta[step].title}</h1>
          {stepMeta[step].desc && <p className="text-sm text-mindflow-muted mt-1 max-w-2xl">{stepMeta[step].desc}</p>}
        </div>

        {step === 1 && (
          !calibration ? (
            <StroopTestModal onComplete={handleCalibrationComplete} onSkip={handleSkipCalibration} existingCalibration={calibration} T={T} />
          ) : (
            <div className="max-w-md rounded-xl border border-mindflow-border bg-mindflow-surface p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-mindflow-muted">{T.secCalibrationDone}</p>
                <p className="text-3xl font-medium text-mindflow-heading tabular-nums mt-1">{calibration?.alphaScore != null ? calibration.alphaScore.toFixed(2) : '—'}</p>
              </div>
              <button
                onClick={() => { setCalibrationState(null); try { localStorage.removeItem('mindflow_calibration'); } catch {} }}
                className="rounded-full px-4 py-2 text-sm font-medium text-mindflow-accent hover:bg-mindflow-accent-soft"
              >
                {T.recalibrate}
              </button>
            </div>
          )
        )}

        {step === 2 && <WeeklyCalendar blocks={calendarBlocks} googleBlocks={googleBlocks} onChange={setCalendarBlocks} onGoogleImport={handleGoogleImport} weekStart={getWeekStart(0)} onViewChange={setSubView} onError={setError} T={T} />}

        {step === 3 && <TaskInputForm tasks={tasks} onChange={setTasks} onViewChange={setSubView} T={T} />}

        {step === 4 && (
          <PlanView
            weekResults={weekResults}
            calendarBlocks={calendarBlocks}
            googleBlocks={googleBlocks}
            tasks={tasks}
            isStale={isStale}
            isCalculating={isCalculating}
            genProgress={genProgress}
            onRegenerate={() => handleGenerate()}
            planVersion={planVersion}
            T={T}
          />
        )}

        {/* ── Footer navigation (hidden while a sub-flow owns the screen) ── */}
        {step < 4 && subView === 'overview' && (
          <div className="flex items-center justify-between border-t border-mindflow-border-light mt-10 pt-5">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-full px-5 py-2 text-sm font-medium text-mindflow-accent hover:bg-mindflow-accent-soft"
              >
                {T.navBack}
              </button>
            ) : <span />}

            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !calibration}
                className="rounded-full bg-mindflow-accent px-6 py-2 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {T.navContinue}
              </button>
            )}
            {step === 3 && (isCalculating ? (
              <div className="flex items-center gap-3" role="status">
                <span className="text-sm text-mindflow-muted">{T.generating}</span>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={genProgress}
                  aria-label={T.generating}
                  className="w-48 h-1.5 rounded-full bg-mindflow-surface-alt overflow-hidden"
                >
                  <div className="h-full rounded-full bg-mindflow-accent" style={{ width: genProgress + '%' }} />
                </div>
                <span className="text-sm text-mindflow-muted tabular-nums w-9 text-right">{genProgress}%</span>
              </div>
            ) : (
              <button
                onClick={() => handleGenerate(() => setStep(4))}
                disabled={!canGenerate}
                className="rounded-full bg-mindflow-accent px-6 py-2 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {T.generate}
              </button>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="border-t border-mindflow-border-light mt-10 pt-5">
            <button
              onClick={() => setStep(3)}
              className="rounded-full px-5 py-2 text-sm font-medium text-mindflow-accent hover:bg-mindflow-accent-soft"
            >
              {T.navBack}
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-mindflow-border px-6 py-4">
        <p className="text-center text-xs text-mindflow-muted">{T.appFooter}</p>
        <p
          className="text-center text-[10px] text-mindflow-muted/70 tabular-nums mt-0.5"
          title="Last commit at build time"
        >
          {BUILD_STAMP}
        </p>
      </footer>

      {/* ── Settings dialog ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSettings(false)}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setShowSettings(false); } }}>
          <div role="dialog" aria-modal="true" aria-label={T.settings}
            className="w-full max-w-lg rounded-xl bg-mindflow-surface shadow-xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mindflow-border-light">
              <h2 className="text-lg text-mindflow-heading font-normal">{T.settings}</h2>
              <button onClick={() => setShowSettings(false)} aria-label={T.navDone} className="p-1.5 rounded-full text-mindflow-muted hover:bg-mindflow-surface-alt">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Appearance */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-mindflow-text w-28 shrink-0">{T.settingsLanguage}</span>
                  <select
                    value={lang}
                    onChange={e => {
                      const v = e.target.value;
                      setLang(v);
                      setStoredLang(v);
                      // Apply dir/lang synchronously — the effect would run
                      // after paint and flash one RTL-frame-in-LTR.
                      document.documentElement.lang = v;
                      document.documentElement.dir = v === 'ar' ? 'rtl' : 'ltr';
                    }}
                    className="flex-1 bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-2 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none"
                  >
                    {LANGUAGES.map(l => (<option key={l.code} value={l.code}>{l.native}</option>))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-mindflow-text w-28 shrink-0">{T.settingsTheme}</span>
                  <div className="flex rounded-lg border border-mindflow-border overflow-hidden">
                    {['light', 'dark'].map(t => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`px-4 py-1.5 text-sm capitalize ${theme === t ? 'bg-mindflow-accent-soft text-mindflow-accent font-medium' : 'text-mindflow-muted hover:text-mindflow-text'}`}
                      >
                        {t === 'light' ? T.settingsThemeLight : T.settingsThemeDark}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-4 pt-4 border-t border-mindflow-border-light">
                <p className="text-xs font-medium text-mindflow-muted">{T.stepSchedule}</p>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-mindflow-text w-28 shrink-0">{T.settingsChronotype}</span>
                  <div className="flex rounded-lg border border-mindflow-border overflow-hidden">
                    {['morning', 'neutral', 'night'].map(c => {
                      const labels = { morning: T.chronotypeMorning || 'Morning', neutral: T.chronotypeNeutral || 'Neutral', night: T.chronotypeNight || 'Night' };
                      return (
                      <button
                        key={c}
                        onClick={() => setSettings(s => ({ ...s, chronotype: c }))}
                        className={`px-3 py-1.5 text-sm ${settings.chronotype === c ? 'bg-mindflow-accent-soft text-mindflow-accent font-medium' : 'text-mindflow-muted hover:text-mindflow-text'}`}
                      >
                        {labels[c]}
                      </button>);
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-mindflow-text w-28 shrink-0">{T.settingsWeekday}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" value={settings.maxHoursPerDay} min={1} max={16}
                      onChange={e => {
                        // Clamp: Number('') is 0 — persisting it would either
                        // silently switch the app to the default cap or cap
                        // the day at 0h (everything lands in "couldn't fit").
                        const n = Number(e.target.value);
                        setSettings(s => ({ ...s, maxHoursPerDay: Number.isFinite(n) ? Math.max(1, Math.min(16, n)) : 8 }));
                      }}
                      className="w-16 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1.5 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none"
                    />
                    <span className="text-xs text-mindflow-muted">{T.hours}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-mindflow-text w-28 shrink-0">{T.settingsWeekend}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" value={settings.maxHoursWeekend} min={0} max={12}
                      onChange={e => {
                        const n = Number(e.target.value);
                        setSettings(s => ({ ...s, maxHoursWeekend: Number.isFinite(n) ? Math.max(0, Math.min(12, n)) : 4 }));
                      }}
                      className="w-16 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1.5 text-mindflow-text text-sm focus:border-mindflow-accent focus:outline-none"
                    />
                    <span className="text-xs text-mindflow-muted">{T.hours}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-mindflow-text w-28 shrink-0">{T.settingsTransition}</span>
                  <div className="flex rounded-lg border border-mindflow-border overflow-hidden">
                    {[0, 15, 30].map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, transitionBufferMins: b }))}
                        className={`px-4 py-1.5 text-sm ${settings.transitionBufferMins === b ? 'bg-mindflow-accent-soft text-mindflow-accent font-medium' : 'text-mindflow-muted hover:text-mindflow-text'}`}
                      >
                        {b === 0 ? T.transitionOff : T.transitionMins.replace('{n}', b)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="pt-4 border-t border-mindflow-border-light">
                <button
                  onClick={handleReset}
                  className="text-sm text-mindflow-muted hover:text-mindflow-danger flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />{T.settingsReset}
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-mindflow-border-light flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-full bg-mindflow-accent px-6 py-2 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover"
              >
                {T.navDone}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
