/**
 * MindFlow Smart Scheduler
 *
 * Takes calendar blocks + tasks + calibration + settings and produces a
 * complete OptimizedWeek. Uses global best-fit slot matching (not greedy
 * Monday-first), respects daily caps, applies chronotype-aware gamma
 * curves, and handles all edge cases gracefully.
 *
 * @module scheduler
 */

import { calculateMarkovTimeline, findBurnoutTick, optimizeWithBreak } from './markovEngine.js';

const TYPE_PROFILES = {
  academic:  { gammaBoost: 1.0, sortOrder: 0 },
  sports:    { gammaBoost: 0.7, sortOrder: 2 },
  arts:      { gammaBoost: 0.9, sortOrder: 1 },
  other:     { gammaBoost: 1.0, sortOrder: 1 },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const DAY_START_TICK = 36;
const DAY_END_TICK = 132;
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKEND_DAYS = new Set(['Sat', 'Sun']);

function gammaForHour(hour, chronotype = 'morning') {
  const shift = chronotype === 'neutral' ? 2 : chronotype === 'night' ? 4 : 0;
  const adjusted = (hour - shift + 24) % 24;
  if (adjusted >= 22 || adjusted < 6) return 1.25;
  if (adjusted >= 20) return 1.15;
  if (adjusted >= 14) return 1.05;
  return 1.0;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority || 'medium'];
    const pb = PRIORITY_ORDER[b.priority || 'medium'];
    if (pa !== pb) return pa - pb;
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && b.deadline) {
      const da = new Date(a.deadline), db = new Date(b.deadline);
      if (da < db) return -1;
      if (da > db) return 1;
    }
    const oa = (TYPE_PROFILES[a.type] || TYPE_PROFILES.other).sortOrder;
    const ob = (TYPE_PROFILES[b.type] || TYPE_PROFILES.other).sortOrder;
    if (oa !== ob) return oa - ob;
    return b.difficulty - a.difficulty;
  });
}

function findFreeSlots(blocksForDay) {
  if (!blocksForDay || blocksForDay.length === 0) {
    const dur = DAY_END_TICK - DAY_START_TICK;
    return [{ startTick: DAY_START_TICK, endTick: DAY_END_TICK, startHour: 6,
              durationTicks: dur, durationHours: dur / 6 }];
  }
  const sorted = [...blocksForDay].sort((a, b) => a.startHour - b.startHour);
  const slots = [];
  let cur = DAY_START_TICK;
  for (const b of sorted) {
    const bs = Math.max(DAY_START_TICK, Math.round((b.startHour || 0) * 6));
    const be = Math.min(DAY_END_TICK, Math.round(((b.startHour || 0) + (b.durationHours || 0)) * 6));
    if (bs > cur) { const d = bs - cur; slots.push({ startTick: cur, endTick: bs, startHour: cur / 6, durationTicks: d, durationHours: d / 6 }); }
    cur = Math.max(cur, be);
  }
  if (cur < DAY_END_TICK) { const d = DAY_END_TICK - cur; slots.push({ startTick: cur, endTick: DAY_END_TICK, startHour: cur / 6, durationTicks: d, durationHours: d / 6 }); }
  return slots;
}

function createEmptyWeek() {
  const days = {};
  ALL_DAYS.forEach(d => { days[d] = { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 }; });
  return { days, unscheduled: [], generatedAt: Date.now() };
}

function formatTickLabel(tick) {
  const m = tick * 10;
  return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`;
}

export default function generateWeeklySchedule(
  calendarBlocks = [], tasks = [], alpha = 1.0, settings = {}
) {
  const week = createEmptyWeek();
  const taskList = (tasks || []).filter(t => t && t.durationMins > 0);
  if (taskList.length === 0) return week;

  const blockList = (calendarBlocks || []).filter(b => b);
  const chronotype = settings.chronotype || 'morning';
  const maxWeekday = settings.maxHoursPerDay ?? 8;
  const maxWeekend = settings.maxHoursWeekend ?? 4;

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

  // Guard: no free slots at all (calendar completely full)
  if (allSlots.length === 0) {
    week.unscheduled = sorted;
    return week;
  }

  // Assign each task to best slot
  for (const task of sorted) {
    const taskTicks = Math.ceil((task.durationMins || 30) / 10);
    const profile = TYPE_PROFILES[task.type] || TYPE_PROFILES.other;

    let bestSlot = null, bestScore = Infinity;
    for (const slot of allSlots) {
      if (slot.usedTicks >= slot.maxTicks) continue;
      if (taskTicks > slot.durationTicks) continue;

      const hour = slot.startHour + (slot.usedTicks / 6);
      const gamma = gammaForHour(hour, chronotype) * profile.gammaBoost;
      const weekendPenalty = WEEKEND_DAYS.has(slot.day) ? 0.3 : 0;
      const score = gamma + weekendPenalty + (slot.usedTicks / 1000);

      if (score < bestScore) { bestScore = score; bestSlot = slot; }
    }

    if (!bestSlot) { unscheduled.push(task); continue; }

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

      const actualTicks = timeline.length - 1;

      // Guard: if break insertion extended the task beyond the slot, clip it
      if (actualTicks > bestSlot.durationTicks) {
        timeline = calculateMarkovTimeline(alpha, task.difficulty || 3, gamma, taskTicks);
        burnoutTick = findBurnoutTick(timeline, 0.50);
      }
      const fittedTicks = Math.min(timeline.length - 1, bestSlot.durationTicks);

      let bc = 0, fm = 0;
      for (const p of timeline) { if (p.fatigue > 0.50) bc++; fm += p.flow * 10; }

      week.days[bestSlot.day].sessions.push({
        task, startTick: absStart, endTick: absStart + fittedTicks,
        timeline, burnoutTick,
      });
      week.days[bestSlot.day].totalFlowMins += Math.round(fm);
      if (burnoutTick > 0) week.days[bestSlot.day].burnoutCount += 1;

      bestSlot.usedTicks += fittedTicks;
      bestSlot.durationTicks -= fittedTicks;
      bestSlot.startHour = bestSlot.startTick / 6;
    } catch (err) {
      console.error(`Scheduler: failed to simulate task "${task.title}"`, err);
      unscheduled.push(task);
    }
  }

  week.unscheduled = unscheduled;

  // Build daily aggregate fatigue curves
  for (const day of ALL_DAYS) {
    const dd = week.days[day];
    if (dd.sessions.length === 0) continue;
    const agg = [];
    let off = 0;
    for (const s of dd.sessions) {
      for (const p of s.timeline) agg.push({ ...p, tick: off + p.tick, timeLabel: formatTickLabel(off + p.tick) });
      off += s.timeline.length;
    }
    dd.fatigueCurve = agg;
  }

  return week;
}
