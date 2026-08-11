/**
 * GoogleCalendar — Calendar API v3 operations for import and export.
 *
 * All calls go directly from the browser to Google's servers.
 * The FastAPI backend is not involved.
 */

import { ALL_DAYS, DAY_START_TICK, DAY_END_TICK } from './scheduler.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// -- Type inference (keyword-based) -------------------------------------------

const TYPE_KEYWORDS = {
  academic: ['class', 'lecture', 'exam', 'study', 'seminar', 'lab', 'tutorial', 'course', 'lecture', 'homework', 'assignment'],
  sports: ['gym', 'workout', 'practice', 'training', 'game', 'match', 'run', 'swim', 'sport', 'fitness', 'exercise', 'basketball', 'soccer', 'football', 'tennis', 'yoga'],
  arts: ['art', 'music', 'band', 'choir', 'orchestra', 'piano', 'guitar', 'painting', 'drawing', 'theater', 'drama', 'dance', 'ballet', 'creative', 'studio', 'rehearsal'],
};

function inferType(event) {
  const text = ((event.summary || '') + ' ' + (event.description || '')).toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) return type;
  }
  return 'other';
}

// -- Import: Google Calendar events → MindFlow CalendarBlocks -----------------

/**
 * Fetch events from the user's primary calendar for a given week.
 *
 * @param {string} accessToken  OAuth access token
 * @param {string} weekStartISO ISO date string for Monday of the target week
 * @returns {Promise<{ blocks: CalendarBlock[], eventCount: number, calendarName: string }>}
 */
