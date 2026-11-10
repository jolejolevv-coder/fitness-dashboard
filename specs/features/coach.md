# Trainer als Zweitmeinung (Phase 21)

Status: freigegeben und umgesetzt am 10.11.2026 (21.0 bis 21.6), nicht committet. Offen: Tab `Body` anlegen, Pruefung mit echten Daten.

## Goal

Ein deterministisches Regelwerk im Dashboard rechnet aus den eigenen Daten eine
Zweitmeinung mit Zahlen zu Phase, Kalorien, Makros je Tagestyp, Training und
Erholung und stellt sie neben die Vorgabe des Personal Trainers, damit
Abweichungen frueh und belegt angesprochen werden koennen.

## Warum

Bisher zeigt `src/ui/coach.ts` hoechstens drei Beobachtungen und macht bewusst
keine Gegenvorschlaege. Der Nutzer hat am 10.11.2026 entschieden, dass er
konkrete Zahlen als Zweitmeinung will. Die Entscheidung bleibt beim Trainer,
die Zweitmeinung ist Gespraechsgrundlage, keine Anordnung.

## Entscheidungen des Nutzers (10.11.2026)

* Form: Regelwerk im Dashboard, kein LLM Chat
* Rolle: Zweitmeinung mit Zahlen neben der Vorgabe des Trainers
* Daten: Sheet Daten, weitere Transkripte, Koerperdaten und Fotos, Vorgaben des Trainers als Vergleichsbasis
* Themen: Phase und Kalorien, Carb Cycling Makros, Training, Schlaf und Erholung

## Scope

In scope:

* Regelkatalog `docs/coach-regeln.md` in eigenen Worten, jede Regel mit Kennung,
  Parametern und Quelle (Titel des Videos, kein Zitat)
* Reine Funktionen unter `src/coach/`, ohne DOM, getestet gegen synthetische
  Verlaeufe mit bekanntem Ergebnis
* Vier Regelgruppen: Phase und Kalorien, Makros je Tagestyp, Training, Erholung
* Koerperdaten (Koerperfett geschaetzt, Taillenumfang) als neue lesende Quelle
* Bereich `Zweitmeinung` in der bestehenden Ansicht Coach: je Zeile eigene Zahl,
  Vorgabe des Trainers, Differenz, Datenbasis
* Anpassung von `specs/mission.md`, Roadmap Festlegung und `CLAUDE.md`, ADR 0011

Out of scope:

* Peptide, Anabolika, Medikamente, Bezugsquellen. Kommt in keiner Regel vor
* Das Transkript selbst im Repository (oeffentlich, fremder Text)
* LLM Aufrufe fuer den Trainer
* Neuer Schreibweg ins Sheet. Koerperdaten tippt der Nutzer direkt ins Sheet
* Fotos in der App (siehe Open questions 3)
* Lebensmittelwahl, Restaurantregeln, Supplements, Elektrolyte. Der Plangenerator
  aus Phase 9 bleibt unveraendert
* Aenderung oder Loeschung der bestehenden Beobachtungen in `src/ui/coach.ts`

## Regelgruppen

Jede Regel liefert `Insight<T>` aus `src/analytics/result.ts` und verweigert
unter ihrer Mindestdatenlage mit Zahlenzeile.

### A Phase und Kalorien

* A1 Kalorien Zweitmeinung: Mitte der TDEE Spanne (`tdeeRange`) minus Defizit
  aus der Sollrate des Sheets (`rate_of_loss_pct` mal aktuelles Gewicht mal
  `KCAL_PER_KG_BODYMASS` durch 7). Ausgabe: kcal, Vorgabe des Trainers, Differenz
* A2 Stillstand: reagiert erst nach drei Wochen ohne Bewegung im Wochenmittel
  bei erfuellter Compliance. Vorher Zustand `kein Handlungsbedarf`. Bei
  unzureichender Compliance Zustand `Ausfuehrung`, keine Kalorienzahl
* A3 Schrittweite: Vorschlag aendert Kalorien hoechstens um einen festen Schritt
  je Anpassung, nie Kalorien und Schritte gleichzeitig
* A4 FFMI aus Gewicht, Groesse (`M7`) und Koerperfett. Ohne Koerperfett
  verweigert
* A5 Phasenempfehlung aus Koerperfett und FFMI: Cut, Mini Cut, Recomp, Lean
  Bulk, Halten. Grenzen aus dem Regelkatalog (Bulk nie oberhalb der oberen
  Koerperfettgrenze starten, Bulk endet an der Obergrenze)
* A6 Reverse: liegt das Zielgewicht oder die untere Koerperfettgrenze im
  Trend, Ausgabe der Stufenfolge (Sprung auf die Haelfte des Defizits, danach
  Wochenschritt) als Zahlenreihe

### B Makros je Tagestyp

