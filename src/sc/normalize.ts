/**
 * Maps `sc --json` payloads onto the models the UI renders.
 *
 * The field names verified against `sc 1.0.0` come first in every alias list;
 * the looser guesses behind them are kept as a cushion for CLI drift (see
 * `json.ts`). Every field is optional — anything that cannot be resolved renders
 * as `—` rather than breaking the view. Derived values (market value, P/L,
 * weight) are computed locally when the payload does not supply them, so the
 * tables stay useful against a partial response.
 *
 * Each model keeps its `raw` payload so the `d` (debug) overlay can show
 * exactly what came back — that is the fastest way to correct an alias guess.
 */

import { bool, get, getCurrency, getList, getNum, getStr, isRecord, type Json } from './json.js'
import { t } from '../strings.js'

/** `get` then `bool` — shallow, since flags are never nested. */
function getBool(source: unknown, candidates: readonly string[]): boolean | undefined {
  return bool(get(source, candidates))
}

export interface PortfolioSummary {
  portfolioName?: string
  portfolioId?: string
  currency: string
  /** Total portfolio value including cash. */
  totalValue?: number
  /** Market value of securities only. */
  securitiesValue?: number
  /** Uninvested cash. */
  cash?: number
  /** Absolute change since the previous close. */
  dayChange?: number
  /** Percentage change since the previous close (1.24 means +1.24 %). */
  dayChangePct?: number
  /** Absolute lifetime return. */
  totalReturn?: number
  /** Percentage lifetime return. */
  totalReturnPct?: number
  raw: Json | undefined
}

export interface Holding {
  isin: string
  name: string
  /** `ETF`, `STOCK`, … — the CLI carries no ticker symbol. */
  type?: string
  currency: string
  quantity?: number
  /** Current price per unit (`quote_mid_price`). */
  price?: number
  /** FIFO purchase price per unit (`fifo_price`). */
  buyPrice?: number
  /** Market value of the position (`valuation`). */
  value?: number
  /** Absolute unrealised P/L. */
  pnl?: number
  /** Percentage unrealised P/L. */
  pnlPct?: number
  /** Absolute change since the previous close. Needs a quote lookup. */
  dayChange?: number
  /** Percentage change since the previous close. Needs a quote lookup. */
  dayChangePct?: number
  /** Share of the total portfolio, 0–100. */
  weightPct?: number
  /** True when the venue flagged the quote as stale (`quote_is_outdated`). */
  stale?: boolean
  raw: Json
}

export interface WatchItem {
  isin: string
  name: string
  type?: string
  currency: string
  price?: number
  changePct?: number
  stale?: boolean
  raw: Json
}

export interface SavingsPlan {
  isin: string
  name: string
  type?: string
  currency: string
  /** Plan rate per execution, in the account currency. */
  amount?: number
  /** Raw CLI enum, e.g. `MONTHLY` — rendered via `t.frequencyLabel`. */
  frequency?: string
  dayOfMonth?: number
  /** ISO date of the next execution. */
  nextExecution?: string
  dynamizationRate?: number
  paymentMethod?: string
  raw: Json
}

export interface TransactionDetails {
  id?: string
  name?: string
  isin?: string
  type?: string
  side?: string
  orderKind?: string
  status?: string
  venue?: string
  averagePrice?: number
  limitPrice?: number
  sharesFilled?: number
  sharesTotal?: number
  totalAmount?: number
  fee?: number
  tax?: number
  currency: string
  isPending?: boolean
  reference?: string
  /** Document labels only — downloading is not something a dashboard does. */
  documents: string[]
  /** Order lifecycle, oldest first: REQUESTED → PENDING → FILLED. */
  history: Array<{ state?: string; time?: string; price?: number; filled?: number }>
  raw: Json
}

export interface NewsSummary {
  /** One-paragraph AI summary, in the requested locale. */
  short?: string
  long?: string
  updatedAt?: string
  items: Array<{ headline: string; time?: string; source?: string }>
}

