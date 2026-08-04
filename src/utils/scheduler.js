/**
 * MindFlow Smart Scheduler
 *
 * Takes calendar blocks + tasks + calibration + settings and produces a
 * complete OptimizedWeek. Uses global best-fit slot matching (not greedy
 * Monday-first), respects daily caps, applies chronotype-aware gamma
 * curves, enforces deadlines, distributes workload across days, and
 * inserts recovery buffers after burnout.
 *
 * @module scheduler
 */

import { calculateMarkovTimeline, findBurnoutTick, optimizeWithBreak } from './markovEngine.js';

// -- Constants ---------------------------------------------------------------

const TYPE_PROFILES = {
  academic:  { gammaBoost: 1.0, sortOrder: 0 },
  sports:    { gammaBoost: 0.7, sortOrder: 2 },
  arts:      { gammaBoost: 0.9, sortOrder: 1 },
  other:     { gammaBoost: 1.0, sortOrder: 1 },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const DAY_START_TICK = 36;       // 6:00 AM
const DAY_END_TICK = 132;        // 10:00 PM
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKEND_DAYS = new Set(['Sat', 'Sun']);
const DAY_INDEX = Object.fromEntries(ALL_DAYS.map((d, i) => [d, i]));

const GAP_TICKS = 1;             // 10-minute break between consecutive sessions
const RECOVERY_TICKS = 2;        // 20-minute forced rest after burnout

// -- Chronotype-aware gamma --------------------------------------------------

/**
 * Compute the circadian fatigue multiplier for a given clock hour and
 * chronotype.  Lower gamma → less fatigue → better study time.
 *
 * @param {number} hour       Clock hour (0–24, fractional OK)
 * @param {string} chronotype 'morning' | 'neutral' | 'night'
 * @returns {number} gamma in [1.0, 1.25]
 */
export function gammaForHour(hour, chronotype = 'morning') {
  const shift = chronotype === 'neutral' ? 2 : chronotype === 'night' ? 4 : 0;
  const adjusted = (hour - shift + 24) % 24;
  if (adjusted >= 22 || adjusted < 6) return 1.25;   // deep night
  if (adjusted >= 20) return 1.15;                     // evening dip
  if (adjusted >= 14) return 1.05;                     // afternoon dip
  return 1.0;                                           // peak alertness
}

// -- Task sorting ------------------------------------------------------------

/**
 * Sort tasks by: priority → deadline proximity → type → difficulty.
 * This determines the order tasks are placed into the schedule.
 *
 * @param {Task[]} tasks
 * @returns {Task[]} new sorted array (does not mutate input)
 */
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    // 1. Priority: high > medium > low
    const pa = PRIORITY_ORDER[a.priority || 'medium'];
    const pb = PRIORITY_ORDER[b.priority || 'medium'];
    if (pa !== pb) return pa - pb;

    // 2. Deadline: tasks WITH deadlines before those without
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;

    // 3. Earlier deadline first
    if (a.deadline && b.deadline) {
      const da = new Date(a.deadline);
      const db = new Date(b.deadline);
      if (isNaN(da.getTime())) return 1;   // invalid → push to end
      if (isNaN(db.getTime())) return -1;
      if (da < db) return -1;
      if (da > db) return 1;
    }

    // 4. Task type sort order
    const oa = (TYPE_PROFILES[a.type] || TYPE_PROFILES.other).sortOrder;
    const ob = (TYPE_PROFILES[b.type] || TYPE_PROFILES.other).sortOrder;
    if (oa !== ob) return oa - ob;

    // 5. Harder tasks first (they need the freshest slots)
    return (b.difficulty || 3) - (a.difficulty || 3);
  });
}

// -- Slot computation --------------------------------------------------------

/**
 * Compute free time slots for a single day given its calendar blocks.
 * Returns an array of contiguous free periods between DAY_START and DAY_END.
 * Overlapping blocks are handled correctly (merged).
 *
 * @param {CalendarBlock[]} blocksForDay
 * @returns {{ startTick: number, endTick: number, startHour: number,
 *             durationTicks: number, durationHours: number }[]}
 */
