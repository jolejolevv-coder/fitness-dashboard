# Uebergabe Archiv, Fassung vom 05.11.2026, archiviert 06.11.2026

# Uebergabe

## Phase 20 Logbuch im Dashboard (05.11.2026)

Spec `specs/features/logbook-in-dashboard.md` und ADR 0010 freigegeben, Branch
`claude/logbook-in-dashboard`, live auf main seit 05.11.2026 (`ec7f2c4`). 20.0 bis 20.3
erledigt (`9e15ab7`, `8e07292`, `e855d9b`, `ef455a5`), 20.4 Mesocycle
ausgeblendet (`1e97fa7`). 604 Tests, Build gruen.

Befund: Das Logbuch Artifact schreibt nur in die Artifact Datenbank, das Sheet
blieb leer. Einzige echte Einheit 03.11. Tag 1 in `testdata/logbuch-2026-11-03.tsv`.

Neu: `src/parse/plan.ts`, `src/logbook/`, `src/config/logbookAccess.ts`
(Schluessel `fitness_logbook_access_v1`), Fixture `test/fixtures/plan/`.
Training zeigt nur das Logbuch, ohne Logbuch Sheet ID nur `Logbuch Sheet ID
fehlt`. Mesocycle Code und Abruf bleiben (Zielwerte), Felder unsichtbar.

Geprueft bei 375 px mit Fixturedaten im localStorage: Eintragen mit Letztes
Mal, Plan Vorbelegung, Aufwaermzeile, Supersatz, Timer nach Haken, lokale
Sitzung `pending`; Auswertung ohne Umschalter; kein waagerechter Lauf.

Im Sheet erledigt (05.11.): Tabs `Plan` (32 Uebungen) und `PlanSettings`
als Nur Text angelegt, Einheit 03.11. in `TrainingSets` (6 Saetze) und
`TrainingLog` ab Zeile 3, Zeile `verbindungstest` unberuehrt.
Offen beim Nutzer (20.4): in den Einstellungen Logbuch Script URL, Token und
Logbuch Sheet ID. Ein echter Satz live, dann Retros 18 bis 20.

20.5 (05.11., Branch `claude/logbook-eins-zu-eins`): Nutzer will das Formular
eins zu eins wie das Logbuch. Platzhalter je Satz aus dem letzten Mal, sonst
`lastLoad` und `lastReps` des Plans je Satz (`70 / 60`, `10-9-9`), Wdh zuletzt
Obergrenze der Range (`setPlaceholders`). Hinweis und Vor dem Training mit Pfeil,
Tipps mit Hernie als `Hernie beachten` in Amber, ohne Daten `Neue Übung:
Startgewicht testen`. Ohne kg im Plan und ohne Verlauf bleibt kg leer wie im Logbuch.

Annahmen 20: Plan Pflichtspalten ohne typ, lastReps, kind. Ohne `rest` kein
Timer, ohne `load_step` kein Aufwaermhinweis. Tagesvorwahl ueber den Wochentag
im Label, sonst Tag nach der letzten Einheit. Sitzungen ohne Plantag gelten als
gesendet (Risiko: faellt ein Tag aus dem Plan, wird seine offene Sitzung nie
gesendet). Gesendete Sitzungen bleiben 7 Tage lokal.

## Phase 19 Look des Recomp Logbuchs (05.11.2026)

Live auf main `89b3a04`. Spec `specs/features/logbook-look.md`, ADR 0009,
`DESIGN.md` neu. Offen: Retro. Annahmen 19: Lastfelder 52 px Condensed 22 px,
Markierungen Radius 4 px, Segmente als Einzelknoepfe, Kapseln 44 px.

## Phase 18 Training aus dem Gym Logbuch (05.11.2026)

