import { useState, useRef, useEffect, useCallback } from 'react';
import { Brain, RefreshCw, Target } from 'lucide-react';
import { scoreStroopTrials } from '../utils/stroopScoring.js';

// 4 colors mapped to 4 keyboard keys — user must learn this mapping.
// Color names are translated so non-English users see words in their own
// language (the Stroop effect works in any language).
function getColors(T) {
  return [
    { name: T.stroopRed || 'Red',       hex: '#d4786e', key: 'r' },
    { name: T.stroopGreen || 'Green',   hex: '#7eb8a0', key: 'g' },
    { name: T.stroopBlue || 'Blue',     hex: '#7e9ab8', key: 'b' },
    { name: T.stroopYellow || 'Yellow', hex: '#e0b870', key: 'y' },
  ];
}
function getColorByKey(T) {
  // Not Object.fromEntries — runtime API missing on Safari ≤12.0.
  const map = {};
  for (const c of getColors(T)) map[c.key] = c;
  return map;
}

const GAME_SECS = 60;
const GAME_MS = GAME_SECS * 1000;
const CD_START = 3;

// Trial types for research-validated Stroop interference measurement
const TRIAL_TYPES = {
  INCONGRUENT: 'incongruent',   // word ≠ ink color — the Stroop conflict
  CONGRUENT: 'congruent',       // word = ink color — baseline (no conflict)
};

