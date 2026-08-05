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
  computeRecoveryState,
  computeAttentionResidue,
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

// Difficulty-aware slot scoring (v5)
const DIFFICULTY_CIRCADIAN_WEIGHT = 0.12; // how much difficulty amplifies circadian effect
const MAX_DIFFICULTY_PER_DAY = 18;        // max cumulative difficulty before heavy penalty
const DIFFICULTY_SPREAD_WEIGHT = 0.60;    // penalty strength for overloading one day

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
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return map[d.getDay()];
  } catch {
    return null;
  }
}

/**
 * Check if a task's deadline allows it to be scheduled on a given day.
 * Uses actual calendar dates so deadlines work across week boundaries.
 *
 * @param {object} task           Task with optional deadline (ISO date string)
 * @param {string} day            Day name ('Mon'–'Sun')
 * @param {string} weekStartDate  ISO date string for this week's Monday
 * @returns {boolean}
 */
function deadlineAllowsDay(task, day, weekStartDate) {
  if (!task.deadline) return true;

  const deadlineDate = new Date(task.deadline + 'T00:00:00');
  if (isNaN(deadlineDate.getTime())) return true;

  // Compute the actual date for this day name relative to the week start
  const weekStart = new Date(weekStartDate + 'T00:00:00');
  if (isNaN(weekStart.getTime())) return true;

  const dayIndex = DAY_INDEX[day];
  const dayDate = new Date(weekStart);
  dayDate.setDate(dayDate.getDate() + dayIndex);

  return dayDate <= deadlineDate;
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
                    lastTaskType = null, prevDayStrain = 0, difficulty = 3,
                    dayDifficultyLoad = 0) {
  const hour = slot.startHour + (slot.usedTicks / 6);

  // Process C: circadian gamma
  const gamma = circadianGamma(hour, chronotype) * profile.gammaBoost;

  // Process S: homeostatic pressure
  const S = processS(timeAwakeHrs + (slot.usedTicks / 6), breakMins);

  // Combined fatigue factor: circadian × (1 + homeostatic)
  // v5: difficulty amplifies the circadian effect — hard tasks at bad times
  // are much worse than easy tasks at the same time
  const difficultyFactor = 1 + (difficulty - 1) * DIFFICULTY_CIRCADIAN_WEIGHT;
  const fatigueFactor = gamma * (1 + S) * difficultyFactor;

  // Non-linear congestion penalty: strongly penalizes filling up one day
  // v6: 4× stronger — was 0.8, now 3.0. Prevents Monday bunching.
  const dayCap = WEEKEND_DAYS.has(slot.day)
    ? (settings.maxHoursWeekend ?? 4)
    : (settings.maxHoursPerDay ?? 8);
  const dayMaxTicks = dayCap * 6;
  const congestion = dayCap > 0
    ? (slot.usedTicks / dayMaxTicks)
    : 0;
  const congestionPenalty = congestion * congestion * 3.0;

  // Fresh day bonus: reward placing first task on an empty day
  // Pulls tasks toward unused days instead of bunching on Monday
  const freshDayBonus = slot.usedTicks === 0 ? -0.15 : 0;

  // v5: Per-day difficulty budget — spread hard tasks across days
  const difficultyCongestion = MAX_DIFFICULTY_PER_DAY > 0
    ? (dayDifficultyLoad + difficulty) / MAX_DIFFICULTY_PER_DAY
    : 0;
  const difficultySpreadPenalty = difficultyCongestion > 1
    ? (difficultyCongestion - 1) * (difficultyCongestion - 1) * DIFFICULTY_SPREAD_WEIGHT
    : 0;

  // Weekend penalty
  const weekendPenalty = WEEKEND_DAYS.has(slot.day) ? 0.3 : 0;

  // Cross-day carryover
  const carryoverDecay = Math.exp(-OVERNIGHT_RECOVERY_HOURS / TAU_BUILD);
  const crossDayPenalty = prevDayStrain * CROSS_DAY_CARRYOVER * carryoverDecay
    * (1 - congestion);

  // Task sequencing: ALWAYS check against the last task type on this day
  // v6: removed slot.usedTicks === 0 condition — was only checking first task
  // per day, allowing back-to-back same-type tasks after the first one
  let sequencingScore = 0;
  if (lastTaskType) {
    const lastProfile = TYPE_PROFILES[lastTaskType] || TYPE_PROFILES.other;
    if (profile.gammaBoost === lastProfile.gammaBoost) {
      sequencingScore = SEQUENCING_BONUS * 1.5; // same type → stronger penalty
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

  return fatigueFactor + congestionPenalty + freshDayBonus
       + difficultySpreadPenalty + weekendPenalty + crossDayPenalty
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
// Pre-Flight Task Analysis
// ===========================================================================

/**
 * Analyze the task list before scheduling and return actionable insights.
 *
 * @param {Task[]} tasks
 * @param {UserSettings} settings
 * @returns {object} Preflight analysis
 */
function analyzePreflight(tasks, settings) {
  const s = settings || {};
  const maxWeekday = s.maxHoursPerDay ?? 8;
  const maxWeekend = s.maxHoursWeekend ?? 4;

  const totalMins = tasks.reduce((sum, t) => sum + (t.durationMins || 0), 0);
  const totalHours = Math.round(totalMins / 6) / 10;
  const weeklyCapacity = (maxWeekday * 5 + maxWeekend * 2) * 60;
  const capacityPct = weeklyCapacity > 0 ? Math.round((totalMins / weeklyCapacity) * 100) : 0;

  // Difficulty distribution
  const diffBuckets = { easy: 0, medium: 0, hard: 0 };
  let totalDifficulty = 0;
  for (const t of tasks) {
    const d = t.difficulty || 3;
    totalDifficulty += d;
    if (d <= 2) diffBuckets.easy++;
    else if (d <= 3) diffBuckets.medium++;
    else diffBuckets.hard++;
  }
  const avgDifficulty = tasks.length > 0
    ? Math.round(totalDifficulty / tasks.length * 10) / 10
    : 0;

  // Type distribution
  const typeCounts = {};
  for (const t of tasks) {
    const type = t.type || 'other';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  // Deadline pressure
  let urgentCount = 0;
  const now = Date.now();
  for (const t of tasks) {
    if (t.deadline) {
      const dl = new Date(t.deadline);
      if (!isNaN(dl.getTime())) {
        const daysUntil = (dl.getTime() - now) / (86400000);
        if (daysUntil <= 2) urgentCount++;
      }
    }
  }

  // Priority distribution
  const priorityCounts = { high: 0, medium: 0, low: 0 };
  for (const t of tasks) {
    const p = t.priority || 'medium';
    priorityCounts[p] = (priorityCounts[p] || 0) + 1;
  }

  return {
    totalTasks: tasks.length,
    totalHours,
    weeklyCapacityHours: weeklyCapacity / 60,
    capacityUtilizationPct: capacityPct,
    avgDifficulty,
    difficultyDistribution: diffBuckets,
    typeDistribution: typeCounts,
    urgentTaskCount: urgentCount,
    priorityDistribution: priorityCounts,
    isOverloaded: capacityPct > 90,
    recommendationCount: 0,
  };
}

// ===========================================================================
// Schedule Warnings Generator
// ===========================================================================

/**
 * Generate warnings about potentially problematic schedule patterns.
 *
 * @param {OptimizedWeek} week
 * @param {Task[]} tasks
 * @param {UserSettings} settings
 * @returns {object[]} Array of warning objects { severity, message, day, detail }
 */
function generateWarnings(week, tasks, settings) {
  const warnings = [];
  const s = settings || {};
  const maxWeekday = s.maxHoursPerDay ?? 8;
  const maxWeekend = s.maxHoursWeekend ?? 4;

  for (const day of ALL_DAYS) {
    const sessions = week.days[day].sessions;
    if (sessions.length === 0) continue;

    const cap = WEEKEND_DAYS.has(day) ? maxWeekend : maxWeekday;
    let dayTicks = 0;
    let hardCount = 0;
    let consecutiveHard = 0;
    let maxConsecutiveHard = 0;
    let sameTypeStreak = 0;
    let maxSameTypeStreak = 0;
    let lastType = null;
    let burnoutSessions = 0;

    for (const sess of sessions) {
      dayTicks += (sess.endTick - sess.startTick);
      if ((sess.task.difficulty || 3) >= 4) {
        hardCount++;
        consecutiveHard++;
        maxConsecutiveHard = Math.max(maxConsecutiveHard, consecutiveHard);
      } else {
        consecutiveHard = 0;
      }
      if (sess.task.type === lastType && lastType !== null) {
        sameTypeStreak++;
        maxSameTypeStreak = Math.max(maxSameTypeStreak, sameTypeStreak);
      } else {
        sameTypeStreak = 0;
      }
      lastType = sess.task.type;
      if (sess.burnoutTick > 0) burnoutSessions++;
    }

    const utilization = cap > 0 ? dayTicks / (cap * 6) : 0;

    // Heavy day warning
    if (utilization > 0.85) {
      warnings.push({
        severity: utilization > 0.95 ? 'high' : 'medium',
        type: 'heavy_day',
        message: `${day} is at ${Math.round(utilization * 100)}% capacity`,
        day,
        detail: `${sessions.length} sessions, ${Math.round(dayTicks * 10 / 60 * 10) / 10}h scheduled`,
      });
    }

    // Consecutive hard tasks
    if (maxConsecutiveHard >= 3) {
      warnings.push({
        severity: 'high',
        type: 'consecutive_hard',
        message: `${maxConsecutiveHard} consecutive high-difficulty tasks on ${day}`,
        day,
        detail: 'Consider inserting breaks or alternating with easier tasks',
      });
    }

    // Same-type streak (attention residue)
    if (maxSameTypeStreak >= 3) {
      warnings.push({
        severity: 'medium',
        type: 'same_type_streak',
        message: `${maxSameTypeStreak + 1} consecutive same-type tasks on ${day}`,
        day,
        detail: 'Alternating task types improves cognitive recovery between sessions',
      });
    }

    // Weekend usage when weekday space available
    if (WEEKEND_DAYS.has(day) && sessions.length > 0) {
      // Check if any weekday has free capacity
      let weekdaySlack = false;
      for (const wd of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
        let wdTicks = 0;
        for (const ws of week.days[wd].sessions) {
          wdTicks += (ws.endTick - ws.startTick);
        }
        if (wdTicks < maxWeekday * 6 * 0.7) { weekdaySlack = true; break; }
      }
      if (weekdaySlack) {
        warnings.push({
          severity: 'low',
          type: 'weekend_with_slack',
          message: `Tasks scheduled on ${day} while weekday capacity exists`,
          day,
          detail: 'Consider moving weekend tasks to available weekday slots for better recovery',
        });
      }
    }
  }

  // Unscheduled tasks warning
  if (week.unscheduled.length > 0) {
    const unscheduledHours = week.unscheduled.reduce((sum, t) => sum + (t.durationMins || 0), 0) / 60;
    warnings.push({
      severity: 'high',
      type: 'unscheduled_tasks',
      message: `${week.unscheduled.length} task(s) could not be scheduled (${Math.round(unscheduledHours * 10) / 10}h total)`,
      detail: week.unscheduled.map(t => t.title).join(', '),
    });
  }

  // Deadline buffer check
  for (const day of ALL_DAYS) {
    for (const sess of week.days[day].sessions) {
      if (sess.task.deadline) {
        const dlDay = deadlineToDay(sess.task.deadline);
        if (dlDay && DAY_INDEX[day] === DAY_INDEX[dlDay]) {
          warnings.push({
            severity: 'medium',
            type: 'no_deadline_buffer',
            message: `"${sess.task.title}" scheduled on its deadline day (${day})`,
            day,
            detail: 'No buffer day — any delay means missing the deadline',
          });
        }
      }
    }
  }

  return warnings;
}

// ===========================================================================
// Cumulative State Propagation
// ===========================================================================

/**
 * Compute the initial cognitive state for the next task on the same day,
 * based on the end state of the previous task and the gap/recovery since.
 *
 * Recovery during gaps uses the biexponential model. Burnout breaks
 * provide stronger recovery. This function does NOT apply attention
 * residue — that is handled separately using the per-type-pair residue
 * table when the next task type is known.
 *
 * @param {MarkovTimePoint[]} prevTimeline  Timeline of the previous task
 * @param {number} gapTicks                 Ticks of gap since previous task ended
 * @param {boolean} hadBurnoutBreak          Whether burnout recovery was applied
 * @returns {number[]|null} [flow, distracted, fatigue, recovery] or null for fresh start
 */
function computeNextInitialState(prevTimeline, gapTicks, hadBurnoutBreak) {
  if (!prevTimeline || prevTimeline.length === 0) return null;

  const endState = prevTimeline[prevTimeline.length - 1];
  const currentState = [
    endState.flow,
    endState.distracted,
    endState.fatigue,
    endState.recovery,
  ];

  // Recovery during the gap using biexponential model
  const gapMinutes = gapTicks * 10;
  const recoveredState = computeRecoveryState(currentState, gapMinutes);

  // If burnout break was applied, add extra recovery
  if (hadBurnoutBreak) {
    return computeRecoveryState(recoveredState, 20); // extra 20 min recovery
  }

  // Return recovered state without attention residue.
  // Type-specific residue is applied later when the next task type is known.
  return recoveredState;
}

/**
 * Apply type-specific attention residue to a carryover state based on
 * the previous and next task types. Uses the detailed per-type-pair
 * residue table from the Markov engine.
 *
 * Same-type transitions (academic→academic): ~5% residue (minimal)
 * Different-type transitions (academic→sports): up to 22% residue
 *
 * @param {number[]} state         [flow, distracted, fatigue, recovery]
 * @param {string|null} prevType   Previous task type
 * @param {string|null} nextType   Next task type being scheduled
 * @returns {number[]} Modified state with attention residue applied
 */
function applyAttentionResidueToState(state, prevType, nextType) {
  if (!prevType || !nextType || !state) return state;

  const residue = computeAttentionResidue(prevType, nextType);
  if (residue <= 0) return state;

  const flowLoss = state[0] * residue;
  const sum0 = state[0] + state[1] + state[2] + state[3];
  const result = [
    state[0] - flowLoss,
    state[1] + flowLoss * 0.7,
    state[2] + flowLoss * 0.15,
    state[3] + flowLoss * 0.15,
  ];
  // Renormalize
  const sum = result.reduce((a, b) => a + b, 0);
  if (sum > 0 && Number.isFinite(sum)) {
    return result.map(x => Math.max(0, Math.min(1, x / sum)));
  }
  return state;
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
  calendarBlocks = [], tasks = [], alpha = 1.0, settings = {}, weekStartDate = null
) {
  // Default to this week's Monday if no date provided
  const wsDate = weekStartDate || (() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(mon.getDate() + diff);
    return mon.toISOString().split('T')[0];
  })();

  // Today's date for blocking past days (only when real dates are in play)
  const todayStr = new Date().toISOString().split('T')[0];
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;

  // Only enforce past-day blocking when caller passes real week dates
  const enforceRealDates = !!weekStartDate;

  // Compute actual date for a day name
  const dateForDay = (dayName) => {
    const idx = DAY_INDEX[dayName];
    const d = new Date(wsDate + 'T00:00:00');
    d.setDate(d.getDate() + idx);
    return d.toISOString().split('T')[0];
  };

  // Check if a day is in the past (before today) — only when using real dates
  const isPastDay = (dayName) =>
    enforceRealDates && dateForDay(dayName) < todayStr;

  // Check if it's today
  const isToday = (dayName) =>
    enforceRealDates && dateForDay(dayName) === todayStr;

  const week = createEmptyWeek();
  const s = settings || {};
  const taskList = (tasks || []).filter(t => t && t.durationMins > 0);
  if (taskList.length === 0) {
    week.stats = computeStats(week, [], s);
    week.warnings = [];
    week.preflight = analyzePreflight([], s);
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

  // Collect all free slots — skip past days, adjust today to current time
  const allSlots = [];
  for (const day of ALL_DAYS) {
    // Past days: cannot schedule anything
    if (isPastDay(day)) continue;

    const capTicks = Math.round((WEEKEND_DAYS.has(day) ? maxWeekend : maxWeekday) * 6);
    for (const slot of findFreeSlots(blocksByDay[day])) {
      // For today: clamp start to current time (rounded up to nearest tick)
      let adjustedSlot = { ...slot };
      if (isToday(day)) {
        const nowTick = Math.ceil(nowHour * 6); // current time in ticks, rounded up
        if (nowTick > adjustedSlot.endTick) continue; // slot already over
        if (nowTick > adjustedSlot.startTick) {
          adjustedSlot.startTick = nowTick;
          adjustedSlot.startHour = nowTick / 6;
          adjustedSlot.durationTicks = Math.max(0, adjustedSlot.endTick - nowTick);
          adjustedSlot.durationHours = adjustedSlot.durationTicks / 6;
        }
        if (adjustedSlot.durationTicks <= 0) continue; // no time left
      }
      allSlots.push({ ...adjustedSlot, day, maxTicks: capTicks, usedTicks: 0 });
    }
  }

  if (allSlots.length === 0) {
    week.unscheduled = [...sorted];
    week.stats = computeStats(week, sorted, s);
    week.warnings = generateWarnings(week, sorted, s);
    week.preflight = analyzePreflight(sorted, s);
    return week;
  }

  // Per-day state for two-process model + cross-day carryover
  const dayAccumulatedStrain = {};   // cumulative cognitive strain [0, 1]
  const dayTimeAwakeTicks = {};       // total ticks of cognitive work done
  const dayLastTaskEndTick = {};      // tick when the last task ended (for break gap calc)
  const dayUsedTicks = {};
  const dayLastTaskType = {};         // last task type on each day (for sequencing)
  const dayNextInitialState = {};     // carryover cognitive state for next task on this day
  const dayHadBurnout = {};           // whether the last task on this day had burnout
  const dayDifficultyLoad = {};       // v5: cumulative difficulty sum (for spread penalty)

  ALL_DAYS.forEach(d => {
    dayAccumulatedStrain[d] = 0;
    dayTimeAwakeTicks[d] = 0;
    dayLastTaskEndTick[d] = DAY_START_TICK;
    dayUsedTicks[d] = 0;
    dayLastTaskType[d] = null;
    dayNextInitialState[d] = null;   // null = fresh start [1,0,0,0]
    dayHadBurnout[d] = false;
    dayDifficultyLoad[d] = 0;
  });

  // -- Phase 2: Primary placement -------------------------------------------

  for (const task of sorted) {
    const taskTicks = Math.ceil((task.durationMins || 30) / 10);
    const profile = TYPE_PROFILES[task.type] || TYPE_PROFILES.other;

    // Deadline pressure: alpha boost for tasks due within 2 days.
    // Computed once per task using a week-relative estimate for scoring;
    // refined after slot selection with the actual scheduled day.
    let deadlineAlphaBoost = 1.0;
    if (task.deadline) {
      const deadlineDay = deadlineToDay(task.deadline);
      if (deadlineDay) {
        // Use worst-case (earliest possible scheduling day = Monday) for scoring
        const worstCaseDaysUntil = DAY_INDEX[deadlineDay] - DAY_INDEX.Mon;
        if (worstCaseDaysUntil >= 0 && worstCaseDaysUntil <= DEADLINE_PRESSURE_DAYS) {
          deadlineAlphaBoost = 1.0 + DEADLINE_PRESSURE_BOOST
            * (1 - worstCaseDaysUntil / DEADLINE_PRESSURE_DAYS);
        }
      }
    }

    let bestSlot = null;
    let bestScore = Infinity;

    for (const slot of allSlots) {
      if (slot.usedTicks >= slot.maxTicks) continue;
      if (taskTicks > slot.durationTicks) continue;
      if (!deadlineAllowsDay(task, slot.day, wsDate)) continue;

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
        task.difficulty || 3,
        dayDifficultyLoad[slot.day] || 0,
      );

      if (score < bestScore) { bestScore = score; bestSlot = slot; }
    }

    if (!bestSlot) { unscheduled.push(task); continue; }

    // Place the task
    const absStart = bestSlot.startTick + bestSlot.usedTicks;
    const gamma = circadianGamma(absStart / 6, chronotype) * profile.gammaBoost;

    // Apply cumulative strain + deadline pressure to effective alpha
    const strainAlpha = effectiveAlpha(alpha, dayAccumulatedStrain[bestSlot.day]);

    // Refine deadline pressure relative to the actual scheduled day
    let dayRelativeBoost = deadlineAlphaBoost;
    if (task.deadline && deadlineAlphaBoost > 1.0) {
      const deadlineDay = deadlineToDay(task.deadline);
      if (deadlineDay) {
        const daysUntil = DAY_INDEX[deadlineDay] - DAY_INDEX[bestSlot.day];
        if (daysUntil >= 0 && daysUntil <= DEADLINE_PRESSURE_DAYS) {
          dayRelativeBoost = 1.0 + DEADLINE_PRESSURE_BOOST
            * (1 - daysUntil / DEADLINE_PRESSURE_DAYS);
        } else {
          dayRelativeBoost = 1.0; // scheduled before or after pressure window
        }
      }
    }
    const effAlpha = strainAlpha * dayRelativeBoost;

    // Count valid alternatives for explainability
    let validAlternatives = 0;
    for (const slot of allSlots) {
      if (slot.usedTicks >= slot.maxTicks) continue;
      if (taskTicks > slot.durationTicks) continue;
      if (!deadlineAllowsDay(task, slot.day, wsDate)) continue;
      if (slot === bestSlot) continue;
      validAlternatives++;
    }

    try {
      // Use carryover state from previous task on this day (cumulative fatigue)
      const carryoverState = dayNextInitialState[bestSlot.day];
      // Apply type-specific attention residue between the last task type and
      // this task's type before running the Markov simulation
      const initialState = carryoverState
        ? applyAttentionResidueToState(carryoverState, dayLastTaskType[bestSlot.day], task.type)
        : null;
      let timeline = calculateMarkovTimeline(
        effAlpha, task.difficulty || 3, gamma, taskTicks, initialState
      );
      let burnoutTick = findBurnoutTick(timeline, 0.50);

      if (burnoutTick > 0) {
        const optimalBreak = computeOptimalBreakDuration(timeline, burnoutTick, 0.30);
        const opt = optimizeWithBreak(effAlpha, task.difficulty || 3, gamma, taskTicks,
                                       burnoutTick, optimalBreak, { initialState });
        timeline = opt.optimized;
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }

      if ((timeline.length - 1) > bestSlot.durationTicks) {
        timeline = calculateMarkovTimeline(effAlpha, task.difficulty || 3, gamma, taskTicks,
                                            initialState);
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }

      const fittedTicks = Math.min(timeline.length - 1, bestSlot.durationTicks);
      if (timeline.length - 1 > fittedTicks) {
        timeline = timeline.slice(0, fittedTicks + 1);
      }

      let bc = 0, fm = 0;
      let peakFatigueInSession = 0;
      for (const p of timeline) {
        if (p.fatigue > 0.50) bc++;
        fm += p.flow * 10;
        if (p.fatigue > peakFatigueInSession) peakFatigueInSession = p.fatigue;
      }

      // Session quality metrics
      const avgFlowInSession = timeline.length > 0
        ? timeline.reduce((s, p) => s + p.flow, 0) / timeline.length
        : 0;
      const sessionEfficiency = Math.round(avgFlowInSession * 100);

      // Placement explainability
      const hourPlaced = absStart / 6;
      const placementReason = {
        score: Math.round(bestScore * 1000) / 1000,
        gamma: Math.round(gamma * 1000) / 1000,
        hourPlaced: Math.round(hourPlaced * 10) / 10,
        alternativeSlots: validAlternatives,
        carryoverUsed: initialState !== null,
        reason: initialState !== null
          ? `Placed at ${formatTickLabel(absStart)} on ${bestSlot.day} (γ=${gamma.toFixed(3)}, cumulative fatigue applied)`
          : `Placed at ${formatTickLabel(absStart)} on ${bestSlot.day} (γ=${gamma.toFixed(3)}, fresh start)`,
      };

      week.days[bestSlot.day].sessions.push({
        task, startTick: absStart, endTick: absStart + fittedTicks,
        timeline, burnoutTick,
        placementReason,
        sessionQuality: {
          avgFlow: Math.round(avgFlowInSession * 1000) / 10,
          peakFatigue: Math.round(peakFatigueInSession * 1000) / 10,
          flowMinutes: Math.round(fm),
          efficiency: sessionEfficiency,
        },
      });
      week.days[bestSlot.day].totalFlowMins += Math.round(fm);
      if (burnoutTick > 0) week.days[bestSlot.day].burnoutCount += 1;

      // Update per-day state
      const totalConsumed = fittedTicks + GAP_TICKS;
      bestSlot.usedTicks = Math.min(bestSlot.maxTicks, bestSlot.usedTicks + totalConsumed);
      bestSlot.durationTicks = Math.max(0, bestSlot.durationTicks - totalConsumed);
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
      dayDifficultyLoad[bestSlot.day] += (task.difficulty || 3);
      dayTimeAwakeTicks[bestSlot.day] += fittedTicks;
      dayLastTaskEndTick[bestSlot.day] = absStart + fittedTicks;
      dayLastTaskType[bestSlot.day] = task.type || 'other';

      // Compute carryover state for next task on this day
      const hadBurnout = burnoutTick > 0;
      dayNextInitialState[bestSlot.day] = computeNextInitialState(
        timeline, GAP_TICKS, hadBurnout
      );

      if (hadBurnout) {
        bestSlot.usedTicks = Math.min(bestSlot.maxTicks, bestSlot.usedTicks + RECOVERY_TICKS);
        bestSlot.durationTicks = Math.max(0, bestSlot.durationTicks - RECOVERY_TICKS);
        dayUsedTicks[bestSlot.day] += RECOVERY_TICKS;
        dayAccumulatedStrain[bestSlot.day] *= 0.85;
        dayLastTaskEndTick[bestSlot.day] += RECOVERY_TICKS;
        // Stronger recovery for next task
        if (dayNextInitialState[bestSlot.day]) {
          dayNextInitialState[bestSlot.day] = computeRecoveryState(
            dayNextInitialState[bestSlot.day], RECOVERY_TICKS * 10
          );
        }
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
        if (!deadlineAllowsDay(task, slot.day, wsDate)) continue;

        // Relaxed scoring: gamma only, no congestion, no Process S penalty
        // v5: difficulty still matters even in refinement — hard tasks get
        // preference for better circadian times
        const hour = slot.startHour + (slot.usedTicks / 6);
        const gamma = circadianGamma(hour, chronotype) * profile.gammaBoost;
        const diffFactor = 1 + ((task.difficulty || 3) - 1) * DIFFICULTY_CIRCADIAN_WEIGHT;
        const difficultySpreadPenalty = (dayDifficultyLoad[slot.day] || 0) > MAX_DIFFICULTY_PER_DAY
          ? ((dayDifficultyLoad[slot.day] - MAX_DIFFICULTY_PER_DAY) / MAX_DIFFICULTY_PER_DAY) * 0.5
          : 0;
        const score = gamma * diffFactor + difficultySpreadPenalty + (slot.usedTicks / 1000);

        if (score < bestScore) { bestScore = score; bestSlot = slot; }
      }

      if (!bestSlot) { stillUnschedule.push(task); continue; }

      const absStart = bestSlot.startTick + bestSlot.usedTicks;
      const gamma = circadianGamma(absStart / 6, chronotype) * profile.gammaBoost;
      const effAlpha = effectiveAlpha(alpha, dayAccumulatedStrain[bestSlot.day]);

      try {
        // Use carryover state from previous task on this day
        const carryoverState = dayNextInitialState[bestSlot.day];
        // Apply type-specific attention residue
        const initialState = carryoverState
          ? applyAttentionResidueToState(carryoverState, dayLastTaskType[bestSlot.day], task.type)
          : null;
        let timeline = calculateMarkovTimeline(
          effAlpha, task.difficulty || 3, gamma, taskTicks, initialState
        );
        let burnoutTick = findBurnoutTick(timeline, 0.50);

        if (burnoutTick > 0) {
          const optimalBreak = computeOptimalBreakDuration(timeline, burnoutTick, 0.30);
          const opt = optimizeWithBreak(effAlpha, task.difficulty || 3, gamma, taskTicks,
                                         burnoutTick, optimalBreak, { initialState });
          timeline = opt.optimized;
          burnoutTick = findBurnoutTick(timeline, 0.50);
        }

        if ((timeline.length - 1) > bestSlot.durationTicks) {
          timeline = calculateMarkovTimeline(effAlpha, task.difficulty || 3, gamma, taskTicks,
                                              initialState);
          burnoutTick = findBurnoutTick(timeline, 0.50);
        }

        const fittedTicks = Math.min(timeline.length - 1, bestSlot.durationTicks);
        if (timeline.length - 1 > fittedTicks) {
          timeline = timeline.slice(0, fittedTicks + 1);
        }

        let bc = 0, fm = 0;
        let peakFatigueInSession = 0;
        for (const p of timeline) {
          if (p.fatigue > 0.50) bc++;
          fm += p.flow * 10;
          if (p.fatigue > peakFatigueInSession) peakFatigueInSession = p.fatigue;
        }

        // Session quality metrics
        const avgFlowInSession = timeline.length > 0
          ? timeline.reduce((s, p) => s + p.flow, 0) / timeline.length
          : 0;
        const sessionEfficiency = Math.round(avgFlowInSession * 100);

        week.days[bestSlot.day].sessions.push({
          task, startTick: absStart, endTick: absStart + fittedTicks,
          timeline, burnoutTick,
          sessionQuality: {
            avgFlow: Math.round(avgFlowInSession * 1000) / 10,
            peakFatigue: Math.round(peakFatigueInSession * 1000) / 10,
            flowMinutes: Math.round(fm),
            efficiency: sessionEfficiency,
          },
        });
        week.days[bestSlot.day].totalFlowMins += Math.round(fm);
        if (burnoutTick > 0) week.days[bestSlot.day].burnoutCount += 1;

        const totalConsumed = fittedTicks + GAP_TICKS;
        bestSlot.usedTicks = Math.min(bestSlot.maxTicks, bestSlot.usedTicks + totalConsumed);
        bestSlot.durationTicks = Math.max(0, bestSlot.durationTicks - totalConsumed);
        bestSlot.startHour = bestSlot.startTick / 6;
        dayUsedTicks[bestSlot.day] += totalConsumed;

        const strain = strainContribution(
          fittedTicks, task.difficulty || 3, gamma, bestSlot.maxTicks,
        );
        dayAccumulatedStrain[bestSlot.day] = Math.min(
          MAX_STRAIN_PER_DAY,
          dayAccumulatedStrain[bestSlot.day] + strain,
        );
        dayDifficultyLoad[bestSlot.day] += (task.difficulty || 3);
        dayTimeAwakeTicks[bestSlot.day] += fittedTicks;
        dayLastTaskEndTick[bestSlot.day] = absStart + fittedTicks;
        dayLastTaskType[bestSlot.day] = task.type || 'other';

        // Compute carryover state for next task on this day
        const hadBurnout = burnoutTick > 0;
        dayNextInitialState[bestSlot.day] = computeNextInitialState(
          timeline, GAP_TICKS, hadBurnout
        );

        if (burnoutTick > 0) {
          bestSlot.usedTicks = Math.min(bestSlot.maxTicks, bestSlot.usedTicks + RECOVERY_TICKS);
          bestSlot.durationTicks = Math.max(0, bestSlot.durationTicks - RECOVERY_TICKS);
          dayUsedTicks[bestSlot.day] += RECOVERY_TICKS;
          dayAccumulatedStrain[bestSlot.day] *= 0.85;
          dayLastTaskEndTick[bestSlot.day] += RECOVERY_TICKS;
          // Stronger recovery for next task
          if (dayNextInitialState[bestSlot.day]) {
            dayNextInitialState[bestSlot.day] = computeRecoveryState(
              dayNextInitialState[bestSlot.day], RECOVERY_TICKS * 10
            );
          }
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
  week.warnings = generateWarnings(week, sorted, s);
  week.preflight = analyzePreflight(sorted, s);

  return week;
}

export {
  ALL_DAYS, DAY_START_TICK, DAY_END_TICK, WEEKEND_DAYS,
  GAP_TICKS, RECOVERY_TICKS,
  TAU_BUILD, TAU_DECAY, CIRCADIAN_AMPLITUDE, PROCESS_S_WEIGHT,
};
