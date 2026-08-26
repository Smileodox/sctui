import { Box, Text } from 'ink'
import type React from 'react'
import { clock, relative, truncate } from '../format.js'
import { glyphs, theme } from '../theme.js'

export interface StatusBarProps {
  width: number
  /** `[key, description]` pairs shown on the left. */
  keys: ReadonlyArray<readonly [string, string]>
  loading: boolean
  spinnerFrame: number
  error?: { message: string; hint?: string }
  fetchedAt?: number
  autoRefreshSeconds: number | null
}

export function StatusBar({
  width,
  keys,
  loading,
  spinnerFrame,
  error,
  fetchedAt,
  autoRefreshSeconds,
}: StatusBarProps): React.ReactElement {
  return (
    <Box flexDirection="column" width={width}>
      {error ? (
        <Box>
          <Text color={theme.error} bold>
            {' '}
            ✕{' '}
          </Text>
          <Text color={theme.error}>{truncate(error.hint ?? error.message, Math.max(10, width - 4))}</Text>
        </Box>
      ) : null}

      <KeyRow
        width={width}
        keys={keys}
        loading={loading}
        spinnerFrame={spinnerFrame}
        right={`${autoRefreshSeconds !== null ? `auto ${autoRefreshSeconds}s` : 'auto aus'} · ${
          fetchedAt ? `${clock(fetchedAt)} (${relative(fetchedAt)})` : '—'
        }`}
      />
    </Box>
  )
}

const GAP = '  '
/** Hints past this point are dropped first; the leftmost ones are the ones people look for. */
const MIN_GAP = 2

/**
 * Key hints left, refresh state right.
 *
 * The two blocks are measured and spaced explicitly instead of being pushed
 * apart by a flex spacer: a spacer collapses to zero width and lets the blocks
 * run into each other ("q endeauto aus") once the terminal is narrow. Here the
 * hints are dropped from the right until everything fits.
 */
function KeyRow({
  width,
  keys,
  loading,
  spinnerFrame,
  right,
}: {
  width: number
  keys: ReadonlyArray<readonly [string, string]>
  loading: boolean
  spinnerFrame: number
  right: string
}): React.ReactElement {
  const spinnerWidth = loading ? 2 : 0
  // One space of padding at each edge.
  const budget = width - 2 - spinnerWidth - right.length - MIN_GAP

  const shown: Array<readonly [string, string]> = []
  let used = 0
  for (const hint of keys) {
    const cost = (shown.length > 0 ? GAP.length : 0) + hint[0].length + 1 + hint[1].length
    if (used + cost > budget) break
    used += cost
    shown.push(hint)
  }

  const gap = Math.max(MIN_GAP, width - 2 - used - spinnerWidth - right.length)

  return (
    <Box width={width}>
      <Text color={theme.dim}> </Text>
      {shown.map(([key, description], i) => (
        <Box key={key}>
          {i > 0 ? <Text color={theme.border}>{GAP}</Text> : null}
          <Text color={theme.accentDim} bold>
            {key}
          </Text>
          <Text color={theme.dim}> {description}</Text>
        </Box>
      ))}

      <Text>{' '.repeat(gap)}</Text>

      {loading ? <Text color={theme.accent}>{glyphs.spinner[spinnerFrame % glyphs.spinner.length]} </Text> : null}
      <Text color={theme.dim}>{right}</Text>
      <Text color={theme.dim}> </Text>
    </Box>
  )
}
