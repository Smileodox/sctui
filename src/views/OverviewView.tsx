import { Box, Text } from 'ink'
import type React from 'react'
import { Panel } from '../components/Panel.js'
import { StatTile } from '../components/StatTile.js'
import { money, moneySigned, number, pad, percent, truncate } from '../format.js'
import { bar } from '../render/chart.js'
import { theme, trendColor, trendGlyph } from '../theme.js'
import type { Holding, OvernightAccount, PortfolioSummary } from '../sc/normalize.js'

export interface OverviewViewProps {
  summary?: PortfolioSummary
  holdings: readonly Holding[]
  overnight?: OvernightAccount
  width: number
  height: number
  loading: boolean
}

/** Border (2) + title (1) + title margin (1). */
const PANEL_CHROME = 4
/** The chrome plus the tile's own three rows. */
const TILES_HEIGHT = PANEL_CHROME + 3
/** A panel below this can draw a border and a title but not a single row. */
const PANEL_MIN_HEIGHT = PANEL_CHROME + 1

const TILE_GAP = 2
const TILE_LABELS = ['Wertpapiere', 'Cash', 'Gesamtrendite', 'Positionen'] as const
const TILE_COUNT = TILE_LABELS.length
/** Letter-spacing doubles a label's width, so it is all-or-nothing across the row. */
const WIDEST_SPACED_LABEL = Math.max(...TILE_LABELS.map((label) => label.length * 2 - 1))

/**
 * The landing view: the four numbers worth knowing, then where the money sits
 * and what moved today.
 */
