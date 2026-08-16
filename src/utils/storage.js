import { uuid } from './uuid.js';

const KEYS = {
  CALIBRATION: 'mindflow_calibration',
  CALENDAR: 'mindflow_calendar',
  TASKS: 'mindflow_tasks',
  SETTINGS: 'mindflow_settings',
  GOOGLE_CACHE: 'mindflow_google_cache',
  GOOGLE_EXPORT: 'mindflow_google_export',
  SCHEMA_VERSION: 'mindflow_schema_version',
};

// Bump when persisted shapes change; loaders sanitize against old/foreign
// data, and this key gives future migrations a signal to key off.
export const SCHEMA_VERSION = 1;

/** Write the schema version once at app start (best-effort). */
export function stampSchemaVersion() {
  try { localStorage.setItem(KEYS.SCHEMA_VERSION, String(SCHEMA_VERSION)); } catch {}
}

// -- Persisted element sanitization -------------------------------------------
// Returning users carry localStorage written by older builds (or corrupted
// writes). A single bad element — null, a string, an old-schema object —
// crashes the first render that touches it, so loaders must drop or repair
// invalid items rather than trust the array type alone.

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function sanitizeBlock(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  if (typeof b.day !== 'string' || !DAY_NAMES.includes(b.day)) return null;
  const startHour = Number(b.startHour);
  const durationHours = Number(b.durationHours);
  if (!Number.isFinite(startHour) || !Number.isFinite(durationHours)) return null;
  return { ...b, startHour, durationHours };
}

function sanitizeTask(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  if (typeof t.title !== 'string' || t.title.trim() === '') return null;
  const out = { ...t };
  // A missing id (old schema / corrupted write) breaks React keys, edit/
  // delete identity, and export dedupe keys — repair rather than drop.
  if (typeof out.id !== 'string' || out.id === '') out.id = uuid();
  if (!['academic', 'sports', 'arts', 'other'].includes(out.type)) out.type = 'other';
  if (!['high', 'medium', 'low'].includes(out.priority)) delete out.priority;
  for (const key of ['difficulty', 'durationMins', 'priority']) {
    const n = Number(out[key]);
    if (Number.isFinite(n)) out[key] = n; else delete out[key];
  }
  if (typeof out.deadline !== 'string' || out.deadline === '') delete out.deadline;
  return out;
}

export function saveCalibration(cal) {
  try { if (cal) localStorage.setItem(KEYS.CALIBRATION, JSON.stringify(cal)); } catch (e) { console.warn('localStorage full, calibration not saved:', e); return false; } return true;
}
export function loadCalibration() {
  try {
    const d = localStorage.getItem(KEYS.CALIBRATION);
    if (!d) return null;
    const p = JSON.parse(d);
    // Structural validation: must be an object with a numeric alphaScore.
    // Rejects primitives, arrays, and objects missing alphaScore (corrupted data).
    if (p && typeof p === 'object' && !Array.isArray(p) && typeof p.alphaScore === 'number' && Number.isFinite(p.alphaScore)) return p;
    return null;
  } catch { return null; }
}

export function saveCalendar(blocks) {
  try { localStorage.setItem(KEYS.CALENDAR, JSON.stringify(blocks)); } catch (e) { console.warn('localStorage full, calendar not saved:', e); return false; } return true;
}
export function loadCalendar() {
  try {
    const d = localStorage.getItem(KEYS.CALENDAR);
    if (!d) return [];
    const p = JSON.parse(d);
    if (!Array.isArray(p)) return [];
    return p.map(sanitizeBlock).filter(Boolean);
  } catch { return []; }
}

