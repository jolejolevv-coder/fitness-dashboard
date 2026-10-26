# Uebergabe

Stand 26.10.2026, Phase 11 abgeschlossen und live, Phase 12 in Arbeit (12.4 erledigt 27.10.2026, naechster Schritt 12.5 PWA).

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

Startprompt 12.5 (neue Sitzung, Ordner dieses Worktrees, Branch
`claude/mobile-app-b71746`): Lies CLAUDE.md, specs/roadmap.md,
docs/uebergabe.md (Abschnitt Phase 12), `specs/features/mobile-app.md`
(Was Web App hier heisst, Harte Regeln, Bundle Budget, Acceptance criteria
PWA) und ADR 0006. Setze 12.5 um: `vite-plugin-pwa` 1.3.0 einbinden, Manifest
`Body Recomp` standalone, Icons 192, 512, maskable, apple touch 180 aus Icon B
mit `@vite-pwa/assets-generator`, Service Worker cached nur die App Huelle der
eigenen Herkunft und `data/prices.json`, `data/regular_prices.json`, nie
`googleapis.com` oder `anthropic.com`, Test der erlaubten URLs. CSP nur um
`worker-src 'self'` und `manifest-src 'self'` ergaenzen, als Test.
`env(safe-area-inset-*)` pruefen. Updateweg so, dass nachgeladene Chunks einer
alten Version eine offene Sitzung nicht abbrechen. `sw.js` hoechstens 8 kB.
Pruefen im gebauten Stand (`vite preview`), Cache Storage ohne fremde URLs.
Der Live Test auf dem iPhone (Installation, Flugmodus, Kochansicht) ist ein
Schritt des Nutzers nach dem Merge in 12.6. Nicht pushen.

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
