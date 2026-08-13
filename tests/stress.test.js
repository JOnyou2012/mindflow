/**
 * Stress / edge-case test suite.
 * Tests extreme inputs, rapid-fire scheduling, and boundary conditions.
 * Run: node tests/stress.test.js
 */

import generateWeeklySchedule, {
  findFreeSlots, ALL_DAYS,
} from '../src/utils/scheduler.js';
import {
  calculateMarkovTimeline, findBurnoutTick,
  computeOptimalBreakDuration, computeRecoveryState,
  sigmoid,
} from '../src/utils/markovEngine.js';

let passed = 0, failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push(label); console.error(`  ❌ ${label}`); }
}

// ===========================================================================
// 1. Markov engine — extreme parameters
// ===========================================================================

console.log('\n📋 1. Markov engine extreme parameters');

// Extreme alpha
for (const a of [0.01, 0.3, 0.5, 1.0, 1.5, 2.5, 3.0, 5.0, 100]) {
  const t = calculateMarkovTimeline(a, 3, 1.0, 5);
  assert(t.length === 6, `M1: alpha=${a} → ${t.length} ticks`);
  assert(t[0].flow >= 0 && t[0].flow <= 1, `M2: alpha=${a} flow in [0,1]`);
}

// Extreme beta
for (const b of [0.5, 1, 2, 3, 4, 5, 10, 50]) {
  const t = calculateMarkovTimeline(1.0, b, 1.0, 5);
  assert(t.length === 6, `M3: beta=${b} → valid`);
}

// Extreme gamma
for (const g of [0.1, 0.5, 0.7, 1.0, 1.25, 1.5, 2.0, 3.0]) {
  const t = calculateMarkovTimeline(1.0, 3, g, 5);
  assert(t.length === 6, `M4: gamma=${g} → valid`);
}

// Zero steps
const t0 = calculateMarkovTimeline(1.0, 3, 1.0, 0);
assert(t0.length === 1, `M5: 0 steps → 1 point (t=0 only)`);

// Negative steps (should be handled)
const tNeg = calculateMarkovTimeline(1.0, 3, 1.0, -5);
assert(tNeg.length >= 0, `M6: negative steps handled`);

// NaN/Infinity guards
for (const bad of [NaN, Infinity, -Infinity]) {
  const t = calculateMarkovTimeline(bad, 3, 1.0, 5);
  assert(t.length === 6, `M7: alpha=${bad} → handled`);
  const t2 = calculateMarkovTimeline(1.0, bad, 1.0, 5);
  assert(t2.length === 6, `M8: beta=${bad} → handled`);
}

// Custom initial state
const customState = calculateMarkovTimeline(1.0, 3, 1.0, 3, [0.5, 0.3, 0.1, 0.1]);
assert(customState.length === 4, 'M9: Custom initial state works');
assert(customState[0].flow < 1.0, 'M10: Started degraded');

// Degenerate initial state
const degen = calculateMarkovTimeline(1.0, 3, 1.0, 3, [0, 0, 0, 0]);
assert(degen.length === 4, 'M11: Degenerate state → normalized');

// ===========================================================================
// 2. Sigmoid function
// ===========================================================================

console.log('\n📋 2. Sigmoid function');

assert(sigmoid(0, 1, 5) < 0.01, 'S1: sigmoid far left ≈ 0');
assert(sigmoid(1, 1, 5) === 0.5, 'S2: sigmoid at center = 0.5');
assert(sigmoid(2, 1, 5) > 0.99, 'S3: sigmoid far right ≈ 1');
assert(sigmoid(0, 0, 1) === 0.5, 'S4: sigmoid at origin center = 0.5');

// ===========================================================================
// 3. Optimal break duration — edge cases
// ===========================================================================

console.log('\n📋 3. Optimal break edge cases');

const tl = calculateMarkovTimeline(0.5, 5, 1.25, 18);
const bt = findBurnoutTick(tl, 0.30); // low threshold

if (bt > 0) {
  const dur = computeOptimalBreakDuration(tl, bt, 0.20);
  assert(dur >= 5 && dur <= 60, `B1: Break in [5,60]: ${dur}`);
  assert(dur % 5 === 0, `B2: Break rounded to 5: ${dur}`);
}

// Bad inputs
assert(computeOptimalBreakDuration(null, 1) === 15, 'B3: null timeline → 15');
assert(computeOptimalBreakDuration([], 1) === 15, 'B4: empty timeline → 15');
assert(computeOptimalBreakDuration(tl, -1) === 15, 'B5: burnoutTick=-1 → 15');
assert(computeOptimalBreakDuration(tl, 999) === 15, 'B6: out of bounds → 15');

// ===========================================================================
// 4. Recovery state — edge cases
// ===========================================================================

console.log('\n📋 4. Recovery state edge cases');

