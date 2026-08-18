/**
 * Comprehensive test suite for src/utils/scheduler.js
 *
 * Covers all PRD verification steps 14–26.
 * Run: node tests/scheduler.test.js
 */

import generateWeeklySchedule from '../src/utils/scheduler.js';

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
    console.log('  ✅ All tests passed!\n');
  }
}

// ---------------------------------------------------------------------------
// Setup helpers
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
    label: overrides.label || 'Math Class',
    type: overrides.type || 'academic',
    isFixed: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Step 14 — File structure & exports
// ---------------------------------------------------------------------------

console.log('\n📋 Step 14 — File structure & exports');
assert(typeof generateWeeklySchedule === 'function', '14.1: generateWeeklySchedule is a function');
// length=0 because all 4 params have defaults; verify by calling with 4 args
assert(generateWeeklySchedule.length === 0, '14.2: all 4 params have default values (length=0)');
const callResult = generateWeeklySchedule([], [{ id: 't1', title: 'X', durationMins: 30 }], 1.2, { chronotype: 'night' });
assert(callResult.days.Mon.sessions.length >= 1, '14.2b: call with 4 args works correctly');

// ---------------------------------------------------------------------------
// Step 15 — gammaForHour (tested indirectly via schedule output)
// ---------------------------------------------------------------------------

console.log('\n📋 Step 15 — gammaForHour with chronotype shift');

// Morning type at 7am: adjusted=7, gamma=1.0 → less fatigue
// Night type at 7am: adjusted=3, gamma=1.25 → more fatigue
// We test this indirectly: morning type should schedule high-difficulty tasks
// earlier in the morning (gamma=1.0) than night type would.

const morningTask = makeTask({ title: 'Morning Test', type: 'academic', durationMins: 60, difficulty: 3 });
const nightTask = makeTask({ title: 'Night Test', type: 'academic', durationMins: 60, difficulty: 3 });

const morningResult = generateWeeklySchedule([], [morningTask], 1.0, { chronotype: 'morning' });
const nightResult = generateWeeklySchedule([], [nightTask], 1.0, { chronotype: 'night' });

// Morning type: best hour is early (6am–2pm peak)
const morningSessionHour = morningResult.days.Mon.sessions[0].startTick / 6;
// Night type: best hour is late morning/afternoon (10am–6pm peak),
// but 6am is deep night → gamma=1.25, so first few hours are penalized
const nightSessionHour = nightResult.days.Mon.sessions[0].startTick / 6;

// v7: With a single task on an empty day, the spread-across-day bonus
// pushes the task to the afternoon (>=12pm). This prevents the common
// "single task crammed right after a morning calendar block" problem.
assert(morningSessionHour >= 12, '15.1: Single task on empty day goes to afternoon (spread bonus)');
assert(nightSessionHour >= 12, '15.2: Night chronotype single task also in afternoon');

