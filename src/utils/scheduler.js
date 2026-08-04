/**
 * MindFlow Smart Scheduler
 *
 * Takes calendar blocks + tasks + calibration + settings and produces a
 * complete OptimizedWeek.
 *
 * Mathematical foundation:
 *   - Borbély's Two-Process Model (Process C + Process S)
 *   - Continuous cosine-based circadian rhythm
 *   - Exponential homeostatic sleep pressure with break decay
 *   - Cumulative cognitive strain → effective alpha degradation
 *   - Non-linear slot scoring with fatigue acceleration
 *
 * @module scheduler
 */

import {
  calculateMarkovTimeline,
  findBurnoutTick,
  optimizeWithBreak,
  computeOptimalBreakDuration,
} from './markovEngine.js';

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

// Cross-day fatigue carryover
const CROSS_DAY_CARRYOVER = 0.30; // 30% of strain carries to next day
const OVERNIGHT_RECOVERY_HOURS = 8; // assumed hours of sleep/rest between days

// Task sequencing
const SEQUENCING_BONUS = 0.15;    // score reduction for alternating task types
const FLOW_BLOCK_MIN_TICKS = 6;   // 60 min minimum for flow-block bonus
const FLOW_BLOCK_BONUS = 0.10;    // score reduction per additional hour of continuous block

// Deadline pressure
const DEADLINE_PRESSURE_BOOST = 0.20; // max 20% alpha boost near deadline
const DEADLINE_PRESSURE_DAYS = 2;     // pressure kicks in within 2 days of deadline

// Two-Process Model parameters (Borbély, 1982)
const TAU_BUILD = 14.4;          // hours — homeostatic buildup time constant
const TAU_DECAY = 2.0;           // hours — recovery decay time constant
const CIRCADIAN_AMPLITUDE = 0.25; // max gamma boost at circadian trough
const PROCESS_S_WEIGHT = 0.50;   // weight of Process S in alertness score

// Cumulative strain parameters
const MAX_STRAIN_PER_DAY = 1.0;  // normalized max cognitive strain per day
const STRAIN_DECAY_FACTOR = 0.08; // how much accumulated strain reduces effective alpha

// Chronotype acrophases (peak alertness hour, 24h clock)
const ACROPHASE = {
  morning: 10,   // peak at 10:00 AM
  neutral: 12,   // peak at 12:00 PM
  night:   14,   // peak at 2:00 PM
};

// ===========================================================================
// Process C — Circadian Alertness Rhythm
// ===========================================================================

/**
 * Continuous cosine-based circadian alertness model.
 *
 * Core formula:
 *   C(h) = cos(2π × (adjusted_hour - φ) / 24)
 *
 * where φ (acrophase) is the chronotype-dependent peak alertness hour.
 * C(h) ∈ [-1, 1]: +1 at peak alertness, -1 at circadian trough.
 *
 * @param {number} hour       Clock hour (fractional OK, e.g. 13.5 = 1:30 PM)
 * @param {string} chronotype 'morning' | 'neutral' | 'night'
 * @returns {number} C(h) ∈ [-1, 1]
 */
export function processC(hour, chronotype = 'morning') {
  const phi = ACROPHASE[chronotype] || 10;
  // Circular distance from acrophase, normalized to [0, 24)
  const theta = (2 * Math.PI * ((hour - phi + 24) % 24)) / 24;
  return Math.cos(theta);
}

/**
 * Circadian fatigue multiplier derived from Process C.
 *
 * At peak alertness (C=1):  gamma = 1.00  (no fatigue boost)
 * At circadian trough (C=-1): gamma = 1.25 (max fatigue boost)
 *
 * Formula:  γ(h) = 1.0 + A × (1 − C(h)) / 2
 * where A = CIRCADIAN_AMPLITUDE = 0.25
 *
 * @param {number} hour       Clock hour (fractional OK)
 * @param {string} chronotype 'morning' | 'neutral' | 'night'
 * @returns {number} gamma ∈ [1.0, 1.25]
 */
export function circadianGamma(hour, chronotype = 'morning') {
  const C = processC(hour, chronotype);
  return 1.0 + CIRCADIAN_AMPLITUDE * (1 - C) / 2;
}

// Keep backward-compatible alias
export { circadianGamma as gammaForHour };

// ===========================================================================
// Process S — Homeostatic Sleep Pressure
// ===========================================================================

