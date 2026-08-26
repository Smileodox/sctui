import { Box, Text } from 'ink'
import type React from 'react'
import { KeyRow, Overlay } from '../components/Overlay.js'
import { t } from '../strings.js'
import { theme } from '../theme.js'

export interface HelpOverlayProps {
  width: number
  height: number
  mode: 'live' | 'demo'
}

const SECTIONS: Array<{ title: string; keys: Array<[string, string]> }> = [
  {
    title: t.helpNavigation,
    keys: [
      ['1 – 4', t.helpNavTab],
      ['tab / ⇧tab', t.helpNavNextTab],
      ['↑ ↓  ·  j k', t.helpNavRow],
      ['g / G', t.helpNavEnds],
      ['pgup / pgdn', t.helpNavPage],
    ],
  },
  {
    title: t.helpDetailSection,
    keys: [
      ['⏎  ·  →  ·  l', t.helpDetailOpen],
      ['esc  ·  ←  ·  h', t.helpDetailClose],
      ['[  ]', t.helpTimeframePrev],
      ['t', t.helpTimeframeCycle],
    ],
  },
  {
    title: t.helpDataSection,
    keys: [
      ['r', t.helpRefresh],
      ['a', t.helpAuto],
      ['/', t.helpSearch],
      ['d', t.helpJson],
    ],
  },
  {
    title: t.helpGeneralSection,
    keys: [
      ['?', t.helpThisHelp],
      ['q  ·  ctrl-c', t.helpQuit],
    ],
  },
]

export function HelpOverlay({ width, height, mode }: HelpOverlayProps): React.ReactElement {
  const columns = width >= 96 ? 2 : 1
  const columnWidth = Math.floor((width - 6) / columns)
  const grouped: Array<typeof SECTIONS> = []
  for (let i = 0; i < SECTIONS.length; i += Math.ceil(SECTIONS.length / columns)) {
    grouped.push(SECTIONS.slice(i, i + Math.ceil(SECTIONS.length / columns)))
  }

  return (
    <Overlay title={t.helpTitle} hint={t.helpHint} width={width} height={height}>
      <Box>
        {grouped.map((group, i) => (
          <Box key={i} flexDirection="column" width={columnWidth} marginRight={2}>
            {group.map((section) => (
              <Box key={section.title} flexDirection="column" marginBottom={1}>
                <Text color={theme.muted} bold>
                  {section.title}
                </Text>
                {section.keys.map(([keys, description]) => (
                  <KeyRow key={keys} keys={keys} description={description} keyWidth={16} />
                ))}
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      <Box flexGrow={1} />
      <Box flexDirection="column">
        <Text color={theme.dim}>{mode === 'demo' ? t.helpSourceDemo : t.helpSourceLive}</Text>
        <Text color={theme.dim}>{t.helpReadOnly}</Text>
      </Box>
    </Overlay>
  )
}
