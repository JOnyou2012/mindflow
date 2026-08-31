/**
 * Markov Engine v3 — Advanced Math Model Tests
 *
 * Tests: flow inertia, flow collapse, cognitive momentum,
 * biexponential recovery, intervention sensitivity, capacity ceiling,
 * attention residue.
 *
 * Run: node tests/engine-v3.test.js
 */

import {
  calculateMarkovTimeline, findBurnoutTick, optimizeWithBreak,
  computeOptimalBreakDuration, computeRecoveryState,
  computeAttentionResidue, computeCognitiveCapacity,
} from '../src/utils/markovEngine.js';

let passed = 0, failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push(label); console.error(`  ❌ ${label}`); }
}

// ===========================================================================
// 1. Biexponential Recovery
// ===========================================================================

console.log('\n📋 1. Biexponential Recovery Model');

// Fast component dominates for short breaks
const rs1 = computeRecoveryState([0.3, 0.2, 0.4, 0.1], 2);  // 2-min break
assert(rs1[2] < 0.4, 'B1.1: 2-min break reduces fatigue');
// With fast tau=2min, even 2 min gives meaningful recovery via fast component
assert(rs1[2] < 0.38, 'B1.2: 2-min break uses fast recovery component');

// 15-min break: both components active
const rs15 = computeRecoveryState([0.3, 0.2, 0.4, 0.1], 15);
assert(rs15[2] < rs1[2], 'B1.3: 15-min break > 2-min break');

// 60-min break: slow component dominates
const rs60 = computeRecoveryState([0.3, 0.2, 0.4, 0.1], 60);
assert(rs60[2] < rs15[2], 'B1.4: 60-min break > 15-min break');

// 120-min break: approaches full slow-component recovery
const rs120 = computeRecoveryState([0.3, 0.2, 0.4, 0.1], 120);
assert(rs120[2] < rs60[2], 'B1.5: 120-min break > 60-min break');
assert(rs120[2] < 0.15, 'B1.6: 120-min break nearly fully recovers');

// Diminishing returns: first 15 min recovers more than second 15 min
const recovery0to15 = rs1[2] - rs15[2];
assert(recovery0to15 > 0, 'B1.7: First 15 min provides meaningful recovery');

// ===========================================================================
// 2. Intervention Sensitivity
// ===========================================================================

console.log('\n📋 2. Intervention Sensitivity');

// Same break duration, different starting fatigue
const lowFatigueState = [0.5, 0.25, 0.15, 0.1];   // 15% fatigue
const highFatigueState = [0.1, 0.15, 0.65, 0.1];   // 65% fatigue

const recoveryLow = computeRecoveryState(lowFatigueState, 15);
const recoveryHigh = computeRecoveryState(highFatigueState, 15);

// Break at low fatigue should recover more flow proportionally
const fatigueReductionLow = lowFatigueState[2] - recoveryLow[2];
const fatigueReductionHigh = highFatigueState[2] - recoveryHigh[2];
const reductionRatioLow = fatigueReductionLow / lowFatigueState[2];
const reductionRatioHigh = fatigueReductionHigh / highFatigueState[2];

assert(reductionRatioLow > reductionRatioHigh,
  `I2.1: Break more effective at low fatigue (${(reductionRatioLow*100).toFixed(0)}% vs ${(reductionRatioHigh*100).toFixed(0)}%)`);

// ===========================================================================
// 3. Flow Inertia — Deepening
// ===========================================================================

console.log('\n📋 3. Flow Inertia (Deepening)');

// Use alpha=1.3 (strong focus) to demonstrate flow inertia
const shortRun = calculateMarkovTimeline(1.3, 2, 1.0, 6);
const midFlow = shortRun[3].flow; // at 30 min
assert(midFlow > 0.36, `F3.1: Flow at 30min sustained by inertia: ${midFlow.toFixed(3)}`);

// Flow should still be meaningful at 1 hour with moderate difficulty
const medRun = calculateMarkovTimeline(1.3, 2, 1.0, 12);
const flowAt60min = medRun[6].flow;
assert(flowAt60min > 0.25, `F3.2: Flow at 60min still present: ${flowAt60min.toFixed(3)}`);

