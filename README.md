# sctui — Terminal-Dashboard für Scalable Capital

[![ci](https://github.com/Smileodox/sctui/actions/workflows/ci.yml/badge.svg)](https://github.com/Smileodox/sctui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/sctui)](https://www.npmjs.com/package/sctui)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Ein Read-only-Dashboard für das Scalable-Depot im Terminal, gebaut auf der
offiziellen [Scalable CLI](https://github.com/ScalableCapital/scalable-cli).
Übersicht, Positionen, Watchlist, Transaktionen, Detailansicht mit Chart und
Quote — mit Auto-Refresh.

![sctui im Demo-Modus](https://raw.githubusercontent.com/Smileodox/sctui/main/assets/demo.gif)

*Aufgenommen gegen `sctui --demo` — generierte Daten, kein Account nötig.
Reproduzierbar mit [`vhs assets/demo.tape`](assets/demo.tape).*

> **Inoffizielles Projekt.** Nicht mit der Scalable Capital GmbH verbunden,
> nicht von ihr unterstützt. Keine Anlageberatung — Anzeigen können falsch,
> unvollständig oder verzögert sein. Die App ist strukturell read-only: sie
> kann keine Order platzieren und nichts an deinem Depot ändern
> ([wie das erzwungen wird](#read-only-strukturell)).

```
 s c t u i │ Demo-Depot                                         demo@example.com (Demo-Modus)  DEMO
 50.525,88 €   ▲ +119,72 € (+0,26 %) heute   ·   Gesamt +10.721,08 € (+30,13 %)     Cash 4.218,40 €

 1 Übersicht   2 Positionen   3 Watchlist   4 Transaktionen

╭────────────────────────────────────────────────────────╮╭────────────────────────────────────────╮
│ P O S I T I O N E N                    8 · 46.307,48 € ││ I N S T R U M E N T    1m · [ ] ändern │
│                                                        ││                                        │
│ POSITION                               WERT      G/V % ││ iShares Core MSCI World UCITS ETF      │
│ Vanguard FTSE All-World UCI…    11.616,00 €   +22,00 % ││ IE00B4L5Y983 · ETF                     │
│ iShares Core MSCI World UCI…    14.658,00 €   +26,91 % ││                                        │
│ Apple Inc.                       2.566,80 €   +27,09 % ││ 104,70 €  ▼ -0,13 %                    │
│ ASML Holding N.V.                2.973,48 €   +21,66 % ││ Bid 104,69  Ask 104,71  Vortag 104,84  │
│ SAP SE                           3.938,04 €   +46,15 % ││                                        │
│ Rheinmetall AG                   3.079,44 €   +77,96 % ││  106,06│ ⣀⣠⢤⣀⣀⣀⡼⠓⠒⠒⠦⠶⣄⣀⣀⢀⡴⠲⣄⢀⣀⣀⡤⢤⡤⣄⡀   │
│ Invesco Physical Gold ETC        5.757,62 €   +31,78 % ││  103,88│⠉⠉⠁⠈⠉⠉⠁        ⠈⠉  ⠈⠉      ⠉⠳⣼ │
│ Bitcoin ETP                      1.718,10 €   +36,68 % ││        └────────────────────────────── │
│                                                        ││            −0,17 EUR (-0,16 %) · 1m    │
╰────────────────────────────────────────────────────────╯╰────────────────────────────────────────╯
```

Das ist ein echtes Frame aus `npm run demo` (100 × 20). Mit Account steht oben
rechts `LIVE` und der echte Kontoname; sonst ist es dasselbe Bild.

## Read-only, strukturell

Die App kann keinen mutierenden `sc`-Befehl ausführen. Kein Trading, keine
Watchlist-Änderungen, keine Preisalarme — auch nicht versehentlich.

Durchgesetzt wird das in [`src/sc/exec.ts`](src/sc/exec.ts):

- Kommandopfad und Flags werden **getrennt** übergeben (`runSc(path, args)`).
  Der Pfad wird gegen eine Allowlist **exakt** verglichen, nicht als Präfix —
  `broker watchlist` ist erlaubt, `broker watchlist add` nicht.
- Eine Sperrliste blockt zusätzlich Bestätigungs-Flags (`--confirm`,
  `--accept-unsuitable`, `--yes`, `-y`).
- Jeder Aufruf geht durch `assertReadOnly()`, bevor ein Prozess gestartet wird.

- [`tests/exec.test.ts`](tests/exec.test.ts) beweist das in CI: Pfad-Exaktheit,
  Flag-Formen, Case-Sensitivität. [`scripts/check-readonly-boundary.mjs`](scripts/check-readonly-boundary.mjs)
  stellt zusätzlich sicher, dass `child_process` nirgendwo sonst in `src/`
  auftaucht — es gibt keinen Weg an der Allowlist vorbei.

Wie man das selbst in fünf Minuten auditiert, steht in [SECURITY.md](SECURITY.md).

Wer die App erweitert: neue Kommandos gehören nur dann in
`READ_ONLY_COMMANDS`, wenn sie ausschließlich lesen.

## Setup

Die CLI selbst installieren und einloggen (macht die App bewusst nicht für
dich):

```sh
brew tap ScalableCapital/tap
brew trust --formula ScalableCapital/tap/scalable-cli
brew install scalable-cli
```

Danach im Scalable-Profil unter **Einstellungen → Sicherheit** den Punkt
**„Scalable CLI"** aktivieren, sonst schlägt der Login fehl. Dann:

```sh
sc login --local-read-only   # OAuth Device-Code im Browser
sc whoami                    # prüfen, ob die Session steht
```

`--local-read-only` legt die Session schreibgeschützt an: schon die offizielle
Binary verweigert dann jede Mutation. sctui empfiehlt das und braucht nie mehr
— die [eigene Allowlist](#read-only-strukturell) ist damit die zweite
Verteidigungslinie, nicht die einzige.

Und das Dashboard:

```sh
npm install
npm run build
node dist/cli.js          # oder: npm link && sctui
```

Ohne Account:

```sh
npm run demo              # vollständiges UI mit generierten Beispieldaten
```

## Aufruf

```
sctui [optionen]

  --demo                 Beispieldaten statt echter (kein sc, kein Account nötig)
  --refresh <sekunden>   Auto-Refresh-Intervall (Standard: 60, Minimum: 5)
  --no-refresh           Auto-Refresh aus
  --tab <name>           Starttab: overview | holdings | watchlist | transactions
  --sc-bin <pfad>        Abweichender Pfad zur sc-Binary
  --no-alt-screen        Im normalen Puffer rendern (nützlich zum Debuggen)
  -h, --help             Hilfe
  -v, --version          Version
```

Alternativ setzt `SCTUI_SC_BIN` den Pfad zur Binary und `SCTUI_LOCALE` das
Zahlenformat (Standard `de-DE`).

## Tasten

| Taste | Wirkung |
| --- | --- |
| `1` – `4` | Tab direkt wählen |
| `tab` / `⇧tab` | Nächster / vorheriger Tab |
| `↑` `↓` · `j` `k` | Zeile wechseln |
| `g` / `G` | Anfang / Ende der Liste |
| `pgup` / `pgdn` | Seitenweise blättern |
| `⏎` · `→` · `l` | Detail zum ausgewählten Wert öffnen |
| `esc` · `←` · `h` | Detail schließen |
| `[` `]` · `t` | Chart-Zeitraum zurück / vor / durchschalten |
| `r` | Jetzt aktualisieren (Cache umgehen) |
| `a` | Auto-Refresh an / aus |
| `/` | Instrumentensuche |
| `d` | Roh-JSON der aktuellen Ansicht |
| `?` | Hilfe |
| `q` · `ctrl-c` | Beenden |

## Was die CLI liefert

Jede `--json`-Antwort steckt in einem Umschlag:

```json
{ "ok": true, "command": "broker.overview", "data": { "result": { } } }
{ "ok": false, "command": "broker.search", "error": { "code": "…", "message": "…" }, "hints": [] }
```

Zwei Details, an denen man sich sonst schneidet:

- **Ein Fehler kommt mit Exit-Code 0.** `ok: false` ist die einzige Stelle, an
  der er steht — [`unwrapEnvelope()`](src/sc/json.ts) prüft deshalb das geparste
  Dokument, nicht den Exit-Status.
- **`broker chart` hat kein `result`.** Die Reihe liegt direkt unter
  `data.data_points[]`; `overnight` wiederum ist ein Top-Level-Kommando
  (nicht `broker overnight`) und legt sein `display_name` *neben* `result`.

Zeiträume für Chart und Quote: `1d`, `7d`, `1m`, `3m`, `6m`, `ytd`, `1y`, `max`.

Ein paar Zahlen rechnet die App selbst, weil die CLI sie nicht hergibt:
`broker overview` liefert pro Zeitraum nur einen Geldbetrag
(`simpleAbsoluteReturn`), also werden alle Prozentwerte der Übersicht daraus
abgeleitet. Und `broker holdings` kennt keine Tagesveränderung — die Spalte
kommt aus einem `broker quote` pro ISIN, dasselbe gilt für die Watchlist.

### Wenn eine Spalte `—` zeigt

Die Feldnamen in [`src/sc/normalize.ts`](src/sc/normalize.ts) sind gegen
`sc 1.0.0` verifiziert, liegen aber trotzdem als Alias-Tabellen vor
(`PRICE_KEYS`, `PNL_PCT_KEYS`, …), damit eine Umbenennung in der CLI nicht die
ganze Ansicht leert. Groß-/Kleinschreibung und Trennzeichen sind egal:
`totalValue`, `total_value` und `TOTAL-VALUE` matchen alle. Verschachtelte
Felder gehen über Punktpfade (`day_change.percent`).

Wenn eine Spalte leer bleibt, obwohl die Daten da sein müssten:

1. `d` drücken — das Overlay zeigt das Roh-JSON samt abgesetztem `sc`-Befehl.
2. Den echten Schlüssel raussuchen.
3. In `normalize.ts` in die passende Alias-Liste eintragen.

Das ist der vorgesehene Weg, kein Workaround.

## Entwicklung

```sh
npm run dev          # tsx, gegen die echte CLI
npm run demo         # tsx, mit Beispieldaten
npm run typecheck
npm run build
```

**Layout prüfen ohne TTY.** `scripts/snapshot.tsx` rendert die App gegen ein
virtuelles Terminal beliebiger Größe und druckt das letzte Frame. So lassen
sich Umbruch- und Überlauf-Fehler bei schmalen Breiten finden:

```sh
npm run snapshot -- 120 30 holdings --keys='jj~'   # ~ = Enter, ^ = Escape
npm run snapshot -- 90 30 watchlist
npm run snapshot -- 72 24 overview
```

`npm run check:layout` fährt diese Matrix automatisch ab (Größen × Tabs ×
Overlays × Setup-Screens) und schlägt fehl, sobald ein Frame breiter oder höher
ist als das Terminal, für das es gerendert wurde. Zusätzlich prüft es bei den
kurzen Größen, ob eine Markierung im Frame noch unversehrt dasteht — ein Frame
mit ineinandergelaufenen Zeilen hat exakt die richtige Größe und fällt sonst
nicht auf. Dauert ein paar Minuten.

Der Grund für den Aufwand: Ink schneidet zu langen oder zu hohen Inhalt nicht
ab, es bricht ihn um. Eine Komponente, die eine Zeile mehr rendert als ihr
`height`-Prop verspricht, schiebt damit die Zeile ihres Nachbarn über die
eigene. Jede Komponente muss ihr Zeilenbudget also selbst einhalten und Zeilen
aufgeben, statt sie stapeln zu lassen.

**Den Live-Pfad ohne Account testen.** `scripts/fake-sc` ist ein Shell-Skript,
das sich wie `sc 1.0.0` verhält: gleicher Umschlag, gleiche Feldnamen, gleiche
Kommandostruktur. Alle vier Positionen kommen aus einer Tabelle im Skript, damit
die Summen im Header nicht von den Zeilen im Tab abweichen können.

```sh
npm run snapshot -- 120 30 holdings --sc-bin="$PWD/scripts/fake-sc"
# Fehlerpfade: auth = Fehler-Umschlag auf Exit 0, exit = stderr und Exit 1
FAKE_SC_FAIL=auth npm run snapshot -- 100 24 overview --sc-bin="$PWD/scripts/fake-sc"
FAKE_SC_FAIL=exit npm run snapshot -- 100 24 overview --sc-bin="$PWD/scripts/fake-sc"
```

### Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/sc/exec.ts` | Prozess-Wrapper, Allowlist, Timeouts, Concurrency-Limit |
| `src/sc/json.ts` | Tolerantes Parsen und Zahlen-Coercion (auch `"1.234,56 €"`) |
| `src/sc/normalize.ts` | Rohes JSON → Domänenmodelle, alle Feldnamen-Aliase |
| `src/sc/client.ts` | Kommandos, Caching mit TTL, Deduplizierung |
| `src/sc/mock.ts` | Demo-Datenquelle (seeded, damit Kurse stabil bleiben) |
| `src/components/` | Table, Panel, Chart, Header, StatusBar, … |
| `src/views/` | Die vier Tabs, Detailpane und die Overlays |
| `src/app.tsx` | Tastatur, State, Layout |

Alle Breitenberechnungen laufen über `pad()`/`truncate()` aus
[`src/format.ts`](src/format.ts) statt über Flex-Spacer: Ein Flex-Spacer
schrumpft auf null und lässt Text ineinanderlaufen, statt ihn abzuschneiden.

## Grenzen

- Läuft nur so gut wie die CLI: Wenn `sc` etwas nicht liefert, zeigt die App `—`.
- Kein Tickersymbol, kein Handelsplatz, keine Tagesspanne — `broker quote` kennt
  das nicht. Die Identitätszeile im Detail ist deshalb `ISIN · TYP`, und die
  Kennzahlenzeile zeigt Bid, Ask, Vortag, Spread und Rendite seit Kauf.
- `overnight` ist optional — fehlt es, bleibt die Zinszeile in der Cash-Kachel leer.
- Unter 80 Spalten wird gekürzt (Spalten fallen nach Priorität weg), ab 100
  Spalten sieht es aus, wie es gedacht ist. Auf schmalen Terminals legt sich das
  Detail über die Liste statt daneben.
- Auf sehr niedrigen Terminals geben die Ansichten Zeilen auf: die Kacheln der
  Übersicht verlieren erst ihre Delta-Zeile, dann rutscht das Label neben die
  Zahl; unter fünf Inhaltszeilen erscheint nur noch ein Hinweis.