/** `broker cash-breakdown` — cash never appears in `broker overview`. */
export interface CashBreakdown {
  currency: string
  balance?: number
  buyingPower?: number
  pendingBuyOrders?: number
  raw: Json | undefined
}

export interface Transaction {
  id?: string
  date?: string
  /** The most specific label available: SAVINGS_PLAN / BUY / CASH_TRANSACTION / … */
  type?: string
  /** BUY or SELL, when the row is a security transaction. */
  side?: string
  status?: string
  name?: string
  isin?: string
  quantity?: number
  price?: number
  amount?: number
  currency: string
  raw: Json
}

export interface Quote {
  isin: string
  name?: string
  type?: string
  currency: string
  last?: number
  bid?: number
  ask?: number
  previousClose?: number
  change?: number
  changePct?: number
  /** Return since the position was opened, from the `SINCE_BUY` timeframe. */
  sinceBuy?: number
  sinceBuyPct?: number
  stale?: boolean
  time?: string
  raw: Json | undefined
}

export interface ChartPoint {
  /** Epoch milliseconds. */
  t?: number
  v: number
}

export interface ChartSeries {
  isin: string
  timeframe: string
  currency: string
  points: ChartPoint[]
  /** Price at the start of the timeframe (`closing_reference_point`). */
  reference?: number
  raw: Json | undefined
}

export interface SearchResult {
  isin: string
  name: string
  type?: string
  currency: string
  price?: number
  changePct?: number
  raw: Json
}

export interface OvernightAccount {
  name?: string
  currency: string
  balance?: number
  /** Already scaled to a percentage: the CLI sends `0.025` for 2,5 %. */
  interestRatePct?: number
  interestAccrued?: number
  /** Estimated amount of the next interest payout. */
  nextPayout?: number
  nextPayoutDate?: string
  raw: Json | undefined
}

// ---------------------------------------------------------------------------
// Alias tables — the whole guessing game lives here, in one place.
// ---------------------------------------------------------------------------

const ISIN_KEYS = ['isin', 'instrumentId', 'securityId', 'instrument.isin', 'security.isin']
const NAME_KEYS = [
  'name',
  'displayName',
  'instrumentName',
  'securityName',
  'shortName',
  'title',
  'description',
  'instrument.name',
  'security.name',
]
const TYPE_KEYS = ['securityType', 'instrumentType', 'assetClass', 'type', 'category']
const QUANTITY_KEYS = ['quantity', 'shares', 'units', 'amountShares', 'numberOfShares', 'size']
const PRICE_KEYS = [
  'quoteMidPrice',
  'price',
  'lastPrice',
  'currentPrice',
  'last',
  'marketPrice',
  'close',
  'mid',
]
const VALUE_KEYS = ['valuation', 'marketValue', 'value', 'currentValue', 'positionValue', 'worth']
const BUY_PRICE_KEYS = [
  'fifoPrice',
  'buyPrice',
  'averagePrice',
  'avgPrice',
  'averageBuyPrice',
  'costPrice',
  'entryPrice',
]
const TIME_KEYS = [
  'quoteTimestampUtc',
  'timestampUtc',
  'lastEventDatetime',
  'time',
  'timestamp',
  'quoteTime',
  'asOf',
  'updatedAt',
]
const PNL_KEYS = ['unrealizedPnl', 'unrealisedPnl', 'profitLoss', 'pnl', 'absoluteReturn', 'gainLoss']
const PNL_PCT_KEYS = [
  'unrealizedPnlPercent',
  'unrealisedPnlPercent',
  'profitLossPercent',
  'pnlPercent',
  'relativeReturn',
  'returnPercent',
  'totalReturnPercent',
  'performancePercent',
  // Payloads that group the figure and its percentage: `{"total_return":
  // {"amount": 8123.9, "percent": 15.28}}`. Listed last so a flat key wins.
  'totalReturn.percent',
  'profitLoss.percent',
  'pnl.percent',
]
const DAY_PCT_KEYS = [
  'dayChangePercent',
  'changePercent',
  'todayPercent',
  'dailyChangePercent',
  'percentChange',
  'changePct',
  'dayChange.percent',
  'change.percent',
]

