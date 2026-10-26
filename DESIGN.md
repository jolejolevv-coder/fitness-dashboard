---
name: Body Recomp
description: Trainerboard. Magnetkarten mit je einer Zahl auf ruhiger Emaille, dunkel als Schiefertafel.
colors:
  board: "#eceeed"
  card: "#fbfcfb"
  card-sunk: "#f1f3f2"
  rail: "#dfe3e2"
  rail-edge: "#c9cfcd"
  ink: "#1b1e20"
  ink-2: "#555c60"
  ink-3: "#848b8f"
  blue: "#1d5fc4"
  blue-wash: "#e3ecf9"
  red: "#c4372d"
  red-wash: "#f8e6e4"
  green: "#1d7f48"
  green-wash: "#e2f1e8"
  tape: "#2a2f33"
  board-dark: "#181b1d"
  card-dark: "#24292c"
  card-sunk-dark: "#1e2225"
  rail-dark: "#2b3034"
  rail-edge-dark: "#3a4044"
  ink-dark: "#eef1f0"
  ink-2-dark: "#aab2b5"
  ink-3-dark: "#7c8488"
  blue-dark: "#6aa3ff"
  blue-wash-dark: "#1d2b40"
  red-dark: "#ff7a6e"
  red-wash-dark: "#3a2422"
  green-dark: "#5fd394"
  green-wash-dark: "#1b3326"
  tape-dark: "#d6dbd9"
typography:
  display:
    fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif"
    fontSize: "54px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  headline:
    fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  title:
    fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  value-sm:
    fontFamily: "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  body:
    fontFamily: "system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  body-strong:
    fontFamily: "system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
  label:
    fontFamily: "system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  nav:
    fontFamily: "system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  bar: "4px"
  inset: "8px"
  puck: "9px"
  field: "10px"
  control: "12px"
  card: "14px"
  pill: "999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  xl: "26px"
  tap: "44px"
  row: "64px"
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "14px 16px 15px"
  metric-number:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
  metric-number-hero:
    textColor: "{colors.ink}"
    typography: "{typography.display}"
  metric-basis:
    textColor: "{colors.ink-3}"
    typography: "{typography.caption}"
  refusal-gap:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.inset}"
    padding: "6px 8px"
    height: "34px"
  mark-off:
    backgroundColor: "{colors.red-wash}"
    textColor: "{colors.red}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 9px 3px 7px"
  mark-ok:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.green}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 9px 3px 7px"
  top-bar:
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    height: "52px"
  icon-button:
    textColor: "{colors.blue}"
    rounded: "{rounded.control}"
    size: "44px"
  icon-button-active:
    backgroundColor: "{colors.blue-wash}"
    textColor: "{colors.blue}"
  segment:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "3px"
  segment-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.puck}"
    padding: "0 12px"
    height: "38px"
  segment-puck:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.puck}"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
  nav:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.ink-3}"
    typography: "{typography.nav}"
    padding: "6px 8px 30px"
  nav-item-active:
    textColor: "{colors.blue}"
    height: "54px"
  list:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    padding: "12px 16px"
    height: "64px"
  pick-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.blue}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.card}"
    height: "52px"
    width: "100%"
  progress-bar:
    backgroundColor: "{colors.card-sunk}"
    rounded: "{rounded.bar}"
    height: "8px"
---

# Design System: Body Recomp

## Overview

**Creative North Star: "Das Trainerboard"**

Die App ist die Tafel im Studio und am Kuehlschrank. Eine ruhige Emailleflaeche traegt Magnetkarten, jede mit genau einer Zahl und ihrer Datenbasis darunter. Der Alurahmen der Tafel ist die Navigation, ein blauer Magnet markiert das Aktive. Hell ist Emaille, dunkel ist Schiefer; das System des Geraets entscheidet ueber `prefers-color-scheme`.

Die Dichte ist die eines Whiteboards, nicht die einer Tabelle. Gruppiert wird ueber Abstand und Flaechen, nie ueber Trennlinien zwischen Zeilen. Farbe ist Markerfarbe mit fester Bedeutung, kein Schmuck. Ziffern sind rund und tabellarisch, damit nichts springt, wenn sich ein Wert aendert. Es gibt keine Erklaertexte: Zahl und Datenbasis, sonst nichts.

Verworfen wurden der Laborbefund (eine Tabelle, genau der Look, der weg soll) und ein Nachbau von iOS Health (vertraut, aber ohne eigene Handschrift).

