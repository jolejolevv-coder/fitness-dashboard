# Uebergabe

Stand 27.10.2026, Phase 12 live, offen nur der iPhone Test des Nutzers. Phase 13 freigegeben, 13.1 bis 13.4 erledigt, naechster Schritt 13.5 mit dem Nutzer.

## Wo wir stehen

Dashboard live, Phasen 0 bis 12 fertig (siehe `specs/roadmap.md`). Phase 8
Notizen und offene Punkte des Nutzers (Anfrage Muskelmarkt, Dauerpreise) in
`docs/uebergabe-archiv-2026-10-26.md`. pstack aktiv, Freigabeprozess geht vor.

## Phase 12 Mobile App

Spec `specs/features/mobile-app.md` und ADR 0006 freigegeben 26.10.2026.
Branch `claude/mobile-app-b71746` (Worktree `.claude/worktrees/mobile-app-b71746`),
abgezweigt von `claude/mobile-app-spec` (`233c9c5`, enthaelt `origin/main`).
Merge Ziel ist `origin/main`, nie das lokale `main` im Hauptordner.

Entscheidungen (26.10.2026):
* PWA mit Service Worker ueber `vite-plugin-pwa`, rein lesend, cached nur die
  App Huelle der eigenen Herkunft, nie `googleapis.com` oder `anthropic.com`
* Eine Oberflaeche mobile first, vier Ziele unten, ab 900 px Navigation links
* Chart.js als nachgeladener Chunk
* Freigabe 12.1 (26.10.2026): Richtung Trainerboard, Icon B (Verlauf mit
  Magnet auf Schiefer), hell und dunkel nach Systemeinstellung. Damit gilt
  auch `PRODUCT.md` als bestaetigt
* Die installierte App auf dem iPhone hat einen eigenen localStorage,
  Zugangsdaten dort einmal neu eintragen

12.0 bis 12.3 erledigt 26.10.2026, 12.4 Kueche `0cb300f`. Einzelheiten in
`docs/uebergabe-archiv-2026-10-26.md`. Messweg: `npm run build`, gzip Spalte.
Gebauten Stand ansehen mit Eintrag `build-preview`, Dev Server mit `dev` der
lokalen `.claude/launch.json` (nicht committet). Fixtures aus
`public/preview/*.json` nur in localStorage `fitness_cache_v1`.

Rest 12.4 erledigt 27.10.2026, Einzelheiten in `docs/uebergabe-archiv-2026-10-26.md`.

12.5 PWA erledigt 27.10.2026 (`6a6eb92`), Einzelheiten und Annahmen in
`docs/uebergabe-archiv-2026-10-26.md`.

12.6 Abschluss 27.10.2026: Branch per Vorspulen nach `origin/main`
gepusht (`5e3f3cd..9baa8af`), Deploy gruen. Live geprueft: `sw.js`,
`manifest.webmanifest`, Icons und `registerSW.js` liefern 200, CSP live mit
`worker-src` und `manifest-src`, Service Worker aktiv mit Scope
`/fitness-dashboard/`, Cache Storage nur eigene URLs (Precache 19, `data` 2),
keine Konsolenfehler. Lighthouse 12.8.2 mobil live ohne Sheet: Performance,
Accessibility, Best Practices je 100. Lighthouse 12 kennt keine PWA Kategorie
mehr. `git diff origin/main -- src/analytics src/parse` war vor dem Merge leer.

Test des Nutzers auf dem iPhone (offene Acceptance criteria der Spec):
1. Safari, me.nahobinoco.com/fitness-dashboard/, Teilen, Zum Home Bildschirm
2. App starten, Zugangsdaten in Einstellungen neu eintragen (eigener Speicher)
3. Vollbild ohne Browserleiste, Statusleiste und Home Indikator verdecken
   nichts, im hellen und im dunklen Schema
4. Einmal alle vier Ziele oeffnen, dann Flugmodus, App ganz schliessen und neu
   starten: letzte Werte mit Alter, Plan, Einkauf, Kochen
5. Kochansicht: Wake Lock, Ton, Vibration
6. Optional am Mac: Chrome DevTools, Application, Manifest ohne Warnung
Ein Update wird aktiv, wenn die App ganz geschlossen war. Bei Fehlern: Befund
in eine neue Sitzung, Rueckfall ueber `selfDestroying` (ADR 0006).

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
Freigabe. Annahmen siehe Spec, Abschnitt Stand.

## Phase 11 Kochansicht

Abgeschlossen und live, Notizen in `docs/uebergabe-archiv-2026-10-26.md`.

## Phase 9 Plangenerator

Umgesetzt, gemergt und live seit 25.10.2026. Details, Bundle Zahlen und die
Schritte fuer den Live Lauf stehen in `docs/uebergabe-archiv-2026-10-26.md`.
Offen beim Nutzer: Netzwerkpruefung des Live Laufs, danach Retro Phase 9.

## Phase 10 Daily Import

10.1 Kern und 10.2 Huelle sind mit Phase 13.2 und 13.3 auf diesem Branch
gelandet (`apps-script/`). Offen: 10.3 Bereitstellung durch den Nutzer nach
`apps-script/README.md`, 10.4 Shortcut, Open questions 3 bis 6, 8 und 9 der
Spec. Alte Notizen: `docs/uebergabe-archiv-2026-10-26.md`.
