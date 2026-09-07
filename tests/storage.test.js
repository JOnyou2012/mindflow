/**
 * Storage sanitizer regression tests — the sanitizers are the last line
 * of defense against corrupted/legacy localStorage. Two production bugs
 * lived here with zero coverage: sanitizeTask stripped every valid string
 * priority on load (Number('high') → NaN → delete), and sanitizeBlock
 * accepted negative durations that the PNG exporter rendered as phantom
 * chips (fixed 2026-09-07).
 *
 * Run: node tests/storage.test.js
 */

import {
  saveTasks, loadTasks,
  saveCalendar, loadCalendar,
  saveGoogleCalendars, loadGoogleCalendars, hasStoredGoogleCalendars, clearGoogleCalendars,
} from '../src/utils/storage.js';

// -- Minimal localStorage shim (Node has no localStorage) --------------------

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

// -- Tiny runner --------------------------------------------------------------

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ FAIL: ${label}`); }
}

// ===========================================================================
// 1. sanitizeTask — string priorities must survive a save/load round trip
// ===========================================================================

console.log('\n📋 1. sanitizeTask priorities');

{
  saveTasks([
    { id: 't-high', title: 'High', type: 'academic', priority: 'high', difficulty: 4, durationMins: 60 },
    { id: 't-med', title: 'Med', type: 'sports', priority: 'medium', difficulty: 2 },
    { id: 't-low', title: 'Low', type: 'arts', priority: 'low' },
  ]);
  const loaded = loadTasks();
  const byId = Object.fromEntries(loaded.map(t => [t.id, t]));
  assert(loaded.length === 3, 'S1.1: all 3 tasks survive the round trip');
  assert(byId['t-high']?.priority === 'high', 'S1.2: high priority survives load');
  assert(byId['t-med']?.priority === 'medium', 'S1.3: medium priority survives load');
  assert(byId['t-low']?.priority === 'low', 'S1.4: low priority survives load');
  assert(byId['t-high']?.difficulty === 4, 'S1.5: numeric difficulty survives load');
  assert(byId['t-low']?.difficulty === undefined, 'S1.6: missing difficulty stays absent');
}

{
  // Invalid priority is dropped (falls back to 'medium' downstream),
  // missing ids are repaired, malformed entries are dropped.
  saveTasks([
    { id: 't-a', title: 'A', priority: 'urgent', type: 'academic' },
    { title: 'No id', priority: 'high', type: 'academic' },
    null,
    'garbage',
    { id: 't-b', title: '', type: 'academic' },
  ]);
  const loaded = loadTasks();
  assert(loaded.length === 2, 'S1.7: malformed entries dropped (2 of 5 survive)');
  assert(!('priority' in loaded[0]), 'S1.8: invalid priority deleted');
  const noId = loaded.find(t => t.title === 'No id');
  assert(noId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(noId.id),
    'S1.9: missing id repaired to a UUID v4');
}

// ===========================================================================
// 2. sanitizeBlock — negative durations are corrupt data
// ===========================================================================

console.log('\n📋 2. sanitizeBlock');

{
  saveCalendar([
    { day: 'Mon', startHour: 9, durationHours: -3 },
    { day: 'Mon', startHour: 10, durationHours: 2, label: 'Keep me' },
    { day: 'Funday', startHour: 10, durationHours: 2 },
    { day: 'Tue', startHour: 'not-a-number', durationHours: 2 },
  ]);
  const loaded = loadCalendar();
  assert(loaded.length === 1, 'S2.1: only the valid block survives (1 of 4)');
  assert(loaded[0].label === 'Keep me', 'S2.2: surviving block intact');
}

// ===========================================================================
// 3. Google calendar selection presence (auto-primary fallback signal)
// ===========================================================================

console.log('\n📋 3. Google calendar selection presence');

{
  clearGoogleCalendars();
  assert(!hasStoredGoogleCalendars(), 'S3.1: no key → never selected');
  saveGoogleCalendars([]);
  assert(hasStoredGoogleCalendars(), 'S3.2: explicit [] → has a selection (all-off)');
  assert(Array.isArray(loadGoogleCalendars()) && loadGoogleCalendars().length === 0,
    'S3.3: [] round-trips as an array');
  saveGoogleCalendars(['id-1', 42, '', 'id-2']);
  assert(JSON.stringify(loadGoogleCalendars()) === '["id-1","id-2"]',
    'S3.4: non-string ids filtered out');
  clearGoogleCalendars();
  assert(!hasStoredGoogleCalendars(), 'S3.5: cleared → never selected again');
}

// ===========================================================================

console.log(`\n────────────────────────────────────────────────────────────`);
console.log(`  Storage sanitizers: ${passed} passed, ${failed} failed  (${passed + failed} total)`);
if (failed > 0) process.exit(1);
console.log('  ✅ All passed!');
