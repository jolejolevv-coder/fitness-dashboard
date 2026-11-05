---
name: Body Recomp
description: Recomp Logbuch. OLED Schwarz, Haarlinien, Orange als einzige Akzentfarbe, Barlow Condensed in Grossbuchstaben.
colors:
  board: "#000000"
  card: "#0d0f11"
  card-sunk: "#000000"
  rail: "#0d0f11"
  rail-edge: "#252a30"
  ink: "#eef1f3"
  ink-2: "#9ba5ae"
  ink-3: "#8a949d"
  accent: "#ff6b2c"
  accent-ink: "#160800"
  accent-wash: "#2a1206"
  red: "#ff7a6e"
  red-wash: "#2a1210"
  green: "#5fd47a"
  green-wash: "#0b2213"
  warn: "#ffc65c"
  warn-wash: "#1c1606"
  tape: "#eef1f3"
typography:
  display:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"
    fontSize: "60px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    textTransform: "uppercase"
  title:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.03em"
    textTransform: "uppercase"
  value:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  label:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
    textTransform: "uppercase"
  body:
    fontFamily: "'Barlow', -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  body-strong:
    fontFamily: "'Barlow', -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
  caption:
    fontFamily: "'Barlow', -apple-system, 'Segoe UI', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  card: "12px"
  control: "8px"
  tag: "4px"
spacing:
  tap: "44px"
  field: "52px"
---
# Design System: Body Recomp

## Overview

**Creative North Star: "Das Recomp Logbuch"**

Das Dashboard sieht aus wie das Recomp Logbuch (`gym-logbook`), damit beide Seiten wie aus einem Guss wirken. Grund ist reines Schwarz fuer OLED, Flaechen heben sich kaum davon ab und werden von einer Haarlinie begrenzt statt von einem Schatten. Orange ist die einzige Akzentfarbe und heisst Bedienung, Fortschritt und das Naechste. Ueberschriften, Zahlen und Bedienelemente stehen in Barlow Condensed, fett und in Grossbuchstaben, Fliesstext in Barlow.

Es gibt nur das dunkle Schema, unabhaengig von der Systemeinstellung (Spec 19, Entscheidung 1). Es gibt keine Erklaertexte: Zahl und Datenbasis, sonst nichts.

Abgeloest wurde der Look „Trainerboard“ (Emaille, Blau, SF Pro Rounded, Schatten). Er steht in der Git Historie bis Commit `b598654`.

**Key Characteristics:**
* Eine Zahl je Karte, darunter klein die Datenbasis
* OLED Schwarz, Karten `#0d0f11` mit 1 px Rand `#252a30`, Radius 12 px
* Orange fuer Bedienung und Fortschritt, Gruen fuer getroffen, Rot fuer daneben, Amber fuer Warnung
* Gewaehlte Segmente und Kapseln invertiert, hell auf schwarz wie die Tagesknoepfe im Logbuch
* Schrift selbst mitgeliefert unter `public/fonts/` (ADR 0009), laedt auch offline

## Colors

Jedes Token existiert als CSS Custom Property auf `:root` in `src/styles.css`. Komponenten referenzieren immer die Custom Property, nie einen Hexwert. `color-scheme: dark` ist fest gesetzt.

### Akzent
* **Orange** (`accent`): aktives Navigationsziel, Hauptaktion, Fortschrittsbalken, Markierung der laufenden Zeile, Prognoselinie und Bedienung in Diagrammen. `--magnet` ist ein Alias.
* **Orange Tinte** (`accent-ink`): Schrift auf orangem Grund.
* **Orange Spur** (`accent-wash`): Druckzustand der Textknoepfe.

### Bedeutung
* **Gruen** (`green`): getroffen. Abweichung im Ziel, Progression, Angebot, abgehakt.
* **Rot** (`red`): daneben. Abweichung ausserhalb des Ziels, Fehler.
* **Amber** (`warn`): Warnung, etwa unplausible Werte.
* **Spuren** (`green-wash`, `red-wash`, `warn-wash`): nur als Grund einer Markierung.

### Neutral
* **Schwarz** (`board`, `card-sunk`): Grund jeder Ansicht und eingelassener Felder.
* **Flaeche** (`card`, `rail`): Karten, Listen, Kapseln, Navigation.
* **Haarlinie** (`rail-edge`): Rand jeder Flaeche, Trenner in Listen, Bahn des Fortschrittsbalkens.
* **Tinte** (`ink`): Daten und Text. Gewaehlte Kapseln haben `ink` als Grund.
* **Zweite und dritte Tinte** (`ink-2`, `ink-3`): Bezeichnungen, Einheiten, Datenbasis, Achsen.
* **Klebeband** (`tape`): Zielmarke auf dem Fortschrittsbalken.