export function findFreeSlots(blocksForDay) {
  if (!blocksForDay || blocksForDay.length === 0) {
    const dur = DAY_END_TICK - DAY_START_TICK;
    return [{
      startTick: DAY_START_TICK,
      endTick: DAY_END_TICK,
      startHour: 6,
      durationTicks: dur,
      durationHours: dur / 6,
    }];
  }

  // Sort by start hour, then merge overlapping blocks
  const sorted = [...blocksForDay].sort((a, b) => (a.startHour || 0) - (b.startHour || 0));
  const merged = [];
  for (const b of sorted) {
    const bs = Math.max(DAY_START_TICK, Math.round((b.startHour || 0) * 6));
    const be = Math.min(DAY_END_TICK, Math.round(((b.startHour || 0) + (b.durationHours || 0)) * 6));
    if (merged.length > 0 && bs <= merged[merged.length - 1].end) {
      // Overlaps with previous block — merge
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, be);
    } else {
      merged.push({ start: bs, end: be });
    }
  }

  // Extract free gaps between merged blocks
  const slots = [];
  let cur = DAY_START_TICK;
  for (const m of merged) {
    if (m.start > cur) {
      const d = m.start - cur;
      slots.push({
        startTick: cur,
        endTick: m.start,
        startHour: cur / 6,
        durationTicks: d,
        durationHours: d / 6,
      });
    }
    cur = Math.max(cur, m.end);
  }
  if (cur < DAY_END_TICK) {
    const d = DAY_END_TICK - cur;
    slots.push({
      startTick: cur,
      endTick: DAY_END_TICK,
      startHour: cur / 6,
      durationTicks: d,
      durationHours: d / 6,
    });
  }

  return slots;
}

// -- Week helpers ------------------------------------------------------------

function createEmptyWeek() {
  const days = {};
  ALL_DAYS.forEach(d => {
    days[d] = { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 };
  });
  return { days, unscheduled: [], generatedAt: Date.now(), stats: null };
}

