import { Box, Text } from 'ink'
import type React from 'react'
import { truncate } from '../format.js'
import { theme, trendColor, trendGlyph } from '../theme.js'
import { spaced } from './Panel.js'

export interface StatTileProps {
  label: string
  value: string
  /** Optional signed sub-line, coloured by direction. */
  delta?: { text: string; direction?: number }
  /** Overrides the value colour. */
  valueColor?: string
  width?: number
  emphasis?: boolean
  /** Set false when a neighbouring tile is too narrow for letter-spaced caps. */
  spacedLabel?: boolean
  /**
   * How many lines the tile may occupy: 3 is label, value and delta; 2 drops
   * the delta; 1 puts label and value side by side. Ink overlaps rows rather
   * than clipping them, so a short pane has to be answered by rendering fewer.
   */
  rows?: number
}

/**
 * One number, its label, and an optional delta — the atom of the overview.
 *
 * Label sits above the value in dim small caps so the eye lands on the figure
 * first; the delta line below carries all the colour.
 */
export function StatTile({
  label,
  value,
  delta,
  valueColor,
  width,
  emphasis = false,
  spacedLabel = true,
  rows = 3,
}: StatTileProps): React.ReactElement {
  // A Box width does not clip its text in Ink, so every line is cut to fit
  // here — otherwise a long delta bleeds into the neighbouring tile.
  const clip = (text: string): string => (width === undefined ? text : truncate(text, width))
  const deltaText = delta
    ? `${delta.direction !== undefined ? `${trendGlyph(delta.direction)} ` : ''}${delta.text}`
    : ''

  if (rows <= 1) {
    // One row has to carry both, so they share it side by side: the value keeps
    // its full width and the label gives up characters, because a bare "—" next
    // to three other bare "—" says nothing, while a cut number says something
    // wrong. The label is not letter-spaced here — the row cannot afford it.
    const room = width === undefined ? label.length : Math.max(0, width - value.length - 1)
    const short = truncate(label, room)
    return (
      <Box width={width}>
        {short.length > 0 ? <Text color={theme.dim}>{short} </Text> : null}
        <Text color={valueColor ?? theme.fg} bold={emphasis}>
          {clip(value)}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={width}>
      <Text color={theme.dim}>{clip(spacedLabel ? spaced(label) : label)}</Text>
      <Text color={valueColor ?? theme.fg} bold={emphasis}>
        {clip(value)}
      </Text>
      {rows >= 3 ? (
        delta ? (
          <Text color={trendColor(delta.direction)}>{clip(deltaText)}</Text>
        ) : (
          <Text> </Text>
        )
      ) : null}
    </Box>
  )
}
