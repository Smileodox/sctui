#!/usr/bin/env node
import { render } from 'ink'
import process from 'node:process'
import { App } from './app.js'
import { ScClient, type DataSource } from './sc/client.js'
import { DemoClient } from './sc/mock.js'

interface Options {
  demo: boolean
  refreshSeconds: number | null
  tab: 'overview' | 'holdings' | 'watchlist' | 'transactions'
  scBin?: string
  altScreen: boolean
}

const USAGE = `
  sctui — Terminal-Dashboard für das Scalable-Depot

  Liest alle Daten über die offizielle Scalable CLI (sc). Read-only:
  es werden ausschließlich lesende sc-Befehle ausgeführt.

  Aufruf
    sctui [optionen]

  Optionen
    --demo                 Beispieldaten statt echter (kein sc, kein Account nötig)
    --refresh <sekunden>   Auto-Refresh-Intervall (Standard: 60)
    --no-refresh           Auto-Refresh aus
    --tab <name>           Starttab: overview | holdings | watchlist | transactions
    --sc-bin <pfad>        Abweichender Pfad zur sc-Binary
    --no-alt-screen        Im normalen Puffer rendern (nützlich zum Debuggen)
    -h, --help             Diese Hilfe
    -v, --version          Version

  Tasten
    1–4 Tabs · ↑↓ wählen · ⏎ Detail · [ ] Zeitraum · / Suche
    r Refresh · a Auto-Refresh · d Roh-JSON · ? Hilfe · q Ende

  Einrichtung (einmalig)
    brew tap ScalableCapital/tap
    brew trust --formula ScalableCapital/tap/scalable-cli
    brew install scalable-cli
    sc login          # "Scalable CLI" vorher im Profil unter Sicherheit aktivieren
`

const VALID_TABS = ['overview', 'holdings', 'watchlist', 'transactions'] as const

function parseArgs(argv: string[]): Options | { help: true } | { version: true } | { error: string } {
  const options: Options = {
    demo: false,
    refreshSeconds: 60,
    tab: 'overview',
    altScreen: true,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    switch (arg) {
      case '-h':
      case '--help':
        return { help: true }
      case '-v':
      case '--version':
        return { version: true }
      case '--demo':
        options.demo = true
        break
      case '--no-refresh':
        options.refreshSeconds = null
        break
      case '--no-alt-screen':
        options.altScreen = false
        break
      case '--refresh': {
        const value = Number(argv[++i])
        if (!Number.isFinite(value) || value < 5) {
          return { error: '--refresh braucht eine Zahl ≥ 5 (Sekunden)' }
        }
        options.refreshSeconds = value
        break
      }
      case '--tab': {
        const value = argv[++i]
        if (!value || !(VALID_TABS as readonly string[]).includes(value)) {
          return { error: `--tab muss eines von ${VALID_TABS.join(' | ')} sein` }
        }
        options.tab = value as Options['tab']
        break
      }
      case '--sc-bin': {
        const value = argv[++i]
        if (!value) return { error: '--sc-bin braucht einen Pfad' }
        options.scBin = value
        break
      }
      default:
        return { error: `Unbekannte Option: ${arg}` }
    }
  }

  return options
}

const parsed = parseArgs(process.argv.slice(2))

if ('help' in parsed) {
  process.stdout.write(`${USAGE}\n`)
  process.exit(0)
}

if ('version' in parsed) {
  process.stdout.write('sctui 0.1.0\n')
  process.exit(0)
}

if ('error' in parsed) {
  process.stderr.write(`${parsed.error}\n\nsctui --help für alle Optionen.\n`)
  process.exit(2)
}

const client: DataSource = parsed.demo ? new DemoClient() : new ScClient({ bin: parsed.scBin })

const instance = render(
  <App client={client} autoRefreshSeconds={parsed.refreshSeconds} initialTab={parsed.tab} />,
  {
    // The alternate screen keeps the dashboard out of your scrollback, the way
    // htop and vim do; --no-alt-screen turns it off when you want the frames.
    alternateScreen: parsed.altScreen,
    incrementalRendering: true,
    exitOnCtrlC: true,
  },
)

await instance.waitUntilExit()
