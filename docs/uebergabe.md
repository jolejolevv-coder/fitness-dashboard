# Uebergabe

Stand 26.10.2026, Phase 11 abgeschlossen und live, Phase 12 in Arbeit.

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

12.0 erledigt: Mission und Tech Stack angepasst. Gemessen: Chart.js 71,06 kB,
`src/charts/` 4,79 kB, Rest des Haupt Chunks 33,72 kB gzip. Ziele in der
Budget Tabelle: Haupt Chunk hoechstens 40 kB, Chunk `charts` hoechstens 78 kB.
Gepinnt `vite-plugin-pwa` 1.3.0 (Workbox 7.4.1) und
`@vite-pwa/assets-generator` 1.0.4, nur installiert, noch nicht eingebunden.
Bewusst nicht 2.0.0: erst drei Wochen alt, 1.3.0 deckt Vite 6 ab.

12.1 freigegeben. Entwurf nur lokal unter
`public/preview/mobile-mockup.html` (gitignored, echte Werte aus den Fixtures),
anzusehen mit `npx vite` unter `/fitness-dashboard/preview/mobile-mockup.html`.
Richtung Trainerboard (impeccable Seed `29b8874f`): Magnetkarten auf Emaille,
Markerfarben mit fester Bedeutung, blauer Magnet fuer das Aktive, Systemziffern
`ui-rounded`, kein Webfont. Vorschlag hell als Grundform, dunkel ueber
`prefers-color-scheme`. Icons A (Wortmarke BR) und B (Verlauf mit Magnet).
`PRODUCT.md` aus den freigegebenen Specs abgeleitet, ohne eigene
Interviewrunde. Segmentmagnet im Entwurf schon auf `transform` umgestellt,
im Bau ebenso halten.

`DESIGN.md` plus Sidecar `.impeccable/design.json` committet (`acc0baa`),
ohne Werte aus den Fixtures. Befunde des Documenters fuer 12.4: `ink-3` als
Text unter 4,5:1 (Datenbasis, inaktive Navigation), rote und gruene Kapsel
knapp unter 4,5:1, Navigationsmagnet im Entwurf ueber `left` statt
`transform`. Linke Leiste und Blatt stehen dort nur vorlaeufig aus der Spec.

12.2 Shell erledigt 26.10.2026. `src/ui/router.ts` reine Funktion (Hash zu
Ziel und Segment, `resolveRoute` weicht ohne Sheet auf Kueche aus und laesst
den Hash stehen, mit den Daten kehrt das Ziel zurueck), `src/ui/shell.ts`
(Navigation als Links auf Hashes, oben Titel, Datenalter, Aktualisieren und
Einstellungen, Segmentleiste, Blatt als `dialog` mit `showModal`).
`tabs.ts` entfernt. Planansicht kommt aus der Route (`setPlanView`), die
interne Segmentwahl im Plan ist weg. Fehlen Zugangsdaten, oeffnet das Blatt
beim Start wie frueher der Banner. Nutzungszaehler zaehlt jetzt Routen wie
`verlauf/wellness` statt Reiternamen. Tests: Router, Navigation ohne Sheet,
kein `innerHTML` in `src/`. 345 Tests. Bundle gzip: Haupt Chunk 108,84 kB
(+0,79), CSS 5,62 kB (+0,39), `index.html` 3,38 kB (+0,30). Geprueft bei
375 px auf allen zwoelf Routen ohne waagerechten Lauf und bei 1280 px mit
linker Leiste.

12.3 Charts nachladen erledigt 26.10.2026. `src/charts/index.ts` ist der
einzige Einstieg in den Chunk, `src/ui/charts.ts` laedt ihn (`loadCharts`,
`loadedCharts`) nach dem Muster von `plan.ts`. Abschnitte mit Diagrammen
(`overview`, `nutrition`, `wellness`, `weeks`, `training`) bekommen das Modul
als Argument, `main.ts` wartet in `renderChartSection` darauf und zeichnet nur,
wenn die Route waehrenddessen nicht gewechselt hat. Ein gescheiterter Abruf
steht in der Datenalterzeile, der Abschnitt bleibt markiert und der naechste
Aufruf versucht es neu. Name ueber `chunkFileNames` in `vite.config.ts`, nicht
ueber `manualChunks`: das zog `ui/format` und `analytics` in den Chunk und
`index.html` lud ihn per `modulepreload` sofort. Test `test/charts-chunk.test.ts`
verbietet statische Importe aus `src/charts/` ausserhalb des Ordners. 347 Tests.
Bundle gzip: Haupt Chunk 35,58 kB (Ziel 40), `charts` 74,32 kB (Ziel 78), alle
JS Chunks zusammen 204,47 kB (Grenze 207,61), CSS 5,62 kB unveraendert.
Geprueft im Dev Server bei 375 px und im gebauten Stand (`vite preview`,
Eintrag `build-preview` in der lokalen `.claude/launch.json`) bei 1024 px:
Heute und Kueche laden nur `index`, `charts` erst mit Verlauf, alle 19
Diagramme auf allen Verlauf Segmenten und in Training gezeichnet,
Gewichtsmodus und Uebungsauswahl zeichnen nach, Direktaufruf
`#verlauf/gewicht` geht. Naechster Schritt 12.4 Oberflaeche, Reihenfolge
Kueche, Heute, Training, Verlauf.

## Phase 11 Kochansicht

Abgeschlossen und live seit 26.10.2026. Spec `specs/features/recipes.md`,
Branch `recipes` (Worktree `.claude/worktrees/recipes-84af64`) per Fast
Forward auf `origin/main` gepusht (`8aed12d..035f8e3`), Deploy gruen, Live
Bundle gleich dem lokalen Build. 353 Tests, `npm run check` und Build sauber,
Chunk `cook` 4,1 kB gzip, Haupt Bundle 108,05 kB gzip. Details zu 11.0 bis
11.2 in `docs/uebergabe-archiv-2026-10-26.md`.

Entscheidungen des Nutzers (26.10.2026): Handytest live statt lokal im WLAN,
weil Wake Lock nur unter HTTPS laeuft. Handytest in echter Prep Session
bestanden, Ton, Vibration und Wake Lock gehen. `data/recipes.json` bleibt
unveraendert: OptiGrill 210 °C, 800 W Mikrowelle und Chili mit einem Halt
stimmen.

Offen:
* Lokales `main` im Hauptordner (`9b3d319`, Phase 10 Spec) ist von
  `origin/main` abgezweigt und noch nicht gepusht. Wer Phase 10 weiterfuehrt,
  muss `origin/main` hineinmergen; Konflikte in `docs/historie.md` und
  `specs/roadmap.md` sind erwartbar. Die untracked `specs/features/recipes.md`
  im Hauptordner ist gleich der committeten und muss vor dem Merge weg
* Retro Phase 11 und diese Uebergabe liegen uncommittet im Worktree `recipes`
* Nicht umgesetzt: Stueckangaben neben Gramm (`gramsPerPiece`), steht in der
  Mustertabelle der Spec ohne Akzeptanzkriterium. Nur auf Wunsch nachziehen
* Laufende Timer melden sich nur bei offener Kochansicht, nach Neuladen
  erst `Kochen` tippen

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

## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.
