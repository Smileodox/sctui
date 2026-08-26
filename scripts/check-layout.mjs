#!/usr/bin/env node
/**
 * Renders the app at a matrix of terminal sizes and fails on any frame that is
 * wider or taller than the terminal it was rendered for.
 *
 * Ink silently reflows content that does not fit, which turns into rows running
 * into each other rather than an error — so overflow has to be asserted.
 *
 *   node scripts/check-layout.mjs
 */
import { execFile } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promisify } from 'node:util'
import stringWidth from 'string-width'

const run = promisify(execFile)
/** Each case pays ~2 s of tsx startup, so they run as wide as the machine allows. */
const CONCURRENCY = Math.max(2, availableParallelism() - 2)

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const SIZES = [
  [60, 20],
  [72, 24],
  [80, 26],
  [90, 30],
  [100, 28],
  [120, 30],
  [160, 44],
]
/**
 * Short terminals, where a view has to give up rows rather than let Ink stack
 * them: 12 rows leaves the overview no room at all for its lower panels.
 */
const SHORT_SIZES = [
  [92, 12],
  [92, 14],
  [118, 16],
  [118, 17],
]
const TABS = ['overview', 'holdings', 'watchlist', 'transactions']

const FAKE_SC = path.join(root, 'scripts', 'fake-sc')

/**
 * A tile label, which overlapping rows corrupt ("—ertpapiere") while leaving
 * the frame exactly as wide and as tall as it was. Matched with the spaces
 * stripped, since the label is letter-spaced when the tile is wide enough.
 */
const TILE_LABEL = 'wertpapiere'

/**
 * Narrow terminals, where the detail pane takes the whole width — so a match
 * cannot come from the list behind it. `jj~` opens the third fixture position,
 * whose ISIN sits on the row the pane gives up first when it runs short.
 */
const DETAIL_SIZES = [
  [78, 20],
  [78, 24],
  [92, 22],
  [92, 26],
]
const DETAIL_ISIN = 'ie00b4l5y983'

const cases = []
for (const [columns, rows] of DETAIL_SIZES) {
  cases.push({ columns, rows, tab: 'holdings', keys: 'jj~', scBin: FAKE_SC, expect: DETAIL_ISIN })
}
// Shorter still: the pane has to shed rows rather than stack them.
for (const rows of [12, 14, 16]) {
  cases.push({ columns: 78, rows, tab: 'holdings', keys: 'jj~', scBin: FAKE_SC })
}
for (const [columns, rows] of SHORT_SIZES) {
  cases.push({ columns, rows, tab: 'overview', keys: '', expect: TILE_LABEL })
  cases.push({ columns, rows, tab: 'overview', keys: '', scBin: FAKE_SC, expect: TILE_LABEL })
  // A failing `sc` still renders the tiles, one row shorter for the error line.
  cases.push({
    columns,
    rows,
    tab: 'overview',
    keys: '',
    scBin: FAKE_SC,
    env: { FAKE_SC_FAIL: 'exit' },
    expect: TILE_LABEL,
  })
}
for (const [columns, rows] of SIZES) {
  for (const tab of TABS) {
    cases.push({ columns, rows, tab, keys: '', ...(tab === 'overview' ? { expect: TILE_LABEL } : {}) })
    // `j~` moves down one row and opens the detail pane.
    if (tab !== 'overview') cases.push({ columns, rows, tab, keys: 'j~' })
  }
  for (const keys of ['?', 'd', '/ap']) cases.push({ columns, rows, tab: 'holdings', keys })

  // The live path and both setup screens, which the demo client never reaches.
  cases.push({ columns, rows, tab: 'holdings', keys: '', scBin: FAKE_SC })
  cases.push({ columns, rows, tab: 'overview', keys: '', scBin: '/nonexistent/sc' })
  cases.push({ columns, rows, tab: 'overview', keys: '', scBin: FAKE_SC, env: { FAKE_SC_FAIL: 'auth' } })
}

const ANSI = /\[[0-9;?]*[A-Za-z]/g
async function check({ columns, rows, tab, keys, scBin, env, expect }) {
  const args = ['scripts/snapshot.tsx', String(columns), String(rows), tab, '--wait=900']
  if (keys) args.push(`--keys=${keys}`)
  if (scBin) args.push(`--sc-bin=${scBin}`)

  const { stdout } = await run('npx', ['tsx', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  const lines = stdout.replace(ANSI, '').split('\n')
  const wide = lines
    .map((line, i) => ({ i, width: stringWidth(line), line }))
    .filter((entry) => entry.width > columns)
  const used = lines.filter((line) => line.length > 0).length
  const missing =
    expect !== undefined && !lines.some((line) => line.replace(/\s/g, '').toLowerCase().includes(expect))
  if (wide.length === 0 && used <= rows && !missing) return null

  const source = scBin ? ` sc=${path.basename(scBin)}${env ? ` ${JSON.stringify(env)}` : ''}` : ''
  return [
    `✗ ${columns}x${rows} ${tab} keys=${keys || '-'}${source} — ${used}/${rows} rows`,
    ...(missing ? [`    ${JSON.stringify(expect)} is missing or overlapped`] : []),
    ...wide.slice(0, 3).map((e) => `    row ${e.i} is ${e.width} wide: ${JSON.stringify(e.line.slice(0, 70))}`),
  ].join('\n')
}

let failed = 0
let next = 0
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (next < cases.length) {
    const problem = await check(cases[next++])
    if (problem !== null) {
      failed += 1
      console.log(problem)
    }
  }
})
await Promise.all(workers)

console.log(failed === 0 ? `ok — ${cases.length} layouts clean` : `${failed} of ${cases.length} layouts overflow`)
process.exit(failed === 0 ? 0 : 1)
