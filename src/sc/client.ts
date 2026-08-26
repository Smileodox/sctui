/**
 * The data layer the UI talks to.
 *
 * `ScClient` shells out to the real CLI; `DemoClient` (in `mock.ts`) serves
 * generated data with the same interface so the UI can be developed and
 * demoed without a Scalable account. Both satisfy `DataSource`.
 */

import { runSc, ScError, type ScRunOptions } from './exec.js'
import { extractJson, unwrapEnvelope, type Json } from './json.js'
import { t } from '../strings.js'
import {
  normalizeCash,
  normalizeChart,
  normalizeHoldings,
  normalizeIdentity,
  normalizeOvernight,
  normalizeQuote,
  normalizeSearch,
  normalizeSummary,
  normalizeTransactions,
  normalizeWatchlist,
  type CashBreakdown,
  type ChartSeries,
  type Holding,
  type OvernightAccount,
  type PortfolioSummary,
  type Quote,
  type SearchResult,
  type Transaction,
  type WatchItem,
} from './normalize.js'

/** A normalized result plus the provenance needed by the debug overlay. */
export interface Fetched<T> {
  value: T
  raw: Json | undefined
  /** The exact command that produced this, for display and copy-paste. */
  command: string
  fetchedAt: number
  durationMs: number
}

/** Exactly the values `sc broker chart --timeframe` accepts, in cycling order. */
export const TIMEFRAMES = ['1d', '7d', '1m', '3m', '6m', 'ytd', '1y', 'max'] as const
export type Timeframe = (typeof TIMEFRAMES)[number]

export interface FetchOptions {
  signal?: AbortSignal
  /** Skip the cache and hit the CLI. */
  force?: boolean
}

export interface DataSource {
  readonly kind: 'live' | 'demo'
  whoami(options?: FetchOptions): Promise<Fetched<string | undefined>>
  cash(options?: FetchOptions): Promise<Fetched<CashBreakdown>>
  overview(options?: FetchOptions): Promise<Fetched<PortfolioSummary>>
  holdings(options?: FetchOptions): Promise<Fetched<Holding[]>>
  watchlist(options?: FetchOptions): Promise<Fetched<WatchItem[]>>
  transactions(options?: FetchOptions): Promise<Fetched<Transaction[]>>
  overnight(options?: FetchOptions): Promise<Fetched<OvernightAccount>>
  quote(isin: string, options?: FetchOptions): Promise<Fetched<Quote>>
  chart(isin: string, timeframe: Timeframe, options?: FetchOptions): Promise<Fetched<ChartSeries>>
  search(query: string, options?: FetchOptions): Promise<Fetched<SearchResult[]>>
}

interface CacheEntry {
  at: number
  value: unknown
}

/** Per-command cache lifetimes. Quotes move fastest, reference data slowest. */
const TTL_MS: Record<string, number> = {
  whoami: 10 * 60_000,
  overview: 20_000,
  cash: 20_000,
  holdings: 20_000,
  watchlist: 20_000,
  transactions: 60_000,
  overnight: 60_000,
  quote: 10_000,
  chart: 60_000,
  search: 5 * 60_000,
}

/** How many transactions to pull per refresh. The CLI's own maximum is 100. */
const TRANSACTION_PAGE_SIZE = 100

/**
 * Cap on positions enriched with a live quote per refresh.
 *
 * `broker holdings` and `broker watchlist` carry no day change, so filling that
 * column costs one `broker quote` per ISIN. `runSc` already caps concurrency, so
 * this only bounds the total — a portfolio far past this size would spend more
 * time fetching quotes than a dashboard should.
 */
const ENRICH_LIMIT = 40

/** Which half of an unwrapped envelope `fetch` hands to its normalizer. */
type Slice = 'result' | 'container'

const AUTH_PATTERN = /(unauthori[sz]ed|unauthenticated|not[_\s]?logged[_\s]?in|session|token|login)/i

/**
 * Turn a `"ok": false` envelope into an `ScError`.
 *
 * The CLI reports these on a *zero* exit status, so they never reach `runSc`'s
 * own error handling — without this they would surface as an empty screen.
 */