* B1 Protein in g aus g je kg Koerpergewicht, oberes Ende im Defizit
* B2 Fett als Boden in g je kg mit Kappung
* B3 Carbs als Rest aus den Kalorien von A1
* B4 Drei Tagestypen Low (Ruhetag), Medium (Trainingstag), High (ein Tag je
  Woche im Cut, zwei im Aufbau). Low ist fest, der Rest der Woche geht in die
  Carbs der Trainingstage, der High Day bekommt das Doppelte eines Medium Day.
  Der Wochenschnitt der Kalorien entspricht exakt A1. Tagestyp aus `Trainingday` und dem Tab `Plan`, High Day ist der
  Plantag mit den meisten Saetzen
* B5 Vergleich je Tagestyp gegen die Zeilen 19, 21 und 23 des Vorgabeblocks

### C Training

Quelle `TrainingSets` aus dem Gym Logbuch.

* C1 Frequenz je Muskelgruppe in den letzten vier Wochen gegen zweimal pro Woche
* C2 Progression je Uebung: Anzahl Einheiten ohne Zuwachs bei Last oder
  Wiederholungen (geschaetztes 1RM nach `epley1RM`)
* C3 Wochensaetze je Muskelgruppe als Zahl, markiert unter der Untergrenze
* C4 Deload Signal: Rueckgang in mehreren Uebungen gleichzeitig zusammen mit
  Erholungssignal aus D3. Kein vorgeplanter Deload

### D Schlaf und Erholung

* D1 Schlafdauer als 7 Tage Mittel gegen den Korridor
* D2 Streuung der Schlafdauer als Mass fuer Regelmaessigkeit
* D3 Erholungssignal: Schlaf unter Korridor, Energylevel fallend und C2 mit
  Rueckgang treffen zusammen. Ausgabe als Zustand mit den drei Zahlen

## Daten

* Vorhanden: `Daily Tracking` (Gewicht, Makros, Schlaf, Qualitaet, Stress,
  Energylevel, Steps, Trainingday), Vorgabeblock, `H3`, `M4`, `M7`,
  `TrainingSets`, `Plan`
* Neu: Tab `Body` in der Tabelle `Gym Logbuch` (gehoert dem Nutzer, nicht dem
  Trainer) mit den Kopfzeilen `date`, `bodyfat_pct`, `waist_cm`, `note`.
  Zuordnung ueber Kopfzeilen, fehlende Spalte erzeugt eine sichtbare Meldung.
  Fehlt der Tab, verweigern nur A4 bis A6, der Rest laeuft
* Koerperfett ist eine Schaetzung. A4 bis A6 zeigen das Datum der Messung als
  Datenbasis und verweigern, wenn die Messung aelter als die Hoechstdauer ist

## Regelparameter

Schwellen und Faktoren der Regeln stehen an genau einer Stelle,
`src/config/coachRules.ts`, als benannte Konstanten mit Kennung der Regel. Im
Berechnungscode steht kein Literal. Persoenliche Zielwerte kommen weiter aus
dem Sheet. Begruendung und Alternative (Tab im Sheet) in ADR 0011.

## Darstellung

Keine Fliesstexte. Je Zeile: Bezeichner, Zweitmeinung, Vorgabe, Differenz,
Datenbasis, Kennung der Regel (etwa `A1`). Die Kennung verweist auf
`docs/coach-regeln.md`, dort steht die Herleitung. Ueberschrift des Bereichs
`Zweitmeinung`. Sheet Inhalte nur per `textContent`. Verbindlich bei 375 px.

## Acceptance criteria

- [x] `docs/coach-regeln.md` enthaelt jede Regel A1 bis D3 mit Kennung, Formel, Parametern, Mindestdatenlage und Quelle, ohne woertliche Passagen aus dem Transkript und ohne Inhalte zu Peptiden oder Anabolika
- [x] `specs/mission.md`, die Festlegung in `specs/roadmap.md` und `CLAUDE.md` nennen die Zweitmeinung als erlaubte Ausnahme, ADR 0011 liegt vor
- [x] Jede Regel ist eine reine Funktion unter `src/coach/` ohne DOM Zugriff und liefert `Insight<T>`
- [x] Jede Regel hat Tests gegen synthetische Verlaeufe mit bekanntem Ergebnis, dazu je einen Test fuer die Verweigerung unter der Mindestdatenlage
- [x] Ein Test belegt, dass unter `src/coach/` ausserhalb von `src/config/coachRules.ts` keine Zahlenliterale fuer Schwellen stehen
- [x] A1 stimmt fuer einen synthetischen Verlauf mit bekanntem TDEE auf 1 kcal
- [x] B4: der Wochenschnitt der drei Tagestypen weicht hoechstens 1 kcal von A1 ab, Protein und Fett unterschreiten ihre Boeden an keinem Tagestyp
- [x] A2 gibt in den ersten drei Wochen eines Stillstands keinen Kalorienvorschlag aus und unterscheidet Plateau von Ausfuehrung
- [x] A4 bis A6 verweigern ohne Tab `Body` oder bei veralteter Messung mit Zahlenzeile, alle anderen Regeln laufen weiter
- [x] C1 bis C4 laufen auf dem Fixture von `TrainingSets`, eine fehlende Spalte erzeugt eine sichtbare Meldung
- [x] Die Ansicht zeigt je Zeile Zweitmeinung, Vorgabe des Trainers, Differenz, Datenbasis und Kennung, keinen Erklaertext
- [x] `test/no-innerhtml.test.ts` und alle Golden Values bleiben gruen, die bestehenden Beobachtungen sind unveraendert
- [x] Layout bei 375 px ohne horizontales Scrollen geprueft
- [x] Kein neuer Schreibweg, kein Schluessel, keine persoenlichen Werte im Repository

