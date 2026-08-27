#!/usr/bin/env node
/**
 * Erzwingt die zwei architektonischen Grenzen hinter den Vertrauens-Claims:
 *
 *  1. Prozesse werden ausschließlich in src/sc/exec.ts gestartet — der einen
 *     Datei, die jeden Aufruf durch assertReadOnly()/assertWrite() schickt.
 *  2. Netzwerkzugriffe (fetch, node:http/https) leben ausschließlich in
 *     src/lookup.ts — der einen, per --enable-lookup gegateten Ausnahme vom
 *     "sctui öffnet selbst keine Netzwerkverbindungen"-Versprechen.
 *
 * Taucht eines davon woanders in src/ auf, existiert ein Weg an den Gates
 * vorbei, und dieser Check schlägt fehl. Er läuft in CI vor den Tests: die
 * Tests beweisen, dass die Wächter korrekt sind, dieser Check beweist, dass
 * niemand an ihnen vorbeigeht.
 *
 *   node scripts/check-readonly-boundary.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srcDir = path.join(root, 'src')

const RULES = [
  {
    allowed: path.join('src', 'sc', 'exec.ts'),
    pattern: /child_process/,
    label: 'child_process',
  },
  {
    allowed: path.join('src', 'lookup.ts'),
    // Bare fetch() calls — `.fetch(` (the client's own method) and the
    // method declaration `fetch<T>(` are not network access.
    pattern: /(?<![.\w])fetch\(|node:https?|require\(['"]https?['"]\)/,
    label: 'network access (fetch / node:http[s])',
  },
]

const offenders = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    const rel = path.relative(root, full)
    const lines = readFileSync(full, 'utf8').split('\n')
    for (const rule of RULES) {
      if (rel === rule.allowed) continue
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i])) offenders.push(`${rel}:${i + 1} [${rule.label}]: ${lines[i].trim()}`)
      }
    }
  }
}
walk(srcDir)

if (offenders.length > 0) {
  console.error('Grenzverletzung — ein Gate wurde umgangen:')
  for (const line of offenders) console.error(`  ${line}`)
  process.exit(1)
}
console.log('ok — Prozesse nur in src/sc/exec.ts, Netzwerk nur in src/lookup.ts')