/**
 * Homeostatic sleep pressure (Process S) — the "tiredness" that builds
 * during wakefulness and decays during rest.
 *
 * Buildup (during work):
 *   S_build(t) = 1 − exp(−t / τ_build)
 *
 * Decay (during break):
 *   S(t) = S_0 × exp(−t_break / τ_decay)
 *
 * Combined:
 *   S(t_awake, t_break) = (1 − exp(−t_awake / τ_build)) × exp(−t_break / τ_decay)
 *
 * @param {number} timeAwakeHours   Hours spent in cognitive work
 * @param {number} breakMinutes     Minutes of continuous rest before this point
 * @returns {number} S ∈ [0, 1]
 */
export function processS(timeAwakeHours, breakMinutes = 0) {
  const S_build = 1 - Math.exp(-timeAwakeHours / TAU_BUILD);
  const S_decay = Math.exp(-breakMinutes / 60 / TAU_DECAY);
  return S_build * S_decay;
}

/**
 * Break duration needed to reduce Process S to a target level.
 * Inverts the decay formula:  t = −τ_decay × ln(target / S_current)
 *
 * @param {number} currentS    Current Process S value [0, 1]
 * @param {number} targetS     Desired Process S value [0, 1]
 * @returns {number} Minutes of break needed
 */
export function requiredBreakMinutes(currentS, targetS = 0.3) {
  if (currentS <= targetS) return 0;
  if (currentS <= 0 || targetS <= 0) return 30; // degenerate case → 30 min default
  return Math.round(-TAU_DECAY * 60 * Math.log(targetS / currentS));
}

// ===========================================================================
// Two-Process Alertness Model
// ===========================================================================

/**
 * Combined alertness from the two-process model.
 *
 *   A(h, t_awake, t_break) = C(h) − w_s × S(t_awake, t_break)
 *
 * Range: approximately [−1.5, 1.0]
 *   +1.0 = peak alertness (well-rested at circadian peak)
 *   −1.5 = worst (high sleep pressure at circadian trough)
 *
 * @param {number} hour            Clock hour
 * @param {number} timeAwakeHours  Cognitive work hours accumulated
 * @param {number} breakMinutes    Minutes since last break
 * @param {string} chronotype      'morning' | 'neutral' | 'night'
 * @returns {number} Alertness A ∈ [−1.5, 1.0]
 */
export function alertness(hour, timeAwakeHours, breakMinutes, chronotype = 'morning') {
  const C = processC(hour, chronotype);
  const S = processS(timeAwakeHours, breakMinutes);
  return C - PROCESS_S_WEIGHT * S;
}

// ===========================================================================
// Cumulative Cognitive Strain
// ===========================================================================

/**
 * Compute how much cognitive strain a task contributes.
 *
 * Strain formula:
 *   Δstrain = (ticks × difficulty × gamma) / (maxDailyTicks × 5 × 1.25)
 *
 * Normalized so that 8 hours of difficulty-3 work at gamma=1.0
 * produces approximately 0.8 strain (80% of daily max).
 *
 * @param {number} ticks       Task duration in 10-min ticks
 * @param {number} difficulty  Task difficulty (1–5)
 * @param {number} gamma       Circadian gamma at task start
 * @param {number} maxTicks    Day's capacity in ticks
 * @returns {number} Strain contribution ∈ [0, 1]
 */
function strainContribution(ticks, difficulty, gamma, maxTicks) {
  const maxStrainPossible = maxTicks * 5 * 1.25; // worst case: max duration, diff=5, gamma=1.25
  if (maxStrainPossible <= 0) return 0;
  return (ticks * (difficulty || 3) * gamma) / maxStrainPossible;
}

/**
 * Effective alpha after accounting for accumulated cognitive strain.
 *
 *   α_eff = α × max(0.50, 1.0 − strain × decayFactor)
 *
 * At 100% strain:  α_eff = α × 0.50  (half effectiveness)
 * At 50% strain:   α_eff = α × 0.75
 * At 0% strain:    α_eff = α × 1.00
 *
 * @param {number} alpha       Base cognitive calibration score
 * @param {number} strain      Accumulated strain [0, 1]
 * @returns {number} Effective alpha
 */
function effectiveAlpha(alpha, strain) {
  return alpha * Math.max(0.50, 1.0 - strain * STRAIN_DECAY_FACTOR);
}