// ---------------------------------------------------------------------------
// Performance arrays
// ---------------------------------------------------------------------------

/**
 * Timeframe ids used inside `performance` (overview) and `quote_performances`
 * (quote). `MAX` is lifetime; `SINCE_BUY` only exists on a held position.
 */
const INTRADAY = 'INTRADAY'
const LIFETIME = 'MAX'
const SINCE_BUY = 'SINCE_BUY'

interface PerformancePoint {
  /** Money, in the quote currency — the CLI's `simple_absolute_return`. */
  abs?: number
  /** A *fraction*: 0.7255 means +72.55 %. The CLI's `performance`. */
  ratio?: number
}

/**
 * Reshape a timeframe-keyed performance array into a lookup.
 *
 * Both `performance: [{simpleAbsoluteReturn, timeframe}]` and
 * `quote_performances: [{performance, simple_absolute_return, timeframe}]` are
 * arrays rather than objects, so the alias machinery cannot see into them.
 *
 * The two figures are easy to confuse and were pinned down against live data:
 * `performance` is a fraction, `simpleAbsoluteReturn` is money. Verified by
 * cross-checking a quote (mid 158.88, MAX ratio 0.7255, MAX abs 66.80 →
 * 158.88/1.7255 = 92.08 and 158.88 − 92.08 = 66.80) and by summing the
 * per-holding intraday figures back up to the portfolio's own day change.
 */
function readPerformance(source: unknown): Map<string, PerformancePoint> {
  const out = new Map<string, PerformancePoint>()
  const rows = get(source, ['performance', 'quotePerformances', 'performances'])
  if (!Array.isArray(rows)) return out

  for (const row of rows) {
    if (!isRecord(row)) continue
    const timeframe = getStr(row, ['timeframe', 'period', 'range'])
    if (timeframe === undefined) continue
    out.set(timeframe.toUpperCase(), {
      abs: getNum(row, ['simpleAbsoluteReturn', 'absoluteReturn', 'absolute'], false),
      ratio: getNum(row, ['performance', 'simpleReturn', 'relativeReturn'], false),
    })
  }
  return out
}

/**
 * Turn a performance point into a percentage.
 *
 * Prefers the CLI's own fraction. Falls back to backing the percentage out of
 * the absolute return and the current value, since `value − abs` is what the
 * position was worth at the start of the timeframe.
 */
