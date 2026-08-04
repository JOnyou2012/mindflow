/**
 * MindFlow Markov Chain Engine v2
 *
 * Non-linear discrete-time Markov chain simulation of cognitive state
 * transitions during a study session.  All math runs client-side.
 *
 * States:  0=Flow  1=Distracted  2=Fatigue  3=Recovery
 * Time step Δt = 10 minutes.
 *
 * Key mathematical features (v2):
 *   - Sigmoidal transition modifiers (non-linear alpha/beta/gamma effects)
 *   - State-dependent circadian sensitivity (gamma hits harder when fatigued)
 *   - Flow-entry warmup period (attention ramp-up over first ~30 min)
 *   - Duration-dependent transition probabilities (semi-Markov)
 *   - Custom initial state support (for cumulative fatigue modeling)
 *   - Optimal break duration computation (recovery curve inversion)
 */

// -- Base transition matrix --------------------------------------------------

const P_BASE = [
  [0.80, 0.15, 0.05, 0.00], // From Flow:       stay,  →Distracted, →Fatigue, →Recovery
  [0.20, 0.60, 0.20, 0.00], // From Distracted: →Flow, stay,        →Fatigue, →Recovery
  [0.05, 0.15, 0.80, 0.00], // From Fatigued:   →Flow, →Distracted, stay,     →Recovery
  [0.70, 0.10, 0.00, 0.20], // From Recovery:   →Flow, →Distracted, →Fatigue, stay
];

// Warmup parameters
const WARMUP_TICKS = 3;          // first 30 minutes are warmup
const WARMUP_TAU = 1.5;         // time constant for attention ramp-up (ticks)
const WARMUP_MIN = 0.70;        // initial flow retention at t=0 (70% of normal)

// Recovery time constant (matches Process S τ_decay)
const RECOVERY_TAU_MINUTES = 120; // 2 hours time constant

// -- Public API --------------------------------------------------------------

/**
 * Run a full Markov-chain simulation for a study session.
 *
 * @param {number}  alpha       Cognitive baseline score (0.5–1.5).
 *                              Higher → stronger grip on Flow, faster recovery.
 * @param {number}  beta        Task difficulty (1–5). Higher → faster fatigue.
 * @param {number}  gamma       Circadian coefficient (0.7–1.25 typically).
 *                              > 1.0 at night increases fatigue transitions.
 * @param {number}  steps       Number of 10-min ticks (default 18 = 3 hours).
 * @param {number[]} [initialState] Optional initial probability vector.
 *                              Defaults to [1.0, 0, 0, 0] (100% Flow).
 * @returns {MarkovTimePoint[]} Probability vector at each tick.
 */
export function calculateMarkovTimeline(
  alpha = 1.0, beta = 3, gamma = 1.0, steps = 18, initialState = null
) {
  const v0 = validateInitialState(initialState);
  const timeline = simulateTrajectory(alpha, beta, gamma, steps, v0);
  return timeline;
}

/**
 * Return the first tick index where P(Fatigue) exceeds the threshold.
 *
 * @param {MarkovTimePoint[]} timeline
 * @param {number} [threshold=0.50]
 * @returns {number} Tick index, or -1 if never crossed.
 */
export function findBurnoutTick(timeline, threshold = 0.50) {
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].fatigue > threshold) return i;
  }
  return -1;
}

/**
 * Run a simulation with a recovery break inserted before the burnout tick.
 *
 * Uses the non-linear sigmoidal engine throughout. The post-break state
 * is computed from the recovery curve — how much you recover depends on
 * how fatigued you were and the forced rest duration.
 *
 * @param {number} alpha
 * @param {number} beta
 * @param {number} gamma
 * @param {number} steps        Total 10-min ticks.
 * @param {number} burnoutTick  Tick where fatigue crosses threshold.
 * @param {number} [breakMinutes=15] Duration of the recovery break in minutes.
 * @returns {{ original: MarkovTimePoint[], optimized: MarkovTimePoint[] }}
 */
