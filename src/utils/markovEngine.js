/**
 * MindFlow Markov Chain Engine
 *
 * Discrete-Time Markov Chain (DTMC) simulation of cognitive state transitions
 * during a study session.  All math runs client-side — no backend required.
 *
 * States:  0=Flow  1=Distracted  2=Fatigue  3=Recovery
 * Time step Δt = 10 minutes, defaults to 18 steps (3 hours).
 */

// -- Base transition matrix --------------------------------------------------

const P_BASE = [
  [0.80, 0.15, 0.05, 0.00], // From Flow
  [0.20, 0.60, 0.20, 0.00], // From Distracted
  [0.05, 0.15, 0.80, 0.00], // From Fatigued
  [0.70, 0.10, 0.00, 0.20], // From Recovery
];

// -- Public API --------------------------------------------------------------

/**
 * Run a full Markov-chain simulation for a study session.
 *
 * @param {number} alpha  - Cognitive baseline score (0.5–1.5).  Higher →
 *                          stronger grip on Flow, faster recovery.
 * @param {number} beta   - Task difficulty rating (1–5).  Higher → more
 *                          drift toward Distracted / Fatigue.
 * @param {number} gamma  - Circadian coefficient (0.8–1.3).  > 1.0 at
 *                          night increases fatigue transitions.
 * @param {number} steps  - Number of 10-min ticks (default 18 = 3 hours).
 * @returns {MarkovTimePoint[]}  Probability vector at each tick.
 */
export function calculateMarkovTimeline(alpha = 1.0, beta = 3, gamma = 1.0, steps = 18) {
  const P = buildDynamicMatrix(alpha, beta, gamma);
  const timeline = simulateTrajectory(P, steps);

  return timeline;
}

/**
 * Return the first tick index where P(Fatigue) exceeds the threshold.
 * Returns -1 if the threshold is never crossed.
 *
 * @param {MarkovTimePoint[]} timeline
 * @param {number} threshold - Default 0.50
 * @returns {number}
 */
export function findBurnoutTick(timeline, threshold = 0.50) {
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].fatigue > threshold) return i;
  }
  return -1;
}

/**
 * Run a second simulation that inserts a 15-minute Recovery break before
 * burnout and continues from the refreshed state vector.
 *
 * @param {number} alpha
 * @param {number} beta
 * @param {number} gamma
 * @param {number} steps        - Total 10-min ticks (default 18).
 * @param {number} burnoutTick  - Tick where fatigue crosses threshold.
 * @returns {{ original: MarkovTimePoint[], optimized: MarkovTimePoint[] }}
 */
export function optimizeWithBreak(alpha, beta, gamma, steps = 18, burnoutTick) {
  // Original timeline (no break)
  const original = calculateMarkovTimeline(alpha, beta, gamma, steps);

  // Guard: can't insert a meaningful break if burnout is immediate, absent,
  // or undefined (caller passed no burnout tick).
  if (!burnoutTick || burnoutTick <= 0) {
    return { original, optimized: original };
  }

  // Insert break 1 tick (10 min) before burnout
  const breakInsertTick = Math.max(0, burnoutTick - 1);

  // Simulate up to the break point using the SAME dynamic matrix
  const P = buildDynamicMatrix(alpha, beta, gamma);
  const preBreak = simulateTrajectoryN(P, breakInsertTick);

  // Post-break reset vector  (heavily weighted toward Flow)
  const postBreakV = [0.85, 0.10, 0.05, 0.00];
  const remainingSteps = steps - breakInsertTick - 1; // -1 for the break tick itself

  if (remainingSteps <= 0) {
    // Break eats the rest of the session — pad with the reset state
    const recoveryTick = makeTick(breakInsertTick + 1, postBreakV);
    return { original, optimized: [...preBreak, recoveryTick] };
  }

  // Continue simulation from post-break state.
  // postBreak[0] IS the break tick (at breakInsertTick + 1 with postBreakV),
  // so we spread it directly — no separate breakTick needed (avoids duplicate).
  const postBreak = simulateTrajectoryFrom(P, postBreakV, remainingSteps, breakInsertTick + 1);
  const optimized = [...preBreak, ...postBreak];

  return { original, optimized };
}

