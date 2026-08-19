/**
 * Schedule image export test suite (PRD Part 8, step 107).
 * Tests the pure SVG builder + helpers in Node — the browser-only
 * rasterization (svgToPngBlob/downloadPng) is verified in-browser.
 * Run: node tests/schedule-image.test.js
 */

import {
  buildScheduleSvg, escapeXml, scheduleImageFilename, DEFAULT_PALETTE,
  SVG_MARGIN, SVG_WEEK_HEADER_H, SVG_STATS_H, SVG_WARN_LINE_H, SVG_DAY_HEADER_H,
  SVG_ROW_H, SVG_START_H, SVG_GRID_H, SVG_WEEK_GAP, SVG_UNSCHED_H,
} from '../src/utils/scheduleImage.js';

let passed = 0, failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push(label); console.error(`  ❌ ${label}`); }
}

// ===========================================================================
// Fixture — 2026-08-17 is a Monday; today=null keeps output deterministic
// ===========================================================================

const weekResults = {
  '2026-08-17': {
    days: {
      Mon: { sessions: [{ task: { title: 'M&L <drill>', type: 'academic' }, startTick: 54, endTick: 63 }], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 },
      Tue: { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 },
      Wed: { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 },
      Thu: { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 },
      Fri: { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 },
      Sat: { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 },
      Sun: { sessions: [], fatigueCurve: [], totalFlowMins: 0, burnoutCount: 0 },
    },
    unscheduled: [{ title: 'Essay "draft"', type: 'arts' }],
    stats: { totalScheduledHours: 12.5, utilizationPct: 80, workloadBalance: 75, avgFatigue: 32.4 },
    warnings: [{ severity: 'high', message: 'Heavy <day>', detail: '6h & counting' }],
  },
};

const calendarBlocks = [
  { id: 'b1', day: 'Mon', startHour: 8, durationHours: 1, label: 'Class & Lab', type: 'academic' },
];

const OPTS = { palette: DEFAULT_PALETTE, locale: 'en-US', today: null };
const svg = buildScheduleSvg(weekResults, calendarBlocks, OPTS);

// Expected geometry for ONE week with stats + 1 warning + unscheduled:
//   gridY = MARGIN + WEEK_HEADER + STATS + 1×WARN_LINE + DAY_HEADER
const gridY = SVG_MARGIN + SVG_WEEK_HEADER_H + SVG_STATS_H + SVG_WARN_LINE_H + SVG_DAY_HEADER_H;
const blockH = SVG_WEEK_HEADER_H + SVG_STATS_H + SVG_WARN_LINE_H + SVG_DAY_HEADER_H + SVG_GRID_H + SVG_UNSCHED_H;

// ===========================================================================
// 1. Document structure
// ===========================================================================

console.log('\n📋 1. Document structure');

assert(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), 'S1: output starts with an <svg> root');
assert(svg.includes('width="960"'), 'S1: explicit width (960) for reliable rasterization');
assert(svg.includes(`height="${2 * SVG_MARGIN + blockH}"`), 'S1: explicit height matches per-week layout math');
assert(svg.includes('</svg>'), 'S1: document closes');

// ===========================================================================
// 2. Week labels
// ===========================================================================

console.log('\n📋 2. Week labels');

assert(svg.includes('2026'), 'W1: week label contains the year');
assert(/Aug \d{1,2} – \d{1,2}, 2026/.test(svg), 'W1: en-US week range label format');

const twoWeeks = { ...weekResults, '2026-08-24': JSON.parse(JSON.stringify(weekResults['2026-08-17'])) };
const twoSvg = buildScheduleSvg(twoWeeks, calendarBlocks, OPTS);
assert(twoSvg.includes('Aug 17') && twoSvg.includes('Aug 24'), 'W2: both week labels present for two weeks');
assert(twoSvg.indexOf('Aug 17') < twoSvg.indexOf('Aug 24'), 'W2: weeks render in chronological order');
assert(twoSvg.includes(`height="${2 * SVG_MARGIN + blockH * 2 + SVG_WEEK_GAP}"`), 'W2: total height stacks both weeks + gap');

// ===========================================================================
// 3. Chip y-positions from ticks
// ===========================================================================

console.log('\n📋 3. Chip y-positions from ticks');

