# sctui — Terminal-Dashboard für Scalable Capital

🇬🇧 [English version](README.md) *(vollständige Doku)*

Ein Terminal-Dashboard für das Scalable-Depot, gebaut auf der offiziellen
[Scalable CLI](https://github.com/ScalableCapital/scalable-cli). Übersicht,
Positionen, Sparpläne, Watchlist, Transaktionen mit Orderdetails,
Instrument-Ansicht mit Chart, Quote und News — mit Auto-Refresh.

> **Inoffizielles Projekt.** Nicht mit der Scalable Capital GmbH verbunden.
> Keine Anlageberatung — Anzeigen können falsch, unvollständig oder verzögert
> sein. Standardmäßig ist sctui strikt **read-only**: es kann keine Order
> platzieren und nichts an deinem Depot ändern. Einzige Ausnahme, nur per
> Opt-in (`--enable-writes`): Sparpläne anlegen — mit Broker-Preview und
> getipptem Bestätigungswort.

![sctui im Demo-Modus](assets/demo.gif)

## Schnellstart

Ohne Account, ohne CLI — Beispieldaten:

```sh
npx @smileodox/sctui --demo
```

Für echte Daten brauchst du die offizielle CLI (installierst und einloggst du
selbst — sctui macht das bewusst nicht für dich):

```sh
brew tap ScalableCapital/tap
brew trust --formula ScalableCapital/tap/scalable-cli
brew install scalable-cli
```

Danach im Scalable-Profil unter **Einstellungen → Sicherheit** den Punkt
**„Scalable CLI"** aktivieren, dann:

```sh
sc login --local-read-only   # OAuth Device-Code im Browser
sc whoami                    # prüfen, ob die Session steht
```

`--local-read-only` legt schon die Session schreibgeschützt an — die
offizielle Binary verweigert dann jede Mutation, egal was ein Programm
darüber versucht. Die Allowlist von sctui ist damit die zweite
Verteidigungslinie, nicht die einzige.

Und schließlich:

```sh
npm install -g @smileodox/sctui
sctui
```

## Sprache

Die UI ist standardmäßig englisch. Mit deutscher Locale (`LANG=de_DE.UTF-8`
oder `SCTUI_LOCALE=de-DE`) sind alle Beschriftungen und Zahlenformate deutsch
— auf einem deutschen System musst du nichts einstellen.

## Tasten

| Taste | Wirkung |
| --- | --- |
| `1` – `5` | Tab direkt wählen |
| `↑` `↓` · `j` `k` | Zeile wechseln |
| `⏎` · `→` | Detail öffnen, `esc` schließt |
| `[` `]` · `t` | Chart-Zeitraum wechseln |
| `n` | Chart ↔ News im Detail |
| `+` | Neuer Sparplan (Sparpläne-Tab, nur mit `--enable-writes`) |
| `r` / `a` | Refresh / Auto-Refresh |
| `/` | Instrumentensuche |
| `d` | Roh-JSON der aktuellen Ansicht |
| `?` | Hilfe · `q` beendet |

## Read-only — und überprüfbar

Ohne `--enable-writes` kann sctui keinen mutierenden `sc`-Befehl ausführen: exakte
Kommando-Allowlist plus Sperrliste für Bestätigungs-Flags, geprüft vor jedem
Prozessstart ([`src/sc/exec.ts`](src/sc/exec.ts)), abgesichert durch
Unit-Tests und ein CI-Gate. Wie du das selbst in fünf Minuten auditierst,
steht in [SECURITY.md](SECURITY.md).

Alles Weitere — Optionen, Entwicklung, Grenzen, das JSON-Format der CLI —
steht in der [englischen README](README.md).
