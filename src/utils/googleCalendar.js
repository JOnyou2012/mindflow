/**
 * GoogleCalendar — Calendar API v3 operations for import and export.
 *
 * All calls go directly from the browser to Google's servers.
 * The FastAPI backend is not involved.
 */

import { ALL_DAYS, DAY_START_TICK, DAY_END_TICK } from './scheduler.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * AbortSignal.timeout(ms) does not exist in Safari < 16.4 (and older
 * Chromium). Students may have older devices — provide a fallback.
 */
function timeoutSignal(ms) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Backoff delay from a 429 response's Retry-After header (PRD step 93).
 * Accepts both header forms — delta-seconds ("5") and HTTP-date
 * ("Fri, 31 Dec 1999 23:59:59 GMT"). Falls back to 5s when the header is
 * missing/unparseable, clamped to [1s, 30s] so a malformed value can never
 * hang or hammer the API.
 */
export function retryDelayFrom(response, fallbackMs = 5000) {
  const header = response?.headers?.get?.('Retry-After');
  if (typeof header === 'string' && header.trim() !== '') {
    if (/^\d+$/.test(header.trim())) {
      const seconds = Number(header.trim());
      if (Number.isFinite(seconds)) return Math.max(1000, Math.min(30000, seconds * 1000));
    } else {
      const t = Date.parse(header);
      if (!Number.isNaN(t)) {
        const delta = t - Date.now();
        if (delta > 0) return Math.max(1000, Math.min(30000, delta));
      }
    }
  }
  return fallbackMs;
}

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
 * Fetch the user's calendar list (multi-calendar support — PRD step 91).
 * Only calendars the token can actually read events from are returned:
 * freeBusyReader/none can only see busy/free, never event details.
 *
 * @param {string} accessToken OAuth access token
 * @returns {Promise<Array<{ id, summary, backgroundColor, primary, selected }>>}
 */
