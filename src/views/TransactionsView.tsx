import type React from 'react'
import { Panel } from '../components/Panel.js'
import { Table, type Column } from '../components/Table.js'
import { dateTime, humanizeEnum, moneySigned, number, quantity } from '../format.js'
import { t } from '../strings.js'
import { theme, trendColor } from '../theme.js'
import type { Transaction } from '../sc/normalize.js'

export interface TransactionsViewProps {
  transactions: readonly Transaction[]
  width: number
  height: number
  selectedIndex: number
  focused: boolean
  loading: boolean
}

/**
 * Money leaving the account is negative, money arriving is positive.
 *
 * Most payloads already sign the amount; when one reports a bare magnitude we
 * infer the direction from the transaction type so the column stays readable.
 */
function signedAmount(transaction: Transaction): number | undefined {
  if (transaction.amount === undefined) return undefined
  if (transaction.amount !== 0) {
    const type = transaction.type?.toUpperCase() ?? ''
    const outgoing = /BUY|KAUF|SAVINGS|SPARPLAN|WITHDRAW|AUSZAHL/.test(type)
    if (outgoing && transaction.amount > 0) return -transaction.amount
  }
  return transaction.amount
}

function typeColor(transaction: Transaction): string {
  const type = transaction.type?.toUpperCase() ?? ''
  if (/SELL|VERKAUF/.test(type)) return theme.down
  if (/BUY|KAUF|SAVINGS|SPARPLAN/.test(type)) return theme.accent
  if (/DIVIDEND|INTEREST|ZINS/.test(type)) return theme.up
  return theme.muted
}

const COLUMNS: Array<Column<Transaction>> = [
  {
    key: 'date',
    header: t.colDate,
    width: 17,
    priority: 2,
    value: (t) => dateTime(t.date),
    color: () => theme.dim,
  },
  {
    key: 'type',
    header: t.colType,
    width: 15,
    priority: 3,
    value: (t) => humanizeEnum(t.type),
    color: typeColor,
  },
  {
    key: 'name',
    header: t.colInstrument,
    width: 'flex',
    minWidth: 14,
    priority: 0,
    value: (t) => t.name ?? t.isin ?? '—',
    color: () => theme.fg,
  },
  {
    key: 'qty',
    header: t.colShares,
    width: 10,
    align: 'right',
    priority: 5,
    value: (t) => quantity(t.quantity),
    color: () => theme.muted,
  },
  {
    key: 'price',
    header: t.colPrice,
    width: 11,
    align: 'right',
    priority: 4,
    value: (t) => number(t.price, 2),
    color: () => theme.muted,
  },
  {
    key: 'amount',
    header: t.colAmount,
    width: 15,
    align: 'right',
    priority: 1,
    value: (t) => moneySigned(signedAmount(t), t.currency),
    color: (t) => trendColor(signedAmount(t)),
    bold: true,
  },
  {
    key: 'status',
    header: t.colStatus,
    width: 11,
    priority: 6,
    value: (t) => humanizeEnum(t.status),
    color: (t) => (/PEND|OPEN|OFFEN/i.test(t.status ?? '') ? theme.warn : theme.dim),
  },
]

export function TransactionsView({
  transactions,
  width,
  height,
  selectedIndex,
  focused,
  loading,
}: TransactionsViewProps): React.ReactElement {
  const innerWidth = Math.max(10, width - 4)
  const bodyHeight = Math.max(1, height - 5)

  return (
    <Panel
      title={t.tabTransactions}
      meta={transactions.length > 0 ? `${transactions.length}` : loading ? t.loading : ''}
      focused={focused}
      width={width}
      height={height}
    >
      <Table
        columns={COLUMNS}
        rows={transactions}
        width={innerWidth}
        height={bodyHeight}
        selectedIndex={selectedIndex}
        focused={focused}
        emptyMessage={loading ? t.loading : t.noTransactions}
      />
    </Panel>
  )
}