function pointPct(point: PerformancePoint | undefined, current?: number): number | undefined {
  if (point?.ratio !== undefined) return point.ratio * 100
  if (point?.abs === undefined || current === undefined) return undefined
  const before = current - point.abs
  return before === 0 ? undefined : (point.abs / Math.abs(before)) * 100
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

/**
 * `broker overview` — the valuation breakdown plus a timeframe-keyed
 * performance array.
 *
 * `valuation.total` is securities + crypto and demonstrably excludes cash (it
 * equals `valuation.securities` exactly when there are no crypto holdings, and
 * there is no cash line in the breakdown), so cash is folded in here from the
 * separate `broker cash-breakdown` call rather than assumed to be included.
 */
export function normalizeSummary(payload: Json | undefined, cash?: CashBreakdown): PortfolioSummary {
  const currency = cash?.currency ?? getCurrency(payload)
  const securitiesValue =
    getNum(payload, ['valuation.total', 'securitiesValue', 'investedValue', 'positionsValue', 'depotValue']) ??
    addMaybe(getNum(payload, ['valuation.securities']), getNum(payload, ['valuation.crypto']))
  const cashBalance = cash?.balance ?? getNum(payload, ['cashBalance', 'cash', 'availableCash', 'liquidity'])
  const totalValue = addMaybe(securitiesValue, cashBalance)

  // Returns are a property of the invested capital, so they are relative to the
  // securities valuation rather than to the portfolio total.
  const performance = readPerformance(payload)
  const day = performance.get(INTRADAY)
  const lifetime = performance.get(LIFETIME)

  return {
    portfolioName: getStr(payload, ['portfolioName', 'accountName', 'label'], true),
    portfolioId: getStr(payload, ['portfolioId'], true),
    currency,
    totalValue,
    securitiesValue,
    cash: cashBalance,
    dayChange: day?.abs ?? getNum(payload, ['dayChange', 'todayChange', 'dailyChange', 'changeToday']),
    dayChangePct: pointPct(day, securitiesValue) ?? getNum(payload, DAY_PCT_KEYS),
    totalReturn: lifetime?.abs ?? getNum(payload, PNL_KEYS),
    totalReturnPct: pointPct(lifetime, securitiesValue) ?? getNum(payload, PNL_PCT_KEYS),
    raw: payload,
  }
}

/** `broker cash-breakdown`. */
export function normalizeCash(payload: Json | undefined): CashBreakdown {
  return {
    currency: getCurrency(payload),
    balance: getNum(payload, ['cashBalance', 'cash', 'balance', 'availableCash']),
    buyingPower: getNum(payload, ['buyingPower', 'buyingPowerWithoutCredit']),
    pendingBuyOrders: getNum(payload, ['pendingBuyOrdersAmount', 'pendingBuyOrders']),
    raw: payload,
  }
}

/**
 * `whoami` — a person record, not an email. Falls back to any plausible
 * identifier so a changed shape degrades to something rather than nothing.
 */
export function normalizeIdentity(payload: Json | undefined): string | undefined {
  const first = getStr(payload, ['firstName', 'givenName'], true)
  const last = getStr(payload, ['lastName', 'familyName', 'surname'], true)
  const full = [first, last].filter((part) => part !== undefined).join(' ')
  if (full.length > 0) return full
  return getStr(payload, ['email', 'displayName', 'name', 'userId', 'externalId'], true)
}

/**
 * `broker holdings`.
 *
 * The payload carries no P/L and no day change: cost basis has to be rebuilt
 * from `fifo_price × quantity`, and the day change can only come from a
 * per-ISIN quote (see `ScClient.holdings`).
 */
export function normalizeHoldings(payload: Json | undefined, fallbackCurrency = 'EUR'): Holding[] {
  const rows = getList(payload, ['items', 'holdings', 'positions', 'results'])
  const holdings: Holding[] = rows.filter(isRecord).map((row) => {
    const currency =
      getStr(row, ['valuationCurrency'])?.toUpperCase() ?? getCurrency(row, fallbackCurrency)
    const quantity = getNum(row, QUANTITY_KEYS)
    const price = getNum(row, PRICE_KEYS)
    const buyPrice = getNum(row, BUY_PRICE_KEYS)
    const value = getNum(row, VALUE_KEYS) ?? multiplyMaybe(quantity, price)

    const costBasis =
      getNum(row, ['costBasis', 'investedAmount', 'totalCost', 'purchaseValue']) ??
      multiplyMaybe(quantity, buyPrice)
    const pnl = getNum(row, PNL_KEYS) ?? subtractMaybe(value, costBasis)
    const pnlPct =
      getNum(row, PNL_PCT_KEYS) ??
      (costBasis !== undefined && costBasis !== 0 && pnl !== undefined
        ? (pnl / Math.abs(costBasis)) * 100
        : undefined)

    return {
      isin: getStr(row, ISIN_KEYS, true) ?? '—',
      name: getStr(row, NAME_KEYS, true) ?? getStr(row, ISIN_KEYS, true) ?? t.unknownName,
      type: getStr(row, TYPE_KEYS),
      currency,
      quantity,
      price,
      buyPrice,
      value,
      pnl,
      pnlPct,
      dayChangePct: getNum(row, DAY_PCT_KEYS),
      weightPct: getNum(row, ['weight', 'weightPercent', 'allocation', 'share', 'portfolioShare']),
      stale: getBool(row, ['quoteIsOutdated', 'isOutdated', 'stale']),
      raw: row as Json,
    }
  })

  // Fill in weights locally when the payload does not carry them.
  const total = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0)
  if (total > 0) {
    for (const holding of holdings) {
      if (holding.weightPct === undefined && holding.value !== undefined) {
        holding.weightPct = (holding.value / total) * 100
      }
    }
  }

  return holdings
}

