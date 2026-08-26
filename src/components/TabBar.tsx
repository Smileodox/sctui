import { Box, Text } from 'ink'
import type React from 'react'
import { truncate } from '../format.js'
import { theme } from '../theme.js'

export interface Tab {
  id: string
  label: string
}

export interface TabBarProps {
  tabs: readonly Tab[]
  activeId: string
  width: number
}

/**
 * Numbered tabs. The number is the shortcut, shown dim so it reads as an
 * affordance rather than competing with the label.
 */
/** Per tab: leading space, number, space, …label…, trailing space, separator. */
const TAB_CHROME = 5

export function TabBar({ tabs, activeId, width }: TabBarProps): React.ReactElement {
  // Labels are clipped to a shared budget rather than left to flex, which
  // otherwise silently eats the gap between tabs on a narrow terminal.
  const budget = width - tabs.length * TAB_CHROME
  const total = tabs.reduce((sum, tab) => sum + tab.label.length, 0)
  const perLabel = total <= budget ? Infinity : Math.max(0, Math.floor(budget / tabs.length))

  return (
    <Box width={width}>
      {tabs.map((tab, i) => {
        const active = tab.id === activeId
        const label = perLabel === Infinity ? tab.label : truncate(tab.label, perLabel)
        return (
          <Box key={tab.id}>
            <Text
              color={active ? theme.accent : theme.muted}
              backgroundColor={active ? theme.selectionBg : undefined}
              bold={active}
            >
              {' '}
              <Text color={active ? theme.accent : theme.dim}>{i + 1}</Text>
              {label === '' ? '' : ` ${label}`}{' '}
            </Text>
            <Text color={theme.dim}> </Text>
          </Box>
        )
      })}
    </Box>
  )
}
