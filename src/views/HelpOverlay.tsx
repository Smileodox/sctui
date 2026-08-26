import { Box, Text } from 'ink'
import type React from 'react'
import { KeyRow, Overlay } from '../components/Overlay.js'
import { theme } from '../theme.js'

export interface HelpOverlayProps {
  width: number
  height: number
  mode: 'live' | 'demo'
}

const SECTIONS: Array<{ title: string; keys: Array<[string, string]> }> = [
  {
    title: 'Navigation',
    keys: [
      ['1 – 4', 'Tab direkt wählen'],
      ['tab / ⇧tab', 'Nächster / vorheriger Tab'],
      ['↑ ↓  ·  j k', 'Zeile wechseln'],
      ['g / G', 'Anfang / Ende der Liste'],
      ['pgup / pgdn', 'Seitenweise blättern'],
    ],
  },
  {
    title: 'Detail & Chart',
    keys: [
      ['⏎  ·  →  ·  l', 'Detail zum ausgewählten Wert öffnen'],
      ['esc  ·  ←  ·  h', 'Detail schließen'],
      ['[  ]', 'Chart-Zeitraum zurück / vor'],
      ['t', 'Zeitraum durchschalten'],
    ],
  },
  {
    title: 'Daten',
    keys: [
      ['r', 'Jetzt aktualisieren (Cache umgehen)'],
      ['a', 'Auto-Refresh an / aus'],
      ['/', 'Instrumentensuche'],
      ['d', 'Roh-JSON der aktuellen Ansicht'],
    ],
  },
  {
    title: 'Allgemein',
    keys: [
      ['?', 'Diese Hilfe'],
      ['q  ·  ctrl-c', 'Beenden'],
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
    <Overlay title="Tastenkürzel" hint="esc oder ? zum Schließen" width={width} height={height}>
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
        <Text color={theme.dim}>
          Datenquelle: {mode === 'demo' ? 'Demo-Generator (keine echten Daten)' : 'sc — die offizielle Scalable CLI'}
        </Text>
        <Text color={theme.dim}>
          Diese App ist strikt read-only: es werden ausschließlich lesende sc-Befehle ausgeführt.
        </Text>
      </Box>
    </Overlay>
  )
}
