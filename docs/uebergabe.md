# Uebergabe

## Phase 20 Logbuch im Dashboard (05.11.2026)

Spec `specs/features/logbook-in-dashboard.md` und ADR 0010 freigegeben, Branch
`claude/logbook-in-dashboard` ab main `89b3a04`. 20.0 erledigt (`9e15ab7`,
dritter Schreibweg in `CLAUDE.md`). Phase 19 ist live auf main.

Befund: Das Logbuch Artifact schreibt nur in die Artifact Datenbank (wenn
`window.claude` da ist, wird das Sheet nie benutzt). Einzige echte Einheit:
03.11. Tag 1, 6 Saetze, als Einfuegezeilen in `testdata/logbuch-2026-11-03.tsv`.
Pages Fassung `me.nahobinoco.com/gym-logbook/` hat denselben Plan.

20.1 bis 20.3 erledigt (Commits `8e07292`, `e855d9b`, 20.3 danach), nicht gepusht.
Neu: `src/parse/plan.ts`, `src/logbook/` (session, sync, planCache, warmup,
timer, index), `src/config/logbookAccess.ts` (Schluessel
`fitness_logbook_access_v1`), Fixture `test/fixtures/plan/`. Plan Tabs `Plan`
und `PlanSettings` nach `testdata/Plan.tsv`, `PlanSettings.tsv`. Eintragen
zeigt mit Logbuch Sheet ID nur das Logbuch Formular, Mesocycle Code bleibt.
Offen fuer 20.4: 375 px Pruefung, Live Satz, 03.11. ins Sheet, Plan Tabs im
Sheet anlegen, Logbuch Script URL und Token in den Einstellungen.

Annahmen 20: Plan Pflichtspalten ohne typ, lastReps, kind. Satzzahl keine Zahl
gibt PlanError mit Zeilennummer. Ohne `rest` kein Timer (kein Standardwert).
Ohne `load_step` kein Aufwaermhinweis. Ohne Gewicht Worte leicht, mittel,
schwer. Tagesvorwahl ueber den Wochentag im Label (`Montag · ...`), sonst Tag
nach der letzten Einheit. Sitzungen ohne Plantag oder Daten gelten als gesendet.
Gesendete Sitzungen bleiben 7 Tage lokal. Plan wird gecacht, Redraw nicht
waehrend der Eingabe. Eintragen erscheint mit Logbuch ID auch ohne Script
Zugang, Status dann `kein Zugang`. Hinweis Label immer `Hinweis`.

## Phase 19 Look des Recomp Logbuchs (05.11.2026)

Spec `specs/features/logbook-look.md` freigegeben: nur dunkel, Barlow selbst
mitgeliefert (ADR 0009, `public/fonts/`, 131 kB), Orange ersetzt Blau,
Kochansicht gleicher Look. Branch `claude/logbook-look` ab `f54794c`, nicht
gepusht.

Stand: 19.0 bis 19.3 erledigt, 19.4 bis auf Nutzerschritte. Commits `4e4ee3e`
(Tokens, Schrift), `fc30c2e` (Bausteine), `0a6e768` (Training, Felder), danach
19.4 mit `DESIGN.md` neu. CSS 5,66 kB gzip, Kontraste ab 6,2 zu 1, Tippflaechen
ab 44 px, kein waagerechter Seitenlauf bei 375 und 1280 px. Heute, Verlauf,
Kueche samt Kochansicht und Einstellungen geprueft, Kueche ohne eigene
Aenderung. Alte Hexwerte nur noch in `public/icon.svg` (App Symbol, out of scope).

Offen fuer den Nutzer: Freigabe zum Merge auf `main` und Push, danach Live
Pruefung am Handy neben dem Logbuch (Vergleichsbilder), dann Retro in der Roadmap.

Annahmen 19: Uebungsname im Eintragen Formular hell 17 px statt grauem Etikett
wie im Logbuch. Lastfelder 52 px in Condensed 22 px, Notizfeld bleibt Barlow
16 px. Markierungen Radius 4 px wie die Tags im Logbuch. Segmentpuck entfaellt,
Segmente sind Einzelknoepfe. Kapseln 44 px hoch statt 36 px.

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
