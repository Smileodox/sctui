import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import type React from 'react'
import { useEffect, useState } from 'react'
import { Overlay } from '../components/Overlay.js'
import { Table, type Column } from '../components/Table.js'
import { money, percent } from '../format.js'
import { useResource } from '../hooks/useResource.js'
import { theme, trendColor, trendGlyph } from '../theme.js'
import type { DataSource } from '../sc/client.js'
import type { SearchResult } from '../sc/normalize.js'

export interface SearchOverlayProps {
  client: DataSource
  width: number
  height: number
  onSelect: (result: SearchResult) => void
  onClose: () => void
}

const DEBOUNCE_MS = 280

const COLUMNS: Array<Column<SearchResult>> = [
  {
    key: 'name',
    header: 'Instrument',
    width: 'flex',
    minWidth: 16,
    priority: 0,
    value: (r) => r.name,
    color: () => theme.fg,
  },
  { key: 'type', header: 'Typ', width: 10, priority: 4, value: (r) => r.type ?? '', color: () => theme.dim },
  { key: 'isin', header: 'ISIN', width: 14, priority: 1, value: (r) => r.isin, color: () => theme.dim },
  {
    key: 'price',
    header: 'Kurs',
    width: 13,
    align: 'right',
    priority: 2,
    value: (r) => money(r.price, r.currency),
    color: () => theme.muted,
  },
  {
    key: 'change',
    header: 'Heute',
    width: 11,
    align: 'right',
    priority: 3,
    value: (r) => (r.changePct === undefined ? '—' : `${trendGlyph(r.changePct)} ${percent(r.changePct, 2, false)}`),
    color: (r) => trendColor(r.changePct),
  },
]

/**
 * Instrument search. Results refresh as you type (debounced); ↑/↓ picks one and
 * Enter opens it in the detail view.
 */
export function SearchOverlay({
  client,
  width,
  height,
  onSelect,
  onClose,
}: SearchOverlayProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  const results = useResource(
    ({ signal }) => client.search(debounced, { signal }),
    [client, debounced],
    { enabled: debounced.length >= 2 },
  )

  const rows = results.data?.value ?? []

  useEffect(() => {
    setSelectedIndex((index) => Math.min(index, Math.max(0, rows.length - 1)))
  }, [rows.length])

  // Only navigation keys — every printable key belongs to the text input.
  useInput((_input, key) => {
    if (key.escape) {
      onClose()
      return
    }
    if (key.downArrow) setSelectedIndex((i) => Math.min(rows.length - 1, i + 1))
    else if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1))
  })

  const innerWidth = Math.max(20, width - 4)
  const bodyHeight = Math.max(1, height - 8)

  return (
    <Overlay title="Suche" hint="↑↓ auswählen · ⏎ öffnen · esc schließen" width={width} height={height}>
      <Box marginBottom={1}>
        <Text color={theme.accent}>❯ </Text>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={() => {
            const picked = rows[selectedIndex]
            if (picked) onSelect(picked)
          }}
          placeholder="Name, Symbol oder ISIN…"
          showCursor
          focus
        />
      </Box>

      {debounced.length < 2 ? (
        <Text color={theme.dim}>Mindestens 2 Zeichen eingeben.</Text>
      ) : results.error ? (
        <Text color={theme.error}>{results.error.message}</Text>
      ) : (
        <Table
          columns={COLUMNS}
          rows={rows}
          width={innerWidth}
          height={bodyHeight}
          selectedIndex={selectedIndex}
          focused
          emptyMessage={results.loading ? 'sucht…' : 'Nichts gefunden'}
        />
      )}
    </Overlay>
  )
}
