## Goal

Die Tageswerte aus Apple Health landen jeden Abend mit einem Tippen in der
passenden Datumszeile von `Daily Tracking`, damit das Abtippen aus Yazio und
der Zepp App entfaellt und die Handwerte in derselben Abfrage miterfasst werden.

Freigegeben am 25.10.2026. Entscheidung zum Schreibweg: `docs/adr/0005-daily-import-ueber-health-und-apps-script.md`.

## Scope

In scope:

* iOS Shortcut, der Health liest, die Handwerte abfragt und einen POST sendet
* Google Apps Script als Web App (`doPost`), gebunden an das Arbeitsblatt, das
  die Werte in die vorhandene Datumszeile schreibt
* Absicherung ueber ein geheimes Token in den Script Properties
* Tests fuer Zeilensuche, Spaltenzuordnung und Schreibplan gegen synthetische Daten
* Anpassung von `specs/mission.md` und `CLAUDE.md`, damit die Regel "kein
  Schreibzugriff" eindeutig dem Dashboard gilt und der Schreibweg als eigener
  Baustein benannt ist

Out of scope:

* Jeder Schreibzugriff aus dem Dashboard. Das Dashboard bleibt lesend
* Anhaengen neuer Zeilen oder Wochenbloecke, Ueberschreiben befuellter Zellen
* Mesocycle Tabs, Lasten und Wiederholungen
* Spalten `Proteinfeedings`, `Cardio`, `Menstruation Cycle` und die Notizspalte
  `L` ohne Kopfzeile
* Rueckschreiben aus dem Sheet nach Health
* Android, Webformular, eigenes Backend

## Feldzuordnung

Kopfzeile 29 in `Daily Tracking`, Zuordnung ausschliesslich ueber den Kopftext.

| Kopf | Quelle | Regel |
| --- | --- | --- |
| Weight | Health, Koerpergewicht, Quelle Zepp | erste Messung des Tages, kg, eine Nachkommastelle |
| Time | Health, Zeitstempel derselben Messung | `HH:mm`, Zeitzone Europe/Berlin |
| Steps | Health, Schritte | Tagessumme, ganzzahlig, siehe Open questions zur Quelle |
| Sleep | Health, Schlafanalyse | Summe der Schlafphasen der Nacht, die am Morgen des Datums endet, Stunden mit zwei Nachkommastellen |
| Calories | Health, Nahrungsenergie, Quelle Yazio | Tagessumme kcal, ganzzahlig |
| Protein | Health, Protein, Quelle Yazio | Tagessumme g, eine Nachkommastelle |
| Carbs | Health, Kohlenhydrate, Quelle Yazio | wie Protein |
| Fat | Health, Fett gesamt, Quelle Yazio | wie Protein |
| Fiber | Health, Ballaststoffe, Quelle Yazio | wie Protein |
| Fruits & Vegetables | Hand | Zahl, Abfrage im Shortcut |
| Qualität | Hand | Zahl |
| Verdauung | Hand | Zahl |
| Stress | Hand | Zahl |
| Energylevel | Hand | Zahl |
| Trainingday | Hand | Auswahl `D<n> W<n> M<n>` oder `Rest`, Vorschlag aus der letzten Eingabe |
| Comments | Hand | Freitext, leer erlaubt |

Ein Feld ohne Wert, etwa kein Wiegen am Tag, wird nicht gesendet und bleibt im
Sheet leer. Es wird nie eine Null eingetragen, weil die Analytik eine echte Null
von einer fehlenden Messung unterscheiden muss.

## Shortcut

* Persoenliche Automation um 22:00 Uhr mit "Vor Ausfuehren fragen". Die
  Mitteilung startet den Shortcut erst auf Tippen, weil Health bei gesperrtem
  iPhone nicht lesbar ist
* Start ueber die Automation: Datum heute. Start von Hand: Datumsauswahl mit
  Standard gestern, fuer den Nachtrag am Morgen, falls die Automation ausfaellt
* Ablauf: Datum bestimmen, Health Werte fuer dieses Datum lesen, Handwerte
  abfragen, Zusammenfassung zeigen, POST senden, Antwort des Scripts anzeigen
* Endpunkt URL und Token liegen nur im Shortcut auf dem Geraet. Der Shortcut
  wird nicht geteilt und nicht exportiert
* Die Antwort zeigt je Feld: geschrieben, uebersprungen weil befuellt, fehlt

## Apps Script

* Eigenes Projekt, Blatt ueber `SpreadsheetApp.openById` mit Script Property
  `SHEET_ID`, keine Sheet ID im Code (Nachtrag 27.10.2026, ADR 0005)