export function saveTasks(tasks) {
  try { localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks)); } catch (e) { console.warn('localStorage full, tasks not saved:', e); return false; } return true;
}
export function loadTasks() {
  try {
    const d = localStorage.getItem(KEYS.TASKS);
    if (!d) return [];
    const p = JSON.parse(d);
    if (!Array.isArray(p)) return [];
    return p.map(sanitizeTask).filter(Boolean);
  } catch { return []; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); } catch (e) { console.warn('localStorage full, settings not saved:', e); return false; } return true;
}
export function loadSettings() {
  const DEFAULTS = { chronotype: 'morning', maxHoursPerDay: 8, maxHoursWeekend: 4 };
  try {
    const d = localStorage.getItem(KEYS.SETTINGS);
    if (d) {
      const parsed = JSON.parse(d);
      // Guard against corrupt / non-object stored values, merge with
      // defaults, and coerce numerics so NaN/strings never reach the
      // scheduler or render blank inputs.
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const clamp = (n, min, max, fallback) => {
          const v = Number(n);
          return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
        };
        return {
          chronotype: ['morning', 'neutral', 'night'].includes(parsed.chronotype)
            ? parsed.chronotype
            : DEFAULTS.chronotype,
          maxHoursPerDay: clamp(parsed.maxHoursPerDay, 1, 16, DEFAULTS.maxHoursPerDay),
          maxHoursWeekend: clamp(parsed.maxHoursWeekend, 0, 12, DEFAULTS.maxHoursWeekend),
        };
      }
    }
  } catch {}
  return { ...DEFAULTS };
}

export function clearAll() {
  Object.values(KEYS).forEach(k => { try { localStorage.removeItem(k); } catch {} });
  try { localStorage.removeItem('mindflow_theme'); } catch {}
  try { localStorage.removeItem('mindflow_accent'); } catch {}
  try { localStorage.removeItem('mindflow_lang'); } catch {}
}

// -- Google Calendar cache (import) -------------------------------------------

export function saveGoogleCache(cache) {
  try {
    if (cache) localStorage.setItem(KEYS.GOOGLE_CACHE, JSON.stringify(cache));
  } catch (e) { console.warn('localStorage full, Google cache not saved:', e); return false; }
  return true;
}

export function loadGoogleCache() {
  try {
    const d = localStorage.getItem(KEYS.GOOGLE_CACHE);
    if (!d) return null;
    const p = JSON.parse(d);
    if (!p || typeof p !== 'object' || Array.isArray(p.data) === false) return null;
    if (typeof p.weekStart !== 'string' || p.weekStart === '') return null;
    return { ...p, data: p.data.map(sanitizeBlock).filter(Boolean) };
  } catch { return null; }
}

export function clearGoogleCache() {
  try { localStorage.removeItem(KEYS.GOOGLE_CACHE); } catch {}
}

// -- Google Calendar export tracking ------------------------------------------

export function saveGoogleExport(data) {
  try {
    if (data) localStorage.setItem(KEYS.GOOGLE_EXPORT, JSON.stringify(data));
  } catch (e) { console.warn('localStorage full, Google export tracking not saved:', e); return false; }
  return true;
}

export function loadGoogleExport() {
  try {
    const d = localStorage.getItem(KEYS.GOOGLE_EXPORT);
    if (!d) return {};
    const p = JSON.parse(d);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
    // Deep-validate: a non-array `events` entry used to throw inside
    // GoogleCalendarExport AFTER the Google events were already created —
    // the user saw "Failed to sync" although the sync succeeded, and the
    // events became orphaned (untracked → not removable via unsync).
    const out = {};
    for (const [week, entry] of Object.entries(p)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const events = Array.isArray(entry.events)
        ? entry.events.filter(e => e && typeof e === 'object' && typeof e.googleEventId === 'string' && e.googleEventId !== '')
        : [];
      out[week] = {
        syncedAt: typeof entry.syncedAt === 'string' ? entry.syncedAt : null,
        events,
      };
    }
    return out;
  } catch { return {}; }
}

export function clearGoogleExport() {
  try { localStorage.removeItem(KEYS.GOOGLE_EXPORT); } catch {}
}
