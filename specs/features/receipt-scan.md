# Phase 14: Kassenbon einlesen

Status: freigegeben 27.10.2026.

## Goal

Ein Foto eines Kassenbons liefert Dauerpreise je Artikel und Markt, damit die
Einkaufsliste echte Regalpreise zeigt statt nur Handzettelpreise.

## Scope

In scope:

* Foto aufnehmen oder aus der Mediathek waehlen, im Segment `Einkauf`
* Auslesen ueber die Anthropic API aus dem Browser, wie der Plan Generator
  (ADR 0004, Key im localStorage), mit strukturierter Antwort: Markt, Datum,
  je Zeile Text, Preis, Menge, Kilopreis falls gedruckt
* Zuordnung jeder Zeile zu einer `food_id` aus `data/shopping_items.json`
  durch das Modell, als Vorschlag
* Pruefansicht: je Zeile Bontext, vorgeschlagener Artikel, Preis, Groesse.
  Zuordnung und Groesse sind aenderbar, Zeilen abwaehlbar. Gespeichert wird
  erst nach Klick
* Gespeicherte Bonpreise gehen als `source: receipt` mit Bondatum in die
  Dauerpreise ein. Es gilt weiter ADR 0003: der juengere Wert gewinnt
* Kosten des Laufs als Zahlenzeile, wie beim Generator

Out of scope:

* Ausgabenverfolgung, Haushaltsbuch, Summen je Monat
* Neue Artikel in `shopping_items.json` anlegen
* Bons anderer Maerkte als Lidl, Aldi Sued, Edeka
* Speichern des Fotos. Das Bild verlaesst das Geraet nur Richtung API und wird
  nicht abgelegt

## Entscheidungen (27.10.2026)

* Speicherort localStorage der App, Schluessel `fitness_receipt_prices_v1`.
  Kein neuer Schreibweg, die harten Regeln bleiben. Tradeoff: Bonpreise gelten
  nur auf diesem Geraet und gehen beim Loeschen der Websitedaten verloren.
  Deshalb ein Knopf `Export`, der die Eintraege als JSON im Format von
  `regular_prices.json` kopiert, damit Claude sie ins Repo uebernimmt. Die
  Einkaufsliste nimmt je Artikel und Markt den juengeren Wert aus Datei und
  localStorage. Verworfen: Sheet Tab ueber das Apps Script (dritter
  Schreibweg) und Commit ueber die GitHub API (Token mit Schreibrecht)
* Modell Sonnet, als Konstante neben den Generator Konstanten
* Ort: Knopf `Bon einlesen` im Segment `Einkauf`, Pruefansicht darunter
* Groesse: aus dem Bontext, wo sie steht, sonst die erste Groesse aus
  `packSizesG` als aenderbarer Vorschlag, bei Stueckware leer

## Acceptance criteria

* [ ] Der Bon vom 27.10.2026 (Aldi Sued, 32 Zeilen) liefert alle 16
      Artikel der Liste mit richtigem Preis, das TK Gemuesesortiment bleibt
      ohne Zuordnung
* [ ] Gewichtsware (`0,342 kg x 1,49 EUR/kg`) ergibt den Kilopreis 1,49, nicht
      den Zeilenbetrag
* [ ] Mehrfach gekaufte Artikel ergeben genau einen Eintrag
* [ ] Ohne Klick auf Speichern aendert sich kein Dauerpreis
* [ ] Ein Bonpreis ersetzt einen gespeicherten Wert nur, wenn das Bondatum
      juenger ist
* [ ] Ein unlesbarer Bon, eine kaputte Antwort oder ein fehlender Key ergibt
      eine Zahlenzeile mit Grund, nie einen stillen Abbruch
* [ ] Bontexte gehen per `textContent` ins DOM
* [ ] Kartennummer, Autorisierungsdaten und Filialadresse werden nicht
      gespeichert, das Schema fragt sie gar nicht ab
* [ ] Die Antwortverarbeitung ist reine Funktion und gegen eine feste
      Beispielantwort getestet

## Implementation plan

* 14.1 Schema und reine Funktionen: Antwortschema, Pruefung, Umrechnung auf
  Kilopreis, Zusammenfuehrung mit vorhandenen Dauerpreisen. Tests
* 14.2 API Aufruf mit Bild, Kostenzeile, Fehlerausgaenge
* 14.3 Oberflaeche im Segment `Einkauf`: Knopf, Pruefansicht, Speichern im
  localStorage, Export
* 14.4 Live Test mit einem echten Bon, Retro

## Open questions

* Keine

## Stand (27.10.2026, 14.1 bis 14.3 gebaut)

Gebaut:

* 14.1 reine Funktionen unter `src/receipt/`: `types.ts`, `schema.ts` (Schema
  ohne Karte, Autorisierung, Adresse), `response.ts` (Pruefung mit Funden und
  Pfad), `prices.ts` (Umrechnung auf Dauerpreise, ein Eintrag je Artikel,
  Zusammenfuehrung mit dem juengeren `seen_at`, Ablage unter
  `fitness_receipt_prices_v1`, Export im Format der `regular_prices.json`).
  Konstanten in `src/config/receipt.ts`. Tests in `test/receipt.test.ts` mit
  der Beispielantwort `test/fixtures/receipt/aldi-2026-10-27.json`
* 14.2 `src/receipt/request.ts`: Bild als Base64 Block, Sonnet, Kostenzeile aus
  `TOKEN_PRICES`, Status fuer fehlenden Schluessel, falschen Bildtyp, SDK, Antwort
  ungueltig, Ablehnung, max_tokens, API Fehler, Offline, Zeitueberschreitung,
  Abbruch
* 14.3 `src/ui/receipt.ts` (eigener Chunk) und Knopf `Bon einlesen` in
  `src/ui/shopping.ts`. Die Einkaufsliste nimmt ueber `priceData.ts` je Artikel
  und Markt den juengeren Wert aus Datei und localStorage

Annahmen:

* Das Foto wird vor dem Senden im Browser auf 2000 px Kantenlaenge verkleinert
  und als JPEG kodiert (API Grenze fuer Bilder, geringere Kosten)
* Das Dateifeld hat kein `capture`, damit iOS Kamera und Mediathek zur Wahl stellt
* Das Kontrollkaestchen je Zeile heisst `Uebernehmen` (angehakt gilt), nicht
  `Auslassen`. Zeilen ohne Zuordnung sind abgewaehlt
* Der Preis je Zeile ist in der Pruefansicht nur Anzeige, aenderbar sind
  Zuordnung, Groesse und Haken. Bei Gewichtsware steht die Groesse fest auf 1000 g
* Bei mehreren Zeilen desselben Artikels gilt der guenstigste Kilopreis, ohne
  Kilopreis der guenstigste Packungspreis
* Gleiches Datum bei Datei und Bon: der Wert der Datei bleibt, nur ein juengeres
  Datum ersetzt
* `Export` kopiert gespeicherte Bonpreise plus die Zeilen der Ansicht und
  speichert dabei nichts
* Die Beispielantwort hat 17 Zeilen (Gemuesesortiment plus 16 Artikel), nicht
  alle 32 Zeilen des Bons
* Die CSP erlaubt `api.anthropic.com` schon (`src/config/csp.ts`)

Offen: 14.4 Live Test mit einem echten Bon im Browser und Retro. Die
Oberflaeche wurde noch nicht im Browser angesehen.
