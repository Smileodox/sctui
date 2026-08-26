/**
 * Demo data source — everything the UI needs, with no account and no `sc`.
 *
 * Prices follow a seeded random walk, so charts are stable for a given
 * instrument and timeframe rather than reshuffling on every render. A small
 * time-based drift is layered on top so the dashboard visibly "ticks" during
 * auto-refresh.
 */

import type {
  CashBreakdown,
  ChartSeries,
  Holding,
  OvernightAccount,
  PortfolioSummary,
  Quote,
  SearchResult,
  Transaction,
  WatchItem,
} from './normalize.js'
import type { DataSource, Fetched, FetchOptions, Timeframe } from './client.js'
import type { Json } from './json.js'
import { t } from '../strings.js'

interface Instrument {
  isin: string
  name: string
  symbol: string
  base: number
  vol: number
  quantity?: number
  buyPrice?: number
  type: string
}

const INSTRUMENTS: Instrument[] = [
  { isin: 'IE00BK5BQT80', name: 'Vanguard FTSE All-World UCITS ETF', symbol: 'VWCE', base: 132.4, vol: 0.6, quantity: 88, buyPrice: 108.2, type: 'ETF' },
  { isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World UCITS ETF', symbol: 'IWDA', base: 104.8, vol: 0.6, quantity: 140, buyPrice: 82.5, type: 'ETF' },
  { isin: 'US0378331005', name: 'Apple Inc.', symbol: 'AAPL', base: 214.6, vol: 1.4, quantity: 12, buyPrice: 168.3, type: 'STOCK' },
  { isin: 'NL0010273215', name: 'ASML Holding N.V.', symbol: 'ASML', base: 742.1, vol: 1.9, quantity: 4, buyPrice: 611.0, type: 'STOCK' },
  { isin: 'DE0007164600', name: 'SAP SE', symbol: 'SAP', base: 218.9, vol: 1.1, quantity: 18, buyPrice: 149.7, type: 'STOCK' },
  { isin: 'DE0007030009', name: 'Rheinmetall AG', symbol: 'RHM', base: 512.0, vol: 2.6, quantity: 6, buyPrice: 288.4, type: 'STOCK' },
  { isin: 'IE00B579F325', name: 'Invesco Physical Gold ETC', symbol: 'SGLD', base: 261.3, vol: 0.9, quantity: 22, buyPrice: 198.6, type: 'ETC' },
  { isin: 'DE000A27Z304', name: 'Bitcoin ETP', symbol: 'BTCE', base: 58.4, vol: 3.4, quantity: 30, buyPrice: 41.9, type: 'ETP' },
  // Watchlist-only instruments (no quantity).
  { isin: 'US88160R1014', name: 'Tesla Inc.', symbol: 'TSLA', base: 246.7, vol: 3.1, type: 'STOCK' },
  { isin: 'US67066G1040', name: 'NVIDIA Corporation', symbol: 'NVDA', base: 178.2, vol: 2.8, type: 'STOCK' },
  { isin: 'DE0008404005', name: 'Allianz SE', symbol: 'ALV', base: 342.5, vol: 0.9, type: 'STOCK' },
  { isin: 'US02079K3059', name: 'Alphabet Inc. Class A', symbol: 'GOOGL', base: 201.4, vol: 1.7, type: 'STOCK' },
]

const HELD = INSTRUMENTS.filter((i) => i.quantity !== undefined)
const WATCHED = INSTRUMENTS.filter((i) => i.quantity === undefined)

/** mulberry32 — small, fast, and deterministic for a given seed. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** A slow sine drift so repeated refreshes show movement without chaos. */
function drift(instrument: Instrument): number {
  const phase = (Date.now() / 45_000) % (Math.PI * 2)
  return Math.sin(phase + hashString(instrument.isin) % 100) * instrument.vol * 0.35
}

function priceOf(instrument: Instrument): number {
  const rng = seededRandom(hashString(instrument.isin))
  const offset = (rng() - 0.5) * instrument.vol * 2
  return round2(instrument.base + offset + drift(instrument))
}

function dayChangePctOf(instrument: Instrument): number {
  const rng = seededRandom(hashString(`${instrument.isin}:day`))
  return round2((rng() - 0.42) * instrument.vol * 2.2 + drift(instrument) * 0.4)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const POINTS_PER_TIMEFRAME: Record<Timeframe, number> = {
  '1d': 96,
  '7d': 120,
  '1m': 132,
  '3m': 180,
  '6m': 180,
  ytd: 200,
  '1y': 250,
  max: 300,
}

const SPAN_MS_PER_TIMEFRAME: Record<Timeframe, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '1m': 30 * 86_400_000,
  '3m': 91 * 86_400_000,
  '6m': 182 * 86_400_000,
  ytd: 240 * 86_400_000,
  '1y': 365 * 86_400_000,
  max: 10 * 365 * 86_400_000,
}

function makeSeries(instrument: Instrument, timeframe: Timeframe): Array<{ t: number; v: number }> {
  const count = POINTS_PER_TIMEFRAME[timeframe]
  const span = SPAN_MS_PER_TIMEFRAME[timeframe]
  const rng = seededRandom(hashString(`${instrument.isin}:${timeframe}`))
  const end = priceOf(instrument)

  // Walk backwards from today's price so the last point always matches the quote.
  const step = instrument.vol / 100
  // Longer timeframes drift further from today's price.
  const totalDrift = (rng() - 0.35) * (span / 86_400_000) * step * 0.9

  const values: number[] = []
  let value = end - totalDrift
  for (let i = 0; i < count; i++) {
    const shock = (rng() - 0.5) * instrument.vol * 0.9
    const pull = (end - value) * (i / count) * 0.06
    value = Math.max(instrument.base * 0.25, value + shock + pull + totalDrift / count)
    values.push(value)
  }
  values[values.length - 1] = end

  const startTime = Date.now() - span
  return values.map((v, i) => ({
    t: Math.round(startTime + (span * i) / Math.max(1, count - 1)),
    v: round2(v),
  }))
}

const TRANSACTION_TYPES = ['BUY', 'SELL', 'DIVIDEND', 'SAVINGS_PLAN', 'INTEREST', 'DEPOSIT'] as const

function makeTransactions(count: number): Transaction[] {
  const rng = seededRandom(0xc0ffee)
  const out: Transaction[] = []
  for (let i = 0; i < count; i++) {
    const type = TRANSACTION_TYPES[Math.floor(rng() * TRANSACTION_TYPES.length)] as string
    const instrument = HELD[Math.floor(rng() * HELD.length)] as Instrument
    const date = new Date(Date.now() - i * (18 * 3600_000) - Math.floor(rng() * 6 * 3600_000))
    const isCash = type === 'INTEREST' || type === 'DEPOSIT'
    const isDividend = type === 'DIVIDEND'
    const quantity = isCash ? undefined : round2(rng() * 6 + 0.2)
    const price = isCash || isDividend ? undefined : priceOf(instrument)

    // Money out on buys and savings plans, money in on sells and income.
    let amount: number
    if (isCash) amount = round2(rng() * 400 + 20)
    else if (isDividend) amount = round2((quantity ?? 1) * (rng() * 1.4 + 0.2))
    else {
      const gross = (quantity ?? 1) * (price ?? 1)
      amount = round2(type === 'SELL' ? gross : -gross)
    }

    out.push({
      id: `TX-${(1000 + i).toString(36).toUpperCase()}`,
      date: date.toISOString(),
      type,
      status: i === 0 && rng() > 0.6 ? 'PENDING' : 'EXECUTED',
      name: isCash ? (type === 'INTEREST' ? t.demoInterestName : t.demoTransferName) : instrument.name,
      isin: isCash ? undefined : instrument.isin,
      quantity,
      price,
      amount,
      currency: 'EUR',
      raw: { note: 'demo' } as Json,
    })
  }
  return out
}

function holdings(): Holding[] {
  const rows = HELD.map((instrument) => {
    const price = priceOf(instrument)
    const quantity = instrument.quantity as number
    const buyPrice = instrument.buyPrice as number
    const value = round2(price * quantity)
    const costBasis = round2(buyPrice * quantity)
    const pnl = round2(value - costBasis)
    return {
      isin: instrument.isin,
      name: instrument.name,
      type: instrument.type,
      currency: 'EUR',
      quantity,
      price,
      buyPrice,
      value,
      pnl,
      pnlPct: round2((pnl / costBasis) * 100),
      dayChangePct: dayChangePctOf(instrument),
      weightPct: undefined as number | undefined,
      raw: { isin: instrument.isin, name: instrument.name, quantity, price, buyPrice } as Json,
    }
  })

  const total = rows.reduce((sum, r) => sum + (r.value ?? 0), 0)
  for (const row of rows) row.weightPct = round2(((row.value ?? 0) / total) * 100)
  return rows
}

const DEMO_CASH = 4218.4

function summary(): PortfolioSummary {
  const rows = holdings()
  const securitiesValue = round2(rows.reduce((sum, r) => sum + (r.value ?? 0), 0))
  const totalValue = round2(securitiesValue + DEMO_CASH)
  const dayChange = round2(
    rows.reduce((sum, r) => {
      const pct = r.dayChangePct ?? 0
      const previous = (r.value ?? 0) / (1 + pct / 100)
      return sum + ((r.value ?? 0) - previous)
    }, 0),
  )
  const totalReturn = round2(rows.reduce((sum, r) => sum + (r.pnl ?? 0), 0))
  const costBasis = securitiesValue - totalReturn

  return {
    portfolioName: t.demoPortfolio,
    portfolioId: 'demo-0001',
    currency: 'EUR',
    totalValue,
    securitiesValue,
    cash: DEMO_CASH,
    dayChange,
    dayChangePct: round2((dayChange / (securitiesValue - dayChange)) * 100),
    totalReturn,
    totalReturnPct: round2((totalReturn / costBasis) * 100),
    raw: { demo: true } as Json,
  }
}

async function settle<T>(value: T, raw: Json, command: string, signal?: AbortSignal): Promise<Fetched<T>> {
  const started = Date.now()
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 90 + Math.floor(Math.random() * 120))
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('Aborted'))
      },
      { once: true },
    )
  })
  return { value, raw, command, fetchedAt: Date.now(), durationMs: Date.now() - started }
}