// -- Internal helpers --------------------------------------------------------

/**
 * Build the 4×4 dynamic transition matrix by applying alpha / beta / gamma
 * modifiers to the base matrix, then normalising every row to sum = 1.
 */
function buildDynamicMatrix(alpha, beta, gamma) {
  // Clamp inputs to safe ranges (defense in depth)
  const a = Number.isFinite(alpha) ? Math.max(0.3, Math.min(3.0, alpha)) : 1.0;
  const b = Number.isFinite(beta) ? Math.max(1, Math.min(5, beta)) : 3;
  const g = Number.isFinite(gamma) ? Math.max(0.5, Math.min(2.0, gamma)) : 1.0;

  // Map raw difficulty (1–5) → beta factor (0.8–1.2)
  const betaFactor = 0.7 + b * 0.1;

  // Deep-copy base matrix
  const P = P_BASE.map((row) => [...row]);

  // Row 0 — Flow
  P[0][0] *= a;                        // stay in Flow
  P[0][1] *= betaFactor;               // → Distracted
  P[0][2] *= betaFactor * g;           // → Fatigue

  // Row 1 — Distracted
  P[1][0] *= a;                        // → Flow  (recovery pull)
  P[1][2] *= g;                        // → Fatigue

  // Row 2 — Fatigued
  // NOTE: P[2][3] *= a is intentionally a no-op (base = 0.00).
  // Natural recovery from fatigue is impossible — only an external
  // break intervention can reset the state vector.
  P[2][3] *= a;                        // → Recovery  (deliberate rest)
  P[2][1] *= g;                        // → Distracted

  // Row 3 — Recovery
  P[3][0] *= a;                        // → Flow  (return to focus)

  // Normalise every row so sum(row) === 1.0
  for (let i = 0; i < 4; i++) {
    const sum = P[i].reduce((a, b) => a + b, 0);
    if (sum <= 0 || !Number.isFinite(sum)) {
      // Degenerate row — fall back to uniform distribution
      P[i] = [0.25, 0.25, 0.25, 0.25];
    } else if (Math.abs(sum - 1.0) > 1e-12) {
      for (let j = 0; j < 4; j++) P[i][j] /= sum;
    }
  }

  return P;
}

/** Simulate full trajectory from initial state [1, 0, 0, 0]. */
function simulateTrajectory(P, steps) {
  return simulateTrajectoryFrom(P, [1.0, 0.0, 0.0, 0.0], steps, 0);
}

/** Simulate N steps and return the trajectory (N+1 points including t=0).
 *  Alias of simulateTrajectory for semantic clarity in break-insertion code. */
function simulateTrajectoryN(P, steps) {
  return simulateTrajectoryFrom(P, [1.0, 0.0, 0.0, 0.0], steps, 0);
}

/** Core iterator: evolve state vector v through P for `steps` ticks. */
function simulateTrajectoryFrom(P, v0, steps, startTick) {
  const timeline = [];
  let v = [...v0];

  for (let t = 0; t <= steps; t++) {
    timeline.push(makeTick(startTick + t, v));

    // v(t+1) = v(t) · P   (row-vector × matrix)
    const next = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        next[j] += v[i] * P[i][j];
      }
    }
    // Renormalise to prevent floating-point drift over many steps
    const s = next.reduce((a, b) => a + b, 0);
    if (s > 0 && Number.isFinite(s)) {
      v = next.map(x => x / s);
    } else {
      // Degenerate state — fall back to uniform distribution
      v = [0.25, 0.25, 0.25, 0.25];
    }
  }

  return timeline;
}

/** Build a single MarkovTimePoint. */
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

/** Clamp tiny floating-point drift so probabilities stay in [0, 1]. */
function clamp(x) {
  // Guard against NaN and non-finite values
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  // Snap near-zero values to zero for cleaner display
  if (x < 1e-10) return 0;
  return x;
}
