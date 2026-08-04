/**
 * MindFlow Markov Chain Engine v3
 *
 * Non-linear discrete-time Markov chain simulation of cognitive state
 * transitions during a study session. All math runs client-side.
 *
 * States: 0=Flow 1=Distracted 2=Fatigue 3=Recovery
 * Time step Δt = 10 minutes.
 *
 * Mathematical features (v3):
 *   - Sigmoidal transition modifiers (logistic, not linear)
 *   - State-dependent circadian sensitivity
 *   - Flow-entry warmup (attention ramp-up)
 *   - Flow deepening with sudden collapse (flow inertia + tipping point)
 *   - Cognitive momentum (fatigue acceleration when fatigue is rising)
 *   - Biexponential recovery (fast 2-min sympathetic + slow 120-min parasympathetic)
 *   - Intervention sensitivity (break effectiveness drops as fatigue rises)
 *   - Cognitive capacity ceiling (diminishing returns beyond total load threshold)
 *   - Custom initial state + attention residue support
 *   - Optimal break duration computation
 */

// -- Base transition matrix --------------------------------------------------
const P_BASE = [
  [0.80, 0.15, 0.05, 0.00], // From Flow
  [0.20, 0.60, 0.20, 0.00], // From Distracted
  [0.05, 0.15, 0.80, 0.00], // From Fatigued
  [0.70, 0.10, 0.00, 0.20], // From Recovery
];

// -- Physiological constants -------------------------------------------------

// Warmup
const WARMUP_TICKS = 3;
const WARMUP_TAU = 1.5;
const WARMUP_MIN = 0.70;

// Biexponential recovery (fast sympathetic + slow parasympathetic)
const RECOVERY_TAU_FAST = 2.0;     // minutes — acute sympathetic recovery
const RECOVERY_TAU_SLOW = 120.0;   // minutes — deep parasympathetic recovery
const RECOVERY_WEIGHT_FAST = 0.40; // 40% fast component
const RECOVERY_WEIGHT_SLOW = 0.60; // 60% slow component

// Flow inertia
const FLOW_INERTIA_BUILD = 0.06;   // per-tick flow anchor strengthening
const FLOW_INERTIA_MAX = 1.60;     // max 60% stronger than baseline
const FLOW_COLLAPSE_THRESHOLD = 12; // ~2 hours — tipping point (ticks)
const FLOW_COLLAPSE_STEEPNESS = 0.3; // how sharp the collapse is

// Cognitive momentum
const MOMENTUM_AMPLIFY = 0.15;     // how much acceleration amplifies transitions

// Intervention sensitivity
const INTERVENTION_MIDPOINT = 0.40; // fatigue level where break is 50% effective
const INTERVENTION_STEEPNESS = 10.0; // how sharply effectiveness drops

// Cognitive capacity
const CAPACITY_BASE = 180.0;       // base cognitive capacity (load units)

// Keep backward-compatible alias
const RECOVERY_TAU_MINUTES = RECOVERY_TAU_SLOW;

// -- Public API (backward-compatible) ----------------------------------------

/**
 * Run a full Markov-chain simulation.
 *
 * @param {number}  alpha       Cognitive baseline (0.5–1.5)
 * @param {number}  beta        Task difficulty (1–5)
 * @param {number}  gamma       Circadian coefficient (0.7–1.25)
 * @param {number}  steps       10-min ticks (default 18 = 3 hours)
 * @param {number[]} [initialState] Optional [flow, distracted, fatigue, recovery]
 * @param {object}  [options]   Advanced options (see below)
 * @param {number}  [options.cumulativeLoad=0]    Total cognitive load so far today
 * @param {string}  [options.prevTaskType=null]   Previous task type for attention residue
 * @param {boolean} [options.disableFlowInertia]   Disable flow deepening/collapse
 * @param {boolean} [options.disableMomentum]      Disable cognitive momentum
 * @returns {MarkovTimePoint[]}
 */
