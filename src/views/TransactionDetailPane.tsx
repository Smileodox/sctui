import { Box, Text } from 'ink'
import type React from 'react'
import { Panel } from '../components/Panel.js'
import { dateTime, humanizeEnum, money, number, pad, quantity, truncate } from '../format.js'
import { t } from '../strings.js'
import { theme, trendColor } from '../theme.js'
import type { TransactionDetails } from '../sc/normalize.js'

export interface TransactionDetailPaneProps {
  details?: TransactionDetails
  width: number
  height: number
  focused?: boolean
  loading?: boolean
  error?: Error
}

interface Line {
  key: string
  segments: ReadonlyArray<{ text: string; color: string; bold?: boolean }>
}

/**
 * Detail for one transaction: what was traded, at which terms, and the order's
 * lifecycle. Everything is line-based and sliced to the pane's height — the
 * same discipline as everywhere else, because Ink stacks overflowing rows
 * instead of clipping them.
 */
export function TransactionDetailPane({
  details,
  width,
  height,
  focused = false,
  loading = false,
  error,
}: TransactionDetailPaneProps): React.ReactElement {
  // Border (2) + title (1) + title margin (1).
  const available = Math.max(1, height - 4)
  const innerWidth = Math.max(10, width - 4)

  const lines: Line[] = []
  const push = (key: string, segments: Line['segments']): void => {
    lines.push({ key, segments })
  }
  const label = (key: string, name: string, value: string, color: string = theme.muted): void => {
    push(key, [
      { text: pad(name, 14), color: theme.dim },
      { text: truncate(value, Math.max(0, innerWidth - 14)), color },
    ])
  }
  const gap = (key: string): void => push(key, [{ text: ' ', color: theme.dim }])

  if (error) {
    push('error', [{ text: truncate(error.message, innerWidth), color: theme.error }])
  } else if (!details) {
    push('empty', [{ text: loading ? t.loading : '—', color: theme.dim }])
  } else {
    const currency = details.currency

    push('name', [
      { text: truncate(details.name ?? details.isin ?? details.id ?? '—', innerWidth), color: theme.fg, bold: true },
    ])
    if (details.isin) {
      push('identity', [
        { text: details.isin, color: theme.dim },
        { text: details.type ? ` · ${details.type}` : '', color: theme.dim },
      ])
    }
    gap('gap-head')

    const kind = [details.side, details.orderKind].filter(Boolean).map(humanizeEnum).join(' · ')
    if (kind) label('kind', t.colType, kind, theme.fg)
    if (details.totalAmount !== undefined) {
      push('amount', [
        { text: pad(t.colAmount, 14), color: theme.dim },
        { text: money(details.totalAmount, currency), color: trendColor(details.totalAmount), bold: true },
      ])
    }
    if (details.averagePrice !== undefined) label('avg', t.lblAvgPrice, number(details.averagePrice, 2))
    if (details.sharesFilled !== undefined || details.sharesTotal !== undefined) {
      const filled = quantity(details.sharesFilled)
      const total = quantity(details.sharesTotal)
      label('shares', t.colShares, filled === total ? filled : `${filled} / ${total}`)
    }
    if (details.fee !== undefined && details.fee !== 0) label('fee', t.lblFee, money(details.fee, currency))
    if (details.tax !== undefined && details.tax !== 0) label('tax', t.lblTax, money(details.tax, currency))
    if (details.venue) label('venue', t.lblVenue, details.venue)
    if (details.status) label('status', t.colStatus, humanizeEnum(details.status))
    if (details.reference) label('ref', t.lblReference, details.reference)
    if (details.documents.length > 0) label('docs', t.lblDocuments, details.documents.join(' · '))

    if (details.history.length > 0) {
      gap('gap-history')
      push('history', [{ text: t.lblHistory, color: theme.dim }])
      for (const [index, step] of details.history.entries()) {
        const price = step.price !== undefined && step.price !== 0 ? `  ${number(step.price, 2)}` : ''
        push(`step-${index}`, [
          { text: `  ${pad(humanizeEnum(step.state), 12)}`, color: theme.muted },
          { text: truncate(`${dateTime(step.time)}${price}`, Math.max(0, innerWidth - 14)), color: theme.dim },
        ])
      }
    }
  }

  return (
    <Panel
      title={t.txDetailTitle}
      meta={loading && details ? t.loading : ''}
      focused={focused}
      width={width}
      height={height}
    >
      {lines.slice(0, available).map((line) => (
        <Box key={line.key}>
          {line.segments.map((segment, i) => (
            <Text key={i} color={segment.color} bold={segment.bold}>
              {segment.text}
            </Text>
          ))}
        </Box>
      ))}
    </Panel>
  )
}
