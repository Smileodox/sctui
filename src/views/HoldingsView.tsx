import type React from 'react'
import { Panel } from '../components/Panel.js'
import { Table, type Column } from '../components/Table.js'
import { money, moneySigned, number, percent, quantity } from '../format.js'
import { theme, trendColor, trendGlyph } from '../theme.js'
import type { Holding } from '../sc/normalize.js'

export interface HoldingsViewProps {
  holdings: readonly Holding[]
  width: number
  height: number
  selectedIndex: number
  focused: boolean
  loading: boolean
}

/**
 * Columns in display order. `priority` is the drop order for narrow panes —
 * the name and the position's value survive longest because everything else is
 * derivable by eye from them.
 */
const COLUMNS: Array<Column<Holding>> = [
  {
    key: 'name',
    header: 'Position',
    width: 'flex',
    minWidth: 14,
    priority: 0,
    value: (h) => h.name,
    color: () => theme.fg,
  },
  {
    key: 'type',
    header: 'Typ',
    width: 6,
    priority: 8,
    value: (h) => h.type ?? '',
    color: () => theme.dim,
  },
  {
    key: 'qty',
    header: 'Stück',
    width: 10,
    align: 'right',
    priority: 6,
    value: (h) => quantity(h.quantity),
    color: () => theme.muted,
  },
  {
    key: 'price',
    header: 'Kurs',
    width: 11,
    align: 'right',
    priority: 5,
    value: (h) => number(h.price, 2),
    color: () => theme.muted,
  },
  {
    key: 'value',
    header: 'Wert',
    width: 14,
    align: 'right',
    priority: 1,
    value: (h) => money(h.value, h.currency),
    color: () => theme.fg,
    bold: true,
  },
  {
    key: 'day',
    header: 'Heute',
    width: 10,
    align: 'right',
    priority: 4,
    value: (h) =>
      h.dayChangePct === undefined ? '—' : `${trendGlyph(h.dayChangePct)} ${percent(h.dayChangePct, 2, false)}`,
    color: (h) => trendColor(h.dayChangePct),
  },
  {
    key: 'pnl',
    header: 'G/V',
    width: 14,
    align: 'right',
    priority: 3,
    value: (h) => moneySigned(h.pnl, h.currency),
    color: (h) => trendColor(h.pnl),
  },
  {
    key: 'pnlPct',
    header: 'G/V %',
    width: 10,
    align: 'right',
    priority: 2,
    value: (h) => percent(h.pnlPct),
    color: (h) => trendColor(h.pnlPct),
  },
  {
    key: 'weight',
    header: 'Anteil',
    width: 8,
    align: 'right',
    priority: 7,
    value: (h) => percent(h.weightPct, 1, false),
    color: () => theme.dim,
  },
]

export function HoldingsView({
  holdings,
  width,
  height,
  selectedIndex,
  focused,
  loading,
}: HoldingsViewProps): React.ReactElement {
  const innerWidth = Math.max(10, width - 4)
  // Border (2) + title row (1) + title margin (1) + table header (1).
  const bodyHeight = Math.max(1, height - 5)
  const total = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0)
  const currency = holdings[0]?.currency ?? 'EUR'

  return (
    <Panel
      title="Positionen"
      meta={holdings.length > 0 ? `${holdings.length} · ${money(total, currency)}` : loading ? 'lädt…' : ''}
      focused={focused}
      width={width}
      height={height}
    >
      <Table
        columns={COLUMNS}
        rows={holdings}
        width={innerWidth}
        height={bodyHeight}
        selectedIndex={selectedIndex}
        focused={focused}
        emptyMessage={loading ? 'lädt…' : 'Keine Positionen'}
      />
    </Panel>
  )
}
