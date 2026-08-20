/**
 * Stroop scoring test suite (scoring v2, 2026-08-20).
 * Guards the redesigned composite in src/utils/stroopScoring.js.
 * Run: node tests/stroop-scoring.test.js
 *
 * The headline regression: v1 scored a careful user (~95% accuracy,
 * median ~750 ms, a few slow responses) at the 0.5 floor while fast
 * random keypresses scored ~0.9. v2 fixes that inversion.
 */

import { scoreStroopTrials } from '../src/utils/stroopScoring.js';

let passed = 0, failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push(label); console.error(`  ❌ ${label}`); }
}

// Deterministic PRNG (mulberry32 — same pattern as the extreme suite)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const I = 'incongruent', C = 'congruent';

// ===========================================================================
// 1. THE USER'S SCENARIO — few wrong, few slow (the v1 failure case)
// ===========================================================================

function userScenarioRun() {
  const rnd = mulberry32(42);
  const trials = [];
  // 84 trials, ~95% accuracy (80 correct / 4 wrong)
  for (let i = 0; i < 84; i++) {
    const isWrong = i % 21 === 20;               // 4 wrong trials
    // Median ~750 ms, SD ~180 — plus 3 slow correct responses (>1500 ms)
    const rt = isWrong
      ? 950 + Math.round(rnd() * 300)            // slow-ish wrong answers
      : (i % 28 === 7
        ? 1600 + Math.round(rnd() * 400)         // 3 lapses among correct
        : 650 + Math.round(rnd() * 200));        // normal correct band
    // ~75% incongruent; congruent slightly faster → ~100 ms interference
    const trialType = (rnd() < 0.75 ? I : C);
    const extra = trialType === I ? 100 : 0;
    trials.push({ rt: rt + (isWrong ? 0 : extra), correct: !isWrong, trialType });
  }
  return trials;
}

console.log('📋 1. User scenario (few wrong, few slow) — the v1 floor bug');
{
  const r = scoreStroopTrials(userScenarioRun());
  console.log('   accuracy', (r.accuracy * 100).toFixed(1) + '%',
    '| avgRT', r.avgResponseTimeMs + 'ms', '| SD', r.rtVariabilityMs + 'ms',
    '| lapses', r.lapses, '| interference', r.interferenceMs + 'ms',
    '→ alpha', r.alphaScore);
  assert(r.accuracy > 0.94 && r.accuracy < 0.96, 'S1: ~95% accuracy fixture correct');
  assert(r.lapses === 3, 'S2: fixture has 3 lapses');
  assert(r.alphaScore >= 1.0, `S3: careful accurate user scores ≥ 1.0 (v1 gave ~0.5; got ${r.alphaScore})`);
  assert(r.alphaScore <= 1.35, 'S4: but not unrealistically high');
  assert(r.accuracyScore > 45, 'S5: accuracy component near max (47.6/50)');
}

// ===========================================================================
// 2. Fast random keypresses must NOT outscore the careful user (the v1 inversion)
// ===========================================================================

console.log('📋 2. Fast random keypresses — must score well below the careful user');
{
  const rnd = mulberry32(7);
  const trials = [];
  for (let i = 0; i < 84; i++) {
    const correct = rnd() < 0.30;                // ~chance on 4 choices
    trials.push({ rt: 450 + Math.round(rnd() * 200), correct, trialType: rnd() < 0.75 ? I : C });
  }
  const r = scoreStroopTrials(trials);
  console.log('   accuracy', (r.accuracy * 100).toFixed(1) + '%',
    '| medianRT ~500ms | SD', r.rtVariabilityMs + 'ms',
    '→ alpha', r.alphaScore);
  assert(r.alphaScore < 0.9, `T1: random tapping scores < 0.9 (v1 gave ~0.9+; got ${r.alphaScore})`);
  assert(r.alphaScore < 0.8, `T2: accuracy gate holds — fast guessing is not average capacity (got ${r.alphaScore})`);
  const careful = scoreStroopTrials(userScenarioRun());
  assert(r.alphaScore < careful.alphaScore, 'T3: careful user outscores random tapping');
}

// ===========================================================================
// 3. Scale reachability + floor
// ===========================================================================

console.log('📋 3. Scale: 1.5 reachable, 0.5 floor, average ≈ 1.0');
{
  const perfect = Array.from({ length: 60 }, (_, i) => ({ rt: 350, correct: true, trialType: i % 2 ? C : I }));
  const rP = scoreStroopTrials(perfect);
  assert(rP.alphaScore === 1.5, `P1: perfect fast run reaches 1.5 (got ${rP.alphaScore})`);

  const allWrongSlow = Array.from({ length: 20 }, () => ({ rt: 2500, correct: false, trialType: I }));
  const rW = scoreStroopTrials(allWrongSlow);
  assert(rW.alphaScore === 0.5, `P2: all-wrong slow run sits at the 0.5 floor (got ${rW.alphaScore})`);
  assert(rW.speedScore === 0 && rW.consistencyScore === 0, 'P3: gate zeroes speed credit at 0% accuracy');

  const avg = Array.from({ length: 70 }, (_, i) => ({
    rt: 700 + Math.round(120 * Math.sin(i * 1.7)), correct: i % 4 !== 3, trialType: i % 3 ? I : C,
  }));
  const rA = scoreStroopTrials(avg);
  assert(rA.alphaScore >= 0.85 && rA.alphaScore <= 1.25, `P4: typical mixed run (75% acc, ~700ms, SD ~90) lands near 1.0 (got ${rA.alphaScore})`);
}