* Bereitstellung als Web App, ausfuehren als der Nutzer, Zugriff "Jeder"
* `doPost` liest JSON aus dem Rumpf: `token`, `date` (`d.m.yyyy`), `values`
  (Objekt Kopftext auf Wert)
* Token Pruefung als erstes, Vergleich gegen `DAILY_IMPORT_TOKEN` aus den Script
  Properties. Fehlt die Property, lehnt das Script jede Anfrage ab
* Kopfzeile und Beginn der Datenzeilen kommen aus Script Properties
  (`HEADER_ROW`, `FIRST_DATA_ROW`, Standard 29 und 31), nicht als Literal im Code
* Zeilensuche: ab `FIRST_DATA_ROW` die Spalte `Date` ueber die Anzeigewerte
  lesen, Zeilen ohne Datum (Wochenbloecke, Leerzeilen) ueberspringen, genau ein
  Treffer erwartet. Kein Treffer oder mehrere Treffer ergibt einen Fehler
* Spaltenzuordnung: Kopfzeile lesen, jeden gesendeten Kopf genau einer Spalte
  zuordnen. Ein unbekannter oder doppelter Kopf ergibt einen Fehler, bevor
  irgendetwas geschrieben wird
* Schreibplan: nur leere Zellen werden beschrieben. Befuellte Zellen bleiben
  unveraendert und werden in der Antwort als uebersprungen gemeldet, damit
  Korrekturen des Trainers bleiben. Ein zweiter Lauf fuer dasselbe Datum ist
  damit harmlos
* Geschrieben wird je Zelle, gelesen wird mit `LockService`, damit zwei Laeufe
  nicht ineinander greifen
* Antwort immer JSON mit `ok`, `written`, `skipped`, `error`. Apps Script
  liefert stets HTTP 200, der Shortcut wertet deshalb `ok` aus, nicht den Status
* Keine Gesundheitswerte im Log (`console.log`), nur Datum, Anzahl und Fehlercode

Fehlercodes, jeweils sichtbar im Shortcut:

| Code | Bedeutung |
| --- | --- |
| `unauthorized` | Token fehlt oder falsch |
| `bad_request` | Rumpf kein JSON, Datum nicht im Format `d.m.yyyy` |
| `header_missing` | Kopfzeile nicht gefunden oder gesendeter Kopf fehlt, mit Name |
| `header_ambiguous` | Kopf mehrfach vorhanden, mit Name |
| `date_missing` | keine Zeile fuer das Datum, mit Datum |
| `date_ambiguous` | mehr als eine Zeile fuer das Datum |
| `locked` | anderer Lauf aktiv |

## Acceptance criteria

* [ ] Ein Lauf am Abend fuellt alle Health Felder und alle Handwerte der
      heutigen Zeile, geprueft an einem echten Tag im Sheet
* [ ] Ein Nachtrag am Morgen mit Standarddatum gestern fuellt die Zeile von gestern
* [ ] Eine befuellte Zelle bleibt nach dem Lauf unveraendert und erscheint in
      `skipped`
* [ ] Ein zweiter Lauf fuer dasselbe Datum schreibt nichts und meldet alle Felder
      als uebersprungen
* [ ] Falsches oder fehlendes Token ergibt `unauthorized`, im Sheet aendert sich nichts
* [ ] Fehlt eine Kopfspalte, erscheint `header_missing` mit Spaltennamen im
      Shortcut, im Sheet aendert sich nichts
* [ ] Ein Datum ohne Zeile ergibt `date_missing`, es wird keine Zeile angehaengt
* [ ] Zeilen der Wochenbloecke (`Durchschnitt`, `Gewichtsveränderung`, `in %`)
      werden nie beschrieben
* [ ] Ein Tag ohne Wiegen laesst `Weight` und `Time` leer, die uebrigen Felder
      werden geschrieben
* [ ] Das Dashboard liest die importierten Werte ohne Aenderung am Parser, alle
      bestehenden Tests bleiben gruen
* [ ] Unit Tests fuer Zeilensuche, Spaltenzuordnung und Schreibplan gegen
      synthetische Tabellen: Wochenbloecke, verschobene Spalten, doppelte Koepfe,
      fehlendes Datum, doppeltes Datum, teils befuellte Zeile
* [ ] Token, Endpunkt URL und Sheet ID stehen in keiner Datei im Repo und in
      keinem Commit, geprueft per `git grep` vor jedem Push
* [ ] Die Script Logs enthalten keine Gesundheitswerte
* [ ] `specs/mission.md` und `CLAUDE.md` nennen den Schreibweg als eigenen
      Baustein, die Regel "kein Schreibzugriff" gilt ausdruecklich dem Dashboard