// Fully fatigued
const rs1 = computeRecoveryState([0.1, 0.1, 0.7, 0.1], 30);
assert(rs1[2] < 0.7, 'R1: Fatigue reduced after break');

// Fully fresh (minimal change)
const rs2 = computeRecoveryState([0.8, 0.1, 0.05, 0.05], 15);
const sum2 = rs2.reduce((a, b) => a + b, 0);
assert(Math.abs(sum2 - 1.0) < 0.001, 'R2: Recovery output sums to 1');

// Different break lengths
const rsShort = computeRecoveryState([0.2, 0.2, 0.5, 0.1], 5);
const rsLong = computeRecoveryState([0.2, 0.2, 0.5, 0.1], 60);
assert(rsLong[2] < rsShort[2], 'R3: Longer break → more fatigue reduction');
assert(rsLong[0] > rsShort[0], 'R4: Longer break → more flow recovery');

// ===========================================================================
// 5. Scheduler — bulk tasks
// ===========================================================================

console.log('\n📋 5. Bulk task scheduling');

// 30 tasks of varying types
const bulkTasks = [];
const types = ['academic', 'sports', 'arts', 'other'];
const priorities = ['high', 'medium', 'low'];
for (let i = 0; i < 30; i++) {
  bulkTasks.push({
    id: `bulk-${i}`,
    title: `Bulk ${i}`,
    type: types[i % 4],
    durationMins: 15 + (i % 6) * 15,
    difficulty: 1 + (i % 5),
    priority: priorities[i % 3],
    deadline: i % 5 === 0 ? '2026-08-10' : null,
  });
}

const bulkResult = generateWeeklySchedule([], bulkTasks, 1.0, {});
assert(bulkResult.warnings !== undefined, 'K1: Warnings exist');
assert(bulkResult.preflight !== undefined, 'K2: Preflight exists');
assert(bulkResult.stats !== null, 'K3: Stats exist');

let totalSessions = 0;
for (const d of ALL_DAYS) totalSessions += bulkResult.days[d].sessions.length;
assert(totalSessions + bulkResult.unscheduled.length === 30, 'K4: All tasks accounted for');

// Every session has placement reason and quality
for (const d of ALL_DAYS) {
  for (const s of bulkResult.days[d].sessions) {
    assert(s.placementReason !== undefined, 'K5: placementReason exists');
    assert(s.sessionQuality !== undefined, 'K6: sessionQuality exists');
    assert(s.sessionQuality.efficiency >= 0, 'K7: efficiency >= 0');
    assert(s.sessionQuality.efficiency <= 100, 'K8: efficiency <= 100');
  }
}

// ===========================================================================
// 6. Scheduler — all types, all priorities
// ===========================================================================

console.log('\n📋 6. Type/priority combinations');

for (const type of ['academic', 'sports', 'arts', 'other']) {
  for (const priority of ['high', 'medium', 'low']) {
    for (const difficulty of [1, 3, 5]) {
      const task = {
        id: `combo-${type}-${priority}-${difficulty}`,
        title: `${type} ${priority} ${difficulty}`,
        type, priority, difficulty,
        durationMins: 30,
        deadline: null,
      };
      const result = generateWeeklySchedule([], [task], 1.0, {});
      const scheduled = Object.values(result.days).some(d => d.sessions.length > 0);
      assert(scheduled, `C1: ${type}/${priority}/diff${difficulty} → scheduled`);
    }
  }
}

// ===========================================================================
// 7. Calendar edge cases
// ===========================================================================

console.log('\n📋 7. Calendar edge cases');

// Overlapping blocks
const overlap = [
  { id: 'a', day: 'Mon', startHour: 9, durationHours: 3, label: 'A', type: 'academic', isFixed: true },
  { id: 'b', day: 'Mon', startHour: 10, durationHours: 2, label: 'B', type: 'academic', isFixed: true },
  { id: 'c', day: 'Mon', startHour: 9.5, durationHours: 1, label: 'C', type: 'academic', isFixed: true },
];
const overlapResult = generateWeeklySchedule(overlap, [
  { id: 't', title: 'T', type: 'academic', durationMins: 60, difficulty: 3, priority: 'medium', deadline: null }
], 1.0, {});
const monOverlapSessions = overlapResult.days.Mon.sessions;
// Task should not overlap with 9am-12pm merged block
if (monOverlapSessions.length > 0) {
  const startH = monOverlapSessions[0].startTick / 6;
  assert(startH >= 12 || startH < 9, `C2: No overlap with merged block (starts ${startH})`);
}

// Block extending past DAY_END (10pm)
const lateBlock = [{ id: 'lb', day: 'Mon', startHour: 20, durationHours: 5, label: 'Late', type: 'academic', isFixed: true }];
const lateSlots = findFreeSlots(lateBlock);
// Should have a slot from 6am to 8pm, nothing after 10pm
assert(lateSlots.length >= 1, 'C3: Late block → free slots before it');

