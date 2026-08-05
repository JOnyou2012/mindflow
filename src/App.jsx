import { useState, useEffect, Component } from 'react';
import { Brain, AlertTriangle, Zap } from 'lucide-react';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import StroopTestModal from './components/StroopTestModal.jsx';
import { loadCalibration, saveCalibration } from './utils/storage.js';

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

const SCREEN = { WELCOME: 'welcome', STROOP: 'stroop', MAIN: 'main' };

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

  // Persist calibration whenever it changes
  useEffect(() => {
    if (calibration) saveCalibration(calibration);
  }, [calibration]);

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
    setScreen(SCREEN.MAIN);
  };

  const handleStroopSkip = () => {
    setCalibration(DEFAULT_CALIBRATION);
    setScreen(SCREEN.MAIN);
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

  // ── Main placeholder (will be replaced by Dashboard in steps 55–65) ──
  const mainScreen = (
    <div className="flex flex-col items-center gap-6 py-16 animate-fade-in">
      <div className="bg-mindflow-accent/15 p-5 rounded-full">
        <Zap className="w-16 h-16 text-mindflow-accent" />
      </div>
      <div className="text-center space-y-2 max-w-lg">
        <h2 className="text-2xl font-bold text-mindflow-heading">You're all set!</h2>
        <p className="text-mindflow-text">
          Your focus score is <span className="font-semibold text-mindflow-accent">{isValidCalibration(calibration) ? calibration.alphaScore.toFixed(2) : '1.00'}</span>.
        </p>
        <p className="text-sm text-mindflow-muted">
          Task input, calendar, and the weekly schedule dashboard are coming next.
        </p>
      </div>
      <button
        onClick={() => {
          try { localStorage.removeItem('mindflow_calibration'); } catch {}
          setCalibration(null);
          setScreen(SCREEN.WELCOME);
        }}
        className="border border-mindflow-border text-mindflow-text px-4 py-2 rounded-lg text-sm hover:bg-mindflow-surface transition-colors"
      >
        Reset & Start Over
      </button>
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
