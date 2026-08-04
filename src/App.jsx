import { useState, useEffect, useCallback, useId, useRef, Component } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ReferenceLine,
} from 'recharts'
import { Brain, Calendar, Play, Settings, AlertTriangle, Zap, Coffee } from 'lucide-react'

const API = '/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tickLabel(i) {
  if (i == null) return '—'
  const total = i * 10
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
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
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// MindFlow App
// ---------------------------------------------------------------------------

function App() {
  const id = useId()
  // --- Input state ---
  const [alpha, setAlpha] = useState(1.0)
  const [beta, setBeta] = useState(3.0)
  const [gamma, setGamma] = useState(1.0)

  // --- Simulation state ---
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const abortRef = useRef(null)
  const isFirstRun = useRef(true)

  const runSimulation = useCallback(async () => {
    // Cancel any in-flight request to avoid stale responses
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const url = `${API}/simulate?alpha=${encodeURIComponent(alpha)}&beta=${encodeURIComponent(beta)}&gamma=${encodeURIComponent(gamma)}&steps=18`
      const res = await fetch(url, { method: 'POST', signal: controller.signal })
      if (!res.ok) {
        const detail = await res.json().then(d => d.detail).catch(() => null)
        throw new Error(detail || `API error: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      // Ignore abort errors (stale request was cancelled)
      if (e?.name !== 'AbortError') {
        const msg = e?.message || String(e)
        // Improve cryptic network / proxy / server error messages
        const isConnectionError = (
          msg === 'Failed to fetch' ||
          msg.includes('NetworkError') ||
          /API error: 5\d\d/.test(msg)
        )
        if (isConnectionError) {
          setError('Cannot reach the backend. Make sure the API server is running on port 8000.')
        } else {
          setError(msg)
        }
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false)
      }
    }
  }, [alpha, beta, gamma])

  // Run on mount immediately, debounce subsequent slider changes
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      runSimulation()
      return
    }
    const timer = setTimeout(() => runSimulation(), 250)
    return () => clearTimeout(timer)
  }, [runSimulation])

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [])

  // --- Format chart data ---
  const chartData = data?.trajectory
    ? data.trajectory
        .filter(v => Array.isArray(v) && v.length >= 4)
        .map((v, i) => ({
          time: tickLabel(i),
          Flow: +(v[0] * 100).toFixed(1),
          Distracted: +(v[1] * 100).toFixed(1),
          Fatigue: +(v[2] * 100).toFixed(1),
          Recovery: +(v[3] * 100).toFixed(1),
        }))
    : []

  const inDanger = data?.trajectory?.some(v => v[2] > 0.50) ?? false

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
                    <linearGradient id={`flowGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`distGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`fatGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`recGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2a2a38" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="#6b6b80" fontSize={12} />
                  <YAxis stroke="#6b6b80" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    formatter={(value) => `${value}%`}
                    contentStyle={{
                      background: '#1a1a24', border: '1px solid #2a2a38',
                      borderRadius: 12, fontSize: 13,
                    }}
                  />
                  <Area type="monotone" dataKey="Flow" stroke="#8b5cf6" fill={`url(#flowGrad-${id})`} strokeWidth={2} />
                  <Area type="monotone" dataKey="Distracted" stroke="#f59e0b" fill={`url(#distGrad-${id})`} strokeWidth={2} />
                  <Area type="monotone" dataKey="Fatigue" stroke="#ef4444" fill={`url(#fatGrad-${id})`} strokeWidth={2} />
                  <Area type="monotone" dataKey="Recovery" stroke="#34d399" fill={`url(#recGrad-${id})`} strokeWidth={2} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="rect"
                    iconSize={10}
                    wrapperStyle={{ fontSize: 12, color: '#c4c4d0' }}
                  />
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
                  inDanger={false}
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
            body="Algorithm watches P(Fatigue) > 50% and flags the optimal tick to insert a 10–15 min recovery-break before burnout."
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
// Export (wrapped in error boundary)
// ---------------------------------------------------------------------------

export default function MindFlowApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Slider control card for a single parameter (α, β, or γ).
 *
 * @param {object} props
 * @param {React.ReactNode} props.icon     - Lucide icon element
 * @param {string}          props.label    - Display label (e.g. "Personal Calibration (α)")
 * @param {number}          props.value    - Current slider value
 * @param {(v: number) => void} props.set  - State setter
 * @param {number}          props.min      - Slider minimum
 * @param {number}          props.max      - Slider maximum
 * @param {number}          props.step     - Slider step increment
 * @param {string}          props.hint     - Help text below the value
 */
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

/**
 * Recommendation card shown below the chart.
 *
 * @param {object}  props
 * @param {string}  props.title      - Card heading
 * @param {number|null} props.breakTick - Tick index where fatigue crosses 50 %, or null
 * @param {boolean} props.inDanger   - Whether any tick exceeds 50 % fatigue
 * @param {boolean} [props.recovery] - If true, show post-break projection text
 */
function BreakCard({ title, breakTick, inDanger, recovery }) {
  return (
    <div className={`rounded-xl p-5 border ${inDanger ? 'border-mindflow-warning/50 bg-mindflow-warning/5' : 'border-mindflow-border bg-mindflow-surface'}`}>
      <div className="flex items-center gap-2 mb-2">
        {inDanger ? (
          <AlertTriangle className="w-5 h-5 text-mindflow-warning" />
        ) : (
          <Coffee className="w-5 h-5 text-mindflow-success" />
        )}
        <h4 className="font-semibold text-mindflow-heading text-sm">{title}</h4>
      </div>
      {breakTick != null ? (
        <p className="text-sm text-mindflow-text">
          {recovery
            ? `A 10–15 min break at the ${tickLabel(breakTick)} mark resets your fatigue curve — sending you back to a Flow-dominant state for the rest of the session.`
            : `Your fatigue probability crosses the 50 % threshold at the ${tickLabel(breakTick)} mark. Schedule a 10–15 min recovery break at or before this point.`
          }
        </p>
      ) : (
        <p className="text-sm text-mindflow-muted">
          {recovery
            ? 'Your current parameters keep fatigue in a healthy range — no break intervention is needed for this session.'
            : 'Fatigue stays under 50 % for the full 3-hour window — no break needed.'
          }
        </p>
      )}
      {inDanger && (
        <span className="inline-block mt-2 text-xs font-semibold text-mindflow-warning bg-mindflow-warning/10 px-2 py-0.5 rounded">
          BURNOUT WARNING: P(Fatigue) &gt; 50 %
        </span>
      )}
    </div>
  )
}

/**
 * Static info card used in the "How it works" section.
 *
 * @param {object} props
 * @param {React.ReactNode} props.icon  - Lucide icon element
 * @param {string}          props.title - Card heading
 * @param {string}          props.body  - Description paragraph
 */
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

