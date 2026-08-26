import type React from 'react'
import { Panel } from '../components/Panel.js'
import { Table, type Column } from '../components/Table.js'
import { money, percent } from '../format.js'
import { theme, trendColor, trendGlyph } from '../theme.js'
import type { WatchItem } from '../sc/normalize.js'

export interface WatchlistViewProps {
  items: readonly WatchItem[]
  width: number
  height: number
  selectedIndex: number
  focused: boolean
  loading: boolean
}

const COLUMNS: Array<Column<WatchItem>> = [
  {
    key: 'name',
    header: 'Instrument',
    width: 'flex',
    minWidth: 14,
    priority: 0,
    value: (item) => item.name,
    color: () => theme.fg,
  },
  {
    key: 'type',
    header: 'Typ',
    width: 6,
    priority: 3,
    value: (item) => item.type ?? '',
    color: () => theme.dim,
  },
  {
    key: 'price',
    header: 'Kurs',
    width: 14,
    align: 'right',
    priority: 1,
    value: (item) => money(item.price, item.currency),
    color: () => theme.fg,
    bold: true,
  },
  {
    key: 'change',
    header: 'Heute',
    width: 11,
    align: 'right',
    priority: 2,
    value: (item) =>
      item.changePct === undefined ? '—' : `${trendGlyph(item.changePct)} ${percent(item.changePct, 2, false)}`,
    color: (item) => trendColor(item.changePct),
  },
  {
    key: 'isin',
    header: 'ISIN',
    width: 14,
    priority: 4,
    value: (item) => item.isin,
    color: () => theme.dim,
  },
]

export function WatchlistView({
  items,
  width,
  height,
  selectedIndex,
  focused,
  loading,
}: WatchlistViewProps): React.ReactElement {
  const innerWidth = Math.max(10, width - 4)
  const bodyHeight = Math.max(1, height - 5)

  return (
    <Panel
      title="Watchlist"
      meta={items.length > 0 ? `${items.length}` : loading ? 'lädt…' : ''}
      focused={focused}
      width={width}
      height={height}
    >
      <Table
        columns={COLUMNS}
        rows={items}
        width={innerWidth}
        height={bodyHeight}
        selectedIndex={selectedIndex}
        focused={focused}
        emptyMessage={loading ? 'lädt…' : 'Watchlist ist leer'}
      />
    </Panel>
  )
}
