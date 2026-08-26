import { Box, Text } from 'ink'
import type React from 'react'
import { Panel } from '../components/Panel.js'
import { truncate } from '../format.js'
import { theme } from '../theme.js'
import { ScError } from '../sc/exec.js'

export interface SetupViewProps {
  error: ScError
  width: number
  height: number
}

interface Step {
  text: string
  command?: string
}

const INSTALL_STEPS: Step[] = [
  { text: 'Scalable CLI installieren', command: 'brew tap ScalableCapital/tap' },
  { text: '', command: 'brew trust --formula ScalableCapital/tap/scalable-cli' },
  { text: '', command: 'brew install scalable-cli' },
  { text: 'CLI im Profil freischalten (Einstellungen → Sicherheit → "Scalable CLI")' },
  { text: 'Einloggen (OAuth Device-Code im Browser)', command: 'sc login' },
  { text: 'Prüfen, ob die Session steht', command: 'sc whoami' },
]

const LOGIN_STEPS: Step[] = [
  { text: '"Scalable CLI" im Profil unter Einstellungen → Sicherheit aktivieren' },
  { text: 'Einloggen (OAuth Device-Code im Browser)', command: 'sc login' },
  { text: 'Prüfen, ob die Session steht', command: 'sc whoami' },
]

interface Line {
  key: string
  /** Rendered as-is; already fitted to the panel width. */
  segments: ReadonlyArray<{ text: string; color: string }>
}

/**
 * Shown instead of the dashboard when there is nothing to talk to yet.
 *
 * The two failure modes that matter — no binary, no session — have different
 * fixes, so they get different instructions rather than one generic error.
 *
 * Every line is fitted to the panel by hand and the list is trimmed to the
 * available height: left to Ink, the prose reflows onto extra rows and pushes
 * the instructions out of the panel, which is exactly when a user can least
 * afford a garbled screen.
 */
export function SetupView({ error, width, height }: SetupViewProps): React.ReactElement {
  const missingBinary = error.code === 'SC_NOT_FOUND'
  const steps = missingBinary ? INSTALL_STEPS : LOGIN_STEPS

  const inner = Math.max(20, width - 4)
  const fit = (text: string): string => truncate(text, inner)

  const intro: Line[] = wrap(
    missingBinary
      ? 'Dieses Dashboard liest alle Daten über die offizielle Scalable CLI (`sc`). Sie ist noch nicht installiert.'
      : 'Die CLI ist da, aber es gibt keine gültige Session.',
    inner,
  ).map((text, i) => ({ key: `intro-${i}`, segments: [{ text, color: theme.muted }] }))

  const stepLines: Line[] = []
  let number = 0
  for (const [i, step] of steps.entries()) {
    if (step.text) {
      number += 1
      stepLines.push({
        key: `step-${i}`,
        segments: [
          { text: ` ${number}. `, color: theme.accent },
          { text: truncate(step.text, inner - 4), color: theme.fg },
        ],
      })
    }
    if (step.command) {
      stepLines.push({
        key: `cmd-${i}`,
        segments: [
          { text: '      $ ', color: theme.dim },
          { text: truncate(step.command, inner - 8), color: theme.accentDim },
        ],
      })
    }
  }

  const demoHint: Line =
    inner >= 84
      ? {
          key: 'demo',
          segments: [
            { text: 'Solange kein Account dranhängt: ', color: theme.muted },
            { text: 'sctui --demo', color: theme.accent },
            { text: ' zeigt das volle UI mit Beispieldaten.', color: theme.muted },
          ],
        }
      : {
          key: 'demo',
          segments: [
            { text: 'Kein Account? ', color: theme.muted },
            { text: 'sctui --demo', color: theme.accent },
            { text: ' zeigt Beispieldaten.', color: theme.muted },
          ],
        }

  const footer: Line[] = [
    { key: 'error', segments: [{ text: fit(`Fehlermeldung: ${error.message}`), color: theme.dim }] },
    blank('gap-2'),
    demoHint,
    { key: 'keys', segments: [{ text: 'r = erneut versuchen · q = beenden', color: theme.dim }] },
  ]

  // Border (2) + title (1) + title margin (1).
  const available = Math.max(1, height - 4)
  const body = [...intro, blank('gap-1'), ...stepLines]

  // The steps are the point of this screen, so the prose goes first when the
  // terminal is short, then the trailing blank line, then the footer.
  while (body.length + footer.length + 1 > available && body.length > stepLines.length) body.shift()
  // Do not leave the separator behind once the prose above it is gone.
  while (body[0] !== undefined && body[0].segments.every((segment) => segment.text === '')) body.shift()
  const shown = body.length + footer.length + 1 > available ? body.slice(0, available) : body
  const withFooter = shown.length + footer.length + 1 <= available
  const spacer = Math.max(0, available - shown.length - (withFooter ? footer.length : 0))

  return (
    <Panel title={missingBinary ? 'Scalable CLI fehlt' : 'Nicht eingeloggt'} width={width} height={height}>
      {shown.map(renderLine)}
      {spacer > 0 ? <Box height={spacer} /> : null}
      {withFooter ? footer.map(renderLine) : null}
    </Panel>
  )
}

function blank(key: string): Line {
  return { key, segments: [{ text: '', color: theme.dim }] }
}

function renderLine(line: Line): React.ReactElement {
  return (
    <Box key={line.key}>
      {line.segments.map((segment, i) => (
        <Text key={i} color={segment.color}>
          {segment.text}
        </Text>
      ))}
      {line.segments.length === 1 && line.segments[0]?.text === '' ? <Text> </Text> : null}
    </Box>
  )
}

/** Greedy word wrap; long words are left intact and clipped by the caller. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    if (current === '') current = word
    else if (current.length + 1 + word.length <= width) current += ` ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current !== '') lines.push(current)
  return lines.map((line) => truncate(line, width))
}
