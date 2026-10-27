# CLAUDE.md — fitness-dashboard

Projektspezifische Regeln. Ergaenzt die globalen Vorgaben, ueberschreibt sie wo
sie abweichen.

## Was das ist

Auswertungsschicht ueber einem Google Sheet, lesend, kein Backend, eine Person.
Daneben, als eigener Baustein, der Daily Import (iOS Shortcut plus Apps Script
unter `apps-script/`), siehe `specs/features/daily-import.md` und ADR 0005.
Zweck und Nichtziele stehen in `specs/mission.md`. Vor jeder Arbeit lesen:
`specs/roadmap.md` und `specs/sheet-structure.md`.
docs/historie.md ist das Archiv der alten Roadmap und wird nur bei Bedarf gelesen.

## Sprache

Oberflaeche und Dokumentation auf Deutsch, Code und Bezeichner auf Englisch.
In deutschen Texten, Oberflaeche wie Dokumentation, werden keine Binde und
Gedankenstriche verwendet. In Dateinamen und Bezeichnern sind Bindestriche
erlaubt.

## Harte Regeln

* Kein direkter Schreibzugriff des Dashboards auf das Google Sheet, weder ueber
  die Sheets API noch per OAuth. Es gibt genau zwei Schreibwege, beide ueber das
  Apps Script und beide nur in leere Zellen, nichts anhaengen, nichts
  ueberschreiben: der Daily Import nach ADR 0005 (leere Zellen vorhandener
  Datumszeilen) und Training eintragen nach ADR 0007 (leere Zellen `Load`,
  `Reps Ist`, `Notes` eines Mesocycle Tabs)
* Token und Endpunkt URL des Apps Script stehen in keiner Datei im Repo, nur in
  den Script Properties, im Shortcut und im localStorage der App
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

## pstack

Aktiv seit 25.10.2026 (`.claude/settings.json`, Projektscope), Modelle in
`.claude/rules/pstack-models.md`: Code auf Sonnet, Urteil und Review auf Opus.
Der Freigabeprozess geht vor: Spec, Akzeptanzkriterien und Planfreigabe vor
jeder Implementierung, ADR, Architektur und Benennung entscheidet der Nutzer.
Kein Aufraeumen oder Loeschen von Altcode ohne Auftrag.
