import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, AlertCircle } from 'lucide-react';

/**
 * QuestionFlow — one question per screen, fast slide transitions.
 *
 * stages: [{
 *   key: string,
 *   question: string,
 *   hint?: string,
 *   manual?: boolean,        // true = user must press Continue/Enter; false = stage auto-advances via advance()
 *   optional?: boolean,      // manual stages only: shows a Skip pill that advances without an answer
 *   validate?: (answers) => string | null,   // error message or null
 *   render: ({ value, set, advance, answers }) => ReactNode,
 * }]
 *
 * onComplete(answers) fires after the last stage passes validation.
 */
export default function QuestionFlow({ stages, initial = {}, onComplete, T }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState('right');
  const [answers, setAnswers] = useState(initial);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const answersRef = useRef(initial); // always-current mirror (auto stages set+advance in one click)

  const stage = stages[index];
  const value = answers[stage.key];

  const set = useCallback((v) => {
    answersRef.current = { ...answersRef.current, [stage.key]: v };
    setAnswers(answersRef.current);
    setError('');
  }, [stage.key]);

  const goBack = useCallback(() => {
    if (index === 0) return;
    setDir('left');
    setError('');
    setIndex(i => i - 1);
  }, [index]);

  const advance = useCallback(() => {
    const current = answersRef.current;
    const err = stage.validate ? stage.validate(current) : null;
    if (err) { setError(err); return; }
    setError('');
    if (index >= stages.length - 1) {
      onComplete(current);
      return;
    }
    setDir('right');
    setIndex(i => i + 1);
  }, [stage, index, stages.length, onComplete]);

  // Enter advances manual stages (guarded for IME composition)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.isComposing && stage.manual) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, advance]);

  // Autofocus whatever input the stage rendered
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div className="flex flex-col" style={{ minHeight: 'min(60vh, 560px)' }}>
      {/* Progress + back */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={goBack}
          disabled={index === 0}
          aria-label={T.navBack}
          className="p-1.5 rounded-full text-mindflow-muted hover:bg-mindflow-surface-alt disabled:opacity-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-0.5 rounded bg-mindflow-border-light overflow-hidden">
          <div
            className="h-full bg-mindflow-accent transition-all duration-300"
            style={{ width: ((index + 1) / stages.length) * 100 + '%' }}
          />
        </div>
      </div>

      {/* Stage */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div
          key={index}
          className={`w-full max-w-lg ${dir === 'right' ? 'animate-stage-in-right' : 'animate-stage-in-left'}`}
        >
          <h2 className="text-2xl sm:text-3xl font-normal text-mindflow-heading">{stage.question}</h2>
          {stage.hint && <p className="text-sm text-mindflow-muted mt-2">{stage.hint}</p>}

          <div className="mt-8">
            {stage.render({ value, set, advance, answers, inputRef })}
          </div>

          {error && (
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-mindflow-danger bg-mindflow-danger/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {stage.manual && (
            <div className="mt-8 flex items-center justify-center gap-3">
              {stage.optional && (
                <button
                  onClick={advance}
                  className="rounded-full px-5 py-2 text-sm font-medium text-mindflow-muted hover:bg-mindflow-surface-alt"
                >
                  {T.flowSkip}
                </button>
              )}
              <button
                onClick={advance}
                className="rounded-full bg-mindflow-accent px-8 py-2.5 text-sm font-medium text-mindflow-onaccent hover:bg-mindflow-accent-hover shadow-sm"
              >
                {index === stages.length - 1 ? (stage.doneLabel || T.navContinue) : T.navContinue}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
