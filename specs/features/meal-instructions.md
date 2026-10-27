# Phase 16: Zubereitung je Gericht

Status: freigegeben 27.10.2026.

## Goal

Jedes Gericht zeigt beim Aufklappen seiner Mahlzeitkarte Zutaten mit Mengen und
die Zubereitung in kurzen Schritten, damit klar ist, wie es gekocht wird.

## Scope

In scope:

* Feld `steps` je Gericht in `data/meals.json`: drei bis sechs Schritte, je
  Schritt Text, Geraet, Minuten und Temperatur, wo sie gelten
* Ausfuehrlichere Prep Schritte in `data/recipes.json` (Sonntag, Mittwoch):
  gleiche Form, Halte und Timer der Kochansicht bleiben wie sie sind
* Mahlzeitkarte in `Kueche` `Heute` und `Woche`: Tippen klappt Zutaten mit
  Grammzahl und die Schritte auf, nochmal Tippen klappt zu
* Gerichte aus einem generierten Plan (Phase 9) ohne eigene Schritte zeigen
  Zutaten und eine Basiszeile `Zubereitung 0 von 1`
* Texte entwirft Claude aus Zutaten, Mengen und den Geraeten (Mikrowelle,
  Airfryer, OptiGrill), der Nutzer prueft sie vor dem Push

Out of scope:

* Timer je Gericht, eigene Kochansicht je Gericht
* Bilder, Naehrwerte je Schritt, Portionsrechner
* Anweisungen im Plan Generator erzeugen lassen

## Entscheidungen (27.10.2026)

* Ort: aufklappbare Mahlzeitkarte. Tradeoff: kein Timer, dafuer kein neuer
  Bildschirm und kein neuer Chunk
* Inhalt: Claude schreibt, Nutzer prueft. Tradeoff: die Texte sind Vorschlaege
  ohne Vorlage des Trainers. Garzeiten und Temperaturen gelten als Richtwert
* Detail: drei bis sechs Schritte mit Geraet, Zeit, Temperatur
* Prep Schritte werden mit ausfuehrlicher

## Acceptance criteria

* [x] Alle zehn Gerichte in `data/meals.json` haben drei bis sechs Schritte,
      ausser `Riegel-Option` mit einem Schritt (Annahme 27.10.2026)
* [x] Jeder Schritt nennt nur Zutaten, die das Gericht auch hat
* [x] Alle zehn Prep Schritte haben ausfuehrlichere Texte, die Kochansicht
      laeuft unveraendert (Timer, Halte, Mise en place)
* [x] Die Karte klappt in `Heute` und `Woche` auf und zu, Zutaten mit Gramm
      aus dem aktiven Plan, nicht aus dem Seed
* [x] Ein Gericht ohne Schritte zeigt `Zubereitung 0 von 1`, keinen Fehler
* [x] Texte gehen per `textContent` ins DOM
* [x] Datenpruefung als Test: jedes Gericht hat Schritte, jede genannte Zutat
      gehoert zum Gericht (ueber eine Liste der Zutaten je Schritt)
* [x] 375 px ohne waagerechten Seitenlauf
* [x] Nutzer hat die Texte gelesen und freigegeben

## Implementation plan

* 16.1 Texte: Entwurf der Schritte fuer zehn Gerichte und zehn Prep Schritte
  als Tabelle zur Pruefung durch den Nutzer
* 16.2 Daten und Typen: `steps` in `meals.json`, Parser, Datentest
* 16.3 Oberflaeche: Mahlzeitkarte aufklappbar, Pruefung bei 375 px
* 16.4 Push nach Freigabe, Retro

## Open questions

* Keine

## Stand 16.2 und 16.3

Gebaut:

* `MealStep` und optionales `steps` am Typ `Meal`. `parseMealSteps` in `src/nutrition/plan.ts` wirft kaputte Eintraege weg, ein fehlendes Feld ergibt keine Schritte. Der Seed wird beim Laden darueber geleitet.
* `exportMeal` behaelt `steps`, wenn vorhanden. Vorschlaege der KI haben keine Schritte und bleiben gueltig, der Seed Roundtrip ist zeichengleich.
* Datentest `test/meal-steps.test.ts`: Schrittzahl, Zutaten je Schritt gehoeren zum Gericht, Text nicht leer, dazu Parsertests.
* Oberflaeche `src/ui/plan.ts`: In `Heute` zeigt die bestehende aufklappbare Karte jetzt Zutaten und darunter die Schritte als nummerierte Liste mit Tags fuer Geraet, `8 min`, `200 °C`. In `Woche` ist die Slot Nummer ein Knopf (`aria-expanded`), der Zutaten und Schritte unter der Zeile aufklappt. Auswahl und Riegel Schalter bleiben ausserhalb des Knopfes. Offen Zustand liegt im Modulzustand `openMeals` und wird von beiden Ansichten geteilt.
* Ohne Schritte steht die Basiszeile `Zubereitung 0 von 1`.

Annahmen:

* Zutaten und Gramm kommen aus dem aktiven Plan (`planned.ingredients`), Schritte aus dem aktiven Gericht, nicht aus dem Seed.
* Die Spalte `Woche` hatte keine Aufklappkarte, daher der Knopf an der Slot Nummer statt einer ganzen Karte als Tippflaeche.
* Kein eigener Plan Chunk vorhanden, `plan.ts` liegt im Hauptchunk. Pruefung bei 375 px erledigt 27.10.2026, Texte vom Nutzer freigegeben 27.10.2026.
