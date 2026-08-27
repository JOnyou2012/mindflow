/**
 * Test suite for src/utils/googleCalendar.js
 *
 * Covers PRD steps 90–93 (multi-calendar sync, clipped events,
 * Retry-After handling) — pure mapping functions plus fetch-based
 * helpers exercised through a mocked global fetch.
 * Run: node tests/google-calendar.test.js
 */

import {
  fetchWeekEvents,
  fetchCalendarList,
  mapToCalendarBlocks,
  retryDelayFrom,
  exportSessions,
} from '../src/utils/googleCalendar.js';

// ---------------------------------------------------------------------------
// Test harness (same shape as the other suites)
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
// Setup helpers — all dates built with the LOCAL Date constructor so the
// suite is deterministic in any timezone.
// ---------------------------------------------------------------------------

// 2026-08-24 is a Monday
const WEEK = '2026-08-24';

// Local instant → ISO string that parses back to the same local time
function localISO(y, m, d, hh, mm = 0) {
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

function makeTimedEvent(overrides = {}) {
  // Accept either an ISO string or a full { dateTime } object for
  // start/end — the Google API shape uses the object form. start/end are
  // destructured out so the trailing spread can't overwrite the wrapped
  // values with raw strings.
  const { start: startOverride, end: endOverride, ...rest } = overrides;
  const wrap = (v, fallbackISO) => (typeof v === 'string' ? { dateTime: v } : v || { dateTime: fallbackISO });
  return {
    id: rest.id || 'e-timed',
    summary: rest.summary || 'Test Event',
    start: wrap(startOverride, localISO(2026, 8, 24, 9, 0)),
    end: wrap(endOverride, localISO(2026, 8, 24, 10, 0)),
    ...rest,
  };
}

// Stub global fetch: routes match on URL substring + method, handlers
// return { status, body, headers }. Restores the original when called.
function mockFetch(routes) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    for (const [pattern, m, handler] of routes) {
      if (u.includes(pattern) && (m === '*' || m === method)) {
        const res = await handler(u, opts);
        return {
          ok: res.status >= 200 && res.status < 300,
          status: res.status,
          json: async () => res.body,
          headers: { get: (k) => (res.headers && res.headers[k]) ?? null },
        };
      }
    }
    return { ok: false, status: 404, json: async () => ({}), headers: { get: () => null } };
  };
  return () => { globalThis.fetch = orig; };
}

// ---------------------------------------------------------------------------
// mapToCalendarBlocks — timed events
// ---------------------------------------------------------------------------

{
  const blocks = mapToCalendarBlocks([makeTimedEvent()], WEEK);

  assert(blocks.length === 1, 'timed event inside the week maps to one block');
  assert(blocks[0].day === 'Mon', 'Monday event maps to day "Mon"');
  assert(blocks[0].startHour === 9 && blocks[0].durationHours === 1, 'startHour/durationHours extracted');
  assert(blocks[0].clipped === undefined, 'fully visible event has no clipped flag');
  assert(blocks[0].isAllDay === false, 'timed event flagged isAllDay false');
  assert(blocks[0].source === 'google' && blocks[0].isFixed === true, 'google source + fixed block flags');
}

{
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    start: localISO(2026, 8, 24, 5, 30),
    end: localISO(2026, 8, 24, 7, 0),
  })], WEEK);

  assert(blocks.length === 1, 'partially-before event still mapped');
  assert(blocks[0].startHour === 6 && blocks[0].durationHours === 1, 'early event clipped to 6:00–7:00');
  assert(blocks[0].clipped === 'early', 'clipped flag = early');
}

{
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    start: localISO(2026, 8, 24, 21, 0),
    end: localISO(2026, 8, 24, 23, 0),
  })], WEEK);

  assert(blocks.length === 1, 'partially-after event still mapped');
  assert(blocks[0].startHour === 21 && blocks[0].durationHours === 1, 'late event clipped to 21:00–22:00');
  assert(blocks[0].clipped === 'late', 'clipped flag = late');
}

{
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    start: localISO(2026, 8, 24, 5, 0),
    end: localISO(2026, 8, 24, 23, 0),
  })], WEEK);

  assert(blocks.length === 1, 'wraparound event still mapped');
  assert(blocks[0].startHour === 6 && blocks[0].durationHours === 16, 'both-side clip → full 6:00–22:00 block');
  assert(blocks[0].clipped === 'both', 'clipped flag = both');
}