export function calculateMarkovTimeline(
  alpha = 1.0, beta = 3, gamma = 1.0, steps = 18, initialState = null, options = null
) {
  const opts = options || {};
  let v0 = validateInitialState(initialState);

  // Apply attention residue if switching task types
  if (opts.prevTaskType && initialState === null) {
    v0 = applyAttentionResidue(v0, opts.prevTaskType);
  }

  const timeline = simulateTrajectory(alpha, beta, gamma, steps, v0, opts);
  return timeline;
}

export function findBurnoutTick(timeline, threshold = 0.50) {
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].fatigue > threshold) return i;
  }
  return -1;
}

export function optimizeWithBreak(
  alpha, beta, gamma, steps = 18, burnoutTick, breakMinutes = 15, options = null
) {
  const opts = options || {};
  const initialState = opts.initialState || null;
  const original = calculateMarkovTimeline(alpha, beta, gamma, steps, initialState, opts);

  if (!burnoutTick || burnoutTick <= 0) {
    return { original, optimized: original };
  }

  const breakInsertTick = Math.max(0, burnoutTick - 1);
  const v0 = validateInitialState(initialState);

  const preBreak = simulateTrajectoryN(alpha, beta, gamma, breakInsertTick, [...v0], opts);

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
    alpha, beta, gamma, postBreakV, remainingSteps, breakInsertTick + 1, opts
  );
  return { original, optimized: [...preBreak, ...postBreak] };
}

// -- Optimal break computation (biexponential) -------------------------------

/**
 * Compute optimal break duration using the biexponential recovery model.
 *
 * Recovery: R(t) = w_fast·e^(−t/τ_fast) + w_slow·e^(−t/τ_slow)
 *
 * For inversion, we use the dominant slow component for t > 5 min:
 *   t_break = −τ_slow × ln(target / current)
 *
 * Then scale by intervention sensitivity:
 *   effectiveness = 1 − σ(fatigue − 0.40, 10)
 *   t_adjusted = t_raw / effectiveness
 *
 * @param {MarkovTimePoint[]} timeline
 * @param {number} burnoutTick
 * @param {number} [targetFatigue=0.30]
 * @returns {number} Break duration in minutes (rounded to nearest 5)
 */
export function computeOptimalBreakDuration(timeline, burnoutTick, targetFatigue = 0.30) {
  if (!timeline || timeline.length === 0) return 15;
  if (burnoutTick <= 0 || burnoutTick >= timeline.length) return 15;

  const state = timeline[burnoutTick];
  const currentFatigue = state.fatigue;
  const currentFlow = state.flow;

  if (currentFatigue <= targetFatigue) return 5;

  const ratio = targetFatigue / currentFatigue;
  if (ratio <= 0 || ratio >= 1) return 15;

  // Use slow component for longer breaks
  const rawMinutes = -RECOVERY_TAU_SLOW * Math.log(ratio);

  // Intervention sensitivity: breaks are less effective at higher fatigue
  const effectiveness = 1.0 - sigmoid(currentFatigue, INTERVENTION_MIDPOINT, INTERVENTION_STEEPNESS);
  const effectiveFactor = Math.max(0.25, effectiveness);

  // Recovery capacity depends on flow
  const recoveryCapacity = currentFlow * 0.8 + 0.2;

  const adjustedMinutes = rawMinutes / (effectiveFactor * recoveryCapacity);

  return Math.max(5, Math.min(60, Math.round(adjustedMinutes / 5) * 5));
}

// -- Biexponential recovery state computation --------------------------------

/**
 * Compute post-break cognitive state using biexponential recovery.
 *
 * Recovery has two phases:
 *   Fast (τ=2min): acute sympathetic recovery — quick but shallow
 *   Slow (τ=120min): deep parasympathetic recovery — gradual but thorough
 *
 * Intervention sensitivity: a break at 30% fatigue recovers ~90% of possible
 * flow. The same break at 70% fatigue only recovers ~40%.
 *
 * @param {number[]} currentState  [flow, distracted, fatigue, recovery]
 * @param {number}   breakMinutes
 * @returns {number[]} Post-break state vector
 */