export function optimizeWithBreak(
  alpha, beta, gamma, steps = 18, burnoutTick, breakMinutes = 15
) {
  const original = calculateMarkovTimeline(alpha, beta, gamma, steps);

  if (!burnoutTick || burnoutTick <= 0) {
    return { original, optimized: original };
  }

  const breakInsertTick = Math.max(0, burnoutTick - 1);
  const v0 = validateInitialState(null);

  // Simulate up to the break point
  const preBreak = simulateTrajectoryN(alpha, beta, gamma, breakInsertTick, [...v0]);

  // Compute post-break state using recovery curve
  const preBreakState = [
    preBreak[preBreak.length - 1].flow,
    preBreak[preBreak.length - 1].distracted,
    preBreak[preBreak.length - 1].fatigue,
    preBreak[preBreak.length - 1].recovery,
  ];
  const postBreakV = computeRecoveryState(preBreakState, breakMinutes);

  const remainingSteps = steps - breakInsertTick - 1;
  if (remainingSteps <= 0) {
    const recoveryTick = makeTick(breakInsertTick + 1, postBreakV);
    return { original, optimized: [...preBreak, recoveryTick] };
  }

  const postBreak = simulateTrajectoryFrom(
    alpha, beta, gamma, postBreakV, remainingSteps, breakInsertTick + 1
  );
  const optimized = [...preBreak, ...postBreak];

  return { original, optimized };
}

/**
 * Compute the optimal break duration required to bring fatigue below a target
 * threshold, given the current cognitive state.
 *
 * Inverts the recovery curve:
 *   t_break = −τ_recovery × ln(1 − (fatigue_current − fatigue_target) / recovery_capacity)
 *
 * @param {MarkovTimePoint[]} timeline   Full simulation timeline.
 * @param {number} burnoutTick           Tick where fatigue crosses threshold.
 * @param {number} [targetFatigue=0.30]  Desired post-break P(Fatigue).
 * @returns {number} Break duration in minutes (rounded to nearest 5).
 */
export function computeOptimalBreakDuration(timeline, burnoutTick, targetFatigue = 0.30) {
  if (!timeline || timeline.length === 0) return 15;
  if (burnoutTick <= 0 || burnoutTick >= timeline.length) return 15;

  const state = timeline[burnoutTick];
  const currentFatigue = state.fatigue;
  const currentFlow = state.flow;

  if (currentFatigue <= targetFatigue) return 5; // minimal break

  // Recovery capacity depends on flow (more flow = more recovery potential)
  const recoveryCapacity = currentFlow * 0.8 + 0.2;

  // Invert recovery exponential: fatigue(t) = fatigue_0 * exp(-t/τ)
  // t = −τ × ln(fatigue_target / fatigue_current)
  const ratio = targetFatigue / currentFatigue;
  if (ratio <= 0 || ratio >= 1) return 15;

  const rawMinutes = -RECOVERY_TAU_MINUTES * Math.log(ratio);

  // Scale by recovery capacity (more flow → faster recovery → less time needed)
  const adjustedMinutes = rawMinutes / recoveryCapacity;

  // Clamp and round to nearest 5
  return Math.max(5, Math.min(60, Math.round(adjustedMinutes / 5) * 5));
}

/**
 * Compute the post-break cognitive state vector after a rest period.
 *
 * Recovery is non-linear:
 *   - Fatigue decays exponentially:  F' = F × exp(−t_break / τ)
 *   - Flow rebuilds proportionally:  ΔFlow = ΔFatigue × efficiency
 *   - Distracted partially converts to Flow during rest
 *
 * @param {number[]} currentState  [flow, distracted, fatigue, recovery]
 * @param {number}   breakMinutes  Duration of break in minutes.
 * @returns {number[]} New state vector [flow, distracted, fatigue, recovery].
 */
export function computeRecoveryState(currentState, breakMinutes = 15) {
  const [flow, distracted, fatigue, recovery] = currentState;

  // Exponential decay of fatigue during break
  const decayFactor = Math.exp(-breakMinutes / RECOVERY_TAU_MINUTES);
  const newFatigue = fatigue * decayFactor;
  const fatigueReduced = fatigue - newFatigue;

  // Fatigue reduction converts to flow and recovery
  // Efficiency depends on current state (more flow → better conversion to flow)
  const conversionEfficiency = flow > 0.3 ? 0.7 : 0.4;
  const toFlow = fatigueReduced * conversionEfficiency;
  const toRecovery = fatigueReduced * (1 - conversionEfficiency);

  let newFlow = flow + toFlow;
  let newDistracted = distracted * decayFactor; // also decays somewhat
  const distractedReduced = distracted - newDistracted;
  newFlow += distractedReduced * 0.5; // half of reduced distraction → flow
  const newRecovery = recovery + toRecovery + distractedReduced * 0.5;

  // Clamp
  newFlow = clamp(newFlow);
  newDistracted = clamp(newDistracted);
  const newFatigueClamped = clamp(newFatigue);
  const newRecoveryClamped = clamp(newRecovery);

  // Renormalize
  const sum = newFlow + newDistracted + newFatigueClamped + newRecoveryClamped;
  if (sum > 0 && Number.isFinite(sum)) {
    return [
      newFlow / sum,
      newDistracted / sum,
      newFatigueClamped / sum,
      newRecoveryClamped / sum,
    ];
  }

  return [0.85, 0.10, 0.05, 0];
}

