import { Box, Text } from 'ink'
import type React from 'react'
import { date as fmtDate, number, pad, percent } from '../format.js'
import { axisTicks, brailleChart } from '../render/chart.js'
import { t } from '../strings.js'
import { theme, trendColor } from '../theme.js'
import type { ChartPoint } from '../sc/normalize.js'

export interface ChartProps {
  points: readonly ChartPoint[]
  width: number
  /** Total rows, the time axis and the legend underneath it included. */
  height: number
  currency?: string
  /** Shown top-right, e.g. the timeframe. */
  caption?: string
  emptyMessage?: string
}

/**
 * A price chart with a value axis on the left and a time axis underneath.
 *
 * The line is coloured by the net move over the visible window — green when
 * the last point is above the first, red below — which is the one comparison a
 * glance at a price chart is actually making.
 */
export function Chart({
  points,
  width,
  height,
  currency = 'EUR',
  caption,
  emptyMessage = t.noPriceData,
}: ChartProps): React.ReactElement {
  const values = points.map((p) => p.v).filter((v) => Number.isFinite(v))

  if (values.length < 2 || width < 12 || height < 3) {
    return (
      <Box height={Math.max(1, height)} alignItems="center">
        <Text color={theme.dim}>{values.length > 0 ? t.tooFewPoints : emptyMessage}</Text>
      </Box>
    )
  }

  const first = values[0] as number
  const last = values[values.length - 1] as number
  const change = last - first
  const changePct = first !== 0 ? (change / Math.abs(first)) * 100 : 0
  const lineColor = trendColor(change)

  // Reserve a left gutter wide enough for the largest axis label.
  const min = Math.min(...values)
  const max = Math.max(...values)
  const sampleLabel = number(max, decimalsFor(max - min))
  const axisWidth = Math.min(12, Math.max(6, sampleLabel.length + 1))
  const plotWidth = Math.max(4, width - axisWidth - 1)
  // The axis row and the legend row come out of `height`, not on top of it —
  // one row of overspill is enough for Ink to stack the caller's rows.
  const plotHeight = Math.max(1, height - 2)

  const rendered = brailleChart(values, { width: plotWidth, height: plotHeight })
  if (!rendered) {
    return (
      <Box height={height}>
        <Text color={theme.dim}>{emptyMessage}</Text>
      </Box>
    )
  }

  const ticks = axisTicks(plotHeight, rendered.min, rendered.max)
  const decimals = decimalsFor(rendered.max - rendered.min)

  const firstTime = points.find((p) => p.t !== undefined)?.t
  const lastTime = [...points].reverse().find((p) => p.t !== undefined)?.t

  return (
    <Box flexDirection="column">
      {rendered.rows.map((row, i) => (
        <Box key={i}>
          <Text color={theme.dim}>{pad(number(ticks[i] as number, decimals), axisWidth, 'right')}</Text>
          <Text color={theme.border}>│</Text>
          <Text color={lineColor}>{row}</Text>
        </Box>
      ))}

      <Box>
        <Text color={theme.border}>{' '.repeat(axisWidth)}└{'─'.repeat(Math.max(0, plotWidth))}</Text>
      </Box>

      <ChartLegend
        width={width}
        indent={axisWidth + 1}
        color={lineColor}
        change={`${change >= 0 ? '+' : '−'}${number(Math.abs(change), decimals)} ${currency} (${percent(changePct)})`}
        caption={caption}
        from={firstTime ? fmtDate(firstTime) : ''}
        to={lastTime ? fmtDate(lastTime) : ''}
      />
    </Box>
  )
}

/**
 * The line under the chart: start date, net change, end date.
 *
 * Spacing is computed rather than flexed, because a flex spacer collapses to
 * zero instead of clipping — which ran the date straight into the change text
 * on narrow panes. When the full line does not fit, the dates drop first and
 * the change figure is kept, since that is the part worth reading.
 */
function ChartLegend({
  width,
  indent,
  color,
  change,
  caption,
  from,
  to,
}: {
  width: number
  indent: number
  color: string
  change: string
  caption?: string
  from: string
  to: string
}): React.ReactElement {
  const available = Math.max(0, width - indent)
  const center = caption ? `${change} · ${caption}` : change

  const withDates = from.length + to.length + center.length + 4 <= available
  const left = withDates ? from : ''
  const right = withDates ? to : ''

  const body = center.length <= available ? center : change.slice(0, available)
  const slack = Math.max(0, available - left.length - right.length - body.length)
  const leftGap = Math.floor(slack / 2)
  const rightGap = slack - leftGap

  return (
    <Box width={width}>
      <Text color={theme.dim}>
        {' '.repeat(indent)}
        {left}
        {' '.repeat(leftGap)}
      </Text>
      <Text color={color}>{body}</Text>
      <Text color={theme.dim}>
        {' '.repeat(rightGap)}
        {right}
      </Text>
    </Box>
  )
}

/** More decimals when the visible range is small, so the axis is not all zeros. */
function decimalsFor(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 2
  if (range >= 1000) return 0
  if (range >= 10) return 1
  if (range >= 1) return 2
  if (range >= 0.1) return 3
  return 4
}
