# ADR 0010: Training im Dashboard loggen, über das Apps Script des Logbuchs

Status: angenommen (05.11.2026). Spec: `specs/features/logbook-in-dashboard.md`.

## Kontext

Der Nutzer will sein Training im Dashboard loggen statt in einer zweiten App.
Die Daten gehören in das Sheet „Gym Logbuch“, das das Dashboard seit ADR 0008
liest. Für dieses Sheet gibt es ein eigenes Apps Script (`gym-logbook/apps-script/Code.gs`)
mit Token in den Script Properties. Es ersetzt beim Speichern die Zeile einer
Einheit in `TrainingLog` und deren Satzzeilen in `TrainingSets`.

`CLAUDE.md` erlaubt bisher genau zwei Schreibwege, beide nur in leere Zellen
(ADR 0005 und ADR 0007).

## Entscheidung: dritter Schreibweg über das vorhandene Logbuch Script

Das Dashboard schickt dieselbe Nachricht wie das Logbuch (`token`, `id`,
`data`, `rows`) per POST an dessen Web App und liest Einheiten per GET.
Endpunkt und Token liegen nur im localStorage. Das Script bleibt unverändert.

* Gewinn: keine neue Bereitstellung, gleiches Format, Logbuch und Dashboard
  bleiben austauschbar, der Rückweg zum Logbuch ist offen
* Kosten: dieser Weg hängt Zeilen an und ersetzt die Zeilen einer Einheit,
  er hält sich nicht an „nur leere Zellen“. Die Grenze ist die Einheit: das
  Script ersetzt nur Zeilen mit derselben `id` (Datum und Tag)

## Verworfen

* Aktion im Script des Daily Import: ein Script für alles, aber neue
  Bereitstellung und ein zweites Sheet im selben Script
* Sheets API mit OAuth aus dem Browser: wie in ADR 0005 verworfen

## Folgen

* Harte Regel in `CLAUDE.md` um diesen dritten Weg ergänzt
* Ein Fehler in der App kann die Satzzeilen der laufenden Einheit
  überschreiben, nicht aber andere Einheiten
