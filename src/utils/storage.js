const KEYS = {
  CALIBRATION: 'mindflow_calibration',
  CALENDAR: 'mindflow_calendar',
  TASKS: 'mindflow_tasks',
  SETTINGS: 'mindflow_settings',
  GOOGLE_CACHE: 'mindflow_google_cache',
  GOOGLE_EXPORT: 'mindflow_google_export',
};

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
  try { const d = localStorage.getItem(KEYS.CALENDAR); if (!d) return []; const p = JSON.parse(d); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function saveTasks(tasks) {
  try { localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks)); } catch (e) { console.warn('localStorage full, tasks not saved:', e); return false; } return true;
}
export function loadTasks() {
  try { const d = localStorage.getItem(KEYS.TASKS); if (!d) return []; const p = JSON.parse(d); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); } catch (e) { console.warn('localStorage full, settings not saved:', e); return false; } return true;
}
export function loadSettings() {
  try {
    const d = localStorage.getItem(KEYS.SETTINGS);
    if (d) {
      const parsed = JSON.parse(d);
      // Guard against corrupt / non-object stored values
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return { chronotype: 'morning', maxHoursPerDay: 8, maxHoursWeekend: 4 };
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
    return p && typeof p === 'object' && Array.isArray(p.data) ? p : null;
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
    return d ? JSON.parse(d) : {};
  } catch { return {}; }
}

export function clearGoogleExport() {
  try { localStorage.removeItem(KEYS.GOOGLE_EXPORT); } catch {}
}