export function normalizeWatchlist(payload: Json | undefined, fallbackCurrency = 'EUR'): WatchItem[] {
  const rows = getList(payload, ['items', 'watchlist', 'instruments', 'entries', 'results'])
  return rows.filter(isRecord).map((row) => ({
    isin: getStr(row, ISIN_KEYS, true) ?? '—',
    name: getStr(row, NAME_KEYS, true) ?? getStr(row, ISIN_KEYS, true) ?? t.unknownName,
    type: getStr(row, TYPE_KEYS),
    currency: getCurrency(row, fallbackCurrency),
    price: getNum(row, PRICE_KEYS),
    changePct: getNum(row, DAY_PCT_KEYS),
    stale: getBool(row, ['quoteIsOutdated', 'isOutdated', 'stale']),
    raw: row as Json,
  }))
}

/**
 * `broker savings-plans`.
 *
 * The rate carries no currency of its own — plans are quoted in the account
 * currency, so the fallback applies. `next_execution_date` is an ISO date;
 * its redundant `_epoch_day` twin is ignored.
 */
export function normalizeSavingsPlans(
  payload: Json | undefined,
  fallbackCurrency = 'EUR',
): SavingsPlan[] {
  const rows = getList(payload, ['items', 'savingsPlans', 'plans', 'entries', 'results'])
  return rows.filter(isRecord).map((row) => ({
    isin: getStr(row, ISIN_KEYS, true) ?? '—',
    name: getStr(row, NAME_KEYS, true) ?? getStr(row, ISIN_KEYS, true) ?? t.unknownName,
    type: getStr(row, TYPE_KEYS),
    currency: getCurrency(row, fallbackCurrency),
    amount: getNum(row, ['amount', 'rate', 'savingsPlanAmount', 'monthlyAmount']),
    frequency: getStr(row, ['frequency', 'interval', 'executionFrequency']),
    dayOfMonth: getNum(row, ['dayOfMonth', 'executionDay']),
    nextExecution: getStr(row, ['nextExecutionDate', 'nextExecution', 'nextRun']),
    dynamizationRate: getNum(row, ['dynamizationRate', 'dynamization']),
    paymentMethod: getStr(row, ['paymentMethod', 'paymentSource']),
    raw: row as Json,
  }))
}

/**
 * `broker transaction details`.
 *
 * The interesting fields live one level down in `security_trade` (dot-path
 * aliases reach them); `history` carries the order lifecycle and `documents`
 * only its labels — the URLs are web-app-relative and useless in a terminal.
 */