Spec `specs/features/training-from-logbook.md` und ADR 0008 freigegeben,
Open questions 1 bis 4 wie vorgeschlagen. 18.0 erledigt. Startprompt 18.1 bis
18.3: Lies CLAUDE.md, specs/roadmap.md, diesen Abschnitt, die Spec und ADR 0008.
Arbeite auf Branch `claude/training-from-logbook`, nicht auf `main`. Baue 18.1
bis 18.3 nach der Spec, Tests im selben Schritt, pruefe bei 375 px. Kein Push
und kein Merge ohne Freigabe. 18.4 braucht den Nutzer (Logbuch Tabelle per
Link lesbar, Sheet ID eintragen, Live Test).
Logbuch Spalten in `TrainingSets`: `id`, `date` (`YYYY-MM-DD`), `tag`
(`Tag 1` bis `Tag 4`), `exercise`, `muscle`, `set`, `kg` (Zahl), `reps` (Zahl),
nur abgehakte Saetze. Quelle: `gym-logbook/apps-script/Code.gs`.

18.1 bis 18.3 erledigt 05.11.2026 auf Branch `claude/training-from-logbook`
(`fbfbf9e` Parser, `4429094` Quelle und Umschalter), nicht gepusht, nicht
gemergt. `src/parse/trainingSets.ts` mit Fixture
`test/fixtures/training-sets/` (in `.gitignore` freigegeben), Einstellungen
`input-logbook-sheet-id` und `input-logbook-sheet-name`, Cache Feld `logbook`
in `fitness_cache_v1`, Umschalter `#t-source`. 571 Tests, Haupt Chunk 40,20
auf 41,61 kB gzip, CSS gleich. Geprueft im Dev Server bei 375 px mit Fixture
im localStorage: Logbuch, Umschalter, fehlende Spalte `reps`, ohne Logbuch ID
wieder `Eintragen`, kein waagerechter Seitenlauf.

Annahmen 18.1 bis 18.3:
* Saetze und `repsActual` einer Woche kommen aus der Einheit (Datum) mit dem
  schwersten Satz, bei Gleichstand die erste. Zwei Einheiten derselben Uebung
  in einer Woche werden nicht zusammengezaehlt
* Ein Satz zaehlt nur mit Datum, `tag`, `exercise`, Zahl in `kg` und `reps`
  ueber null. 0 kg zaehlt (Koerpergewicht), geht aber nicht in die Progression
* `date` wird als `YYYY-MM-DD` oder `d.m.yyyy` gelesen, weil die Sheets API
  den angezeigten Wert liefert und das Sheet ISO Text als Datum formatieren
  kann. In 18.4 am echten Tab pruefen
* `muscle` und `set` sind optional, ohne `set` gilt die Zeilenfolge
* `Analyse` und Export lesen keine Uebungsdaten, nur Daily, daher dort keine
  Umstellung. Die Abnahmerate in den Zielwerten kommt weiter aus dem
  Mesocycle Tab, der deshalb auch mit Logbuch geladen wird
* Die Wahl im Umschalter gilt fuer die Sitzung, nicht gespeichert. Nach dem
  Speichern der Einstellungen steht sie wieder auf `Logbuch`
* Scheitert der Abruf des Logbuchs, bleiben gecachte Saetze derselben Quelle
  stehen, die Statuszeile nennt den Fehler; ohne Cache steht der Fehler im
  Abschnitt Training

Stand 18.4 (05.11.2026): Tabelle `Gym Logbuch` nach Zusage des Nutzers per
Link lesbar (Betrachter), oeffentlicher CSV Abruf liefert 200. Kopfzeile
passt, `date` kommt als ISO Text. `TrainingSets` traegt bisher nur die Zeile
`verbindungstest` mit 0 Wdh, der Parser verwirft sie, Training zeigt also
`Keine Trainingsdaten`, bis echte Saetze geloggt sind. Branch nach Zusage per
Fast Forward auf main gepusht (`1f74d65`), Deploy gruen, live. Sheet ID steht
nicht im Repo, nur in den Einstellungen der App.
Offen beim Nutzer: Sheet ID in den Einstellungen eintragen, nach der ersten
geloggten Einheit Werte gegen das Logbuch pruefen, dann Retro Phase 18.

