# Apps Script des Arbeitsblatts

Web App mit zwei Schreibwegen, beide nur in leere Zellen:

* `daily`: Daily Import aus dem iOS Shortcut, ADR 0005,
  `specs/features/daily-import.md`
* `training`: Training eintragen aus der App, ADR 0007,
  `specs/features/training-log.md`

Token und Endpunkt URL stehen in keiner Datei dieses Repos. Sie liegen nur in
den Script Properties, im Shortcut und im localStorage der App.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `daily-import-core.js` | reine Funktionen Daily Import, gemeinsame Hilfsfunktionen |
| `training-log-core.js` | reine Funktionen Training eintragen |
| `daily-import.js` | `doPost`, Sperre, Lesen und Schreiben der Tabs |

Im Editor teilen sich alle Dateien einen globalen Namensraum. Die Tests unter
`test/` laden sie genauso in einen gemeinsamen Kontext.

## Einrichtung

Eigenstaendiges Projekt, nicht an das Blatt gebunden. Das Blatt hat schon ein
gebundenes Projekt mit eigenem `doPost` (`Makros.gs`, Gewichtsimport aus Health
Auto Export); ein Projekt kennt nur einen `doPost`, deshalb bleibt jenes
unberuehrt.

1. script.google.com, Neues Projekt, Name zum Beispiel `fitness-dashboard
   Schreibwege`
2. Drei Skriptdateien anlegen (`daily-import-core`, `training-log-core`,
   `daily-import`, die Endung `.gs` setzt der Editor) und den Inhalt der
   gleichnamigen `.js` Dateien hineinkopieren. Die vorgegebene `Code.gs` wird
   zur ersten davon umbenannt. Die Reihenfolge spielt keine Rolle
3. Projekteinstellungen, Script Properties:
   * `SHEET_ID`: die ID des Arbeitsblatts, in seiner URL zwischen `/d/` und
     `/edit`. Fehlt sie, antwortet das Script `not_configured`
   * `TRAINING_TOKEN`: neues Zufallstoken, zum Beispiel aus
     `openssl rand -hex 24` im Terminal. Nicht in den Chat, nicht ins Repo
   * `DAILY_IMPORT_TOKEN`: eigenes Token fuer den Shortcut, sobald Phase 10.4
     ansteht. Fehlt es, lehnt `daily` jede Anfrage ab
   * `HEADER_ROW` und `FIRST_DATA_ROW` nur setzen, wenn `Daily Tracking` nicht
     mehr in Zeile 29 und 31 beginnt
4. Bereitstellen, Neue Bereitstellung, Typ Web App. Ausfuehren als: ich.
   Zugriff: Jeder. Google fragt beim ersten Mal nach der Berechtigung fuer
   Tabellen. Sie gilt fuer alle eigenen Tabellen, das Script oeffnet nur die
   aus `SHEET_ID`
5. Die angezeigte Web App URL (endet auf `/exec`) und `TRAINING_TOKEN` in der App
   unter Einstellungen eintragen

Nach jeder Aenderung am Code: Bereitstellungen verwalten, bestehende
Bereitstellung bearbeiten, Version Neu. So bleibt die URL gleich. Jede Antwort
traegt `version`, daran ist zu sehen, ob der Editor dem Repo entspricht.

## Erster Test gegen eine Kopie

Vor dem ersten echten Eintrag gegen eine Kopie des Mesocycle Tabs pruefen:

1. Tab duplizieren und umbenennen in `Mesocycle 99`
2. Im Terminal, URL und Token aus der Zwischenablage einsetzen, nicht in eine
   Datei schreiben:

```bash
curl -sL -H 'Content-Type: text/plain' -d '{"token":"TOKEN","action":"training","sheet":"Mesocycle 99","week":1,"day":"Day 1 - Torso","entries":[{"exercise":"Pulldown Cable Wide Grip","load":"70","repsActual":"9,8"}]}' 'URL'
```

3. Erwartet: `"ok":true` und je Feld `written` oder `occupied`. Im Tab haben
   sich nur vorher leere Zellen `Load` und `Reps` hinter `Load` der Woche 1 an
   Tag 1 geaendert
4. Derselbe Aufruf noch einmal: alle Felder `occupied`, nichts aendert sich
5. Mit falschem Token: `unauthorized`, nichts aendert sich
6. Tab `Mesocycle 99` wieder loeschen

## Pruefung CORS (Open question 4)

Die App liest die Antwort per `fetch`. Ob der Browser sie lesen darf, zeigt
dieser Aufruf in der Konsole der live Seite (Safari oder Chrome, Entwickler
Werkzeuge), mit absichtlich falschem Token:

```js
fetch('URL', { method: 'POST', body: JSON.stringify({ token: 'x', action: 'training' }) }).then((r) => r.json()).then(console.log)
```

Erscheint `{ok: false, error: "unauthorized", ...}`, ist die Antwort lesbar.
Erscheint ein CORS Fehler, meldet die App nach dem Senden nur noch den Versand
und laedt die Trainingsdaten neu (Ausweichweg der Spec).

## Antworten

Immer HTTP 200 und JSON mit `ok` und `version`.

`training`: `results` je Eintrag mit `exercise`, `occurrence` und entweder
`status` (je Feld `written`, `occupied` oder `unknown_column`) oder `error`
(`unknown_exercise`). Globale Fehler: `unauthorized`, `bad_request`,
`unknown_sheet`, `unknown_day`, `unknown_week`, `unknown_column`, `locked`,
`not_configured`, `internal`.

`daily`: `written` und `skipped` als Kopfnamen. Fehler siehe
`specs/features/daily-import.md`.

## Sperren

Token in den Script Properties loeschen oder aendern. Das sperrt die Aktion
sofort, ohne Deploy der App. Ein verlorenes Handy heisst: `TRAINING_TOKEN`
tauschen und in der App neu eintragen.