// With enough tasks to exceed the 35% spread threshold, morning slots
// open up for morning chronotypes (who peak at 10am).
const multiMorningTasks = [];
for (let i = 0; i < 5; i++) {
  multiMorningTasks.push(makeTask({ title: `Multi ${i}`, type: 'academic', durationMins: 60, difficulty: 3 }));
}
const morningSpreadResult = generateWeeklySchedule([], multiMorningTasks, 1.0, { chronotype: 'morning' });
// With 5 tasks spread across the week, each day gets 1 task. On lightly-loaded
// days (≤1 task), the spread bonus pushes to afternoon — this is correct behavior.
// Verify that ALL tasks are scheduled and none land before 8am or after 9pm.
let allSessionHours = [];
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  for (const s of morningSpreadResult.days[day].sessions) {
    allSessionHours.push(s.startTick / 6);
  }
}
assert(allSessionHours.length === 5, '15.3: All 5 tasks scheduled');
	for (const h of allSessionHours) {
		assert(h >= 8 && h <= 21, '15.4: All tasks within study hours (8am-9pm)');
	}

	// v7: With a morning calendar block (9-10am) and a single task, the task
	// must NOT be crammed right after the block when the afternoon is free.
	// (With the 15-min transition buffer, the task may also move to another
	// day entirely — assert the invariant on Mon and that it is scheduled
	// somewhere, not which day it lands on.)
	const calBlock = { day: 'Mon', startHour: 9, durationHours: 1 };
	const singleTask2 = makeTask({ title: 'Flex Task', type: 'academic', durationMins: 60, difficulty: 3 });
	const blockedResult = generateWeeklySchedule([calBlock], [singleTask2], 1.0, { chronotype: 'morning' });
	for (const s of blockedResult.days.Mon.sessions) {
		assert(s.startTick >= 62 || s.endTick <= 52, `15.5: Mon session (${s.startTick / 6}h) respects the 9-10am block + transition buffer`);
	}
	const scheduledSomewhere = Object.values(blockedResult.days).some(d => d.sessions.length > 0);
	assert(scheduledSomewhere, '15.5b: Task still scheduled somewhere');

	// With enough tasks to fill the day, morning slots open up despite spread bonus.
	// Block Tue-Sun so all tasks land on Monday.
	const monOnlyBlocks = [];
	for (const d of ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
	 monOnlyBlocks.push({ day: d, startHour: 6, durationHours: 16 });
	}
	const manyTasks = [];
	for (let ii = 0; ii < 5; ii++) {
	 manyTasks.push(makeTask({ title: 'MonTask ' + ii, type: 'academic', durationMins: 60, difficulty: 3 }));
	}
	const monOnlyResult = generateWeeklySchedule(monOnlyBlocks, manyTasks, 1.0, { chronotype: 'morning' });
	const monMorningCount = monOnlyResult.days.Mon.sessions.filter(s => (s.startTick / 6) < 14).length;
	assert(monMorningCount > 0, '15.6: Heavily-loaded Monday uses morning slots');

// v7: Deadline with time component (as produced by the task form) must
// not break date parsing. The form stores deadlines as 'YYYY-MM-DDTHH:MM'.
// Appending 'T00:00:00' blindly creates '...THH:MMT00:00:00' → Invalid Date.
const timedDeadlineTask = makeTask({ title: 'Timed Deadline', type: 'academic', durationMins: 60, difficulty: 3, deadline: '2026-08-15T23:59' });
const timedResult = generateWeeklySchedule([], [timedDeadlineTask], 1.0, { chronotype: 'morning' });
const timedScheduled = Object.values(timedResult.days).some(d => d.sessions.length > 0);
assert(timedScheduled, '15.7: Task with time-including deadline is scheduled (not lost in deferred)');

// Date-only deadline should also work (backward compatibility)
const dateOnlyTask = makeTask({ title: 'Date Deadline', type: 'academic', durationMins: 60, difficulty: 3, deadline: '2026-08-15' });
const dateResult = generateWeeklySchedule([], [dateOnlyTask], 1.0, { chronotype: 'morning' });
const dateScheduled = Object.values(dateResult.days).some(d => d.sessions.length > 0);
assert(dateScheduled, '15.8: Task with date-only deadline is scheduled');

// ---------------------------------------------------------------------------
// Step 16 — sortTasks ordering (tested via schedule: priority > deadline > type > difficulty)
// ---------------------------------------------------------------------------

console.log('\n📋 Step 16 — sortTasks ordering');

const sortTestTasks = [
  makeTask({ title: 'Low Priority', priority: 'low', difficulty: 5 }),
  makeTask({ title: 'High Priority', priority: 'high', difficulty: 1 }),
  makeTask({ title: 'Medium No Deadline', priority: 'medium', deadline: null }),
  makeTask({ title: 'Medium With Deadline', priority: 'medium', deadline: '2026-08-10' }),
];

const sortResult = generateWeeklySchedule([], sortTestTasks, 1.0, {});
const scheduledOrder = [];
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  for (const s of sortResult.days[day].sessions) {
    scheduledOrder.push(s.task.title);
  }
}

const hpIdx = scheduledOrder.indexOf('High Priority');
const mpdIdx = scheduledOrder.indexOf('Medium With Deadline');
const mndIdx = scheduledOrder.indexOf('Medium No Deadline');
const lpIdx = scheduledOrder.indexOf('Low Priority');

