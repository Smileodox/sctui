import { Box, Text } from 'ink'
import type React from 'react'
import { Chart } from '../components/Chart.js'
import { Panel } from '../components/Panel.js'
import { money, number, percent, truncate } from '../format.js'
import { theme, trendColor, trendGlyph } from '../theme.js'
import { type Timeframe } from '../sc/client.js'
import type { ChartSeries, Quote } from '../sc/normalize.js'

export interface DetailPaneProps {
  isin: string
  name?: string
  quote?: Quote
  chart?: ChartSeries
  timeframe: Timeframe
  width: number
  height: number
  focused?: boolean
  loading?: boolean
  error?: Error
}

/** The name and the price row; without these there is no pane worth drawing. */
const MANDATORY_ROWS = 2
/** The rest of the header, in the order a shrinking pane keeps them. */
const OPTIONAL_ROWS = ['identity', 'grid', 'topGap', 'gridGap'] as const
/** One row of braille plus the chart's own time axis and legend. */
const CHART_MIN_HEIGHT = 3

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Instrument detail: identity, live quote, and a price chart.
 *
 * The chart takes whatever vertical space is left after the quote grid, so the
 * pane degrades gracefully from a full-height sidebar down to a few rows.
 */
export function DetailPane({
  isin,
  name,
  quote,
  chart,
  timeframe,
  width,
  height,
  focused = false,
  loading = false,
  error,
}: DetailPaneProps): React.ReactElement {
  // Panel eats 2 rows of border and 1 row of title + 1 margin.
  const inner = Math.max(1, height - 4)
  const innerWidth = Math.max(10, width - 4)

  const currency = quote?.currency ?? chart?.currency ?? 'EUR'
  const displayName = name ?? quote?.name ?? isin

  // The header and the chart have to add up to `inner` exactly — asking for one
  // row too many makes Ink stack the name and the ISIN on top of each other
  // rather than clip them. The name and the price always stay; everything else
  // is given up in this order as the pane gets shorter.
  const affordable = clamp(inner - MANDATORY_ROWS - CHART_MIN_HEIGHT, 0, OPTIONAL_ROWS.length)
  const keep = new Set(OPTIONAL_ROWS.slice(0, affordable))
  const chartHeight = inner - MANDATORY_ROWS - keep.size
  const showChart = error === undefined && chartHeight >= CHART_MIN_HEIGHT

  return (
    <Panel
      title="Instrument"
      meta={`${timeframe} · [ ] ändern`}
      focused={focused}
      width={width}
      height={height}
    >
      <Box flexDirection="column">
        <Text color={theme.fg} bold>
          {truncate(displayName, innerWidth)}
        </Text>
        {keep.has('identity') ? (
          <Box>
            <Text color={theme.dim}>{isin}</Text>
            {quote?.type ? <Text color={theme.dim}> · {quote.type}</Text> : null}
            {quote?.stale ? <Text color={theme.warn}> · Kurs veraltet</Text> : null}
          </Box>
        ) : null}
        {keep.has('topGap') ? <Text> </Text> : null}

        <Box>
          <Text color={theme.fg} bold>
            {money(quote?.last, currency)}
          </Text>
          <Text color={theme.dim}>{'  '}</Text>
          <Text color={trendColor(quote?.changePct ?? quote?.change)}>
            {trendGlyph(quote?.changePct ?? quote?.change)} {percent(quote?.changePct)}
          </Text>
          <Box flexGrow={1} />
          {loading ? <Text color={theme.dim}>lädt…</Text> : null}
        </Box>

        {keep.has('grid') ? <QuoteGrid quote={quote} width={innerWidth} /> : null}
        {keep.has('gridGap') ? <Text> </Text> : null}
      </Box>

      {error ? (
        <Text color={theme.error}>{truncate(error.message, innerWidth)}</Text>
      ) : showChart ? (
        <Chart
          points={chart?.points ?? []}
          width={innerWidth}
          height={chartHeight}
          currency={currency}
          caption={timeframe}
          emptyMessage={loading ? 'lädt…' : 'Keine Kursdaten'}
        />
      ) : null}
    </Panel>
  )
}

/**
 * Bid/Ask/Vortag/Spread/seit Kauf on one row.
 *
 * The CLI's quote has no day range, so the row shows what it does carry: the
 * two sides of the book, the previous close backed out of the intraday return,
 * the spread, and — only for a held position — the return since purchase.
 *
 * Cells are laid out at a fixed width rather than flowing, so a long price can
 * never push the next label into it. When the pane is too narrow for five
 * cells, the least important ones are dropped instead of being squeezed.
 */
function QuoteGrid({ quote, width }: { quote?: Quote; width: number }): React.ReactElement {
  const spread =
    quote?.bid !== undefined && quote?.ask !== undefined ? quote.ask - quote.bid : undefined

  const all: Array<[string, string]> = [
    ['Bid', number(quote?.bid, 2)],
    ['Ask', number(quote?.ask, 2)],
    ['Vortag', number(quote?.previousClose, 2)],
    ['Spread', number(spread, 2)],
    ['seit Kauf', percent(quote?.sinceBuyPct)],
  ]

  // Keep Bid/Ask first, then the previous close, then the extras.
  const priority = [0, 1, 2, 4, 3]
  const GAP = 2
  const natural = ([label, value]: [string, string]): number => label.length + 1 + value.length

  // Cells are kept at the width they actually need, not at an even share of the
  // row: `seit Kauf +21,54` is half again as wide as `Bid 21,10`, and an even
  // share wraps it onto a second line — a row the pane has not budgeted for.
  const kept: number[] = []
  let used = 0
  for (const index of priority) {
    const wanted = natural(all[index] as [string, string]) + (kept.length > 0 ? GAP : 0)
    if (kept.length > 0 && used + wanted > width) continue
    kept.push(index)
    used += wanted
  }

  const order = kept.sort((a, b) => a - b)
  // Whatever is left over is shared out between the cells, so the row stays
  // spread across the pane instead of bunching up on the left.
  const extra = order.length > 1 ? Math.floor(Math.max(0, width - used) / (order.length - 1)) : 0

  return (
    <Box>
      {order.map((index, position) => {
        const [label, value] = all[index] as [string, string]
        const last = position === order.length - 1
        const cellWidth = natural([label, value]) + (last ? 0 : GAP + extra)
        return (
          <Box key={label} width={cellWidth}>
            <Text color={theme.dim}>{truncate(label, cellWidth)}</Text>
            <Text color={theme.muted}>
              {' '}
              {truncate(value, Math.max(0, cellWidth - label.length - 1))}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