export function normalizeTransactionDetails(
  payload: Json | undefined,
  fallbackCurrency = 'EUR',
): TransactionDetails {
  const row = isRecord(payload) ? payload : {}
  const documents = getList(payload, ['documents'])
    .filter(isRecord)
    .map((doc) => getStr(doc, ['label', 'name'], true) ?? '')
    .filter((label) => label.length > 0)
  const history = getList(payload, ['history'])
    .filter(isRecord)
    .map((step) => ({
      state: getStr(step, ['state', 'status']),
      time: getStr(step, ['timestamp', 'time', 'datetime']),
      price: getNum(step, ['executionPrice', 'price']),
      filled: getNum(step, ['numberOfShares.filled', 'filled']),
    }))

  return {
    id: getStr(row, ['id', 'transactionId'], true),
    name: getStr(row, ['security.name', ...NAME_KEYS], true),
    isin: getStr(row, ISIN_KEYS, true),
    type: getStr(row, ['security.securityType', ...TYPE_KEYS]),
    side: getStr(row, ['securityTrade.side', 'side']),
    orderKind: getStr(row, ['securityTrade.orderKind', 'orderKind', 'detailType']),
    status: getStr(row, ['securityTrade.status', 'status']),
    venue: getStr(row, ['securityTrade.tradingVenue', 'tradingVenue', 'venue']),
    averagePrice: getNum(row, ['securityTrade.averagePrice', 'averagePrice']),
    limitPrice: getNum(row, ['securityTrade.limitPrice', 'limitPrice']),
    sharesFilled: getNum(row, ['securityTrade.numberOfShares.filled']),
    sharesTotal: getNum(row, ['securityTrade.numberOfShares.total']),
    totalAmount: getNum(row, ['securityTrade.totalAmount', 'totalAmount', 'amount']),
    fee: getNum(row, [
      'securityTrade.fee',
      'securityTrade.tradeTransactionAmounts.transactionFee',
      'securityTrade.transactionalFee',
      'fee',
    ]),
    tax: getNum(row, ['securityTrade.taxes', 'securityTrade.tradeTransactionAmounts.taxAmount']),
    currency: getCurrency(row, fallbackCurrency),
    isPending: bool(get(row, ['isPending'])),
    reference: getStr(row, ['transactionReference', 'reference'], true),
    documents,
    history,
    raw: (payload ?? null) as Json,
  }
}

/**
 * `broker security-news`.
 *
 * Like `broker chart`, the payload has no `result` — the caller passes the
 * whole `data` container. ETFs usually come back empty; that is the API,
 * not a parsing failure.
 */
export function normalizeNews(payload: Json | undefined): NewsSummary {
  const row = isRecord(payload) ? payload : {}
  const items = getList(payload, ['sources', 'items', 'news'])
    .filter(isRecord)
    .map((entry) => ({
      headline: getStr(entry, ['headline', 'title'], true) ?? '',
      time: getStr(entry, ['publicationTimeUtc', 'publishedAt', 'time']),
      source: getStr(entry, ['sourceName', 'source']),
    }))
    .filter((entry) => entry.headline.length > 0)
    .sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))

  return {
    short: getStr(row, ['summary.short'], true),
    long: getStr(row, ['summary.long'], true),
    updatedAt: getStr(row, ['summary.lastUpdated']),
    items,
  }
}

/**
 * `broker transactions`.
 *
 * Three fields describe what a row *is*: `type` (SECURITY_TRANSACTION /
 * CASH_TRANSACTION), `side` (BUY / SELL) and `security_transaction_type`
 * (SAVINGS_PLAN, DISTRIBUTION, …). The most specific one that is present makes
 * the best label, so they are tried in that order. `amount` is signed from the
 * cash account's point of view — a savings-plan buy is −10, the deposit that
 * funded it is +10.
 */