// ===========================================================================
// Task Sorting
// ===========================================================================

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority || 'medium'];
    const pb = PRIORITY_ORDER[b.priority || 'medium'];
    if (pa !== pb) return pa - pb;

    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;

    if (a.deadline && b.deadline) {
      const da = new Date(a.deadline), db = new Date(b.deadline);
      if (isNaN(da.getTime())) return 1;
      if (isNaN(db.getTime())) return -1;
      if (da < db) return -1;
      if (da > db) return 1;
    }

    const oa = (TYPE_PROFILES[a.type] || TYPE_PROFILES.other).sortOrder;
    const ob = (TYPE_PROFILES[b.type] || TYPE_PROFILES.other).sortOrder;
    if (oa !== ob) return oa - ob;

    return (b.difficulty || 3) - (a.difficulty || 3);
  });
}

// ===========================================================================
// Slot Computation (overlapping-block aware)
// ===========================================================================

export function findFreeSlots(blocksForDay) {
  if (!blocksForDay || blocksForDay.length === 0) {
    const dur = DAY_END_TICK - DAY_START_TICK;
    return [{
      startTick: DAY_START_TICK, endTick: DAY_END_TICK, startHour: 6,
      durationTicks: dur, durationHours: dur / 6,
    }];
  }

  const sorted = [...blocksForDay].sort((a, b) => (a.startHour || 0) - (b.startHour || 0));
  const merged = [];
  for (const b of sorted) {
    const bs = Math.max(DAY_START_TICK, Math.round((b.startHour || 0) * 6));
    const be = Math.min(DAY_END_TICK, Math.round(((b.startHour || 0) + (b.durationHours || 0)) * 6));
    if (merged.length > 0 && bs <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, be);
    } else {
      merged.push({ start: bs, end: be });
    }
  }

  const slots = [];
  let cur = DAY_START_TICK;
  for (const m of merged) {
    if (m.start > cur) {
      const d = m.start - cur;
      slots.push({
        startTick: cur, endTick: m.start, startHour: cur / 6,
        durationTicks: d, durationHours: d / 6,
      });
    }
    cur = Math.max(cur, m.end);
  }
  if (cur < DAY_END_TICK) {
    const d = DAY_END_TICK - cur;
    slots.push({
      startTick: cur, endTick: DAY_END_TICK, startHour: cur / 6,
      durationTicks: d, durationHours: d / 6,
    });
  }

  return slots;
}

// ===========================================================================
// Helpers
// ===========================================================================

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

function deadlineToDay(isoDate) {
  if (!isoDate) return null;
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return null;
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return map[d.getDay()];
  } catch {
    return null;
  }
}

function deadlineAllowsDay(task, day) {
  const deadlineDay = deadlineToDay(task.deadline);
  if (!deadlineDay) return true;
  return DAY_INDEX[day] <= DAY_INDEX[deadlineDay];
}

// ===========================================================================
// Slot Scoring — Two-Process Model
// ===========================================================================

/**
 * Score a candidate slot for a task using the two-process alertness model.
 *
 * Lower score = better slot. The score combines:
 *   1. Circadian gamma (Process C) at the proposed start hour
 *   2. Homeostatic pressure (Process S) based on time already spent that day
 *   3. Non-linear congestion penalty (squared — fatigue accelerates)
 *   4. Weekend penalty
 *   5. Recovery benefit from natural gaps between tasks
 *
 * Mathematically:
 *   score = γ × (1 + S) + β_congestion² × 0.8 + weekendPenalty + positionTiebreaker
 *
 * where S is Process S at the slot's start time, and congestion
 * penalty grows quadratically with utilization.
 *
 * @param {object} slot         Free slot with { day, startHour, usedTicks, durationTicks, maxTicks }
 * @param {object} profile      Task type profile { gammaBoost }
 * @param {string} chronotype   User chronotype
 * @param {number} dayStrain    Accumulated cognitive strain [0, 1] for this day
 * @param {number} timeAwakeHrs Hours of cognitive work already on this day
 * @param {number} breakMins    Minutes since last task ended on this day
 * @param {object} settings     User settings
 * @returns {number} Score (lower = better)
 */
