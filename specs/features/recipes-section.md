# Phase 17: Rezepte statt Prep, Vorschlag ausblenden

Status: freigegeben 27.10.2026, offene Fragen wie vorgeschlagen.

## Goal

Jedes Gericht hat ein vollständiges Rezept von Grund auf, nachschlagbar im
Segment `Rezepte` der Küche, wahlweise für eine Portion oder für die Woche.

## Scope

In scope:

* Segment `Prep` wird `Rezepte` mit zwei Abteilen:
  * `Kochen`: Liste aller Gerichte des aktiven Plans. Tippen öffnet das ganze
    Rezept mit Zutaten, Gramm und Schritten
  * `Vorbereitung`: die bisherige Batch Kochansicht Sonntag und Mittwoch mit
    Timern, Halten und Abhaken, unverändert
* Umschalter je Rezept `1 Portion` und `Woche`. `Woche` rechnet die Gramm
  über alle Vorkommen des Gerichts in der aktiven Woche zusammen und zeigt die
  Zahl der Portionen, etwa `4 Portionen`
* Schritte von Grund auf für die fünf Gerichte, die heute auf die Prep
  verweisen (m1b, m2a, m2b, m3a, m4b): Reis kochen, Hähnchen grillen und so
  weiter, statt `aus der Prep nehmen`. Die anderen fünf bleiben
* Schritttexte ohne feste Mengen, damit sie zu beiden Mengen passen
  (`Haferflocken mit Wasser` statt `mit 200 ml Wasser`). Wasser und ähnliches
  als Verhältnis (`doppelte Menge Wasser`)
* Die Karten in `Heute` und `Woche` zeigen dieselben Schritte wie bisher,
  jetzt ohne Prep Verweise
* Segment `Vorschlag` verschwindet aus der Leiste. Code, Tests und Chunk des
  Generators bleiben und lassen sich wieder einschalten. `#kueche/vorschlag`
  und `#kueche/prep` führen auf `Rezepte`

Out of scope:

* Löschen des Generators
* Neue Gerichte, Bilder, Timer je Gericht
* Garzeiten je Menge umrechnen

## Entscheidungen (27.10.2026)

* Rezepte vollständig, Batch Prep bleibt als eigener Teil. Tradeoff: zwei
  Wege zum selben Essen (frisch kochen oder Vorbereitung), dafür geht beides
* Ort: `Prep` wird `Rezepte`. Tradeoff: ein Segment weniger in der Leiste,
  dafür ist `Vorbereitung` einen Tipp tiefer
* Menge: Auswahl zwischen einer Portion und Woche
* Vorschlag: nur ausgeblendet. Neue Pläne erzeugt der Nutzer mit Claude Code

## Acceptance criteria

* [ ] Die Leiste der Küche zeigt `Heute`, `Woche`, `Rezepte`, `Einkauf`
* [ ] `Rezepte` listet jedes Gericht des aktiven Plans genau einmal
* [ ] Ein Rezept zeigt Zutaten mit Gramm und alle Schritte, kein Schritt
      verweist auf die Prep
* [ ] `1 Portion` zeigt die Gramm einer Portion aus dem aktiven Plan, `Woche`
      die Summe aller Vorkommen und die Zahl der Portionen. Getestet als reine
      Funktion
* [ ] Ein Gericht, das in der Woche nicht vorkommt, zeigt bei `Woche`
      `0 Portionen` und keine Zutaten
* [ ] `Vorbereitung` läuft wie bisher: Timer, Halte, Abhaken, Zurücksetzen
* [ ] `Vorschlag` ist nicht erreichbar, alte Links landen auf `Rezepte`
* [ ] Datentest: keine Zahl mit Einheit g oder ml im Schritttext, jede
      genannte Zutat gehört zum Gericht
* [ ] 375 px ohne waagerechten Seitenlauf, Texte per `textContent`
* [ ] Nutzer hat die neuen Schritte der fünf Gerichte freigegeben

## Implementation plan

* 17.1 Texte: neue Schritte für m1b, m2a, m2b, m3a, m4b und Mengen aus allen
  Schritttexten entfernen, Tabelle zur Freigabe
* 17.2 Logik: Wochensumme je Gericht als reine Funktion mit Tests, Router
  (`rezepte`, Weiterleitung von `prep` und `vorschlag`)
* 17.3 Oberfläche: Segment `Rezepte` mit `Kochen` und `Vorbereitung`,
  Umschalter, Prüfung bei 375 px
* 17.4 Push nach Freigabe, Retro

## Open questions

* Die Zeit Tags der Schritte gelten für eine Portion. Bei `Woche` bleiben sie
  stehen wie bei einer Portion (Vorschlag), weil das Umrechnen von Garzeiten
  geraten wäre
* Abteile `Kochen` und `Vorbereitung` als zwei Chips oben im Segment
  (Vorschlag) oder untereinander auf einer Seite

## Stand

* 17.1 erledigt: fuenf Gerichte von Grund auf, Mengen aus den Schritttexten entfernt
* 17.2 und 17.3 gebaut: `mealUsage` in `src/nutrition/mealUsage.ts` mit Tests, Router mit Weiterleitung, Segment `Rezepte` mit `Kochen` und `Vorbereitung`. Geprueft bei 375 px: Bowl zeigt eine Portion und `3 Portionen` mit dreifachen Gramm, `Vorbereitung` wie bisher, `#kueche/prep` landet auf `Rezepte`
* Annahmen: Chip, Umschalter und offene Karten nur im Modulzustand, Vorgabe `Kochen`. Der Umschalter gilt fuer alle offenen Rezepte. Eine Portion kommt aus dem ersten Vorkommen im Plan. Die Riegel Option ist kein eigener Slot und fehlt deshalb in der Liste
