#!/usr/bin/env node
/**
 * Renders the app against a virtual terminal of a given size and prints the
 * final frame. Used to eyeball the layout at different widths without needing
 * an interactive TTY.
 *
 *   npx tsx scripts/snapshot.tsx [columns] [rows] [tab] [--keys=jj~] [--sc-bin=/nope]
 *
 * `--sc-bin` switches to the live client, which is how the setup screen gets
 * rendered: point it at a path that does not exist.
 */
import { render } from 'ink'
import { PassThrough } from 'node:stream'
import process from 'node:process'
// This file lives outside `src`, so it is compiled with the classic JSX
// transform and needs React in scope.
import React from 'react'
import { App } from '../src/app.js'
import { ScClient } from '../src/sc/client.js'
import { DemoClient } from '../src/sc/mock.js'

const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const columns = Number(positional[0] ?? 150)
const rows = Number(positional[1] ?? 44)
const tab = (positional[2] ?? 'overview') as 'overview' | 'holdings' | 'watchlist' | 'transactions'
const keysToSend = args.find((a) => a.startsWith('--keys='))?.slice('--keys='.length) ?? ''
const waitMs = Number(args.find((a) => a.startsWith('--wait='))?.slice('--wait='.length) ?? 1200)
const scBin = args.find((a) => a.startsWith('--sc-bin='))?.slice('--sc-bin='.length)

const chunks: string[] = []

const stdout = new PassThrough() as unknown as NodeJS.WriteStream
stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')))
Object.assign(stdout, { columns, rows, isTTY: true })

const stdin = new PassThrough() as unknown as NodeJS.ReadStream
Object.assign(stdin, {
  isTTY: true,
  setRawMode: () => stdin,
  ref: () => stdin,
  unref: () => stdin,
})

const client = scBin === undefined ? new DemoClient() : new ScClient({ bin: scBin })

const instance = render(<App client={client} autoRefreshSeconds={null} initialTab={tab} />, {
  stdout,
  stdin,
  interactive: true,
  patchConsole: false,
  alternateScreen: false,
  exitOnCtrlC: false,
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

await sleep(waitMs)

// `~` stands in for Enter and `^` for Escape, so key sequences stay shell-safe.
for (const key of keysToSend) {
  const code = key === '~' ? '\r' : key === '^' ? '' : key
  ;(stdin as unknown as PassThrough).write(code)
  await sleep(320)
}
await sleep(600)

instance.unmount()
await sleep(60)

// Ink prefixes each frame with erase/cursor sequences; the last substantial
// write is the frame we want.
const frame = [...chunks].reverse().find((c) => c.replace(/\[[0-9;?]*[A-Za-z]/g, '').trim().length > 100)

process.stdout.write(
  (frame ?? '(no frame captured)')
    // Drop cursor movement / erase codes, keep colour so the output is readable.
    .replace(/\[[0-9;]*[ABCDEFGJKST]/g, '')
    .replace(/\[\?25[hl]/g, ''),
)
process.stdout.write('\n')
process.exit(0)