// ===========================================================================
// 4. Correct-only speed measurement (no triple-counting)
// ===========================================================================

console.log('📋 4. Slow WRONG answers must not drag speed/consistency');
{
  const trials = [
    ...Array.from({ length: 20 }, () => ({ rt: 500, correct: true, trialType: I })),
    { rt: 5000, correct: false, trialType: I },
    { rt: 6000, correct: false, trialType: I },
  ];
  const r = scoreStroopTrials(trials);
  assert(r.avgResponseTimeMs === 500, `C1: avg RT ignores slow wrong answers (got ${r.avgResponseTimeMs})`);
  assert(r.rtVariabilityMs === 0, 'C2: SD ignores slow wrong answers');
  assert(r.speedScore === 17.1, `C3: speed score reflects 500ms correct answers only (got ${r.speedScore})`);
  assert(r.lapses === 2, 'C4: lapses still counted');
  assert(r.lapsePenalty <= 4, `C5: lapse penalty mild (got ${r.lapsePenalty})`);
}

// ===========================================================================
// 5. Median robustness — one huge correct outlier
// ===========================================================================

console.log('📋 5. Median robustness — a single 5s correct outlier');
{
  const trials = [
    ...Array.from({ length: 19 }, () => ({ rt: 600, correct: true, trialType: I })),
    { rt: 5000, correct: true, trialType: I },
  ];
  const r = scoreStroopTrials(trials);
  assert(r.avgResponseTimeMs > 800, 'M1: mean IS dragged (honest display)');
  const baseline = scoreStroopTrials(Array.from({ length: 20 }, () => ({ rt: 600, correct: true, trialType: I })));
  assert(r.speedScore === baseline.speedScore, `M2: median-based speed score identical with/without the outlier (got ${r.speedScore} vs ${baseline.speedScore})`);
}

// ===========================================================================
// 6. Interference tolerance + caps
// ===========================================================================

console.log('📋 6. Interference tolerance band + lapse cap');
{
  const mk = (cong, incong) => [
    ...Array.from({ length: 12 }, () => ({ rt: cong, correct: true, trialType: C })),
    ...Array.from({ length: 30 }, () => ({ rt: incong, correct: true, trialType: I })),
  ];
  const rFree = scoreStroopTrials(mk(600, 660));          // 60 ms — normal Stroop
  assert(rFree.interferenceMs === 60, 'I1: 60 ms measured');
  assert(rFree.interferencePenalty === 0, 'I2: 60 ms within tolerance → free');

  const rBig = scoreStroopTrials(mk(600, 800));            // 200 ms
  assert(rBig.interferencePenalty === 4, `I3: 200 ms → (200-80)/30 = 4 (got ${rBig.interferencePenalty})`);

  const rHuge = scoreStroopTrials(mk(600, 1200));          // 600 ms
  assert(rHuge.interferencePenalty === 5, `I4: capped at 5 (got ${rHuge.interferencePenalty})`);

  const fewCongruent = [
    { rt: 700, correct: true, trialType: C },
    { rt: 1100, correct: true, trialType: I },
    { rt: 1150, correct: true, trialType: I },
  ];
  const rFew = scoreStroopTrials(fewCongruent);
  assert(rFew.interferenceMs === 0 && rFew.interferencePenalty === 0, 'I5: <3 congruent → no interference penalty');

  const manyLapses = Array.from({ length: 20 }, () => ({ rt: 2000, correct: true, trialType: I }));
  const rL = scoreStroopTrials(manyLapses);
  assert(rL.lapses === 20 && rL.lapsePenalty === 6, `I6: 20 lapses → penalty capped at 6 (got ${rL.lapsePenalty})`);
}

// ===========================================================================
// 7. Empty / malformed input
// ===========================================================================

console.log('📋 7. Empty + malformed input');
{
  for (const bad of [null, undefined, [], 'nope', [null, { rt: 'x' }, { correct: true }]]) {
    const r = scoreStroopTrials(bad);
    assert(r.trialCount === 0 && r.alphaScore === 0.5 && r.accuracy === 0, 'E1: malformed input → empty result');
  }
}

// ===========================================================================
// 8. Determinism + invariants
// ===========================================================================

console.log('📋 8. Determinism + invariants');
{
  const run = userScenarioRun();
  const a = scoreStroopTrials(run);
  const b = scoreStroopTrials(run);
  assert(JSON.stringify(a) === JSON.stringify(b), 'D1: byte-identical for identical input');
  assert(a.alphaScore >= 0.5 && a.alphaScore <= 1.5, 'D2: alpha within 0.5–1.5');
  for (const k of ['accuracyScore', 'speedScore', 'consistencyScore', 'lapsePenalty', 'interferencePenalty']) {
    assert(Number.isFinite(a[k]) && a[k] >= 0, `D3: ${k} finite and non-negative`);
  }
  assert(Math.round(a.alphaScore * 100) / 100 === a.alphaScore, 'D4: alpha has 2-decimal precision');
}

// ===========================================================================
// Done
// ===========================================================================

console.log(`\n${'─'.repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed  (${passed + failed} total)`);
if (failed > 0) {
  console.log(`\n  Failures:`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('  ✅ All stroop-scoring tests passed!\n');
}
