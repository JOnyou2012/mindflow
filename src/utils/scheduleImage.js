/**
 * Schedule image export — dependency-free SVG → canvas → PNG pipeline.
 *
 * `buildScheduleSvg` renders the same data PlanView draws on screen
 * (day columns 6:00–22:00, fixed blocks, generated session chips, stats,
 * warnings, unscheduled list) as one tall portrait SVG covering ALL
 * generated weeks. `svgToPngBlob` rasterizes it at 2× and `downloadPng`
 * saves it — via the native OS save dialog on Chromium, an `<a download>`
 * fallback elsewhere.
 *
 * Deliberately NOT html2canvas: Tailwind v4 emits oklch()/CSS-variable
 * colors that DOM-screenshot libraries misrender. Building the SVG from
 * the same data the grid uses is deterministic, crisp at 2×, and
 * unit-testable in Node (the browser-only functions guard on `document`).
 *
 * The builder is pure: same inputs + same palette → identical output.
 * All user-provided text is XML-escaped. (SVG loaded via `<img>` cannot
 * run scripts, but unescaped text breaks the document.)
 */

import { typeColor } from './theme.js';

// ===========================================================================
// Layout constants — mirror PlanView.jsx geometry (START_H/END_H/ROW_H)
// ===========================================================================

export const SVG_WIDTH = 960;
export const SVG_MARGIN = 16;
export const SVG_GUTTER = 52;          // time-gutter column
export const SVG_DAY_W = 125;          // day column width
export const SVG_GRID_W = SVG_GUTTER + 7 * SVG_DAY_W; // 927
export const SVG_START_H = 6;          // grid starts 6:00
export const SVG_END_H = 22;           // grid ends 22:00
export const SVG_ROW_H = 48;           // px per hour
export const SVG_TOTAL_H = SVG_END_H - SVG_START_H;
export const SVG_GRID_H = SVG_TOTAL_H * SVG_ROW_H;    // 768
export const SVG_WEEK_HEADER_H = 40;
export const SVG_DAY_HEADER_H = 34;
export const SVG_STATS_H = 44;
export const SVG_WARN_LINE_H = 20;
export const SVG_UNSCHED_H = 26;
export const SVG_WEEK_GAP = 40;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Light-theme fallbacks — the component replaces these with the values of
 *  the app's live CSS variables at click time (so the PNG matches the
 *  current theme). Tests pass this fixed palette for determinism. */
export const DEFAULT_PALETTE = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f8f9fa',
  border: '#dadce0',
  borderLight: '#e8eaed',
  text: '#3c4043',
  heading: '#202124',
  muted: '#5f6368',
  accent: '#1669d4',
  accentSoft: '#e8f0fe',
  onAccent: '#ffffff',
  warning: '#c26400',
  danger: '#d93025',
  typeText: {
    academic: '#0277bd',
    sports: '#0b8043',
    arts: '#7b1fa2',
    other: '#5f6368',
  },
};

/** English fallback labels — the component passes the active translations. */
export const DEFAULT_LABELS = {
  scheduled: 'Scheduled',
  capacity: 'Capacity',
  balance: 'Balance',
  avgFatigue: 'Avg fatigue',
  unitHoursShort: 'h',
  taskSingular: 'task',
  taskPlural: 'tasks',
  couldNotFit: 'could not be scheduled',
  tryReducing: 'try reducing task hours or extending deadlines',
  empty: 'No schedule yet — generate a plan first.',
};

// ===========================================================================
// Text helpers
// ===========================================================================

/**
 * Escape user-provided text for XML/SVG embedding. Mandatory: unescaped
 * `&`/`<` breaks the SVG document, and task titles are free-form input.
 */