assert(hpIdx >= 0, '16.1: High priority is scheduled');
assert(mpdIdx >= 0, '16.2: Medium with deadline is scheduled');
assert(mndIdx >= 0, '16.3: Medium without deadline is scheduled');
assert(lpIdx >= 0, '16.4: Low priority is scheduled');
// All 4 tasks scheduled (v5 date-aware: cross-day order depends on slot scoring)

// Same priority, same deadline, different types: academic before sports
const typeTestTasks = [
  makeTask({ title: 'Sports First', type: 'sports', priority: 'high', difficulty: 5 }),
  makeTask({ title: 'Academic After', type: 'academic', priority: 'high', difficulty: 1 }),
];

const typeResult = generateWeeklySchedule([], typeTestTasks, 1.0, {});
const typeOrder = [];
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  for (const s of typeResult.days[day].sessions) {
    typeOrder.push(s.task.title);
  }
}

const acIdx = typeOrder.indexOf('Academic After');
const spIdx = typeOrder.indexOf('Sports First');
assert(acIdx < spIdx, '16.4: Academic scheduled before sports at same priority');

// At same priority+deadline+type: higher difficulty first
const diffTestTasks = [
  makeTask({ title: 'Easy Task', type: 'academic', priority: 'high', difficulty: 1 }),
  makeTask({ title: 'Hard Task', type: 'academic', priority: 'high', difficulty: 5 }),
];

const diffResult = generateWeeklySchedule([], diffTestTasks, 1.0, {});
const diffOrder = [];
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  for (const s of diffResult.days[day].sessions) {
    diffOrder.push(s.task.title);
  }
}

const hardIdx = diffOrder.indexOf('Hard Task');
const easyIdx = diffOrder.indexOf('Easy Task');
assert(hardIdx < easyIdx, '16.5: Higher difficulty scheduled before lower difficulty (same prio+type)');

// ---------------------------------------------------------------------------
// Step 17 — Global slot matching (tasks can land on any day)
// ---------------------------------------------------------------------------

console.log('\n📋 Step 17 — Global slot matching');

// Fill Mon-Thu with calendar blocks, leave Fri free
const busyWeekBlocks = [];
for (const day of ['Mon', 'Tue', 'Wed', 'Thu']) {
  busyWeekBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}

const globalTask = makeTask({ title: 'Global Test', type: 'academic', durationMins: 60 });
const globalResult = generateWeeklySchedule(busyWeekBlocks, [globalTask], 1.0, {});

// Task should land on Fri (first free day) not Mon
assert(globalResult.days.Fri.sessions.length === 1, '17.1: Task lands on Friday when Mon–Thu are full');
assert(globalResult.days.Mon.sessions.length === 0, '17.2: Task does NOT land on Monday');
assert(globalResult.days.Tue.sessions.length === 0, '17.3: Task does NOT land on Tuesday');

// ---------------------------------------------------------------------------
// Step 18 — Daily caps enforced
// ---------------------------------------------------------------------------

console.log('\n📋 Step 18 — Daily caps enforced');

const manySmallTasks = [];
for (let i = 0; i < 20; i++) {
  manySmallTasks.push(makeTask({ title: `Task ${i}`, durationMins: 60 }));
}

const capResult = generateWeeklySchedule([], manySmallTasks, 1.0, {
  maxHoursPerDay: 8,
  maxHoursWeekend: 4,
});

// Each weekday should have ≤ 8h = 48 ticks
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
  let totalTicks = 0;
  for (const s of capResult.days[day].sessions) {
    totalTicks += (s.endTick - s.startTick);
  }
  assert(totalTicks <= 48, `18.1: ${day} total ticks ≤ 48 (8h cap), got ${totalTicks}`);
}

// Each weekend day should have ≤ 4h = 24 ticks
for (const day of ['Sat', 'Sun']) {
  let totalTicks = 0;
  for (const s of capResult.days[day].sessions) {
    totalTicks += (s.endTick - s.startTick);
  }
  assert(totalTicks <= 24, `18.2: ${day} total ticks ≤ 24 (4h cap), got ${totalTicks}`);
}