export async function fetchWeekEvents(accessToken, weekStartISO) {
  // Compute Mon 00:00 to Sun 23:59 in the user's local timezone
  const weekStart = new Date(weekStartISO + 'T00:00:00');
  const weekEnd = new Date(weekStartISO + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 7);

  const timeMin = weekStart.toISOString();
  const timeMax = weekEnd.toISOString();

  const url = new URL(CALENDAR_API + '/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('token_expired');
    if (response.status === 403) throw new Error('permission_denied');
    if (response.status === 429) throw new Error('rate_limited');
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  const events = data.items || [];
  const blocks = mapToCalendarBlocks(events, weekStartISO);

  return {
    blocks,
    eventCount: events.length,
    calendarName: data.summary || 'Google Calendar',
  };
}

/**
 * Convert Google Calendar API event objects to MindFlow CalendarBlock[].
 * Pure function — no side effects.
 *
 * Mapping rules:
 * - Regular timed events: extract startHour + durationHours
 * - All-day events: map to 6am–10pm, flag isAllDay
 * - Multi-day events: split into per-day blocks
 * - Events outside 6am–10pm: clip to visible range
 * - Recurring events: singleEvents=true auto-expands, we get individual instances
 */
export function mapToCalendarBlocks(events, weekStartISO) {
  const blocks = [];
  const weekStart = new Date(weekStartISO + 'T00:00:00');
  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (const event of events) {
    if (event.status === 'cancelled') continue;

    const isAllDay = !!event.start.date;
    const isRecurring = !!event.recurringEventId;

    if (isAllDay) {
      const startDate = new Date(event.start.date + 'T00:00:00');
      const endDate = event.end.date
        ? new Date(event.end.date + 'T00:00:00')
        : new Date(startDate.getTime() + 86400000);

      // Multi-day: split into per-day blocks
      const cursor = new Date(startDate);
      while (cursor < endDate) {
        // Only include if within the target week
        if (cursor >= weekStart && cursor < new Date(weekStart.getTime() + 7 * 86400000)) {
          const day = dayMap[cursor.getDay()];
          blocks.push({
            id: `gcal-${event.id}-${cursor.toISOString().slice(0, 10)}`,
            day,
            startHour: DAY_START_TICK / 6, // 6am
            durationHours: (DAY_END_TICK - DAY_START_TICK) / 6, // 6am–10pm = 16h
            label: event.summary || 'Untitled event',
            type: inferType(event),
            isFixed: true,
            source: 'google',
            googleEventId: event.id,
            googleCalendarName: event.organizer?.displayName || 'Google Calendar',
            isAllDay: true,
            recurrenceRule: event.recurrence?.[0] || null,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      // Timed event
      const startDt = new Date(event.start.dateTime);
      const endDt = new Date(event.end.dateTime);
      const day = dayMap[startDt.getDay()];

      // Only include if within the target week
      if (startDt >= weekStart && startDt < new Date(weekStart.getTime() + 7 * 86400000)) {
        const startHour = startDt.getHours() + startDt.getMinutes() / 60;
        const durationHours = (endDt - startDt) / 3600000;

        // Clip to visible range (6am–10pm)
        const visibleStart = Math.max(startHour, DAY_START_TICK / 6);
        const visibleEnd = Math.min(startHour + durationHours, DAY_END_TICK / 6);

        if (visibleEnd > visibleStart) {
          blocks.push({
            id: `gcal-${event.id}`,
            day,
            startHour: visibleStart,
            durationHours: visibleEnd - visibleStart,
            label: event.summary || 'Untitled event',
            type: inferType(event),
            isFixed: true,
            source: 'google',
            googleEventId: event.id,
            googleCalendarName: event.organizer?.displayName || 'Google Calendar',
            isAllDay: false,
            recurrenceRule: isRecurring ? (event.recurrence?.[0] || null) : null,
          });
        }
      }
    }
  }

  return blocks;
}

// -- Export: MindFlow scheduled sessions → Google Calendar events --------------

const TYPE_TO_GCAL_COLOR = {
  academic: '7',   // Peacock (#039be5)
  sports: '10',    // Basil (#0b8043)
  arts: '3',       // Grape (#8e24aa)
  other: '8',      // Graphite (#616161)
};

/**
 * Build a Google Calendar event payload for a scheduled session.
 */
function buildEventPayload(session, task, startISO, endISO) {
  return {
    summary: task.title,
    start: { dateTime: startISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: endISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    description: [
      `MindFlow study session`,
      `Type: ${task.type || 'other'}`,
      `Difficulty: ${task.difficulty || 3}/5`,
      session.sessionQuality
        ? `Avg Flow: ${session.sessionQuality.avgFlow}% | Peak Fatigue: ${session.sessionQuality.peakFatigue}% | Efficiency: ${session.sessionQuality.efficiency}%`
        : '',
    ].filter(Boolean).join('\n'),
    colorId: TYPE_TO_GCAL_COLOR[task.type] || '8',
    extendedProperties: {
      private: {
        mindflow_session: 'true',
        mindflow_task_type: task.type || 'other',
        mindflow_task_difficulty: String(task.difficulty || 3),
        mindflow_session_quality: session.sessionQuality
          ? JSON.stringify(session.sessionQuality)
          : '',
      },
    },
  };
}

/**
 * Check if a session already exists in Google Calendar for a given time slot.
 */
async function findExistingEvents(accessToken, weekStartISO, weekEndISO) {
  const url = new URL(CALENDAR_API + '/calendars/primary/events');
  url.searchParams.set('timeMin', new Date(weekStartISO + 'T00:00:00').toISOString());
  url.searchParams.set('timeMax', new Date(weekEndISO + 'T23:59:59').toISOString());
  url.searchParams.set('privateExtendedProperty', 'mindflow_session=true');
  url.searchParams.set('maxResults', '250');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return [];
  const data = await response.json();
  return (data.items || []).map(e => e.id);
}

/**
 * Export generated study sessions to Google Calendar.
 * Syncs ALL weeks at once.
 *
 * @param {string} accessToken       OAuth access token
 * @param {string[]} weekStartISOs   Array of week Monday ISO dates to sync
 * @param {object} weekResults       All week results keyed by weekStartISO
 * @returns {Promise<{ created: number, skipped: number, failed: number, events: object[] }>}
 */
export async function exportSessions(accessToken, weekStartISOs, weekResults) {
  // Flatten all sessions from all weeks
  const flat = [];
  for (const ws of weekStartISOs) {
    const result = weekResults[ws];
    if (!result?.days) continue;
    for (const day of ALL_DAYS) {
      const dayData = result.days[day];
      if (!dayData?.sessions) continue;
      for (const session of dayData.sessions) {
        flat.push({ dayName: day, session, weekStart: ws });
      }
    }
  }

  if (flat.length === 0) return { created: 0, skipped: 0, failed: 0, events: [] };

  // Find existing MindFlow events to skip (duplicate detection)
  const earliest = weekStartISOs.sort()[0];
  const latest = (() => {
    const d = new Date(weekStartISOs.sort().pop() + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const existingIds = await findExistingEvents(accessToken, earliest, latest);
  const existingSet = new Set(existingIds);

  const created = [];
  let skipped = 0;
  let failed = 0;

  // Process in batches of 10 with 2s pause between batches (rate limit safety)
  const BATCH_SIZE = 10;
  for (let i = 0; i < flat.length; i += BATCH_SIZE) {
    const batch = flat.slice(i, i + BATCH_SIZE);

    for (const { dayName, session, weekStart } of batch) {
      const dayIdx = ALL_DAYS.indexOf(dayName);
      const baseDate = new Date(weekStart + 'T00:00:00');
      baseDate.setDate(baseDate.getDate() + dayIdx);

      const startDate = new Date(baseDate);
      startDate.setMinutes(session.startTick * 10);
      const endDate = new Date(baseDate);
      endDate.setMinutes(session.endTick * 10);

      // Skip if end time > 10pm or start time < 6am (clamped out)
      if (session.startTick < 36 || session.endTick > 132) {
        skipped++;
        continue;
      }

      const payload = buildEventPayload(
        session,
        session.task,
        startDate.toISOString(),
        endDate.toISOString(),
      );

      try {
        const response = await fetch(CALENDAR_API + '/calendars/primary/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) throw new Error('token_expired');
        if (response.status === 403) throw new Error('permission_denied');
        if (response.status === 429) {
          // Rate limited — wait and retry once
          await new Promise(r => setTimeout(r, 5000));
          const retry = await fetch(CALENDAR_API + '/calendars/primary/events', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          if (!retry.ok) { failed++; continue; }
          const data = await retry.json();
          created.push({ googleEventId: data.id, dayName, startTick: session.startTick, weekStart });
          continue;
        }
        if (!response.ok) { failed++; continue; }

        const data = await response.json();
        created.push({ googleEventId: data.id, dayName, startTick: session.startTick, weekStart });
      } catch {
        failed++;
      }
    }

    // 2-second pause between batches
    if (i + BATCH_SIZE < flat.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return { created: created.length, skipped, failed, events: created };
}

/**
 * Delete previously synced MindFlow sessions from Google Calendar.
 *
 * @param {string} accessToken
 * @param {object[]} events  Array of { googleEventId } from export tracking
 * @returns {Promise<{ deleted: number, failed: number }>}
 */
export async function deleteSyncedEvents(accessToken, events) {
  let deleted = 0;
  let failed = 0;

  for (const evt of events) {
    try {
      const response = await fetch(CALENDAR_API + `/calendars/primary/events/${evt.googleEventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok || response.status === 410) {
        // 410 = already deleted (gone), treat as success
        deleted++;
      } else if (response.status === 401) {
        throw new Error('token_expired');
      } else {
        failed++;
      }
    } catch (err) {
      if (err.message === 'token_expired') throw err;
      failed++;
    }
  }

  return { deleted, failed };
}