function scoreSlot(slot, profile, chronotype, dayStrain, timeAwakeHrs, breakMins, settings,
                    lastTaskType = null, prevDayStrain = 0) {
  const hour = slot.startHour + (slot.usedTicks / 6);

  // Process C: circadian gamma
  const gamma = circadianGamma(hour, chronotype) * profile.gammaBoost;

  // Process S: homeostatic pressure
  const S = processS(timeAwakeHrs + (slot.usedTicks / 6), breakMins);

  // Combined fatigue factor: circadian × (1 + homeostatic)
  const fatigueFactor = gamma * (1 + S);

  // Non-linear congestion penalty: squared utilization
  const dayCap = WEEKEND_DAYS.has(slot.day)
    ? (settings.maxHoursWeekend ?? 4)
    : (settings.maxHoursPerDay ?? 8);
  const congestion = dayCap > 0
    ? (slot.usedTicks / (dayCap * 6))
    : 0;
  const congestionPenalty = congestion * congestion * 0.8;

  // Weekend penalty
  const weekendPenalty = WEEKEND_DAYS.has(slot.day) ? 0.3 : 0;

  // Cross-day carryover: previous day's strain bleeds into today's first slot
  const carryoverDecay = Math.exp(-OVERNIGHT_RECOVERY_HOURS / TAU_DECAY);
  const crossDayPenalty = prevDayStrain * CROSS_DAY_CARRYOVER * carryoverDecay
    * (1 - congestion); // diminishes as today fills up (strain already accounted)

  // Task sequencing: alternating task types improves recovery
  let sequencingScore = 0;
  if (lastTaskType && slot.usedTicks === 0) {
    const lastProfile = TYPE_PROFILES[lastTaskType] || TYPE_PROFILES.other;
    if (profile.gammaBoost === lastProfile.gammaBoost) {
      sequencingScore = SEQUENCING_BONUS; // same type → penalty
    } else {
      sequencingScore = -SEQUENCING_BONUS; // different type → bonus
    }
  }

  // Flow-block preference: bonus for extending an existing block
  let flowBlockScore = 0;
  if (slot.usedTicks >= FLOW_BLOCK_MIN_TICKS) {
    const extraHours = (slot.usedTicks - FLOW_BLOCK_MIN_TICKS) / 6;
    flowBlockScore = -FLOW_BLOCK_BONUS * Math.min(extraHours, 3);
  }

  // Position tiebreaker
  const positionTiebreaker = slot.usedTicks / 1000;

  return fatigueFactor + congestionPenalty + weekendPenalty + crossDayPenalty
       + sequencingScore + flowBlockScore + positionTiebreaker;
}