**Key Characteristics:**
- Eine Zahl je Karte, darunter klein die Datenbasis
- Markerfarben schwarz, blau, rot, gruen mit fester Bedeutung
- Runde Systemziffern, keine Webfonts, kein zusaetzliches Byte
- Ein blauer Magnet je Leiste markiert das Aktive und gleitet per `transform`
- Hell als Grundform, dunkel nach System, jedes Token mit dunklem Gegenstueck

## Colors

Neutrale Emaille und Aluminium mit vier Markerfarben, deren Bedeutung nie wechselt. Jedes Token existiert als CSS Custom Property auf `:root` (`--board`, `--card`, ...) und wird im dunklen Schema unter `@media (prefers-color-scheme: dark)` mit dem Wert des Tokens mit Suffix `-dark` belegt. Komponenten referenzieren immer die Custom Property, nie einen Hexwert.

### Primary
- **Markerblau** (`blue`, dunkel `blue-dark`): Bedienung. Aktives Navigationsziel, Symbolknoepfe der oberen Leiste, Auswahlzeile fuer Gerichte, Prognoselinie im Verlauf. Der Magnet (`--magnet`) ist ein Alias auf dieselbe Farbe und kein eigener Ton.
- **Blaue Spur** (`blue-wash`, dunkel `blue-wash-dark`): Druckzustand der Symbolknoepfe und Textauswahl.

### Secondary
- **Markergruen** (`green`, dunkel `green-dark`): getroffen. Abweichung im Zielbereich, Progression im Training, Angebot im Einkauf, abgehakter Eintrag.
- **Markerrot** (`red`, dunkel `red-dark`): daneben. Abweichung ausserhalb des Ziels, steigende Woche im Wochenbalken.
- **Gruene und rote Spur** (`green-wash`, `red-wash` und ihre dunklen Gegenstuecke): nur als Grund der Markierungskapsel.

### Neutral
- **Emaille** (`board`, dunkel Schiefer `board-dark`): Grund jeder Ansicht, auch die Fuge zwischen Listenzeilen.
- **Magnetkarte** (`card`, dunkel `card-dark`): Flaeche jeder Karte, Liste, Kapsel und des Pucks.
- **Eingelassene Flaeche** (`card-sunk`, dunkel `card-sunk-dark`): Bahn des Fortschrittsbalkens, aufgeklappte Zutaten, Kreis der Mahlzeitennummer.
- **Alurahmen** (`rail`, dunkel `rail-dark`): Navigationsleiste und Segmentleiste.
- **Rahmenkante** (`rail-edge`, dunkel `rail-edge-dark`): obere Kante der Navigation, Innenkante der Segmentleiste, gestrichelter Rand der Verweigerung, Ring der Abhakfelder, Nulllinie im Wochenbalken.
- **Markerschwarz** (`ink`, dunkel `ink-dark`): Daten. Zahlen, Verlaufslinie, Balken, Hauptaktion.
- **Zweite Tinte** (`ink-2`, dunkel `ink-2-dark`): Bezeichnung der Karte, Einheiten, Text der Verweigerung.
- **Dritte Tinte** (`ink-3`, dunkel `ink-3-dark`): Datenbasis, Datenalter, inaktive Navigation, Achsen, Chevron. Offener Befund, siehe Named Rules.
- **Klebeband** (`tape`, dunkel `tape-dark`): Zielmarke auf dem Fortschrittsbalken.

### Named Rules
**The Marker Rule.** Schwarz heisst Daten, blau heisst Bedienung, gruen heisst getroffen, rot heisst daneben. Keine Markerfarbe traegt je eine zweite Bedeutung, und keine Zahl wird blau, nur weil sie wichtig ist.

**The Wash Rule.** Die Spuren (`*-wash`) erscheinen nur hinter einer Markierungskapsel oder als Druckzustand. Eine Karte wird nie flaechig eingefaerbt.

**The Readable Basis Rule.** Text, der eine Aussage traegt, erreicht mindestens 4,5 zu 1 auf seinem Grund. `ink-3` erreicht im Entwurf auf `card` nur rund 3,4 zu 1 (dunkel 3,9 zu 1) und auf `rail` 2,7 zu 1. Das ist ein offener Befund, kein Systemwert: beim Bau wird `ink-3` abgedunkelt (dunkel aufgehellt), bis die Datenbasis und die inaktive Navigation die Schwelle halten.

## Typography

**Display Font:** `ui-rounded` (SF Pro Rounded, Rueckfall `system-ui`)
**Body Font:** `system-ui` (SF Pro Text, Rueckfall Helvetica Neue)

