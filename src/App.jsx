import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ReferenceLine,
} from 'recharts'
import { Brain, Calendar, Play, Settings, AlertTriangle, Zap, Coffee } from 'lucide-react'

const API = '/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tickLabel(i) {
  const total = i * 10
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

function formatPercent(n) {
  return `${(n * 100).toFixed(0)}%`
}

// ---------------------------------------------------------------------------
// MindFlow App
// ---------------------------------------------------------------------------

export default function App() {
  // --- Input state ---
  const [alpha, setAlpha] = useState(1.0)
  const [beta, setBeta] = useState(3.0)
  const [gamma, setGamma] = useState(1.0)

  // --- Simulation state ---
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runSimulation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `${API}/simulate?alpha=${alpha}&beta=${beta}&gamma=${gamma}&steps=18`
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [alpha, beta, gamma])

  // Run on mount
  useEffect(() => { runSimulation() }, [runSimulation])

  // --- Format chart data ---
  const chartData = data
    ? data.trajectory.map((v, i) => ({
        time: tickLabel(i),
        Flow: +(v[0] * 100).toFixed(1),
        Distracted: +(v[1] * 100).toFixed(1),
        Fatigue: +(v[2] * 100).toFixed(1),
        Recovery: +(v[3] * 100).toFixed(1),
        break: data.break_tick === i,
      }))
    : []

  const inDanger = data && data.trajectory.some(v => v[2] > 0.50)

  return (
    <div className="min-h-screen bg-mindflow-bg text-mindflow-text">
      {/* ---- Header ---- */}
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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* ---- Hero / intro ---- */}
        <section className="text-center space-y-2">
          <h2 className="text-3xl font-semibold text-mindflow-heading">
            Markov Chain Attention Predictor
          </h2>
          <p className="text-mindflow-muted max-w-xl mx-auto">
            Simulate how focus, distraction, and fatigue evolve over a 3-hour study
            block — and learn where to insert your next break.
          </p>
        </section>

        {/* ---- Controls ---- */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ControlCard
            icon={<Settings className="w-4 h-4" />}
            label="Personal Calibration (α)"
            value={alpha}
            set={setAlpha}
            min={0.5} max={2.0} step={0.05}
            hint="Higher = more focus stamina (Stroop score)"
          />
          <ControlCard
            icon={<Zap className="w-4 h-4" />}
            label="Task Difficulty (β)"
            value={beta}
            set={setBeta}
            min={1} max={5} step={0.5}
            hint="1 = light reading, 5 = hard problem set"
          />
          <ControlCard
            icon={<Coffee className="w-4 h-4" />}
            label="Circadian Factor (γ)"
            value={gamma}
            set={setGamma}
            min={0.8} max={1.3} step={0.05}
            hint="1.0 = normal, &lt;1 = tired, &gt;1 = peak alertness"
          />
        </section>

        {/* ---- Run button ---- */}
        <div className="flex justify-center gap-4">
          <button
            onClick={runSimulation}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl
                       bg-mindflow-accent text-white font-semibold
                       hover:bg-mindflow-accent/80 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg shadow-mindflow-accent/20"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>

        {error && (
          <div className="text-center text-red-400 bg-red-400/10 rounded-lg p-3 max-w-md mx-auto">
            {error}
          </div>
        )}

        {/* ---- Chart ---- */}
        <section className="bg-mindflow-surface border border-mindflow-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-mindflow-heading mb-4">
            Cognitive State Probability × Time
          </h3>
          {chartData.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2a2a38" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="#6b6b80" fontSize={12} />
                  <YAxis stroke="#6b6b80" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a24', border: '1px solid #2a2a38',
                      borderRadius: 12, fontSize: 13,
                    }}
                  />
                  <Area type="monotone" dataKey="Flow" stroke="#8b5cf6" fill="url(#flowGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Distracted" stroke="#f59e0b" fill="url(#distGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Fatigue" stroke="#ef4444" fill="url(#fatGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Recovery" stroke="#34d399" fill="url(#recGrad)" strokeWidth={2} />
                  {data?.break_tick != null && (
                    <ReferenceLine
                      x={tickLabel(data.break_tick)}
                      stroke="#fbbf24"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      label={{
                        value: '⚠ Optimal Break',
                        position: 'top',
                        fill: '#fbbf24',
                        fontSize: 12,
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>

              {/* ---- Break recommendation ---- */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <BreakCard
                  title="Optimal Break Window"
                  breakTick={data?.break_tick}
                  inDanger={inDanger}
                />
                <BreakCard
                  title="After-Break Projection"
                  breakTick={data?.break_tick}
                  inDanger={inDanger}
                  recovery
                />
              </div>
            </>
          )}
        </section>

        {/* ---- How it works ---- */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfoCard
            icon={<Brain className="w-5 h-5" />}
            title="Markov Chain Model"
            body="4-state discrete-time Markov chain (Flow → Distracted → Fatigue → Recovery) with 10-min ticks over 3 hours."
          />
          <InfoCard
            icon={<AlertTriangle className="w-5 h-5" />}
            title="Break Optimizer"
            body="Algorithm watches P(Fatigue) > 40% and flags the optimal tick to insert a 10–15 min recovery-break before burnout."
          />
          <InfoCard
            icon={<Calendar className="w-5 h-5" />}
            title="Coming: Schedule + Stroop Test"
            body="A weekly planner with task difficulty ratings and a 30-second Stroop micro-test for personal α calibration."
          />
        </section>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ControlCard({ icon, label, value, set, min, max, step, hint }) {
  return (
    <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2 text-mindflow-muted text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => set(parseFloat(e.target.value))}
        className="w-full accent-mindflow-accent"
      />
      <div className="flex items-center justify-between">
        <span className="text-xl font-mono font-bold text-mindflow-heading">
          {value.toFixed(2)}
        </span>
        <span className="text-xs text-mindflow-muted">{hint}</span>
      </div>
    </div>
  )
}

function BreakCard({ title, breakTick, inDanger, recovery }) {
  const shouldWarn = inDanger
  return (
    <div className={`rounded-xl p-5 border ${shouldWarn ? 'border-mindflow-warning/50 bg-mindflow-warning/5' : 'border-mindflow-border bg-mindflow-surface'}`}>
      <div className="flex items-center gap-2 mb-2">
        {shouldWarn ? (
          <AlertTriangle className="w-5 h-5 text-mindflow-warning" />
        ) : (
          <Coffee className="w-5 h-5 text-mindflow-success" />
        )}
        <h4 className="font-semibold text-mindflow-heading text-sm">{title}</h4>
      </div>
      {breakTick != null ? (
        <p className="text-sm text-mindflow-text">
          {recovery
            ? `A 10–15 min break at the ${breakTickEtA(breakTick)} mark resets your fatigue curve — sending you back to a Flow-dominant state for the rest of the session.`
            : `Your fatigue probability crosses the 40 % threshold at the ${breakTickEtA(breakTick)} mark. Schedule a 10–15 min recovery break at or before this point.`
          }
        </p>
      ) : (
        <p className="text-sm text-mindflow-muted">
          Fatigue stays under 40 % for the full 3-hour window — no break needed.
        </p>
      )}
      {shouldWarn && (
        <span className="inline-block mt-2 text-xs font-semibold text-mindflow-warning bg-mindflow-warning/10 px-2 py-0.5 rounded">
          BURNOUT WARNING: P(Fatigue) &gt; 50 %
        </span>
      )}
    </div>
  )
}

function InfoCard({ icon, title, body }) {
  return (
    <div className="bg-mindflow-surface border border-mindflow-border rounded-xl p-6 space-y-2">
      <div className="flex items-center gap-2 text-mindflow-accent">
        {icon}
        <h4 className="text-sm font-semibold text-mindflow-heading">{title}</h4>
      </div>
      <p className="text-sm text-mindflow-muted leading-relaxed">{body}</p>
    </div>
  )
}

function breakTickEtA(tick) {
  if (tick == null) return '—'
  const mins = tick * 10
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}
