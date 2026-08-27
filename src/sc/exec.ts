/**
 * Thin process wrapper around the official Scalable CLI (`sc`).
 *
 * Everything this app knows about your portfolio comes through here. Three
 * deliberate properties:
 *
 *  1. **Read-only by default.** A call names a command *path* (the subcommand
 *     tokens) separately from its flags. The path must match an entry in
 *     `READ_ONLY_COMMANDS` exactly — not as a prefix — so
 *     `broker watchlist add` can never slip through as `broker watchlist`.
 *  2. **Writes are opt-in, tiny, and previewed.** With `--enable-writes` a
 *     second, separate allowlist (`WRITE_COMMANDS`) opens — currently just
 *     savings-plan creation, which the CLI itself forces through a
 *     preview-then-confirm-by-id flow. There is no code path in this app
 *     that can place, confirm, or cancel an order, on either list.
 *  3. **Bounded.** Concurrency is capped and every call has a timeout, so a
 *     hung CLI can never wedge the UI.
 */

import { execFile } from 'node:child_process'
import { t } from '../strings.js'

export type ScErrorCode =
  | 'SC_NOT_FOUND'
  | 'SC_AUTH'
  | 'SC_TIMEOUT'
  | 'SC_PARSE'
  | 'SC_FORBIDDEN'
  | 'SC_ABORTED'
  | 'SC_FAILED'

export class ScError extends Error {
  readonly code: ScErrorCode
  readonly argv: string[]
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null

  constructor(
    code: ScErrorCode,
    message: string,
    detail: { argv?: string[]; stdout?: string; stderr?: string; exitCode?: number | null } = {},
  ) {
    super(message)
    this.name = 'ScError'
    this.code = code
    this.argv = detail.argv ?? []
    this.stdout = detail.stdout ?? ''
    this.stderr = detail.stderr ?? ''
    this.exitCode = detail.exitCode ?? null
  }

  /** A short, human-facing line suitable for the status bar. */
  get hint(): string {
    switch (this.code) {
      case 'SC_NOT_FOUND':
        return t.hintScNotFound
      case 'SC_AUTH':
        return t.hintScAuth
      case 'SC_TIMEOUT':
        return t.hintScTimeout
      case 'SC_PARSE':
        return t.hintScParse
      case 'SC_FORBIDDEN':
        return t.hintScForbidden
      case 'SC_ABORTED':
        return t.hintScAborted
      default:
        return this.message
    }
  }
}

/**
 * Every read-only command this app is allowed to run, as an exact token path.
 * Adding a mutating command here would defeat the guarantee above — don't.
 */
const READ_ONLY_COMMANDS: readonly string[] = [
  'whoami',
  'capabilities',
  'overnight',
  'overnight transactions',
  'broker context show',
  'broker overview',
  'broker analytics',
  'broker cash-breakdown',
  'broker holdings',
  'broker transactions',
  'broker transaction details',
  'broker portfolio-groups',
  'broker chart',
  'broker quote',
  'broker search',
  'broker derivatives search',
  'broker security-news',
  'broker watchlist',
  'broker price-alerts',
  'broker savings-plans',
  'broker savings-plans config',
]

const READ_ONLY_SET = new Set(READ_ONLY_COMMANDS)

/** Flags that turn a preview into a real, irreversible action. Never allowed on the read path. */
const FORBIDDEN_FLAGS = new Set(['--confirm', '--accept-unsuitable', '--yes', '-y'])

/**
 * The write path. Everything about it is deliberately separate from the
 * read-only machinery above:
 *
 *  - It only exists at runtime when the user starts with `--enable-writes`;
 *    the flag is per-invocation state, never persisted.
 *  - Its allowlist is exact-match, like the read one, and currently holds a
 *    single command. Order placement is not on it and must never slip in as
 *    a side effect of some other feature.
 *  - `--confirm` is allowed here because the CLI's own design makes it safe:
 *    it takes a confirmation id that only a prior preview call returns, so
 *    this app cannot execute anything it has not shown the user first.
 *  - `--accept-unsuitable` bypasses the broker's appropriateness check.
 *    That is not a feature; it stays forbidden on every path.
 */
const WRITE_COMMANDS: readonly string[] = ['broker savings-plans add']
const WRITE_SET = new Set(WRITE_COMMANDS)
const ALWAYS_FORBIDDEN_FLAGS = new Set(['--accept-unsuitable'])

/** Validates a mutating command. Throws unless writes were explicitly enabled. */
export function assertWrite(path: readonly string[], args: readonly string[], writesEnabled: boolean): void {
  if (!writesEnabled) {
    throw new ScError('SC_FORBIDDEN', t.writesDisabled, { argv: [...path, ...args] })
  }
  const key = path.join(' ')
  if (!WRITE_SET.has(key)) {
    throw new ScError('SC_FORBIDDEN', `Not on the write allowlist: sc ${key}`, {
      argv: [...path, ...args],
    })
  }
  for (const arg of args) {
    const flag = arg.startsWith('--') ? (arg.split('=', 1)[0] as string) : arg
    if (ALWAYS_FORBIDDEN_FLAGS.has(flag)) {
      throw new ScError('SC_FORBIDDEN', `Forbidden on every path: ${flag}`, {
        argv: [...path, ...args],
      })
    }
  }
}