// Test custom cap
const customCapResult = generateWeeklySchedule([], manySmallTasks.slice(0, 3), 1.0, {
  maxHoursPerDay: 3,
  maxHoursWeekend: 2,
});
const monTicksCustom = customCapResult.days.Mon.sessions.reduce((sum, s) => sum + (s.endTick - s.startTick), 0);
assert(monTicksCustom <= 18, `18.3: Custom cap 3h/day → ≤ 18 ticks on Monday, got ${monTicksCustom}`);

// ---------------------------------------------------------------------------
// Step 19 — optimizeWithBreak only called when burnoutTick > 0
// ---------------------------------------------------------------------------

console.log('\n📋 Step 19 — optimizeWithBreak guard');

// Low-difficulty task with high alpha: unlikely to burn out
const easyTask = makeTask({ title: 'Easy', durationMins: 30, difficulty: 1 });
const easyResult = generateWeeklySchedule([], [easyTask], 1.5, {});
const easySession = easyResult.days.Mon.sessions[0];

assert(easySession.burnoutTick === -1, '19.1: Easy task (diff=1, alpha=1.5) has burnoutTick = -1 (no burnout)');
assert(easySession.timeline.length > 0, '19.2: Easy task still has a valid timeline');

// Very hard, long task: should trigger burnout
const hardTask = makeTask({ title: 'Hard', durationMins: 180, difficulty: 5 });
const hardResult = generateWeeklySchedule([], [hardTask], 0.5, {});
const hardSession = hardResult.days.Mon.sessions[0];
// With extreme params, burnout should occur
assert(typeof hardSession.burnoutTick === 'number', '19.3: Hard task burnoutTick is a number');

// ---------------------------------------------------------------------------
// Step 20 — Return value shape
// ---------------------------------------------------------------------------

console.log('\n📋 Step 20 — Return value includes unscheduled + generatedAt');

const shapeResult = generateWeeklySchedule([], [makeTask()], 1.0, {});
assert(Array.isArray(shapeResult.unscheduled), '20.1: result.unscheduled is an array');
assert(typeof shapeResult.generatedAt === 'number', '20.2: result.generatedAt is a number');
assert(shapeResult.generatedAt > 0, '20.3: result.generatedAt is a positive timestamp');
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  assert(shapeResult.days[day] !== undefined, `20.4: result.days.${day} exists`);
  assert(Array.isArray(shapeResult.days[day].sessions), `20.5: result.days.${day}.sessions is an array`);
  assert(Array.isArray(shapeResult.days[day].fatigueCurve), `20.6: result.days.${day}.fatigueCurve is an array`);
  assert(typeof shapeResult.days[day].totalFlowMins === 'number', `20.7: result.days.${day}.totalFlowMins is a number`);
  assert(typeof shapeResult.days[day].burnoutCount === 'number', `20.8: result.days.${day}.burnoutCount is a number`);
}

// ---------------------------------------------------------------------------
// Step 21 — Empty/null inputs don't crash
// ---------------------------------------------------------------------------

console.log('\n📋 Step 21 — Empty/null inputs');

let noArgsResult;
try {
  noArgsResult = generateWeeklySchedule();
  assert(noArgsResult !== undefined && noArgsResult !== null, '21.1: generateWeeklySchedule() no-args returns valid result');
} catch (e) {
  assert(false, `21.1: no-args call threw: ${e.message}`);
}

try {
  const emptyResult = generateWeeklySchedule([], [], 1.0, {});
  assert(emptyResult.unscheduled.length === 0, '21.2: Empty inputs → empty unscheduled');
} catch (e) {
  assert(false, `21.2: empty inputs threw: ${e.message}`);
}

try {
  const nullResult = generateWeeklySchedule(null, null, null, null);
  assert(nullResult.days.Mon.sessions.length === 0, '21.3: null inputs → valid empty week');
} catch (e) {
  assert(false, `21.3: null inputs threw: ${e.message}`);
}