// ===========================================================================
// Schedule Quality Statistics
// ===========================================================================

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
    for (const sess of dd.sessions) {
      dayTicks += (sess.endTick - sess.startTick);
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

  const utils = Object.values(dayUtilization);
  const avgUtil = utils.reduce((a, b) => a + b, 0) / utils.length;
  const variance = utils.reduce((sum, u) => sum + (u - avgUtil) ** 2, 0) / utils.length;
  const workloadBalance = Math.round((1 - Math.sqrt(variance)) * 100);

  let totalFatiguePts = 0, totalTimelinePts = 0;
  for (const day of ALL_DAYS) {
    for (const sess of week.days[day].sessions) {
      for (const p of sess.timeline) {
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
    workloadBalance,
    avgFatigue,
    dayUtilization,
  };
}

// ===========================================================================
// Main Scheduler — Two-Process Model Driven
// ===========================================================================

/**
 * Generate a complete optimized weekly schedule.
 *
 * Algorithm (three phases):
 *
 * Phase 1 — Sort: tasks ordered by priority → deadline → type → difficulty
 *
 * Phase 2 — Primary placement: each task scores every eligible slot using
 *   the two-process alertness model (Process C + Process S). The slot with
 *   lowest score wins. Cumulative strain builds per day and degrades
 *   effective alpha for subsequent tasks.
 *
 * Phase 3 — Refinement: unscheduled tasks get a second pass with relaxed
 *   scoring (no congestion penalty, no weekend penalty).
 *
 * @param {CalendarBlock[]} calendarBlocks
 * @param {Task[]}          tasks
 * @param {number}          alpha      Cognitive calibration (0.5–1.5)
 * @param {UserSettings}    settings   Chronotype, daily caps
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

  const blocksByDay = {};
  ALL_DAYS.forEach(d => { blocksByDay[d] = blockList.filter(b => b.day === d); });

  const sorted = sortTasks(taskList);
  const unscheduled = [];

  // Collect all free slots
  const allSlots = [];
  for (const day of ALL_DAYS) {
    const capTicks = Math.round((WEEKEND_DAYS.has(day) ? maxWeekend : maxWeekday) * 6);
    for (const slot of findFreeSlots(blocksByDay[day])) {
      allSlots.push({ ...slot, day, maxTicks: capTicks, usedTicks: 0 });
    }
  }

  if (allSlots.length === 0) {
    week.unscheduled = [...sorted];
    week.stats = computeStats(week, sorted, s);
    return week;
  }

  // Per-day state for two-process model + cross-day carryover
  const dayAccumulatedStrain = {};   // cumulative cognitive strain [0, 1]
  const dayTimeAwakeTicks = {};       // total ticks of cognitive work done
  const dayLastTaskEndTick = {};      // tick when the last task ended (for break gap calc)
  const dayUsedTicks = {};
  const dayLastTaskType = {};         // last task type on each day (for sequencing)

  // Initialize per-day state
  // Cross-day carryover: strain from Mon bleeds into Tue, etc.
  // Computed dynamically during scheduling as strain accumulates
  ALL_DAYS.forEach(d => {
    dayAccumulatedStrain[d] = 0;
    dayTimeAwakeTicks[d] = 0;
    dayLastTaskEndTick[d] = DAY_START_TICK;
    dayUsedTicks[d] = 0;
    dayLastTaskType[d] = null;
  });

  // -- Phase 2: Primary placement -------------------------------------------

  for (const task of sorted) {
    const taskTicks = Math.ceil((task.durationMins || 30) / 10);
    const profile = TYPE_PROFILES[task.type] || TYPE_PROFILES.other;

    // Deadline pressure: alpha boost for tasks due within 2 days
    let deadlineAlphaBoost = 1.0;
    if (task.deadline) {
      const deadlineDay = deadlineToDay(task.deadline);
      if (deadlineDay) {
        const daysUntilDeadline = DAY_INDEX[deadlineDay] - DAY_INDEX.Mon; // simplified
        if (daysUntilDeadline >= 0 && daysUntilDeadline <= DEADLINE_PRESSURE_DAYS) {
          deadlineAlphaBoost = 1.0 + DEADLINE_PRESSURE_BOOST
            * (1 - daysUntilDeadline / DEADLINE_PRESSURE_DAYS);
        }
      }
    }

    let bestSlot = null;
    let bestScore = Infinity;

    for (const slot of allSlots) {
      if (slot.usedTicks >= slot.maxTicks) continue;
      if (taskTicks > slot.durationTicks) continue;
      if (!deadlineAllowsDay(task, slot.day)) continue;

      const ticksSinceLastTask = Math.max(0,
        (slot.startTick + slot.usedTicks) - dayLastTaskEndTick[slot.day]);
      const breakMinsSinceLastTask = ticksSinceLastTask * 10;
      const timeAwakeHrs = dayTimeAwakeTicks[slot.day] / 6;

      // Previous day's strain (for cross-day carryover)
      const prevDayIdx = DAY_INDEX[slot.day] - 1;
      const prevDay = prevDayIdx >= 0 ? ALL_DAYS[prevDayIdx] : null;
      const prevDayStrainVal = prevDay ? dayAccumulatedStrain[prevDay] : 0;

      const score = scoreSlot(
        slot, profile, chronotype,
        dayAccumulatedStrain[slot.day],
        timeAwakeHrs,
        breakMinsSinceLastTask,
        s,
        dayLastTaskType[slot.day],
        prevDayStrainVal,
      );

      if (score < bestScore) { bestScore = score; bestSlot = slot; }
    }

    if (!bestSlot) { unscheduled.push(task); continue; }

    // Place the task
    const absStart = bestSlot.startTick + bestSlot.usedTicks;
    const gamma = circadianGamma(absStart / 6, chronotype) * profile.gammaBoost;

    // Apply cumulative strain + deadline pressure to effective alpha
    const strainAlpha = effectiveAlpha(alpha, dayAccumulatedStrain[bestSlot.day]);
    const effAlpha = strainAlpha * deadlineAlphaBoost;

    try {
      let timeline = calculateMarkovTimeline(effAlpha, task.difficulty || 3, gamma, taskTicks);
      let burnoutTick = findBurnoutTick(timeline, 0.50);

      if (burnoutTick > 0) {
        // Compute optimal break duration from the engine's recovery model
        const optimalBreak = computeOptimalBreakDuration(timeline, burnoutTick, 0.30);
        const opt = optimizeWithBreak(effAlpha, task.difficulty || 3, gamma, taskTicks,
                                       burnoutTick, optimalBreak);
        timeline = opt.optimized;
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }

      if ((timeline.length - 1) > bestSlot.durationTicks) {
        timeline = calculateMarkovTimeline(effAlpha, task.difficulty || 3, gamma, taskTicks);
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

      // Update per-day state
      const totalConsumed = fittedTicks + GAP_TICKS;
      bestSlot.usedTicks += totalConsumed;
      bestSlot.durationTicks -= totalConsumed;
      bestSlot.startHour = bestSlot.startTick / 6;
      dayUsedTicks[bestSlot.day] += totalConsumed;

      // Accumulate cognitive strain
      const strain = strainContribution(
        fittedTicks, task.difficulty || 3, gamma, bestSlot.maxTicks,
      );
      dayAccumulatedStrain[bestSlot.day] = Math.min(
        MAX_STRAIN_PER_DAY,
        dayAccumulatedStrain[bestSlot.day] + strain,
      );
      dayTimeAwakeTicks[bestSlot.day] += fittedTicks;
      dayLastTaskEndTick[bestSlot.day] = absStart + fittedTicks;
      dayLastTaskType[bestSlot.day] = task.type || 'other';

      if (burnoutTick > 0) {
        bestSlot.usedTicks += RECOVERY_TICKS;
        bestSlot.durationTicks -= RECOVERY_TICKS;
        dayUsedTicks[bestSlot.day] += RECOVERY_TICKS;
        // Burnout break gives some strain relief (partial Process S decay)
        dayAccumulatedStrain[bestSlot.day] *= 0.85; // 15% strain reduction from forced rest
        dayLastTaskEndTick[bestSlot.day] += RECOVERY_TICKS;
      }
    } catch (err) {
      console.error(`Scheduler: failed to simulate task "${task.title}"`, err);
      unscheduled.push(task);
    }
  }

  // -- Phase 3: Refinement pass ---------------------------------------------

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

        // Relaxed scoring: gamma only, no congestion, no Process S penalty
        const hour = slot.startHour + (slot.usedTicks / 6);
        const gamma = circadianGamma(hour, chronotype) * profile.gammaBoost;
        const score = gamma + (slot.usedTicks / 1000);

        if (score < bestScore) { bestScore = score; bestSlot = slot; }
      }

      if (!bestSlot) { stillUnschedule.push(task); continue; }

      const absStart = bestSlot.startTick + bestSlot.usedTicks;
      const gamma = circadianGamma(absStart / 6, chronotype) * profile.gammaBoost;
      const effAlpha = effectiveAlpha(alpha, dayAccumulatedStrain[bestSlot.day]);

      try {
        let timeline = calculateMarkovTimeline(effAlpha, task.difficulty || 3, gamma, taskTicks);
        let burnoutTick = findBurnoutTick(timeline, 0.50);

        if (burnoutTick > 0) {
          const opt = optimizeWithBreak(effAlpha, task.difficulty || 3, gamma, taskTicks, burnoutTick);
          timeline = opt.optimized;
          burnoutTick = findBurnoutTick(timeline, 0.50);
        }

        if ((timeline.length - 1) > bestSlot.durationTicks) {
          timeline = calculateMarkovTimeline(effAlpha, task.difficulty || 3, gamma, taskTicks);
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

        const strain = strainContribution(
          fittedTicks, task.difficulty || 3, gamma, bestSlot.maxTicks,
        );
        dayAccumulatedStrain[bestSlot.day] = Math.min(
          MAX_STRAIN_PER_DAY,
          dayAccumulatedStrain[bestSlot.day] + strain,
        );
        dayTimeAwakeTicks[bestSlot.day] += fittedTicks;
        dayLastTaskEndTick[bestSlot.day] = absStart + fittedTicks;

        if (burnoutTick > 0) {
          bestSlot.usedTicks += RECOVERY_TICKS;
          bestSlot.durationTicks -= RECOVERY_TICKS;
          dayUsedTicks[bestSlot.day] += RECOVERY_TICKS;
          dayAccumulatedStrain[bestSlot.day] *= 0.85;
          dayLastTaskEndTick[bestSlot.day] += RECOVERY_TICKS;
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
    for (const sess of dd.sessions) {
      for (const p of sess.timeline) {
        agg.push({ ...p, tick: off + p.tick, timeLabel: formatTickLabel(off + p.tick) });
      }
      off += sess.timeline.length;
    }
    dd.fatigueCurve = agg;
  }

  week.stats = computeStats(week, sorted, s);

  return week;
}

export {
  ALL_DAYS, DAY_START_TICK, DAY_END_TICK, WEEKEND_DAYS,
  GAP_TICKS, RECOVERY_TICKS,
  TAU_BUILD, TAU_DECAY, CIRCADIAN_AMPLITUDE, PROCESS_S_WEIGHT,
};