{
  // 00:00–01:00 is entirely outside the 6am–10pm window → dropped
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    start: localISO(2026, 8, 24, 0, 0),
    end: localISO(2026, 8, 24, 1, 0),
  })], WEEK);
  assert(blocks.length === 0, 'event fully outside 6:00–22:00 produces no block');
}

{
  // Sunday 21:00–23:00 falls inside the week (Mon 00:00 → next Mon 00:00)
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    start: localISO(2026, 8, 30, 21, 0),
    end: localISO(2026, 8, 30, 23, 0),
  })], WEEK);
  assert(blocks.length === 1 && blocks[0].day === 'Sun', 'Sunday evening event included (week runs through Sunday)');
  assert(blocks[0].clipped === 'late', 'Sunday late-evening event flagged clipped late');
}

{
  // 23:30 on Sunday starts after the visible window → no block at all
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    start: localISO(2026, 8, 30, 23, 30),
    end: localISO(2026, 8, 31, 0, 30),
  })], WEEK);
  assert(blocks.length === 0, 'event fully after 22:00 produces no block');
}

{
  // Next Monday 00:30 is outside the week → dropped
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    start: localISO(2026, 8, 31, 0, 30),
    end: localISO(2026, 8, 31, 1, 30),
  })], WEEK);
  assert(blocks.length === 0, 'next-Monday event excluded');
}

// ---------------------------------------------------------------------------
// mapToCalendarBlocks — all-day events
// ---------------------------------------------------------------------------

{
  const blocks = mapToCalendarBlocks([{
    id: 'e-allday',
    summary: 'Holiday',
    start: { date: '2026-08-24' },
    end: { date: '2026-08-25' },
  }], WEEK);

  assert(blocks.length === 1, 'single-day all-day event maps to one block');
  assert(blocks[0].isAllDay === true, 'all-day flag set');
  assert(blocks[0].startHour === 6 && blocks[0].durationHours === 16, 'all-day spans the full 6:00–22:00 window');
  assert(blocks[0].id === 'gcal-e-allday-2026-08-24', 'all-day block id includes the date');
  assert(blocks[0].clipped === undefined, 'all-day events are not clipped-flagged');
}

{
  const blocks = mapToCalendarBlocks([{
    id: 'e-multi',
    summary: 'Trip',
    start: { date: '2026-08-24' },
    end: { date: '2026-08-26' },
  }], WEEK);

  assert(blocks.length === 2, 'multi-day all-day event split into per-day blocks');
  assert(blocks[0].day === 'Mon' && blocks[1].day === 'Tue', 'split blocks land on consecutive days');
}

{
  // All-day event crossing the week boundary: only in-week days appear
  const blocks = mapToCalendarBlocks([{
    id: 'e-boundary',
    summary: 'Crossing',
    start: { date: '2026-08-29' },
    end: { date: '2026-09-01' },
  }], WEEK);

  assert(blocks.length === 2, 'boundary-crossing all-day event only yields in-week days');
  assert(blocks[0].day === 'Sat' && blocks[1].day === 'Sun', 'in-week days are Sat + Sun');
}

// ---------------------------------------------------------------------------
// mapToCalendarBlocks — cancelled / recurring / metadata
// ---------------------------------------------------------------------------

{
  const blocks = mapToCalendarBlocks([makeTimedEvent({ id: 'e-cancel', status: 'cancelled' })], WEEK);
  assert(blocks.length === 0, 'cancelled event skipped');
}

{
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    id: 'e-rec',
    recurringEventId: 'e-rec_20260817',
    recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
  })], WEEK);

  assert(blocks.length === 1, 'expanded recurring instance mapped');
  assert(blocks[0].recurrenceRule === 'RRULE:FREQ=WEEKLY;COUNT=10', 'recurrence rule carried on the block');
}

{
  const blocks = mapToCalendarBlocks([makeTimedEvent({
    organizer: { displayName: 'Organizer Name' },
  })], WEEK);

  assert(blocks[0].googleCalendarName === 'Organizer Name', 'organizer name used when no calendar name given');
  assert(blocks[0].googleCalendarColor === null, 'no color when no calendar metadata given');
}

{
  const blocks = mapToCalendarBlocks([makeTimedEvent()], WEEK, {
    calendarName: 'Work',
    calendarColor: '#0b8043',
  });

  assert(blocks[0].googleCalendarName === 'Work', 'explicit calendar name wins over organizer');
  assert(blocks[0].googleCalendarColor === '#0b8043', 'calendar color attached to block');
}

// ---------------------------------------------------------------------------
// retryDelayFrom — Retry-After parsing (PRD step 93)
// ---------------------------------------------------------------------------