* [ ] Eine Einrichtungsanleitung fuer Script, Properties, Bereitstellung und
      Shortcut liegt im Repo, ohne Geheimnisse

## Implementation plan

Phase 10.0: Klaerung und Freigabe. Open questions beantworten, ADR 0005
annehmen, Mission und `CLAUDE.md` anpassen.

Phase 10.1: Kernlogik. Reine Funktionen `findDateRow`, `mapHeaders`,
`planWrites` und `validateRequest` ohne Zugriff auf `SpreadsheetApp`, in
`apps-script/daily-import-core.js` als globale Funktionen, damit dieselbe Datei
im Apps Script Editor laeuft. Tests mit Vitest, die Datei wird im Test ueber
`node:vm` geladen. Synthetische Tabellen unter `test/fixtures/daily-import/`.

Phase 10.2: Huelle. `apps-script/daily-import.js` mit `doPost`, Token Pruefung,
`LockService`, Lesen der Bereiche, Schreiben je Zelle, JSON Antwort. Test von
`doPost` mit einer nachgebauten `SpreadsheetApp` Attrappe.

Phase 10.3: Bereitstellung. Script im Editor des Arbeitsblatts anlegen,
Properties setzen, als Web App bereitstellen. Erster Test mit `curl` gegen ein
Datum in der Zukunft mit leerer Vorlagezeile, danach Pruefung im Sheet. Token
erzeugt und eingetragen vom Nutzer, nie im Chat.

Phase 10.4: Shortcut. Aufbau nach Anleitung `docs/daily-import-setup.md`,
Automation 22:00 Uhr, eine Woche Parallelbetrieb mit Sichtpruefung gegen Yazio
und Zepp.

Phase 10.5: Abschluss. Akzeptanzkriterien abhaken, Retro in die Roadmap.

## Open questions

1. Entschieden 25.10.2026: Der Scriptquelltext wird im oeffentlichen Repo unter
   `apps-script/` versioniert. Der Code enthaelt kein Geheimnis und keine Sheet ID, das
   Layout der Tabelle steht ohnehin in `specs/sheet-structure.md`. Tradeoff:
   Wer das Repo liest, sieht, wie der Endpunkt aufgebaut ist. Ohne URL und Token
   nutzt das nichts. Verworfen: nur im Apps Script Editor (keine Tests, kein
   Verlauf) und ein privates zweites Repo (doppelte Pflege)
2. Deployment ohne `clasp`. Vorschlag: Quelltext von Hand in den Editor kopieren,
   passt zur Vorgabe portalnah statt Werkzeugkette. Tradeoff: Repo und Editor
   koennen auseinanderlaufen. Gegenmittel: Versionsnummer als Konstante im
   Script, die in der Antwort zurueckkommt
3. Vorlagezeilen reichen laut Erhebung vom 29.07.2026 bis 25.10.2026. Danach
   liefert jeder Lauf `date_missing`, bis der Trainer neue Zeilen anlegt. Wer
   legt den naechsten Block an, und wann?
4. Schritte: schreiben iPhone und die Zepp Uhr beide Schritte nach Health? Der
   Shortcut summiert Rohwerte ohne die Doppelzaehlung, die Health selbst
   herausrechnet. Vorschlag: Quelle auf Zepp festlegen. Pruefung am Geraet
5. Schlaf: entspricht "Nacht, die am Morgen des Datums endet" der bisherigen
   Eintragung von Hand? Ebenso: zaehlen Wachphasen mit
6. Lauf um 22:00 Uhr: Mahlzeiten und Schritte nach 22:00 Uhr fehlen, ein zweiter
   Lauf ergaenzt sie nicht, weil befuellte Zellen geschuetzt sind. Reicht das,
   oder soll die Automation spaeter laufen
7. Format von `Time` und `Sleep` im Bestand: Text oder Zahl, Komma oder Punkt.
   Wird vor Phase 10.1 am Rohexport geprueft, das Script schreibt in derselben
   Form wie der Bestand
8. Skalen der Handwerte (`Qualität`, `Verdauung`, `Stress`, `Energylevel`,
   `Fruits & Vegetables`): Bereich je Feld, damit der Shortcut nur gueltige
   Werte anbietet. Die Grenzen kommen nicht als Literal in das Script, sondern
   in den Shortcut oder die Script Properties
9. Erfaehrt der Trainer vom automatischen Import? Er arbeitet im selben Sheet
   und sieht sonst nicht, welche Werte aus Health stammen
