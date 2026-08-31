/**
 * MindFlow Markov Chain Engine v6
 *
 * Non-homogeneous discrete-time Markov chain simulation of cognitive state
 * transitions during a study session. The transition matrix itself evolves
 * over time to model accumulating mental fatigue — this prevents the unrealistic
 * steady-state plateau that homogeneous chains converge to.
 *
 * States: 0=Flow 1=Distracted 2=Fatigue 3=Recovery
 * Time step Δt = 10 minutes.
 *
 * Mathematical features (v6):
 *   - Sigmoidal transition modifiers (logistic, not linear), centered so that
 *     the "average" user/task/time (α=1.0, β=3, γ=1.0) is NEUTRAL (×1.0) —
 *     v5 penalized the population mean with a 27% flow-retention hit
 *   - State-dependent circadian sensitivity (γ>1 actually amplifies fatigue —
 *     v5's clamp() capped the modifier at 1.0, silently killing the channel)
 *   - Flow-entry warmup (attention ramp-up, gentle: ~85% at t=0)
 *   - Flow deepening with sudden collapse (flow inertia + tipping point)
 *   - Cognitive momentum (fatigue acceleration when fatigue is rising)
 *   - Biexponential recovery (fast 2-min sympathetic + slow 120-min parasympathetic)
 *   - Intervention sensitivity (break effectiveness drops as fatigue rises)
 *   - Cognitive capacity ceiling (diminishing returns beyond total load threshold)
 *   - Temporal cognitive drain keyed to ABSOLUTE session time (midpoint ~2h) —
 *     a 60-min task barely drains, a 3h marathon declines hard. v5 keyed drain
 *     to session fraction, so half the drain of a 1-hour task activated at 30 min.
 *   - Custom initial state + attention residue support
 *   - Optimal break duration computation
 *
 * v6 realism calibration targets (α=1.0, β=3, γ=1.0, measured):
 *   30 min → flow ≈ 0.76, fatigue ≈ 0.12
 *   60 min → flow ≈ 0.67, fatigue ≈ 0.20
 *   90 min → flow ≈ 0.60, fatigue ≈ 0.23
 *   120 min → flow ≈ 0.50, fatigue ≈ 0.30
 *   180 min → flow ≈ 0.24, fatigue ≈ 0.56 (burnout reached ≈ tick 17)
 * Difficulty: β=5 at 2h → burnout; β=4 marathon → burnout ≈ 2h20m;
 * β=2 → never burns out. γ=1.25 ≥ 1.5× the fatigue of γ=1.0.
 */

// -- Base transition matrix --------------------------------------------------
// v6: calibrated to per-10-min retention observed in attention research —
// a focused person loses only a few percent of flow per 10-minute window,
// distraction is the minority state, and escaping fatigue is slow but real.
// Asymmetry is preserved: falling into fatigue is easier than climbing out.
const P_BASE = [
  [0.90, 0.055, 0.045, 0.00], // From Flow      (v6: realistic retention)
  [0.25, 0.59, 0.16, 0.00], // From Distracted (v6: fast re-entry to flow)
  [0.05, 0.12, 0.80, 0.03], // From Fatigued  (micro-recovery)
  [0.65, 0.10, 0.02, 0.23], // From Recovery (micro-regression)
];

// -- Physiological constants -------------------------------------------------

// Warmup (v6: gentle ramp — the first minutes of a session are the freshest;
// v5's 0.70 floor dropped 40% of flow in the first 10 minutes, unrealistic)
const WARMUP_TICKS = 3;
const WARMUP_TAU = 2.0;
const WARMUP_MIN = 0.85;

// Modifier sensitivities (v6) — centered so α=1.0 / β=3 / γ=1.0 multiply by 1.0
const ALPHA_FLOW_SENSITIVITY = 0.35;      // flow-retention spread over α∈[0.5,1.5]
const ALPHA_RECOVERY_SENSITIVITY = 0.25;  // recovery spread over α∈[0.5,1.5]
const BETA_FATIGUE_CENTER = 3.0;          // β=3 is the neutral difficulty
const BETA_FATIGUE_STEEPNESS = 1.5;       // tipping-point sharpness
const BETA_FATIGUE_FLOOR = 0.35;          // even trivial tasks cost some fatigue
const BETA_DISTRACT_CENTER = 3.2;         // distraction needs slightly harder tasks
const BETA_DISTRACT_STEEPNESS = 1.5;