{
  const res = (header) => ({ headers: { get: (k) => (k === 'Retry-After' ? header : null) } });

  assert(retryDelayFrom(res('2')) === 2000, 'delta-seconds header parsed');
  assert(retryDelayFrom(res(' 5 ')) === 5000, 'whitespace around delta-seconds tolerated');
  assert(retryDelayFrom(res('0')) === 1000, 'zero clamped to the 1s minimum');
  assert(retryDelayFrom(res('999')) === 30000, 'huge values clamped to the 30s maximum');

  const soon = new Date(Date.now() + 5000).toUTCString();
  const d = retryDelayFrom(res(soon));
  assert(d >= 4000 && d <= 6000, 'HTTP-date header parsed as future delay');

  assert(retryDelayFrom(res(new Date(Date.now() - 10000).toUTCString())) === 5000, 'past HTTP-date falls back');
  assert(retryDelayFrom(res('not-a-date')) === 5000, 'unparseable header falls back');
  assert(retryDelayFrom(res(null)) === 5000, 'missing header falls back to default');
  assert(retryDelayFrom({ headers: { get: () => null } }, 7000) === 7000, 'custom fallback respected');
}

// ---------------------------------------------------------------------------
// fetchCalendarList — filtering + sanitization
// ---------------------------------------------------------------------------

{
  const restore = mockFetch([
    ['/users/me/calendarList', 'GET', async () => ({
      status: 200,
      body: {
        items: [
          { id: 'calA', summary: 'Work', backgroundColor: '#0b8043', accessRole: 'owner', primary: true },
          { id: 'calB', summary: 'Gym', backgroundColor: '#007bff', accessRole: 'reader' },
          { id: 'calC', summary: 'Override', summaryOverride: 'Renamed', backgroundColor: '#039be5', accessRole: 'writer' },
          { id: 'calD', summary: 'Holidays', accessRole: 'freeBusyReader' },
          { id: 'calE', summary: 'Bad color', backgroundColor: 'javascript:alert(1)', accessRole: 'reader' },
          { id: 'calF', summary: 'No access', accessRole: 'none' },
          null, // corrupted entry — dropped
        ],
      },
    })],
  ]);

  try {
    const list = await fetchCalendarList('token');
    assert(list.length === 4, 'freeBusyReader/none/corrupted entries filtered out');
    assert(list[0].id === 'calA' && list[0].primary === true, 'primary calendar kept');
    assert(list[2].summary === 'Renamed', 'summaryOverride wins over summary');
    assert(list.find(c => c.id === 'calD') === undefined, 'freeBusyReader excluded (cannot read events)');
    assert(list.find(c => c.id === 'calE').backgroundColor === null, 'non-hex color sanitized to null');
  } finally {
    restore();
  }
}

