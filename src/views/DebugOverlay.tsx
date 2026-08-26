import { Box, Text } from 'ink'
import type React from 'react'
import { Overlay } from '../components/Overlay.js'
import { truncate } from '../format.js'
import { t } from '../strings.js'
import { theme } from '../theme.js'
import type { Json } from '../sc/json.js'

export interface DebugOverlayProps {
  title: string
  command?: string
  payload: Json | undefined
  width: number
  height: number
  scrollOffset: number
}

/**
 * Raw payload inspector.
 *
 * This exists because the field names in `sc --json` are undocumented: when a
 * column shows `—`, this is where you see what the CLI actually returned, so
 * the alias list in `normalize.ts` can be corrected in one edit.
 */
export function DebugOverlay({
  title,
  command,
  payload,
  width,
  height,
  scrollOffset,
}: DebugOverlayProps): React.ReactElement {
  const innerWidth = Math.max(20, width - 4)
  const bodyHeight = Math.max(1, height - 6)

  const text = payload === undefined ? t.debugNoResponse : JSON.stringify(payload, null, 2)
  const allLines = text.split('\n')
  const start = Math.max(0, Math.min(scrollOffset, Math.max(0, allLines.length - bodyHeight)))
  const lines = allLines.slice(start, start + bodyHeight)

  return (
    <Overlay
      title={`${t.debugTitle} · ${title}`}
      hint={`${start + 1}–${start + lines.length} / ${allLines.length}  ·  ${t.debugHint}`}
      width={width}
      height={height}
    >
      <Box marginBottom={1}>
        <Text color={theme.accentDim}>$ </Text>
        <Text color={theme.muted}>{truncate(command ?? '—', innerWidth - 2)}</Text>
      </Box>
      {lines.map((line, i) => (
        <Text key={start + i} color={colorFor(line)}>
          {truncate(line, innerWidth)}
        </Text>
      ))}
    </Overlay>
  )
}

/** Rough JSON tinting: keys one colour, string values another, numbers a third. */
function colorFor(line: string): string {
  const trimmed = line.trim()
  if (/^"[^"]+":\s*"/.test(trimmed)) return theme.fg
  if (/^"[^"]+":/.test(trimmed)) return theme.muted
  if (/^[[\]{},]+$/.test(trimmed)) return theme.dim
  return theme.muted
}
