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
 * GET with one retry on transient failures (5xx / network). 4xx errors
 * pass straight through — a 401 must surface immediately so the token
 * refresh path runs instead of a pointless retry. Fixes the production
 * "first refresh failed, second worked" import flakiness.
 */
async function fetchWithRetry(url, opts, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, opts);
      if (response.ok || response.status < 500) return response;
      lastErr = response;
    } catch (err) {
      lastErr = err;
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 300));
  }
  if (lastErr instanceof Error) throw lastErr;
  return lastErr;
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

/**
 * Timezone of events written to Google Calendar. Falls back to
 * Asia/Hong_Kong — the user's calendar lives there regardless of where the
 * browser happens to run (the browser machine zone produced events shifted
 * by 15h, e.g. Sat 10:00 → Sun 01:00).
 */
export const DEFAULT_CALENDAR_TIME_ZONE = 'Asia/Hong_Kong';

/**
 * The primary calendar's timezone, read from the Calendar API — preferred
 * over the default because a user's calendar may genuinely live in another
 * zone. Non-token failures degrade to null (caller falls back to the
 * default); 401/403 must surface so the caller refreshes the token.
 */
async function fetchPrimaryCalendarTimeZone(accessToken) {
  const url = new URL(CALENDAR_API + '/calendars/primary');
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: timeoutSignal(30000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('token_expired');
    if (response.status === 403) throw new Error('permission_denied');
    return null;
  }
  const data = await response.json();
  return typeof data.timeZone === 'string' && data.timeZone !== '' ? data.timeZone : null;
}

/**
 * Build the UTC ISO instant for a wall-clock time in an arbitrary IANA
 * timezone — WITHOUT touching the browser machine's zone. Fixpoint
 * iteration over Intl.DateTimeFormat (2–3 passes converge).
 *
 * Example: zonedISOFromParts(2026, 8, 29, 10, 0, 'Asia/Hong_Kong')
 *   → '2026-08-29T02:00:00.000Z' (HK is UTC+8, no DST) — regardless of
 *   the machine's own timezone.
 */
export function zonedISOFromParts(y, m, d, hh, mm, timeZone) {
  const pad = (n) => String(n).padStart(2, '0');
  const target = `${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(mm)}`;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 3; i++) {
    const parts = fmt.formatToParts(new Date(guess));
    const get = (type) => Number(parts.find(p => p.type === type).value);
    const got = `${get('year')}-${pad(get('month'))}-${pad(get('day'))} ${pad(get('hour'))}:${pad(get('minute'))}`;
    if (got === target) return new Date(guess).toISOString();
    guess += Date.UTC(y, m - 1, d, hh, mm)
      - Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  }
  return new Date(guess).toISOString();
}

/**
 * Split an instant into calendar parts in a target IANA zone — the
 * inverse of zonedISOFromParts. Used to map imported event instants to
 * the grid's day/hour in the CALENDAR's zone, never the machine's.
 */