// Session: startTick 54 → 9:00, endTick 63 → 10:30 (ticks/6 → hours)
const sessTop = (54 / 6 - SVG_START_H) * SVG_ROW_H;
const sessH = (63 - 54) / 6 * SVG_ROW_H;
assert(svg.includes(`y="${gridY + sessTop + 1}"`), `P1: session chip y = gridY + ${sessTop + 1}`);
assert(svg.includes(`height="${Math.max(sessH - 2, 18)}"`), `P2: session chip height = ${Math.max(sessH - 2, 18)}`);

// Fixed block: 8:00–9:00
const fixedTop = (8 - SVG_START_H) * SVG_ROW_H;
const fixedH = (9 - 8) * SVG_ROW_H;
assert(svg.includes(`y="${gridY + fixedTop + 1}"`), `P3: fixed block y = gridY + ${fixedTop + 1}`);
assert(svg.includes(`height="${fixedH - 2}"`), `P4: fixed block height = ${fixedH - 2}`);

// ===========================================================================
// 4. Day columns
// ===========================================================================

console.log('\n📋 4. Day columns');

for (const name of ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']) {
  assert(svg.includes(`>${name}</text>`), `D1: day header ${name} present`);
}

// ===========================================================================
// 5. XML escaping
// ===========================================================================

console.log('\n📋 5. XML escaping');

assert(escapeXml(`a&b<c>"d"'e`) === 'a&amp;b&lt;c&gt;&quot;d&quot;&apos;e', 'X1: escapeXml escapes all five special chars');
assert(escapeXml(null) === '' && escapeXml(undefined) === '' && escapeXml(42) === '42', 'X2: escapeXml handles null/undefined/numbers');
assert(svg.includes('M&amp;L &lt;drill&gt;'), 'X3: task title escaped in session chip');
assert(svg.includes('Class &amp; Lab'), 'X4: calendar block label escaped');
assert(svg.includes('Heavy &lt;day&gt;') && svg.includes('6h &amp; counting'), 'X5: warning message + detail escaped');
assert(svg.includes('Essay &quot;draft&quot;'), 'X6: unscheduled task title escaped');
assert(!svg.includes('<drill>') && !svg.includes('& Lab'), 'X7: no raw unescaped text in output');

// ===========================================================================
// 6. Stats, warnings, unscheduled content
// ===========================================================================

console.log('\n📋 6. Stats, warnings, unscheduled content');

assert(svg.includes('12.5h') && svg.includes('80%') && svg.includes('75%') && svg.includes('32.4%'), 'C1: all four stat values rendered');
assert(svg.includes('Scheduled') && svg.includes('Capacity') && svg.includes('Balance') && svg.includes('Avg fatigue'), 'C2: stat labels use default English labels');
assert(svg.includes('1 task could not be scheduled'), 'C3: unscheduled count with singular label');
assert(svg.includes('try reducing task hours'), 'C4: unscheduled hint rendered');

// Custom labels override defaults (the component passes live translations)
const deSvg = buildScheduleSvg(weekResults, calendarBlocks, { ...OPTS, labels: { scheduled: 'Geplant' } });
assert(deSvg.includes('Geplant'), 'C5: custom label used when provided');

// ===========================================================================
// 7. Filename
// ===========================================================================

console.log('\n📋 7. Filename');

assert(scheduleImageFilename(new Date(2026, 7, 18)) === 'mindflow-schedule-2026-08-18.png', 'F1: filename format YYYY-MM-DD');
assert(scheduleImageFilename(new Date(2026, 0, 5)) === 'mindflow-schedule-2026-01-05.png', 'F2: zero-padded month and day');
assert(/^mindflow-schedule-\d{4}-\d{2}-\d{2}\.png$/.test(scheduleImageFilename()), 'F3: default (today) matches format');

// ===========================================================================
// 8. Empty plan + malformed input
// ===========================================================================

console.log('\n📋 8. Empty plan + malformed input');

const emptySvg = buildScheduleSvg({}, [], OPTS);
assert(emptySvg.includes('<svg'), 'E1: empty plan returns a valid SVG (no throw)');
assert(emptySvg.includes('No schedule yet'), 'E2: empty plan shows the fallback message');
let nullThrew = false;
try { buildScheduleSvg(null, null, OPTS); } catch { nullThrew = true; }
assert(!nullThrew, 'E3: null weekResults / calendarBlocks do not throw');
assert(buildScheduleSvg({ '2026-08-17': {} }, [], OPTS).includes('<svg'), 'E4: week without stats/warnings renders');