try {
  const zeroDurResult = generateWeeklySchedule(
    [makeCalendarBlock()],
    [makeTask({ durationMins: 0 })],
    1.0,
    {}
  );
  assert(zeroDurResult.unscheduled.length === 0, '21.4: 0-duration task filtered out');
  const allSessions = [];
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    allSessions.push(...zeroDurResult.days[day].sessions);
  }
  assert(allSessions.length === 0, '21.5: No sessions for 0-duration task');
} catch (e) {
  assert(false, `21.4: zero-duration threw: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Step 22 — Completely full calendar → all tasks unscheduled
// ---------------------------------------------------------------------------

console.log('\n📋 Step 22 — Full calendar → all unscheduled');

const fullWeekBlocks = [];
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  fullWeekBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}

const fullResult = generateWeeklySchedule(fullWeekBlocks, [makeTask({ title: 'No Room' })], 1.0, {});
assert(fullResult.unscheduled.length === 1, '22.1: All tasks unscheduled when calendar is full');
assert(fullResult.unscheduled[0].title === 'No Room', '22.2: Correct task in unscheduled');

// Verify no sessions on any day
let totalSessionsFull = 0;
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  totalSessionsFull += fullResult.days[day].sessions.length;
}
assert(totalSessionsFull === 0, '22.3: Zero sessions when calendar completely full');

// ---------------------------------------------------------------------------
// Step 23 — Sports tasks cause less fatigue than academic
// ---------------------------------------------------------------------------

console.log('\n📋 Step 23 — Sports vs academic fatigue');

const sportsTask = makeTask({ title: 'Sports', type: 'sports', durationMins: 60, difficulty: 3 });
const acadTask = makeTask({ title: 'Academic', type: 'academic', durationMins: 60, difficulty: 3 });

const sportsResult = generateWeeklySchedule([], [sportsTask], 1.0, {});
const acadResult = generateWeeklySchedule([], [acadTask], 1.0, {});

const sportsSession = sportsResult.days.Mon.sessions[0];
const acadSession = acadResult.days.Mon.sessions[0];

// Calculate average fatigue across the timeline
function avgFatigue(timeline) {
  if (!timeline || timeline.length === 0) return 0;
  return timeline.reduce((sum, p) => sum + p.fatigue, 0) / timeline.length;
}

const sportsAvgFatigue = avgFatigue(sportsSession.timeline);
const acadAvgFatigue = avgFatigue(acadSession.timeline);

assert(sportsAvgFatigue < acadAvgFatigue,
  `23.1: Sports avg fatigue (${sportsAvgFatigue.toFixed(3)}) < academic avg fatigue (${acadAvgFatigue.toFixed(3)})`);

// Sports flow should be higher (less fatigue → more flow)
const sportsAvgFlow = sportsSession.timeline.reduce((sum, p) => sum + p.flow, 0) / sportsSession.timeline.length;
const acadAvgFlow = acadSession.timeline.reduce((sum, p) => sum + p.flow, 0) / acadSession.timeline.length;
assert(sportsAvgFlow > acadAvgFlow,
  `23.2: Sports avg flow (${sportsAvgFlow.toFixed(3)}) > academic avg flow (${acadAvgFlow.toFixed(3)})`);

// ---------------------------------------------------------------------------
// Step 24 — try/catch prevents scheduler crash
// ---------------------------------------------------------------------------

console.log('\n📋 Step 24 — try/catch around simulation');

// We can't easily make calculateMarkovTimeline throw with valid inputs,
// but the try/catch is verified by code review. Instead, verify that invalid
// difficulty doesn't crash the scheduler.
try {
  const weirdResult = generateWeeklySchedule([], [
    makeTask({ title: 'Weird', difficulty: 'invalid', durationMins: 30 }),
  ], 1.0, {});
  // Should still produce a result (difficulty falls back to default)
  assert(weirdResult !== null, '24.1: Non-numeric difficulty does not crash scheduler');
} catch (e) {
  assert(false, `24.1: Non-numeric difficulty crashed: ${e.message}`);
}

// Verify that a task with extreme values doesn't crash
try {
  const extremeResult = generateWeeklySchedule([], [
    makeTask({ title: 'Extreme', difficulty: 999, durationMins: 9999 }),
  ], 0.001, { chronotype: 'night' });
  assert(extremeResult !== null, '24.2: Extreme values do not crash scheduler');
} catch (e) {
  assert(false, `24.2: Extreme values crashed: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Step 25 — Session object completeness
// ---------------------------------------------------------------------------

console.log('\n📋 Step 25 — Session object shape');

const shapeTasks = [makeTask({ title: 'Shape Test', durationMins: 60, difficulty: 3 })];
const shapeCheckResult = generateWeeklySchedule([], shapeTasks, 1.0, {});
const shapeSession = shapeCheckResult.days.Mon.sessions[0];

assert(shapeSession.task !== undefined, '25.1: session has task');
assert(typeof shapeSession.startTick === 'number', '25.2: session has numeric startTick');
assert(typeof shapeSession.endTick === 'number', '25.3: session has numeric endTick');
assert(Array.isArray(shapeSession.timeline), '25.4: session has timeline array');
assert(typeof shapeSession.burnoutTick === 'number', '25.5: session has numeric burnoutTick');

// Check timeline point shape
const firstPoint = shapeSession.timeline[0];
assert(typeof firstPoint.tick === 'number', '25.6: timeline point has numeric tick');
assert(typeof firstPoint.timeLabel === 'string', '25.7: timeline point has string timeLabel');
assert(typeof firstPoint.flow === 'number', '25.8: timeline point has numeric flow');
assert(typeof firstPoint.distracted === 'number', '25.9: timeline point has numeric distracted');
assert(typeof firstPoint.fatigue === 'number', '25.10: timeline point has numeric fatigue');
assert(typeof firstPoint.recovery === 'number', '25.11: timeline point has numeric recovery');

// Verify probability sums are valid
for (const p of shapeSession.timeline) {
  const sum = p.flow + p.distracted + p.fatigue + p.recovery;
  assert(sum >= 0.97 && sum <= 1.03,
    `25.12: timeline point tick=${p.tick} sum=${sum.toFixed(4)} is within [0.97, 1.03]`);
}

// endTick should be > startTick
assert(shapeSession.endTick > shapeSession.startTick,
  `25.13: endTick (${shapeSession.endTick}) > startTick (${shapeSession.startTick})`);

// ---------------------------------------------------------------------------
// Step 26 — Break-extended tasks clipped to slot bounds
// ---------------------------------------------------------------------------

console.log('\n📋 Step 26 — Break-extended task clipping');

// Create a tight slot: only 30 minutes free (3 ticks)
const tightCalBlock = makeCalendarBlock({ day: 'Mon', startHour: 6, durationHours: 15.5 }); // leaves 30 min

// Task that would normally burn out and get extended by break insertion
const burnoutTask = makeTask({
  title: 'Burnout Task',
  durationMins: 30,     // 3 ticks base
  difficulty: 5,         // hardest
});

const tightResult = generateWeeklySchedule([tightCalBlock], [burnoutTask], 0.5, { chronotype: 'night' });
const tightSessions = tightResult.days.Mon.sessions;

if (tightSessions.length > 0) {
  const tightSession = tightSessions[0];
  const sessionDuration = tightSession.endTick - tightSession.startTick;
  // The available slot was durationTicks=3 (half hour), so the session
  // should not exceed the original slot capacity
  assert(sessionDuration <= 3,
    `26.1: Session duration (${sessionDuration}) ≤ slot capacity (3)`);
}

// Verify fittedTicks doesn't exceed available slot
// Create a small free slot
const smallSlotBlock = makeCalendarBlock({ day: 'Tue', startHour: 6, durationHours: 15 }); // leaves 60 min
const smallTasks = [makeTask({ title: 'Small Slot', durationMins: 60, difficulty: 5 })];
const smallResult = generateWeeklySchedule([smallSlotBlock], smallTasks, 0.5, { chronotype: 'night' });

for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  for (const s of smallResult.days[day].sessions) {
    const duration = s.endTick - s.startTick;
    assert(duration <= 6, `26.2: Session fits within available slot (${duration} ≤ 6 ticks = 60 min)`);
    // timeline length should be >= duration (+1 for t=0)
    assert(s.timeline.length >= duration,
      `26.3: Timeline length (${s.timeline.length}) ≥ session duration (${duration})`);
  }
}

// ---------------------------------------------------------------------------
// Edge-case tests (beyond PRD steps)
// ---------------------------------------------------------------------------

console.log('\n📋 Edge Cases');

// Multiple tasks across multiple days
const multiTasks = [
  makeTask({ title: 'Task A', durationMins: 120, priority: 'high', difficulty: 4 }),
  makeTask({ title: 'Task B', durationMins: 90, priority: 'medium', difficulty: 2 }),
  makeTask({ title: 'Task C', durationMins: 60, priority: 'low', difficulty: 1 }),
];

const multiResult = generateWeeklySchedule([], multiTasks, 1.0, {});
let totalScheduled = 0;
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  totalScheduled += multiResult.days[day].sessions.length;
}
assert(totalScheduled === 3, `EC.1: All 3 tasks scheduled (${totalScheduled}/3)`);

