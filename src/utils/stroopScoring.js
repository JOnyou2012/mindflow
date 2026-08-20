/**
 * Stroop calibration scoring — pure, deterministic, unit-testable.
 *
 * ## Scoring v2 (2026-08-20) — why v1 was rebuilt
 *
 * The v1 formula triple-counted slowness: one slow answer hurt the mean
 * (speed), the standard deviation (consistency), AND the lapse penalty,
 * while interference divided by 12 dominated everything. A careful user
 * with ~95% accuracy and a few slow responses scored at the 0.5 floor,
 * while fast random keypresses scored ~0.9. (User-reported: "only a few
 * wrong and a few slow, but my focus score was 0.5".)
 *
 * v2 principles:
 *  - **Accuracy is the primary signal** (50 of 85 points) — near-perfect
 *    accuracy can never land near the floor.
 *  - **Speed and consistency are measured on CORRECT trials only** — a
 *    slow wrong answer already hurts via accuracy; it must not be
 *    triple-penalized.
 *  - **Median RT, not mean** — a few slow outliers don't tank speed.
 *  - **Speed credit is gated by accuracy** — at near-chance accuracy
 *    (~30% on 4 choices) fast keypresses earn nothing, so random tapping
 *    can't score as "average capacity".
 *  - **Mild, capped penalties** — lapses cost ≤6 points; interference
 *    below the healthy-Stroop tolerance (~80 ms) is free, and beyond it
 *    costs ≤5 points.
 *
 * ## Output mapping
 *
 * Composite total spans 0–85 and maps linearly to the scheduler's
 * cognitive-calibration input (0.5–1.5): total 0 → 0.5, 42.5 → 1.0
 * (population average), 85 → 1.5. Both ends are now reachable — v1's
 * /55 divisor made 1.5 mathematically impossible (max total was 80).
 *
 * @module stroopScoring
 */

const LAPSE_MS = 1500;
const INTERFERENCE_TOLERANCE_MS = 80;
const MAX_TOTAL = 85;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** Median of sorted array (robust to outliers with small samples). */
function median(sortedArr) {
  if (sortedArr.length === 0) return 0;
  const sorted = [...sortedArr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const EMPTY_RESULT = {
  accuracy: 0,
  avgResponseTimeMs: 0,
  rtVariabilityMs: 0,
  lapses: 0,
  interferenceMs: 0,
  alphaScore: 0.5,
  trialCount: 0,
  accuracyScore: 0,
  speedScore: 0,
  consistencyScore: 0,
  lapsePenalty: 0,
  interferencePenalty: 0,
};

/**
 * Score a finished Stroop run.
 *
 * @param {Array<{rt: number, correct: boolean, trialType?: 'congruent'|'incongruent'}>} trials
 * @returns {object} Summary incl. the 0.5–1.5 `alphaScore` and per-component breakdown.
 */
export function scoreStroopTrials(trials) {
  const safe = Array.isArray(trials)
    ? trials.filter(t => t && typeof t === 'object' && Number.isFinite(t.rt))
    : [];
  if (safe.length === 0) return { ...EMPTY_RESULT };

  const correct = safe.filter(t => t.correct === true);
  const accuracy = correct.length / safe.length;

  // Speed & consistency over correct responses only.
  const rts = correct.map(t => t.rt);
  const medRT = median(rts);
  const meanRT = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
  const variance = rts.length
    ? rts.reduce((s, rt) => s + (rt - meanRT) ** 2, 0) / rts.length
    : 0;
  const rtSD = Math.sqrt(variance);

  const lapses = safe.filter(t => t.rt > LAPSE_MS).length;

  // Stroop interference: median incongruent − median congruent (correct
  // responses only). Fewer than 3 congruent answers → don't penalize.
  const congruentRTs = correct.filter(t => t.trialType === 'congruent').map(t => t.rt);
  const incongruentRTs = correct.filter(t => t.trialType === 'incongruent').map(t => t.rt);
  const congruentRT = congruentRTs.length >= 3 ? median(congruentRTs) : medRT;
  const incongruentRT = incongruentRTs.length > 0 ? median(incongruentRTs) : meanRT;
  const interferenceMs = congruentRTs.length >= 3
    ? Math.max(0, incongruentRT - congruentRT)
    : 0;

  // Composite (0–85)
  const accuracyScore = accuracy * 50;                                  // 0–50
  const hasCorrect = rts.length > 0;
  // No correct answers → no speed/consistency credit at all (the empty
  // median sentinel of 0 ms must not read as "instant responses").
  const speedScore = hasCorrect ? 20 * clamp01((1100 - medRT) / 700) : 0;       // ≤400ms→20, ≥1100ms→0
  const consistencyScore = hasCorrect ? 15 * clamp01((400 - rtSD) / 340) : 0;   // ≤60ms→15, ≥400ms→0
  const accGate = clamp01((accuracy - 0.30) / 0.60);                    // near-chance accuracy → no speed credit
  const lapsePenalty = Math.min(6, lapses * 2);
  const interferencePenalty = Math.min(
    5,
    Math.max(0, (interferenceMs - INTERFERENCE_TOLERANCE_MS) / 30)
  );

  const total = accuracyScore
    + accGate * (speedScore + consistencyScore)
    - lapsePenalty
    - interferencePenalty;

  const alphaScore = Math.min(
    1.5,
    Math.max(0.5, Math.round((0.5 + total / MAX_TOTAL) * 100) / 100)
  );

  return {
    accuracy,
    avgResponseTimeMs: Math.round(meanRT),
    rtVariabilityMs: Math.round(rtSD),
    lapses,
    interferenceMs: Math.round(interferenceMs),
    alphaScore,
    trialCount: safe.length,
    accuracyScore: Math.round(accuracyScore * 10) / 10,
    speedScore: Math.round(speedScore * 10) / 10,
    consistencyScore: Math.round(consistencyScore * 10) / 10,
    lapsePenalty: Math.round(lapsePenalty * 10) / 10,
    interferencePenalty: Math.round(interferencePenalty * 10) / 10,
  };
}