export function normalizeTransactions(
  payload: Json | undefined,
  fallbackCurrency = 'EUR',
): Transaction[] {
  const rows = getList(payload, ['items', 'transactions', 'entries', 'results'])
  return rows.filter(isRecord).map((row) => {
    const quantity = getNum(row, QUANTITY_KEYS)
    const amount = getNum(row, ['amount', 'total', 'totalAmount', 'netAmount', 'grossAmount'])

    return {
      id: getStr(row, ['id', 'transactionId', 'reference', 'uuid'], true),
      date: getStr(row, [...TIME_KEYS, 'date', 'executedAt', 'createdAt', 'valueDate', 'bookingDate']),
      type:
        getStr(row, ['securityTransactionType']) ??
        getStr(row, ['side']) ??
        getStr(row, ['type', 'transactionType', 'kind', 'category', 'direction']),
      side: getStr(row, ['side', 'direction']),
      status: getStr(row, ['status', 'state']),
      name: getStr(row, NAME_KEYS, true),
      isin: getStr(row, ISIN_KEYS, true),
      quantity,
      price:
        getNum(row, ['price', 'executionPrice', 'unitPrice']) ??
        (quantity !== undefined && quantity !== 0 && amount !== undefined
          ? Math.abs(amount) / quantity
          : undefined),
      amount,
      currency: getCurrency(row, fallbackCurrency),
      raw: row as Json,
    }
  })
}

/**
 * `broker quote` — bid/mid/ask plus a `quote_performances` array.
 *
 * There is no open/high/low and no previous close in the payload; the day change
 * comes out of the INTRADAY performance entry, and the previous close is backed
 * out of it. `SINCE_BUY` is only present for a security the account holds.
 */
export function normalizeQuote(payload: Json | undefined, isin: string): Quote {
  // A quote response may be `{...}` or `{ quotes: [ {...} ] }`.
  let source: Json | undefined = payload
  if (Array.isArray(payload)) source = payload[0]
  else {
    const list = getList(payload, ['quotes'])
    if (list.length === 1 && isRecord(list[0])) source = list[0] as Json
  }

  const bid = getNum(source, ['quoteBidPrice', 'bid', 'bidPrice'])
  const ask = getNum(source, ['quoteAskPrice', 'ask', 'askPrice', 'offer'])
  const mid = getNum(source, PRICE_KEYS) ?? averageMaybe(bid, ask)

  const performance = readPerformance(source)
  const day = performance.get(INTRADAY)
  const sinceBuy = performance.get(SINCE_BUY)

  const change = day?.abs ?? getNum(source, ['change', 'dayChange', 'absoluteChange', 'priceChange'])
  const previousClose =
    getNum(source, ['previousClose', 'prevClose', 'lastClose']) ?? subtractMaybe(mid, change)

  return {
    isin: getStr(source, ISIN_KEYS, true) ?? isin,
    name: getStr(source, NAME_KEYS, true),
    type: getStr(source, TYPE_KEYS),
    currency: getCurrency(source),
    last: mid,
    bid,
    ask,
    previousClose,
    change,
    changePct: pointPct(day, mid) ?? getNum(source, DAY_PCT_KEYS),
    sinceBuy: sinceBuy?.abs,
    sinceBuyPct: pointPct(sinceBuy, mid),
    stale: getBool(source, ['quoteIsOutdated', 'isOutdated', 'stale']),
    time: getStr(source, TIME_KEYS),
    raw: payload,
  }
}

const CHART_VALUE_KEYS = ['midPrice', 'close', 'value', 'price', 'v', 'y', 'last', 'mid']

/**
 * `broker chart` — the one command whose envelope has no `result`: the series
 * sits directly under `data` as `data_points`, alongside a
 * `closing_reference_point` that marks the start of the timeframe.
 */