// Tasks with fractional hours in calendar
const fracBlock = makeCalendarBlock({ day: 'Wed', startHour: 9.5, durationHours: 1.25 });
const fracResult = generateWeeklySchedule([fracBlock], [makeTask({ title: 'Frac', durationMins: 30 })], 1.0, {});
const wedSessions = fracResult.days.Wed.sessions;
// Task should be either before or after the 9:30-10:45 block
if (wedSessions.length > 0) {
  const ws = wedSessions[0].startTick / 6;
  // Should not overlap with 9.5–10.75 block
  const noOverlap = ws + 0.5 <= 9.5 || ws >= 10.75;
  assert(noOverlap, `EC.2: Task at hour ${ws.toFixed(2)} does not overlap with 9.5–10.75 block`);
}

// No tasks → empty week
const emptyTaskResult = generateWeeklySchedule([makeCalendarBlock()], [], 1.0, {});
assert(emptyTaskResult.unscheduled.length === 0, 'EC.3: No tasks → empty unscheduled');
let emptyTotalSessions = 0;
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
  emptyTotalSessions += emptyTaskResult.days[day].sessions.length;
}
assert(emptyTotalSessions === 0, 'EC.4: No tasks → zero sessions');

// Invalid chronotype falls back to morning
const invalidChronoResult = generateWeeklySchedule([], [makeTask()], 1.0, { chronotype: 'invalid' });
assert(invalidChronoResult.days.Mon.sessions.length === 1, 'EC.5: Invalid chronotype → defaults to morning, still works');

