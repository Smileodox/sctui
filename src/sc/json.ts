/**
 * Tolerant JSON extraction and value coercion.
 *
 * The exact field names `sc --json` emits are not documented, and they will
 * drift as the CLI evolves. Rather than hard-coding one guess, every reader in
 * `normalize.ts` asks for a *set* of candidate key names and this module
 * resolves them case-, snake-, camel- and kebab-insensitively, with an optional
 * breadth-first search into nested objects.
 *
 * The cost is a little indirection; the benefit is that a field rename upstream
 * degrades to a single `—` cell instead of a crash.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/**
 * Pull the first complete JSON value out of a stdout blob.
 *
 * Handles the common cases of a leading banner line, trailing warnings, or the
 * CLI emitting NDJSON. Returns `undefined` when nothing parses.
 */
export function extractJson(stdout: string): Json | undefined {
  const text = stdout.trim()
  if (!text) return undefined

  // Fast path: the whole thing is one JSON document.
  try {
    return JSON.parse(text) as Json
  } catch {
    // fall through
  }

  // NDJSON: parse every line, return the array if more than one parsed.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    const parsed: Json[] = []
    let allParsed = true
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line) as Json)
      } catch {
        allParsed = false
        break
      }
    }
    if (allParsed && parsed.length > 0) return parsed
  }

  // Scan for a balanced `{...}` or `[...]` starting at the first bracket.
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch !== '{' && ch !== '[') continue
    const end = findBalancedEnd(text, i)
    if (end === -1) continue
    try {
      return JSON.parse(text.slice(i, end + 1)) as Json
    } catch {
      // Keep scanning: this bracket started a false positive.
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface ScEnvelope {
  /** The part the command is actually about, envelope stripped. */
  payload: Json | undefined
  /** `data` — one level up from `payload`, where the siblings live. */
  container: Json | undefined
  /** The envelope's own command id, e.g. `broker.overview`. */
  command?: string
  /** Present when the CLI reported `"ok": false`. */
  error?: { code?: string; message?: string; hints?: string[] }
}

/**
 * Strip the CLI's response envelope.
 *
 * Every `sc --json` response is wrapped:
 *
 *     {"ok":true,"command":"broker.overview","data":{…,"result":{…}}}
 *     {"ok":false,"command":"broker.search","error":{"code":…,"message":…},"hints":[…]}
 *
 * The interesting part is `data.result` for most commands and `data` itself for
 * the few that have no `result` (chart). `container` keeps `data` available for
 * the cases where a name or account label sits beside the result rather than
 * inside it.
 *
 * A failure envelope can arrive on a zero exit status, so `error` has to be
 * checked by the caller — a non-zero exit is not the only failure signal.
 */
export function unwrapEnvelope(document: Json | undefined): ScEnvelope {
  if (!isRecord(document) || typeof document['ok'] !== 'boolean') {
    return { payload: document, container: document }
  }

  const command = str(document['command'])

  if (document['ok'] === false) {
    const error = document['error']
    const hints = document['hints']
    return {
      payload: undefined,
      container: undefined,
      ...(command === undefined ? {} : { command }),
      error: {
        ...(isRecord(error) ? { code: str(error['code']), message: str(error['message']) } : {}),
        ...(Array.isArray(hints)
          ? { hints: hints.map((h) => str(h)).filter((h): h is string => h !== undefined) }
          : {}),
      },
    }
  }

  const data = (document['data'] ?? document) as Json
  const payload = isRecord(data) && 'result' in data ? (data['result'] as Json) : data
  return { payload, container: data, ...(command === undefined ? {} : { command }) }
}

/** Index of the bracket closing the one at `start`, or -1. String-aware. */
function findBalancedEnd(text: string, start: number): number {
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i] as string
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// ---------------------------------------------------------------------------
// Coercion
// ---------------------------------------------------------------------------

/**
 * Coerce to a finite number.
 *
 * Accepts JSON numbers, decimal strings (`"1234.56"` — how Rust's `Decimal`
 * serialises), formatted strings (`"1.234,56 €"`, `"+1,24 %"`), and
 * `{ value, currency }` / `{ amount, currency }` wrappers.
 */
export function num(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'boolean' || value === null || value === undefined) return undefined

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['value', 'amount', 'val', 'number', 'quantity']) {
      if (key in obj) return num(obj[key])
    }
    return undefined
  }

  if (typeof value !== 'string') return undefined

  let s = value.trim()
  if (!s) return undefined

  // Strip whitespace (incl. NBSP/narrow NBSP), currency symbols and codes.
  s = s.replace(/[\s   ]/g, '')
  s = s.replace(/[€$£¥]/g, '')
  s = s.replace(/(?:EUR|USD|GBP|CHF|JPY)$/i, '')
  s = s.replace(/%$/, '')

  // Accounting negatives: (123.45)
  let negative = false
  if (/^\(.+\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    // Whichever separator comes last is the decimal point.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    // Multiple commas can only be thousands separators; a single one is a
    // German decimal comma, which is the far likelier case for this product.
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.')
  }

  if (!/^[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(s)) return undefined
  const parsed = Number(s)
  if (!Number.isFinite(parsed)) return undefined
  return negative ? -parsed : parsed
}

/** Coerce to a non-empty trimmed string. */
export function str(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return undefined
}

/** Coerce to a boolean, accepting `"true"` / `"yes"` / `1`. */
export function bool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1', 'on'].includes(s)) return true
    if (['false', 'no', 'n', '0', 'off'].includes(s)) return false
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Key lookup
// ---------------------------------------------------------------------------

/** `totalValue`, `total_value`, `TOTAL-VALUE` all normalise to `totalvalue`. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read the first matching key from an object, ignoring case and separators.
 * Candidates are tried in order, so put the most likely name first.
 */
export function get(source: unknown, candidates: readonly string[]): unknown {
  if (!isRecord(source)) return undefined

  const index = new Map<string, unknown>()
  for (const [key, value] of Object.entries(source)) {
    const normalized = normalizeKey(key)
    if (!index.has(normalized)) index.set(normalized, value)
  }

  for (const candidate of candidates) {
    // Support dotted paths like `performance.total`.
    if (candidate.includes('.')) {
      const value = getPath(source, candidate.split('.'))
      if (value !== undefined && value !== null) return value
      continue
    }
    const value = index.get(normalizeKey(candidate))
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function getPath(source: unknown, path: readonly string[]): unknown {
  let current: unknown = source
  for (const segment of path) {
    if (!isRecord(current)) return undefined
    current = get(current, [segment])
    if (current === undefined) return undefined
  }
  return current
}

/**
 * Like `get`, but searches nested objects breadth-first when the key is not
 * present at the top level. Arrays are traversed but their elements are only
 * inspected at the first level, to avoid matching a field on some unrelated
 * list item.
 */
export function deepGet(
  source: unknown,
  candidates: readonly string[],
  maxDepth = 4,
): unknown {
  const direct = get(source, candidates)
  if (direct !== undefined) return direct

  const queue: Array<{ node: unknown; depth: number }> = [{ node: source, depth: 0 }]
  while (queue.length > 0) {
    const { node, depth } = queue.shift() as { node: unknown; depth: number }
    if (depth >= maxDepth) continue

    if (isRecord(node)) {
      for (const value of Object.values(node)) {
        if (isRecord(value)) {
          const hit = get(value, candidates)
          if (hit !== undefined) return hit
          queue.push({ node: value, depth: depth + 1 })
        }
      }
    } else if (Array.isArray(node) && depth === 0) {
      for (const value of node) queue.push({ node: value, depth: depth + 1 })
    }
  }
  return undefined
}

/** Convenience: `deepGet` then `num`. */
export function getNum(source: unknown, candidates: readonly string[], deep = true): number | undefined {
  return num(deep ? deepGet(source, candidates) : get(source, candidates))
}

/** Convenience: `get` then `str`. Shallow by default — names are rarely nested. */
export function getStr(source: unknown, candidates: readonly string[], deep = false): string | undefined {
  return str(deep ? deepGet(source, candidates) : get(source, candidates))
}

/**
 * Find the list of records this payload is "about".
 *
 * Tries the named candidate keys first, then falls back to the longest array of
 * objects anywhere in the top two levels — which is almost always the list the
 * command was asked for.
 */
export function getList(source: unknown, candidates: readonly string[]): unknown[] {
  if (Array.isArray(source)) return source

  const named = get(source, candidates)
  if (Array.isArray(named)) return named
  if (isRecord(named)) {
    const nested = findLongestObjectArray(named, 2)
    if (nested) return nested
  }

  const found = findLongestObjectArray(source, 3)
  return found ?? []
}

function findLongestObjectArray(source: unknown, maxDepth: number): unknown[] | undefined {
  let best: unknown[] | undefined
  const queue: Array<{ node: unknown; depth: number }> = [{ node: source, depth: 0 }]

  while (queue.length > 0) {
    const { node, depth } = queue.shift() as { node: unknown; depth: number }
    if (depth > maxDepth || !isRecord(node)) continue

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        if (value.length > 0 && value.every(isRecord)) {
          if (!best || value.length > best.length) best = value
        }
      } else if (isRecord(value)) {
        queue.push({ node: value, depth: depth + 1 })
      }
    }
  }
  return best
}

/**
 * Resolve a currency code, defaulting to EUR (Scalable's home currency).
 */
export function getCurrency(source: unknown, fallback = 'EUR'): string {
  const code = getStr(source, ['currency', 'currencyCode', 'ccy', 'quoteCurrency'], true)
  if (code && /^[A-Za-z]{3}$/.test(code)) return code.toUpperCase()
  return fallback
}
