# Training aus dem Gym Logbuch

Status: freigegeben 05.11.2026, Open questions 1 bis 4 wie vorgeschlagen. ADR 0008.

## Goal
Das Dashboard liest Trainingsdaten künftig aus der Tabelle des Gym Logbuchs (Tab `TrainingSets`), Daily Check-in (Gewicht, Ernährung, Schlaf, Schritte) weiter aus dem bisherigen Sheet.

## Ausgangslage
* Bisher: Trainingsteil liest einen `Mesocycle N` Tab des großen Sheets über die Sheets API (`fetchTrainingSheet`, `parseTraining`), Daily Tracking aus demselben Sheet.
* Neu im Einsatz: Gym Logbuch (`jolejolevv-coder/gym-logbook`, live unter me.nahobinoco.com/gym-logbook). Sein Apps Script schreibt in eine eigene Tabelle, Tab `TrainingSets`, eine Zeile je Satz: `id`, `date`, `tag`, `exercise`, `muscle`, `set`, `kg`, `reps`. Daneben `TrainingLog` (eine Zeile je Einheit, JSON, nur für das Logbuch selbst).
* Die Oberfläche `Training > Auswertung` arbeitet mit `ParsedTraining` (Übungen mit Wochen, Last, Sätzen, Ist Wdh). Dieses Modell bleibt.

## Scope
* In scope:
  * Zweite Quelle in den Einstellungen: Sheet ID der Logbuch Tabelle, Tabname Vorgabe `TrainingSets`. Gleicher API Key.
  * Neuer Parser `parseTrainingSets(rows)` in `src/parse/`, Spalten über die Kopfzeile, liefert `ParsedTraining`. Woche = Kalenderwoche ab der ersten Einheit, Schlüssel `tag||exercise`, Last = schwerster Satz der Woche, `repsActual` als `10-9-9`.
  * `Training > Auswertung` und die Trainingsdaten in `Analyse` und Export nutzen die neue Quelle, sobald sie eingetragen ist.
  * Fixture und Tests für den Parser mit synthetischen Sätzen.
* Out of scope:
  * Daily Tracking, Ernährung, Einkauf, Plangenerator: unverändert.
  * Schreiben ins Sheet: das Dashboard schreibt nichts in die Logbuch Tabelle.
  * Änderungen am Logbuch selbst.
  * Zusammenführen alter Mesocycle Blöcke mit Logbuch Daten (siehe Open questions).

## Acceptance criteria
- [ ] Mit eingetragener Logbuch Sheet ID zeigt `Training > Auswertung` die Übungen aus `TrainingSets`, Daily Werte kommen weiter aus dem alten Sheet.
- [ ] Fehlt eine der Spalten `date`, `tag`, `exercise`, `kg`, `reps`, erscheint eine sichtbare Fehlermeldung mit dem Spaltennamen.
- [ ] Kommazahlen (`7,5`) und leere Wdh werden korrekt behandelt, leere Sätze zählen nicht.
- [ ] Gleicher Übungsname an zwei Trainingstagen bleibt getrennt (`Tag 2||Leg Extensions`, `Tag 4||Leg Extensions`).
- [ ] Ohne Logbuch Sheet ID verhält sich das Dashboard wie bisher.
- [ ] Sheet Inhalte gehen per `textContent` ins DOM, keine Zugangsdaten im Repo.
- [ ] Tests, Lint, Typprüfung und Build grün; geprüft bei 375 px.

## Implementation plan
Phase 18.0: Diese Spec und ADR 0008 (zweite Tabelle als Trainingsquelle) freigeben.
Phase 18.1: Parser `parseTrainingSets` mit Fixture und Tests.
Phase 18.2: Einstellungen um Logbuch Sheet ID und Tabname, Laden der zweiten Quelle, Cache.
Phase 18.3: `Training`, `Analyse`, Export auf die neue Quelle umstellen, Prüfung bei 375 px.
Phase 18.4: Mit dem Nutzer: Freigabe der Logbuch Tabelle für den API Key, Live Test, Retro.

## Entscheidungen (05.11.2026)
1. Alte Mesocycle Blöcke bleiben über einen Umschalter `Mesocycle` und `Logbuch` sichtbar, Vorgabe `Logbuch` sobald eingetragen. Zusammenführen je Übung erst in Phase 7.
2. Lesen über die Sheets API mit dem vorhandenen API Key. Der Nutzer gibt die Logbuch Tabelle per Link lesbar frei (18.4).
3. `Training > Eintragen` wird ausgeblendet, sobald eine Logbuch Sheet ID eingetragen ist. Code bleibt.
4. Auswertung nur nach Ist Werten, keine Sollwerte.

## Open questions (Entwurf, beantwortet)
1. Alte Historie: Sollen `Mesocycle 1` bis `3` weiter angezeigt werden (Umschalter zwischen alter und neuer Quelle), oder zeigt `Training` nur noch Logbuch Daten? Vorschlag: Umschalter, Zusammenführen je Übung erst als Phase 7.
2. Zugriff: Die Sheets API mit API Key liest nur Tabellen, die per Link lesbar sind, wie das bisherige Sheet. Die Logbuch Tabelle muss genauso freigegeben werden. Alternative ohne Freigabe: lesen über `doGet` des Logbuch Scripts mit dessen Token; das liefert aber nur `TrainingLog` (JSON ohne Übungsnamen). Vorschlag: Sheets API.
3. `Training > Eintragen` (Phase 13, schreibt in Mesocycle Tabs): bleibt, wird ausgeblendet, oder entfällt, weil im Studio jetzt das Logbuch genutzt wird? Vorschlag: ausblenden, Code bleibt.
4. Plan Sollwerte (Wdh Bereich, RIR) stehen nur im Code des Logbuchs, nicht in der Tabelle. Reicht die Auswertung nach Ist Werten? Vorschlag: ja.
