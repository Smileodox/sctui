/**
 * Colour + glyph vocabulary for the whole app.
 *
 * Everything visual should come from here so the UI reads as one system.
 * Hex values are emitted as truecolor escapes by Ink; terminals without
 * truecolor degrade to the nearest 256-colour match, which still looks fine.
 */

export const theme = {
  /** Primary brand accent — headings, active tab, focus ring. */
  accent: '#5B8DEF',
  /** Muted accent for inactive-but-related chrome. */
  accentDim: '#3B5A9E',

  /** Default body text. */
  fg: '#E6E9F0',
  /** Secondary text: labels, units, column headers. */
  muted: '#8A91A6',
  /** Tertiary text: separators, hints, disabled. */
  dim: '#565C70',

  /** Gains. */
  up: '#3FD68C',
  /** Losses. */
  down: '#FF6B7A',
  /** Neutral / unchanged. */
  flat: '#8A91A6',
  /** Warnings and pending states. */
  warn: '#F5C24A',
  /** Hard errors. */
  error: '#FF6B7A',

  /** Idle panel border. */
  border: '#333A4D',
  /** Border of the pane that currently has keyboard focus. */
  borderFocus: '#5B8DEF',

  /** Background of the selected row. */
  selectionBg: '#26304A',
} as const

export const glyphs = {
  up: '▲',
  down: '▼',
  flat: '·',
  bullet: '•',
  arrowRight: '›',
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  /** Left-to-right increasing block heights, for inline sparklines and bars. */
  blocks: [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
} as const

/** Colour for a signed number: green up, red down, grey flat. */
export function trendColor(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return theme.muted
  if (value > 0) return theme.up
  if (value < 0) return theme.down
  return theme.flat
}

/** Directional glyph for a signed number. */
export function trendGlyph(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return ' '
  if (value > 0) return glyphs.up
  if (value < 0) return glyphs.down
  return glyphs.flat
}
