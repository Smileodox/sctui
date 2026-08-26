import type React from 'react'
import { Panel } from '../components/Panel.js'
import { Table, type Column } from '../components/Table.js'
import { date, money } from '../format.js'
import { t } from '../strings.js'
import { theme } from '../theme.js'
import type { SavingsPlan } from '../sc/normalize.js'

export interface SavingsPlansViewProps {
  plans: readonly SavingsPlan[]
  width: number
  height: number
  selectedIndex: number
  focused: boolean
  loading: boolean
}

const COLUMNS: Array<Column<SavingsPlan>> = [
  {
    key: 'name',
    header: t.colInstrument,
    width: 'flex',
    minWidth: 14,
    priority: 0,
    value: (p) => p.name,
    color: () => theme.fg,
  },
  {
    key: 'type',
    header: t.colType,
    width: 6,
    priority: 5,
    value: (p) => p.type ?? '',
    color: () => theme.dim,
  },
  {
    key: 'amount',
    header: t.colAmount,
    width: 12,
    align: 'right',
    priority: 1,
    value: (p) => money(p.amount, p.currency),
    color: () => theme.fg,
    bold: true,
  },
  {
    key: 'frequency',
    header: t.colInterval,
    // "vierteljährlich" is 15 characters — the widest label either language produces.
    width: 16,
    priority: 2,
    value: (p) => (p.frequency ? t.frequencyLabel(p.frequency) : '—'),
    color: () => theme.muted,
  },
  {
    key: 'next',
    header: t.colNextExec,
    width: 11,
    align: 'right',
    priority: 3,
    value: (p) => date(p.nextExecution),
    color: () => theme.muted,
  },
  {
    key: 'isin',
    header: t.colIsin,
    width: 14,
    priority: 4,
    value: (p) => p.isin,
    color: () => theme.dim,
  },
]

export function SavingsPlansView({
  plans,
  width,
  height,
  selectedIndex,
  focused,
  loading,
}: SavingsPlansViewProps): React.ReactElement {
  const innerWidth = Math.max(10, width - 4)
  const bodyHeight = Math.max(1, height - 5)
  // The CLI reports a total too, but summing the rows keeps the header honest
  // with what the table shows — same principle as the holdings panel.
  const total = plans.reduce((sum, plan) => sum + (plan.amount ?? 0), 0)
  const currency = plans[0]?.currency ?? 'EUR'

  return (
    <Panel
      title={t.tabSavings}
      meta={plans.length > 0 ? `${plans.length} · ${money(total, currency)}` : loading ? t.loading : ''}
      focused={focused}
      width={width}
      height={height}
    >
      <Table
        columns={COLUMNS}
        rows={plans}
        width={innerWidth}
        height={bodyHeight}
        selectedIndex={selectedIndex}
        focused={focused}
        emptyMessage={loading ? t.loading : t.noSavingsPlans}
      />
    </Panel>
  )
}
