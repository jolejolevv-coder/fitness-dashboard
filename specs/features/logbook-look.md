# Dashboard im Look des Recomp Logbuchs

Status: freigegeben 05.11.2026, Open questions 1 bis 3 wie vorgeschlagen, 4 gleicher Look wie vorgeschlagen. ADR 0009. Gebaut 05.11.2026 auf Branch `claude/logbook-look`. Offen: Vergleich am Handy neben dem Logbuch, Merge, Retro. Alte Hexwerte nur noch im App Symbol (out of scope).

## Goal
Das ganze Dashboard bekommt den Look des Recomp Logbuchs (`gym-logbook`), damit beide Seiten aussehen wie aus einem Guss.

## Ausgangslage
* Dashboard heute: Look „Trainerboard“ aus `DESIGN.md`. Hell und dunkel nach Systemeinstellung, Emaille Grau, Blau als Akzent, Schrift SF Pro Rounded, Karten mit Schatten. Tokens stehen in `src/styles.css` (`--board`, `--card`, `--ink`, `--blue` und weitere). Die Diagramme lesen ihre Farben über `COLORS` (`src/ui/palette.ts`) aus denselben Tokens.
* Logbuch: nur dunkel mit OLED Schwarz (`#000`), Flächen kaum angehoben (`#0d0f11`), Linien `#252a30`, Akzent Orange `#ff6b2c` für Fortschritt und das Nächste, Grün `#5fd47a` für Erledigtes, Amber `#ffc65c` für Warnungen. Überschriften in Barlow Condensed, fett und in Großbuchstaben, Fließtext in Barlow. Karten mit 1 px Rand statt Schatten, Radius 12 px, Tippflächen 44 px, gewählte Kapsel invertiert (weiß auf schwarz), Zahlen mit festen Ziffernbreiten.

## Scope
* In scope:
  * Alle Ziele: Heute, Woche (Verlauf, Analyse), Training (Auswertung, Eintragen), Küche (Rezepte, Plan, Einkauf, Kochansicht), Einstellungen, Navigation, Statuszeile.
  * Tokens in `src/styles.css` auf die Logbuch Palette umstellen, Schrift auf Barlow und Barlow Condensed.
  * Bausteine an das Logbuch angleichen: Karten (Rand statt Schatten), Kapseln und Segmente (gewählt invertiert), Überschriften (Condensed, Großbuchstaben), Zahlen, Knöpfe, Eingabefelder, Fortschrittsbalken.
  * Diagramme: Farben über die neuen Tokens. Datenlinie hell, Prognose und Bedienung orange, gut grün, schlecht rot.
  * `theme-color` und Manifest Farben auf Schwarz, `DESIGN.md` auf den neuen Look umschreiben.
* Out of scope:
  * Inhalte, Kennzahlen, Navigation und Aufbau der Ziele. Es ändert sich nur das Aussehen.
  * Das Logbuch selbst.
  * App Symbol (bleibt, eigener Schritt bei Bedarf).

## Acceptance criteria
- [x] Hintergrund ist auf allen Zielen reines Schwarz, Flächen, Linien, Akzent, Grün und Amber haben die Werte des Logbuchs.
- [x] Überschriften und große Zahlen in Barlow Condensed fett, Fließtext in Barlow. Die Schrift lädt auch offline.
- [x] Karten mit 1 px Rand und Radius 12 px, ohne Schatten. Gewählte Kapseln und Segmente invertiert wie die Tagesknöpfe im Logbuch.
- [x] Diagramme lesbar auf Schwarz, keine Farbe mehr aus der alten Palette (Prüfung per Suche nach den alten Hexwerten).
- [x] Kontrast Text zu Hintergrund mindestens 4,5 zu 1, Tippflächen mindestens 44 px.
- [ ] Nebeneinander bei 375 px: Dashboard Training und Logbuch wirken gleich (Farben, Schrift, Karten, Kapseln). Vergleichsbilder liegen dem Abschluss bei.
- [x] Keine Aussage, kein Wert und keine Verweigerung verschwindet oder ändert sich (bestehende Tests grün, Sichtprüfung je Ziel).
- [x] Tests, Lint, Typprüfung und Build grün. CSS bleibt unter 8 kB gzip. Geprüft bei 375 px und 1280 px, kein waagerechter Seitenlauf.

## Implementation plan
Phase 19.0: Diese Spec freigeben, Open questions beantworten, bei Entscheidung 2 ADR 0009 (Schrift).
Phase 19.1: Tokens und Schrift. Palette und Schrift umstellen, hellen Modus entfernen (je nach Entscheidung 1), `COLORS` prüfen. Danach sieht schon alles weitgehend richtig aus.
Phase 19.2: Bausteine. Karten, Kapseln, Segmente, Navigation, Knöpfe, Felder, Fortschrittsbalken wie im Logbuch. Alte Regeln löschen statt nur zu überschreiben, damit das CSS unter der Grenze bleibt.
Phase 19.3: Ziel für Ziel Feinschliff mit Vergleich zum Logbuch bei 375 px: Training, Heute, Woche, Küche, Einstellungen. Je Ziel ein Commit.
Phase 19.4: `DESIGN.md` neu, Retro, Freigabe zum Merge, Live Prüfung am Handy.

## Entscheidungen (05.11.2026)
1. Nur dunkel, heller Modus entfällt.
2. Barlow und Barlow Condensed selbst mitgeliefert unter `public/fonts/`, ADR 0009.
3. Orange ersetzt Blau als einzige Akzentfarbe.
4. Kochansicht im gleichen Look.

## Open questions (Entwurf, beantwortet)
1. Nur dunkel? Das Logbuch kennt nur OLED Schwarz. „Genau gleich“ heißt: heller Modus entfällt, auch wenn das Handy hell eingestellt ist. Nachteil: draußen in der Sonne schlechter lesbar. Vorschlag: nur dunkel, wie das Logbuch.
2. Schrift: Das Logbuch lädt Barlow von Google Fonts. Fürs Dashboard schlage ich vor, die Schriftdateien selbst mitzuliefern (`public/fonts/`, Lizenz OFL, etwa 60 kB, vom Service Worker vorgehalten). Gewinn: funktioniert offline, CSP bleibt streng, keine Anfrage an Google. Kosten: einmal etwa 60 kB mehr beim ersten Laden. Alternative: wie das Logbuch von Google Fonts, dann CSP um zwei Hosts erweitern und offline fällt die Schrift auf Arial zurück.
3. Akzentfarbe: Im Logbuch heißt Orange „Fortschritt und das Nächste“. Im Dashboard ist Blau heute die Farbe für Bedienung und Prognose. Vorschlag: Orange übernimmt beides, Blau entfällt.
4. Kochansicht: Sie hat große Zeitanzeigen und läuft beim Kochen in der Küche. Vorschlag: gleicher Look, Zeitanzeige in Barlow Condensed wie der Pausentimer im Logbuch.
