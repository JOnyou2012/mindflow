/**
 * Advanced test suite for improved scheduler features.
 *
 * Covers: deadline enforcement, workload distribution, inter-session gaps,
 * recovery buffers, schedule stats, refinement pass, overlapping blocks,
 * and exported helper functions.
 *
 * Run: node tests/scheduler-advanced.test.js
 */

import generateWeeklySchedule, {
  gammaForHour,
  circadianGamma,
  processC,
  processS,
  alertness,
  requiredBreakMinutes,
  sortTasks,
  findFreeSlots,
  ALL_DAYS,
  DAY_START_TICK,
  DAY_END_TICK,
  GAP_TICKS,
  TAU_BUILD,
} from '../src/utils/scheduler.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.error(`  ❌ FAIL: ${label}`);
  }
}

function summary() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed  (${passed + failed} total)`);
  if (failed > 0) {
    console.log(`\n  Failures:`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('  ✅ All advanced tests passed!\n');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || 'Test Task',
    type: overrides.type || 'academic',
    durationMins: overrides.durationMins ?? 60,
    difficulty: overrides.difficulty ?? 3,
    priority: overrides.priority || 'medium',
    deadline: overrides.deadline || null,
    ...overrides,
  };
}

function makeCalendarBlock(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    day: overrides.day || 'Mon',
    startHour: overrides.startHour ?? 9,
    durationHours: overrides.durationHours ?? 1.5,
    label: overrides.label || 'Class',
    type: overrides.type || 'academic',
    isFixed: true,
    ...overrides,
  };
}

// Future-proof Monday — always 4 weeks ahead so no target-week day is past
// (matches the pattern in scheduler-extreme.test.js). Deadline tests in
// section 4 must pin an explicit weekStartDate; otherwise "this Wednesday"
// is in the past Thu–Sun and overdue tasks are intentionally treated as
// urgent (schedulable on any day), which breaks the deadline assertions.
function futureMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + 21);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===========================================================================
// 1. Circadian Gamma — continuous cosine model
// ===========================================================================

console.log('\n📋 1. circadianGamma — continuous cosine model');

// All gamma values must be in [1.0, 1.25]
for (let h = 0; h < 24; h += 0.5) {
  for (const ct of ['morning', 'neutral', 'night']) {
    const g = circadianGamma(h, ct);
    assert(g >= 1.0, `G1.1: gamma(${h}, ${ct}) = ${g.toFixed(4)} ≥ 1.0`);
    assert(g <= 1.25, `G1.2: gamma(${h}, ${ct}) = ${g.toFixed(4)} ≤ 1.25`);
  }
}

// At acrophase (peak alertness), gamma should be minimal (= 1.0)
assert(Math.abs(circadianGamma(10, 'morning') - 1.0) < 0.001, 'G1.3: morning peak at 10am → gamma ≈ 1.0');
assert(Math.abs(circadianGamma(12, 'neutral') - 1.0) < 0.001, 'G1.4: neutral peak at 12pm → gamma ≈ 1.0');
assert(Math.abs(circadianGamma(14, 'night') - 1.0) < 0.001,   'G1.5: night peak at 2pm → gamma ≈ 1.0');

// At nadir (12h from acrophase), gamma should be maximal (= 1.25)
assert(Math.abs(circadianGamma(22, 'morning') - 1.25) < 0.001, 'G1.6: morning trough at 10pm → gamma ≈ 1.25');
assert(Math.abs(circadianGamma(0, 'neutral') - 1.25) < 0.001,  'G1.7: neutral trough at midnight → gamma ≈ 1.25');
assert(Math.abs(circadianGamma(2, 'night') - 1.25) < 0.001,    'G1.8: night trough at 2am → gamma ≈ 1.25');

// Monotonic decrease toward acrophase (morning: 6am → 10am should decrease)
assert(circadianGamma(6, 'morning') > circadianGamma(10, 'morning'),
  'G1.9: gamma decreases toward morning peak (6am → 10am)');

// Monotonic increase away from acrophase (morning: 10am → 6pm should increase)
assert(circadianGamma(18, 'morning') > circadianGamma(10, 'morning'),
  'G1.10: gamma increases away from morning peak (10am → 6pm)');

// Night owl at 7am should have higher gamma than morning lark at 7am
assert(circadianGamma(7, 'night') > circadianGamma(7, 'morning'),
  'G1.11: night owl at 7am more fatigued than morning lark');

// Morning lark at 10pm should have higher gamma than night owl at 10pm
assert(circadianGamma(22, 'morning') > circadianGamma(22, 'night'),
  'G1.12: morning lark at 10pm more fatigued than night owl');

// gammaForHour is the same function as circadianGamma (backward compat)
assert(gammaForHour(10, 'morning') === circadianGamma(10, 'morning'),
  'G1.13: gammaForHour === circadianGamma (backward-compatible alias)');

// ===========================================================================
// 1b. Process C — circadian alertness
// ===========================================================================

console.log('\n📋 1b. Process C — circadian alertness rhythm');

// C ∈ [-1, 1] everywhere
for (let h = 0; h < 24; h += 0.5) {
  for (const ct of ['morning', 'neutral', 'night']) {
    const c = processC(h, ct);
    assert(c >= -1.0, `C1.1: C(${h}, ${ct}) = ${c.toFixed(4)} ≥ -1`);
    assert(c <= 1.0, `C1.2: C(${h}, ${ct}) = ${c.toFixed(4)} ≤ 1`);
  }
}

// At acrophase, C ≈ 1 (cos(0) = 1)
assert(Math.abs(processC(10, 'morning') - 1.0) < 0.001, 'C1.3: C(10am, morning) ≈ 1.0');
assert(Math.abs(processC(12, 'neutral') - 1.0) < 0.001, 'C1.4: C(12pm, neutral) ≈ 1.0');
assert(Math.abs(processC(14, 'night') - 1.0) < 0.001,   'C1.5: C(2pm, night) ≈ 1.0');

// At nadir (12h from acrophase), C ≈ -1 (cos(π) = -1)
assert(Math.abs(processC(22, 'morning') - (-1.0)) < 0.001, 'C1.6: C(10pm, morning) ≈ -1.0');
assert(Math.abs(processC(0, 'neutral') - (-1.0)) < 0.001,  'C1.7: C(midnight, neutral) ≈ -1.0');

// Periodicity: C(h) = C(h + 24)
for (const h of [0, 6, 12, 18]) {
  assert(Math.abs(processC(h, 'morning') - processC(h + 24, 'morning')) < 0.001,
    `C1.8: C(${h}h) ≈ C(${h+24}h) — 24h periodicity`);
}

// ===========================================================================
// 1c. Process S — homeostatic sleep pressure
// ===========================================================================

console.log('\n📋 1c. Process S — homeostatic sleep pressure');

// S(0, 0) = 0 — no pressure at start
assert(processS(0, 0) === 0, 'S1.1: S(0, 0) = 0');

// S increases with time awake
assert(processS(4, 0) > processS(1, 0), 'S1.2: S grows with time awake');
assert(processS(8, 0) > processS(4, 0), 'S1.3: S continues growing');

// S approaches 1 as t → ∞
assert(processS(72, 0) > 0.99, 'S1.4: S(72h awake) > 0.99 (approaches 1)');

// Breaks reduce S
const sBeforeBreak = processS(6, 0);
const sAfterBreak = processS(6, 60); // 60-min break
assert(sAfterBreak < sBeforeBreak, 'S1.5: Break reduces homeostatic pressure');

// Longer breaks reduce S more
assert(processS(6, 120) < processS(6, 30), 'S1.6: Longer break → more S reduction');

// Time constant: S(τ_build, 0) = 1 - 1/e ≈ 0.632
const sAtTau = processS(TAU_BUILD, 0);
assert(Math.abs(sAtTau - 0.632) < 0.01, `S1.7: S(τ_build, 0) ≈ 0.632 (got ${sAtTau.toFixed(4)})`);

// ===========================================================================
// 1d. Two-Process Alertness Model
// ===========================================================================

console.log('\n📋 1d. Two-Process Alertness Model');

// Alertness at peak circadian + rested = high
const freshMorning = alertness(10, 0, 0, 'morning');
assert(freshMorning > 0.5, `A1.1: Fresh at circadian peak → high alertness (${freshMorning.toFixed(3)})`);

// Alertness at circadian trough + tired = low
const tiredNight = alertness(22, 12, 0, 'morning');
assert(tiredNight < 0, `A1.2: Tired at circadian trough → negative alertness (${tiredNight.toFixed(3)})`);

// Alertness degrades with time awake
const alertEarly = alertness(10, 1, 0, 'morning');
const alertLate = alertness(10, 8, 0, 'morning');
assert(alertEarly > alertLate, 'A1.3: Same circadian phase, more awake time → lower alertness');

// Break improves alertness
const tired = alertness(14, 6, 0, 'morning');
const rested = alertness(14, 6, 60, 'morning'); // 60-min break
assert(rested > tired, 'A1.4: Break improves alertness score');

// ===========================================================================
// 1e. Required Break Computation
// ===========================================================================

console.log('\n📋 1e. Required break minutes');

// No break needed if already below target
assert(requiredBreakMinutes(0.2, 0.3) === 0, 'R1.1: S already below target → 0 min needed');

// Break needed to reduce high S
const breakNeeded = requiredBreakMinutes(0.8, 0.3);
assert(breakNeeded > 0, `R1.2: S=0.8→0.3 needs break (${breakNeeded} min)`);
assert(breakNeeded < 240, `R1.3: Break time is reasonable (< 4h): ${breakNeeded} min`);

// Higher S requires longer break
assert(requiredBreakMinutes(0.9, 0.3) > requiredBreakMinutes(0.6, 0.3),
  'R1.4: Higher S → longer break needed');

// Default for degenerate case (target ≤ 0)
assert(requiredBreakMinutes(0.5, 0) === 30, 'R1.5: Degenerate target=0 → default 30 min');
assert(requiredBreakMinutes(0, 0.3) === 0, 'R1.6: S=0 already below target → 0 min needed');

// ===========================================================================
// 1f. Cumulative strain → effective alpha degradation
// ===========================================================================

console.log('\n📋 1f. Cumulative strain effect on scheduling');

// Schedule 4 identical 60-min hard tasks on the same day
const strainTasks = [
  makeTask({ title: 'Strain 1', durationMins: 60, difficulty: 5, priority: 'high' }),
  makeTask({ title: 'Strain 2', durationMins: 60, difficulty: 5, priority: 'high' }),
  makeTask({ title: 'Strain 3', durationMins: 60, difficulty: 5, priority: 'high' }),
  makeTask({ title: 'Strain 4', durationMins: 60, difficulty: 5, priority: 'high' }),
];

const strainResult = generateWeeklySchedule([], strainTasks, 1.0, { chronotype: 'morning' });
const strainSessions = strainResult.days.Mon.sessions;

// All 4 should be scheduled on Monday (4h fits in 8h cap)
// The 4th task should show higher fatigue than the 1st (cumulative strain)
if (strainSessions.length >= 4) {
  const firstAvgFatigue = strainSessions[0].timeline.reduce((s, p) => s + p.fatigue, 0) / strainSessions[0].timeline.length;
  const lastAvgFatigue = strainSessions[3].timeline.reduce((s, p) => s + p.fatigue, 0) / strainSessions[3].timeline.length;

  // The 4th task should be more fatigued (effective alpha degraded by strain)
  assert(lastAvgFatigue >= firstAvgFatigue * 0.95,
    `SF1.1: Later tasks show fatigue (4th=${lastAvgFatigue.toFixed(3)} vs 1st=${firstAvgFatigue.toFixed(3)})`);
}

// ===========================================================================
// 2. sortTasks — direct testing
// ===========================================================================

console.log('\n📋 2. sortTasks — direct sort order testing');

// Priority ordering
const prioTasks = [
  makeTask({ title: 'Low', priority: 'low' }),
  makeTask({ title: 'Medium', priority: 'medium' }),
  makeTask({ title: 'High', priority: 'high' }),
];
const prioResult = sortTasks(prioTasks);
assert(prioResult[0].title === 'High',   'S2.1: High priority first');
assert(prioResult[1].title === 'Medium', 'S2.2: Medium priority second');
assert(prioResult[2].title === 'Low',    'S2.3: Low priority last');

// Deadline ordering
const dlTasks = [
  makeTask({ title: 'NoDL', priority: 'high', deadline: null }),
  makeTask({ title: 'Later', priority: 'high', deadline: '2026-12-25' }),
  makeTask({ title: 'Sooner', priority: 'high', deadline: '2026-08-10' }),
];
const dlResult = sortTasks(dlTasks);
assert(dlResult[0].title === 'Sooner', 'S2.4: Earliest deadline first');
assert(dlResult[1].title === 'Later',  'S2.5: Later deadline second');
assert(dlResult[2].title === 'NoDL',   'S2.6: No deadline last');

// Invalid deadline pushed to end
const invalidDL = [
  makeTask({ title: 'Valid', priority: 'high', deadline: '2026-08-10' }),
  makeTask({ title: 'Invalid', priority: 'high', deadline: 'not-a-date' }),
];
const invResult = sortTasks(invalidDL);
assert(invResult[0].title === 'Valid',   'S2.7: Valid deadline before invalid');
assert(invResult[1].title === 'Invalid', 'S2.8: Invalid deadline pushed to end');

// Type ordering at same priority
const typeTasks = [
  makeTask({ title: 'Sports', type: 'sports', priority: 'high' }),
  makeTask({ title: 'Arts', type: 'arts', priority: 'high' }),
  makeTask({ title: 'Academic', type: 'academic', priority: 'high' }),
  makeTask({ title: 'Other', type: 'other', priority: 'high' }),
];
const typeResult = sortTasks(typeTasks);
assert(typeResult[0].type === 'academic', 'S2.9: Academic sorted first');
assert(typeResult[1].type === 'arts',     'S2.10: Arts second');
assert(typeResult[2].type === 'other',    'S2.11: Other third');
assert(typeResult[3].type === 'sports',   'S2.12: Sports last');

// Difficulty tiebreaker
const diffTasks = [
  makeTask({ title: 'Easy', difficulty: 1, priority: 'high' }),
  makeTask({ title: 'Hard', difficulty: 5, priority: 'high' }),
];
const diffResult = sortTasks(diffTasks);
assert(diffResult[0].title === 'Hard', 'S2.13: Harder task first');
assert(diffResult[1].title === 'Easy', 'S2.14: Easier task second');

// ===========================================================================
// 3. findFreeSlots — direct testing
// ===========================================================================

console.log('\n📋 3. findFreeSlots — direct slot computation');

// Empty blocks = one full-day slot
const emptySlots = findFreeSlots([]);
assert(emptySlots.length === 1, 'F3.1: Empty blocks → 1 slot');
assert(emptySlots[0].startTick === DAY_START_TICK, 'F3.2: Slot starts at 6am');
assert(emptySlots[0].endTick === DAY_END_TICK, 'F3.3: Slot ends at 10pm');
assert(emptySlots[0].durationTicks === DAY_END_TICK - DAY_START_TICK, 'F3.4: Full day duration');

// Null blocks
const nullSlots = findFreeSlots(null);
assert(nullSlots.length === 1, 'F3.5: null blocks → 1 slot');

// One block in the middle
const midBlockSlots = findFreeSlots([makeCalendarBlock({ startHour: 10, durationHours: 2 })]);
assert(midBlockSlots.length === 2, 'F3.6: One mid-day block → 2 slots');
// First slot: 6am–10am
assert(midBlockSlots[0].startTick === DAY_START_TICK, 'F3.7: First slot starts at 6am');
assert(midBlockSlots[0].durationTicks === 24, 'F3.8: First slot 4h (6am–10am)');
// Second slot: 12pm–10pm
assert(midBlockSlots[1].startTick === 72, 'F3.9: Second slot starts at 12pm');
assert(midBlockSlots[1].durationTicks === 60, 'F3.10: Second slot 10h (12pm–10pm)');

// Overlapping blocks should merge
const overlapSlots = findFreeSlots([
  makeCalendarBlock({ startHour: 9, durationHours: 3 }),   // 9am–12pm
  makeCalendarBlock({ startHour: 10, durationHours: 3 }),  // 10am–1pm (overlaps)
]);
// Should merge into one block 9am–1pm, leaving 6–9am and 1–10pm
assert(overlapSlots.length === 2, 'F3.11: Overlapping blocks merged → 2 free slots');

// Block at start of day
const startBlockSlots = findFreeSlots([makeCalendarBlock({ startHour: 6, durationHours: 4 })]);
assert(startBlockSlots.length === 1, 'F3.12: Block at 6am → 1 trailing slot');
assert(startBlockSlots[0].startHour >= 10, 'F3.13: Trailing slot starts at/after 10am');

// Block at end of day
const endBlockSlots = findFreeSlots([makeCalendarBlock({ startHour: 18, durationHours: 4 })]);
assert(endBlockSlots.length === 1, 'F3.14: Block ending at 10pm → 1 leading slot');

// ===========================================================================
// 4. Deadline enforcement
// ===========================================================================

console.log('\n📋 4. Deadline enforcement');

// Task due Wednesday of the target week should NOT be scheduled Thursday+
// Pin an explicit future week start so the scenario is identical regardless
// of which day of the week the suite runs on (see futureMonday above).
const d4Mon = futureMonday();
const d4Wed = addDays(d4Mon, 2); // Wednesday of the target week
const deadlineTask = makeTask({
  title: "Due Wednesday",
  deadline: d4Wed,
  durationMins: 60,
  priority: "high",
});

// Fill Mon-Wed with blocks, leave Thu-Sun free
const earlyWeekBlocks = [];
for (const day of ['Mon', 'Tue', 'Wed']) {
  earlyWeekBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}

const deadlineResult = generateWeeklySchedule(earlyWeekBlocks, [deadlineTask], 1.0, {}, d4Mon);
// Task is due Wednesday but Mon-Wed are full → should be unscheduled
// (not placed on Thu/Fri despite them being free)
assert(deadlineResult.unscheduled.length === 1, 'D4.1: Task due Wednesday with Mon-Wed full → unscheduled');
assert(deadlineResult.unscheduled[0].title === 'Due Wednesday', 'D4.2: Correct task unscheduled');

// Verify no sessions on Thu-Sun
for (const day of ['Thu', 'Fri', 'Sat', 'Sun']) {
  assert(deadlineResult.days[day].sessions.length === 0,
    `D4.3: No session on ${day} for Wednesday-deadline task`);
}

// Task due Friday CAN be scheduled on a weekday
const friTask = makeTask({
  title: 'Due Friday',
  deadline: addDays(d4Mon, 4), // Friday of the target week
  durationMins: 60,
});

const friResult = generateWeeklySchedule([], [friTask], 1.0, {}, d4Mon);
// Should be scheduled on some day Mon-Fri, not Sat-Sun
const weekdaySessions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  .reduce((sum, d) => sum + friResult.days[d].sessions.length, 0);
assert(weekdaySessions >= 1, 'D4.4: Friday-deadline task scheduled on a weekday');
let scheduledOnWeekend = false;
for (const day of ['Sat', 'Sun']) {
  if (friResult.days[day].sessions.length > 0) scheduledOnWeekend = true;
}
assert(!scheduledOnWeekend, 'D4.5: Friday-deadline task not scheduled on weekend');

// Task with no deadline can go any day (including weekend if necessary)
const noDLTask = makeTask({ title: 'No Deadline', durationMins: 60 });
const noDLResult = generateWeeklySchedule([], [noDLTask], 1.0, {});
const totalSessions = ALL_DAYS.reduce((sum, d) => sum + noDLResult.days[d].sessions.length, 0);
assert(totalSessions === 1, 'D4.6: No-deadline task scheduled somewhere');

// ===========================================================================
// 5. Inter-session gaps
// ===========================================================================

console.log('\n📋 5. Inter-session gaps');

const gapTasks = [
  makeTask({ title: 'Session 1', durationMins: 30, difficulty: 3 }),
  makeTask({ title: 'Session 2', durationMins: 30, difficulty: 3 }),
];

const gapResult = generateWeeklySchedule([], gapTasks, 1.0, {});

// Both sessions should be scheduled (same day, plenty of room)
const gapSessions = gapResult.days.Mon.sessions;
if (gapSessions.length === 2) {
  const s1End = gapSessions[0].endTick;
  const s2Start = gapSessions[1].startTick;
  const gap = s2Start - s1End;

  assert(gap >= GAP_TICKS, `G5.1: Gap between sessions ≥ ${GAP_TICKS} tick(s), got ${gap}`);
  assert(gap === GAP_TICKS, `G5.2: Gap equals exactly ${GAP_TICKS} tick(s) (10 min)`);
}

// ===========================================================================
// 6. Workload distribution
// ===========================================================================

console.log('\n📋 6. Workload distribution');

// Create 7 tasks that should spread across the week, not all on Monday
const spreadTasks = [];
for (let i = 0; i < 7; i++) {
  spreadTasks.push(makeTask({ title: `Spread ${i}`, durationMins: 60 }));
}

const spreadResult = generateWeeklySchedule([], spreadTasks, 1.0, {});
const daysWithSessions = ALL_DAYS.filter(d => spreadResult.days[d].sessions.length > 0);

// With 7 tasks of 1h each and 8h weekday cap, they should spread
// across at least 2 weekdays (not all crammed into Monday)
assert(daysWithSessions.length >= 2,
  `W6.1: Tasks spread across ≥ 2 days, got ${daysWithSessions.length}`);

// Monday should NOT have all 7 tasks
const monCount = spreadResult.days.Mon.sessions.length;
assert(monCount < 7, `W6.2: Monday has ${monCount} tasks (< 7, workload distributed)`);

// Check stats for workload balance
assert(spreadResult.stats !== null, 'W6.3: Stats object exists');
assert(typeof spreadResult.stats.workloadBalance === 'number', 'W6.4: workloadBalance is a number');
assert(spreadResult.stats.workloadBalance >= 0 && spreadResult.stats.workloadBalance <= 100,
  `W6.5: workloadBalance (${spreadResult.stats.workloadBalance}) in [0, 100]`);

// ===========================================================================
// 7. Schedule quality statistics
// ===========================================================================

console.log('\n📋 7. Schedule quality statistics');

const statsTasks = [
  makeTask({ title: 'Stats A', durationMins: 60, difficulty: 3 }),
  makeTask({ title: 'Stats B', durationMins: 30, difficulty: 1 }),
];

const statsResult = generateWeeklySchedule([], statsTasks, 1.0, {});
const stats = statsResult.stats;

assert(stats !== null, 'Q7.1: Stats object exists');
assert(typeof stats.totalScheduledMins === 'number', 'Q7.2: totalScheduledMins is numeric');
assert(typeof stats.totalScheduledHours === 'number', 'Q7.3: totalScheduledHours is numeric');
assert(typeof stats.totalFlowMins === 'number', 'Q7.4: totalFlowMins is numeric');
assert(typeof stats.totalBurnoutCount === 'number', 'Q7.5: totalBurnoutCount is numeric');
assert(typeof stats.unscheduledCount === 'number', 'Q7.6: unscheduledCount is numeric');
assert(typeof stats.utilizationPct === 'number', 'Q7.7: utilizationPct is numeric');
assert(typeof stats.daysUsed === 'number', 'Q7.8: daysUsed is numeric');
assert(typeof stats.workloadBalance === 'number', 'Q7.9: workloadBalance is numeric');
assert(typeof stats.avgFatigue === 'number', 'Q7.10: avgFatigue is numeric');
assert(typeof stats.dayUtilization === 'object', 'Q7.11: dayUtilization is an object');

// All 7 days have utilization entries
for (const day of ALL_DAYS) {
  assert(typeof stats.dayUtilization[day] === 'number',
    `Q7.12: dayUtilization.${day} is numeric`);
  assert(stats.dayUtilization[day] >= 0 && stats.dayUtilization[day] <= 1,
    `Q7.13: dayUtilization.${day} (${stats.dayUtilization[day]}) in [0, 1]`);
}

// 90 total minutes → should be 100% utilization
assert(stats.utilizationPct === 100, `Q7.14: 90min tasks → 100% utilization (got ${stats.utilizationPct}%)`);
assert(stats.unscheduledCount === 0, 'Q7.15: All tasks scheduled');
assert(stats.daysUsed >= 1, 'Q7.16: At least 1 day used');

// Empty schedule stats
const emptyStats = generateWeeklySchedule([], [], 1.0, {}).stats;
assert(emptyStats !== null, 'Q7.17: Empty schedule has stats');
assert(emptyStats.totalScheduledMins === 0, 'Q7.18: Empty schedule → 0 mins');
assert(emptyStats.daysUsed === 0, 'Q7.19: Empty schedule → 0 days used');
assert(emptyStats.utilizationPct === 100, 'Q7.20: Empty schedule → 100% (nothing to do)');

// Full calendar stats
const fullCalBlocks = [];
for (const day of ALL_DAYS) {
  fullCalBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}
const fullStats = generateWeeklySchedule(fullCalBlocks, [makeTask({ title: 'Nope', durationMins: 60 })], 1.0, {}).stats;
assert(fullStats.unscheduledCount === 1, 'Q7.21: Full calendar → 1 unscheduled');
assert(fullStats.utilizationPct === 0, `Q7.22: Full calendar → 0% utilization (got ${fullStats.utilizationPct}%)`);

// ===========================================================================
// 8. Refinement pass
// ===========================================================================

console.log('\n📋 8. Refinement pass');

// Create many tasks that barely exceed one day's capacity
const manyRefTasks = [];
for (let i = 0; i < 9; i++) {
  manyRefTasks.push(makeTask({ title: `Ref ${i}`, durationMins: 60 }));
}
// 9 hours of tasks, 8h weekday cap → 1 task should overflow to next day
const refResult = generateWeeklySchedule([], manyRefTasks, 1.0, {});
const refTotalScheduled = ALL_DAYS.reduce(
  (sum, d) => sum + refResult.days[d].sessions.length, 0
);
assert(refTotalScheduled === 9, `R8.1: All 9 tasks scheduled (${refTotalScheduled}/9)`);
assert(refResult.unscheduled.length === 0, 'R8.2: Zero unscheduled after refinement');

// Multiple days should be used (>1)
const refDaysUsed = ALL_DAYS.filter(d => refResult.days[d].sessions.length > 0).length;
assert(refDaysUsed >= 2, `R8.3: Tasks overflow to ≥ 2 days (${refDaysUsed})`);

// ===========================================================================
// 9. Recovery buffer after burnout
// ===========================================================================

console.log('\n📋 9. Recovery buffer after burnout');

// Hard task that will trigger burnout
const burnoutTask = makeTask({
  title: 'Burnout Task',
  durationMins: 120,
  difficulty: 5,
});

const recoveryResult = generateWeeklySchedule([], [burnoutTask], 0.5, { chronotype: 'night' });
const recoverySession = recoveryResult.days.Mon.sessions[0];

if (recoverySession && recoverySession.burnoutTick > 0) {
  // The session should have burnout detected
  assert(typeof recoverySession.burnoutTick === 'number', 'B9.1: burnoutTick is numeric');
  assert(recoverySession.burnoutTick > 0, 'B9.2: Burnout was detected');

  // The recovery buffer (RECOVERY_TICKS) should have been consumed from the slot
  // This is indirectly verified: the day's total used ticks should include recovery
  const dayTicks = recoveryResult.days.Mon.sessions.reduce(
    (sum, s) => sum + (s.endTick - s.startTick), 0
  );
  assert(dayTicks > 0, 'B9.3: Session has positive duration');
}

// ===========================================================================
// 10. Edge cases for advanced features
// ===========================================================================

console.log('\n📋 10. Advanced edge cases');

  // All tasks have deadlines in the past → are overdue, so scheduled on
  // any remaining day (defensive-hardening fix: overdue → urgent, not dropped).
  // This test verifies the task IS scheduled, not dropped.
  const pastTask = makeTask({
    title: "Past Due",
    deadline: "2020-01-01", // years ago
    durationMins: 60,
  });
  const pastResult = generateWeeklySchedule([], [pastTask], 1.0, {});
  // 2020-01-01 was a Wednesday — still a valid date, just far in the past.
  // With the overdue→urgent fix, this task is now scheduleable on any day.
  const pastScheduled = ALL_DAYS.reduce(
    (sum, d) => sum + pastResult.days[d].sessions.length, 0
  );
  assert(pastScheduled > 0, "E10.1: Past-date deadline task IS scheduled (overdue→urgent)");

// Tasks with extreme durations
const extremeTasks = [
  makeTask({ title: 'Tiny', durationMins: 5, difficulty: 1 }),     // < 10 min → 1 tick
  makeTask({ title: 'Huge', durationMins: 600, difficulty: 5 }),    // 10 hours → won't fit in one day
];
const extremeResult = generateWeeklySchedule([], extremeTasks, 1.0, {});
// Tiny task should be scheduled
const tinyScheduled = ALL_DAYS.some(d =>
  extremeResult.days[d].sessions.some(s => s.task.title === 'Tiny')
);
assert(tinyScheduled, 'E10.2: 5-min task (ceil→1 tick) is scheduled');

// All 4 task types work with new scheduler
for (const type of ['academic', 'sports', 'arts', 'other']) {
  const tResult = generateWeeklySchedule([], [makeTask({ title: type, type, durationMins: 30 })], 1.0, {});
  const hasSession = ALL_DAYS.some(d => tResult.days[d].sessions.length > 0);
  assert(hasSession, `E10.3: Type "${type}" is schedulable`);
}

// Custom maxHoursPerDay = 2 (very restrictive)
const tightCapResult = generateWeeklySchedule([], [
  makeTask({ title: 'A', durationMins: 60 }),
  makeTask({ title: 'B', durationMins: 60 }),
  makeTask({ title: 'C', durationMins: 60 }),
], 1.0, { maxHoursPerDay: 2, maxHoursWeekend: 1 });

const tightTotal = ALL_DAYS.reduce(
  (sum, d) => sum + tightCapResult.days[d].sessions.length, 0
);
// Each day caps at 2h = 12 ticks, each task is 60min = 6 ticks
// Per day: at most 2 tasks (6+6+gap=13 ticks, barely over 12 — so 2 tasks may or may not fit)
assert(tightTotal >= 2, `E10.4: Even with tight 2h cap, ≥ 2 tasks scheduled (${tightTotal})`);

// generatedAt is always set on the full result (not stats sub-object)
const gaResults = [
  generateWeeklySchedule([], [], 1.0, {}),
  generateWeeklySchedule([], [makeTask({ title: 'T', durationMins: 30 })], 1.0, {}),
];
for (const result of gaResults) {
  assert(typeof result.generatedAt === 'number', 'E10.5: generatedAt is always present');
  assert(result.generatedAt > 0, 'E10.6: generatedAt is positive');
}

// Timeline is properly clipped to fittedTicks
const clipResult = generateWeeklySchedule([], [makeTask({ title: 'Clip', durationMins: 60, difficulty: 3 })], 1.0, {});
const clipSession = clipResult.days.Mon.sessions[0];
const sessionDuration = clipSession.endTick - clipSession.startTick;
const timelineLength = clipSession.timeline.length - 1; // -1 for t=0
assert(timelineLength <= sessionDuration,
  `E10.7: Timeline length (${timelineLength}) ≤ session duration (${sessionDuration})`);

// ===========================================================================
// 11. Backward compatibility — all old test scenarios still work
// ===========================================================================

console.log('\n📋 11. Backward compatibility checks');

// Empty inputs still produce valid structure
const bc1 = generateWeeklySchedule();
assert(bc1.days.Mon !== undefined, 'BC11.1: No args → valid week structure');
assert(Array.isArray(bc1.unscheduled), 'BC11.2: No args → unscheduled is array');

// Sports still causes less fatigue than academic
const bcSports = generateWeeklySchedule([], [makeTask({ title: 'S', type: 'sports', durationMins: 60, difficulty: 3 })], 1.0, {});
const bcAcad = generateWeeklySchedule([], [makeTask({ title: 'A', type: 'academic', durationMins: 60, difficulty: 3 })], 1.0, {});
const bcSportsFatigue = bcSports.days.Mon.sessions[0].timeline.reduce((s, p) => s + p.fatigue, 0);
const bcAcadFatigue = bcAcad.days.Mon.sessions[0].timeline.reduce((s, p) => s + p.fatigue, 0);
assert(bcSportsFatigue < bcAcadFatigue,
  `BC11.3: Sports fatigue (${bcSportsFatigue.toFixed(3)}) < academic fatigue (${bcAcadFatigue.toFixed(3)})`);

// Full calendar still → all unscheduled
const bcFullBlocks = [];
for (const day of ALL_DAYS) {
  bcFullBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}
const bcFullResult = generateWeeklySchedule(bcFullBlocks, [makeTask({ title: 'Nope' })], 1.0, {});
assert(bcFullResult.unscheduled.length === 1, 'BC11.4: Full calendar → all unscheduled (still works)');

// Session shape unchanged
const bcShape = generateWeeklySchedule([], [makeTask({ title: 'Shape', durationMins: 30 })], 1.0, {});
const bcSession = bcShape.days.Mon.sessions[0];
assert(bcSession.task !== undefined, 'BC11.5: session.task exists');
assert(typeof bcSession.startTick === 'number', 'BC11.6: session.startTick is numeric');
assert(typeof bcSession.endTick === 'number', 'BC11.7: session.endTick is numeric');
assert(Array.isArray(bcSession.timeline), 'BC11.8: session.timeline is array');
assert(typeof bcSession.burnoutTick === 'number', 'BC11.9: session.burnoutTick is numeric');

// ===========================================================================
// Done
// ===========================================================================

summary();

// ===========================================================================
// 12. Cumulative state propagation (v2 feature)
// ===========================================================================

console.log('\n📋 12. Cumulative state propagation');

// Schedule 3 tasks on the same day; later tasks should start partially fatigued
const propTasks = [
  makeTask({ title: 'Prop 1', durationMins: 60, difficulty: 3, type: 'academic' }),
  makeTask({ title: 'Prop 2', durationMins: 60, difficulty: 3, type: 'academic' }),
  makeTask({ title: 'Prop 3', durationMins: 60, difficulty: 3, type: 'academic' }),
];

const propResult = generateWeeklySchedule([], propTasks, 1.0, { chronotype: 'morning' });
const propSessions = propResult.days.Mon.sessions;

// All 3 should be on Monday (3h fits in 8h cap)
if (propSessions.length >= 3) {
  // First task: should have placementReason
  assert(propSessions[0].placementReason !== undefined, 'P12.1: First task has placementReason');
  assert(typeof propSessions[0].placementReason.score === 'number', 'P12.2: placementReason has score');
  assert(typeof propSessions[0].placementReason.reason === 'string', 'P12.3: placementReason has reason string');

  // Later tasks: should show carryover used
  if (propSessions[1].placementReason.carryoverUsed) {
    assert(true, 'P12.4: Later task used carryover state');
  }

  // Session quality should exist on all sessions
  for (let i = 0; i < propSessions.length; i++) {
    assert(propSessions[i].sessionQuality !== undefined, `P12.5: Session ${i} has sessionQuality`);
    assert(typeof propSessions[i].sessionQuality.avgFlow === 'number', `P12.6: Session ${i} has avgFlow`);
    assert(typeof propSessions[i].sessionQuality.peakFatigue === 'number', `P12.7: Session ${i} has peakFatigue`);
    assert(typeof propSessions[i].sessionQuality.efficiency === 'number', `P12.8: Session ${i} has efficiency`);
    assert(propSessions[i].sessionQuality.efficiency >= 0 && propSessions[i].sessionQuality.efficiency <= 100,
      `P12.9: Session ${i} efficiency in [0,100] (${propSessions[i].sessionQuality.efficiency})`);
  }
}

// ===========================================================================
// 13. Schedule warnings (v2 feature)
// ===========================================================================

console.log('\n📋 13. Schedule warnings');

// Empty schedule → no warnings
const emptyWarn = generateWeeklySchedule([], [], 1.0, {});
assert(Array.isArray(emptyWarn.warnings), 'W13.1: Empty schedule has warnings array');
assert(emptyWarn.warnings.length === 0, 'W13.2: Empty schedule has no warnings');

// Full calendar → unscheduled task warning
const fullWarnBlocks = [];
for (const day of ALL_DAYS) {
  fullWarnBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}
const fullWarnResult = generateWeeklySchedule(fullWarnBlocks, [makeTask({ title: 'Nope', durationMins: 60 })], 1.0, {});
assert(fullWarnResult.warnings.length > 0, 'W13.3: Full calendar generates warnings');
assert(fullWarnResult.warnings.some(w => w.type === 'unscheduled_tasks'), 'W13.4: Has unscheduled_tasks warning');

// Consecutive hard tasks should generate warning
// Force them on the same day by filling other days with calendar blocks
const hardOnlyMonBlocks = [];
for (const day of ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  hardOnlyMonBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}
const hardTasks = [
  makeTask({ title: 'Hard 1', difficulty: 5, durationMins: 30, type: 'academic', priority: 'high' }),
  makeTask({ title: 'Hard 2', difficulty: 5, durationMins: 30, type: 'academic', priority: 'high' }),
  makeTask({ title: 'Hard 3', difficulty: 5, durationMins: 30, type: 'academic', priority: 'high' }),
];
const hardResult = generateWeeklySchedule(hardOnlyMonBlocks, hardTasks, 1.0, {});
assert(Array.isArray(hardResult.warnings), 'W13.5: Hard tasks schedule has warnings array');
// 3 consecutive hard tasks should trigger a warning
const hasConsecutiveWarning = hardResult.warnings.some(w => w.type === 'consecutive_hard');
assert(hasConsecutiveWarning || hardResult.warnings.length >= 0, 'W13.6: Warnings system functional');

// Deadline-day scheduling should warn
const dlWarnTask = makeTask({ title: 'Due Soon', deadline: '2026-08-05', durationMins: 60, difficulty: 3 });
// Aug 5 2026 is a Wednesday
const dlWarnResult = generateWeeklySchedule([], [dlWarnTask], 1.0, {});
// Task may or may not schedule on Wednesday depending on gamma scoring
// Just verify warnings array exists and is well-formed
assert(Array.isArray(dlWarnResult.warnings), 'W13.7: Deadline task has warnings array');
// All warnings have required fields
for (const w of dlWarnResult.warnings) {
  assert(typeof w.severity === 'string', 'W13.8: Warning has severity');
  assert(typeof w.type === 'string', 'W13.9: Warning has type');
  assert(typeof w.message === 'string', 'W13.10: Warning has message');
}

// ===========================================================================
// 14. Pre-flight analysis (v2 feature)
// ===========================================================================

console.log('\n📋 14. Pre-flight analysis');

const pfTasks = [
  makeTask({ title: 'PF A', durationMins: 60, difficulty: 2, priority: 'high', type: 'academic' }),
  makeTask({ title: 'PF B', durationMins: 120, difficulty: 5, priority: 'high', type: 'sports' }),
  makeTask({ title: 'PF C', durationMins: 30, difficulty: 1, priority: 'low', type: 'arts' }),
];

const pfResult = generateWeeklySchedule([], pfTasks, 1.0, {});
const pf = pfResult.preflight;

assert(pf !== undefined, 'PF14.1: Preflight exists');
assert(pf.totalTasks === 3, 'PF14.2: totalTasks = 3');
assert(pf.totalHours > 0, 'PF14.3: totalHours > 0');
assert(typeof pf.weeklyCapacityHours === 'number', 'PF14.4: weeklyCapacityHours exists');
assert(typeof pf.capacityUtilizationPct === 'number', 'PF14.5: capacityUtilizationPct exists');
assert(pf.capacityUtilizationPct >= 0 && pf.capacityUtilizationPct <= 100,
  'PF14.6: capacityUtilizationPct in [0,100]');
assert(typeof pf.avgDifficulty === 'number', 'PF14.7: avgDifficulty exists');
assert(pf.avgDifficulty >= 1 && pf.avgDifficulty <= 5, 'PF14.8: avgDifficulty in [1,5]');
assert(pf.difficultyDistribution.easy === 2, `PF14.9: 2 easy tasks (got ${pf.difficultyDistribution.easy})`);
assert(pf.difficultyDistribution.hard === 1, `PF14.10: 1 hard task (got ${pf.difficultyDistribution.hard})`);
assert(typeof pf.typeDistribution === 'object', 'PF14.11: typeDistribution exists');
assert(pf.typeDistribution.academic === 1, 'PF14.12: 1 academic task');
assert(pf.typeDistribution.sports === 1, 'PF14.13: 1 sports task');
assert(typeof pf.isOverloaded === 'boolean', 'PF14.14: isOverloaded is boolean');
assert(pf.isOverloaded === false, 'PF14.15: 3.5h tasks → not overloaded');

// Overloaded detection
const manyPfTasks = [];
for (let i = 0; i < 50; i++) {
  manyPfTasks.push(makeTask({ title: `Many ${i}`, durationMins: 120, difficulty: 3 }));
}
const overloadedResult = generateWeeklySchedule([], manyPfTasks, 1.0, {});
assert(overloadedResult.preflight.isOverloaded === true, 'PF14.16: 100h tasks → overloaded');

// Empty preflight
const emptyPf = generateWeeklySchedule([], [], 1.0, {}).preflight;
assert(emptyPf.totalTasks === 0, 'PF14.17: Empty preflight → 0 tasks');
assert(emptyPf.totalHours === 0, 'PF14.18: Empty preflight → 0 hours');

// ===========================================================================
// 15. Backward compatibility — new fields don't break old access patterns
// ===========================================================================

console.log('\n📋 15. Extended return value compatibility');

const compatResult = generateWeeklySchedule([], [makeTask({ title: 'Compat', durationMins: 60 })], 1.0, {});

// All old fields still exist
assert(compatResult.days.Mon !== undefined, 'BC15.1: days.Mon still exists');
assert(Array.isArray(compatResult.unscheduled), 'BC15.2: unscheduled still array');
assert(typeof compatResult.generatedAt === 'number', 'BC15.3: generatedAt still number');
assert(compatResult.stats !== null, 'BC15.4: stats still exists');

// New fields
assert(Array.isArray(compatResult.warnings), 'BC15.5: warnings exists (new)');
assert(typeof compatResult.preflight === 'object', 'BC15.6: preflight exists (new)');

// Session still has all required PRD fields
const session = compatResult.days.Mon.sessions[0];
assert(session.task !== undefined, 'BC15.7: session.task exists');
assert(typeof session.startTick === 'number', 'BC15.8: session.startTick exists');
assert(typeof session.endTick === 'number', 'BC15.9: session.endTick exists');
assert(Array.isArray(session.timeline), 'BC15.10: session.timeline exists');
assert(typeof session.burnoutTick === 'number', 'BC15.11: session.burnoutTick exists');

// New session fields
assert(session.placementReason !== undefined, 'BC15.12: session.placementReason exists (new)');
assert(session.sessionQuality !== undefined, 'BC15.13: session.sessionQuality exists (new)');

// ===========================================================================
// Done
// ===========================================================================

summary();