export function computeRecoveryState(currentState, breakMinutes = 15) {
  const [flow, distracted, fatigue, recovery] = currentState;

  // Biexponential decay of fatigue
  const decayFast = Math.exp(-breakMinutes / RECOVERY_TAU_FAST);
  const decaySlow = Math.exp(-breakMinutes / RECOVERY_TAU_SLOW);
  const totalDecay = RECOVERY_WEIGHT_FAST * decayFast + RECOVERY_WEIGHT_SLOW * decaySlow;

  const newFatigue = fatigue * totalDecay;
  const fatigueReduced = fatigue - newFatigue;

  // Intervention sensitivity: how much of the fatigue reduction converts to flow
  const sensitivity = 1.0 - sigmoid(fatigue, INTERVENTION_MIDPOINT, INTERVENTION_STEEPNESS);

  // Conversion efficiency: more flow → better conversion, scaled by sensitivity
  const baseEfficiency = flow > 0.3 ? 0.7 : 0.4;
  const conversionEfficiency = baseEfficiency * Math.max(0.2, sensitivity);

  const toFlow = fatigueReduced * conversionEfficiency;
  const toRecovery = fatigueReduced * (1 - conversionEfficiency);

  let newFlow = flow + toFlow;
  let newDistracted = distracted * totalDecay;
  const distractedReduced = distracted - newDistracted;
  newFlow += distractedReduced * 0.5;
  const newRecovery = recovery + toRecovery + distractedReduced * 0.5;

  // Clamp and normalize
  newFlow = clamp(newFlow);
  newDistracted = clamp(newDistracted);
  const newFatigueClamped = clamp(newFatigue);
  const newRecoveryClamped = clamp(newRecovery);

  const sum = newFlow + newDistracted + newFatigueClamped + newRecoveryClamped;
  if (sum > 0 && Number.isFinite(sum)) {
    return [newFlow / sum, newDistracted / sum, newFatigueClamped / sum, newRecoveryClamped / sum];
  }

  return [0.85, 0.10, 0.05, 0];
}

// -- Attention residue -------------------------------------------------------

/**
 * Attention residue: cognitive carryover when switching between task types.
 *
 * Switching from academic→sports: 20% residue (brain still on math)
 * Switching from academic→academic: 5% residue (same domain)
 *
 * The residue modifies the initial state: some distracted probability carries
 * over from the "mental context switch."
 *
 * @param {string} prevType  Previous task type
 * @param {string} newType   New task type
 * @returns {number} Residue factor [0, 1] — higher = more disruption
 */
export function computeAttentionResidue(prevType, newType) {
  if (!prevType || !newType) return 0;
  if (prevType === newType) return 0.05; // same domain = minimal switching cost

  const residueMap = {
    academic: { sports: 0.22, arts: 0.14, other: 0.12, academic: 0.05 },
    sports:   { academic: 0.18, arts: 0.12, other: 0.10, sports: 0.05 },
    arts:     { academic: 0.14, sports: 0.10, other: 0.11, arts: 0.05 },
    other:    { academic: 0.12, sports: 0.10, arts: 0.11, other: 0.05 },
  };

  return (residueMap[prevType] && residueMap[prevType][newType]) || 0.10;
}

/**
 * Apply attention residue to an initial state vector.
 * The residue shifts some flow → distracted to model context-switching cost.
 *
 * @param {number[]} state    [flow, distracted, fatigue, recovery]
 * @param {string} prevType   Previous task type
 * @returns {number[]} Modified state
 */
function applyAttentionResidue(state, prevType) {
  // Shifts flow → distracted based on task type switching cost.
  // Uses the type-pair-specific residue values from computeAttentionResidue,
  // falling back to 'other' when the new task type is unknown.
  // When no prevType specified, uses generic 12% residue.
  const residue = prevType ? computeAttentionResidue(prevType, 'other') : 0.12;
  const flowLoss = state[0] * residue;
  return [
    clamp(state[0] - flowLoss),
    clamp(state[1] + flowLoss * 0.7),
    clamp(state[2] + flowLoss * 0.15),
    clamp(state[3] + flowLoss * 0.15),
  ];
}

// -- Cognitive capacity ------------------------------------------------------

/**
 * Compute the cognitive capacity ceiling for a given alpha.
 * Higher alpha → higher capacity before diminishing returns kick in.
 *
 * @param {number} alpha  Cognitive baseline (0.5–1.5)
 * @returns {number} Capacity in load units
 */