{
  const restore = mockFetch([
    ['/users/me/calendarList', 'GET', async () => ({ status: 401, body: {} })],
  ]);
  try {
    let threw = null;
    await fetchCalendarList('token').catch(e => { threw = e; });
    assert(threw?.message === 'token_expired', 'calendarList 401 → token_expired');
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------------------
// fetchWeekEvents — multi-calendar merge, dedupe, partial failure
// ---------------------------------------------------------------------------

{
  const eventFor = (id, start, end) => makeTimedEvent({ id, start, end });
  const restore = mockFetch([
    ['/calendars/calA/events', 'GET', async () => ({
      status: 200,
      body: { summary: 'Work', items: [eventFor('eA', localISO(2026, 8, 24, 9, 0), localISO(2026, 8, 24, 10, 0))] },
    })],
    ['/calendars/calB/events', 'GET', async () => ({
      status: 200,
      body: { summary: 'Gym', items: [eventFor('eB', localISO(2026, 8, 24, 15, 0), localISO(2026, 8, 24, 16, 0))] },
    })],
  ]);

  try {
    const meta = [
      { id: 'calA', summary: 'Work', backgroundColor: '#0b8043' },
      { id: 'calB', summary: 'Gym', backgroundColor: '#007bff' },
    ];
    const { blocks, eventCount, calendarNames, failures } = await fetchWeekEvents('token', WEEK, ['calA', 'calB'], meta);

    assert(eventCount === 2, 'events counted across both calendars');
    assert(blocks.length === 2, 'blocks merged from both calendars');
    assert(calendarNames.length === 2 && calendarNames[0] === 'Work' && calendarNames[1] === 'Gym', 'per-calendar names reported');
    assert(failures === 0, 'no failures when all calendars succeed');
    assert(blocks[0].googleCalendarName === 'Work' && blocks[0].googleCalendarColor === '#0b8043', 'calendar meta attached to blocks');
    assert(blocks[1].googleCalendarName === 'Gym' && blocks[1].googleCalendarColor === '#007bff', 'second calendar meta attached');
  } finally {
    restore();
  }
}

{
  // Same event id returned by two calendars (duplicate subscription) — merged once
  const event = makeTimedEvent({ id: 'eShared' });
  const restore = mockFetch([
    ['/calendars/calA/events', 'GET', async () => ({ status: 200, body: { summary: 'A', items: [event] } })],
    ['/calendars/calB/events', 'GET', async () => ({ status: 200, body: { summary: 'B', items: [event] } })],
  ]);
  try {
    const { blocks } = await fetchWeekEvents('token', WEEK, ['calA', 'calB']);
    assert(blocks.length === 1, 'identical event from two calendars deduped');
  } finally {
    restore();
  }
}

{
  // One calendar gone (404) — the other still imports
  const event = makeTimedEvent({ id: 'eA' });
  const restore = mockFetch([
    ['/calendars/calA/events', 'GET', async () => ({ status: 200, body: { summary: 'A', items: [event] } })],
    ['/calendars/calB/events', 'GET', async () => ({ status: 404, body: {} })],
  ]);
  try {
    const { blocks, failures, calendarNames } = await fetchWeekEvents('token', WEEK, ['calA', 'calB']);
    assert(blocks.length === 1 && failures === 1, 'deleted calendar skipped, healthy one imported');
    assert(calendarNames.length === 1, 'only successful calendar named');
  } finally {
    restore();
  }
}

{
  // All calendars fail → surface an error rather than a silent empty week
  const restore = mockFetch([
    ['/calendars/calA/events', 'GET', async () => ({ status: 404, body: {} })],
    ['/calendars/calB/events', 'GET', async () => ({ status: 500, body: {} })],
  ]);
  try {
    let threw = null;
    await fetchWeekEvents('token', WEEK, ['calA', 'calB']).catch(e => { threw = e; });
    assert(threw !== null && threw.message.includes('failed'), 'all-calendars-failed error surfaced');
  } finally {
    restore();
  }
}

{
  const restore = mockFetch([
    ['/calendars/calA/events', 'GET', async () => ({ status: 401, body: {} })],
  ]);
  try {
    let threw = null;
    await fetchWeekEvents('token', WEEK, ['calA']).catch(e => { threw = e; });
    assert(threw?.message === 'token_expired', 'events 401 → token_expired');
  } finally {
    restore();
  }
}

{
  // No calendarIds → defaults to primary (backward compatibility)
  const event = makeTimedEvent({ id: 'ePrimary' });
  const restore = mockFetch([
    ['/calendars/primary/events', 'GET', async () => ({ status: 200, body: { summary: 'Primary', items: [event] } })],
  ]);
  try {
    const { blocks, calendarNames } = await fetchWeekEvents('token', WEEK);
    assert(blocks.length === 1 && calendarNames[0] === 'Primary', 'defaults to primary calendar when no ids given');
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------------------
// exportSessions 429 path — honors Retry-After (via mocked POST sequence).
// Retry-After: 1 forces the 1s clamp; the old fixed 5s wait would take ~5s,
// so elapsed < 4000ms proves the header is honored.
// ---------------------------------------------------------------------------

{
  const session = { startTick: 60, endTick: 66, task: { id: 't1', title: 'Study', type: 'academic', difficulty: 3 } };
  const weekResults = { [WEEK]: { days: { Mon: { sessions: [session] } } } };

  let postCalls = 0;
  const restore = mockFetch([
    ['/calendars/primary/events', 'GET', async () => ({ status: 200, body: { items: [] } })],
    ['/calendars/primary/events', 'POST', async () => {
      postCalls++;
      if (postCalls === 1) return { status: 429, headers: { 'Retry-After': '1' }, body: {} };
      return { status: 200, body: { id: 'created-1' } };
    }],
  ]);

  try {
    const started = Date.now();
    const result = await exportSessions('token', [WEEK], weekResults);
    const elapsed = Date.now() - started;

    assert(postCalls === 2, '429 retried exactly once');
    assert(result.created === 1 && result.failed === 0, 'event created after retry');
    assert(elapsed >= 900, `Retry-After wait actually happened (elapsed ${elapsed}ms)`);
    assert(elapsed < 4000, `Retry-After honored over the old fixed 5s wait (elapsed ${elapsed}ms)`);
  } finally {
    restore();
  }
}

summary();