function envelopeError(
  error: { code?: string; message?: string; hints?: string[] },
  argv: string[],
  stdout: string,
  stderr: string,
): ScError {
  const message = error.message ?? error.code ?? 'sc meldete einen Fehler'
  const hint = error.hints?.[0]
  const auth = AUTH_PATTERN.test(`${error.code ?? ''} ${message}`)
  return new ScError(auth ? 'SC_AUTH' : 'SC_FAILED', hint ? `${message} — ${hint}` : message, {
    argv,
    stdout,
    stderr,
  })
}

/** Multiply, propagating "unknown" rather than producing NaN. */
function multiply(a?: number, b?: number): number | undefined {
  return a === undefined || b === undefined ? undefined : a * b
}

export class ScClient implements DataSource {
  readonly kind = 'live' as const

  private readonly cache = new Map<string, CacheEntry>()
  private readonly inFlight = new Map<string, Promise<unknown>>()
  private readonly runOptions: ScRunOptions

  constructor(runOptions: ScRunOptions = {}) {
    this.runOptions = runOptions
  }

  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Run a command, unwrap its envelope, normalize it — with dedup of concurrent
   * identical calls and a short TTL cache on top.
   *
   * `raw` deliberately keeps the *whole* document, envelope included: the debug
   * overlay is there to answer "what did the CLI actually say", and `ok` and
   * `command` are part of that answer.
   */
  private async fetch<T>(
    cacheKey: string,
    ttlKey: string,
    path: string[],
    args: string[],
    normalize: (payload: Json | undefined) => T,
    options: FetchOptions = {},
    slice: Slice = 'result',
  ): Promise<Fetched<T>> {
    const key = `${cacheKey}|${[...path, ...args].join(' ')}`

    if (!options.force) {
      const hit = this.cache.get(key)
      const ttl = TTL_MS[ttlKey] ?? 30_000
      if (hit && Date.now() - hit.at < ttl) return hit.value as Fetched<T>

      const pending = this.inFlight.get(key)
      if (pending) return (await pending) as Fetched<T>
    }

    const work = (async (): Promise<Fetched<T>> => {
      const run = await runSc(path, args, { ...this.runOptions, signal: options.signal })
      const document = extractJson(run.stdout)

      if (document === undefined && run.stdout.trim().length > 0) {
        throw new ScError('SC_PARSE', 'Could not parse JSON from sc output', {
          argv: run.argv,
          stdout: run.stdout,
          stderr: run.stderr,
        })
      }

      const envelope = unwrapEnvelope(document)
      if (envelope.error) throw envelopeError(envelope.error, run.argv, run.stdout, run.stderr)

      const result: Fetched<T> = {
        value: normalize(slice === 'container' ? envelope.container : envelope.payload),
        raw: document,
        command: `sc ${run.argv.join(' ')}`,
        fetchedAt: Date.now(),
        durationMs: run.durationMs,
      }
      this.cache.set(key, { at: Date.now(), value: result })
      return result
    })()

    this.inFlight.set(key, work)
    try {
      return await work
    } finally {
      this.inFlight.delete(key)
    }
  }

  whoami(options: FetchOptions = {}): Promise<Fetched<string | undefined>> {
    return this.fetch('whoami', 'whoami', ['whoami'], ['--json'], normalizeIdentity, options)
  }

  /**
   * Overview and cash-breakdown are two commands but one screen: `broker
   * overview` values only what is invested, so the cash side has to be fetched
   * alongside it. A failing cash call degrades to "no cash figure" rather than
   * taking the whole summary down with it.
   */
  async overview(options: FetchOptions = {}): Promise<Fetched<PortfolioSummary>> {
    const [overview, cash] = await Promise.all([
      this.fetch('overview', 'overview', ['broker', 'overview'], ['--json'], (p) => p, options),
      this.cash(options).catch(() => undefined),
    ])

    return { ...overview, value: normalizeSummary(overview.value, cash?.value) }
  }

  cash(options: FetchOptions = {}): Promise<Fetched<CashBreakdown>> {
    return this.fetch('cash', 'cash', ['broker', 'cash-breakdown'], ['--json'], normalizeCash, options)
  }