export function computeCognitiveCapacity(alpha = 1.0) {
  return CAPACITY_BASE * (0.5 + alpha * 0.5);
}

// ===========================================================================
// Internal: Matrix Construction (v3)
// ===========================================================================

/**
 * Build the 4×4 dynamic transition matrix.
 *
 * v3 additions:
 *   - Flow inertia: flow retention strengthens with consecutive flow ticks,
 *     then suddenly collapses after ~2 hours (tipping point).
 *   - Cognitive momentum: when fatigue is accelerating, off-diagonal
 *     transitions are amplified (slippery slope).
 *   - Capacity ceiling: when cumulative load exceeds cognitive capacity,
 *     all fatigue transitions are amplified.
 *
 * @param {number} alpha
 * @param {number} beta
 * @param {number} gamma
 * @param {number} tick             Current tick
 * @param {number} currentFatigue   P(Fatigue) at this tick
 * @param {number} prevFatigue      P(Fatigue) at previous tick (for momentum)
 * @param {number} flowStreak       Consecutive ticks in flow state
 * @param {number} cumulativeLoad   Total cognitive load so far
 * @returns {number[][]} 4×4 stochastic matrix
 */
function buildDynamicMatrix(
  alpha, beta, gamma, tick, currentFatigue, prevFatigue, flowStreak, cumulativeLoad
) {
  const a = Number.isFinite(alpha) ? Math.max(0.3, Math.min(3.0, alpha)) : 1.0;
  const b = Number.isFinite(beta) ? Math.max(1, Math.min(5, beta)) : 3;
  const g = Number.isFinite(gamma) ? Math.max(0.5, Math.min(2.0, gamma)) : 1.0;

  // -- Sigmoidal modifiers ----------------------------------------------------
  // Centers calibrated so that alpha=1.0 (normal) gives ~73% flow retention
  const alphaFlowMod = sigmoid(a, 0.75, 4.0);       // [0.27, 0.95] at α=[0.5,1.5]
  const alphaRecoveryMod = sigmoid(a, 0.80, 3.0);   // gentler recovery slope
  const betaFatigueMod = sigmoid(b, 3.0, 1.2);      // [0.08, 0.92] at β=[1,5]
  const betaDistractMod = sigmoid(b, 3.5, 1.5);     // harder to trigger distraction

  // State-dependent gamma
  const gammaStateBoost = 1.0 + currentFatigue * 0.6;
  const effectiveGamma = 1.0 + (g - 1.0) * gammaStateBoost;
  const gammaMod = clamp(effectiveGamma);

  // -- Warmup factor ----------------------------------------------------------
  const warmupFactor = tick < WARMUP_TICKS
    ? WARMUP_MIN + (1 - WARMUP_MIN) * (1 - Math.exp(-tick / WARMUP_TAU))
    : 1.0;

  // -- Flow inertia (v3) ------------------------------------------------------
  // Flow deepens with time: staying in flow makes it easier to stay in flow
  // (positive feedback), up to FLOW_INERTIA_MAX × baseline.
  // But after FLOW_COLLAPSE_THRESHOLD ticks, collapse risk rises sharply.
  const flowInertia = 1.0 + Math.min(
    FLOW_INERTIA_MAX - 1.0,
    FLOW_INERTIA_BUILD * flowStreak
  );
  // Collapse risk: sigmoid that activates after ~2 hours
  const collapseRisk = flowStreak > FLOW_COLLAPSE_THRESHOLD
    ? sigmoid(flowStreak - FLOW_COLLAPSE_THRESHOLD, 3, FLOW_COLLAPSE_STEEPNESS)
    : 0;
  // Net flow modifier: inertia helps, collapse hurts
  const flowAnchorMod = warmupFactor * (flowInertia * (1 - collapseRisk * 0.7));

  // -- Cognitive momentum (v3) ------------------------------------------------
  // If fatigue is accelerating (current > previous), amplify off-diagonal transitions
  const fatigueDelta = prevFatigue !== null
    ? Math.max(0, currentFatigue - prevFatigue)
    : 0;
  const momentumAmplify = 1.0 + fatigueDelta * MOMENTUM_AMPLIFY * (1 / 0.05);
  // Normalized: at Δfatigue=0.05 (5% per tick), amplify by 15%

  // -- Capacity ceiling (v3) --------------------------------------------------
  // Beyond capacity, all fatigue transitions are amplified
  const capacity = computeCognitiveCapacity(a);
  const capacityFactor = cumulativeLoad > capacity
    ? 1.0 + (cumulativeLoad - capacity) / capacity
    : 1.0;
  // At 150% capacity: 50% amplification of fatigue transitions

  // -- Build matrix -----------------------------------------------------------
  const P = P_BASE.map((row) => [...row]);

  // Row 0 — Flow
  P[0][0] *= alphaFlowMod * flowAnchorMod;
  P[0][1] *= (1 + betaDistractMod) * momentumAmplify;
  P[0][2] *= (1 + betaFatigueMod) * gammaMod * momentumAmplify * capacityFactor;

  // Row 1 — Distracted
  P[1][0] *= alphaFlowMod;
  P[1][1] *= (2 - alphaFlowMod);
  P[1][2] *= gammaMod * momentumAmplify * capacityFactor;

  // Row 2 — Fatigued
  P[2][0] *= (0.3 + alphaFlowMod * 0.2);
  P[2][1] *= gammaMod;
  P[2][2] *= gammaMod * capacityFactor;
  P[2][3] *= alphaRecoveryMod;

  // Row 3 — Recovery
  P[3][0] *= alphaRecoveryMod;
  P[3][1] *= (1.5 - alphaFlowMod * 0.5);
  P[3][3] *= alphaFlowMod;

  // Normalise
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

// ===========================================================================
// Internal: Simulation (v3)
// ===========================================================================

function simulateTrajectory(alpha, beta, gamma, steps, v0, opts = {}) {
  const timeline = [];
  let v = [...v0];
  let prevFatigue = null;
  let flowStreak = 0;
  const cumulativeLoad = opts.cumulativeLoad || 0;

  for (let t = 0; t <= steps; t++) {
    timeline.push(makeTick(t, v));

    const currentFatigue = v[2];

    // Track flow streak (for flow inertia)
    if (v[0] > 0.3) {
      flowStreak++;
    } else {
      flowStreak = Math.max(0, flowStreak - 2); // decay streak when not in flow
    }

    // Build matrix with all v3 parameters
    const P = buildDynamicMatrix(
      alpha, beta, gamma, t, currentFatigue, prevFatigue, flowStreak,
      cumulativeLoad + t * (beta / 5) * gamma // approximate cumulative load this session
    );

    // v(t+1) = v(t) · P
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

    prevFatigue = currentFatigue;
  }

  return timeline;
}

function simulateTrajectoryN(alpha, beta, gamma, steps, v0, opts = {}) {
  return simulateTrajectory(alpha, beta, gamma, steps, v0, opts);
}

function simulateTrajectoryFrom(alpha, beta, gamma, v0, steps, startTick, opts = {}) {
  const timeline = [];
  let v = [...v0];
  let prevFatigue = null;
  let flowStreak = 0;
  const cumulativeLoad = opts.cumulativeLoad || 0;

  for (let t = 0; t <= steps; t++) {
    timeline.push(makeTick(startTick + t, v));

    const currentFatigue = v[2];
    if (v[0] > 0.3) { flowStreak++; }
    else { flowStreak = Math.max(0, flowStreak - 2); }

    const P = buildDynamicMatrix(
      alpha, beta, gamma, startTick + t, currentFatigue, prevFatigue, flowStreak,
      cumulativeLoad + (startTick + t) * (beta / 5) * gamma
    );

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
    prevFatigue = currentFatigue;
  }

  return timeline;
}

// -- Helpers -----------------------------------------------------------------

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

// -- Exports -----------------------------------------------------------------

export {
  sigmoid,
  RECOVERY_TAU_MINUTES,
  RECOVERY_TAU_FAST,
  RECOVERY_TAU_SLOW,
  WARMUP_TICKS,
};
