# Das README-GIF, aufgenommen gegen den --demo-Modus: seeded und damit
# deterministisch, kein Account nötig, keine echten Depotdaten im Bild.
#
#   brew install vhs
#   vhs assets/demo.tape
Output assets/demo.gif

# Eigene bash statt der Login-zsh, damit keine Prompt-/Plugin-Ausgaben ins Bild laufen.
Set Shell "bash"
# Nachgebaut nach dem WezTerm-Setup, in dem das TUI entworfen wurde:
# MesloLGS NF (saubere Braille-Charts), dunkelblauer Grund, kräftige Akzente.
Set FontFamily "MesloLGS Nerd Font Mono"
Set FontSize 17
Set Width 1250
Set Height 680
Set Padding 24
Set BorderRadius 10
Set TypingSpeed 60ms
Set Theme { "name": "sctui", "background": "#011423", "foreground": "#CBE0F0", "cursor": "#47FF9C", "selection": "#033259", "black": "#214969", "red": "#E52E2E", "green": "#44FFB1", "yellow": "#FFE073", "blue": "#0FC5ED", "magenta": "#a277ff", "cyan": "#24EAF7", "white": "#CBE0F0", "brightBlack": "#214969", "brightRed": "#E52E2E", "brightGreen": "#44FFB1", "brightYellow": "#FFE073", "brightBlue": "#A277FF", "brightMagenta": "#a277ff", "brightCyan": "#24EAF7", "brightWhite": "#FFFFFF" }

# Englisch, unabhängig von der Locale der aufnehmenden Maschine. Muss NACH
# allen Set-Zeilen stehen — vhs ignoriert jedes Set unterhalb der ersten Aktion.
Env SCTUI_LOCALE "en-US"

Hide
Type "clear"
Enter
Show

Type "sctui --demo"
Enter
Sleep 3.5s

# Positionen: zwei Zeilen runter, Detail mit Chart öffnen
Type "2"
Sleep 1.5s
Type "j"
Sleep 300ms
Type "j"
Sleep 700ms
Enter
Sleep 2.5s

# Chart-Zeitraum durchschalten
Type "]"
Sleep 1.2s
Type "]"
Sleep 1.8s

# Watchlist, dann zurück auf die Übersicht mit Kennzahlen & Allokation
Type "3"
Sleep 2s
Type "1"
Sleep 3.5s

Type "q"
Sleep 500ms