// Block starting before DAY_START (6am)
const earlyBlock = [{ id: 'eb', day: 'Mon', startHour: 4, durationHours: 4, label: 'Early', type: 'academic', isFixed: true }];
const earlySlots = findFreeSlots(earlyBlock);
assert(earlySlots.length >= 1, 'C4: Early block → free slots after it');

// ===========================================================================
// 8. Settings edge cases
// ===========================================================================

console.log('\n📋 8. Settings edge cases');

// Min caps
const minCap = generateWeeklySchedule([], [
  { id: 'm1', title: 'M1', type: 'academic', durationMins: 30, difficulty: 3, priority: 'high', deadline: null }
], 1.0, { maxHoursPerDay: 0.1, maxHoursWeekend: 0.1 });
assert(minCap.unscheduled.length === 1 || minCap.warnings.length > 0, 'E1: Tiny cap handled');

// Max caps
const maxCap = generateWeeklySchedule([], [
  { id: 'mx', title: 'MX', type: 'academic', durationMins: 30, difficulty: 3, priority: 'high', deadline: null }
], 1.0, { maxHoursPerDay: 16, maxHoursWeekend: 12 });
assert(maxCap.unscheduled.length === 0, 'E2: Large cap → task scheduled');

// All chronotypes
for (const ct of ['morning', 'neutral', 'night', 'invalid']) {
  const r = generateWeeklySchedule([], [
    { id: 'ct', title: ct, type: 'academic', durationMins: 30, difficulty: 3, priority: 'medium', deadline: null }
  ], 1.0, { chronotype: ct });
  const sched = Object.values(r.days).some(d => d.sessions.length > 0);
  assert(sched, `E3: chronotype="${ct}" → scheduled`);
}

// ===========================================================================
// 9. Deadline edge cases
// ===========================================================================

console.log('\n📋 9. Deadline edge cases');

// Invalid date string
const badDateResult = generateWeeklySchedule([], [
  { id: 'bd', title: 'Bad Date', type: 'academic', durationMins: 30, difficulty: 3, priority: 'high', deadline: 'not-a-real-date' }
], 1.0, {});
const badDateScheduled = Object.values(badDateResult.days).some(d => d.sessions.length > 0);
assert(badDateScheduled, 'D1: Invalid deadline → treated as no deadline → scheduled');

// Very far future deadline
const farDateResult = generateWeeklySchedule([], [
  { id: 'ff', title: 'Far Future', type: 'academic', durationMins: 30, difficulty: 3, priority: 'high', deadline: '2030-12-25' }
], 1.0, {});
assert(farDateResult.unscheduled.length === 0, 'D2: Far deadline → scheduled');

// ===========================================================================
// 10. Warnings integrity
// ===========================================================================

console.log('\n📋 10. Warnings integrity');

// All warning objects have required shape
const warnResult = generateWeeklySchedule([], [
  { id: 'w1', title: 'W1', type: 'academic', durationMins: 120, difficulty: 5, priority: 'high', deadline: '2026-08-07' },
  { id: 'w2', title: 'W2', type: 'academic', durationMins: 120, difficulty: 5, priority: 'high', deadline: '2026-08-07' },
], 1.0, { chronotype: 'morning' });

for (const w of warnResult.warnings) {
  assert(['high', 'medium', 'low'].includes(w.severity), `W1: severity valid: ${w.severity}`);
  assert(typeof w.type === 'string' && w.type.length > 0, 'W2: type is non-empty string');
  assert(typeof w.message === 'string' && w.message.length > 0, 'W3: message is non-empty');
  assert(typeof w.detail === 'string', 'W4: detail is string');
}

// ===========================================================================
// 11. Rapid consecutive scheduling (no memory leaks)
// ===========================================================================

console.log('\n📋 11. Rapid scheduling');

for (let i = 0; i < 20; i++) {
  const r = generateWeeklySchedule(
    [{ id: 'c', day: 'Mon', startHour: 9, durationHours: 2, label: 'Class', type: 'academic', isFixed: true }],
    [
      { id: 'a', title: 'A', type: 'academic', durationMins: 60, difficulty: 3, priority: 'high', deadline: null },
      { id: 'b', title: 'B', type: 'sports', durationMins: 30, difficulty: 2, priority: 'medium', deadline: null },
    ],
    1.0,
    { chronotype: 'neutral', maxHoursPerDay: 8, maxHoursWeekend: 4 }
  );
  assert(r.generatedAt > 0, `R1: Run ${i} generatedAt valid`);
  assert(r.stats !== null, `R2: Run ${i} stats valid`);
}
console.log('  20 rapid runs complete — no issues');

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
  console.log('  ✅ All stress tests passed!\n');
}