export function zonedPartsFromInstant(instantMs, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(new Date(instantMs));
  const get = (type) => parts.find(p => p.type === type)?.value;
  return {
    weekday: get('weekday'), // 'Mon'…'Sun' — matches the dayMap keys
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
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

  const response = await fetchWithRetry(url.toString(), {
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
      timeZone: typeof c.timeZone === 'string' && c.timeZone !== '' ? c.timeZone : null,
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
  const ids = Array.isArray(calendarIds) && calendarIds.length > 0 ? calendarIds : ['primary'];
  const metaById = new Map((Array.isArray(calendarMeta) ? calendarMeta : []).map(c => [c?.id, c]));

  // The week window and the event→day mapping must use the CALENDAR's
  // timezone (prefer the primary calendar's, fall back to
  // Asia/Hong_Kong) — never the browser machine zone. A HK calendar
  // viewed from a LA browser otherwise shifts every event a day.
  const primaryEntry = [...metaById.values()].find(c => c?.primary) || null;
  const timeZone = primaryEntry?.timeZone
    || await fetchPrimaryCalendarTimeZone(accessToken)
    || DEFAULT_CALENDAR_TIME_ZONE;

  // Mon 00:00 → next Mon 00:00 in the calendar's zone
  const [wy, wm, wd] = weekStartISO.split('-').map(Number);
  const weDate = new Date(wy, wm - 1, wd + 7);
  const timeMin = zonedISOFromParts(wy, wm, wd, 0, 0, timeZone);
  const timeMax = zonedISOFromParts(weDate.getFullYear(), weDate.getMonth() + 1, weDate.getDate(), 0, 0, timeZone);

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

    const response = await fetchWithRetry(url.toString(), {
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
      timeZone: meta?.timeZone || timeZone,
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
 * @param {{ calendarName?: string, calendarColor?: string, timeZone?: string }} [opts]
 *   Source calendar metadata — attached to every block so the UI can
 *   color-code by calendar (PRD step 91) instead of by event type.
 *   timeZone maps events to grid days/hours in the CALENDAR's zone
 *   (machine zone only when absent — pure-function callers like tests).
 */
export function mapToCalendarBlocks(events, weekStartISO, opts = {}) {
  const { calendarName = null, calendarColor = null, timeZone = null } = opts || {};
  const visibleStartH = DAY_START_TICK / 6; // 6am
  const visibleEndH = DAY_END_TICK / 6; // 10pm
  const blocks = [];
  // Week window: in the calendar's zone when known, else machine-local
  // (DST-safe end: setDate handles the shift).
  let weekStart;
  let weekEnd;
  if (timeZone) {
    const [wy, wm, wd] = weekStartISO.split('-').map(Number);
    const weDate = new Date(wy, wm - 1, wd + 7);
    weekStart = new Date(zonedISOFromParts(wy, wm, wd, 0, 0, timeZone));
    weekEnd = new Date(zonedISOFromParts(weDate.getFullYear(), weDate.getMonth() + 1, weDate.getDate(), 0, 0, timeZone));
  } else {
    weekStart = new Date(weekStartISO + 'T00:00:00');
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
  }
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
      let day;
      let startHour;
      let durationHours;
      if (timeZone) {
        // Calendar-zone wall time — a Sat 10:00 HK event must land on
        // Sat 10:00 in the grid even when the browser runs in LA.
        const sp = zonedPartsFromInstant(startDt.getTime(), timeZone);
        day = sp.weekday;
        startHour = sp.hour + sp.minute / 60;
        durationHours = (endDt.getTime() - startDt.getTime()) / 3600000;
      } else {
        day = dayMap[startDt.getDay()];
        startHour = startDt.getHours() + startDt.getMinutes() / 60;
        durationHours = (endDt - startDt) / 3600000;
      }

      // Only include if within the target week
      if (startDt >= weekStart && startDt < weekEnd) {

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
 *
 * start.timeZone / end.timeZone must match the calendar's zone — using the
 * browser machine zone made events land 15h off on calendar.google.com
 * (Sat 10:00 HK became Sun 01:00).
 */
function buildEventPayload(session, task, startISO, endISO, sessionKey, timeZone) {
  return {
    summary: task.title,
    start: { dateTime: startISO, timeZone },
    end: { dateTime: endISO, timeZone },
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
 * @param {Set<string>} [alreadySyncedKeys] Session keys already present in
 *   local tracking — skipped before any API call (local idempotence).
 * @returns {Promise<{ created: number, skipped: number, failed: number, events: object[] }>}
 */
export async function exportSessions(accessToken, weekStartISOs, weekResults, onProgress = null, alreadySyncedKeys = null) {
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

  // Events are written in the primary calendar's timezone (fallback:
  // Asia/Hong_Kong) — never the browser machine zone.
  const timeZone = await fetchPrimaryCalendarTimeZone(accessToken) || DEFAULT_CALENDAR_TIME_ZONE;

  // Find existing MindFlow events to skip (duplicate detection)
  const earliest = [...weekStartISOs].sort()[0];
  const latest = (() => {
    const d = new Date([...weekStartISOs].sort().pop() + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const existingEvents = await findExistingEvents(accessToken, earliest, latest);
  const existingKeys = new Set(existingEvents.map(e => e.key));
  const localKeys = alreadySyncedKeys instanceof Set ? alreadySyncedKeys : new Set();

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

      // Skip if end time > 10pm or start time < 6am (clamped out)
      if (session.startTick < 36 || session.endTick > 132) {
        skipped++;
        continue;
      }

      // Skip if this exact session was already synced (duplicate detection —
      // both the API's mindflow_session_key and the local tracking store)
      const sessionKey = `${session.task.id}::${weekStart}::${dayName}::${session.startTick}`;
      if (existingKeys.has(sessionKey) || localKeys.has(sessionKey)) {
        skipped++;
        continue;
      }

      // Wall-clock time in the target calendar zone → UTC instant. The
      // grid shows Sat 10:00; the event must BE Sat 10:00 in that zone.
      const [wy, wm, wd] = weekStart.split('-').map(Number);
      const date = new Date(wy, wm - 1, wd + dayIdx);
      const startMin = session.startTick * 10;
      const endMin = session.endTick * 10;
      const startISO = zonedISOFromParts(
        date.getFullYear(), date.getMonth() + 1, date.getDate(),
        Math.floor(startMin / 60), startMin % 60, timeZone,
      );
      const endISO = zonedISOFromParts(
        date.getFullYear(), date.getMonth() + 1, date.getDate(),
        Math.floor(endMin / 60), endMin % 60, timeZone,
      );

      const payload = buildEventPayload(
        session,
        session.task,
        startISO,
        endISO,
        sessionKey,
        timeZone,
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
          created.push({ googleEventId: data.id, dayName, startTick: session.startTick, weekStart, taskId: session.task.id, sessionKey });
          continue;
        }
        if (!response.ok) { failed++; continue; }

        const data = await response.json();
        // taskId + sessionKey ride along so a single task deletion can find
        // and calendar.events.delete exactly its own events later.
        created.push({ googleEventId: data.id, dayName, startTick: session.startTick, weekStart, taskId: session.task.id, sessionKey });
      } catch (err) {
        // A dead token (401) or revoked scope (403) must surface to the UI
        // so it can refresh and retry — counting it as a generic failure
        // left the user stuck on "{n} failed" forever.
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
/**
 * Delete tracked Google events (bulk Remove / per-task unsync).
 *
 * @param {string} accessToken
 * @param {object[]} events  [{ googleEventId }]
 * @param {() => Promise<string>} [on401] Optional token refresh callback —
 *   a mid-batch 401 refreshes the token ONCE and retries that event
 *   instead of aborting the whole batch (the production Remove failure:
 *   one dead token killed the batch and bounced the UI to Connect).
 * @returns {Promise<{ deleted: number, failed: number }>}
 */
export async function deleteSyncedEvents(accessToken, events, on401 = null) {
  let deleted = 0;
  let failed = 0;
  let token = accessToken;
  let refreshed = false;

  const doDelete = async (evt) => {
    const response = await fetch(CALENDAR_API + `/calendars/primary/events/${evt.googleEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: timeoutSignal(30000),
    });
    if (response.ok || response.status === 410 || response.status === 404) {
      // 410/404 = already gone — treat as success so stale mappings
      // clear instead of blocking every future unsync.
      return 'deleted';
    }
    if (response.status === 401 && on401 && !refreshed) {
      refreshed = true; // one refresh per batch, not per event
      token = await on401();
      return 'retry';
    }
    if (response.status === 401) return 'token_expired';
    if (response.status === 403) return 'permission_denied';
    return 'failed';
  };

  for (const evt of events) {
    try {
      let outcome = await doDelete(evt);
      if (outcome === 'retry') outcome = await doDelete(evt); // retry once with the fresh token
      if (outcome === 'deleted') deleted++;
      else if (outcome === 'failed') failed++;
      else throw new Error(outcome);
    } catch (err) {
      if (err.message === 'token_expired' || err.message === 'permission_denied') throw err;
      failed++;
    }
  }

  return { deleted, failed };
}

/**
 * Delete every Google event mapped to one task (per-event unsync).
 *
 * The tracking store maps weekStart → { events: [{ googleEventId,
 * taskId, sessionKey, ... }] }. Only entries with a matching taskId are
 * deleted; mappings are removed from the store ONLY for events the API
 * confirmed gone (2xx/404/410) — a failed delete keeps its mapping so a
 * later retry or bulk Remove can still clean it up.
 *
 * @param {string} accessToken
 * @param {string} taskId
 * @param {object} tracking  Export tracking (loadGoogleExport() shape)
 * @param {() => Promise<string>} [on401] Token refresh callback for
 *   mid-batch 401s (same contract as deleteSyncedEvents)
 * @returns {Promise<{ tracking: object, deleted: number, failed: number }>}
 */
export async function unsyncTaskEvents(accessToken, taskId, tracking, on401 = null) {
  const entries = Object.entries(tracking || {});
  const matches = entries.flatMap(([week, entry]) =>
    (entry?.events || [])
      .filter(ev => ev && ev.taskId === taskId && typeof ev.googleEventId === 'string')
      .map(ev => ({ week, ev })),
  );

  if (matches.length === 0) return { tracking: tracking || {}, deleted: 0, failed: 0 };

  const res = await deleteSyncedEvents(accessToken, matches.map(m => m.ev), on401);
  if (res.failed > 0) return { tracking: tracking || {}, deleted: res.deleted, failed: res.failed };

  // All matched events confirmed gone — drop them from the tracking store.
  const deletedIds = new Set(matches.map(m => m.ev.googleEventId));
  const next = {};
  for (const [week, entry] of entries) {
    const kept = (entry?.events || []).filter(ev => !deletedIds.has(ev.googleEventId));
    if (kept.length > 0) next[week] = { ...entry, events: kept };
  }
  return { tracking: next, deleted: res.deleted, failed: 0 };
}