function findInstrument(isin: string): Instrument {
  return (
    INSTRUMENTS.find((i) => i.isin === isin) ??
    INSTRUMENTS.find((i) => i.symbol.toLowerCase() === isin.toLowerCase()) ?? {
      isin,
      name: isin,
      symbol: isin.slice(0, 6),
      base: 100,
      vol: 1.2,
      type: 'STOCK',
    }
  )
}

export class DemoClient implements DataSource {
  readonly kind = 'demo' as const

  whoami(options: FetchOptions = {}): Promise<Fetched<string | undefined>> {
    return settle(t.demoIdentity, { demo: true } as Json, 'demo: whoami', options.signal)
  }

  cash(options: FetchOptions = {}): Promise<Fetched<CashBreakdown>> {
    const value: CashBreakdown = {
      currency: 'EUR',
      balance: DEMO_CASH,
      buyingPower: DEMO_CASH,
      pendingBuyOrders: 0,
      raw: { cash_balance: DEMO_CASH } as Json,
    }
    return settle(value, value.raw ?? null, 'demo: sc broker cash-breakdown --json', options.signal)
  }

  overview(options: FetchOptions = {}): Promise<Fetched<PortfolioSummary>> {
    const value = summary()
    return settle(value, value.raw ?? null, 'demo: sc broker overview --json', options.signal)
  }

