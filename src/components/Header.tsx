import { Box, Text } from 'ink'
import type React from 'react'
import { money, moneySigned, percent, truncate } from '../format.js'
import { theme, trendColor, trendGlyph } from '../theme.js'
import type { PortfolioSummary } from '../sc/normalize.js'

export interface HeaderProps {
  summary: PortfolioSummary | undefined
  width: number
  mode: 'live' | 'demo'
  identity?: string
  loading: boolean
}

/**
 * The always-visible masthead: what the portfolio is worth, and how that number
 * moved today and overall. Everything else in the app is a drill-down from here.
 */
export function Header({ summary, width, mode, identity, loading }: HeaderProps): React.ReactElement {
  const currency = summary?.currency ?? 'EUR'
  const dayDirection = summary?.dayChangePct ?? summary?.dayChange
  const totalDirection = summary?.totalReturnPct ?? summary?.totalReturn

  // Before the first successful load there is nothing to compare, so the
  // change figures would be a row of em dashes. One placeholder says more.
  if (!summary) {
    return (
      <Box flexDirection="column" width={width}>
        <TitleRow width={width} mode={mode} identity={identity} portfolio="Depot" />
        <Box width={width}>
          <Text color={theme.dim}> {loading ? 'lädt…' : 'keine Daten'}</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={width}>
      <TitleRow width={width} mode={mode} identity={identity} portfolio={summary.portfolioName ?? 'Depot'} />

      <SummaryRow
        width={width}
        value={money(summary.totalValue, currency)}
        dayColor={trendColor(dayDirection)}
        dayFull={`${trendGlyph(dayDirection)} ${moneySigned(summary.dayChange, currency)} (${percent(
          summary.dayChangePct,
        )})`}
        dayShort={`${trendGlyph(dayDirection)} ${percent(summary.dayChangePct)}`}
        totalColor={trendColor(totalDirection)}
        totalFull={`${moneySigned(summary.totalReturn, currency)} (${percent(summary.totalReturnPct)})`}
        totalShort={percent(summary.totalReturnPct)}
        cash={summary.cash === undefined ? undefined : money(summary.cash, currency)}
      />
    </Box>
  )
}

// Kleinschreibung und eigener Name, bewusst: der Masthead darf nicht wie die
// Marke der Bank aussehen — sctui ist ein inoffizielles Projekt.
const WORDMARK = ' s c t u i '

/**
 * Wordmark and portfolio on the left, account and mode badge on the right.
 *
 * Same reasoning as the row below: the identity is dropped and the portfolio
 * name clipped by measurement, so nothing can wrap onto a second line.
 */
function TitleRow({
  width,
  mode,
  identity,
  portfolio,
}: {
  width: number
  mode: 'live' | 'demo'
  identity?: string
  portfolio: string
}): React.ReactElement {
  const badge = mode === 'demo' ? ' DEMO ' : ' LIVE '
  const fixed = WORDMARK.length + 2 + badge.length
  const account = identity !== undefined && fixed + identity.length + 1 + 8 <= width ? `${identity} ` : ''
  const name = truncate(portfolio, Math.max(0, width - fixed - account.length - 1))
  const gap = Math.max(0, width - fixed - account.length - name.length)

  return (
    <Box width={width}>
      <Text color={theme.accent} bold>
        {WORDMARK}
      </Text>
      <Text color={theme.dim}>│ </Text>
      <Text color={theme.muted}>{name}</Text>
      <Text>{' '.repeat(gap)}</Text>
      <Text color={theme.dim}>{account}</Text>
      <Text color={mode === 'demo' ? theme.warn : theme.up} bold>
        {badge}
      </Text>
    </Box>
  )
}

interface Segment {
  text: string
  color: string
  bold?: boolean
}

const SEP = '   ·   '
const MIN_GAP = 3

/**
 * Portfolio value, today's move, total return — and cash on the right.
 *
 * The row is measured and degraded in steps rather than flexed: Ink wraps
 * overlong rows onto a second line, which pushed "(+30,12 %)" underneath the
 * header on an 90-column terminal. Cash goes first, then the absolute figures
 * collapse to percentages, then the total return drops entirely.
 */
function SummaryRow({
  width,
  value,
  dayColor,
  dayFull,
  dayShort,
  totalColor,
  totalFull,
  totalShort,
  cash,
}: {
  width: number
  value: string
  dayColor: string
  dayFull: string
  dayShort: string
  totalColor: string
  totalFull: string
  totalShort: string
  cash?: string
}): React.ReactElement {
  const build = (compact: boolean, withTotal: boolean, withLabel: boolean): Segment[] => {
    const segments: Segment[] = [
      { text: ` ${value}`, color: theme.fg, bold: true },
      { text: '   ', color: theme.dim },
      { text: compact ? dayShort : dayFull, color: dayColor },
    ]
    if (withLabel) segments.push({ text: ' heute', color: theme.dim })
    if (withTotal) {
      segments.push({ text: SEP, color: theme.dim })
      segments.push({ text: 'Gesamt ', color: theme.dim })
      segments.push({ text: compact ? totalShort : totalFull, color: totalColor })
    }
    return segments
  }

  const cashSegments: Segment[] =
    cash === undefined
      ? []
      : [
          { text: 'Cash ', color: theme.dim },
          { text: `${cash} `, color: theme.muted },
        ]

  const measure = (segments: readonly Segment[]): number =>
    segments.reduce((sum, segment) => sum + segment.text.length, 0)

  const candidates: Array<{ left: Segment[]; right: Segment[] }> = [
    { left: build(false, true, true), right: cashSegments },
    { left: build(false, true, true), right: [] },
    { left: build(true, true, true), right: [] },
    { left: build(true, true, false), right: [] },
    { left: build(true, false, false), right: [] },
    { left: [{ text: ` ${value}`, color: theme.fg, bold: true }], right: [] },
  ]

  const chosen =
    candidates.find((c) => measure(c.left) + measure(c.right) + (c.right.length > 0 ? MIN_GAP : 0) <= width) ??
    (candidates[candidates.length - 1] as { left: Segment[]; right: Segment[] })

  const gap = Math.max(0, width - measure(chosen.left) - measure(chosen.right))

  return (
    <Box width={width}>
      {chosen.left.map((segment, i) => (
        <Text key={i} color={segment.color} bold={segment.bold}>
          {segment.text}
        </Text>
      ))}
      <Text>{' '.repeat(gap)}</Text>
      {chosen.right.map((segment, i) => (
        <Text key={i} color={segment.color} bold={segment.bold}>
          {segment.text}
        </Text>
      ))}
    </Box>
  )
}
