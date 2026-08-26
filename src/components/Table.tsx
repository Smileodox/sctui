import { Box, Text } from 'ink'
import type React from 'react'
import { pad } from '../format.js'
import { t } from '../strings.js'
import { theme } from '../theme.js'

export interface Column<T> {
  key: string
  header: string
  /** Fixed cell width, or `'flex'` to absorb the leftover space. */
  width: number | 'flex'
  /** Lower bound for flex columns. */
  minWidth?: number
  align?: 'left' | 'right'
  value: (row: T, index: number) => string
  color?: (row: T, index: number) => string | undefined
  bold?: boolean
  /**
   * Drop order when the table is too narrow: the column with the *highest*
   * priority goes first. Defaults to left-to-right position, so the rightmost
   * column is dropped first.
   */
  priority?: number
}

export interface TableProps<T> {
  columns: Array<Column<T>>
  rows: readonly T[]
  /** Total width available, in cells. */
  width: number
  /** Number of body rows to display (excluding the header). */
  height: number
  selectedIndex: number
  /** Draws the selection bar; unfocused tables show a dimmer marker. */
  focused?: boolean
  emptyMessage?: string
}

const GAP = 1
/** A numeric column narrower than this is unreadable, so drop it instead. */
const MIN_FLEX = 8

/**
 * Assign a width to every column such that the row is *exactly* `available`
 * cells wide. Surplus goes to flex columns; a shortfall is reported so the
 * caller can drop a column and try again.
 */
function resolveWidths<T>(
  columns: Array<Column<T>>,
  available: number,
): { widths: number[]; overflow: number } {
  const widths = columns.map((c) => (c.width === 'flex' ? Math.max(MIN_FLEX, c.minWidth ?? MIN_FLEX) : c.width))
  const total = widths.reduce((sum, w) => sum + w, 0)

  if (total > available) return { widths, overflow: total - available }

  const flexIndexes = columns.map((c, i) => (c.width === 'flex' ? i : -1)).filter((i) => i >= 0)
  if (flexIndexes.length === 0) return { widths, overflow: 0 }

  const surplus = available - total
  const share = Math.floor(surplus / flexIndexes.length)
  let remainder = surplus - share * flexIndexes.length
  for (const i of flexIndexes) {
    widths[i] = (widths[i] as number) + share + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--
  }

  return { widths, overflow: 0 }
}

/** Drop the least important columns until the row fits the pane. */
function fitColumns<T>(
  columns: Array<Column<T>>,
  width: number,
  hasScrollbar: boolean,
): { columns: Array<Column<T>>; widths: number[] } {
  const gutter = hasScrollbar ? 2 : 0
  let kept = [...columns]

  for (;;) {
    const available = Math.max(1, width - gutter - GAP * Math.max(0, kept.length - 1))
    const { widths, overflow } = resolveWidths(kept, available)
    if (overflow === 0 || kept.length === 1) return { columns: kept, widths }

    // Highest `priority` goes first; ties break toward the rightmost column.
    let dropIndex = 0
    let dropScore = -Infinity
    kept.forEach((column, i) => {
      const score = column.priority ?? i
      if (score >= dropScore) {
        dropScore = score
        dropIndex = i
      }
    })
    kept = kept.filter((_, i) => i !== dropIndex)
  }
}

/** Keep the selected row inside the visible window, with a little context. */
function windowStart(selectedIndex: number, rowCount: number, height: number): number {
  if (rowCount <= height) return 0
  const margin = Math.min(2, Math.floor(height / 4))
  const ideal = selectedIndex - Math.floor(height / 2)
  const clamped = Math.max(0, Math.min(rowCount - height, ideal))
  if (selectedIndex < clamped + margin) return Math.max(0, selectedIndex - margin)
  if (selectedIndex > clamped + height - 1 - margin) {
    return Math.min(rowCount - height, selectedIndex - height + 1 + margin)
  }
  return clamped
}

export function Table<T>({
  columns,
  rows,
  width,
  height,
  selectedIndex,
  focused = true,
  emptyMessage = t.noDataTable,
}: TableProps<T>): React.ReactElement {
  const bodyHeight = Math.max(1, height)
  const hasScrollbar = rows.length > bodyHeight
  const { columns: fitted, widths } = fitColumns(columns, width, hasScrollbar)

  const start = windowStart(selectedIndex, rows.length, bodyHeight)
  const visible = rows.slice(start, start + bodyHeight)

  const thumbSize = hasScrollbar ? Math.max(1, Math.round((bodyHeight / rows.length) * bodyHeight)) : 0
  const thumbStart = hasScrollbar
    ? Math.min(
        bodyHeight - thumbSize,
        Math.round((start / Math.max(1, rows.length - bodyHeight)) * (bodyHeight - thumbSize)),
      )
    : 0

  return (
    <Box flexDirection="column" width={width}>
      <Box>
        {fitted.map((column, i) => (
          <Text key={column.key} color={theme.dim} bold>
            {pad(column.header.toUpperCase(), widths[i] as number, column.align ?? 'left')}
            {i < fitted.length - 1 ? ' '.repeat(GAP) : ''}
          </Text>
        ))}
      </Box>

      {rows.length === 0 ? (
        <Box paddingTop={1}>
          <Text color={theme.dim}>{emptyMessage}</Text>
        </Box>
      ) : (
        visible.map((row, i) => {
          const absoluteIndex = start + i
          const isSelected = absoluteIndex === selectedIndex
          const background = isSelected && focused ? theme.selectionBg : undefined
          const inThumb = hasScrollbar && i >= thumbStart && i < thumbStart + thumbSize

          return (
            <Box key={absoluteIndex}>
              {fitted.map((column, c) => (
                <Text
                  key={column.key}
                  color={column.color?.(row, absoluteIndex) ?? theme.fg}
                  backgroundColor={background}
                  bold={column.bold || isSelected}
                >
                  {pad(column.value(row, absoluteIndex), widths[c] as number, column.align ?? 'left')}
                  {c < fitted.length - 1 ? ' '.repeat(GAP) : ''}
                </Text>
              ))}
              {hasScrollbar ? (
                <Text color={inThumb ? theme.accentDim : theme.border}> {inThumb ? '┃' : '│'}</Text>
              ) : null}
            </Box>
          )
        })
      )}
    </Box>
  )
}
