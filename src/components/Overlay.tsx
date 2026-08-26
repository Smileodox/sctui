import { Box, Text } from 'ink'
import type React from 'react'
import { theme } from '../theme.js'
import { TitleRow } from './Panel.js'

export interface OverlayProps {
  title: string
  hint?: string
  width: number
  height: number
  children: React.ReactNode
}

/**
 * A full-region modal. Ink has no absolute positioning, so overlays replace the
 * content area rather than floating above it — which in a terminal reads as a
 * mode change, and is exactly what help/search/debug are.
 */
export function Overlay({ title, hint, width, height, children }: OverlayProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={1}
    >
      <TitleRow title={title} meta={hint} color={theme.accent} width={width - 4} />
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {children}
      </Box>
    </Box>
  )
}

export interface KeyRowProps {
  keys: string
  description: string
  keyWidth?: number
}

export function KeyRow({ keys, description, keyWidth = 18 }: KeyRowProps): React.ReactElement {
  return (
    <Box>
      <Box width={keyWidth}>
        <Text color={theme.accent} bold>
          {keys}
        </Text>
      </Box>
      <Text color={theme.muted}>{description}</Text>
    </Box>
  )
}
