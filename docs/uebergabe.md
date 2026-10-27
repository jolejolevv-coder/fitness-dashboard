# Uebergabe

Stand 27.10.2026, Phase 12 live, offen nur der iPhone Test des Nutzers. Phase 13 freigegeben, 13.1 bis 13.4 erledigt, naechster Schritt 13.5 mit dem Nutzer.

## Wo wir stehen

Dashboard live, Phasen 0 bis 12 fertig (siehe `specs/roadmap.md`). Phase 8
Notizen und offene Punkte des Nutzers (Anfrage Muskelmarkt, Dauerpreise) in
`docs/uebergabe-archiv-2026-10-26.md`. pstack aktiv, Freigabeprozess geht vor.

## Phase 12 Mobile App

Live. Notizen in `docs/uebergabe-archiv-2026-10-26.md`.

## Phase 13 Heute und Training eintragen

Wunsch des Nutzers nach dem ersten Blick am Handy (27.10.2026): `Heute` auf das
Wichtigste, `Verlauf` bleibt, unter `Training` Werte eines Tags eintippen, die
im Sheet landen. Kueche spaeter. Entschieden: Apps Script als Schreibweg, Felder
Load, Reps Ist, Notes, nur leere Zellen, auf `Heute` nur Gewicht und Trend.
Spec `specs/features/training-log.md` und ADR 0007 freigegeben 27.10.2026,
Open questions 1 bis 3 wie vorgeschlagen (eigenes `TRAINING_TOKEN`, Vorauswahl
erste Woche ohne `Reps Ist`, Segmente `Eintragen` und `Auswertung`), 4 (CORS
der Web App) wird in 13.3 als erstes geprueft. 13.0 erledigt: harte Regel in
`CLAUDE.md` und `specs/mission.md` auf zwei Schreibwege ueber das Apps Script
umgestellt. Gearbeitet wird weiter im Worktree `.claude/worktrees/mobile-app-b71746`
auf Branch `claude/mobile-app-b71746` (Stand `origin/main` plus Phase 13 Doku),
Merge nach `origin/main` nur nach Freigabe des Nutzers.

13.1 (`0513e2d`) und 13.2 (`3e80c01`) erledigt 27.10.2026, Einzelheiten und
Annahmen in `docs/uebergabe-archiv-2026-10-26.md`. Annahme aus 13.2 bleibt
offen: ob `Mesocycle 1` eine Spalte `Notes` hat, wird in 13.5 am echten Tab
geprueft.

13.3 erledigt 27.10.2026: `apps-script/daily-import.js` mit `doPost`,
Aktionen `daily` (Vorgabe ohne `action`, schliesst 10.2 ab) und `training`,
je eigenes Token aus den Script Properties, Pruefung vor der Sperre,
`LockService`, Antwort JSON mit `version` (`SCRIPT_VERSION`), Ausnahmen als
`internal` ohne Details, kein Log. Neu im Kern `sheetValue`: reine Dezimalzahl
als Zahl, alles andere mit Apostroph als Text (kein Datum aus `9-9`, keine
Formel aus `=`). Test `test/web-app.test.ts` mit nachgebauten Diensten, 453
Tests. Anleitung `apps-script/README.md` mit Test gegen Kopie `Mesocycle 99`
und CORS Probe. Bereitstellung und CORS Probe (Open question 4) macht der
Nutzer, siehe README.