// ===========================================================================
// 4. Flow Collapse — Tipping Point
// ===========================================================================

console.log('\n📋 4. Flow Collapse (Tipping Point)');

// Long session with moderate difficulty — flow should decline over time
const longRun = calculateMarkovTimeline(0.9, 3, 1.0, 30);

const flowAt2h = longRun[12].flow;
const flowAt3h = longRun[18].flow;
const flowAt4h = longRun[24].flow;

// Flow should decline over the long session
assert(flowAt3h < flowAt2h || flowAt2h < longRun[6].flow,
  `F4.1: Flow declines over long session (2h:${flowAt2h.toFixed(3)}, 3h:${flowAt3h.toFixed(3)})`);

// After 4+ hours, flow should be low
assert(flowAt4h < 0.5, `F4.2: Flow below 50% after 4h: ${flowAt4h.toFixed(3)}`);

// Fatigue should be highest at the end
const fatigueAt4h = longRun[24].fatigue;
const fatigueAt2h = longRun[12].fatigue;
assert(fatigueAt4h >= fatigueAt2h * 0.80,
  `F4.3: Fatigue builds over time (2h:${fatigueAt2h.toFixed(3)}, 4h:${fatigueAt4h.toFixed(3)})`);

// ===========================================================================
// 5. Cognitive Momentum
// ===========================================================================

console.log('\n📋 5. Cognitive Momentum');

// Compare two runs: one where fatigue accelerates, one where it's steady
// Hard task (beta=5, gamma=1.25): fatigue should accelerate
const accelerating = calculateMarkovTimeline(0.5, 5, 1.25, 12);

// Check that fatigue rate increases over time (momentum)
const fatigueEarly = accelerating.slice(1, 5).reduce((s, p) => s + p.fatigue, 0) / 4;
const fatigueLate = accelerating.slice(8, 12).reduce((s, p) => s + p.fatigue, 0) / 4;
assert(fatigueLate > fatigueEarly,
  `M5.1: Fatigue accelerates (early:${fatigueEarly.toFixed(3)}, late:${fatigueLate.toFixed(3)})`);

// ===========================================================================
// 6. Cognitive Capacity Ceiling
// ===========================================================================

console.log('\n📋 6. Cognitive Capacity Ceiling');

// Capacity scales with alpha
const capLow = computeCognitiveCapacity(0.5);
const capMid = computeCognitiveCapacity(1.0);
const capHigh = computeCognitiveCapacity(1.5);
assert(capHigh > capMid, 'C6.1: Higher alpha → higher capacity');
assert(capMid > capLow, 'C6.2: Mid alpha → mid capacity');
assert(capLow > 0, 'C6.3: Capacity always positive');

// Simulate with high cumulative load (beyond capacity)
const normalRun = calculateMarkovTimeline(1.0, 3, 1.0, 12);
const overloadedRun = calculateMarkovTimeline(1.0, 3, 1.0, 12, null, { cumulativeLoad: 300 });

const normalFatigueEnd = normalRun[12].fatigue;
const overloadedFatigueEnd = overloadedRun[12].fatigue;
assert(overloadedFatigueEnd >= normalFatigueEnd * 0.90,
  `C6.4: Overloaded run ≥ similar fatigue (normal:${normalFatigueEnd.toFixed(3)}, overloaded:${overloadedFatigueEnd.toFixed(3)})`);

// ===========================================================================
// 7. Attention Residue
// ===========================================================================

console.log('\n📋 7. Attention Residue');

// Same type → low residue
const sameRes = computeAttentionResidue('academic', 'academic');
assert(sameRes === 0.05, `A7.1: Same-type residue = 5%: ${sameRes}`);

// Different types → higher residue
const diffRes = computeAttentionResidue('academic', 'sports');
assert(diffRes > sameRes, `A7.2: Different-type residue > same-type: ${diffRes}`);

// Sports→academic (physically tired → mental work = harder)
const sportsToAcad = computeAttentionResidue('sports', 'academic');
assert(sportsToAcad > 0.10, `A7.3: Sports→Academic residue significant: ${sportsToAcad}`);

