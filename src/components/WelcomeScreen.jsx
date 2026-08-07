import { Brain, ArrowRight } from 'lucide-react';

export default function WelcomeScreen({ onStart, onSkip, T }) {
  const STEPS = [
    { emoji: '🧪', title: T.welcomeStep1, desc: T.welcomeStep1Desc },
    { emoji: '📅', title: T.welcomeStep2, desc: T.welcomeStep2Desc },
    { emoji: '📊', title: T.welcomeStep3, desc: T.welcomeStep3Desc },
  ];

  return (
    <div className="flex flex-col items-center gap-8 py-12 sm:py-16">
      {/* Hero: icon + headline + description — slides up on entrance */}
      <div className="flex flex-col items-center gap-6 animate-slide-up">
        <div className="bg-mindflow-accent/15 p-6 rounded-full animate-pulse-glow">
          <Brain className="w-20 h-20 text-mindflow-accent" />
        </div>

        <div className="text-center space-y-3 max-w-lg">
          <h1 className="text-3xl font-bold text-mindflow-heading tracking-tight">
            {T.welcomeTitle}
          </h1>
          <p className="text-mindflow-text leading-relaxed">
            {T.welcomeDesc}
          </p>
        </div>
      </div>

      {/* Step cards — staggered fade-in after hero lands */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg text-center">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="opacity-0 animate-fade-in bg-mindflow-surface border border-mindflow-border
                       rounded-xl p-4 hover:border-mindflow-accent/40 hover:scale-[1.03]
                       transition-all duration-300"
            style={{
              animationDelay: `${300 + i * 120}ms`,
              animationFillMode: 'forwards',
            }}
          >
            <p className="text-2xl mb-1" role="img" aria-hidden="true">{s.emoji}</p>
            <p className="text-sm font-medium text-mindflow-heading">{s.title}</p>
            <p className="text-xs text-mindflow-muted">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA buttons — fade in last */}
      <div
        className="opacity-0 animate-fade-in flex flex-col sm:flex-row gap-3"
        style={{ animationDelay: '660ms', animationFillMode: 'forwards' }}
      >
        <button
          type="button"
          onClick={onStart}
          className="bg-mindflow-accent text-white px-8 py-3 rounded-xl text-lg font-semibold
                     hover:opacity-90 active:scale-[0.98] shadow-lg shadow-mindflow-accent/25
                     flex items-center gap-2 transition-all duration-200"
        >
          {T.welcomeStart} <ArrowRight className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip calibration and use default settings"
          className="border border-mindflow-border bg-mindflow-surface/50 text-mindflow-text
                     px-6 py-3 rounded-xl text-sm hover:bg-mindflow-surface
                     hover:border-mindflow-border/80 active:scale-[0.98]
                     transition-all duration-200"
        >
          {T.welcomeSkip}
        </button>
      </div>

      <p
        className="opacity-0 animate-fade-in text-xs text-mindflow-muted"
        style={{ animationDelay: '780ms', animationFillMode: 'forwards' }}
      >
        {T.welcomeHint}
      </p>
    </div>
  );
}