// ===========================================================================
// 9. Determinism
// ===========================================================================

console.log('\n📋 9. Determinism');

const svg2 = buildScheduleSvg(weekResults, calendarBlocks, OPTS);
assert(svg === svg2, 'R1: identical inputs → byte-identical output');

// ===========================================================================
// 10. Locale behavior
// ===========================================================================

console.log('\n📋 10. Locale behavior');

const arSvg = buildScheduleSvg(weekResults, calendarBlocks, { ...OPTS, locale: 'ar' });
assert(arSvg.includes('<svg'), 'R1: Arabic locale renders without throwing');
assert(/[؀-ۿ]/.test(arSvg), 'R2: Arabic output contains Arabic glyphs');
// The document must NOT set direction="rtl" — that flips text-anchor="start"
// to the right edge and pushes left-anchored labels off-canvas (bug found
// during e2e; Arabic shapes correctly via the bidi algorithm without it).
assert(!arSvg.includes('direction='), 'R3: no direction attribute (anchors stay LTR)');
const zhSvg = buildScheduleSvg(weekResults, calendarBlocks, { ...OPTS, locale: 'zh-CN' });
assert(zhSvg.includes('<svg'), 'R4: non-Latin locale renders without throwing');

// ===========================================================================
// 11. Edge cases (hardening)
// ===========================================================================

console.log('\n📋 11. Edge cases (hardening)');

// Today highlighting: 2026-08-19 is the Wednesday of the fixture week.
// Mon/Tue are past (dimmed), Wed is today (accent circle + soft column).
const todaySvg = buildScheduleSvg(weekResults, calendarBlocks, { ...OPTS, today: '2026-08-19' });
assert(todaySvg.includes(`fill="${DEFAULT_PALETTE.accent}"`), 'H1: today circle renders in the accent color');
assert(todaySvg.includes('fill="#e8f0fe"'), 'H2: today column gets the accent-soft highlight');
assert(todaySvg.includes('fill-opacity="0.55"'), 'H3: past days get the dimming overlay');

// Multi-week gap: the second week's header starts exactly one block + gap down
assert(twoSvg.includes(`y="${SVG_MARGIN + blockH + SVG_WEEK_GAP + 24}"`), 'H4: second week header offset by block + gap');

// Malformed sessions must never emit NaN coordinates into the document
const badWeek = {
  '2026-08-17': {
    days: { Mon: { sessions: [{ task: { title: 'Broken', type: 'academic' } }] } },
    unscheduled: [], stats: null, warnings: [],
  },
};
const badSvg = buildScheduleSvg(badWeek, [], OPTS);
assert(!badSvg.includes('NaN'), 'H5: session without ticks emits no NaN coordinates');
assert(badSvg.includes('Broken'), 'H6: malformed session still renders its title');

// Plural unscheduled label
const pluralWeek = { '2026-08-17': { days: {}, unscheduled: [{ title: 'A' }, { title: 'B' }], stats: null, warnings: [] } };
const pluralSvg = buildScheduleSvg(pluralWeek, [], OPTS);
assert(pluralSvg.includes('2 tasks could not be scheduled'), 'H7: plural unscheduled label');

// Week without stats: height math stays consistent
const noStatsSvg = buildScheduleSvg({ '2026-08-17': { days: {}, unscheduled: [], stats: null, warnings: [] } }, [], OPTS);
const noStatsH = SVG_WEEK_HEADER_H + SVG_DAY_HEADER_H + SVG_GRID_H;
assert(noStatsSvg.includes(`height="${2 * SVG_MARGIN + noStatsH}"`), 'H8: no-stats week height math');

// Hostile week key cannot break the clip-path id / url(#…) reference
const hostileSvg = buildScheduleSvg({ '2026-08-17"><script>x': { days: {}, unscheduled: [], stats: null, warnings: [] } }, [], OPTS);
assert(hostileSvg.includes('id="gclip-2026-08-17"') && hostileSvg.includes('url(#gclip-2026-08-17)'), 'H9: hostile week key sanitized in clip id');
assert(!hostileSvg.includes('gclip-2026-08-17"><script>'), 'H10: raw hostile key never reaches the id');

// ===========================================================================
// Done
// ===========================================================================

console.log(`\n${'─'.repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed  (${passed + failed} total)`);
if (failed > 0) {
  console.log(`\n  Failures:`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('  ✅ All schedule-image tests passed!\n');
}
