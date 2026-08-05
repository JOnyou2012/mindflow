import { useState, useEffect, Component } from 'react';
import { Brain, AlertTriangle, Zap } from 'lucide-react';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import StroopTestModal from './components/StroopTestModal.jsx';
import WeeklyCalendar from './components/WeeklyCalendar.jsx';
import TaskInputForm from './components/TaskInputForm.jsx';
import { loadCalibration, saveCalibration, loadCalendar, saveCalendar, loadTasks, saveTasks } from './utils/storage.js';

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-mindflow-bg text-mindflow-text flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <AlertTriangle className="w-12 h-12 text-mindflow-warning mx-auto" />
            <h2 className="text-xl font-semibold text-mindflow-heading">Something went wrong</h2>
            <p className="text-sm text-mindflow-muted max-w-md">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-mindflow-accent text-white rounded-lg text-sm hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Screen constants
// ---------------------------------------------------------------------------

const SCREEN = { WELCOME: 'welcome', STROOP: 'stroop', CALENDAR: 'calendar', MAIN: 'main' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidCalibration(cal) {
  return cal && typeof cal === 'object' && !Array.isArray(cal)
    && typeof cal.alphaScore === 'number' && Number.isFinite(cal.alphaScore)
    && typeof cal.stroopAccuracy === 'number' && Number.isFinite(cal.stroopAccuracy)
    && typeof cal.avgResponseTimeMs === 'number' && Number.isFinite(cal.avgResponseTimeMs);
}

const DEFAULT_CALIBRATION = { stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 };

// ---------------------------------------------------------------------------
// MindFlow App
// ---------------------------------------------------------------------------

function App() {
  const [screen, setScreen] = useState(() => {
    const existing = loadCalibration();
    return isValidCalibration(existing) ? SCREEN.MAIN : SCREEN.WELCOME;
  });
  const [calibration, setCalibration] = useState(() => {
    const existing = loadCalibration();
    return isValidCalibration(existing) ? existing : null;
  });
  const [calendarBlocks, setCalendarBlocks] = useState(() => loadCalendar());
  const [tasks, setTasks] = useState(() => loadTasks());

  // Persist calibration + calendar + tasks whenever they change
  useEffect(() => {
    if (calibration) saveCalibration(calibration);
  }, [calibration]);
  useEffect(() => {
    saveCalendar(calendarBlocks);
  }, [calendarBlocks]);
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const handleWelcomeStart = () => setScreen(SCREEN.STROOP);
  const handleWelcomeSkip = () => {
    setCalibration(DEFAULT_CALIBRATION);
    setScreen(SCREEN.MAIN);
  };

  const handleStroopComplete = (result) => {
    if (isValidCalibration(result)) {
      setCalibration(result);
    } else {
      setCalibration(DEFAULT_CALIBRATION);
    }
    setScreen(SCREEN.CALENDAR);
  };

  const handleStroopSkip = () => {
    setCalibration(DEFAULT_CALIBRATION);
    setScreen(SCREEN.CALENDAR);
  };

  // ── Header ──
  const header = (
    <header className="border-b border-mindflow-border bg-mindflow-surface/60 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-mindflow-accent" />
          <h1 className="text-xl font-bold text-mindflow-heading tracking-tight">
            MindFlow
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full border border-mindflow-accent/30 text-mindflow-accent bg-mindflow-accent/10">
            BETA
          </span>
        </div>
        {screen !== SCREEN.WELCOME && isValidCalibration(calibration) && (
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-mindflow-accent" />
            <span className="text-mindflow-muted">Focus Score:</span>
            <span className="font-semibold text-mindflow-heading">{calibration.alphaScore.toFixed(2)}</span>
          </div>
        )}
      </div>
    </header>
  );

  // ── Main screen (will expand with Calendar + Dashboard in steps 45–65) ──
  const mainScreen = (
    <div className="space-y-8 animate-fade-in">
      {/* Calibration summary */}
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 flex items-center gap-4">
        <div className="bg-mindflow-accent/15 p-3 rounded-full">
          <Zap className="w-6 h-6 text-mindflow-accent" />
        </div>
        <div>
          <p className="text-sm font-medium text-mindflow-heading">
            Focus Score: {isValidCalibration(calibration) ? calibration.alphaScore.toFixed(2) : '1.00'}
          </p>
          <p className="text-xs text-mindflow-muted">
            {calibration?.alphaScore >= 1.2 ? 'Excellent — you\'ll stay in Flow longer.' :
             calibration?.alphaScore >= 0.9 ? 'Good — standard fatigue patterns apply.' :
             calibration?.alphaScore >= 0.7 ? 'Moderate — schedule hard tasks early.' :
             'Default calibration — retake the Stroop test for better accuracy.'}
          </p>
        </div>
        <button
          onClick={() => setScreen(SCREEN.STROOP)}
          className="ml-auto text-xs text-mindflow-accent hover:underline shrink-0"
        >
          Recalibrate
        </button>
      </div>

      {/* Task input form */}
      <TaskInputForm tasks={tasks} onChange={setTasks} />

      {/* Navigation + Generate */}
      <div className="space-y-3">
        <button
          onClick={() => setScreen(SCREEN.CALENDAR)}
          className="text-sm text-mindflow-muted hover:text-mindflow-text transition-colors underline underline-offset-4"
        >
          ← Back to Weekly Schedule
        </button>

        {tasks.length > 0 && (
          <div className="text-center">
            <button
              className="bg-mindflow-accent text-white px-8 py-3 rounded-xl text-lg font-semibold
                         hover:opacity-90 shadow-lg shadow-mindflow-accent/25 opacity-50 cursor-not-allowed"
              disabled
              title="Dashboard coming soon (steps 55-65)"
            >
              Generate Schedule ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
            </button>
            <p className="text-xs text-mindflow-muted mt-2">
              Dashboard visualization coming in next update
            </p>
          </div>
        )}
      </div>

      {/* Reset */}
      <div className="text-center pt-4 border-t border-mindflow-border">
        <button
          onClick={() => {
            try { localStorage.removeItem('mindflow_calibration'); localStorage.removeItem('mindflow_calendar'); localStorage.removeItem('mindflow_tasks'); } catch {}
            setCalibration(null);
            setCalendarBlocks([]);
            setTasks([]);
            setScreen(SCREEN.WELCOME);
          }}
          className="border border-mindflow-border text-mindflow-text px-4 py-2 rounded-lg text-sm hover:bg-mindflow-surface transition-colors"
        >
          Reset & Start Over
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-mindflow-bg text-mindflow-text">
      {header}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {screen === SCREEN.WELCOME && (
          <WelcomeScreen onStart={handleWelcomeStart} onSkip={handleWelcomeSkip} />
        )}
        {screen === SCREEN.STROOP && (
          <StroopTestModal
            onComplete={handleStroopComplete}
            onSkip={handleStroopSkip}
            existingCalibration={calibration}
          />
        )}
        {screen === SCREEN.CALENDAR && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-mindflow-heading">Your Weekly Schedule</h2>
              <p className="text-sm text-mindflow-muted max-w-lg mx-auto">
                Add your fixed commitments — classes, work, sports practice. The scheduler
                will fit your study tasks into the gaps.
              </p>
            </div>
            <WeeklyCalendar blocks={calendarBlocks} onChange={setCalendarBlocks} />
            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={() => setScreen(SCREEN.MAIN)}
                className="bg-mindflow-accent text-white px-8 py-3 rounded-xl text-lg font-semibold
                           hover:opacity-90 shadow-lg shadow-mindflow-accent/25"
              >
                Continue to Tasks
              </button>
              <button
                onClick={() => setScreen(SCREEN.MAIN)}
                className="border border-mindflow-border text-mindflow-text px-6 py-3 rounded-xl
                           text-sm hover:bg-mindflow-surface transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
        {screen === SCREEN.MAIN && mainScreen}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export (wrapped in error boundary)
// ---------------------------------------------------------------------------

export default function MindFlowApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