/**
 * Validates a command before it is spawned.
 *
 * @param path Subcommand tokens only, e.g. `['broker', 'quote']`.
 * @param args Flags and their values, e.g. `['--isin', 'US0378331005', '--json']`.
 */
export function assertReadOnly(path: readonly string[], args: readonly string[]): void {
  const key = path.join(' ')
  if (!READ_ONLY_SET.has(key)) {
    throw new ScError('SC_FORBIDDEN', `Not on the read-only allowlist: sc ${key}`, {
      argv: [...path, ...args],
    })
  }
  for (const arg of args) {
    // Compare the flag name only, so `--isin=X` is checked as `--isin`.
    const flag = arg.startsWith('--') ? (arg.split('=', 1)[0] as string) : arg
    if (FORBIDDEN_FLAGS.has(flag)) {
      throw new ScError('SC_FORBIDDEN', `Forbidden flag for a read-only app: ${flag}`, {
        argv: [...path, ...args],
      })
    }
  }
}

export interface ScRunOptions {
  /** Path to the binary. Defaults to `sc` on `$PATH`. */
  bin?: string
  /** Milliseconds before the child is killed. */
  timeoutMs?: number
  /** Abort in-flight work (e.g. the user navigated away). */
  signal?: AbortSignal
}

export interface ScRun {
  argv: string[]
  stdout: string
  stderr: string
  durationMs: number
}

/** Cap on simultaneous `sc` processes, to stay friendly to the upstream API. */
const MAX_CONCURRENCY = 3
let active = 0
const waiting: Array<() => void> = []

function release(): void {
  active--
  const next = waiting.shift()
  if (next) next()
}

async function acquire(): Promise<() => void> {
  if (active >= MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => waiting.push(resolve))
  }
  active++
  let released = false
  return () => {
    if (released) return
    released = true
    release()
  }
}

const AUTH_PATTERN =
  /(not\s+logged\s+in|unauthori[sz]ed|unauthenticated|\b401\b|\b403\b|session\s+expired|run\s+`?sc\s+login|no\s+active\s+session|invalid\s+token)/i

/** Spawn `sc <path> <args>` and return its raw streams. Does not parse. */
export async function runSc(
  path: string[],
  args: string[] = [],
  options: ScRunOptions = {},
): Promise<ScRun> {
  assertReadOnly(path, args)
  return spawnSc(path, args, options)
}

/**
 * The write variant. Same spawn, different gate: `assertWrite` instead of
 * `assertReadOnly`, and only when the caller proves the user opted in.
 */
export async function runScWrite(
  path: string[],
  args: string[],
  writesEnabled: boolean,
  options: ScRunOptions = {},
): Promise<ScRun> {
  assertWrite(path, args, writesEnabled)
  return spawnSc(path, args, options)
}

async function spawnSc(
  path: string[],
  args: string[],
  options: ScRunOptions = {},
): Promise<ScRun> {
  const argv = [...path, ...args]
  const bin = options.bin ?? process.env['SCTUI_SC_BIN'] ?? 'sc'
  const timeoutMs = options.timeoutMs ?? 20_000
  const startedAt = Date.now()
  const done = await acquire()

  try {
    return await new Promise<ScRun>((resolve, reject) => {
      execFile(
        bin,
        argv,
        {
          timeout: timeoutMs,
          maxBuffer: 32 * 1024 * 1024,
          signal: options.signal,
          encoding: 'utf8',
          // Keep the CLI non-interactive: no colour codes in the JSON, no pager.
          env: { ...process.env, NO_COLOR: '1', PAGER: 'cat', CLICOLOR: '0' },
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startedAt
          if (!error) {
            resolve({ argv, stdout, stderr, durationMs })
            return
          }

          const errno = (error as NodeJS.ErrnoException).code
          if (errno === 'ENOENT') {
            reject(new ScError('SC_NOT_FOUND', `\`${bin}\` not found on PATH`, { argv, stdout, stderr }))
            return
          }
          if (errno === 'ABORT_ERR' || options.signal?.aborted) {
            reject(new ScError('SC_ABORTED', 'Aborted', { argv, stdout, stderr }))
            return
          }
          if ((error as { killed?: boolean }).killed) {
            reject(
              new ScError('SC_TIMEOUT', `sc ${argv.join(' ')} timed out after ${timeoutMs} ms`, {
                argv,
                stdout,
                stderr,
              }),
            )
            return
          }

          const rawExit = (error as { code?: number | string }).code
          const combined = `${stderr}\n${stdout}`.trim()
          const code: ScErrorCode = AUTH_PATTERN.test(combined) ? 'SC_AUTH' : 'SC_FAILED'
          const firstLine = combined.split('\n').find((l) => l.trim().length > 0) ?? 'unknown error'
          reject(
            new ScError(code, firstLine.trim(), {
              argv,
              stdout,
              stderr,
              exitCode: typeof rawExit === 'number' ? rawExit : null,
            }),
          )
        },
      )
    })
  } finally {
    done()
  }
}
