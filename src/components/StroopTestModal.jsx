import { useState, useRef, useEffect, useCallback } from 'react';
import { Brain, Zap, Clock, RefreshCw, Target } from 'lucide-react';

const COLORS = [
  { name: 'Red', hex: '#ef4444' }, { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' }, { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#8b5cf6' },
];
const GAME_MS = 30000, CD_START = 3;

export default function StroopTestModal({ onComplete, onSkip, existingCalibration }) {
  const [phase, setPhase] = useState('intro');
  const [countdown, setCountdown] = useState(CD_START);
  const [currentWord, setCurrentWord] = useState(null);
  const [answerOptions, setAnswerOptions] = useState([]);
  const [trialId, setTrialId] = useState(0);
  const [results, setResults] = useState(null);
  const [timeLeft, setTimeLeft] = useState(GAME_MS);

  const gameStartRef = useRef(0), totalTrialsRef = useRef(0), correctTrialsRef = useRef(0);
  const totalTimeRef = useRef(0), trialStartRef = useRef(0), timerRef = useRef(null);
  const correctHexRef = useRef(null);  // avoids stale-closure race with currentWord state

  const generateTrial = useCallback(() => {
    const word = COLORS[Math.floor(Math.random() * COLORS.length)];
    let display;
    do { display = COLORS[Math.floor(Math.random() * COLORS.length)]; } while (display.name === word.name);
    correctHexRef.current = display.hex;
    setCurrentWord({ name: word.name, hex: display.hex });
    const wrong = COLORS.filter(c => c.hex !== display.hex).sort(() => Math.random() - 0.5).slice(0, 3);
    setAnswerOptions([display, ...wrong].sort(() => Math.random() - 0.5));
    trialStartRef.current = performance.now();
  }, []);

  const handleAnswer = useCallback((color) => {
    totalTrialsRef.current++;
    totalTimeRef.current += performance.now() - trialStartRef.current;
    if (color.hex === correctHexRef.current) correctTrialsRef.current++;
    setTrialId(id => id + 1);
  }, []);

  useEffect(() => { if (phase === 'playing') generateTrial(); }, [trialId, phase, generateTrial]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { setPhase('playing'); gameStartRef.current = performance.now(); setTrialId(0); setTimeLeft(GAME_MS); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, GAME_MS - (performance.now() - gameStartRef.current));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        const acc = totalTrialsRef.current > 0 ? correctTrialsRef.current / totalTrialsRef.current : 0;
        const avg = totalTrialsRef.current > 0 ? totalTimeRef.current / totalTrialsRef.current : 0;
        const raw = avg > 0 ? acc / (avg / 1000) : 0;
        setResults({ accuracy: acc, avgResponseTimeMs: Math.round(avg), alphaScore: Math.max(0.5, Math.min(1.5, raw)) });
        setPhase('results');
      }
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const start = () => { totalTrialsRef.current = 0; correctTrialsRef.current = 0; totalTimeRef.current = 0; setCountdown(CD_START); setPhase('countdown'); };
  const alphaColor = (a) => a >= 1.2 ? 'text-mindflow-success' : a >= 0.9 ? 'text-mindflow-accent' : a >= 0.7 ? 'text-mindflow-warning' : 'text-mindflow-danger';

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete({ stroopAccuracy: 0.75, avgResponseTimeMs: 750, alphaScore: 1.0 });
    }
  };

  // ── INTRO ──
  if (phase === 'intro') return (
    <div className="flex flex-col items-center gap-6 py-12 animate-fade-in">
      <div className="bg-mindflow-surface p-5 rounded-full border border-mindflow-border">
        <Brain className="w-16 h-16 text-mindflow-accent" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-mindflow-heading">Cognitive Baseline Test</h2>
        <p className="text-mindflow-text max-w-lg">Words appear in <strong>mismatched colors</strong>. Click the <strong>font color</strong>, not the word text. Answer fast for 30 seconds.</p>
      </div>
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-6 text-center space-y-3 max-w-sm">
        <p className="text-xs text-mindflow-muted uppercase tracking-wide">Example</p>
        <p className="text-4xl font-bold" style={{ color: '#22c55e' }}>Red</p>
        <p className="text-xs text-mindflow-muted">Word says <span className="text-red-400">Red</span>, color is <span className="text-green-400">Green</span> → click <span className="text-green-400 font-bold">Green</span></p>
      </div>
      {existingCalibration && (
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl px-4 py-3 flex items-center gap-3">
          <Target className="w-5 h-5 text-mindflow-muted" />
          <span className="text-sm text-mindflow-text">Previous score:</span>
          <span className={`text-sm font-bold ${alphaColor(existingCalibration.alphaScore)}`}>{existingCalibration.alphaScore.toFixed(2)}</span>
        </div>
      )}
      <button onClick={start} className="bg-mindflow-accent text-white px-10 py-3.5 rounded-xl text-lg font-semibold hover:opacity-90 shadow-lg shadow-mindflow-accent/25">Start Test</button>
      <button onClick={handleSkip} className="text-mindflow-muted hover:text-mindflow-text text-sm underline underline-offset-4 transition-colors">Skip for now (use default focus score)</button>
      <p className="text-xs text-mindflow-muted">30 seconds · No preparation needed</p>
    </div>
  );

  // ── COUNTDOWN ──
  if (phase === 'countdown') return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-4">
        <p className="text-mindflow-muted text-sm uppercase tracking-widest">Get Ready</p>
        <span className="text-8xl font-black text-mindflow-accent animate-pulse">{countdown}</span>
      </div>
    </div>
  );

  // ── PLAYING ──
  if (phase === 'playing') {
    if (!currentWord) {
      // Brief guard: wait for first trial to generate before painting game UI
      return (
        <div className="flex items-center justify-center py-32">
          <p className="text-mindflow-muted text-sm animate-pulse">Starting...</p>
        </div>
      );
    }
    const pct = (timeLeft / GAME_MS) * 100;
    const barColor = pct > 50 ? 'bg-mindflow-success' : pct > 25 ? 'bg-mindflow-warning' : 'bg-mindflow-danger';
    return (
      <div className="flex flex-col items-center gap-8 py-8">
        <div className="w-full max-w-md space-y-1">
          <div className="flex justify-between text-xs text-mindflow-muted"><span>{(timeLeft/1000).toFixed(0)}s</span><span>{totalTrialsRef.current} trials</span></div>
          <div className="w-full h-2.5 bg-mindflow-bg rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-100 ${barColor}`} style={{ width: pct + '%' }} /></div>
        </div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-2xl px-16 py-12"><p className="text-6xl font-black select-none tracking-tight" style={{ color: currentWord.hex }}>{currentWord.name}</p></div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {answerOptions.map((c) => (
            <button key={c.hex} onClick={() => handleAnswer(c)} className="px-4 py-3.5 rounded-xl text-white font-semibold text-sm hover:scale-105 active:scale-95 transition-transform shadow-lg" style={{ backgroundColor: c.hex }}>{c.name}</button>
          ))}
        </div>
        <p className="text-xs text-mindflow-muted">Click the <strong>font color</strong>, not the word</p>
      </div>
    );
  }

  // ── RESULTS ──
  if (phase === 'results' && results) return (
    <div className="flex flex-col items-center gap-6 py-12 animate-fade-in">
      <div className="bg-mindflow-accent/15 p-5 rounded-full"><Zap className="w-16 h-16 text-mindflow-accent" /></div>
      <div className="text-center"><h2 className="text-2xl font-bold text-mindflow-heading">Your Results</h2><p className="text-sm text-mindflow-muted mt-1">{totalTrialsRef.current} trials in 30 seconds</p></div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 text-center"><Target className="w-5 h-5 text-mindflow-accent mx-auto mb-2" /><p className="text-2xl font-bold text-mindflow-heading">{(results.accuracy*100).toFixed(0)}%</p><p className="text-xs text-mindflow-muted">Accuracy</p></div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 text-center"><Clock className="w-5 h-5 text-mindflow-warning mx-auto mb-2" /><p className="text-2xl font-bold text-mindflow-heading">{results.avgResponseTimeMs}</p><p className="text-xs text-mindflow-muted">Avg Speed (ms)</p></div>
        <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 text-center"><Zap className={`w-5 h-5 mx-auto mb-2 ${alphaColor(results.alphaScore)}`} /><p className={`text-2xl font-bold ${alphaColor(results.alphaScore)}`}>{results.alphaScore.toFixed(2)}</p><p className="text-xs text-mindflow-muted">Alpha Score</p></div>
      </div>
      <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-4 max-w-lg text-sm text-mindflow-text">
        <p className="font-medium text-mindflow-heading mb-1">What this means</p>
        {results.alphaScore >= 1.2 && <p>Excellent focus control. You'll stay in Flow longer during study sessions.</p>}
        {results.alphaScore >= 0.9 && results.alphaScore < 1.2 && <p>Good focus control. Standard fatigue patterns apply. Take breaks every 90 minutes.</p>}
        {results.alphaScore >= 0.7 && results.alphaScore < 0.9 && <p>Moderate focus. Schedule harder tasks early in the day. Take breaks every 60 minutes.</p>}
        {results.alphaScore < 0.7 && <p>Focus needs support. Try studying in 25-minute blocks with 5-minute breaks. Avoid late-night sessions.</p>}
      </div>
      <div className="flex gap-3">
        <button onClick={() => onComplete({ stroopAccuracy: results.accuracy, avgResponseTimeMs: results.avgResponseTimeMs, alphaScore: results.alphaScore })} className="bg-mindflow-accent text-white px-8 py-3 rounded-xl text-lg font-semibold hover:opacity-90 shadow-lg shadow-mindflow-accent/25">Save & Continue</button>
        <button onClick={() => { setResults(null); setPhase('intro'); }} className="border border-mindflow-border text-mindflow-text px-6 py-3 rounded-xl text-sm hover:bg-mindflow-surface transition-colors flex items-center gap-2"><RefreshCw className="w-4 h-4" />Retake</button>
      </div>
    </div>
  );

  return null;
}