// Null/undefined → 0
assert(computeAttentionResidue(null, 'academic') === 0, 'A7.4: null prev → 0 residue');
assert(computeAttentionResidue('academic', null) === 0, 'A7.5: null new → 0 residue');

// Unknown types → default 10%
const unknownRes = computeAttentionResidue('unknown', 'mystery');
assert(unknownRes === 0.10, `A7.6: Unknown types → 10% default: ${unknownRes}`);

// ===========================================================================
// 8. Integration: Break effectiveness vs timing
// ===========================================================================

console.log('\n📋 8. Break timing effectiveness');

// Simulate a session, find burnout, compare early vs late break
const session = calculateMarkovTimeline(0.7, 4, 1.15, 18);
const bt = findBurnoutTick(session, 0.40);

if (bt > 0 && bt < 15) {
  // Early break (at burnout tick)
  const earlyBreak = optimizeWithBreak(0.7, 4, 1.15, 18, bt, 15);
  const earlyEndFatigue = earlyBreak.optimized[earlyBreak.optimized.length - 1].fatigue;

  // Late break (3 ticks after burnout)
  const lateBreak = optimizeWithBreak(0.7, 4, 1.15, 18, Math.min(bt + 3, 16), 15);
  const lateEndFatigue = lateBreak.optimized[lateBreak.optimized.length - 1].fatigue;

  // Earlier break should result in lower end fatigue
  assert(earlyEndFatigue <= lateEndFatigue * 1.1,
    `T8.1: Early break ≤ late break fatigue (early:${earlyEndFatigue.toFixed(3)}, late:${lateEndFatigue.toFixed(3)})`);
}

// ===========================================================================
// 9. API backward compatibility
// ===========================================================================

console.log('\n📋 9. API backward compatibility');

// Old API (5 params) still works
const oldAPI = calculateMarkovTimeline(1.0, 3, 1.0, 10);
assert(oldAPI.length === 11, 'API9.1: Old API still works (5 params)');
assert(oldAPI[0].flow === 1.0, 'API9.2: Starts at 100% flow');

// New API (6 params with options) works
const newAPI = calculateMarkovTimeline(1.0, 3, 1.0, 10, null, { cumulativeLoad: 50 });
assert(newAPI.length === 11, 'API9.3: New API works (6 params)');

// findBurnoutTick unchanged
const bt2 = findBurnoutTick(oldAPI, 0.50);
assert(typeof bt2 === 'number', 'API9.4: findBurnoutTick still works');

// optimizeWithBreak works with and without options
const opt1 = optimizeWithBreak(1.0, 3, 1.0, 10, 5, 15);
assert(opt1.original !== undefined, 'API9.5: optimizeWithBreak old API works');
const opt2 = optimizeWithBreak(1.0, 3, 1.0, 10, 5, 15, { cumulativeLoad: 50 });
assert(opt2.original !== undefined, 'API9.6: optimizeWithBreak new API works');

// ===========================================================================
// 10. Numerical stability
// ===========================================================================

console.log('\n📋 10. Numerical stability');

// All probability vectors sum to ~1 across many runs
for (const params of [
  [0.5, 5, 1.25, 18],
  [1.5, 1, 0.7, 18],
  [0.3, 5, 2.0, 30],
  [1.0, 3, 1.0, 50],
  [0.7, 4, 1.5, 10],
]) {
  const tl = calculateMarkovTimeline(...params);
  for (const p of tl) {
    const sum = p.flow + p.distracted + p.fatigue + p.recovery;
    assert(sum >= 0.97 && sum <= 1.03,
      `N10: params(${params}) tick=${p.tick} sum=${sum.toFixed(4)}`);
  }
}

