#!/usr/bin/env node
/**
 * Erzwingt die architektonische Grenze hinter der Read-only-Garantie:
 * Prozesse werden ausschließlich in src/sc/exec.ts gestartet — der einen
 * Datei, die jeden Aufruf durch assertReadOnly() schickt.
 *
 * Taucht `child_process` irgendwo sonst in src/ auf, existiert ein Weg an der
 * Allowlist vorbei, und dieser Check schlägt fehl. Er läuft in CI vor den
 * Tests: die Tests beweisen, dass der Wächter korrekt ist, dieser Check
 * beweist, dass niemand an ihm vorbeigeht.
 *
 *   node scripts/check-readonly-boundary.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srcDir = path.join(root, 'src')
const ALLOWED = path.join('src', 'sc', 'exec.ts')
const PATTERN = /child_process/

const offenders = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
      continue
    }
    const rel = path.relative(root, full)
    if (rel === ALLOWED) continue
    const lines = readFileSync(full, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (PATTERN.test(lines[i])) offenders.push(`${rel}:${i + 1}: ${lines[i].trim()}`)
    }
  }
}
walk(srcDir)

if (offenders.length > 0) {
  console.error('child_process außerhalb von src/sc/exec.ts — die Read-only-Grenze ist verletzt:')
  for (const line of offenders) console.error(`  ${line}`)
  process.exit(1)
}
console.log(`ok — Prozesse starten nur in ${ALLOWED}`)
