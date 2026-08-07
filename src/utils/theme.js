/**
 * Shared event/priority colors — Google Calendar palette.
 * Single source of truth for calendar blocks, tasks, and scheduled sessions.
 *
 * *_COLORS are solid fills (paired with white text).
 * *_TEXT_COLORS are darker variants for colored text on light surfaces (contrast ≥ ~4:1).
 */

export const TYPE_COLORS = {
  academic: '#039be5', // peacock
  sports:   '#0b8043', // basil
  arts:     '#8e24aa', // grape
  other:    '#616161', // graphite
};

export const TYPE_TEXT_COLORS = {
  academic: 'var(--type-academic-text)',
  sports:   'var(--type-sports-text)',
  arts:     'var(--type-arts-text)',
  other:    'var(--type-other-text)',
};

export const PRIORITY_COLORS = {
  high:   '#d93025',
  medium: '#e37400',
  low:    '#616161',
};

export const PRIORITY_TEXT_COLORS = {
  high:   'var(--priority-high-text)',
  medium: 'var(--priority-medium-text)',
  low:    'var(--priority-low-text)',
};

export function typeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.other;
}

export function typeTextColor(type) {
  return TYPE_TEXT_COLORS[type] || TYPE_TEXT_COLORS.other;
}
