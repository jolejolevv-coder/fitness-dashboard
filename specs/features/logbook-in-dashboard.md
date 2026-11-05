# Logbuch im Dashboard

Status: freigegeben 05.11.2026. ADR 0010.

## Goal
Das Training wird direkt im Dashboard geloggt, mit dem Trainingsplan aus dem Recomp Logbuch, damit keine zweite App mehr nötig ist und jeder Satz im Sheet „Gym Logbuch“ landet.

## Ausgangslage
* Das Recomp Logbuch (`gym-logbook`) ist eine eigene Seite. Plan als `PLAN` im Code (4 Tage, 32 Übungen mit Sätzen, Ranges, RIR, Tempo, Pause, Hinweis). Speichert über ein Apps Script mit Token (`doPost`: eine Zeile je Einheit in `TrainingLog`, je Satz eine Zeile in `TrainingSets`; `doGet`: alle Einheiten).
* Als Claude Artifact schreibt das Logbuch nie ins Sheet, sondern in die Artifact Datenbank. Deshalb ist das Sheet bis heute leer, eine Einheit (03.11.) liegt nur dort.
* Das Dashboard liest `TrainingSets` schon (Phase 18, ADR 0008) und zeigt die Auswertung unter Training, Logbuch. Das Formular `Eintragen` schreibt bisher nur in Mesocycle Tabs (ADR 0007) und ist ausgeblendet, sobald eine Logbuch Sheet ID gesetzt ist.
* Harte Regel heute: genau zwei Schreibwege, beide nur in leere Zellen. Das Logbuch hängt Zeilen an und ersetzt die Zeilen einer Einheit. Das ist ein dritter Schreibweg und braucht eine Änderung der Regel samt ADR 0010.

## Scope
* In scope:
  * Ansicht Training, Eintragen bekommt die Logbuch Logik: Tag wählen, je Übung die Sätze mit kg, Wdh und Haken, „Letztes Mal“ aus dem Sheet, Ziel Range je Satz.
  * Speichern über das vorhandene Apps Script des Logbuchs (gleiches Format wie heute, keine Änderung am Script), Endpunkt und Token nur im localStorage.
  * Der Plan kommt aus dem Sheet, nicht aus dem Code (Regel: keine Zielwerte als Literal). Neuer Tab `Plan` im Sheet „Gym Logbuch“, eine Zeile je Übung.
  * Wie im Logbuch: Pausentimer nach jedem Haken mit Ton, Supersatz Hinweis, Aufwärmsätze je erster Übung einer Muskelregion, Hinweis je Übung aufklappbar. Hinweistexte und Aufwärmtexte sind Inhalt aus dem Sheet, kein Erklärtext im Code.
  * Offline: Eingaben bleiben lokal, bis das Senden klappt. Anzeige des Zustands als Zahlenzeile.
  * Einmalig die Einheit vom 03.11. ins Sheet übernehmen.
* Out of scope:
  * Änderungen am Apps Script und am Logbuch selbst.
  * Plan bearbeiten im Dashboard (der Plan wird im Sheet gepflegt).
  * Mesocycle Eintragen nach ADR 0007 bleibt im Code, ist aber ausgeblendet (Entscheidung 6).

## Acceptance criteria
- [ ] Unter Training, Eintragen erscheinen die vier Tage aus dem Tab `Plan`, der heutige Wochentag ist vorgewählt.
- [ ] Je Übung: Name, Muskel, Ziel Range je Satz, „Letztes Mal“ mit Datum, Satzzeilen mit kg, Wdh und Haken, 44 px Tippflächen.
- [ ] Ein abgehakter Satz liegt spätestens nach dem nächsten Senden in `TrainingSets` und erscheint nach Neuladen in der Auswertung.
- [ ] Ohne Netz geht nichts verloren; nach Rückkehr wird gesendet. Fehler als Zahlenzeile, nicht still.
- [ ] Fehlt eine Spalte im Tab `Plan`, gibt es eine sichtbare Fehlermeldung.
- [ ] Kein Token, keine URL und keine Sheet ID im Repository.
- [ ] Tests für Planparser und Satzzeilen mit synthetischer Fixture, Lint, Typprüfung, Build grün, geprüft bei 375 px.

## Implementation plan
Phase 20.0: Spec und ADR 0010 (dritter Schreibweg) freigeben, harte Regel in `CLAUDE.md` anpassen.
Phase 20.1: Tab `Plan` im Sheet anlegen und aus dem `PLAN` des Logbuchs befüllen, Einheit 03.11. übernehmen. Parser `parsePlan` mit Tests.
Phase 20.2: Formular Eintragen für das Logbuch, lokale Sitzung, Senden über das Apps Script, Tests.
Phase 20.3: Pausentimer, Supersatz und Aufwärmhinweise, Tests.
Phase 20.4: Prüfung bei 375 px, Live Test mit einem echten Satz, Übergabe, Merge nach Freigabe.

## Entscheidungen (05.11.2026)
1. Schreibweg über das vorhandene Logbuch Script, dritter Schreibweg, ADR 0010.
2. Plan im neuen Tab `Plan` des Sheets „Gym Logbuch“, befüllt aus dem jetzigen Plan.
3. Umfang wie das Logbuch, mit Pausentimer und Aufwärmhinweisen.
4. Logbuch als eigene Seite und Artifact bleiben unberührt.
5. Grill Runde: Datum immer heute, kein Datumsfeld. Letztes Mal je Trainingstag (Tag und Übung). Speichern automatisch und verzögert, kein Sendeknopf. Bildschirmsperre aus nur während der Timer läuft. Ohne eigene Historie kommt der kg Platzhalter aus `lastLoad` im Plan. Fertig heißt: ein echter Satz liegt in `TrainingSets` und erscheint in der Auswertung, vorher kein Merge.
6. Mesocycle wird nur ausgeblendet (Q10): kein Umschalter, keine Mesocycle Felder in den Einstellungen, Code und Abruf bleiben für die Zielwerte. Training zeigt nur das Logbuch.
7. Ohne Logbuch Sheet ID zeigt Training nur `Logbuch Sheet ID fehlt` (Q11).

## Annahmen
* Aufwärmstufen (heute 50 und 75 Prozent beim ersten Satz des Tages, 60 Prozent bei einer neuen Muskelregion) und die Zuordnung Muskel zu Region stehen als Werte in einem Tab `PlanSettings`, nicht im Code.
* Die allgemeinen Aufwärm und Hernienhinweise je Tagestyp stehen in `PlanSettings` und werden als Inhalt angezeigt.
