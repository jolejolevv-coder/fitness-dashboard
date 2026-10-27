# Uebergabe

Stand 27.10.2026, Phase 12 live, offen nur der iPhone Test des Nutzers. Phase 13 freigegeben, 13.1 erledigt, naechster Schritt 13.2.

## Wo wir stehen

Dashboard live, Phasen 0 bis 6 fertig (siehe `specs/roadmap.md`). Neu: Modul
Ernaehrung und Einkauf als Phase 8, uebernommen aus einem Claude Chat.

* Handoff: `docs/HANDOFF.md` (vollstaendig, Seed Daten und Preis Pipeline)
* Spec: `specs/features/nutrition-shopping.md`, freigegeben, Konflikte 1 bis 5
  am 25.10.2026 entschieden, Mission angepasst (mobil, zweite Datenquelle)
* ADR: `docs/adr/0002-preise-ueber-actions-cron.md`, angenommen
* pstack ist fuer dieses Projekt aktiv seit 25.10.2026, Modelle in
  `.claude/rules/pstack-models.md`. Freigabeprozess des Nutzers geht vor

## Naechster Schritt

Phase 8 ist abgeschlossen und live seit 25.10.2026 (Merge `nutrition` nach
`main`). Erster manueller Lauf von `prices.yml` erfolgreich: 12 Angebote,
9 Dauerpreise gesammelt, Reiter Einkauf live bei 375 px geprueft. Ein
Fehltreffer (Aufschnitt als Haehnchenbrustfilet) ist behoben. Cron laeuft ab
jetzt Sonntag 18:00 Berlin.

Offen beim Nutzer:
1. Anfrage an info@muskelmarkt.de
2. Dauerpreis Startwerte in `public/data/regular_prices.json` mit
   `source: "manual"` eintragen
3. Nachzuholen aus Phase 6: Lighthouse Messung

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

13.1 erledigt 27.10.2026: `Heute` zeigt drei Magnetkarten, `Gewicht` (letzte
Waegung, Datum, Zahl der Waegungen), `Trend pro Woche` (geglaettet, Plan und
Basis, rot ab 1,5facher Sollrate wie zuvor) und `Gesamtverlust` (erste gegen
letzte Waegung, `Zugelegt` bei Zunahme). Am Anfang von `Verlauf` `Analyse`
stehen neu `Fortschritt` (Fortschritt zum Ziel mit Balken, Compliance),
`Insights` und `Tagesdurchschnitt`; Wochenrate und Zieldatum standen dort schon
(`Rate`, `Ziel N kg`). Kopfzeile `Makrocycle 1` und Hinweis der Zielwerte
bleiben auf `Heute`. `src/analytics` und `src/parse` unveraendert.
Annahmen: Einheit `kg/Woche` brach bei 375 px um, daher Bezeichnung `Trend pro
Woche` mit Einheit `kg`; ohne Zielgewicht zeigt `Fortschritt zum Ziel` die
Verweigerung `Kein Zielgewicht` statt zu fehlen; die Unterzeile von
`Tagesdurchschnitt` nennt jetzt den Gesamtzeitraum, vorher irrtuemlich den
gefilterten (`rangeCaption` in `src/ui/format.ts`). Test `test/today.test.ts`.
Bundle gzip: Haupt Chunk 35,71 kB (vorher 35,82), CSS 5,24 kB, `charts`
74,07 kB. 365 Tests. Geprueft im Build bei 375 px hell und dunkel, ohne
waagerechten Lauf.

Startprompt 13.2 (Ordner dieses Worktrees): Lies CLAUDE.md, specs/roadmap.md,
docs/uebergabe.md (Abschnitt Phase 13) und `specs/features/training-log.md`.
Setze 13.2 um: `apps-script/daily-import-core.js`, Tests und Fixtures aus
Branch `claude/daily-import-36c9f1` (Commit `b5a8081`) uebernehmen, dazu
reine Funktionen `findWeekBlock`, `findExerciseRow`, `planTrainingWrites`
mit Tests per Vitest und `node:vm` gegen synthetische Tabs unter
`test/fixtures/`. Danach 13.3 und 13.4 nach Plan der Spec. Nicht pushen.

## Phase 11 Kochansicht

Abgeschlossen und live, Notizen in `docs/uebergabe-archiv-2026-10-26.md`.

## Phase 9 Plangenerator

Umgesetzt, gemergt und live seit 25.10.2026. Details, Bundle Zahlen und die
Schritte fuer den Live Lauf stehen in `docs/uebergabe-archiv-2026-10-26.md`.
Offen beim Nutzer: Netzwerkpruefung des Live Laufs, danach Retro Phase 9.

## Phase 10 Daily Import

Spec `specs/features/daily-import.md` und ADR 0005 freigegeben 25.10.2026.
10.0 erledigt: Mission und `CLAUDE.md` nennen den Daily Import als eigenen
Schreibweg, die Leseregel gilt dem Dashboard. Script wird unter `apps-script/`
versioniert. Naechster Schritt 10.1: reine Kernfunktionen `findDateRow`,
`mapHeaders`, `planWrites`, `validateRequest` in
`apps-script/daily-import-core.js`, Tests per Vitest und `node:vm`, synthetische
Tabellen unter `test/fixtures/daily-import/`. Vorher Open question 7 (Format von
`Time` und `Sleep`) am Rohexport in `testdata/` klaeren, keine Werte daraus
committen. Offen beim Nutzer: Open questions 3 bis 6, 8 und 9 der Spec.

Pruefung des Handoffs aus Phase 8 und alte Notizen: `docs/uebergabe-archiv-2026-10-26.md`.
