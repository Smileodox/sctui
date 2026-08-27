/**
 * Tests für die Read-only-Garantie in src/sc/exec.ts.
 *
 * Das hier ist das zentrale Vertrauensversprechen der App: kein Codepfad kann
 * einen mutierenden `sc`-Befehl ausführen. Diese Tests machen aus dem
 * Versprechen einen Beweis — jede Aufweichung der Allowlist oder der
 * Flag-Sperrliste schlägt hier fehl, bevor sie ein Depot erreicht.
 *
 *   npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertReadOnly, assertWrite, ScError } from '../src/sc/exec.js'
import { ScClient } from '../src/sc/client.js'

/** Erwartet SC_FORBIDDEN — alles andere (auch Durchlassen) ist ein Fehlschlag. */
function assertForbidden(path: string[], args: string[] = []): void {
  assert.throws(
    () => assertReadOnly(path, args),
    (error: unknown) => error instanceof ScError && error.code === 'SC_FORBIDDEN',
    `sollte verboten sein: sc ${[...path, ...args].join(' ')}`,
  )
}

// ── Allowlist: was drin ist, geht durch ─────────────────────────────────────

test('jedes allowlisted Kommando passiert mit --json', () => {
  const allowed = [
    ['whoami'],
    ['capabilities'],
    ['overnight'],
    ['overnight', 'transactions'],
    ['broker', 'context', 'show'],
    ['broker', 'overview'],
    ['broker', 'analytics'],
    ['broker', 'cash-breakdown'],
    ['broker', 'holdings'],
    ['broker', 'transactions'],
    ['broker', 'transaction', 'details'],
    ['broker', 'portfolio-groups'],
    ['broker', 'chart'],
    ['broker', 'quote'],
    ['broker', 'search'],
    ['broker', 'derivatives', 'search'],
    ['broker', 'security-news'],
    ['broker', 'watchlist'],
    ['broker', 'price-alerts'],
    ['broker', 'savings-plans'],
  ]
  for (const path of allowed) {
    assert.doesNotThrow(() => assertReadOnly(path, ['--json']))
  }
})

test('übliche Leseflags passieren', () => {
  assert.doesNotThrow(() =>
    assertReadOnly(['broker', 'quote'], ['--isin', 'US0378331005', '--timeframe', '1d', '--json']),
  )
})

// ── Pfad-Exaktheit: kein Präfix-Match, keine Verlängerung ───────────────────

test('ein Suffix macht ein erlaubtes Kommando nicht erlaubt', () => {
  assertForbidden(['broker', 'watchlist', 'add'])
  assertForbidden(['broker', 'watchlist', 'remove'])
  assertForbidden(['broker', 'price-alerts', 'create'])
  assertForbidden(['broker', 'price-alerts', 'delete'])
  assertForbidden(['broker', 'savings-plans', 'create'])
  assertForbidden(['whoami', 'extra'])
})

test('ein Präfix eines erlaubten Kommandos ist nicht erlaubt', () => {
  assertForbidden(['broker'])
  assertForbidden(['broker', 'context'])
  assertForbidden(['broker', 'transaction'])
  assertForbidden(['overnight', 'transactions', 'details'])
})

test('mutierende Kommandos sind verboten', () => {
  assertForbidden(['broker', 'order'])
  assertForbidden(['broker', 'order', 'place'])
  assertForbidden(['broker', 'buy'])
  assertForbidden(['broker', 'sell'])
  assertForbidden(['login'])
  assertForbidden(['logout'])
})

test('der leere Pfad ist verboten', () => {
  assertForbidden([])
})

test('die Allowlist ist case-sensitiv', () => {
  assertForbidden(['WHOAMI'])
  assertForbidden(['Broker', 'overview'])
})

test('Flags im Pfad schmuggeln kein Kommando durch', () => {
  // Der Pfad wird als Ganzes verglichen — ein eingeschobenes Token bricht ihn.
  assertForbidden(['broker', '--json', 'overview'])
})

// ── Flag-Sperrliste: Bestätigungs-Flags kommen nie durch ────────────────────

test('jedes Bestätigungs-Flag wird geblockt, egal wo es steht', () => {
  for (const flag of ['--confirm', '--accept-unsuitable', '--yes', '-y']) {
    assertForbidden(['broker', 'quote'], [flag])
    assertForbidden(['broker', 'quote'], ['--isin', 'US0378331005', flag, '--json'])
  }
})

test('--flag=wert wird am Flag-Namen erkannt', () => {
  assertForbidden(['broker', 'quote'], ['--confirm=true'])
  assertForbidden(['broker', 'quote'], ['--yes=1'])
})

test('ein Bestätigungs-Flag als Wert wird konservativ ebenfalls geblockt', () => {
  // Falsch-positiv ist hier billig, falsch-negativ wäre eine Order.
  assertForbidden(['broker', 'search'], ['--confirm', '--json'])
})

// ── ScClient: die Suchquery kann kein Flag werden ───────────────────────────

test('search() weist Queries mit führendem "-" ab, bevor ein Prozess startet', async () => {
  // Nichtexistente Binary: würde der Guard nicht greifen, schlüge der Test
  // mit SC_NOT_FOUND fehl statt mit SC_FORBIDDEN.
  const client = new ScClient({ bin: '/nonexistent/sc' })
  for (const query of ['--confirm', '-y', '  --isin']) {
    await assert.rejects(
      client.search(query),
      (error: unknown) => error instanceof ScError && error.code === 'SC_FORBIDDEN',
      `sollte abgewiesen werden: ${JSON.stringify(query)}`,
    )
  }
})

// ── Write path: opt-in, tiny, and never a trading backdoor ──────────────────

const ADD = ['broker', 'savings-plans', 'add']
const ADD_ARGS = ['--isin', 'IE00B4L5Y983', '--amount', '25', '--json']

function assertWriteForbidden(path: string[], args: string[], enabled: boolean): void {
  assert.throws(
    () => assertWrite(path, args, enabled),
    (error: unknown) => error instanceof ScError && error.code === 'SC_FORBIDDEN',
    `sollte verboten sein: sc ${[...path, ...args].join(' ')} (writes=${enabled})`,
  )
}

test('ohne --enable-writes ist auch das erlaubte Kommando verboten', () => {
  assertWriteForbidden(ADD, ADD_ARGS, false)
})

test('die Write-Allowlist umfasst genau ein Kommando', () => {
  assertWriteForbidden(['broker', 'trade'], ['--json'], true)
  assertWriteForbidden(['broker', 'trade', 'place'], ['--json'], true)
  assertWriteForbidden(['broker', 'watchlist', 'add'], ['--json'], true)
  assertWriteForbidden(['broker', 'savings-plans', 'remove'], ['--json'], true)
  assertWriteForbidden(['broker', 'savings-plans'], ['--json'], true)
  assertWriteForbidden(['login'], [], true)
})

test('aktiviert + allowlisted passiert, auch mit --confirm <id>', () => {
  assert.doesNotThrow(() => assertWrite(ADD, ADD_ARGS, true))
  assert.doesNotThrow(() => assertWrite(ADD, [...ADD_ARGS, '--confirm', 'abc123'], true))
})

test('--accept-unsuitable ist auf jedem Pfad verboten', () => {
  assertWriteForbidden(ADD, [...ADD_ARGS, '--accept-unsuitable'], true)
  assertForbidden(['broker', 'quote'], ['--accept-unsuitable'])
})

test('der Lesepfad kennt das Write-Kommando weiterhin nicht', () => {
  assertForbidden(['broker', 'savings-plans', 'add'], ADD_ARGS)
})
