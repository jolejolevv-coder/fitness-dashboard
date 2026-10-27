# Heute verdichtet und Training eintragen (Phase 13)

Status: freigegeben 27.10.2026, Open questions 1 bis 3 wie vorgeschlagen
entschieden, 4 wird in 13.3 geprueft. Architektur in
`docs/adr/0007-training-eintragen-ueber-apps-script.md` (angenommen).
Entscheidungen des Nutzers vom 27.10.2026 sind eingearbeitet: Schreibweg ueber
das Apps Script des Daily Import, Eingabe Load, Reps Ist und Notes, nur leere
Zellen, auf `Heute` bleiben Gewicht und Trend.

## Goal

`Heute` zeigt nur noch Gewicht und Trend, und unter `Training` lassen sich die
Ist Werte eines Trainingstags im Studio eintippen und in den Mesocycle Tab des
Sheets schreiben.

## Ausgangslage

* `Heute` zeigt die Fortschrittskarte (verlorene kg, Fortschritt zum Ziel),
  darunter Aktuell, Wochenrate, Compliance, erwartetes Zieldatum, dann Insights
  und Tagesdurchschnitt. Am Handy ist das zu viel fuer einen Blick
* `Training` zeigt Kennzahlen, Uebungsliste mit Tag als Chips und drei
  Diagramme, nur lesend
* Der Mesocycle Tab hat je Uebung eine Zeile, je Woche einen Spaltenblock mit
  `Load`, `Reps Ist`, `RIR Ist`, in `Mesocycle 2` zusaetzlich `Notes`
  (`specs/sheet-structure.md`). Bloecke werden ueber die Zelle `Excercise`
  erkannt, die Abstaende schwanken
* Der Daily Import (Phase 10) hat ein Apps Script mit Token geplant. 10.1
  Kernlogik liegt auf Branch `claude/daily-import-36c9f1`, nicht gemergt;
  `doPost` (10.2) fehlt noch

## Teil A: Heute verdichtet

`Heute` zeigt genau drei Werte als Magnetkarten: aktuelles Gewicht (letzte
Waegung mit Datum), geglaetteter Trend als Wochenrate, Gesamtverlust erste
gegen letzte Waegung. Verweigerungen wie heute als Zahlenzeile.

Alles andere verschwindet nicht, es zieht nach `Verlauf`: Fortschritt zum Ziel,
Compliance, Zieldatum, Erhaltungsbedarf, Plateau, Insights und
Tagesdurchschnitt kommen an den Anfang des Segments `Analyse`. Keine neue
Kennzahl, keine Aenderung in `src/analytics/`.

## Teil B: Training eintragen

Neue Ansicht innerhalb von `Training`, Segment `Eintragen` (Hash
`#training/eintragen`), daneben das bisherige als `Auswertung`.

Ablauf:

1. Oben Woche und Trainingstag als Chips. Vorauswahl: die erste Woche, in der
   der gewaehlte Tag noch keine `Reps Ist` hat
2. Je Uebung eine Karte: Name, Soll (Sets, Reps Soll, RIR, Tempo) klein, darunter
   drei Felder `Load`, `Reps Ist`, `Notes`. `Notes` nur, wenn der Tab die
   Spalte hat
3. Felder, deren Zelle im Sheet schon belegt ist, zeigen den Wert und sind
   gesperrt. Korrekturen macht der Nutzer im Sheet
4. Eingaben liegen sofort als Entwurf im localStorage, je Tab, Woche und Tag.
   Ein Neustart oder Funkloch im Studio verliert nichts
5. Ein Knopf `Senden` schickt alle gefuellten Felder des Tags in einem POST.
   Danach zeigt jede Karte je Feld `geschrieben` oder `belegt`, der Entwurf
   wird geleert, die Trainingsdaten werden neu geladen
6. Ohne Netz bleibt `Senden` gesperrt, Zahlenzeile `offline`. Kein
   Hintergrundversand