Stand 27.10.2026, Phase 12 live, offen nur der iPhone Test des Nutzers. Phase 13 freigegeben, 13.1 bis 13.4 erledigt, naechster Schritt 13.5 mit dem Nutzer.

## Wo wir stehen

Dashboard live, Phasen 0 bis 12 fertig (siehe `specs/roadmap.md`). Phase 8
Notizen und offene Punkte des Nutzers (Anfrage Muskelmarkt, Dauerpreise) in
`docs/uebergabe-archiv-2026-10-26.md`. pstack aktiv, Freigabeprozess geht vor.

## Phase 12 Mobile App

Live. Notizen in `docs/uebergabe-archiv-2026-10-26.md`.

## Phase 13 Heute und Training eintragen

Live auf main, auch 13.6. Einzelheiten, Annahmen und die Panne aus 13.5 in
`docs/uebergabe-archiv-2026-11-05.md`. Offen: Retro Phase 13, sobald der
Nutzer den Studio Test bestaetigt. Mit Logbuch (Phase 18) ist `Eintragen`
ausgeblendet.

Dauerpreise: Aldi Sued Bon vom 27.10.2026 als `source: manual` in
`public/data/regular_prices.json` (`32d6147`, live). Falle: der Sonntagslauf
ersetzt mit juengerem Muskelmarkt Datum wieder, Kidney Bohnen Aldi kommen dann
als Grossgebinde 3060 g zurueck. Phase 14 Kassenbon einlesen: Spec
`specs/features/receipt-scan.md` freigegeben, 14.1 bis 14.3 gebaut (505 Tests,
Chunk `receipt` 11,2 kB, Haupt Chunk +2,7 kB). Pruefansicht im Build Preview mit
nachgestellter API Antwort geprueft, auch bei 375 px. Live auf main (`256b58c`). Offen: Live Test mit echtem Bon und echtem Key durch den Nutzer, Retro.

Phase 15 Gewicht und Schritte automatisch: Spec
`specs/features/daily-weight-steps.md`, Fragen beantwortet (Kurzbefehl mit
Tippen, morgens fuer gestern, Schritte nur Zepp, `Makros.gs` laeuft nicht
mehr), freigegeben. 15.1 und 15.2 erledigt, Script unveraendert, Anleitung
`docs/daily-import-setup.md`. Live auf main (`ae91803`). Offen: 15.3 Einrichtung durch den Nutzer, eine
Woche Betrieb, Retro.

Phase 16 Zubereitung je Gericht: Spec `specs/features/meal-instructions.md`
freigegeben, 16.1 bis 16.3 gebaut und lokal committet (`a4859f2`, 539 Tests,
Build gruen, Heute und Woche bei 375 px geprueft). Texte freigegeben 27.10.2026,
live auf main. Offen: Retro nach Nutzung in der Kueche.

Phase 17 Rezepte statt Prep: Spec `specs/features/recipes-section.md`
freigegeben 27.10.2026, offene Fragen wie vorgeschlagen (Zeit Tags bleiben je
Portion, `Kochen` und `Vorbereitung` als Chips). 17.1 Texte in
`data/meals.json` geschrieben (fuenf Gerichte von Grund auf, keine Mengen im
Text), 17.2 und 17.3 gebaut und bei 375 px geprueft,
Rezepte freigegeben 27.10.2026, live auf main. Offen: Retro.

## Phase 9 Plangenerator

Umgesetzt, gemergt und live seit 25.10.2026. Details, Bundle Zahlen und die
Schritte fuer den Live Lauf stehen in `docs/uebergabe-archiv-2026-10-26.md`.
Offen beim Nutzer: Netzwerkpruefung des Live Laufs, danach Retro Phase 9.

## Phase 10 Daily Import

10.1 Kern und 10.2 Huelle sind mit Phase 13.2 und 13.3 auf diesem Branch
gelandet (`apps-script/`). Offen: 10.3 Bereitstellung durch den Nutzer nach
`apps-script/README.md`, 10.4 Shortcut, Open questions 3 bis 6, 8 und 9 der
Spec. Alte Notizen: `docs/uebergabe-archiv-2026-10-26.md`.