// Biexponential recovery (fast sympathetic + slow parasympathetic)
const RECOVERY_TAU_FAST = 2.0;     // minutes — acute sympathetic recovery
const RECOVERY_TAU_SLOW = 120.0;   // minutes — deep parasympathetic recovery
const RECOVERY_WEIGHT_FAST = 0.40; // 40% fast component
const RECOVERY_WEIGHT_SLOW = 0.60; // 60% slow component

// Flow inertia
const FLOW_INERTIA_BUILD = 0.06;   // per-tick flow anchor strengthening
const FLOW_INERTIA_MAX = 1.60;     // max 60% stronger than baseline
const FLOW_COLLAPSE_THRESHOLD = 12; // ~2 hours — tipping point (ticks)
// v6: collapse must actually overpower the inertia at the tipping point.
// v5's 0.3 steepness × 0.7 weight left the net anchor at ~1.04 — invisible.
const FLOW_COLLAPSE_STEEPNESS = 0.6; // how sharp the collapse is
const FLOW_COLLAPSE_WEIGHT = 0.9;   // how much collapse risk eats the anchor

// Cognitive momentum
const MOMENTUM_AMPLIFY = 0.25;     // how much acceleration amplifies transitions

// Intervention sensitivity (v6: midpoint moved from 0.40→0.55 so a break at
// typical burnout fatigue (~0.5) stays ~55% effective instead of ~25% —
// v5 recommended 60-minute breaks for every mid-session burnout)
const INTERVENTION_MIDPOINT = 0.55; // fatigue level where break is 50% effective
const INTERVENTION_STEEPNESS = 8.0; // how sharply effectiveness drops

// Cognitive capacity
const CAPACITY_BASE = 180.0;       // base cognitive capacity (load units)

// Simulation size guard: the longest schedulable session is 8h = 48 ticks,
// and the backend validates 1..144 steps. Anything larger is an API misuse
// and would freeze the UI allocating millions of timeline points.
const MAX_STEPS = 144;

// Temporal cognitive drain (v4/v6) — prevents steady-state plateau.
// v6: drain is keyed to ABSOLUTE session time, not session fraction.
// A 60-minute task experiences almost no drain (real life: you're still
// fresh); a 2h+ block declines hard. This models accumulating mental
// exhaustion that homogeneous Markov chains cannot capture.
const DRAIN_MIDPOINT_TICKS = 12;   // ~2 hours — drain half-activated
const DRAIN_STEEPNESS = 0.5;       // per-tick slope of the drain sigmoid
const FLOW_EROSION_MAX = 0.35;     // max flow retention loss late in session
const FATIGUE_GRAVITY_MAX = 0.65;  // max fatigue transition amplification
const RECOVERY_RESISTANCE_MAX = 0.35; // max spontaneous recovery reduction

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
 * @returns {MarkovTimePoint[]}
 */