  holdings(options: FetchOptions = {}): Promise<Fetched<Holding[]>> {
    const value = holdings()
    return settle(value, value.map((h) => h.raw) as Json, 'demo: sc broker holdings --json', options.signal)
  }

  watchlist(options: FetchOptions = {}): Promise<Fetched<WatchItem[]>> {
    const value: WatchItem[] = WATCHED.map((instrument) => ({
      isin: instrument.isin,
      name: instrument.name,
      type: instrument.type,
      currency: 'EUR',
      price: priceOf(instrument),
      changePct: dayChangePctOf(instrument),
      raw: { isin: instrument.isin, name: instrument.name } as Json,
    }))
    return settle(value, value.map((w) => w.raw) as Json, 'demo: sc broker watchlist --json', options.signal)
  }

  transactions(options: FetchOptions = {}): Promise<Fetched<Transaction[]>> {
    const value = makeTransactions(40)
    return settle(value, { count: value.length } as Json, 'demo: sc broker transactions --json', options.signal)
  }

  overnight(options: FetchOptions = {}): Promise<Fetched<OvernightAccount>> {
    const value: OvernightAccount = {
      name: 'Tagesgeld',
      currency: 'EUR',
      balance: DEMO_CASH,
      interestRatePct: 2.25,
      interestAccrued: 31.86,
      nextPayout: 8.12,
      nextPayoutDate: '2026-09-01',
      raw: { demo: true } as Json,
    }
    return settle(value, value.raw ?? null, 'demo: sc overnight --json', options.signal)
  }