export function normalizeChart(
  payload: Json | undefined,
  isin: string,
  timeframe: string,
): ChartSeries {
  const currency = getCurrency(payload)
  const rows = getList(payload, ['dataPoints', 'points', 'series', 'candles', 'prices', 'values', 'items'])

  const points: ChartPoint[] = []
  for (const row of rows) {
    if (typeof row === 'number') {
      if (Number.isFinite(row)) points.push({ v: row })
      continue
    }
    if (Array.isArray(row)) {
      // `[timestamp, value]` tuples.
      const t = toEpochMs(row[0])
      const v = getNum({ v: row[1] }, ['v'])
      if (v !== undefined) points.push({ t, v })
      continue
    }
    if (!isRecord(row)) continue
    const v = getNum(row, CHART_VALUE_KEYS, false)
    if (v === undefined) continue
    points.push({ t: toEpochMs(get(row, [...TIME_KEYS, 'date', 't', 'x'])), v })
  }

  // A bare array of numbers is also a valid response shape.
  if (points.length === 0 && Array.isArray(payload)) {
    for (const value of payload) {
      const v = getNum({ v: value }, ['v'])
      if (v !== undefined) points.push({ v })
    }
  }

  const reference = get(payload, ['closingReferencePoint', 'referencePoint', 'previousClose'])
  const referenceValue = getNum(reference, CHART_VALUE_KEYS, false) ?? getNum(payload, ['previousClose'])

  return {
    isin,
    timeframe,
    currency,
    points,
    ...(referenceValue === undefined ? {} : { reference: referenceValue }),
    raw: payload,
  }
}

export function normalizeSearch(payload: Json | undefined, fallbackCurrency = 'EUR'): SearchResult[] {
  const rows = getList(payload, ['items', 'results', 'instruments', 'securities', 'hits'])
  return rows.filter(isRecord).map((row) => ({
    isin: getStr(row, ISIN_KEYS, true) ?? '—',
    name: getStr(row, NAME_KEYS, true) ?? t.unknownName,
    type: getStr(row, TYPE_KEYS),
    currency: getCurrency(row, fallbackCurrency),
    price: getNum(row, PRICE_KEYS),
    changePct: getNum(row, DAY_PCT_KEYS),
    raw: row as Json,
  }))
}

/**
 * `overnight` — takes the whole `data` container, not just `data.result`: the
 * account's display name is a sibling of the balances rather than part of them.
 * `interest_rate` arrives as a fraction (0.025) and is scaled here so the UI
 * only ever handles percentages.
 */
export function normalizeOvernight(payload: Json | undefined): OvernightAccount {
  let source: Json | undefined = payload
  if (Array.isArray(payload) && payload.length > 0) source = payload[0]

  const rate = getNum(source, ['interestRate', 'rate', 'annualRate', 'interestRatePercent', 'apy'])

  return {
    name: getStr(source, ['displayName', 'name', 'accountName', 'productName', 'label'], true),
    currency: getCurrency(source),
    balance: getNum(source, ['balance', 'currentBalance', 'amount', 'totalValue']),
    interestRatePct: rate === undefined ? undefined : rate * 100,
    interestAccrued: getNum(source, [
      'currentAccruedAmount',
      'accruedInterest',
      'interestAccrued',
      'interestEarned',
    ]),
    nextPayout: getNum(source, ['estimatedNextPayoutAmount', 'nextPayoutAmount']),
    nextPayoutDate: getStr(source, ['nextPayoutDate'], true),
    raw: payload,
  }
}

// ---------------------------------------------------------------------------
// Small arithmetic helpers that propagate "unknown" instead of producing NaN.
// ---------------------------------------------------------------------------

function addMaybe(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined
  return (a ?? 0) + (b ?? 0)
}

function subtractMaybe(a?: number, b?: number): number | undefined {
  if (a === undefined || b === undefined) return undefined
  return a - b
}

function multiplyMaybe(a?: number, b?: number): number | undefined {
  if (a === undefined || b === undefined) return undefined
  return a * b
}

function averageMaybe(a?: number, b?: number): number | undefined {
  if (a === undefined || b === undefined) return a ?? b
  return (a + b) / 2
}

function percentOf(total?: number, pct?: number): number | undefined {
  if (total === undefined || pct === undefined) return undefined
  // `pct` is the change relative to the *previous* value, so back it out.
  const previous = total / (1 + pct / 100)
  return total - previous
}

function toEpochMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e11 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) return asNumber < 1e11 ? asNumber * 1000 : asNumber
  }
  return undefined
}