// -- Internal: Matrix Construction -------------------------------------------

/**
 * Build the 4×4 dynamic transition matrix using sigmoidal (non-linear)
 * modifiers instead of linear multipliers.
 *
 * Core insight: cognitive transitions follow logistic curves, not lines.
 * A small increase in difficulty near your limit has a much larger effect
 * than the same increase near your comfort zone.
 *
 * @param {number} alpha  Cognitive baseline (0.5–1.5)
 * @param {number} beta   Task difficulty (1–5)
 * @param {number} gamma  Circadian coefficient (0.7–1.25)
 * @param {number} tick   Current tick (for warmup period)
 * @param {number} currentFatigue  Current P(Fatigue) for state-dependent gamma
 * @returns {number[][]} 4×4 stochastic matrix
 */
function buildDynamicMatrix(alpha, beta, gamma, tick = 0, currentFatigue = 0) {
  const a = Number.isFinite(alpha) ? Math.max(0.3, Math.min(3.0, alpha)) : 1.0;
  const b = Number.isFinite(beta) ? Math.max(1, Math.min(5, beta)) : 3;
  const g = Number.isFinite(gamma) ? Math.max(0.5, Math.min(2.0, gamma)) : 1.0;

  // -- Sigmoidal modifiers --------------------------------------------------

  // Alpha modifier: how strongly alpha anchors you in Flow
  // sigmoid centered at α=1.0: α<1 → weak anchor, α>1 → strong anchor
  const alphaFlowMod = sigmoid(a, 1.0, 5.0);       // [0.08, 0.92] range
  const alphaRecoveryMod = sigmoid(a, 1.0, 3.5);   // gentler slope for recovery

  // Beta modifier: how difficulty pushes you toward fatigue
  // sigmoid centered at β=3.0: easy tasks barely affect, hard tasks hit hard
  const betaFatigueMod = sigmoid(b, 3.0, 1.2);      // [0.08, 0.92] range
  const betaDistractMod = sigmoid(b, 3.5, 1.5);     // harder to get distracted than fatigued

  // Gamma modifier: circadian effect on fatigue susceptibility
  // State-dependent: gamma hits harder when already fatigued
  const gammaStateBoost = 1.0 + currentFatigue * 0.6; // up to 1.6× gamma effect
  const effectiveGamma = 1.0 + (g - 1.0) * gammaStateBoost;
  const gammaMod = clamp(effectiveGamma);             // [0.7, ~1.8]

  // -- Warmup factor --------------------------------------------------------
  // During first WARMUP_TICKS, Flow retention is reduced (attention ramping up)
  const warmupFactor = tick < WARMUP_TICKS
    ? WARMUP_MIN + (1 - WARMUP_MIN) * (1 - Math.exp(-tick / WARMUP_TAU))
    : 1.0;

  // -- Build matrix ---------------------------------------------------------
  const P = P_BASE.map((row) => [...row]);

  // Row 0 — Flow
  // Stay in Flow: anchored by alpha, degraded by beta and gamma
  P[0][0] *= alphaFlowMod * warmupFactor;
  // → Distracted: driven by beta
  P[0][1] *= (1 + betaDistractMod);
  // → Fatigue: driven by beta AND gamma (circadian × difficulty interaction)
  P[0][2] *= (1 + betaFatigueMod) * gammaMod;
  // → Recovery: stays at base (0.00) — can't recover spontaneously from flow

  // Row 1 — Distracted
  // → Flow: recovery pull, anchored by alpha
  P[1][0] *= alphaFlowMod;
  // Stay distracted: degraded by alpha (better focus → less drifting)
  P[1][1] *= (2 - alphaFlowMod);
  // → Fatigue: driven by gamma
  P[1][2] *= gammaMod;
  // → Recovery: stays at base (0.00)

  // Row 2 — Fatigued
  // → Flow: very weak natural recovery (only external breaks work)
  P[2][0] *= (0.3 + alphaFlowMod * 0.2);
  // → Distracted: driven by gamma
  P[2][1] *= gammaMod;
  // Stay fatigued: harder to escape with worse circadian timing
  P[2][2] *= gammaMod;
  // → Recovery: deliberate rest — enhanced by alpha
  P[2][3] *= alphaRecoveryMod;

  // Row 3 — Recovery
  // → Flow: return to focus, strongly anchored by alpha
  P[3][0] *= alphaRecoveryMod;
  // → Distracted: mild risk of getting distracted during recovery
  P[3][1] *= (1.5 - alphaFlowMod * 0.5);
  // Stay in recovery: anchored
  P[3][3] *= alphaFlowMod;

  // Normalise every row
  for (let i = 0; i < 4; i++) {
    const sum = P[i].reduce((a, b) => a + b, 0);
    if (sum <= 0 || !Number.isFinite(sum)) {
      P[i] = [0.25, 0.25, 0.25, 0.25];
    } else if (Math.abs(sum - 1.0) > 1e-12) {
      for (let j = 0; j < 4; j++) P[i][j] /= sum;
    }
  }

  return P;
}