export function escapeXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Char-count truncation (SVG text doesn't auto-ellipsize like CSS). */
function truncate(str, max) {
  const s = String(str ?? '');
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/** Locale-correct hour label (mirrors PlanView's fmtHr). */
function fmtHr(h, locale) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const d = new Date(2026, 0, 1, hh, mm);
  if (mm > 0) return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleTimeString(locale, { hour: 'numeric' });
}

/** "Aug 17 – Aug 23, 2026" — mirrors PlanView's weekLabel. */
function weekLabel(ws, locale) {
  const [y, m, d] = ws.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const s = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString(locale, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${s} – ${e}, ${end.getFullYear()}`;
}

/** Locale-correct short weekday names keyed by internal day code
 *  ('Mon'…'Sun'). 2026-01-05 is a Monday — the anchor date keeps the
 *  mapping locale-independent (same trick as i18n.getDayShortNames). */
function dayShortNames(locale) {
  const names = {};
  for (let i = 0; i < 7; i++) {
    names[DAYS[i]] = new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'short' });
  }
  return names;
}

/** { dateNum, isToday, isPast } for one day column; today=null (tests)
 *  disables both highlights. */
function dayInfo(ws, dayName, today) {
  const [y, m, d] = ws.split('-').map(Number);
  const date = new Date(y, m - 1, d + DAYS.indexOf(dayName));
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { dateNum: date.getDate(), isToday: today === iso, isPast: today ? iso < today : false };
}

// ===========================================================================
// Per-week layout
// ===========================================================================

function weekBlockHeight(result) {
  let h = SVG_WEEK_HEADER_H;
  if (result?.stats) h += SVG_STATS_H;
  h += (result?.warnings?.length || 0) * SVG_WARN_LINE_H;
  h += SVG_DAY_HEADER_H + SVG_GRID_H;
  if (result?.unscheduled?.length) h += SVG_UNSCHED_H;
  return h;
}

/**
 * Build one week's column block: header, stats, warnings, day grid with
 * chips, unscheduled note. Returns an SVG fragment with all y positions
 * relative to yTop (the block's top edge).
 */
function renderWeek(ws, result, calendarBlocks, palette, locale, names, L, today, yTop) {
  const out = [];
  const gridX = SVG_MARGIN;
  const stats = result?.stats || null;
  const warnings = result?.warnings || [];
  const unscheduled = result?.unscheduled || [];
  const gridY = yTop + SVG_WEEK_HEADER_H + (stats ? SVG_STATS_H : 0)
    + warnings.length * SVG_WARN_LINE_H + SVG_DAY_HEADER_H;
  const containerY = gridY - SVG_DAY_HEADER_H;
  const containerH = SVG_DAY_HEADER_H + SVG_GRID_H;
  // Week keys are app-generated ISO dates, but the builder is public API —
  // strip anything that could break the id / url(#…) reference.
  const clipId = `gclip-${ws.replace(/[^0-9-]/g, '')}`;
  const esc = escapeXml;

  // ── Week header ──
  out.push(`<text x="${gridX}" y="${yTop + 24}" font-size="16" font-weight="600" fill="${esc(palette.heading)}">${esc(weekLabel(ws, locale))}</text>`);
  out.push(`<line x1="${gridX}" y1="${yTop + SVG_WEEK_HEADER_H - 8}" x2="${gridX + SVG_GRID_W}" y2="${yTop + SVG_WEEK_HEADER_H - 8}" stroke="${esc(palette.borderLight)}" stroke-width="1"/>`);

  // ── Stats row (mirrors PlanView statCells) ──
  if (stats) {
    const statW = Math.floor(SVG_GRID_W / 4);
    const cells = [
      [stats.totalScheduledHours != null ? stats.totalScheduledHours + L.unitHoursShort : '—', L.scheduled],
      [stats.utilizationPct != null ? stats.utilizationPct + '%' : '—', L.capacity],
      [stats.workloadBalance != null ? stats.workloadBalance + '%' : '—', L.balance],
      [(stats.avgFatigue != null ? stats.avgFatigue : 0) + '%', L.avgFatigue],
    ];
    const statsY = yTop + SVG_WEEK_HEADER_H;
    cells.forEach(([val, label], i) => {
      const x = gridX + i * statW;
      out.push(`<text x="${x}" y="${statsY + 17}" font-size="15" font-weight="600" fill="${esc(palette.heading)}">${esc(val)}</text>`);
      out.push(`<text x="${x}" y="${statsY + 31}" font-size="10" fill="${esc(palette.muted)}">${esc(label)}</text>`);
    });
  }

  // ── Warnings ──
  warnings.forEach((w, i) => {
    const fill = w.severity === 'high' ? palette.danger : w.severity === 'medium' ? palette.warning : palette.muted;
    const text = `⚠ ${w.message}${w.detail ? ' — ' + w.detail : ''}`;
    out.push(`<text x="${gridX}" y="${yTop + SVG_WEEK_HEADER_H + (stats ? SVG_STATS_H : 0) + i * SVG_WARN_LINE_H + 14}" font-size="11" fill="${esc(fill)}">${esc(truncate(text, 170))}</text>`);
  });

  // ── Day grid container + clip ──
  out.push(`<defs><clipPath id="${clipId}"><rect x="${gridX}" y="${containerY}" width="${SVG_GRID_W}" height="${containerH}" rx="8"/></clipPath></defs>`);
  out.push(`<rect x="${gridX}" y="${containerY}" width="${SVG_GRID_W}" height="${containerH}" rx="8" fill="none" stroke="${esc(palette.border)}" stroke-width="1"/>`);

  // ── Day headers ──
  DAYS.forEach((day, col) => {
    const { dateNum, isToday } = dayInfo(ws, day, today);
    const cx = gridX + SVG_GUTTER + col * SVG_DAY_W + SVG_DAY_W / 2;
    out.push(`<text x="${cx}" y="${containerY + 13}" font-size="10" letter-spacing="1" text-anchor="middle" fill="${esc(isToday ? palette.accent : palette.muted)}">${esc((names[day] || day).toUpperCase())}</text>`);
    if (isToday) {
      out.push(`<circle cx="${cx}" cy="${containerY + 25}" r="12" fill="${esc(palette.accent)}"/>`);
      out.push(`<text x="${cx}" y="${containerY + 29}" font-size="12" font-weight="600" text-anchor="middle" fill="${esc(palette.onAccent)}">${dateNum}</text>`);
    } else {
      out.push(`<text x="${cx}" y="${containerY + 29}" font-size="12" text-anchor="middle" fill="${esc(palette.heading)}">${dateNum}</text>`);
    }
  });

  // ── Hour lines + time gutter ──
  for (let i = 0; i <= SVG_TOTAL_H; i++) {
    const ly = gridY + i * SVG_ROW_H;
    out.push(`<line x1="${gridX + SVG_GUTTER}" y1="${ly}" x2="${gridX + SVG_GRID_W}" y2="${ly}" stroke="${esc(palette.borderLight)}" stroke-width="1"/>`);
  }
  for (let i = 1; i <= SVG_TOTAL_H; i++) {
    out.push(`<text x="${gridX + SVG_GUTTER - 8}" y="${gridY + i * SVG_ROW_H + 3}" font-size="10" text-anchor="end" fill="${esc(palette.muted)}">${esc(fmtHr(SVG_START_H + i, locale))}</text>`);
  }
  for (let col = 1; col < 7; col++) {
    const lx = gridX + SVG_GUTTER + col * SVG_DAY_W;
    out.push(`<line x1="${lx}" y1="${gridY}" x2="${lx}" y2="${gridY + SVG_GRID_H}" stroke="${esc(palette.borderLight)}" stroke-width="1"/>`);
  }

  // ── Chips (clipped to the rounded container) ──
  out.push(`<g clip-path="url(#${clipId})">`);
  DAYS.forEach((day, col) => {
    const colX = gridX + SVG_GUTTER + col * SVG_DAY_W;
    const { isToday, isPast } = dayInfo(ws, day, today);

    if (isToday) {
      out.push(`<rect x="${colX}" y="${gridY}" width="${SVG_DAY_W}" height="${SVG_GRID_H}" fill="${esc(palette.accentSoft)}" fill-opacity="0.3"/>`);
    }

    // Fixed commitments — solid chips (same math as PlanView)
    for (const b of calendarBlocks.filter(bl => bl.day === day)) {
      const start = Number(b.startHour) || 0;
      const dur = Number(b.durationHours) || 0;
      const top = Math.max(0, (start - SVG_START_H) * SVG_ROW_H);
      const end = Math.min(start + dur, SVG_END_H);
      const h = Math.max(20, (end - Math.max(start, SVG_START_H)) * SVG_ROW_H);
      const c = typeColor(b.type);
      out.push(`<rect x="${colX + 2}" y="${gridY + top + 1}" width="${SVG_DAY_W - 4}" height="${h - 2}" rx="4" fill="${esc(c)}"/>`);
      out.push(`<text x="${colX + 8}" y="${gridY + top + 14}" font-size="11" font-weight="600" fill="#ffffff">${esc(truncate(b.label, 19))}</text>`);
      if (h >= 40) {
        out.push(`<text x="${colX + 8}" y="${gridY + top + 27}" font-size="10" fill="#ffffff" fill-opacity="0.9">${esc(`${fmtHr(start, locale)}–${fmtHr(end, locale)}`)}</text>`);
      }
    }

    // Generated study sessions — tinted, bordered chips (tick/6 → hours)
    for (const s of result?.days?.[day]?.sessions || []) {
      // Defensive: corrupted/foreign session objects must never emit NaN
      // coordinates into the SVG (NaN breaks the document geometry).
      const sh = (Number(s.startTick) || 0) / 6, eh = (Number(s.endTick) || 0) / 6;
      const top = (sh - SVG_START_H) * SVG_ROW_H;
      const h = (eh - sh) * SVG_ROW_H;
      const c = typeColor(s.task?.type);
      const tc = palette.typeText?.[s.task?.type] || c;
      out.push(`<rect x="${colX + 2}" y="${gridY + top + 1}" width="${SVG_DAY_W - 4}" height="${Math.max(h - 2, 18)}" rx="4" fill="${esc(c)}1f" stroke="${esc(c)}" stroke-width="1"/>`);
      out.push(`<text x="${colX + 8}" y="${gridY + top + 14}" font-size="11" font-weight="600" fill="${esc(tc)}">${esc(truncate(s.task?.title, 19))}</text>`);
      if (h >= 40) {
        out.push(`<text x="${colX + 8}" y="${gridY + top + 27}" font-size="10" fill="${esc(tc)}">${esc(`${fmtHr(sh, locale)}–${fmtHr(eh, locale)}`)}</text>`);
      }
    }

    // Past days dimmed — overlay after chips so they dim too (PlanView parity)
    if (isPast) {
      out.push(`<rect x="${colX}" y="${gridY}" width="${SVG_DAY_W}" height="${SVG_GRID_H}" fill="${esc(palette.bg)}" fill-opacity="0.55"/>`);
    }
  });
  out.push('</g>');

  // ── Unscheduled note ──
  if (unscheduled.length > 0) {
    const titles = truncate(unscheduled.map(t => t.title).join(', '), 120);
    const singular = unscheduled.length === 1;
    const text = `${unscheduled.length} ${singular ? L.taskSingular : L.taskPlural} ${L.couldNotFit}: ${titles} — ${L.tryReducing}`;
    out.push(`<text x="${gridX}" y="${gridY + SVG_GRID_H + 17}" font-size="11" fill="${esc(palette.warning)}">${esc(truncate(text, 180))}</text>`);
  }

  return out.join('');
}

// ===========================================================================
// SVG builder
// ===========================================================================

/**
 * Render every generated week as one tall portrait SVG.
 *
 * @param {Object<string, OptimizedWeek>} weekResults weekStart ISO → result
 * @param {CalendarBlock[]} calendarBlocks fixed blocks (rendered every week,
 *   like PlanView)
 * @param {object} [options]
 * @param {object} [options.palette] explicit colors (component captures the
 *   app's computed CSS variables at click time); defaults to light theme
 * @param {string} [options.locale='en-US'] BCP 47 locale for dates/hours
 * @param {object} [options.labels] translations; defaults to English
 * @param {string|null} [options.today=null] ISO date — enables today/past
 *   highlighting; null keeps output deterministic (used by tests)
 * @returns {string} complete SVG document (with explicit width/height)
 */
export function buildScheduleSvg(weekResults, calendarBlocks, options = {}) {
  const results = weekResults || {};
  const blocks = calendarBlocks || [];
  const { palette = DEFAULT_PALETTE, locale = 'en-US', labels = {}, today = null } = options;
  const L = { ...DEFAULT_LABELS, ...labels };
  const weeks = Object.keys(results).sort();

  // Empty plan — return a valid (small) SVG rather than throwing, so the
  // pipeline never hard-fails on a document that shouldn't have a button.
  if (weeks.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="120" viewBox="0 0 ${SVG_WIDTH} 120" font-family="${FONT}">`
      + `<rect x="0" y="0" width="${SVG_WIDTH}" height="120" fill="${escapeXml(palette.bg)}"/>`
      + `<text x="${SVG_WIDTH / 2}" y="64" font-size="14" text-anchor="middle" fill="${escapeXml(palette.muted)}">${escapeXml(L.empty)}</text>`
      + '</svg>';
  }

  const heights = weeks.map(ws => weekBlockHeight(results[ws]));
  const height = SVG_MARGIN * 2
    + heights.reduce((a, b) => a + b, 0)
    + SVG_WEEK_GAP * (weeks.length - 1);

  const parts = [];
  // NOTE: no `direction` attribute here. Setting direction="rtl" flips the
  // meaning of text-anchor="start" to the RIGHT edge, which would push
  // every left-anchored label (week header at x=16, stats, chip labels)
  // off-canvas to the left (verified empirically — Arabic text rendered
  // with 0 visible pixels). Arabic content still shapes and orders RTL
  // inside LTR text boxes via the Unicode bidi algorithm.
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${height}" viewBox="0 0 ${SVG_WIDTH} ${height}" font-family="${FONT}">`);
  parts.push(`<rect x="0" y="0" width="${SVG_WIDTH}" height="${height}" fill="${escapeXml(palette.bg)}"/>`);

  const names = dayShortNames(locale);
  let y = SVG_MARGIN;
  weeks.forEach((ws, i) => {
    parts.push(renderWeek(ws, results[ws], blocks, palette, locale, names, L, today, y));
    y += heights[i] + SVG_WEEK_GAP;
  });

  parts.push('</svg>');
  return parts.join('');
}

// ===========================================================================
// PNG conversion + download (browser only)
// ===========================================================================

/**
 * Rasterize an SVG string to a PNG blob at the given scale (2× for crisp
 * text). Browser-only — the SVG is drawn through an <img> (data URL), which
 * cannot execute scripts, into a <canvas>.
 */
export async function svgToPngBlob(svg, scale = 2) {
  if (typeof document === 'undefined') {
    throw new Error('svgToPngBlob requires a browser environment');
  }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('SVG failed to render'));
      img.src = url;
    });
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Save a PNG blob. Chromium gets the native OS save dialog
 * (showSaveFilePicker — Desktop is selectable); Safari/Firefox fall back
 * to an <a download> click. User cancel (AbortError) resolves silently.
 *
 * Two contexts can expose showSaveFilePicker yet never show a dialog —
 * Chrome automation/headless (the promise hangs forever, verified in
 * this project's e2e run) and kiosk/embedded webviews. Both are handled:
 * automation sets navigator.webdriver, and any picker that hasn't
 * resolved after 30s is abandoned in favor of the <a download> fallback.
 */
export async function downloadPng(blob, filename) {
  const pickerSupported = typeof window !== 'undefined'
    && typeof window.showSaveFilePicker === 'function'
    && navigator.webdriver !== true;
  if (pickerSupported) {
    const picker = window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
    });
    const winner = await Promise.race([
      picker.then(handle => ({ handle })).catch(err => ({ err })),
      new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 30000)),
    ]);
    picker.catch(() => {}); // swallow late rejection after a fallback race
    if (winner.handle) {
      try {
        const writable = await winner.handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { method: 'save-picker' };
      } catch {
        // Write failed after a successful pick — fall through to <a download>.
      }
    } else if (winner.err) {
      if (winner.err.name === 'AbortError') return { method: 'cancelled' };
      // Any other rejection (picker unavailable in this context, etc.) —
      // fall through to the <a download> path rather than dead-ending.
    }
    // winner.timeout — picker never settled (headless-like contexts);
    // fall through so the save still succeeds via <a download>.
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { method: 'download' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** `mindflow-schedule-YYYY-MM-DD.png` for the given date (default: today). */
export function scheduleImageFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `mindflow-schedule-${y}-${m}-${d}.png`;
}