Eingabeformat: `Load` wie im Sheet ueblich, also auch `55x2` oder `20-22.5`;
die App prueft nur, dass das Feld nicht leer ist und hoechstens 20 Zeichen
hat, die Deutung bleibt beim Parser. `Reps Ist` frei wie im Sheet (etwa
`10,9,8`). `Notes` hoechstens 200 Zeichen.

Einstellungen bekommen zwei Felder: Endpunkt URL und Token. Ohne beide ist
`Eintragen` ausgeblendet.

## Schreibweg

Siehe ADR 0007. Kurz: Das Apps Script des Daily Import bekommt eine zweite
Aktion `training`. Es sucht im genannten Tab den Wochenblock ueber `Excercise`
und die Spalten ueber die Kopfzeile, die Zeile ueber Trainingstag und
Uebungsname, und schreibt nur in leere Zellen. Es haengt nichts an und
ueberschreibt nichts.

Anfrage (Rumpf als `text/plain`, damit der Browser keinen Preflight schickt):
`token`, `action: "training"`, `sheet`, `week` (1 basiert), `day`, `entries`
als Liste aus `exercise`, `load`, `repsActual`, `notes`.

Antwort: je Eintrag und Feld `written`, `occupied` oder ein Fehlercode
(`unknown_exercise`, `unknown_column`), dazu global `unauthorized`,
`unknown_sheet`, `unknown_week`, `bad_request`.

## Harte Regeln

| Regel | Wie Phase 13 sie haelt |
| --- | --- |
| Kein Schreibzugriff des Dashboards | Wird geaendert, nur mit Freigabe von ADR 0007: Das Dashboard darf ueber das Apps Script leere Ist Zellen eines Mesocycle Tabs fuellen, sonst nichts. Kein direkter Sheets API Schreibzugriff, kein OAuth |
| Token und Endpunkt URL nicht im Repo | Bleibt. Sie liegen in den Script Properties und im localStorage, wie Sheet ID und API Key |
| Spalten ueber Kopfzeilen | Auch im Script: `Excercise`, `Load`, `Reps Ist`, `Notes` je Block gesucht. Fehlt eine, Fehlercode statt Schreiben |
| `textContent` statt `innerHTML` | Formular ueber `src/ui/dom.ts` |
| Keine Erklaertexte | Felder tragen nur ihren Spaltennamen, Status als Zahlenzeile |
| Keine Zielwerte als Literal | Soll Werte kommen aus dem Tab |

## Bundle Budget

Eintragen als nachgeladener Chunk `log`, hoechstens 4 kB gzip. Haupt Chunk
waechst hoechstens um 1 kB (Segment, Laden). CSP `connect-src` bekommt
`https://script.google.com` und `https://script.googleusercontent.com`.

## Scope

In scope:

* `Heute` auf drei Werte, Rest an den Anfang von `Verlauf` `Analyse`
* Segment `Eintragen` mit Entwurf im localStorage und Senden
* Aktion `training` im Apps Script, reine Kernfunktionen mit Tests
* Endpunkt und Token in den Einstellungen, CSP Ergaenzung mit Test
* Aenderung der harten Regel in `CLAUDE.md` und `specs/mission.md`

Out of scope:

* Ueberschreiben belegter Zellen, Loeschen, Anlegen von Zeilen, Wochen oder Tabs
* `RIR Ist` (nicht gewaehlt), Sollwerte aendern
* Versand im Hintergrund, Warteschlange ueber mehrere Tage
* Daily Tracking aus der App eintragen (bleibt Shortcut)
* Kueche (wird danach gesondert angeschaut)
* Phase 7

## Acceptance criteria

Heute

* [ ] `Heute` zeigt genau drei Karten: Gewicht, Wochenrate Trend, Gesamtverlust
* [ ] Jeder vorher auf `Heute` gezeigte Wert steht in `Verlauf` `Analyse`
* [ ] `git diff -- src/analytics src/parse` gegen den Stand vor Phase 13 ist leer

