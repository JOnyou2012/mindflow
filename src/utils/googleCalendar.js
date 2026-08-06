/**
 * Google Calendar Sync Utility
 *
 * Authenticates via Google Identity Services, fetches calendar events
 * for a given week, and maps them to MindFlow CalendarBlock format.
 *
 * Privacy: access token stored in memory only (never localStorage).
 * Scope: calendar.readonly — no write access.
 */

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let accessToken = null;
let tokenExpiry = 0;

// -- Auth --------------------------------------------------------------------

/**
 * Initialize the Google Identity Services token client.
 * Must be called after the GIS library loads.
 * Returns the client instance — caller stores it.
 */
export function initTokenClient(clientId) {
  if (!clientId) throw new Error('Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID in .env');
  return google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        console.error('Google auth error:', response.error);
        return;
      }
      accessToken = response.access_token;
      tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
    },
  });
}

/**
 * Trigger the OAuth sign-in flow.
 * @param {object} tokenClient - from initTokenClient()
 */
export function signIn(tokenClient) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Token client not initialized'));
    tokenClient.callback = (response) => {
      if (response.error) return reject(new Error(response.error));
      accessToken = response.access_token;
      tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
      resolve({ accessToken, tokenExpiry });
    };
    tokenClient.requestAccessToken();
  });
}

/**
 * Revoke the current token.
 */
export function signOut() {
  if (accessToken) {
    try {
      google.accounts.oauth2.revoke(accessToken);
    } catch {}
  }
  accessToken = null;
  tokenExpiry = 0;
}

/**
 * Check if the user is currently authenticated with a valid token.
 */
export function isSignedIn() {
  return !!accessToken && Date.now() < tokenExpiry;
}

// -- Calendar fetch ----------------------------------------------------------

/**
 * Fetch calendar events for a given ISO week start date (Mon).
 * Returns raw Google Calendar API event objects.
 *
 * @param {string} weekStart - ISO date string (e.g. '2026-08-03')
 * @param {string} calendarId - 'primary' or specific calendar ID
 */
async function fetchWeekEvents(weekStart, calendarId = 'primary') {
  if (!accessToken) throw new Error('Not authenticated');

  // Compute week end (Sunday)
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 7);

  const timeMin = start.toISOString();
  const timeMax = end.toISOString();

  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) { accessToken = null; tokenExpiry = 0; }
    throw new Error(`Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  return data.items || [];
}

// -- Mapping ------------------------------------------------------------------

const GOOGLE_COLOR_MAP = {
  '1': 'academic',   // lavender
  '2': 'academic',   // sage
  '3': 'academic',   // grape
  '4': 'sports',     // flamingo
  '5': 'arts',       // banana
  '6': 'sports',     // tangerine
  '7': 'academic',   // peacock
  '8': 'arts',       // graphite
  '9': 'academic',   // blueberry
  '10': 'academic',  // basil
  '11': 'sports',    // tomato
};

/**
 * Map a Google Calendar event to a MindFlow CalendarBlock.
 */
function mapEventToBlock(event, weekStart) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let startDate, endDate;
  if (event.start.dateTime) {
    startDate = new Date(event.start.dateTime);
    endDate = new Date(event.end.dateTime);
  } else if (event.start.date) {
    // All-day event
    startDate = new Date(event.start.date + 'T00:00:00');
    endDate = new Date(event.end.date + 'T00:00:00');
  } else {
    return null;
  }

  const dayName = DAYS[startDate.getDay()];
  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
  const endHour = endDate.getHours() + endDate.getMinutes() / 60;
  const durationHours = Math.max(0.25, endHour - startHour);

  // Map Google color ID to MindFlow type
  const gColor = event.colorId || '1';
  const type = GOOGLE_COLOR_MAP[gColor] || 'other';

  return {
    id: 'gcal-' + (event.id || crypto.randomUUID()),
    day: dayName,
    startHour,
    durationHours,
    label: event.summary || '(Untitled)',
    type,
    isFixed: true,
    _googleEvent: true,
    _calendarId: event.organizer?.email || 'primary',
  };
}

// -- Public API ---------------------------------------------------------------

/**
 * Sync: fetch Google Calendar events for a given week and return MindFlow blocks.
 *
 * @param {string} weekStart - ISO Monday date
 * @param {object} tokenClient - from initTokenClient()
 * @returns {{ blocks: CalendarBlock[], meta: object }}
 */
export async function syncWeek(weekStart, tokenClient) {
  if (!isSignedIn()) {
    // Try to refresh — if that fails, throw
    if (tokenClient) {
      await signIn(tokenClient);
    } else {
      throw new Error('Not signed in');
    }
  }

  const events = await fetchWeekEvents(weekStart, 'primary');
  const blocks = events
    .map(e => mapEventToBlock(e, weekStart))
    .filter(Boolean);

  return {
    blocks,
    meta: {
      eventCount: events.length,
      blockCount: blocks.length,
      syncedAt: Date.now(),
    },
  };
}

/**
 * Fetch the user's calendar list (for multi-calendar support).
 */
export async function listCalendars() {
  if (!accessToken) throw new Error('Not authenticated');

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Calendar list error: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map(c => ({
    id: c.id,
    name: c.summary,
    primary: c.primary || false,
    backgroundColor: c.backgroundColor,
  }));
}

export { GOOGLE_COLOR_MAP };