export function calculateMarkovTimeline(
  alpha = 1.0, beta = 3, gamma = 1.0, steps = 18, initialState = null, options = null
) {
  // Guard against invalid steps (negative, NaN, zero) — downstream code
  // accessing timeline[0] or timeline.length - 1 would crash on an empty
  // array. Also clamp the upper bound: the longest schedulable session is
  // 8h = 48 ticks, and an unclamped steps=1e7 would allocate millions of
  // points and freeze the UI (production bug, 2026-08-31).
  if (!Number.isFinite(steps) || steps < 1) {
    return [{ tick: 0, timeLabel: '0h00', flow: 1, distracted: 0, fatigue: 0, recovery: 0 }];
  }
  steps = Math.min(Math.floor(steps), MAX_STEPS);
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

  if (!burnoutTick || burnoutTick <= 0 || !Number.isFinite(burnoutTick)) {
    return { original, optimized: original };
  }

  // Clamp into the session: a burnoutTick beyond `steps` (or NaN) used to
  // build a timeline LONGER than the session itself (production bug,
  // 2026-08-31). The scheduler always passes a tick from findBurnoutTick,
  // but the exported API must be safe on its own.
  const safeBurnoutTick = Math.max(1, Math.min(Math.floor(burnoutTick), steps));
  const breakInsertTick = Math.max(0, safeBurnoutTick - 1);
  const v0 = validateInitialState(initialState);

  const preBreak = simulateTrajectory(alpha, beta, gamma, breakInsertTick, [...v0], opts);

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
 * Biexponential decay: R(t) = w_fast·e^(−t/τ_fast) + w_slow·e^(−t/τ_slow)
 * Returns fraction of fatigue remaining after t minutes of recovery.
 */
function biexponentialDecay(t) {
  return RECOVERY_WEIGHT_FAST * Math.exp(-t / RECOVERY_TAU_FAST)
       + RECOVERY_WEIGHT_SLOW * Math.exp(-t / RECOVERY_TAU_SLOW);
}

/**
 * Invert the biexponential decay: find t such that decay(t) = ratio.
 * Uses binary search (20 iterations) — more accurate than slow-only
 * approximation, especially for short breaks where fast component matters.
 */
function invertBiexponentialDecay(ratio) {
  // lo=0: allow convergence for ratio > 0.84 (sub-1-minute breaks).
  // At t=0, decay=1.0 which would prevent convergence with lo=1.
  let lo = 0, hi = 120;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (biexponentialDecay(mid) > ratio) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Compute optimal break duration using full biexponential recovery model.
 *
 * Inverts the actual recovery curve R(t) = w_fast·e^(−t/τ_fast) + w_slow·e^(−t/τ_slow)
 * rather than using only the slow component. This gives more accurate results
 * for short breaks (5-15 min) where the fast sympathetic component contributes
 * significantly.
 *
 * Then scaled by intervention sensitivity:
 *   effectiveness = 1 − σ(fatigue − 0.55, 8.0)
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
  // Guard against corrupted timeline entries (undefined/missing fatigue)
  if (typeof currentFatigue !== 'number' || !Number.isFinite(currentFatigue)) return 5;
  const currentFlow = state.flow;

  if (currentFatigue <= targetFatigue) return 5;

  const ratio = targetFatigue / currentFatigue;
  if (ratio <= 0 || ratio >= 1) return 15;

  // Invert the full biexponential decay (v5: was slow-only approximation)
  const rawMinutes = invertBiexponentialDecay(ratio);

  // Intervention sensitivity: breaks are less effective at higher fatigue
  const effectiveness = 1.0 - sigmoid(currentFatigue, INTERVENTION_MIDPOINT, INTERVENTION_STEEPNESS);
  const effectiveFactor = Math.max(0.25, effectiveness);

  // Recovery capacity depends on flow, but with a realistic floor — v5 let a
  // low-flow state divide the break length up by 3× (compounding the
  // sensitivity penalty) and recommend 60-min breaks for every burnout.
  const recoveryCapacity = Math.max(0.6, currentFlow * 0.8 + 0.2);

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
  // Guard against negative breakMinutes — would invert recovery (fatigue increases)
  if (breakMinutes < 0) breakMinutes = 5;
  const [flow, distracted, fatigue, recovery] = currentState;

  // Biexponential decay of fatigue
  const decayFast = Math.exp(-breakMinutes / RECOVERY_TAU_FAST);
  const decaySlow = Math.exp(-breakMinutes / RECOVERY_TAU_SLOW);
  const totalDecay = RECOVERY_WEIGHT_FAST * decayFast + RECOVERY_WEIGHT_SLOW * decaySlow;

  const newFatigue = fatigue * totalDecay;
  const fatigueReduced = fatigue - newFatigue;

  // Intervention sensitivity: how much of the fatigue reduction converts to flow
  const sensitivity = 1.0 - sigmoid(fatigue, INTERVENTION_MIDPOINT, INTERVENTION_STEEPNESS);

  // Conversion efficiency: more flow → better conversion, scaled by sensitivity.
  // v6: floors raised — v5 parked most recovered capacity in the "Recovery"
  // pool (up to 35% of the state 30 min after a task ended) instead of
  // converting it back into usable flow.
  const baseEfficiency = flow > 0.3 ? 0.85 : 0.6;
  const conversionEfficiency = baseEfficiency * Math.max(0.35, sensitivity);

  const toFlow = fatigueReduced * conversionEfficiency;
  const toRecovery = fatigueReduced * (1 - conversionEfficiency);

  let newFlow = flow + toFlow;
  let newDistracted = distracted * totalDecay;
  const distractedReduced = distracted - newDistracted;
  newFlow += distractedReduced * 0.7;
  const newRecovery = recovery + toRecovery + distractedReduced * 0.3;

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
function applyAttentionResidue(state, prevType, newType = null) {
  // Shifts flow → distracted based on task type switching cost.
  // Uses the type-pair-specific residue values from computeAttentionResidue.
  // Accepts newType to compute the correct residue for same-/cross-domain transitions.
  // When no newType specified, falls back to 'other' to maintain backward compat.
  const residue = prevType ? computeAttentionResidue(prevType, newType || 'other') : 0.12;
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
 * v4 additions:
 *   - Temporal cognitive drain: sigmoid curve that erodes flow retention,
 *     amplifies fatigue gravity, and weakens spontaneous recovery.
 *     Prevents homogeneous-chain plateau.
 *
 * v6 changes:
 *   - All sigmoidal modifiers are centered on the population neutral point
 *     (α=1.0, β=3, γ=1.0 → multiplier 1.0). v5 penalized the average user.
 *   - betaFatigueMult also scales Distracted→Fatigue (v5 only Flow→Fatigue),
 *     so task difficulty now actually separates easy from hard sessions.
 *   - gammaMod is clamped to [0.5, 2.0], NOT [0,1]: v5's clamp() capped the
 *     modifier at 1.0, which made every γ≥1.0 (i.e. all non-sports sessions
 *     at any time of day) behave identically — the circadian channel was dead.
 *   - Drain is keyed to absolute session ticks (midpoint ~2h), not session
 *     fraction — short tasks no longer drain unrealistically early.
 *
 * @param {number} alpha
 * @param {number} beta
 * @param {number} gamma
 * @param {number} tick             Current tick (absolute session time for drain)
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

  // -- Sigmoidal modifiers (v6: centered on neutral α=1.0) --------------------
  // Multipliers around 1.0:  α=1.0 → 1.0, α=1.5 → ~1.27, α=0.5 → ~0.73
  const alphaFlowMod = 1.0 + ALPHA_FLOW_SENSITIVITY * (sigmoid(a, 1.0, 4.0) - 0.5) * 2.0;
  const alphaRecoveryMod = 1.0 + ALPHA_RECOVERY_SENSITIVITY * (sigmoid(a, 1.0, 3.5) - 0.5) * 2.0;
  // Difficulty multipliers around 1.0:  β=3 → 1.0, β=5 → ~1.9, β=1 → floor 0.35
  // (v6: floored — v5 let β=1 sessions finish with ~0 fatigue, unrealistic)
  const betaFatigueMult = Math.max(
    BETA_FATIGUE_FLOOR,
    2.0 * sigmoid(b, BETA_FATIGUE_CENTER, BETA_FATIGUE_STEEPNESS)
  );
  const betaDistractMult = 2.0 * sigmoid(b, BETA_DISTRACT_CENTER, BETA_DISTRACT_STEEPNESS);
  // Escaping fatigue during an easy task is fast; during a hard task, slow
  const fatigueEscapeMult = 1.0 / (0.6 + 0.4 * betaFatigueMult);

  // State-dependent gamma (v6: clamp to a safe band around 1.0, NOT [0,1] —
  // clamp() would pin every γ≥1 to exactly 1.0 and kill the circadian effect)
  const gammaStateBoost = 1.0 + currentFatigue * 0.6;
  const effectiveGamma = 1.0 + (g - 1.0) * gammaStateBoost;
  const gammaMod = Math.max(0.5, Math.min(2.0, effectiveGamma));

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
  // Collapse risk: sigmoid that activates after ~2 hours.
  // v6: FLOW_COLLAPSE_WEIGHT raised so the tipping point actually bites —
  // v5's net anchor (inertia × (1 − 0.7·risk)) stayed ≈ 1.04, invisible.
  const collapseRisk = flowStreak > FLOW_COLLAPSE_THRESHOLD
    ? sigmoid(flowStreak - FLOW_COLLAPSE_THRESHOLD, 3, FLOW_COLLAPSE_STEEPNESS)
    : 0;
  // Net flow modifier: inertia helps, collapse hurts
  const flowAnchorMod = warmupFactor * (flowInertia * (1 - collapseRisk * FLOW_COLLAPSE_WEIGHT));

  // -- Cognitive momentum (v3) ------------------------------------------------
  // If fatigue is accelerating (current > previous), amplify off-diagonal transitions
  const fatigueDelta = prevFatigue !== null
    ? Math.max(0, currentFatigue - prevFatigue)
    : 0;
  const momentumAmplify = Math.min(2.0,
    1.0 + fatigueDelta * MOMENTUM_AMPLIFY * (1 / 0.05)
  );
  // Normalized: at Δfatigue=0.05 (5% per tick), amplify by 25%
  // Capped at 2.0 to prevent extreme values from runaway feedback

  // -- Capacity ceiling (v3) --------------------------------------------------
  // Beyond capacity, all fatigue transitions are amplified
  const capacity = computeCognitiveCapacity(a);
  const capacityFactor = cumulativeLoad > capacity
    ? 1.0 + (cumulativeLoad - capacity) / capacity
    : 1.0;
  // At 150% capacity: 50% amplification of fatigue transitions

  // -- Temporal cognitive drain (v4/v6) ---------------------------------------
  // Accumulating mental exhaustion as the session wears on. A sigmoid drain
  // curve keyed to ABSOLUTE session time: barely noticeable in the first hour,
  // dominant past 2 hours. This prevents the unrealistic steady-state
  // plateau of homogeneous chains. (v5 keyed drain to session FRACTION, so a
  // 60-minute task got half its drain by minute 30 — unrealistically early.)
  const drain = sigmoid(tick, DRAIN_MIDPOINT_TICKS, DRAIN_STEEPNESS);

  // Flow erosion: harder to maintain flow as mental energy depletes
  const flowErosionFactor = 1 - drain * FLOW_EROSION_MAX;

  // Fatigue gravity: stronger pull toward fatigue as session wears on
  const fatigueGravityFactor = 1 + drain * FATIGUE_GRAVITY_MAX;

  // Recovery resistance: spontaneous recovery becomes harder late in session
  const recoveryResistanceFactor = 1 - drain * RECOVERY_RESISTANCE_MAX;

  // -- Build matrix -----------------------------------------------------------
  const P = P_BASE.map((row) => [...row]);

  // Row 0 — Flow: retention weakened by drain and bad timing, exits to both
  // distracted + fatigue amplified. v6: γ also acts on retention (2 − γMod):
  // alertness affects attention stability, not only fatigue accumulation.
  P[0][0] *= alphaFlowMod * flowAnchorMod * flowErosionFactor * (2 - gammaMod);
  P[0][1] *= betaDistractMult * momentumAmplify * (1 + drain * 0.25);
  P[0][2] *= betaFatigueMult * gammaMod * momentumAmplify * capacityFactor * fatigueGravityFactor;

  // Row 1 — Distracted: return-to-flow harder, fall-to-fatigue easier.
  // v6: difficulty now also drives distraction→fatigue (v5 left β out of this
  // row, so a β=1 and β=5 session looked nearly identical).
  P[1][0] *= alphaFlowMod * flowErosionFactor * (2 - gammaMod);
  P[1][1] *= (2 - alphaFlowMod) * (1 + drain * 0.15);
  P[1][2] *= betaFatigueMult * gammaMod * momentumAmplify * capacityFactor * fatigueGravityFactor;

  // Row 2 — Fatigued: harder to escape fatigue spontaneously; easy tasks
  // accelerate the climb-out (fatigueEscapeMult), hard tasks slow it.
  P[2][0] *= (0.3 + alphaFlowMod * 0.2) * flowErosionFactor * fatigueEscapeMult;
  P[2][1] *= gammaMod;
  P[2][2] *= (1 + (betaFatigueMult - 1) * 0.3) * gammaMod * capacityFactor * fatigueGravityFactor;
  P[2][3] *= alphaRecoveryMod * recoveryResistanceFactor;

  // Row 3 — Recovery: harder to bounce back to flow, easier to slip to fatigue
  P[3][0] *= alphaRecoveryMod * recoveryResistanceFactor;
  P[3][1] *= (1.5 - alphaFlowMod * 0.5);
  P[3][2] *= gammaMod * fatigueGravityFactor;  // micro-regression into fatigue
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

    // Don't compute the final transition — it would produce a state for
    // step+1 that is never recorded in the timeline (wasted computation)
    if (t >= steps) break;

    const currentFatigue = v[2];

    // Track flow streak (for flow inertia)
    if (v[0] > 0.3) {
      flowStreak++;
    } else {
      flowStreak = Math.max(0, flowStreak - 2); // decay streak when not in flow
    }

    // Build matrix with all v6 parameters including temporal drain
    // (drain is keyed to absolute tick inside buildDynamicMatrix)
    const P = buildDynamicMatrix(
      alpha, beta, gamma, t, currentFatigue, prevFatigue, flowStreak,
      cumulativeLoad + t * (beta / 5) * gamma
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

function simulateTrajectoryFrom(alpha, beta, gamma, v0, steps, startTick, opts = {}) {
  const timeline = [];
  let v = [...v0];
  let prevFatigue = null;
  let flowStreak = 0;
  const cumulativeLoad = opts.cumulativeLoad || 0;

  // Post-break drain reset — a break partially restores cognitive resources.
  // The temporal drain is reduced proportional to fatigue recovery.
  // At post-break fatigue 0.25: 50% drain reset. At fatigue 0.50: 0% reset.
  const postBreakFatigue = v0[2];
  const drainRetention = Math.min(1.0, postBreakFatigue / 0.50);
  // This gives the effective tick offset for drain calculation:
  // drainTick = startTick * drainRetention + t (instead of startTick + t)
  // A 50% drain reset means the drain at the break point is halved.

  for (let t = 0; t <= steps; t++) {
    timeline.push(makeTick(startTick + t, v));

    // Don't compute the final transition — it would produce a state for
    // step+1 that is never recorded in the timeline (wasted computation)
    if (t >= steps) break;

    const currentFatigue = v[2];
    if (v[0] > 0.3) { flowStreak++; }
    else { flowStreak = Math.max(0, flowStreak - 2); }

    // Drain-effective tick: reduced by drainRetention after a break
    const drainTick = startTick * drainRetention + t;
    const P = buildDynamicMatrix(
      alpha, beta, gamma, drainTick, currentFatigue, prevFatigue, flowStreak,
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
  // Guard against NaN input — NaN comparisons always return false,
  // bypassing overflow guards and producing NaN through the sigmoid
  if (Number.isNaN(x) || Number.isNaN(center) || Number.isNaN(steepness)) return 0.5;
  // Guard against overflow: exp(>709) = Infinity in IEEE 754
  const z = -steepness * (x - center);
  if (z > 700) return 1.0;  // effectively 1/(1+0) = 1
  if (z < -700) return 0.0; // effectively 1/(1+∞) = 0
  return 1 / (1 + Math.exp(z));
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

/**
 * Clamp and re-normalize a state vector to sum-to-1.0.
 * Unlike clamp() which can break sum-to-1 when values are clamped to 0,
 * this redistributes probability mass to maintain the invariant.
 */
export function clampAndNormalize(vec) {
  const clamped = vec.map(v => clamp(v));
  const sum = clamped.reduce((a, b) => a + b, 0);
  if (sum > 0 && Number.isFinite(sum)) {
    return clamped.map(v => v / sum);
  }
  return [0.25, 0.25, 0.25, 0.25];
}

// -- Exports -----------------------------------------------------------------

export {
  sigmoid,
  RECOVERY_TAU_MINUTES,
  RECOVERY_TAU_FAST,
  RECOVERY_TAU_SLOW,
  WARMUP_TICKS,
};