## Implementation plan

Phase 21.0 Grundlage: Regelkatalog `docs/coach-regeln.md`, ADR 0011, Anpassung
von Mission, Roadmap und `CLAUDE.md`, `src/config/coachRules.ts`. Kein
Verhalten in der App.

Phase 21.1 Koerperdaten: Parser `src/parse/body.ts` fuer den Tab `Body`,
Fixture, FFMI (A4). Nutzer legt den Tab an.

Phase 21.2 Phase und Kalorien: A1 bis A3, A5, A6 mit Tests.

Phase 21.3 Makros je Tagestyp: B1 bis B5 mit Tests.

Phase 21.4 Training: C1 bis C4 mit Tests.

Phase 21.5 Erholung: D1 bis D3 mit Tests.

Phase 21.6 Oberflaeche: Bereich `Zweitmeinung` in der Ansicht Coach, Pruefung
bei 375 px, Doku, Retro.

Jede Teilphase endet lauffaehig und getestet. Die Regeln aus weiteren
Transkripten kommen ueber denselben Weg: Nutzer liefert den Text, daraus
entstehen neue oder geaenderte Eintraege im Regelkatalog mit Quelle,
Widersprueche zwischen Quellen entscheidet der Nutzer, erst danach Code.

## Tradeoffs

* Regelwerk statt LLM: pruefbar und kostenlos, aber starr. Jede neue Quelle
  kostet eine Katalogaenderung und einen Deploy
* Parameter im Code statt im Sheet: versioniert und getestet, aber nicht ohne
  Deploy aenderbar. Der Trainer sieht sie nicht
* Tab `Body` von Hand gepflegt: kein neuer Schreibweg, dafuer Handarbeit und
  das Risiko veralteter Werte, das die Hoechstdauer abfaengt
* Zweitmeinung aus einer einzigen Quelle ist eine Lehrmeinung, kein Konsens.
  Die Quelle steht deshalb an jeder Regel

## Open questions

1. Name des Bereichs: `Zweitmeinung` (Annahme) oder `Trainer`
2. Parameter in `src/config/coachRules.ts` (Annahme) oder in einem Tab `CoachRules` im Gym Logbuch
3. Fotos: Annahme ist ausserhalb der App, weil das Regelwerk Bilder nicht auswerten kann und das Repository oeffentlich ist. Alternative waere eine spaetere Phase mit Fotos nur lokal im Geraet
4. Koerperfett: Annahme ist eine eigene Schaetzung nach Sichtmerkmalen, eingetragen im Tab `Body`. Liegt eine DEXA oder Calipermessung vor
5. High Day: Annahme ist der Plantag mit den meisten Saetzen. Alternative ist ein fester Wochentag in den Einstellungen
6. Welche weiteren Transkripte kommen, und sollen sie vor Phase 21.2 in den Katalog oder danach
7. Erledigt am 10.11.2026 auf Entscheidung des Nutzers: der TDEE Schaetzer (`src/analytics/tdee.ts`) teilt jetzt durch die Tage zwischen den Mitten der Randmittel statt durch die volle Fensterlaenge. Vorher lag er bei linearem Verlust zu tief (2565 statt 2685 kcal im Testverlauf, im 14 Tage Fenster fehlte die halbe Bilanz). Die Kachel Erhaltungsbedarf steigt dadurch bei laufender Abnahme. `test/phase4.test.ts` angepasst
8. Platz des Bereichs: Annahme direkt unter Insights, vor Tagesdurchschnitt (`test/today.test.ts` angepasst)

## Annahmen der Umsetzung

* Der Plan fuer den Namen des High Day kommt aus dem Plan Cache des Logbuchs. Wurde das Logbuch auf dem Geraet nie geoeffnet, fehlt nur der Name
* Der Tab `Body` wird nach dem Hauptabruf nachgeladen und nicht gecacht. Ohne Netz verweigern A4 und A5
* Aufbauphase (zwei High Days, Protein am unteren Ende) gilt nur, wenn A5 `Lean Bulk` ergibt
* A2 misst die Compliance an den Kalorien mit Toleranz `KCAL_TOLERANCE_PCT`, nicht am Protein wie die bestehende Plateau Kachel
* C1 und C3 rechnen auf dem Wochenmodell von `parseTrainingSets` (Saetze der Einheit mit dem schwersten Satz je Woche)
* Retro Phase 21 offen, wird mit dem Nutzer aus echter Nutzung geschrieben