Eintragen

* [ ] Ohne Endpunkt und Token gibt es kein Segment `Eintragen`
* [ ] Woche und Tag waehlbar, Vorauswahl erste Woche ohne `Reps Ist` am Tag
* [ ] Belegte Zellen erscheinen gesperrt mit ihrem Wert
* [ ] Entwurf ueberlebt Neuladen und Neustart der installierten App
* [ ] Ein Senden schreibt im Sheet nur vorher leere Zellen `Load`, `Reps Ist`,
  `Notes` der gewaehlten Woche und des Tags, sonst aendert sich keine Zelle
  (am Test Tab geprueft)
* [ ] Falsches Token: `unauthorized`, im Sheet aendert sich nichts
* [ ] Fehlende Spalte `Notes` in `Mesocycle 1`: Notes werden nicht angeboten
* [ ] Offline ist `Senden` gesperrt, der Entwurf bleibt
* [ ] Der Service Worker fasst `script.google.com` nicht an (Test der URL Regel)

Regeln und Qualitaet

* [ ] Kernfunktionen des Scripts (Block finden, Zeile finden, Schreibplan) als
  reine Funktionen mit synthetischen Tabs getestet
* [ ] CSP nur um die zwei Script Hosts ergaenzt, als Test
* [ ] Bundle Budget eingehalten, Zahlen im Commit
* [ ] `npm run check` und Build sauber, Pruefung bei 375 px hell und dunkel
* [ ] Live Test im Studio durch den Nutzer

## Implementation plan

Phase 13.0 Freigabe: ADR 0007 angenommen, harte Regel in `CLAUDE.md` und
`specs/mission.md` angepasst, Branch ab `origin/main`.

Phase 13.1 Heute verdichten. Unabhaengig vom Schreibweg, eigener Commit, kann
sofort live gehen.

Phase 13.2 Script Kern: 10.1 vom Branch `claude/daily-import-36c9f1`
uebernehmen, dazu `findWeekBlock`, `findExerciseRow`, `planTrainingWrites` in
`apps-script/`, Tests per Vitest und `node:vm` gegen synthetische Tabs unter
`test/fixtures/` (bereinigt, ohne echte Werte).

Phase 13.3 Script Huelle: `doPost` mit Token und Aktionen `daily` und
`training` (schliesst Phase 10.2 mit ab). Bereitstellung als Web App macht der
Nutzer, Anleitung in `apps-script/README.md`.

Phase 13.4 App: Einstellungen, Segment `Eintragen`, Entwurf, Senden, CSP, URL
Regel des Service Workers erweitert, Chunk `log`.

Phase 13.5 Abschluss: Test gegen eine Kopie des Mesocycle Tabs, Merge nach
Freigabe, Live Test im Studio, Retro.

## Open questions

1. Eigenes Token fuer `training` oder dasselbe wie der Daily Import?
   Vorschlag: eigenes (`TRAINING_TOKEN`), dann kann ein verlorenes Handy
   gesperrt werden, ohne den Shortcut neu einzurichten
2. Wochenwahl: Vorauswahl ueber erste Woche ohne `Reps Ist` oder ueber das
   Datum ab Blockbeginn? Vorschlag erstes, weil der Blockbeginn nicht sicher
   im Tab steht
3. Benennung Segmente `Eintragen` und `Auswertung` sowie Datei
   `training-log.md`: Vorschlag, Entscheidung beim Nutzer
4. Antwortet die Apps Script Web App einem `fetch` aus dem Browser lesbar
   (CORS nach der Weiterleitung auf `script.googleusercontent.com`)? Wird in
   13.3 als erstes mit einem Probeendpunkt geprueft. Falls nicht, faellt die
   Rueckmeldung je Feld weg und die App laedt nach dem Senden neu und
   vergleicht selbst
