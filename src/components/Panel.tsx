import { Box, Text } from 'ink'
import type React from 'react'
import { truncate } from '../format.js'
import { theme } from '../theme.js'

export interface PanelProps {
  title?: string
  /** Right-aligned annotation in the title row (count, timeframe, …). */
  meta?: string
  focused?: boolean
  width?: number
  height?: number
  flexGrow?: number
  children: React.ReactNode
}

/**
 * A bordered region with an optional title row.
 *
 * The border colour is the app's only focus affordance, so it is the one thing
 * that must stay consistent: accent when focused, neutral otherwise.
 */
export function Panel({
  title,
  meta,
  focused = false,
  width,
  height,
  flexGrow,
  children,
}: PanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? theme.borderFocus : theme.border}
      paddingX={1}
      width={width}
      height={height}
      flexGrow={flexGrow}
      overflow="hidden"
    >
      {title !== undefined ? (
        <TitleRow
          title={title}
          meta={meta}
          color={focused ? theme.accent : theme.muted}
          width={width === undefined ? undefined : width - 4}
        />
      ) : null}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {children}
      </Box>
    </Box>
  )
}

export interface TitleRowProps {
  title: string
  /** Right-aligned annotation; dropped before the title is clipped. */
  meta?: string
  color: string
  /** Inner width of the containing box. Without it the row is simply flexed. */
  width?: number
}

/**
 * Title left, meta right — both fitted to the box rather than flexed.
 *
 * A letter-spaced title is twice as wide as it reads, so on a narrow panel it
 * wraps into the body and shoves the content down. Here it loses its spacing
 * first, then its meta, and is clipped as a last resort.
 */
export function TitleRow({ title, meta, color, width }: TitleRowProps): React.ReactElement {
  if (width === undefined) {
    return (
      <Box marginBottom={1}>
        <Text color={color} bold>
          {spaced(title)}
        </Text>
        {meta ? (
          <>
            <Box flexGrow={1} />
            <Text color={theme.dim}>{meta}</Text>
          </>
        ) : null}
      </Box>
    )
  }

  const metaText = meta ?? ''
  const wide = spaced(title)
  const label = wide.length + metaText.length + (metaText ? 2 : 0) <= width ? wide : title
  const shownMeta = label.length + metaText.length + 2 <= width ? metaText : ''
  const clipped = truncate(label, Math.max(0, width - (shownMeta ? shownMeta.length + 1 : 0)))
  const gap = Math.max(0, width - clipped.length - shownMeta.length)

  return (
    <Box marginBottom={1} width={width}>
      <Text color={color} bold>
        {clipped}
      </Text>
      <Text>{' '.repeat(gap)}</Text>
      <Text color={theme.dim}>{shownMeta}</Text>
    </Box>
  )
}

/** Letter-spaced small caps — used only for panel and tile labels. */
export function spaced(text: string): string {
  return text.toUpperCase().split('').join(' ')
}

export interface LabelProps {
  children: string
  color?: string
}

export function Label({ children, color = theme.dim }: LabelProps): React.ReactElement {
  return <Text color={color}>{spaced(children)}</Text>
}

/** A full-width horizontal rule. */
export function Rule({ width, color = theme.border }: { width: number; color?: string }): React.ReactElement {
  return <Text color={color}>{'─'.repeat(Math.max(0, width))}</Text>
}
