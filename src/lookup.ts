/**
 * ETF composition lookup — the one place in the app that talks to anything
 * other than the `sc` binary, and only when the user opted in.
 *
 * Source: Yahoo Finance's unofficial quote API. Two calls per instrument:
 * a search that maps the ISIN to a Yahoo symbol, then `quoteSummary` with the
 * `topHoldings` module. The latter requires Yahoo's cookie + crumb dance,
 * which is cached for the process lifetime and refreshed once on a 401.
 *
 * Privacy: the only data that ever leaves the machine is the ISIN. No account
 * data, no portfolio values, no identifiers. Being unofficial, this can break
 * without notice — every failure degrades to an empty state, never a crash.
 */

import { t } from './strings.js'

export interface FundComposition {
  symbol?: string
  /** Sector weights in percent, largest first. */
  sectors: Array<{ name: string; weightPct: number }>
  /** Top holdings in percent, largest first (Yahoo reports at most ten). */
  holdings: Array<{ name: string; weightPct: number }>
}

export class LookupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LookupError'
  }
}

export type CompositionSource = (isin: string, signal?: AbortSignal) => Promise<FundComposition>

/** The gate: without --enable-lookup, every call fails with the how-to hint. */
export function disabledCompositionSource(): CompositionSource {
  return () => Promise.reject(new LookupError(t.lookupDisabled))
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
const TIMEOUT_MS = 12_000

let session: { cookie: string; crumb: string } | undefined
const cache = new Map<string, { at: number; value: FundComposition }>()
const CACHE_TTL_MS = 60 * 60_000

async function getJson(url: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new LookupError(`${new URL(url).hostname}: HTTP ${response.status}`)
  return response.json()
}

async function freshSession(signal?: AbortSignal): Promise<{ cookie: string; crumb: string }> {
  // fc.yahoo.com answers 404 — its only job is handing out the session cookie.
  const bootstrap = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
  })
  const cookie = bootstrap.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0] ?? '')
    .filter((entry) => entry.length > 0)
    .join('; ')
  if (!cookie) throw new LookupError('Yahoo session cookie missing')

  const crumbResponse = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
  })
  const crumb = (await crumbResponse.text()).trim()
  if (!crumbResponse.ok || crumb === '' || crumb.includes('<')) {
    throw new LookupError('Yahoo crumb missing')
  }
  return { cookie, crumb }
}

async function symbolFor(isin: string, signal?: AbortSignal): Promise<string> {
  const data = (await getJson(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=1&newsCount=0`,
    { headers: { 'User-Agent': UA } },
    signal,
  )) as { quotes?: Array<{ symbol?: string }> }
  const symbol = data.quotes?.[0]?.symbol
  if (!symbol) throw new LookupError(t.fundEmpty)
  return symbol
}

interface RawWeight {
  raw?: number
}

async function topHoldings(
  symbol: string,
  auth: { cookie: string; crumb: string },
  signal?: AbortSignal,
): Promise<FundComposition> {
  const data = (await getJson(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=topHoldings&crumb=${encodeURIComponent(auth.crumb)}`,
    { headers: { 'User-Agent': UA, Cookie: auth.cookie } },
    signal,
  )) as {
    quoteSummary?: {
      result?: Array<{
        topHoldings?: {
          sectorWeightings?: Array<Record<string, RawWeight>>
          holdings?: Array<{ holdingName?: string; holdingPercent?: RawWeight }>
        }
      }>
      error?: { code?: string }
    }
  }

  const top = data.quoteSummary?.result?.[0]?.topHoldings
  if (!top) throw new LookupError(t.fundEmpty)

  const sectors = (top.sectorWeightings ?? [])
    .flatMap((entry) =>
      Object.entries(entry).map(([key, weight]) => ({
        name: t.sectorName(key),
        weightPct: (weight.raw ?? 0) * 100,
      })),
    )
    .filter((sector) => sector.weightPct > 0.05)
    .sort((a, b) => b.weightPct - a.weightPct)

  const holdings = (top.holdings ?? [])
    .map((entry) => ({
      name: entry.holdingName ?? '—',
      weightPct: (entry.holdingPercent?.raw ?? 0) * 100,
    }))
    .filter((holding) => holding.weightPct > 0)
    .sort((a, b) => b.weightPct - a.weightPct)

  return { symbol, sectors, holdings }
}

/** The live source, used only when the user started with --enable-lookup. */
export function yahooCompositionSource(): CompositionSource {
  return async (isin, signal) => {
    const hit = cache.get(isin)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

    const symbol = await symbolFor(isin, signal)
    session ??= await freshSession(signal)
    let value: FundComposition
    try {
      value = await topHoldings(symbol, session, signal)
    } catch (error) {
      // Crumbs expire; one refresh, then the error is real.
      if (error instanceof LookupError && error.message.includes('401')) {
        session = await freshSession(signal)
        value = await topHoldings(symbol, session, signal)
      } else {
        throw error
      }
    }
    cache.set(isin, { at: Date.now(), value })
    return value
  }
}
