## Goal

Beweisen, dass die Migration auf TypeScript aus denselben Eingabedaten dieselben
Zahlen erzeugt wie die heutige Fassung, und dass spaetere Aenderungen nichts
still kaputt machen.

## Datenquelle fuer Tests

Ein einmaliger Export des Google Sheets als `.xlsx`, alle Tabs in einer Datei.
Der Export dient ausschliesslich der Entwicklung. Das Dashboard selbst liest zur
Laufzeit unveraendert live ueber die Sheets API, es wird nie gegen eine Datei
ausgeliefert.

Ablage unter `testdata/`, sofort in `.gitignore`. Der Rohexport wird nie
committet, weder oeffentlich noch privat.

## Aufbereitung

Ein Skript `scripts/make-fixtures.ts` erzeugt aus dem Export JSON Fixtures unter
`test/fixtures/`, und zwar in exakt der Form, die die Sheets API liefert, naemlich
ein Array von Zeilen aus Zeichenketten. Damit testen die Parser gegen dieselbe
Datenform, die sie auch produktiv sehen, und nicht gegen eine bequemere.

Die Kommentarspalte wird beim Erzeugen der Fixtures durch Platzhalter ersetzt.
Sie ist fuer Parser und Analytik belanglos und hat in Testdateien nichts verloren.

Die erzeugten Fixtures werden committet, der Rohexport nicht. Wenn spaeter mehr
Daten gebraucht werden, wird der Export wiederholt und das Skript erneut laufen
gelassen.

## Golden Values

Zusaetzlich zu den Eingabefixtures wird ein Satz erwarteter Ausgaben festgehalten:
alle Kennzahlen der Kopfleiste, alle Wochenmittel und Deltas, alle Uebungen mit
Wochenlasten und Progression, berechnet mit der **heutigen** Logik einschliesslich
ihrer Fehler.

Phase 1 gilt als abgeschlossen, wenn die neue Fassung diese Werte exakt
reproduziert. In Phase 2 wird jeder Golden Value, der sich durch einen Bugfix
aendert, einzeln und mit Begruendung aktualisiert. Eine unbegruendete Abweichung
ist ein Migrationsfehler.

## Was getestet wird

* `parse/daily.ts` gegen die echten Zeilen, einschliesslich `Durchschnitt` Zeilen
  zwischen den Wochenbloecken, `#REF!` in Zellen, ausgelassenen Tagen und Komma
  als Dezimaltrenner
* `parse/training.ts` gegen den echten Mesozyklus Tab
* Alle Module unter `analytics/` zusaetzlich gegen synthetische Verlaeufe mit
  analytisch bekanntem Ergebnis, weil echte Daten keine Extremfaelle abdecken
* Verhalten bei fehlender Spalte, das eine klare Fehlermeldung erzeugen muss und
  keine stille Fehlinterpretation

## Acceptance criteria

* [ ] `testdata/` steht in `.gitignore`, der Rohexport ist in keinem Commit
* [ ] Fixtures liegen in der Datenform der Sheets API vor, nicht in einer bequemeren
* [ ] Kommentarspalte in den Fixtures durch Platzhalter ersetzt
* [ ] Golden Values aus der heutigen Logik liegen vor, bevor Phase 1 beginnt
* [ ] Phase 1 reproduziert alle Golden Values exakt
* [ ] Jede Abweichung in Phase 2 ist im Commit begruendet
* [ ] `npm test` laeuft ohne Netzzugriff durch