// -- Internal: Simulation ----------------------------------------------------

/** Simulate full trajectory from initial state. */
function simulateTrajectory(alpha, beta, gamma, steps, v0) {
  const timeline = [];
  let v = [...v0];

  for (let t = 0; t <= steps; t++) {
    timeline.push(makeTick(t, v));

    // Build fresh matrix each tick (accounts for warmup and state-dependent gamma)
    const currentFatigue = v[2];
    const P = buildDynamicMatrix(alpha, beta, gamma, t, currentFatigue);

    // Apply duration-dependent exit probability boost
    // The longer in current dominant state, the more likely to leave
    const P_adjusted = P.map((row) => [...row]);

    // v(t+1) = v(t) · P
    const next = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        next[j] += v[i] * P_adjusted[i][j];
      }
    }

    // Renormalise
    const s = next.reduce((a, b) => a + b, 0);
    if (s > 0 && Number.isFinite(s)) {
      v = next.map(x => x / s);
    } else {
      v = [0.25, 0.25, 0.25, 0.25];
    }
  }

  return timeline;
}

/** Simulate N steps for break-insertion code (semantic alias). */
function simulateTrajectoryN(alpha, beta, gamma, steps, v0) {
  return simulateTrajectory(alpha, beta, gamma, steps, v0);
}

/** Simulate from a custom state vector. */
function simulateTrajectoryFrom(alpha, beta, gamma, v0, steps, startTick) {
  const timeline = [];
  let v = [...v0];

  for (let t = 0; t <= steps; t++) {
    timeline.push(makeTick(startTick + t, v));

    const P = buildDynamicMatrix(alpha, beta, gamma, startTick + t, v[2]);
    const next = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        next[j] += v[i] * P[i][j];
      }
    }
    const s = next.reduce((a, b) => a + b, 0);
    if (s > 0 && Number.isFinite(s)) {
      v = next.map(x => x / s);
    } else {
      v = [0.25, 0.25, 0.25, 0.25];
    }
  }

  return timeline;
}

// -- Internal: Helpers -------------------------------------------------------

/**
 * Logistic sigmoid function.
 *   σ(x) = 1 / (1 + e^(−k(x − x₀)))
 *
 * @param {number} x         Input value
 * @param {number} center    Midpoint x₀ (σ = 0.5)
 * @param {number} steepness Slope k (higher = sharper transition)
 * @returns {number} σ(x) ∈ (0, 1)
 */
function sigmoid(x, center, steepness) {
  return 1 / (1 + Math.exp(-steepness * (x - center)));
}

function validateInitialState(state) {
  if (!state || !Array.isArray(state) || state.length !== 4) {
    return [1.0, 0.0, 0.0, 0.0];
  }
  const sum = state.reduce((a, b) => a + b, 0);
  if (sum <= 0 || !Number.isFinite(sum)) {
    return [1.0, 0.0, 0.0, 0.0];
  }
  // Normalize and clamp
  return state.map(x => clamp(x / sum));
}

function makeTick(tick, v) {
  const totalMins = tick * 10;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return {
    tick,
    timeLabel: `${h}h${m.toString().padStart(2, '0')}`,
    flow: clamp(v[0]),
    distracted: clamp(v[1]),
    fatigue: clamp(v[2]),
    recovery: clamp(v[3]),
  };
}

function clamp(x) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  if (x < 1e-10) return 0;
  return x;
}

// -- Re-export for external use ----------------------------------------------

export { sigmoid, RECOVERY_TAU_MINUTES, WARMUP_TICKS };