  async holdings(options: FetchOptions = {}): Promise<Fetched<Holding[]>> {
    const fetched = await this.fetch(
      'holdings',
      'holdings',
      ['broker', 'holdings'],
      ['--json'],
      (payload) => normalizeHoldings(payload),
      options,
    )

    const quotes = await this.quotesFor(fetched.value, options)
    const value = fetched.value.map((holding, index) => {
      const quote = quotes[index]
      if (quote === undefined) return holding
      return {
        ...holding,
        price: holding.price ?? quote.last,
        dayChange: holding.dayChange ?? multiply(quote.change, holding.quantity),
        dayChangePct: holding.dayChangePct ?? quote.changePct,
        pnlPct: holding.pnlPct ?? quote.sinceBuyPct,
      }
    })
    return { ...fetched, value }
  }

  async watchlist(options: FetchOptions = {}): Promise<Fetched<WatchItem[]>> {
    const fetched = await this.fetch(
      'watchlist',
      'watchlist',
      ['broker', 'watchlist'],
      ['--json'],
      (payload) => normalizeWatchlist(payload),
      options,
    )

    const quotes = await this.quotesFor(fetched.value, options)
    const value = fetched.value.map((item, index) => {
      const quote = quotes[index]
      if (quote === undefined) return item
      return { ...item, price: item.price ?? quote.last, changePct: item.changePct ?? quote.changePct }
    })
    return { ...fetched, value }
  }

  /**
   * One quote per row, for the day-change columns.
   *
   * Neither `broker holdings` nor `broker watchlist` returns a day change, and a
   * permanently empty "Heute" column is worse than a slightly slower refresh.
   * These quotes share the cache with the detail pane, so opening a position
   * costs nothing extra. A quote that fails leaves that row's cell at `—`
   * instead of failing the whole list.
   */
  private async quotesFor(
    rows: readonly { isin: string }[],
    options: FetchOptions,
  ): Promise<Array<Quote | undefined>> {
    return Promise.all(
      rows.slice(0, ENRICH_LIMIT).map((row) =>
        row.isin === '—'
          ? Promise.resolve(undefined)
          : this.quote(row.isin, options).then(
              (fetched) => fetched.value,
              () => undefined,
            ),
      ),
    )
  }

  transactions(options: FetchOptions = {}): Promise<Fetched<Transaction[]>> {
    return this.fetch(
      'transactions',
      'transactions',
      ['broker', 'transactions'],
      ['--page-size', String(TRANSACTION_PAGE_SIZE), '--json'],
      (payload) => normalizeTransactions(payload),
      options,
    )
  }

  overnight(options: FetchOptions = {}): Promise<Fetched<OvernightAccount>> {
    // The account's display name sits beside `result`, not inside it.
    return this.fetch(
      'overnight',
      'overnight',
      ['overnight'],
      ['--json'],
      normalizeOvernight,
      options,
      'container',
    )
  }

  quote(isin: string, options: FetchOptions = {}): Promise<Fetched<Quote>> {
    return this.fetch(
      `quote:${isin}`,
      'quote',
      ['broker', 'quote'],
      ['--isin', isin, '--json'],
      (payload) => normalizeQuote(payload, isin),
      options,
    )
  }

  chart(isin: string, timeframe: Timeframe, options: FetchOptions = {}): Promise<Fetched<ChartSeries>> {
    return this.fetch(
      `chart:${isin}:${timeframe}`,
      'chart',
      ['broker', 'chart'],
      ['--isin', isin, '--timeframe', timeframe, '--json'],
      (payload) => normalizeChart(payload, isin, timeframe),
      options,
    )
  }

  search(query: string, options: FetchOptions = {}): Promise<Fetched<SearchResult[]>> {
    // Die Suchanfrage ist der einzige Nutzertext, der als Positionsargument an
    // sc geht — mit führendem "-" würde die CLI sie als Flag lesen. Abweisen
    // statt säubern, damit sichtbar bleibt, warum nichts gesucht wurde.
    if (query.trimStart().startsWith('-')) {
      return Promise.reject(
        new ScError('SC_FORBIDDEN', t.searchNoDash, {
          argv: ['broker', 'search', query],
        }),
      )
    }
    return this.fetch(
      `search:${query}`,
      'search',
      ['broker', 'search'],
      [query, '--json'],
      (payload) => normalizeSearch(payload),
      options,
    )
  }
}