**Character:** Runde Ziffern wie mit dem Marker geschrieben, darunter nuechterne Systemschrift fuer Bezeichnung und Basis. Beide kommen vom Geraet, die App laedt keine Schrift.

### Hierarchy
- **Display** (700, 54px, 1.05, `-0.025em`): die Hauptzahl einer Ansicht, hoechstens eine je Ziel, etwa die Wochenrate oder die Tageskalorien. Einheit in `small` mit 19px.
- **Headline** (700, 30px, 1.05, `-0.01em`): Zahl einer Magnetkarte und Titel der oberen Leiste. Einheit 15px, Gewicht 600, `ink-2`. Ein Wort statt Zahl (Zustand wie `Keins`) steht in 24px.
- **Title** (700, 20px, 1.2): Abschnittsueberschrift zwischen Kartengruppen, ebenso die Zahl rechts in einer Listenzeile.
- **Value Small** (700, 17px): Kalorien einer Mahlzeit, Makrowerte, Preise in 16px.
- **Body Strong** (600, 16px, 1.25): Name einer Mahlzeit oder eines Einkaufspostens; Uebungsnamen in 15px.
- **Body** (400, 15px, 1.4): Beobachtungen und Zutaten.
- **Label** (600, 13px): Bezeichnung oben auf der Karte, Markierungskapsel, Kategorie im Einkauf.
- **Caption** (400, 13px, `tabular-nums`): Datenbasis unter der Zahl, Datenalter, Unterzeile in Listen. Hervorgehobene Werte darin in 600 und `ink-2`.
- **Nav** (600, 11px): Wort unter dem Symbol der Navigation; Achsenbeschriftung in 11px, 500.

### Named Rules
**The Round Numerals Rule.** Jede Zahl steht in `--num` mit `font-variant-numeric: tabular-nums`. Text steht in `--text`. Eine Zahl in Textschrift oder ein Satz in Rundschrift ist ein Fehler.

**The One Number Rule.** Eine Karte traegt eine grosse Zahl. Was sonst gesagt werden muss, steht in der Datenbasis darunter, nie als zweite grosse Zahl daneben.

## Layout

Eine Spalte bei 375px Breite, Seitenrand 16px. Karten stehen im Abstand von 10px, als Einzelkarte oder im zweispaltigen Raster mit 10px Fuge. Abschnitte beginnen mit 26px Abstand nach oben. Unter dem Inhalt bleibt Platz fuer die Navigation (120px Polster am Ende der Scrollflaeche).

Die obere Leiste ist 52px hoch: Titel des Ziels links, rechts Datenalter und Symbolknoepfe. Darunter folgen, wo das Ziel sie hat, die Segmentleiste und eine waagerecht scrollende Reihe von Filterkapseln, die bis an den Bildschirmrand laeuft.

Ab 900px wandert die Navigation laut Spec in eine linke Leiste, Inhalte laufen in bis zu zwei Spalten. Dieselbe Struktur, kein zweiter Codepfad. Im Entwurf ist nur 375px gezeigt; Masse der linken Leiste folgen beim Bau aus denselben Tokens (Alurahmen, Magnet, `nav` Schrift).

Jede Tippflaeche misst mindestens 44px. Listenzeilen sind mindestens 64px hoch.

### Named Rules
**The Space Not Lines Rule.** Zwischen Zeilen und Karten steht Abstand oder Emaille, nie eine Trennlinie. In einer Liste trennt eine 6px breite Fuge in `board` die Zeilen. Kanten gibt es nur am Rahmen (Navigation, Segmentleiste) und als Nulllinie in Diagrammen.

## Elevation & Depth

Zwei Ebenen. Karten, Kapseln und der Puck liegen als Magnete mit einem weichen, kurzen Schatten auf der Tafel. Der Alurahmen ist eingelassen und traegt eine innere Kante oben (`inset 0 1px 0 rail-edge`). Eingelassene Flaechen (`card-sunk`) bilden Bahnen innerhalb einer Karte.

### Shadow Vocabulary
- **Magnet** (`--shadow`, hell `0 1px 1px rgba(27,30,32,0.06), 0 3px 8px rgba(27,30,32,0.07)`, dunkel `0 1px 1px rgba(0,0,0,0.3), 0 3px 8px rgba(0,0,0,0.25)`): jede Karte, Liste, Filterkapsel, Auswahlzeile, der Puck.
- **Rahmenkante innen** (`inset 0 1px 0 var(--rail-edge)`): Segmentleiste.
- **Navigationsmagnet** (`0 1px 2px rgba(0,0,0,0.3)`): nur der kleine Magnetpunkt der Navigation.

