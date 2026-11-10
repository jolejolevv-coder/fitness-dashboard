# Uebergabe

Stand 10.11.2026. Alte Fassung (Stand 05.11.) verbatim in `docs/uebergabe-archiv-2026-11-06.md`, weitere Archive: `docs/uebergabe-archiv-2026-10-26.md`, `docs/uebergabe-archiv-2026-11-05.md`.

## Wo wir stehen

Alles liegt auf `main`, Phase 20.5 (`4791cad`) und die Doku (`2fc90db`) inklusive. Die vier lokalen Branches `claude/logbook-eins-zu-eins`, `claude/logbook-in-dashboard`, `claude/logbook-look`, `claude/training-from-logbook` sind in `main` enthalten und koennen nach Freigabe des Nutzers geloescht werden. Auf dem Remote liegen ausserdem `claude/mobile-app-b71746`, `claude/mobile-app-spec` und `rewrite` (Zweck nicht geprueft). Kein Push ohne Freigabe. Ungetrackt: `.claude/launch.json`.

Die alten Arbeitskopien in `~/Downloads` (`fitness-dashboard`, `fitness-dashboard-plan-generator`) wurden am 06.11.2026 in den Papierkorb verschoben. Massgeblich ist `/Users/jole/Documents/GitHub/fitness-dashboard`.

## Warten auf den Nutzer

* Im Sheet `Daily Tracking` M29:N30 zusammenfuehrung aufheben, in N29 `Qualität` schreiben (Open question 10, `specs/features/daily-import.md`, `2fc90db`).
* Phase 20: in den Einstellungen Logbuch Script URL, Token und Logbuch Sheet ID, ein echter Satz live.
* Phase 18: Sheet ID eintragen, nach der ersten geloggten Einheit Werte gegen das Logbuch pruefen.
* Phase 10 und 15: Apps Script bereitstellen (`apps-script/README.md`), Shortcut einrichten (`docs/daily-import-setup.md`), Open questions 3 bis 6, 8, 9 der Daily Import Spec.
* Phase 14: Live Test mit echtem Bon. Phase 12: iPhone Test. Phase 13: Studio Test. Phase 9: Netzwerkpruefung des Live Laufs.
* Retros offen: Phase 9 und 13 bis 20 (siehe `specs/roadmap.md`).

## Phase 21 Trainer als Zweitmeinung (live seit 10.11.2026)

Auf `main`: `4410c57` (PR 1, Regelwerk und korrigierter TDEE Schaetzer) und `e44b652` (PR 2, Fixture `test/fixtures/body/` versioniert, es fiel unter `test/fixtures/*` und liess den ersten Deploy scheitern). Deploy gruen, Bereich `second-opinion` live. Spec `specs/features/coach.md`, ADR 0011, Katalog `docs/coach-regeln.md`, Parameter `src/config/coachRules.ts`, Regeln unter `src/coach/`. Falle: neue Ordner unter `test/fixtures/` brauchen eine Ausnahme in `.gitignore`, nach dem Commit mit `git ls-files` pruefen.

Nachtrag 10.11.: Zeilen ohne Ergebnis zeigen `Noch keine Zahl`, `Fehlt:` und `Stand:` (Branch `claude/opinion-klarer`, Push wartet auf Freigabe). Beim Nutzer verweigerte am 10.11. fast jede Regel: Kalorien nur an 12 der letzten 14 Tage, keine Waegung seit 01.11., Tab `Body` fehlt.

Offen beim Nutzer: Tab `Body` im Gym Logbuch (`date`, `bodyfat_pct`, `waist_cm`, `note`), Blick auf die Zweitmeinung mit echten Daten, Open questions 4 und 6 der Spec, Retro. Die Remote Branches `claude/fitness-trainer-youtube-54f17d`, `claude/phase21-body-fixture` und `claude/phase21-doku` sind gemergt und koennen nach Freigabe weg.

## Phase 20 Logbuch im Dashboard (kurz)

Spec `specs/features/logbook-in-dashboard.md`, ADR 0010. 20.0 bis 20.5 live. 20.5 macht das Formular eins zu eins wie das Logbuch (Platzhalter aus dem letzten Mal oder Plan, Hinweis mit Pfeil, `Hernie beachten` in Amber). Neu: `src/parse/plan.ts`, `src/logbook/`, `src/config/logbookAccess.ts` (Schluessel `fitness_logbook_access_v1`). Training zeigt nur das Logbuch. Im Sheet angelegt: Tabs `Plan` und `PlanSettings`, Einheit 03.11. in `TrainingSets` und `TrainingLog`.

Annahmen 20: Plan Pflichtspalten ohne typ, lastReps, kind. Ohne `rest` kein Timer, ohne `load_step` kein Aufwaermhinweis. Tagesvorwahl ueber den Wochentag im Label, sonst Tag nach der letzten Einheit. Sitzungen ohne Plantag gelten als gesendet (Risiko: faellt ein Tag aus dem Plan, wird seine offene Sitzung nie gesendet). Gesendete Sitzungen bleiben 7 Tage lokal.

## Phase 19 und 18 (kurz)

Phase 19 live (`89b3a04`, ADR 0009, `DESIGN.md`). Phase 18 live (`1f74d65`, ADR 0008): Training aus Tab `TrainingSets` der Tabelle `Gym Logbuch`, Parser `src/parse/trainingSets.ts`, Spalten `id`, `date`, `tag`, `exercise`, `muscle`, `set`, `kg`, `reps`. Annahmen 18 und Details im Archiv.

## Phasen 9 bis 17 (kurz)

Phase 9 Plangenerator, 11 Kochansicht, 12 PWA, 13 Heute und Training eintragen, 14 Kassenbon, 15 Gewicht und Schritte, 16 Zubereitung, 17 Rezepte: live, Einzelheiten in den Archiven. Falle Dauerpreise: der Sonntagslauf ersetzt mit juengerem Muskelmarkt Datum die manuellen Aldi Sued Preise (`32d6147`), Kidney Bohnen kommen dann als Grossgebinde 3060 g zurueck.

## Phase 10 Daily Import

10.1 Kern und 10.2 Huelle sind mit Phase 13.2 und 13.3 in `main` gelandet (`3e80c01`, `eb2163c`, Ordner `apps-script/`). Offen: 10.3 und 10.4 beim Nutzer.

## Annahmen und offene Fragen

* Annahme: Die Aufgabe nannte die Retros 11 und 12 als fehlend, `docs/historie.md` enthaelt beide. Offen gefuehrt sind daher 9 und 13 bis 20. Bitte bestaetigen.
* Offene Frage: Sollen die lokalen Branches und die Remote Branches `claude/mobile-app-*`, `rewrite` aufgeraeumt werden?
