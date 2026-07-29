# CLAUDE.md — fitness-dashboard

Projektspezifische Regeln. Ergaenzt die globalen Vorgaben, ueberschreibt sie wo
sie abweichen.

## Was das ist

Auswertungsschicht ueber einem Google Sheet, lesend, kein Backend, eine Person.
Zweck und Nichtziele stehen in `specs/mission.md`. Vor jeder Arbeit lesen:
`specs/roadmap.md` und `specs/sheet-structure.md`.

## Sprache

Oberflaeche und Dokumentation auf Deutsch, Code und Bezeichner auf Englisch.
In deutschen Texten, Oberflaeche wie Dokumentation, werden keine Binde und
Gedankenstriche verwendet. In Dateinamen und Bezeichnern sind Bindestriche
erlaubt.

## Harte Regeln

* Kein Schreibzugriff auf das Google Sheet, unter keinen Umstaenden
* Keine Zielwerte, Schwellen oder Konstanten als Literal im Berechnungscode.
  Zielwerte kommen aus dem Sheet, siehe `specs/features/goals.md`
* Spalten werden ueber Kopfzeilen zugeordnet, nie ueber feste Indizes. Eine
  fehlende Spalte erzeugt eine sichtbare Fehlermeldung, niemals eine stille
  Fehlinterpretation
* Kennzahlen kennen ihre Mindestdatenlage und verweigern die Aussage darunter.
  Wo verweigert wird, steht der Grund als Zahlenzeile, etwa `Basis 11 von 14 Tagen`
* Keine Erklaertexte in der Oberflaeche. Zahl und Datenbasis, sonst nichts
* Inhalte aus dem Sheet gehen per `textContent` in das DOM, nie per `innerHTML`
* `testdata/` enthaelt Rohexporte und wird nie committet. Fixtures unter
  `test/fixtures/` sind bereinigt und werden committet
* Zugangsdaten liegen ausschliesslich im localStorage. Kein Schluessel im
  Repository, in keiner Datei, zu keinem Zeitpunkt

## Arbeitsweise

* `main` bleibt live und unangetastet bis Phase 6. Gearbeitet wird auf `rewrite`
* Rueckfallweg ist Tag `v0-legacy`
* Jede Abweichung von den Golden Values wird im Commit begruendet
* Analytik ist reine Funktion ohne DOM Zugriff und wird gegen synthetische
  Verlaeufe mit bekanntem Ergebnis getestet