### Named Rules
**The Magnet Card Rule.** Eine Flaeche liegt entweder als Magnet auf der Tafel (mit `--shadow`) oder ist in sie eingelassen (ohne Schatten). Ein gewaehlter Filter wird schwarz und verliert seinen Schatten. Es gibt keine dritte, hoehere Ebene im Ruhezustand.

## Shapes

Weich gerundete Rechtecke wie Magnetkarten: Karten und Listen 14px, Segmentleiste und Symbolknoepfe 12px, Puck 9px, Auswahlzeile 10px, Verweigerungsfeld 8px, Balken 4px. Kapseln (Filter, Markierung) sind voll gerundet. Kreise fuer Magnetpunkt (6px), Mahlzeitennummer (34px) und Abhakfeld (26px Ring in 44px Tippflaeche). Symbole sind Linienzeichnungen mit 1.8px Strich, runden Enden und Ecken, 24px gross, in der Navigation 26px. Die Verweigerung hat als einziges Element einen gestrichelten Rand (1.5px).

## Components

### Magnetkarte
Ruhige Flaeche mit einer Zahl.
- **Aufbau:** Bezeichnung (Label, `ink-2`), darunter die Zahl (Headline oder Display) mit kleiner Einheit, darunter die Datenbasis (Caption, `ink-3`), etwa `Basis 14 Tage`.
- **Flaeche:** `card`, Radius 14px, `--shadow`, Polster `14px 16px 15px`.
- **Abweichung:** die Zahl selbst wird `green` oder `red`, oder eine Markierungskapsel mit Punkt steht unter der Basis.

### Verweigerung
Die Karte verweigert die Aussage an der Stelle der Zahl.
- **Stil:** Feld mit 1.5px gestricheltem Rand in `rail-edge`, Radius 8px, mindestens 34px hoch, zentrierter Text in Label, `ink-2`, tabellarische Ziffern. Inhalt ist die Zahlenzeile, etwa `Basis 11 von 14 Tagen`.
- **Darunter:** Caption `keine Aussage`. Keine Erklaerung, kein Symbol.

### Markierungskapsel
- **Stil:** Kapsel mit Spur als Grund und 7px Punkt in Markerfarbe vor dem Text, Label 13px, Polster `3px 9px 3px 7px`.
- **Varianten:** `off` (rot) und `ok` (gruen). Keine blaue oder neutrale Variante.

### Fortschrittsbalken
- **Stil:** 8px Bahn in `card-sunk`, Fuellung in `ink`, Radius 4px. Die Zielmarke ist ein 3px breiter Streifen Klebeband (`tape`), der 4px ueber und unter die Bahn ragt.

### Obere Leiste
- **Stil:** 52px hoch, Titel in Headline, Datenalter in Caption `ink-3` mit tabellarischen Ziffern, rechts Symbolknoepfe Aktualisieren und Einstellungen.
- **Symbolknopf:** 44px, Radius 12px, Symbol in `blue`, gedrueckt mit `blue-wash` als Grund.

### Segmentleiste mit Magnet
Das Signaturelement: ein Puck mit blauem Magnetpunkt gleitet auf dem Alurahmen.
- **Leiste:** `rail`, Radius 12px, Polster 3px, Innenkante oben, waagerecht scrollbar ohne sichtbaren Balken.
- **Eintrag:** mindestens 38px hoch, Polster `0 12px`, 14px 600, `ink-2`, aktiv `ink` mit `aria-current`.
- **Puck:** `card` mit `--shadow`, Radius 9px, rechts oben ein 6px Magnetpunkt in `--magnet`.
- **Bewegung:** `transform: translateX()` mit 240ms und `--ease`; die Textfarbe wechselt in 200ms. Die Breite des Pucks wird beim Wechsel gesetzt, nicht animiert.

### Filterkapseln
- **Ruhe:** `card`, `--shadow`, 36px hoch, Polster `0 14px`, 14px 600, `ink-2`.
- **Gewaehlt:** `ink` als Grund, Text in `card`, ohne Schatten, mit `aria-pressed`.
- **Einsatz:** Zeitraum im Verlauf, Trainingstag im Training. Genau eine gewaehlt.

### Navigation
Der Alurahmen unten, ab 900px links.
- **Stil:** `rail`, obere Kante 1px `rail-edge`, vier gleich breite Ziele mit Symbol (26px) und Wort (Nav, 11px 600).
- **Zustand:** inaktiv `ink-3`, aktiv `blue` mit `aria-current="page"`. Ueber dem aktiven Ziel sitzt ein 6px Magnetpunkt in `--magnet` auf der Kante.
- **Bewegung:** der Magnetpunkt gleitet per `transform`, wie der Puck.

