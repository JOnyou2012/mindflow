const KEYS = {
  CALIBRATION: 'mindflow_calibration',
  CALENDAR: 'mindflow_calendar',
  TASKS: 'mindflow_tasks',
  SETTINGS: 'mindflow_settings',
};

export function saveCalibration(cal) {
  try { if (cal) localStorage.setItem(KEYS.CALIBRATION, JSON.stringify(cal)); } catch {}
}
export function loadCalibration() {
  try { const d = localStorage.getItem(KEYS.CALIBRATION); return d ? JSON.parse(d) : null; } catch { return null; }
}

export function saveCalendar(blocks) {
  try { localStorage.setItem(KEYS.CALENDAR, JSON.stringify(blocks)); } catch {}
}
export function loadCalendar() {
  try { const d = localStorage.getItem(KEYS.CALENDAR); if (!d) return []; const p = JSON.parse(d); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function saveTasks(tasks) {
  try { localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks)); } catch {}
}
export function loadTasks() {
  try { const d = localStorage.getItem(KEYS.TASKS); if (!d) return []; const p = JSON.parse(d); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); } catch {}
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
