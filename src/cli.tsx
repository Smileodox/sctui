#!/usr/bin/env node
import { render } from 'ink'
import process from 'node:process'
import { App } from './app.js'
import { ScClient, type DataSource } from './sc/client.js'
import { DemoClient } from './sc/mock.js'
import { t } from './strings.js'

interface Options {
  demo: boolean
  refreshSeconds: number | null
  tab: 'overview' | 'holdings' | 'savings' | 'watchlist' | 'transactions'
  scBin?: string
  altScreen: boolean
  enableWrites: boolean
}

const USAGE = t.usage

const VALID_TABS = ['overview', 'holdings', 'savings', 'watchlist', 'transactions'] as const

function parseArgs(argv: string[]): Options | { help: true } | { version: true } | { error: string } {
  const options: Options = {
    demo: false,
    refreshSeconds: 60,
    tab: 'overview',
    altScreen: true,
    enableWrites: false,
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
      case '--enable-writes':
        options.enableWrites = true
        break
      case '--refresh': {
        const value = Number(argv[++i])
        if (!Number.isFinite(value) || value < 5) {
          return { error: t.cliRefreshInvalid }
        }
        options.refreshSeconds = value
        break
      }
      case '--tab': {
        const value = argv[++i]
        if (!value || !(VALID_TABS as readonly string[]).includes(value)) {
          return { error: t.cliTabInvalid(VALID_TABS.join(' | ')) }
        }
        options.tab = value as Options['tab']
        break
      }
      case '--sc-bin': {
        const value = argv[++i]
        if (!value) return { error: t.cliScBinMissing }
        options.scBin = value
        break
      }
      default:
        return { error: t.cliUnknownOption(arg) }
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
  process.stdout.write('sctui 0.4.0\n')
  process.exit(0)
}

if ('error' in parsed) {
  process.stderr.write(`${parsed.error}\n\n${t.cliSeeHelp}\n`)
  process.exit(2)
}

const client: DataSource = parsed.demo
  ? new DemoClient()
  : new ScClient({ bin: parsed.scBin, enableWrites: parsed.enableWrites })

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