  quote(isin: string, options: FetchOptions = {}): Promise<Fetched<Quote>> {
    const instrument = findInstrument(isin)
    const last = priceOf(instrument)
    const changePct = dayChangePctOf(instrument)
    const previousClose = round2(last / (1 + changePct / 100))
    const spread = Math.max(0.01, round2(instrument.vol * 0.02))
    const value: Quote = {
      isin: instrument.isin,
      name: instrument.name,
      type: instrument.type,
      currency: 'EUR',
      last,
      bid: round2(last - spread),
      ask: round2(last + spread),
      previousClose,
      change: round2(last - previousClose),
      changePct,
      sinceBuy: round2(last * 0.11),
      sinceBuyPct: 11,
      stale: false,
      time: new Date().toISOString(),
      raw: { demo: true } as Json,
    }
    return settle(value, value.raw ?? null, `demo: sc broker quote --isin ${isin} --json`, options.signal)
  }

  chart(isin: string, timeframe: Timeframe, options: FetchOptions = {}): Promise<Fetched<ChartSeries>> {
    const instrument = findInstrument(isin)
    const value: ChartSeries = {
      isin: instrument.isin,
      timeframe,
      currency: 'EUR',
      points: makeSeries(instrument, timeframe),
      raw: { demo: true } as Json,
    }
    return settle(
      value,
      { points: value.points.length } as Json,
      `demo: sc broker chart --isin ${isin} --timeframe ${timeframe} --json`,
      options.signal,
    )
  }

  search(query: string, options: FetchOptions = {}): Promise<Fetched<SearchResult[]>> {
    const needle = query.trim().toLowerCase()
    const value: SearchResult[] = INSTRUMENTS.filter(
      (i) =>
        needle.length === 0 ||
        i.name.toLowerCase().includes(needle) ||
        i.symbol.toLowerCase().includes(needle) ||
        i.isin.toLowerCase().includes(needle),
    ).map((instrument) => ({
      isin: instrument.isin,
      name: instrument.name,
      type: instrument.type,
      currency: 'EUR',
      price: priceOf(instrument),
      changePct: dayChangePctOf(instrument),
      raw: { isin: instrument.isin } as Json,
    }))
    return settle(value, { count: value.length } as Json, `demo: sc broker search "${query}" --json`, options.signal)
  }
}
