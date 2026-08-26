# Das README-GIF, aufgenommen gegen den --demo-Modus: seeded und damit
# deterministisch, kein Account nötig, keine echten Depotdaten im Bild.
#
#   brew install vhs
#   vhs assets/demo.tape
Output assets/demo.gif

# Eigene bash statt der Login-zsh, damit keine Prompt-/Plugin-Ausgaben ins Bild laufen.
Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 640
Set Padding 12
Set TypingSpeed 60ms

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