13.4 erledigt 27.10.2026: Unter `Training` die Segmente `Auswertung` und
`Eintragen` (`#training/eintragen`); `Eintragen` erscheint nur mit Apps Script
URL und Token aus den Einstellungen (localStorage `fitness_log_access_v1`, nur
URLs ab `https://script.google.com/`). Chunk `log` (`src/log/`): liest den
Mesocycle Tab wie das Script, Chips fuer Woche und Tag, Vorauswahl erste Woche
ohne `Reps Ist`, je Uebung Soll und die Felder `Load`, `Reps Ist`, `Notes`
(nur mit Spalte), belegte Zellen gesperrt mit Wert. Entwurf sofort im
localStorage `fitness_log_draft_v1`. `Senden` ohne Content Type, offline
gesperrt; Antwort je Feld `geschrieben`, `belegt` oder Fehlercode, danach
Neuladen der Daten. Ist die Antwort nicht lesbar (CORS), meldet die App nur
den Versand und laedt neu. CSP `connect-src` um `script.google.com` und
`script.googleusercontent.com`, beide mit Test, ebenso die Vorbeileitung im
Service Worker. 471 Tests. Bundle gzip: Haupt Chunk 36,29 kB (+0,58), `log`
2,98 kB, CSS 5,32 kB. Geprueft im Build bei 375 px hell und dunkel mit
erfundenem Endpunkt, ohne Senden.
Annahmen: Summenzeilen unter den Uebungen zaehlen nicht (erste Leerzeile
beendet den Block, Befund an den Vorschaudaten, in der Spec nachgetragen);
Vorauswahl gilt fuer den zuerst gewaehlten Tag, danach je Tagwechsel neu;
Offline Sperre nur im Code geprueft, nicht im Browser.

Startprompt 13.5 (Ordner dieses Worktrees): Lies CLAUDE.md, specs/roadmap.md,
docs/uebergabe.md (Abschnitt Phase 13), `specs/features/training-log.md` und
`apps-script/README.md`. 13.5 braucht den Nutzer: Script bereitstellen, CORS
Probe, Test gegen Kopie `Mesocycle 99` (README), dann App gegen die Kopie
(Einstellungen URL und Token, ein Senden, zweites Senden `belegt`), offene
Kriterien der Spec abhaken, Freigabe zum Merge nach `origin/main` einholen,
nach Merge Live Test im Studio, Retro Phase 13 in `specs/roadmap.md`. Nicht
ohne Freigabe pushen.

Stand 13.5 (27.10.2026): Script als eigenes Projekt auf script.google.com
(`97489cd`, Blatt ueber Script Property `SHEET_ID`, weil das Blatt schon ein
gebundenes Projekt mit eigenem `doPost` hat, `Makros.gs`, Gewichtsimport aus
Health Auto Export, bleibt unberuehrt). Nutzer hat die drei Dateien per
Zwischenablage eingefuegt und bereitgestellt. Doppelter Inhalt im Projekt behoben, neue Version
bereitgestellt. Probe mit falschem Token: `unauthorized`, Version `13.5`. CORS
geprueft aus dem gebauten Stand auf localhost mit CSP: Antwort lesbar (Open
question 4 erledigt). Kopie Test bestanden gegen `Mesocycle 99`: leere Zellen
`written`, zweites Senden `occupied`, falsches Token `unauthorized`, Notes
einmal `written` dann `occupied`. Zellvergleich mit `Mesocycle 3` zeigt nur
die geschriebenen Zellen. Offline sperrt `Senden`, Entwurf bleibt.
Panne: die lokale App stand auf Trainingstab `Mesocycle 1`, das Senden aus der
App schrieb deshalb `60` und `8,8` in `Mesocycle 1`, W9, Day 1, Pulldown
(Zellen CY34 und CZ34). Kein Fehler im Code, falscher Tab in den
Einstellungen. Nutzer hat die zwei Zellen geleert, `Mesocycle 99` geloescht
und ein neues `TRAINING_TOKEN` gesetzt. Nach Freigabe am 27.10.2026 nach
`origin/main` gepusht (`c7fb5e8`), Deploy gruen, live mit Chunk `log` und
CSP Hosts. Offen: Live Test im Studio durch den Nutzer (neues Token in der
App eintragen), danach Retro Phase 13 in `specs/roadmap.md`.
Phase 13.6 (Mesocycle Chips im Segment Eintragen, Spec
`specs/features/log-tab-choice.md`) umgesetzt und lokal geprueft, Push nach
Freigabe. Annahmen siehe Spec, Abschnitt Stand. Live
getestet, danach Nachtrag: Auswertung folgt dem Chip, Tageswechsel behaelt
die Woche, Cache traegt seinen Trainingstab. Eintragen steht unter Training
links und ist Vorgabe (`46ab072`). Alles live auf main. Offen: Retro
Phase 13 in `specs/roadmap.md`, sobald der Nutzer den Studio Test bestaetigt.

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