### Liste und Listenzeile
- **Liste:** eine Karte (`card`, 14px, `--shadow`) mit Zeilen, getrennt durch 6px Fugen in `board`.
- **Zeile:** mindestens 64px, Polster `12px 16px`, links Name (Body Strong) und Unterzeile (Caption), rechts die Zahl (Title, rechtsbuendig) mit Basis darunter.
- **Abhakzeile im Einkauf:** links 44px Tippflaeche mit 26px Ring in `rail-edge`, abgehakt gefuellt `green` mit Haken in `card`, Name dann `ink-3` durchgestrichen. Preis rechts in Value Small, Streichpreis darunter 12px `ink-3` durchgestrichen, Angebot in der Unterzeile `green`.

### Mahlzeit zum Aufklappen
- **Kopf:** mindestens 64px, Raster aus Nummernkreis (34px, `card-sunk`, Rundziffern 13px), Name und Protein, Kalorien rechts, Chevron in `ink-3`.
- **Offen:** Chevron dreht in 220ms um 180 Grad, Zutaten auf `card-sunk`, Mengen rechts in `ink-2` mit tabellarischen Ziffern, Gewuerze in 13px `ink-3`.
- **Auswahlzeile:** volle Breite, 44px, `card`, Radius 10px, `--shadow`, Text 14px 600 in `blue`, rechts ein Auf und Ab Symbol.

### Hauptaktion
- **Stil:** volle Breite, 52px, Radius 14px, `ink` als Grund, Text 17px 700 in `card`, Symbol links. Eine je Ansicht, im Entwurf nur `Kochen`.

### Vollbildblatt
Laut Spec oeffnen Einstellungen und Kochansicht als Vollbildblatt. Im Entwurf nicht gezeigt; es liegt als eigene Tafel (`board`) ueber dem Ziel, mit derselben oberen Leiste und Inhalten als Magnetkarten. Masse folgen beim Bau aus den vorhandenen Tokens.

### Named Rules
**The Transform Magnet Rule.** Puck und Navigationsmagnet bewegen sich ausschliesslich ueber `transform`, nie ueber `left` oder `width`. Dauer 240ms mit `--ease` (`cubic-bezier(0.22, 1, 0.36, 1)`). Bei `prefers-reduced-motion: reduce` entfallen alle Uebergaenge.

**The One Magnet Rule.** Je Leiste gibt es genau einen blauen Magneten, und er sitzt auf dem Aktiven. Im Verlauf markiert derselbe Magnet den heutigen Punkt der Linie.

**The Refusal In Place Rule.** Eine Verweigerung steht dort, wo die Zahl stuende, als Zahlenzeile im gestrichelten Feld. Sie rutscht nicht in eine Fussnote und verschwindet nicht.

## Do's and Don'ts

### Do:
- **Do** eine Zahl je Karte setzen, Einheit klein daneben, Datenbasis in Caption darunter, etwa `00,0 kg` ueber `Basis 14 Tage`.
- **Do** jede Farbe ueber die Custom Property beziehen, damit hell und dunkel ohne zweiten Codepfad wechseln.
- **Do** Zahlen in `--num` mit `tabular-nums` setzen, auch in Achsen, Preisen und Datenbasis.
- **Do** Fokus sichtbar halten: 2px Umriss in `blue`, 2px Abstand.
- **Do** Tippflaechen von mindestens 44px und Listenzeilen von mindestens 64px.
- **Do** Navigation mit Symbol und Wort, Aktives mit `aria-current` und Magnet.

### Don't:
- **Don't** Trennlinien zwischen Zeilen oder Karten ziehen, und keine Tabelle als Grundbaustein.
- **Don't** Markerfarben fuer etwas anderes einsetzen als Daten, Bedienung, getroffen und daneben.
- **Don't** Puck oder Magnet ueber `left` oder `width` animieren.
- **Don't** Webfonts laden; Ziffern und Text kommen vom System.
- **Don't** Erklaertexte, Hinweise oder Tooltips mit Erklaerung in die Oberflaeche setzen.
- **Don't** kleine Ueberschriften ueber Abschnittstiteln oder Karten setzen; die Bezeichnung der Karte ist die einzige Zeile ueber der Zahl.
- **Don't** einer Karte einen hoeheren Schatten geben als `--shadow`.