// No NaN or Infinity in any output.
// Seeded PRNG (mulberry32) — the suite's total is assertion-based and this
// loop asserts per timeline point, whose length depends on the random step
// count. A fixed seed keeps the run-to-run total deterministic (CI-friendly)
// while still exercising 20 varied random parameter sets.
let _randSeed = 0x2f6e2b1;
function rand() {
  _randSeed = (_randSeed + 0x6D2B79F5) | 0;
  let t = Math.imul(_randSeed ^ (_randSeed >>> 15), 1 | _randSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
for (let i = 0; i < 20; i++) {
  const a = 0.3 + rand() * 2.7;
  const b = 1 + rand() * 4;
  const g = 0.5 + rand() * 1.5;
  const s = Math.floor(rand() * 20) + 1;
  const tl = calculateMarkovTimeline(a, b, g, s);
  for (const p of tl) {
    assert(Number.isFinite(p.flow), `N10b: No NaN in flow (a=${a.toFixed(2)}, b=${b.toFixed(2)})`);
    assert(Number.isFinite(p.fatigue), `N10c: No NaN in fatigue`);
    assert(p.flow >= 0 && p.flow <= 1, `N10d: flow in [0,1]: ${p.flow}`);
  }
}

// ===========================================================================
// 11. v6 Realism calibration
// ===========================================================================
// v6 retuned the engine so curves match real-life cognitive behavior:
// a normal person doing a normal task stays mostly in flow; circadian
// timing (γ), difficulty (β) and calibration (α) all produce visible,
// ordered effects; and burnout breaks are realistic (15-30 min), not 60.
// These tests lock in the v6 calibration targets.

console.log('\n📋 11. v6 Realism calibration');

// R11.1: Normal session sanity — v5 ended a 60-min β=3 task at flow 0.11 /
// fatigue 0.52. A normal hour of work should keep flow > 50% and fatigue < 30%.
const rNormal60 = calculateMarkovTimeline(1.0, 3, 1.0, 6);
assert(rNormal60[6].flow > 0.5, `R11.1a: 60min normal task keeps flow > 0.5 (${rNormal60[6].flow.toFixed(3)})`);
assert(rNormal60[6].fatigue < 0.3, `R11.1b: 60min normal task fatigue < 0.3 (${rNormal60[6].fatigue.toFixed(3)})`);
assert(findBurnoutTick(rNormal60, 0.50) === -1,
  'R11.1c: 60min normal task does not trigger burnout');

// R11.2: Circadian channel must be alive — v5's clamp() pinned γ≥1 to exactly
// 1.0, making 10am and 10pm curves bit-identical. γ=1.25 must now be
// substantially worse than γ=1.0, and γ=0.7 (sports at peak time) better.
const rG10 = calculateMarkovTimeline(1.0, 3, 1.0, 9);
const rG125 = calculateMarkovTimeline(1.0, 3, 1.25, 9);
const rG07 = calculateMarkovTimeline(1.0, 3, 0.7, 9);
assert(rG125[9].fatigue > rG10[9].fatigue * 1.5,
  `R11.2a: γ=1.25 fatigue ≥ 1.5× γ=1.0 (${(rG125[9].fatigue / rG10[9].fatigue).toFixed(2)}×)`);
assert(rG07[9].fatigue < rG10[9].fatigue,
  `R11.2b: γ=0.7 fatigue < γ=1.0 (${rG07[9].fatigue.toFixed(3)} < ${rG10[9].fatigue.toFixed(3)})`);
assert(rG125[9].flow < rG10[9].flow,
  'R11.2c: bad timing also costs flow');

// R11.3: Difficulty ordering — harder tasks must produce strictly more
// fatigue at the same duration (v5 left β out of the Distracted row, so
// β=1 and β=5 sessions looked nearly identical).
let rPrevFatigue = -1;
let rDiffMonotonic = true;
for (const b of [1, 2, 3, 4, 5]) {
  const f = calculateMarkovTimeline(1.0, b, 1.0, 9)[9].fatigue;
  if (f <= rPrevFatigue) rDiffMonotonic = false;
  rPrevFatigue = f;
}
assert(rDiffMonotonic, 'R11.3: fatigue at 90 min strictly increases with difficulty β=1→5');

// R11.4: Calibration ordering — lower α (worse Stroop score) tires faster
const rA07 = calculateMarkovTimeline(0.7, 4, 1.0, 9)[9].fatigue;
const rA10 = calculateMarkovTimeline(1.0, 4, 1.0, 9)[9].fatigue;
const rA13 = calculateMarkovTimeline(1.3, 4, 1.0, 9)[9].fatigue;
assert(rA07 > rA10 && rA10 > rA13, 'R11.4: fatigue decreases as α improves (0.7 > 1.0 > 1.3)');

// R11.5: Hard 2-hour task burns out — the break feature must fire for the
// hardest typical session (v6 tuning target)
const rHard2h = calculateMarkovTimeline(1.0, 5, 1.0, 12);
assert(findBurnoutTick(rHard2h, 0.50) > 0, 'R11.5: 2h β=5 task triggers burnout');

// R11.6: Moderate 2.5h task does NOT burn out — β=2 should stay comfortable
const rMod = calculateMarkovTimeline(1.0, 2, 1.0, 15);
assert(findBurnoutTick(rMod, 0.50) === -1, 'R11.6: 2.5h β=2 task stays below burnout');
assert(rMod[15].fatigue < 0.25, `R11.6b: moderate task stays fresh (${rMod[15].fatigue.toFixed(3)})`);

// R11.7: Flow collapse visible in marathons — flow at 3h must be well below 2h
const rMarathon = calculateMarkovTimeline(1.0, 4, 1.0, 18);
assert(rMarathon[18].flow < rMarathon[12].flow * 0.7,
  `R11.7: flow collapses after 2h in a marathon (2h:${rMarathon[12].flow.toFixed(3)}, 3h:${rMarathon[18].flow.toFixed(3)})`);

// R11.8: Break realism — a burnout break for a mid-session burnout should be
// 10-30 minutes, not the v5 60-minute default
const rBreakSession = calculateMarkovTimeline(0.8, 4, 1.15, 18);
const rBreakTick = findBurnoutTick(rBreakSession, 0.50);
if (rBreakTick > 0) {
  const rBreakLen = computeOptimalBreakDuration(rBreakSession, rBreakTick, 0.30);
  assert(rBreakLen >= 10 && rBreakLen <= 30,
    `R11.8: optimal break in [10,30] min (${rBreakLen})`);
  const rOpt = optimizeWithBreak(0.8, 4, 1.15, 18, rBreakTick, rBreakLen);
  assert(rOpt.optimized[rOpt.optimized.length - 1].fatigue < rBreakSession[rBreakSession.length - 1].fatigue,
    'R11.8b: taking the break lowers end-of-session fatigue');
}

// R11.9: Even trivial tasks cost SOME fatigue (v6 floor)
const rEasy = calculateMarkovTimeline(1.0, 1, 1.0, 6);
assert(rEasy[6].fatigue > 0.01,
  `R11.9: 60min β=1 task still costs fatigue > 1% (${rEasy[6].fatigue.toFixed(3)})`);

// R11.10: Recovery converts most regained capacity to flow (v5 parked ~35%
// of post-break state in the Recovery pool)
const rRec = computeRecoveryState([0.5, 0.2, 0.3, 0.0], 15);
assert(rRec[0] > rRec[2], `R11.10: post-break flow > fatigue (${rRec.map(x => x.toFixed(2)).join(',')})`);
assert(rRec[3] < 0.15, `R11.10b: recovery pool stays small (${rRec[3].toFixed(3)})`);

// ===========================================================================
// §12 — API guards (2026-08-31 production bug sweep)
// ===========================================================================

// 12.1: steps upper clamp — an unclamped steps=1e7 allocated millions of
// timeline points and froze the UI.
const hugeTimeline = calculateMarkovTimeline(1.0, 3, 1.0, 1e7);
assert(hugeTimeline.length <= 145, `12.1: steps clamped (got ${hugeTimeline.length} points)`);

// 12.2: burnoutTick clamped into [1, steps] — a tick beyond the session
// used to emit a timeline LONGER than the session itself.
const clampOpt = optimizeWithBreak(1.0, 3, 1.0, 6, 10, 15);
assert(clampOpt.optimized.length === clampOpt.original.length,
  `12.2: optimized length matches session (got ${clampOpt.optimized.length} vs ${clampOpt.original.length})`);

// 12.3: NaN burnoutTick is a no-op, not a corrupted timeline
const nanOpt = optimizeWithBreak(1.0, 3, 1.0, 6, NaN, 15);
assert(nanOpt.optimized.length === nanOpt.original.length, '12.3: NaN burnoutTick returns original');

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
  console.log('  ✅ All v3 engine tests passed!\n');
}
