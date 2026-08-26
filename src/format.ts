/**
 * Display formatting. German locale by default, because that is what the
 * Scalable app itself uses and what most of its users read fluently.
 */

const LOCALE = process.env['SCTUI_LOCALE'] ?? 'de-DE'

const moneyFmt = new Map<string, Intl.NumberFormat>()

function moneyFormatter(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`
  let fmt = moneyFmt.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    moneyFmt.set(key, fmt)
  }
  return fmt
}

/** `1.234,56 €`. Returns `—` for missing values so columns stay aligned. */
export function money(
  value: number | undefined | null,
  currency = 'EUR',
  fractionDigits = 2,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  try {
    return moneyFormatter(currency || 'EUR', fractionDigits).format(value)
  } catch {
    // Unknown currency code — fall back to a plain number plus the raw code.
    return `${number(value, fractionDigits)} ${currency}`
  }
}

/** Money with an explicit `+`/`−` sign, for deltas. */
export function moneySigned(
  value: number | undefined | null,
  currency = 'EUR',
  fractionDigits = 2,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return sign + money(value, currency, fractionDigits)
}

/** `1.234,56` — a bare number, no currency. */
export function number(
  value: number | undefined | null,
  fractionDigits = 2,
  maxFractionDigits = fractionDigits,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: Math.max(fractionDigits, maxFractionDigits),
  }).format(value)
}

/** Share/unit counts: up to 4 decimals, but no trailing zero noise. */
export function quantity(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value)
}

/**
 * `+1,24 %`. Input is a percentage value (1.24 means 1.24 %), not a ratio.
 */
export function percent(
  value: number | undefined | null,
  fractionDigits = 2,
  signed = true,
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  const sign = signed && value > 0 ? '+' : ''
  return `${sign}${number(value, fractionDigits)} %`
}

/** Large numbers as `1,2 Mio.` etc. Used where space is tight. */
export function compact(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

/** `24.08.2026` */
export function date(value: Date | string | number | undefined | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short' }).format(d)
}

/** `24.08.2026, 14:03` */
export function dateTime(value: Date | string | number | undefined | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

/** `14:03:22` — for the "last refreshed" clock. */
export function clock(value: Date | string | number | undefined | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE, { timeStyle: 'medium' }).format(d)
}

/** `vor 3 Min.` — relative, coarse. */
export function relative(value: Date | string | number | undefined | null): string {
  const d = toDate(value)
  if (!d) return '—'
  const seconds = Math.round((Date.now() - d.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto', style: 'short' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ]
  let amount = seconds
  for (const [unit, step] of units) {
    if (Math.abs(amount) < step) return rtf.format(-Math.round(amount), unit)
    amount /= step
  }
  return rtf.format(-Math.round(amount), 'year')
}

export function toDate(value: Date | string | number | undefined | null): Date | undefined {
  if (value === undefined || value === null) return undefined
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'number') {
    // Heuristic: values below ~1e11 are seconds, above are milliseconds.
    const ms = value < 1e11 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? undefined : d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** Truncate to `width`, appending `…` when clipped. Never returns a longer string. */
export function truncate(text: string, width: number): string {
  if (width <= 0) return ''
  if (text.length <= width) return text
  if (width === 1) return '…'
  return `${text.slice(0, width - 1)}…`
}

/** Pad to exactly `width`, clipping when too long. */
export function pad(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const clipped = truncate(text, width)
  return align === 'right' ? clipped.padStart(width) : clipped.padEnd(width)
}

/** Title-case a SCREAMING_SNAKE enum coming back from the API. */
export function humanizeEnum(value: string | undefined | null): string {
  if (!value) return '—'
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