function formatTickLabel(tick) {
  const m = tick * 10;
  return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`;
}

/**
 * Convert an ISO date string to the corresponding day-of-week abbreviation.
 * Returns null if the date string is invalid or missing.
 *
 * @param {string|null} isoDate
 * @returns {string|null} 'Mon'–'Sun' or null
 */
function deadlineToDay(isoDate) {
  if (!isoDate) return null;
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return null;
    const dayIdx = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // Map JS getDay() to our ALL_DAYS: Sun→6, Mon→0, Tue→1, ...
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return map[dayIdx];
  } catch {
    return null;
  }
}

/**
 * Check whether a task's deadline allows it to be scheduled on a given day.
 * Tasks without deadlines can be scheduled any day.
 *
 * @param {Task} task
 * @param {string} day  'Mon'–'Sun'
 * @returns {boolean}
 */
function deadlineAllowsDay(task, day) {
  const deadlineDay = deadlineToDay(task.deadline);
  if (!deadlineDay) return true; // no deadline — any day is fine
  return DAY_INDEX[day] <= DAY_INDEX[deadlineDay];
}

// -- Schedule quality metrics ------------------------------------------------

function computeStats(week, tasks, settings) {
  let totalScheduledMins = 0;
  let totalFlowMins = 0;
  let totalBurnoutCount = 0;
  const dayUtilization = {};
  let daysUsed = 0;

  const s = settings || {};
  const maxWeekday = s.maxHoursPerDay ?? 8;
  const maxWeekend = s.maxHoursWeekend ?? 4;

  for (const day of ALL_DAYS) {
    const dd = week.days[day];
    const cap = WEEKEND_DAYS.has(day) ? maxWeekend : maxWeekday;
    let dayTicks = 0;
    for (const s of dd.sessions) {
      dayTicks += (s.endTick - s.startTick);
    }
    totalScheduledMins += dayTicks * 10;
    totalFlowMins += dd.totalFlowMins;
    totalBurnoutCount += dd.burnoutCount;
    dayUtilization[day] = cap > 0 ? (dayTicks / (cap * 6)) : 0;
    if (dd.sessions.length > 0) daysUsed++;
  }

  const totalTaskMins = tasks.reduce((sum, t) => sum + (t.durationMins || 0), 0);
  const utilizationPct = totalTaskMins > 0
    ? Math.round((totalScheduledMins / totalTaskMins) * 100)
    : 100;

  // Workload balance: lower stddev = more evenly distributed
  const utils = Object.values(dayUtilization);
  const avgUtil = utils.reduce((a, b) => a + b, 0) / utils.length;
  const variance = utils.reduce((sum, u) => sum + (u - avgUtil) ** 2, 0) / utils.length;
  const workloadBalance = Math.round((1 - Math.sqrt(variance)) * 100);

  // Average fatigue across all scheduled sessions
  let totalFatiguePts = 0;
  let totalTimelinePts = 0;
  for (const day of ALL_DAYS) {
    for (const s of week.days[day].sessions) {
      for (const p of s.timeline) {
        totalFatiguePts += p.fatigue;
        totalTimelinePts++;
      }
    }
  }
  const avgFatigue = totalTimelinePts > 0
    ? Math.round((totalFatiguePts / totalTimelinePts) * 1000) / 10
    : 0;

  return {
    totalScheduledMins,
    totalScheduledHours: Math.round(totalScheduledMins / 6) / 10,
    totalFlowMins,
    totalBurnoutCount,
    unscheduledCount: week.unscheduled.length,
    utilizationPct,
    daysUsed,
    workloadBalance,       // 0–100, higher = more balanced
    avgFatigue,            // 0–100, average fatigue probability in %
    dayUtilization,        // { Mon: 0.0–1.0, ... }
  };
}

// -- Main scheduler ----------------------------------------------------------

/**
 * Generate a complete optimized weekly schedule.
 *
 * @param {CalendarBlock[]} calendarBlocks  Fixed weekly commitments
 * @param {Task[]}          tasks           Tasks to schedule
 * @param {number}          alpha           Cognitive calibration score (0.5–1.5)
 * @param {UserSettings}    settings        User preferences
 * @returns {OptimizedWeek}
 */
export default function generateWeeklySchedule(
  calendarBlocks = [], tasks = [], alpha = 1.0, settings = {}
) {
  const week = createEmptyWeek();
  const s = settings || {};
  const taskList = (tasks || []).filter(t => t && t.durationMins > 0);
  if (taskList.length === 0) {
    week.stats = computeStats(week, [], s);
    return week;
  }

  const blockList = (calendarBlocks || []).filter(b => b);
  const chronotype = s.chronotype || 'morning';
  const maxWeekday = s.maxHoursPerDay ?? 8;
  const maxWeekend = s.maxHoursWeekend ?? 4;

  // Group calendar blocks by day
  const blocksByDay = {};
  ALL_DAYS.forEach(d => { blocksByDay[d] = blockList.filter(b => b.day === d); });

  // Phase 1: sort tasks by priority/deadline/type/difficulty
  const sorted = sortTasks(taskList);
  const unscheduled = [];

  // Collect all free slots across all 7 days
  const allSlots = [];
  for (const day of ALL_DAYS) {
    const capTicks = Math.round((WEEKEND_DAYS.has(day) ? maxWeekend : maxWeekday) * 6);
    for (const slot of findFreeSlots(blocksByDay[day])) {
      allSlots.push({ ...slot, day, maxTicks: capTicks, usedTicks: 0 });
    }
  }

  // Guard: no free slots at all (calendar completely full)
  if (allSlots.length === 0) {
    week.unscheduled = [...sorted];
    week.stats = computeStats(week, sorted, s);
    return week;
  }

  // Track per-day usage for workload distribution scoring
  const dayUsedTicks = {};
  ALL_DAYS.forEach(d => { dayUsedTicks[d] = 0; });

  // Phase 2: assign each task to its best slot
  for (const task of sorted) {
    const taskTicks = Math.ceil((task.durationMins || 30) / 10);
    const profile = TYPE_PROFILES[task.type] || TYPE_PROFILES.other;

    let bestSlot = null;
    let bestScore = Infinity;

    for (const slot of allSlots) {
      // Capacity check
      if (slot.usedTicks >= slot.maxTicks) continue;

      // Size check: task must fit in remaining slot space
      if (taskTicks > slot.durationTicks) continue;

      // Deadline check: task due Wednesday cannot be placed Thursday+
      if (!deadlineAllowsDay(task, slot.day)) continue;

      // Compute slot score: lower is better
      const hour = slot.startHour + (slot.usedTicks / 6);
      const gamma = gammaForHour(hour, chronotype) * profile.gammaBoost;
      const weekendPenalty = WEEKEND_DAYS.has(slot.day) ? 0.3 : 0;

      // Congestion penalty: prefer less-crowded days (spread workload)
      const dayCap = WEEKEND_DAYS.has(slot.day) ? maxWeekend : maxWeekday;
      const congestion = dayCap > 0 ? (dayUsedTicks[slot.day] / (dayCap * 6)) : 0;
      const congestionPenalty = congestion * 0.5;

      // Position-in-slot tiebreaker (prefer earlier positions in the same slot)
      const positionPenalty = slot.usedTicks / 1000;

      const score = gamma + weekendPenalty + congestionPenalty + positionPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    // No eligible slot found — task cannot be scheduled
    if (!bestSlot) {
      unscheduled.push(task);
      continue;
    }

    // Place the task in its best slot
    const absStart = bestSlot.startTick + bestSlot.usedTicks;
    const gamma = gammaForHour(absStart / 6, chronotype) * profile.gammaBoost;

    try {
      // Run Markov simulation
      let timeline = calculateMarkovTimeline(alpha, task.difficulty || 3, gamma, taskTicks);
      let burnoutTick = findBurnoutTick(timeline, 0.50);

      // Insert recovery break if burnout is predicted
      if (burnoutTick > 0) {
        const opt = optimizeWithBreak(alpha, task.difficulty || 3, gamma, taskTicks, burnoutTick);
        timeline = opt.optimized;
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }

      const actualTicks = timeline.length - 1;

      // If break insertion extended the task beyond the slot, fall back
      // to the non-break timeline
      if (actualTicks > bestSlot.durationTicks) {
        timeline = calculateMarkovTimeline(alpha, task.difficulty || 3, gamma, taskTicks);
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }

      // Clip to slot boundary
      const fittedTicks = Math.min(timeline.length - 1, bestSlot.durationTicks);

      // Clip timeline to match fittedTicks so stored data is consistent
      if (timeline.length - 1 > fittedTicks) {
        timeline = timeline.slice(0, fittedTicks + 1);
      }

      // Compute session metrics
      let burnoutCount = 0;
      let flowMins = 0;
      for (const p of timeline) {
        if (p.fatigue > 0.50) burnoutCount++;
        flowMins += p.flow * 10;
      }

      // Store the session
      week.days[bestSlot.day].sessions.push({
        task,
        startTick: absStart,
        endTick: absStart + fittedTicks,
        timeline,
        burnoutTick,
      });
      week.days[bestSlot.day].totalFlowMins += Math.round(flowMins);
      if (burnoutTick > 0) {
        week.days[bestSlot.day].burnoutCount += 1;
      }

      // Update slot consumption
      const totalConsumed = fittedTicks + GAP_TICKS;
      bestSlot.usedTicks += totalConsumed;
      bestSlot.durationTicks -= totalConsumed;
      bestSlot.startHour = bestSlot.startTick / 6;

      // Track per-day usage for workload distribution
      dayUsedTicks[bestSlot.day] += totalConsumed;

      // If burnout occurred, add extra recovery buffer
      if (burnoutTick > 0) {
        bestSlot.usedTicks += RECOVERY_TICKS;
        bestSlot.durationTicks -= RECOVERY_TICKS;
        dayUsedTicks[bestSlot.day] += RECOVERY_TICKS;
      }
    } catch (err) {
      console.error(`Scheduler: failed to simulate task "${task.title}"`, err);
      unscheduled.push(task);
    }
  }

  // Phase 3: refinement — try to fit unscheduled tasks by relaxing
  // constraints (skip workload balance, allow weekend)
  if (unscheduled.length > 0) {
    const stillUnschedule = [];
    for (const task of unscheduled) {
      const taskTicks = Math.ceil((task.durationMins || 30) / 10);
      const profile = TYPE_PROFILES[task.type] || TYPE_PROFILES.other;

      let bestSlot = null;
      let bestScore = Infinity;

      for (const slot of allSlots) {
        if (slot.usedTicks >= slot.maxTicks) continue;
        if (taskTicks > slot.durationTicks) continue;
        if (!deadlineAllowsDay(task, slot.day)) continue;

        // In refinement, only consider gamma (ignore congestion)
        const hour = slot.startHour + (slot.usedTicks / 6);
        const gamma = gammaForHour(hour, chronotype) * profile.gammaBoost;
        const score = gamma + (slot.usedTicks / 1000);

        if (score < bestScore) { bestScore = score; bestSlot = slot; }
      }

      if (!bestSlot) {
        stillUnschedule.push(task);
        continue;
      }

      // Try to fit (same logic as Phase 2, but with the relaxed scoring)
      const absStart = bestSlot.startTick + bestSlot.usedTicks;
      const gamma = gammaForHour(absStart / 6, chronotype) * profile.gammaBoost;

      try {
        let timeline = calculateMarkovTimeline(alpha, task.difficulty || 3, gamma, taskTicks);
        let burnoutTick = findBurnoutTick(timeline, 0.50);

        if (burnoutTick > 0) {
          const opt = optimizeWithBreak(alpha, task.difficulty || 3, gamma, taskTicks, burnoutTick);
          timeline = opt.optimized;
          burnoutTick = findBurnoutTick(timeline, 0.50);
        }

        if ((timeline.length - 1) > bestSlot.durationTicks) {
          timeline = calculateMarkovTimeline(alpha, task.difficulty || 3, gamma, taskTicks);
          burnoutTick = findBurnoutTick(timeline, 0.50);
        }

        const fittedTicks = Math.min(timeline.length - 1, bestSlot.durationTicks);
        if (timeline.length - 1 > fittedTicks) {
          timeline = timeline.slice(0, fittedTicks + 1);
        }

        let bc = 0, fm = 0;
        for (const p of timeline) { if (p.fatigue > 0.50) bc++; fm += p.flow * 10; }

        week.days[bestSlot.day].sessions.push({
          task, startTick: absStart, endTick: absStart + fittedTicks,
          timeline, burnoutTick,
        });
        week.days[bestSlot.day].totalFlowMins += Math.round(fm);
        if (burnoutTick > 0) week.days[bestSlot.day].burnoutCount += 1;

        const totalConsumed = fittedTicks + GAP_TICKS;
        bestSlot.usedTicks += totalConsumed;
        bestSlot.durationTicks -= totalConsumed;
        bestSlot.startHour = bestSlot.startTick / 6;
        dayUsedTicks[bestSlot.day] += totalConsumed;

        if (burnoutTick > 0) {
          bestSlot.usedTicks += RECOVERY_TICKS;
          bestSlot.durationTicks -= RECOVERY_TICKS;
          dayUsedTicks[bestSlot.day] += RECOVERY_TICKS;
        }
      } catch (err) {
        console.error(`Scheduler refinement: failed for "${task.title}"`, err);
        stillUnschedule.push(task);
      }
    }
    week.unscheduled = stillUnschedule;
  } else {
    week.unscheduled = [];
  }

  // Build daily aggregate fatigue curves
  for (const day of ALL_DAYS) {
    const dd = week.days[day];
    if (dd.sessions.length === 0) continue;
    const agg = [];
    let off = 0;
    for (const s of dd.sessions) {
      for (const p of s.timeline) {
        agg.push({ ...p, tick: off + p.tick, timeLabel: formatTickLabel(off + p.tick) });
      }
      off += s.timeline.length;
    }
    dd.fatigueCurve = agg;
  }

  // Compute schedule quality statistics
  week.stats = computeStats(week, sorted, s);

  return week;
}

export { ALL_DAYS, DAY_START_TICK, DAY_END_TICK, WEEKEND_DAYS, GAP_TICKS, RECOVERY_TICKS };