### Named Rules
**The Accent Rule.** Orange heisst Bedienung und Fortschritt, gruen getroffen, rot daneben, amber Warnung. Keine Farbe traegt eine zweite Bedeutung.

**The Readable Basis Rule.** Text mit Aussage erreicht mindestens 4,5 zu 1. `ink-3` auf `card` liegt bei etwa 6 zu 1, Orange Tinte auf Orange deutlich darueber.

**The Canvas Rule.** Diagramme lesen ihre Farben zur Zeichenzeit ueber `COLORS` (`src/ui/palette.ts`) aus denselben Custom Properties. Die Datenlinie ist helle Tinte mit Transparenz, Prognose und Bedienung orange. Ausnahme bleiben die Muskelgruppen im Volumendiagramm mit fester Tonreihe.

## Typography

**Display:** Barlow Condensed 500, 600, 700. **Text:** Barlow 400, 500, 600. Beide als woff2, nur lateinische Untermenge, vom Service Worker vorgehalten.

### Hierarchy
* **Seitentitel** (`headline`): obere Leiste und Einstellungen, Grossbuchstaben.
* **Gruppentitel** (`title`): Abschnitte innerhalb eines Ziels.
* **Grosse Zahl** (`display`): Hauptzahl von Heute. Kartenwerte als `value`.
* **Bezeichnung** (`label`): Kartenkopf, Gruppenlabel, Segmente, Kapseln, Knoepfe, Navigation.
* **Uebungs und Gerichtname** (`body-strong`): hell, nicht als Etikett.
* **Datenbasis** (`caption`): in `ink-3`.

### Named Rules
**The Tabular Rule.** Alle Zahlen mit festen Ziffernbreiten (`tnum`), damit nichts springt.

## Layout

Einspaltig bis Tablet, ab Desktop Seitenleiste fuer die Navigation und Kartenraster. Seitenrand 16 px. Kein waagerechter Seitenlauf bei 375 px und 1280 px. Lange Segmentleisten scrollen in sich.

## Elevation & Depth

Keine Schatten. Tiefe entsteht nur aus Flaeche gegen Schwarz und der Haarlinie. Die einzige Innenkante ist die orange Markierung links an der laufenden Zeile.

## Shapes

Karten und Listen 12 px (`--radius`), Bedienelemente und Felder 8 px (`--radius-s`), Markierungen 4 px wie die Tags im Logbuch.

## Components

### Karte
Flaeche `card`, 1 px `rail-edge`, Radius 12 px. Kopf als `label`, Wert als `value`, Datenbasis als `caption`.

### Verweigerung
Gestrichelter Rand in `rail-edge`, Text `Basis x von y Tagen`, keine Erklaerung.

### Markierung
Radius 4 px, Condensed Grossbuchstaben, Punkt in der Textfarbe, Grund aus der passenden Spur.

### Fortschrittsbalken
6 px hoch, Bahn `rail-edge`, Fuellung orange, Zielmarke als Klebeband.

### Segmentleiste und Kapseln
Einzelne Rahmenknoepfe mit 6 px Abstand, Grund `card`, Rand `rail-edge`, Condensed 16 bis 17 px in Grossbuchstaben. Gewaehlt: Grund `ink`, Schrift `board`. Kein gleitender Puck mehr.

### Navigation
Leiste unten, auf Desktop links. Symbol plus Condensed Bezeichnung in Grossbuchstaben, aktiv orange mit Punkt.

### Liste
Eine Karte, Zeilen durch Haarlinien getrennt. Laufende Zeile mit 3 px orangem Innenrand links.

### Hauptaktion
Grund orange, Schrift `accent-ink`, 52 px hoch, Radius 8 px, Condensed 19 px in Grossbuchstaben. Eine je Ansicht.

### Felder
Grund schwarz, 1 px `rail-edge`, Radius 8 px, Fokus mit 2 px orangem Umriss. Lastfelder beim Eintragen 52 px hoch in Condensed 22 px.

### Kochansicht
Gleicher Look, Zeitanzeige in Condensed 40 px wie der Pausentimer im Logbuch.

## Do's and Don'ts

### Do:
* Farben nur ueber Custom Properties, nie als Hexwert in Komponenten
* Haarlinie statt Schatten, Abstand statt Schmuck
* Inhalte aus dem Sheet per `textContent`

### Don't:
* Keinen hellen Modus und keine zweite Akzentfarbe einfuehren
* Keine Webfonts von fremden Hosts laden, die CSP bleibt bei `font-src 'self'`
* Keine Erklaertexte in der Oberflaeche