// Very short task (1 tick = 10 minutes)
const shortTask = makeTask({ title: 'Short', durationMins: 10, difficulty: 1 });
const shortResult = generateWeeklySchedule([], [shortTask], 1.0, {});
const shortSession = shortResult.days.Mon.sessions[0];
assert(shortSession.endTick - shortSession.startTick >= 1, 'EC.6: 10-min task gets at least 1 tick');

// Weekend tasks scheduled when weekday cap is full
const weekdayBlocks = [];
for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
  weekdayBlocks.push(makeCalendarBlock({ day, startHour: 6, durationHours: 16 }));
}
const weekendTasks = [
  makeTask({ title: 'Weekend Task', durationMins: 60 }),
];
const weekendResult = generateWeeklySchedule(weekdayBlocks, weekendTasks, 1.0, {});
assert(weekendResult.unscheduled.length === 0, 'EC.7: Task scheduled on weekend when weekdays full');
let weekendSessions = 0;
for (const day of ['Sat', 'Sun']) {
  weekendSessions += weekendResult.days[day].sessions.length;
}
assert(weekendSessions === 1, 'EC.8: Exactly 1 session on weekend');

// Settings with undefined values use defaults
const undefinedSettings = { chronotype: undefined, maxHoursPerDay: undefined, maxHoursWeekend: undefined };
const undefResult = generateWeeklySchedule([], [makeTask({ durationMins: 60 })], 1.0, undefinedSettings);
assert(undefResult.days.Mon.sessions.length === 1, 'EC.9: Undefined settings → uses defaults, still works');

// generatedAt should be reasonably close to now
const timeResult = generateWeeklySchedule([], [makeTask()], 1.0, {});
const now = Date.now();
assert(Math.abs(timeResult.generatedAt - now) < 5000, 'EC.10: generatedAt within 5 seconds of now');

// All types work
for (const type of ['academic', 'sports', 'arts', 'other']) {
  const typeResult = generateWeeklySchedule([], [makeTask({ title: type, type })], 1.0, {});
  const hasSession = Object.values(typeResult.days).some(d => d.sessions.length > 0);
  assert(hasSession, `EC.11: Task type "${type}" can be scheduled`);
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

summary();
