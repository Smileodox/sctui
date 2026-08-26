# Sicherheit

sctui zeigt Depotdaten an. Wer es benutzt, gibt einem fremden Programm Zugriff
auf seine Scalable-CLI-Session — dieses Dokument erklärt, warum das vertretbar
ist und wie man es **selbst in fünf Minuten nachprüft**, statt es zu glauben.

## Trust-Modell

- sctui hat **keine eigenen Zugangsdaten** und spricht **keine API** an. Alles
  läuft über die offizielle [`sc`-CLI](https://github.com/ScalableCapital/scalable-cli),
  die du selbst installierst und in die du dich selbst einloggst. Tokens
  verwaltet `sc`, nicht sctui.
- sctui ist **read-only by construction**: es gibt keinen Codepfad, der eine
  Order platzieren, bestätigen oder stornieren kann — auch keine „harmlosen"
  Schreiboperationen wie Watchlist-Änderungen oder Preisalarme.
- sctui telemetriert nichts, schreibt nichts auf die Platte und öffnet keine
  Netzwerkverbindungen. Der einzige Effekt auf die Außenwelt ist der Aufruf
  der `sc`-Binary.

## Der 5-Minuten-Audit

Die Garantie hängt an genau einer Datei. So prüfst du sie:

1. **Ein Choke-Point.** Prozesse werden ausschließlich in
   [`src/sc/exec.ts`](src/sc/exec.ts) gestartet:

   ```sh
   grep -rn child_process src/
   # → genau ein Treffer: src/sc/exec.ts
   ```

   CI erzwingt das: [`scripts/check-readonly-boundary.mjs`](scripts/check-readonly-boundary.mjs)
   schlägt fehl, sobald `child_process` irgendwo sonst in `src/` auftaucht.

2. **Eine Allowlist.** `READ_ONLY_COMMANDS` in `exec.ts` zählt jedes erlaubte
   Kommando als **exakten** Token-Pfad auf — kein Präfix-Match, d. h.
   `broker watchlist` erlaubt nicht `broker watchlist add`.

3. **Eine Sperrliste.** `FORBIDDEN_FLAGS` blockt Bestätigungs-Flags
   (`--confirm`, `--accept-unsuitable`, `--yes`, `-y`), auch in der
   `--flag=wert`-Form — konservativ: ein gesperrtes Flag wird selbst dann
   abgewiesen, wenn es nur als Wert auftaucht.

4. **Vor jedem Spawn.** `runSc()` ruft `assertReadOnly()` als erste Zeile auf.
   [`tests/exec.test.ts`](tests/exec.test.ts) beweist all das mit jedem
   CI-Lauf: Pfad-Exaktheit, Case-Sensitivität, Flag-Formen, und dass die
   Nutzereingabe der Suche nie als Flag interpretiert werden kann.

## Zweite Schicht: `--local-read-only`

Du musst nicht einmal diesem Code vertrauen. Die offizielle CLI kann die
Session selbst schreibgeschützt anlegen:

```sh
sc login --local-read-only
```

Dann verweigert schon die `sc`-Binary jede Mutation — egal, was ein Programm
darüber versucht. sctui empfiehlt diesen Login und braucht nie mehr als das.
Die Allowlist ist damit die zweite Verteidigungslinie, nicht die einzige.

## Grenzen

- sctui zeigt an, was `sc` liefert. Falsche, verzögerte oder unvollständige
  Anzeigen sind möglich — keine Anlageberatung, Entscheidungen bitte nie
  allein auf Basis dieser Anzeige treffen.
- `npm install` zieht drei Runtime-Abhängigkeiten (ink, ink-text-input,
  react); der Lockfile ist eingecheckt, Releases werden mit
  `npm publish --provenance` veröffentlicht.

## Lücke gefunden?

Bitte **nicht** als öffentliches Issue. Nutze GitHubs private
Schwachstellenmeldung („Report a vulnerability" im Security-Tab des Repos).
Alles, was die Read-only-Garantie betrifft, wird mit höchster Priorität
behandelt.