export default function StroopTestModal({ onComplete, onSkip, existingCalibration, T }) {
  const [phase, setPhase] = useState('intro');
  const [countdown, setCountdown] = useState(CD_START);
  const [currentWord, setCurrentWord] = useState(null);      // { name, hex, trialType }
  const [trialId, setTrialId] = useState(0);
  const [results, setResults] = useState(null);
  const [timeLeft, setTimeLeft] = useState(GAME_MS);
  const [lastFeedback, setLastFeedback] = useState(null);    // 'correct' | 'wrong' | 'lapse' | null

  // Refs for performance (no re-render on every trial)
  const gameStartRef = useRef(0);
  const trialStartRef = useRef(0);
  const timerRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  // Trial data stored in refs for scoring — avoids state update overhead
  const trialsRef = useRef([]);          // [{ rt, correct, trialType, inkColor }]

  const correctInkRef = useRef(null);    // hex of correct answer for current trial

  // -- Trial generation -------------------------------------------------------

  const generateTrial = useCallback(() => {
    // ~25% congruent (word = ink), ~75% incongruent (word ≠ ink)
    const isCongruent = Math.random() < 0.25;

    let wordColor, inkColor;
    if (isCongruent) {
      inkColor = getColors(T)[Math.floor(Math.random() * getColors(T).length)];
      wordColor = inkColor;
    } else {
      inkColor = getColors(T)[Math.floor(Math.random() * getColors(T).length)];
      do {
        wordColor = getColors(T)[Math.floor(Math.random() * getColors(T).length)];
      } while (wordColor.name === inkColor.name);
    }

    correctInkRef.current = inkColor.hex;
    setCurrentWord({
      name: wordColor.name,
      hex: inkColor.hex,
      trialType: isCongruent ? TRIAL_TYPES.CONGRUENT : TRIAL_TYPES.INCONGRUENT,
    });
    trialStartRef.current = performance.now();
  }, [T]);

  // -- Keyboard handler -------------------------------------------------------

  const handleKeyDown = useCallback((e) => {
    if (phase !== 'playing') return;

    const key = e.key.toLowerCase();
    const color = getColorByKey(T)[key];
    if (!color) return; // ignore non-color keys

    e.preventDefault();

    const rt = performance.now() - trialStartRef.current;
    const correct = color.hex === correctInkRef.current;

    trialsRef.current.push({
      rt: Math.round(rt),
      correct,
      trialType: currentWord?.trialType || TRIAL_TYPES.INCONGRUENT,
      inkColor: currentWord?.hex || '',
    });

    // Show brief feedback
    if (rt > 1500) {
      setLastFeedback('lapse');
    } else if (correct) {
      setLastFeedback('correct');
    } else {
      setLastFeedback('wrong');
    }
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setLastFeedback(null), 250);

    setTrialId(id => id + 1);
  }, [phase, currentWord, T]);

  // Listen for keyboard
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [handleKeyDown]);

  // Generate new trial when trialId changes
  useEffect(() => {
    if (phase === 'playing') generateTrial();
  }, [trialId, phase, generateTrial]);

  // -- Countdown --------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('playing');
      gameStartRef.current = performance.now();
      setTrialId(0);
      setTimeLeft(GAME_MS);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // -- Game timer -------------------------------------------------------------

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, GAME_MS - (performance.now() - gameStartRef.current));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        computeResults();
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // -- Scoring (pure module — src/utils/stroopScoring.js, scoring v2) ----------

  const computeResults = () => {
    // All scoring math lives in scoreStroopTrials (unit-tested). See the
    // module header for why v2 rebuilt the composite: v1 triple-counted
    // slowness and pushed careful, accurate users to the 0.5 floor.
    const results = scoreStroopTrials(trialsRef.current);
    setResults(results);
    setPhase('results');
  };

  // -- Actions ----------------------------------------------------------------

  const start = () => {
    trialsRef.current = [];
    setCountdown(CD_START);
    setPhase('countdown');
    setLastFeedback(null);
  };

  const alphaColor = (a) =>
    a >= 1.2 ? 'text-mindflow-success' :
    a >= 0.9 ? 'text-mindflow-accent' :
    a >= 0.7 ? 'text-mindflow-warning' : 'text-mindflow-danger';

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    }
  };

  // ===========================================================================
  // INTRO
  // ===========================================================================
  if (phase === 'intro') return (
    <div className="flex flex-col items-center gap-6 py-12 animate-fade-in">
      <div className="w-14 h-14 rounded-full bg-mindflow-accent-soft flex items-center justify-center">
        <Brain className="w-7 h-7 text-mindflow-accent" />
      </div>

      <div className="text-center space-y-2 max-w-lg">
        <h2 className="text-2xl font-normal text-mindflow-heading">{T.calibTitle}</h2>
        <p className="text-sm text-mindflow-text">{T.calibDesc}</p>
      </div>

      {/* Key mapping */}
      <div className="w-full max-w-sm">
        <p className="text-xs font-medium text-mindflow-muted text-center mb-3">{T.calibKeyMapping}</p>
        <div className="grid grid-cols-4 gap-3">
          {getColors(T).map(c => (
            <div key={c.key} className="text-center">
              <div className="w-14 h-14 rounded-lg mx-auto flex items-center justify-center text-xl font-medium"
                style={{ backgroundColor: c.hex, color: '#fff' }}>
                {c.key.toUpperCase()}
              </div>
              <p className="text-xs text-mindflow-muted mt-1.5">{c.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Example */}
      <div className="text-center max-w-sm">
        <p className="text-xs font-medium text-mindflow-muted mb-3">{T.calibExample}</p>
        <p className="text-5xl font-medium mb-2" style={{ color: '#7eb8a0' }}>{T.calibExampleWord}</p>
        <p className="text-xs text-mindflow-muted leading-relaxed">{T.calibExampleDesc}</p>
      </div>

      {existingCalibration && (
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl px-4 py-3 flex items-center gap-3">
          <Target className="w-5 h-5 text-mindflow-muted" />
          <span className="text-sm text-mindflow-text">{T.calibPreviousScore}</span>
          <span className={`text-sm font-medium tabular-nums ${alphaColor(existingCalibration.alphaScore)}`}>
            {existingCalibration?.alphaScore != null ? existingCalibration.alphaScore.toFixed(2) : '—'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={handleSkip} className="rounded-full px-5 py-2 text-sm font-medium text-mindflow-accent hover:bg-mindflow-accent-soft">
          {T.calibSkip}
        </button>
        <button onClick={start} className="rounded-full bg-mindflow-accent text-mindflow-onaccent px-6 py-2 text-sm font-medium hover:bg-mindflow-accent-hover shadow-sm">
          {T.calibStart}
        </button>
      </div>
      <p className="text-xs text-mindflow-muted">
        {GAME_SECS}s · {T.calibCountdownHint}
      </p>
    </div>
  );

  // ===========================================================================
  // COUNTDOWN
  // ===========================================================================
  if (phase === 'countdown') return (
    <div className="flex items-center justify-center py-40">
      <div className="text-center space-y-4">
        <p className="text-xs font-medium text-mindflow-muted">{T.calibCountdown}</p>
        <span className="block text-8xl font-normal text-mindflow-heading tabular-nums leading-none">{countdown}</span>
        <p className="text-xs text-mindflow-muted">{T.calibCountdownHint}</p>
      </div>
    </div>
  );

  // ===========================================================================
  // PLAYING
  // ===========================================================================
  if (phase === 'playing') {
    if (!currentWord) {
      return (
        <div className="flex items-center justify-center py-32">
          <p className="text-sm text-mindflow-muted">{T.calibStarting}</p>
        </div>
      );
    }

    const pct = (timeLeft / GAME_MS) * 100;
    const barColor = pct > 50 ? 'bg-mindflow-success' : pct > 25 ? 'bg-mindflow-warning' : 'bg-mindflow-danger';

    return (
      <div className="flex flex-col items-center gap-6 py-8 select-none">
        {/* Timer + progress */}
        <div className="w-full max-w-md space-y-1.5">
          <div className="flex justify-between text-xs text-mindflow-muted tabular-nums">
            <span>{(timeLeft / 1000).toFixed(0)}s</span>
            <span>{trialsRef.current.length} {T.calibTrials}</span>
          </div>
          <div className="w-full h-1.5 bg-mindflow-surface-alt rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-100 ${barColor}`}
              style={{ width: pct + '%' }} />
          </div>
        </div>

        {/* The word — shown in ink color, user presses key for ink color */}
        <div className="relative">
          <div
            className={`bg-mindflow-surface border-2 rounded-xl px-20 py-14 transition-colors duration-150
              ${lastFeedback === 'correct' ? 'border-mindflow-success' :
                lastFeedback === 'wrong' ? 'border-mindflow-danger' :
                lastFeedback === 'lapse' ? 'border-mindflow-warning' :
                'border-mindflow-border'}`}
          >
            <p
              className="text-6xl font-medium tracking-tight text-center"
              style={{ color: currentWord.hex }}
            >
              {currentWord.name.toUpperCase()}
            </p>
          </div>

          {/* Feedback badge */}
          {lastFeedback && (
            <div className={`absolute -top-2.5 -right-2.5 px-2 py-0.5 rounded-full text-xs font-medium
              ${lastFeedback === 'correct' ? 'bg-mindflow-success text-white' :
                lastFeedback === 'wrong' ? 'bg-mindflow-danger text-white' :
                'bg-mindflow-warning text-black'}`}>
              {lastFeedback === 'correct' ? '✓' : lastFeedback === 'wrong' ? '✗' : (T.stroopSlow || 'SLOW')}
            </div>
          )}
        </div>

        {/* Key hints */}
        <div className="flex gap-3">
          {getColors(T).map(c => (
            <div key={c.key} className="flex flex-col items-center gap-1">
              <kbd className="px-3 py-1.5 rounded-md bg-mindflow-surface border border-mindflow-border
                               text-mindflow-heading font-medium text-base min-w-[2.5rem] text-center shadow-sm">
                {c.key.toUpperCase()}
              </kbd>
              <span className="text-xs text-mindflow-muted">{c.name}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-mindflow-muted">
          {T.calibPlaying}
        </p>
      </div>
    );
  }

  // ===========================================================================
  // RESULTS
  // ===========================================================================
  if (phase === 'results' && results) return (
    <div className="flex flex-col items-center gap-8 py-10 animate-fade-in">
      {/* Hero alpha score */}
      <div className="text-center">
        <p className="text-xs font-medium text-mindflow-muted mb-2">{T.calibFocusScore}</p>
        <p className={`text-6xl font-normal tabular-nums ${alphaColor(results.alphaScore)}`}>
          {results.alphaScore.toFixed(2)}
        </p>
        <p className="text-sm text-mindflow-muted mt-2">
          {results.trialCount} {T.calibTrials} · {GAME_SECS}s
        </p>
      </div>

      {/* Secondary metrics — stats strip with hairline dividers */}
      <div className="grid grid-cols-3 gap-px w-full max-w-md bg-mindflow-border rounded-xl border border-mindflow-border overflow-hidden">
        {[
          { val: (results.accuracy * 100).toFixed(0) + '%', label: T.calibAccuracy },
          { val: results.avgResponseTimeMs + 'ms', label: T.calibSpeed },
          { val: 'SD ' + results.rtVariabilityMs, label: T.calibConsistency },
        ].map((m, i) => (
          <div key={i} className="bg-mindflow-surface text-center py-3 px-2">
            <p className="text-xl font-normal tabular-nums text-mindflow-heading">{m.val}</p>
            <p className="text-xs text-mindflow-muted mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Detailed breakdown */}
      <div className="max-w-md w-full space-y-2 text-sm p-4 rounded-xl border border-mindflow-border bg-mindflow-surface">
        <p className="font-medium text-mindflow-heading text-xs">{T.calibScoreBreakdown}</p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-mindflow-muted">{T.calibAccuracyLabel} ({((results.accuracy * 100).toFixed(0))}%)</span>
            <span className="text-mindflow-heading tabular-nums">{results.accuracyScore.toFixed(1)} / 50</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mindflow-muted">{T.calibSpeedLabel} ({results.avgResponseTimeMs}ms)</span>
            <span className="text-mindflow-heading tabular-nums">{results.speedScore.toFixed(1)} / 20</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mindflow-muted">{T.calibConsistencyLabel} (SD {results.rtVariabilityMs}ms)</span>
            <span className="text-mindflow-heading tabular-nums">{results.consistencyScore.toFixed(1)} / 15</span>
          </div>
          {results.lapses > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-mindflow-warning">{T.calibLapsesLabel} ({results.lapses} × {'>'}1.5s)</span>
              <span className="text-mindflow-warning tabular-nums">−{results.lapsePenalty.toFixed(1)}</span>
            </div>
          )}
          {results.interferenceMs > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-mindflow-muted">{T.calibInterferenceLabel} ({results.interferenceMs}ms)</span>
              <span className="text-mindflow-warning tabular-nums">−{results.interferencePenalty.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Interpretation */}
      <div className="max-w-md w-full text-sm text-mindflow-text p-4 rounded-xl bg-mindflow-surface-alt">
        <p className="font-medium text-mindflow-heading mb-2">{T.calibWhatMeans}</p>
        {results.alphaScore >= 1.2 && (
          <p>{T.calibInterpretExcellent}</p>
        )}
        {results.alphaScore >= 0.9 && results.alphaScore < 1.2 && (
          <p>{T.calibInterpretGood}</p>
        )}
        {results.alphaScore >= 0.7 && results.alphaScore < 0.9 && (
          <p>{results.lapses > 2 ? T.calibLapsesPrefix.replace('{n}', results.lapses) : ''}{T.calibInterpretModerate}</p>
        )}
        {results.alphaScore < 0.7 && (
          <p>{results.lapses > 3 ? T.calibLapsesPrefix.replace('{n}', results.lapses) : ''}{T.calibInterpretLow}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => { setResults(null); trialsRef.current = []; setPhase('intro'); }}
          className="rounded-full border border-mindflow-border px-5 py-2 text-sm font-medium text-mindflow-text hover:bg-mindflow-surface-alt flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />{T.calibRetake}
        </button>
        <button
          onClick={() => onComplete({
            stroopAccuracy: results.accuracy,
            avgResponseTimeMs: results.avgResponseTimeMs,
            alphaScore: results.alphaScore,
          })}
          className="rounded-full bg-mindflow-accent text-mindflow-onaccent px-6 py-2 text-sm font-medium hover:bg-mindflow-accent-hover shadow-sm"
        >
          {T.calibSave}
        </button>
      </div>
    </div>
  );

  return null;
}