export function OverviewView({
  summary,
  holdings,
  overnight,
  width,
  height,
  loading,
}: OverviewViewProps): React.ReactElement {
  const currency = summary?.currency ?? 'EUR'
  // Tiles share the panel's inner width, minus the gaps between them.
  const tileWidth = Math.max(10, Math.floor((width - 4 - (TILE_COUNT - 1) * TILE_GAP) / TILE_COUNT))
  const spacedLabel = WIDEST_SPACED_LABEL <= tileWidth

  // The two panels have to add up to `height` exactly: asking for more makes Ink
  // shrink the tiles and draw their rows on top of each other. The tiles are the
  // point of this screen, so they are served first — the tile drops its delta
  // line, then its label, and only then does the panel below give up its rows.
  const tilesHeight = Math.min(TILES_HEIGHT, height)
  const tileRows = tilesHeight - PANEL_CHROME
  const remaining = height - tilesHeight
  const lowerHeight = remaining >= PANEL_MIN_HEIGHT ? remaining : 0

  const moversWidth = width >= 100 ? Math.max(34, Math.floor(width * 0.38)) : 0
  const allocationWidth = moversWidth > 0 ? width - moversWidth : width

  if (tileRows < 1) return <Box width={width} height={height} />

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Panel title="Kennzahlen" width={width} height={tilesHeight}>
        <Box gap={TILE_GAP}>
          <StatTile
            label="Wertpapiere"
            value={money(summary?.securitiesValue, currency)}
            delta={{
              text: `${moneySigned(summary?.dayChange, currency)} heute`,
              direction: summary?.dayChange,
            }}
            width={tileWidth}
            spacedLabel={spacedLabel}
            rows={tileRows}
            emphasis
          />
          <StatTile
            label="Cash"
            value={money(summary?.cash, currency)}
            delta={
              overnight?.interestRatePct !== undefined
                ? { text: `${percent(overnight.interestRatePct, 2, false)} p.a.`, direction: 0 }
                : undefined
            }
            width={tileWidth}
            spacedLabel={spacedLabel}
            rows={tileRows}
          />
          <StatTile
            label="Gesamtrendite"
            value={moneySigned(summary?.totalReturn, currency)}
            valueColor={trendColor(summary?.totalReturn)}
            delta={{ text: percent(summary?.totalReturnPct), direction: summary?.totalReturnPct }}
            width={tileWidth}
            spacedLabel={spacedLabel}
            rows={tileRows}
            emphasis
          />
          <StatTile
            label="Positionen"
            value={holdings.length > 0 ? String(holdings.length) : loading ? '···' : '0'}
            delta={
              overnight?.interestAccrued !== undefined
                ? {
                    text: `${money(overnight.interestAccrued, currency)} Zinsen`,
                    // Aufgelaufene Zinsen sind nie negativ, aber sehr wohl null —
                    // und dann ist ein grünes ▲ eine Aussage, die nicht stimmt.
                    direction: overnight.interestAccrued,
                  }
                : undefined
            }
            width={tileWidth}
            spacedLabel={spacedLabel}
            rows={tileRows}
          />
        </Box>
      </Panel>

      {lowerHeight > 0 ? (
        <Box>
          <AllocationPanel
            holdings={holdings}
            width={allocationWidth}
            height={lowerHeight}
            loading={loading}
          />
          {moversWidth > 0 ? (
            <MoversPanel holdings={holdings} width={moversWidth} height={lowerHeight} loading={loading} />
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
}

function AllocationPanel({
  holdings,
  width,
  height,
  loading,
}: {
  holdings: readonly Holding[]
  width: number
  height: number
  loading: boolean
}): React.ReactElement {
  const innerWidth = Math.max(10, width - 4)
  const rows = Math.max(1, height - 4)

  const sorted = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const shown = sorted.slice(0, rows)
  const hidden = sorted.length - shown.length
  const maxWeight = Math.max(...shown.map((h) => h.weightPct ?? 0), 1)

  // name | bar | percent — the bar gets whatever is left.
  const pctWidth = 8
  const nameWidth = Math.min(28, Math.max(10, Math.floor(innerWidth * 0.34)))
  const barWidth = Math.max(4, innerWidth - nameWidth - pctWidth - 2)

  return (
    <Panel
      title="Allokation"
      meta={hidden > 0 ? `+${hidden} weitere` : ''}
      width={width}
      height={height}
    >
      {shown.length === 0 ? (
        <Text color={theme.dim}>{loading ? 'lädt…' : 'Keine Positionen'}</Text>
      ) : (
        shown.map((holding) => (
          <Box key={holding.isin}>
            <Text color={theme.fg}>{truncate(holding.name, nameWidth).padEnd(nameWidth)}</Text>
            <Text color={theme.dim}> </Text>
            <Text color={trendColor(holding.pnl)}>
              {bar((holding.weightPct ?? 0) / maxWeight, barWidth)}
            </Text>
            <Text color={theme.muted}>{percent(holding.weightPct, 1, false).padStart(pctWidth)}</Text>
          </Box>
        ))
      )}
    </Panel>
  )
}

function MoversPanel({
  holdings,
  width,
  height,
  loading,
}: {
  holdings: readonly Holding[]
  width: number
  height: number
  loading: boolean
}): React.ReactElement {
  const innerWidth = Math.max(10, width - 4)
  const rows = Math.max(1, height - PANEL_CHROME)

  const withChange = holdings.filter((h) => h.dayChangePct !== undefined)
  const sorted = [...withChange].sort((a, b) => (b.dayChangePct ?? 0) - (a.dayChangePct ?? 0))

  // Two headings and the blank line between them are fixed cost; the movers
  // split what is left.
  const slots = Math.max(1, Math.floor((rows - 3) / 2))
  const gainers = sorted.filter((h) => (h.dayChangePct ?? 0) > 0).slice(0, slots)
  const losers = sorted
    .filter((h) => (h.dayChangePct ?? 0) < 0)
    .slice(-slots)
    .reverse()

  // Built as a flat list so the slice below is an honest row count — a nested
  // fragment would hide rows from it and Ink would overlap them.
  const lines: React.ReactElement[] = []
  if (withChange.length === 0) {
    lines.push(
      <Text key="empty" color={theme.dim}>
        {loading ? 'lädt…' : 'Keine Tagesveränderung gemeldet'}
      </Text>,
    )
  } else {
    const section = (key: string, title: string, movers: readonly Holding[]): void => {
      lines.push(
        <Text key={key} color={theme.dim}>
          {title}
        </Text>,
      )
      if (movers.length === 0) {
        lines.push(
          <Text key={`${key}-none`} color={theme.dim}>
            {' —'}
          </Text>,
        )
      } else {
        for (const h of movers) lines.push(<MoverRow key={h.isin} holding={h} width={innerWidth} />)
      }
    }
    section('gainers', 'Gewinner', gainers)
    lines.push(<Text key="gap"> </Text>)
    section('losers', 'Verlierer', losers)
  }

  return (
    <Panel title="Heute" width={width} height={height}>
      {lines.slice(0, rows)}
    </Panel>
  )
}

/** Type left, full name dim in the middle, change right-aligned. */
function MoverRow({ holding, width }: { holding: Holding; width: number }): React.ReactElement {
  const changeWidth = 10
  const typeWidth = 7
  const nameWidth = Math.max(0, width - typeWidth - changeWidth - 1)

  return (
    <Box>
      <Text color={theme.dim}> {pad(holding.type ?? '', typeWidth - 1)}</Text>
      <Text color={theme.fg}>{pad(holding.name, nameWidth)}</Text>
      <Text color={trendColor(holding.dayChangePct)}>
        {pad(
          `${trendGlyph(holding.dayChangePct)} ${number(Math.abs(holding.dayChangePct ?? 0), 2)} %`,
          changeWidth,
          'right',
        )}
      </Text>
    </Box>
  )
}
