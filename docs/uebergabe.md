# Uebergabe

Stand 26.10.2026, Phase 11 abgeschlossen und live, Phase 12 live seit 27.10.2026, offen nur der iPhone Test des Nutzers. Phase 13 Spec zur Freigabe.

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

Rest 12.4 erledigt 27.10.2026. Commits `7169819` Heute, `d62081f` Training
plus Diagrammfarben, `3b218f9` Verlauf, `b65970a` Aliase und Uebergangsregeln
entfernt, `49750b3` `DESIGN.md` auf gebaute Werte. Neu `src/ui/cards.ts`
(`card`, `refusalCard`, `valueNode`, `mark`) und `src/ui/palette.ts`
(`COLORS` liest bei jedem Zugriff die Custom Properties, `parseColor`,
`withAlpha` mit Test). Schemawechsel verwirft alle Diagramme
(`destroyAllCharts`) und zeichnet den aktiven Abschnitt neu; live nicht
geprueft, die Emulation im Browser Pane loest kein `change` aus.
Training: Uebungen als `.list` aus `button` Zeilen, Tippen waehlt die
Detailansicht, Trainingstag als `.chips`, beide `select` und `t-table` weg.
Verlauf: Zeitraum und Gewichtsmodus als `.chips`, alles als Magnetkarten,
Verweigerungen als `.refusal` mit `keine Aussage`. PNG Export ueber
`data-export` oder `.card-label` an allen 15 Diagrammen. Entfernt: Erklaersatz
`.analysis-note`, Legende der Zielbereiche, `segmented()`. Entscheidung dieser
Sitzung: Zielbereiche faerben wie Heute (getroffen gruen, sonst rot), keine
neue Rotschwelle, sie waere eine Bewertung ohne Grundlage im Sheet.
Bundle gzip: Haupt Chunk 35,82 kB (Ziel 40), CSS 5,24 kB (Ziel 8), `charts`
74,07 kB (Ziel 78), alle JS Chunks 204,44 kB (Grenze 207,61). 350 Tests.
Geprueft je Ziel bei 375 und 1280 px, hell und dunkel, ohne waagerechten Lauf.
Bekannt: Muskelgruppen im Volumendiagramm haben 14 feste Toene (in
`DESIGN.md` als Ausnahme benannt). Mit der Fixture ergeben 14 und 30 Tage
keine Waegungen und zeigen die bestehende Fehlermeldung, kein Rueckschritt.

12.5 PWA erledigt 27.10.2026, Commit `6a6eb92`. `vite-plugin-pwa` 1.3.0 mit
`injectManifest` und eigenem `src/sw.ts`; die Regel der erlaubten URLs ist die
reine Funktion `classifyRequest` in `src/pwa/policy.ts` mit Test
(`test/pwa-policy.test.ts`). Nur GET der eigenen Herkunft unter dem Basispfad:
Navigation Netz zuerst (4 s), Rueckfall `index.html` aus dem Precache;
`assets/` Cache zuerst (`assets-runtime`, beim Aktivieren geleert);
`data/prices.json` und `data/regular_prices.json` Netz zuerst (`data`). Alles
andere geht vorbei. Updateweg ohne `skipWaiting`, Registrierung ueber
`registerSW.js` (ausserhalb des Haupt Chunks). Icons aus `public/icon.svg`
mit `npm run icons` (`pwa-assets.config.ts`), PNG committet. Manifest Werte in
`src/config/pwa.ts`. CSP plus `worker-src` und `manifest-src`, Test prueft die
volle Liste der Direktiven.

Annahmen 12.5 (Standard gewaehlt, ohne Rueckfrage):
* `injectManifest` statt `generateSW`: innerhalb ADR 0006 Variante A, noetig
  fuer Netz zuerst bei `index.html` und eine testbare URL Regel
* `apple-mobile-web-app-status-bar-style` `default`, weil `black-translucent`
  weisse Statusleistenschrift auf heller Emaille zeigt. Im Live Test pruefen,
  wie die Leiste im dunklen Schema aussieht
* `viewport-fit=cover` neu, ohne ihn liefert `env(safe-area-inset-*)` auf
  dem iPhone null. Die Regeln in `src/styles.css` gab es schon
* Hintergrund und Themenfarbe im Manifest `board` `#eceeed`, `theme-color`
  im `index.html` hell und dunkel getrennt

Geprueft im gebauten Stand (`vite preview`, Browser Pane): Service Worker
aktiv, Cache Storage nur eigene Pfade nach Durchlauf aller Ziele mit
Dummy Zugangsdaten (zwei Sheets Anfragen gingen am Service Worker vorbei),
Offlinestart bei gestopptem Server mit Verlauf samt Diagrammen und Einkauf
samt Preisen. Deploy simuliert: alte Sitzung laedt ihren `charts` Chunk aus
dem alten Precache, obwohl der Server ihn nicht mehr hat; Neuladen zeigt die
neue Version. Die neue Version wird aktiv, wenn kein Tab der alten mehr offen
ist. Die Manifest Ansicht von Chrome DevTools war im Pane nicht erreichbar,
Pflichtfelder und Icons sind von Hand geprueft; die Warnungsfreiheit gehoert
in die Lighthouse Messung von 12.6.
Bundle gzip: Haupt Chunk 35,82 kB, CSS 5,24 kB, `charts` 74,07 kB, alle JS
Chunks 204,43 kB, `sw.js` 6,78 kB (Ziel 8), `index.html` 3,16 kB. 361 Tests.

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

Startprompt 13.1 (neue Sitzung, Ordner dieses Worktrees): Lies CLAUDE.md,
specs/roadmap.md, docs/uebergabe.md (Abschnitt Phase 13) und
`specs/features/training-log.md`. Setze 13.1 um (Teil A): `Heute` zeigt genau
drei Magnetkarten (Gewicht mit Datum, Trend als Wochenrate, Gesamtverlust),
alles andere von `Heute` an den Anfang von `Verlauf` `Analyse`, ohne
Aenderung in `src/analytics` und `src/parse`. Tests, `npm run check`, Build,
Pruefung bei 375 px hell und dunkel, Bundle Zahlen im Commit, Uebergabe und
Startprompt 13.2. Danach 13.2 bis 13.4 nach Plan der Spec. Nicht pushen.

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