export async function fetchCalendarList(accessToken) {
  const url = new URL(CALENDAR_API + '/users/me/calendarList');
  url.searchParams.set('maxResults', '250');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: timeoutSignal(30000),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('token_expired');
    if (response.status === 403) throw new Error('permission_denied');
    if (response.status === 429) throw new Error('rate_limited');
    throw new Error(`CalendarList API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.items || [])
    .filter(c => c && typeof c.id === 'string' && ['owner', 'writer', 'reader'].includes(c.accessRole))
    .map(c => ({
      id: c.id,
      summary: c.summaryOverride || c.summary || c.id,
      // Sanitize the color: CSS-injected hexes must match the expected format.
      backgroundColor: typeof c.backgroundColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.backgroundColor)
        ? c.backgroundColor
        : null,
      primary: !!c.primary,
      selected: c.selected !== false,
    }));
}

/**
 * Fetch events for a given week from one or more calendars.
 * Defaults to the primary calendar for backward compatibility.
 *
 * Per-calendar failures (a deleted calendar, a shared calendar the token
 * lost access to) are skipped so one bad calendar can't kill the sync;
 * token-level failures (401/403) always throw.
 *
 * @param {string} accessToken  OAuth access token
 * @param {string} weekStartISO ISO date string for Monday of the target week
 * @param {string[]} [calendarIds] Calendar ids to fetch — defaults to ['primary']
 * @param {object[]} [calendarMeta] Optional calendar list entries (from
 *   fetchCalendarList) so blocks carry the source calendar's name + color.
 * @returns {Promise<{ blocks, eventCount, calendarNames: string[], calendarName: string, failures: number }>}
 */
export async function fetchWeekEvents(accessToken, weekStartISO, calendarIds = null, calendarMeta = null) {
  // Compute Mon 00:00 to Sun 23:59 in the user's local timezone
  const weekStart = new Date(weekStartISO + 'T00:00:00');
  const weekEnd = new Date(weekStartISO + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 7);

  const timeMin = weekStart.toISOString();
  const timeMax = weekEnd.toISOString();

  const ids = Array.isArray(calendarIds) && calendarIds.length > 0 ? calendarIds : ['primary'];
  const metaById = new Map((Array.isArray(calendarMeta) ? calendarMeta : []).map(c => [c?.id, c]));
  const merged = [];
  const seen = new Set();
  const calendarNames = [];
  let eventCount = 0;
  let failures = 0;

  for (const calId of ids) {
    const url = new URL(CALENDAR_API + `/calendars/${encodeURIComponent(calId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: timeoutSignal(30000),
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('token_expired');
      if (response.status === 403) throw new Error('permission_denied');
      if (response.status === 429) throw new Error('rate_limited');
      failures++;
      continue;
    }

    const data = await response.json();
    const events = data.items || [];
    eventCount += events.length;
    const meta = metaById.get(calId);
    const calendarName = meta?.summary || data.summary || 'Google Calendar';
    calendarNames.push(calendarName);
    const blocks = mapToCalendarBlocks(events, weekStartISO, {
      calendarName,
      calendarColor: meta?.backgroundColor || null,
    });

    // Dedupe on event id + day + start — the same event can only live in
    // one calendar, but overlapping/duplicate calendars do exist in the
    // wild and must not render twice.
    for (const b of blocks) {
      const key = `${b.googleEventId}::${b.day}::${b.startHour}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(b);
      }
    }
  }

  if (merged.length === 0 && failures > 0) {
    throw new Error(`Calendar API error: all ${ids.length} calendar(s) failed`);
  }

  return {
    blocks: merged,
    eventCount,
    calendarNames,
    calendarName: calendarNames.join(', '),
    failures,
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
 * - Events outside 6am–10pm: clip to visible range, flag `clipped`
 *   ('early' | 'late' | 'both') so the UI can show an indicator
 * - Recurring events: singleEvents=true auto-expands, we get individual instances
 *
 * @param {object[]} events     Google Calendar API event objects
 * @param {string} weekStartISO ISO Monday of the target week
 * @param {{ calendarName?: string, calendarColor?: string }} [opts]
 *   Source calendar metadata — attached to every block so the UI can
 *   color-code by calendar (PRD step 91) instead of by event type.
 */
export function mapToCalendarBlocks(events, weekStartISO, opts = {}) {
  const { calendarName = null, calendarColor = null } = opts || {};
  const visibleStartH = DAY_START_TICK / 6; // 6am
  const visibleEndH = DAY_END_TICK / 6; // 10pm
  const blocks = [];
  const weekStart = new Date(weekStartISO + 'T00:00:00');
  // DST-safe week end: adding 7 * 86400000 ms crosses DST shifts and can
  // leak/drop the Monday hour around spring-forward / fall-back.
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
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
        if (cursor >= weekStart && cursor < weekEnd) {
          const day = dayMap[cursor.getDay()];
          // Local date parts — toISOString() would shift the suffix by a
          // day in UTC+ timezones, breaking the id's date meaning.
          const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
          blocks.push({
            id: `gcal-${event.id}-${dateKey}`,
            day,
            startHour: visibleStartH, // 6am
            durationHours: visibleEndH - visibleStartH, // 6am–10pm = 16h
            label: event.summary || 'Untitled event',
            type: inferType(event),
            isFixed: true,
            source: 'google',
            googleEventId: event.id,
            googleCalendarName: calendarName || event.organizer?.displayName || 'Google Calendar',
            googleCalendarColor: calendarColor,
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
      if (startDt >= weekStart && startDt < weekEnd) {
        const startHour = startDt.getHours() + startDt.getMinutes() / 60;
        const durationHours = (endDt - startDt) / 3600000;

        // Clip to visible range (6am–10pm); remember what was cut so the
        // UI can flag "starts before 6:00" / "ends after 22:00" instead of
        // silently showing a truncated block (PRD step 93).
        const visibleStart = Math.max(startHour, visibleStartH);
        const visibleEnd = Math.min(startHour + durationHours, visibleEndH);
        const clippedEarly = startHour < visibleStartH;
        const clippedLate = startHour + durationHours > visibleEndH;

        if (visibleEnd > visibleStart) {
          const block = {
            id: `gcal-${event.id}`,
            day,
            startHour: visibleStart,
            durationHours: visibleEnd - visibleStart,
            label: event.summary || 'Untitled event',
            type: inferType(event),
            isFixed: true,
            source: 'google',
            googleEventId: event.id,
            googleCalendarName: calendarName || event.organizer?.displayName || 'Google Calendar',
            googleCalendarColor: calendarColor,
            isAllDay: false,
            recurrenceRule: isRecurring ? (event.recurrence?.[0] || null) : null,
          };
          if (clippedEarly || clippedLate) {
            block.clipped = clippedEarly && clippedLate ? 'both' : clippedEarly ? 'early' : 'late';
          }
          blocks.push(block);
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
 * `sessionKey` is a stable per-session identifier used for duplicate
 * detection on re-export.
 */
function buildEventPayload(session, task, startISO, endISO, sessionKey) {
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
        mindflow_session_key: sessionKey,
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
 * Find events previously created by MindFlow in the given time range.
 * Returns [{ id, key }] — the Google event id and its mindflow_session_key
 * extended property, used to skip duplicates on re-export.
 */
async function findExistingEvents(accessToken, weekStartISO, weekEndISO) {
  const url = new URL(CALENDAR_API + '/calendars/primary/events');
  url.searchParams.set('timeMin', new Date(weekStartISO + 'T00:00:00').toISOString());
  url.searchParams.set('timeMax', new Date(weekEndISO + 'T23:59:59').toISOString());
  url.searchParams.set('privateExtendedProperty', 'mindflow_session=true');
  url.searchParams.set('maxResults', '250');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: timeoutSignal(30000),
  });

  // 401 means the token died — surface it so the UI can re-auth instead of
  // proceeding to fail every POST. Other failures degrade to "no dedup
  // info" (duplicates are recoverable via unsync).
  if (!response.ok) {
    if (response.status === 401) throw new Error('token_expired');
    console.warn('findExistingEvents failed, duplicate detection skipped:', response.status);
    return [];
  }
  const data = await response.json();
  return (data.items || [])
    .map(e => ({ id: e.id, key: e.extendedProperties?.private?.mindflow_session_key }))
    .filter(x => x.key);
}

/**
 * Export generated study sessions to Google Calendar.
 * Syncs ALL weeks at once.
 *
 * @param {string} accessToken       OAuth access token
 * @param {string[]} weekStartISOs   Array of week Monday ISO dates to sync
 * @param {object} weekResults       All week results keyed by weekStartISO
 * @param {(current: number, total: number) => void} [onProgress]
 * @returns {Promise<{ created: number, skipped: number, failed: number, events: object[] }>}
 */
export async function exportSessions(accessToken, weekStartISOs, weekResults, onProgress = null) {
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
  const earliest = [...weekStartISOs].sort()[0];
  const latest = (() => {
    const d = new Date([...weekStartISOs].sort().pop() + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const existingEvents = await findExistingEvents(accessToken, earliest, latest);
  const existingKeys = new Set(existingEvents.map(e => e.key));

  const created = [];
  let skipped = 0;
  let failed = 0;
  let processed = 0;

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

      // Skip if this exact session was already synced (duplicate detection)
      const sessionKey = `${session.task.id}::${weekStart}::${dayName}::${session.startTick}`;
      if (existingKeys.has(sessionKey)) {
        skipped++;
        continue;
      }

      const payload = buildEventPayload(
        session,
        session.task,
        startDate.toISOString(),
        endDate.toISOString(),
        sessionKey,
      );

      try {
        const response = await fetch(CALENDAR_API + '/calendars/primary/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: timeoutSignal(30000),
        });

        if (response.status === 401) throw new Error('token_expired');
        if (response.status === 403) throw new Error('permission_denied');
        if (response.status === 429) {
          // Rate limited — honor the server's Retry-After, wait and retry once
          await new Promise(r => setTimeout(r, retryDelayFrom(response)));
          const retry = await fetch(CALENDAR_API + '/calendars/primary/events', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: timeoutSignal(30000),
          });
          if (retry.status === 401) throw new Error('token_expired');
          if (retry.status === 403) throw new Error('permission_denied');
          if (!retry.ok) { failed++; continue; }
          const data = await retry.json();
          created.push({ googleEventId: data.id, dayName, startTick: session.startTick, weekStart });
          continue;
        }
        if (!response.ok) { failed++; continue; }

        const data = await response.json();
        created.push({ googleEventId: data.id, dayName, startTick: session.startTick, weekStart });
      } catch (err) {
        // A dead token (401) or revoked scope (403) must surface to the UI
        // so it can sign out and re-auth — counting it as a generic
        // failure left the user stuck on "{n} failed" forever.
        if (err?.message === 'token_expired' || err?.message === 'permission_denied') throw err;
        failed++;
      }
      processed++;
      if (onProgress) onProgress(processed, flat.length);
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
        signal: timeoutSignal(30000),
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
