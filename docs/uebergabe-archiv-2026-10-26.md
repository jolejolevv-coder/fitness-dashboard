# Uebergabe Archiv 26.10.2026

Aus `docs/uebergabe.md` verschoben, als Phase 11.2 fertig war.

## Phase 9 Plangenerator

Spec `specs/features/plan-generator.md` am 25.10.2026 freigegeben. Phase 9.0
erledigt: ADR 0004 angenommen, `@anthropic-ai/sdk` 1.3.0 exakt gepinnt (Version
erst zwei Tage alt, Major 1.0 vom 21.10.2026, vor Updates Changelog lesen).

Gearbeitet wird im Worktree `/Users/jole/Downloads/fitness-dashboard-plan-generator`
auf Branch `plan-generator`, nicht im Projektordner. Sitzungen fuer Phase 9 dort
oeffnen. `test/fixtures/` und `test/golden/` sind lokal hineinkopiert, weil sie
nicht im Repo liegen.

Phasen 9.1 bis 9.3 erledigt (reine Funktionen in `src/generator/`, Planquelle
`src/ui/planSource.ts`, API Aufruf `src/generator/request.ts`). Details stehen
in `docs/historie.md` unter "Phase 9.1 bis 9.3".

Phase 9.4 umgesetzt (Stand 25.10.2026, 326 Tests, `npm run check` und Build
sauber). Auf Wunsch des Nutzers am 25.10.2026 vor dem Live Lauf nach `main`
gemergt und live (Commit `b436847`, Deploy gruen, CSP und Key Feld live). Neu:
* Konfigurationsdialog: Feld `input-anthropic-key`, gespeichert ueber
  `saveApiKey` beim Speichern, leer entfernt den Key
* Reiter Plan, vierte Ansicht `Vorschlag` (`src/ui/generator.ts`, eigener
  Chunk, erst beim Oeffnen geladen, `request.ts` und SDK erst beim Knopf):
  Ausschluesse als aufklappbare Liste `Ausschlüsse n von 49`, Wunschfeld, Knopf
  `Vorschlag erzeugen`, gesperrt mit Zahlenzeilen `API Key 0 von 1`,
  `Ziele 2 von 3`, `Lebensmittel 0 von 49`. Waehrend des Laufs `Abbrechen` und
  `Läuft 42 s, n Eingabe, m Ausgabe Tokens` (in place, ohne Neuzeichnen).
  Danach Statuszeile aus `statusLine`, Modell (mit `Fallback`), Kosten aus
  `usage` mit Preisstand, Fundliste, Tageswerte je Tag mit Zeile `Aktiv ...`
  des aktiven Plans darunter, Gerichte mit Tagen, Prep, Wunschliste.
  `Übernehmen` und `Export` nur bei bestandener Pruefung, Uebernahme ueber
  `adoptPlan`, danach Ansicht Woche
* `Export` auch in der Herkunftszeile des aktiven Plans. Drei Downloads
  `meals.json`, `rotation.json`, `prep.json` aus `src/generator/export.ts`,
  zeichengleich formatiert wie `data/` (Test gegen den Seed)
* `src/generator/input.ts`: `generateReadiness`, `buildGeneratorInput`,
  `currentOffers` (guenstigstes gueltiges Angebot mit Grundpreis)
* `src/config/csp.ts` und Plugin in `vite.config.ts`: CSP als `meta` nur im
  Build. `connect-src 'self' https://sheets.googleapis.com
  https://api.anthropic.com`, `script-src 'self'`, `style-src 'self'
  'unsafe-inline'`, `img-src 'self' data: blob:`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'none'`
* `roundedDayValues` aus `checkProposal` herausgezogen, auch fuer die Vorschau

Geprueft im Build (`vite preview`) bei 375 px mit lokalen Fixtures und einem im
Browser ersetzten `fetch` fuer `api.anthropic.com` (kein echter Aufruf): Lauf
mit Tokenzeile, verworfener und bestandener Vorschlag, Uebernahme, Einkauf
folgt, Ausschluss gespeichert, Verbindungsfehler als Status. Kein waagerechter
Seitenlauf im Reiter Plan, keine CSP Verstoesse in der Konsole. Chunks werden
erst beim Oeffnen der Ansicht bzw. beim Knopf geladen.

Bundle: Haupt Bundle 323,5 kB roh, 107,8 kB gzip. Gegen `main` +10,9 kB roh,
+3,7 kB gzip, davon 9.4 selbst +3,4 kB roh, +1,5 kB gzip (Rest aus 9.1 und 9.2,
Planquelle und Pruefung muessen beim Laden laufen). SDK 366 kB im eigenen
Chunk, `generator` 8,6 kB, `request` 7,0 kB. Die 5 kB Grenze gilt gzip gegen
`main` (Nutzerentscheidung 25.10.2026), damit eingehalten.

Bekannt: SDK 1.3.0 schickt den Key als `Authorization: Bearer`, nicht als
`x-api-key`. Bei der Netzwerkpruefung nach `authorization` suchen. Ein
Vorschlag lebt nur im Speicher, Neuladen verwirft ihn (Kosten sind dann weg).
Die Zeile `last-updated` im Kopf laeuft bei einer langen Fehlermeldung ueber
375 px hinaus (Bestand, nicht aus 9.4). Der Text im Konfigurationsdialog
"nie übertragen" stimmt fuer den Anthropic Key nicht mehr wortwoertlich.
`.claude/launch.json` (Konfiguration `preview-build`) liegt untracked.

Erster Live Lauf 25.10.2026: `Vorschlag geprueft`, 0,21 $, 6.267 Eingabe und
9.289 Ausgabe Tokens. Der Wunsch "vegetarisch" wurde ignoriert, weil der Prompt
Wuensche nur als Anregung fuehrte. Seitdem sind Wuensche im Prompt verbindlich
(`Wishes (binding)`, Regel gegen ausgeschlossene Lebensmittel). Garantiert
bleibt nur die Ausschlussliste, Freitext prueft niemand.

Naechster Schritt beim Nutzer (Live Lauf, danach Retro):
1. In der Anthropic Console eigenen Workspace mit monatlichem Ausgabelimit
   anlegen, darin einen Key erzeugen
2. Live Seite oeffnen, Key unter Einstellungen eintragen
3. Reiter Plan, Ansicht Vorschlag, `Vorschlag erzeugen`, Lauf abwarten
4. Netzwerkpruefung in den DevTools: Key nur in der Anfrage an
   `api.anthropic.com` (Kopfzeile `authorization`), an Google nur der Google Key
5. Danach Retro Phase 9 in `specs/roadmap.md`

## Phase 11 Kochansicht, Details 11.0 bis 11.2 (archiviert 26.10.2026)

Spec `specs/features/recipes.md`, freigegeben 26.10.2026. Branch `recipes`,
abgezweigt von `plan-generator`, Worktree
`.claude/worktrees/recipes-84af64`. Merge auf `main` erst nach
`plan-generator`. `test/fixtures/` und `test/golden/` sind lokal
hineinkopiert.

Phase 11.0 erledigt (26.10.2026, 337 Tests, `npm run check` und Build sauber,
Haupt Bundle unveraendert 107,8 kB gzip):
* Jeder Seed Schritt in `data/prep.json` hat eine `id`, Muster Session plus
  Gericht: `sunday-rice`, `sunday-egg-muffins`, `sunday-chicken`,
  `sunday-turkey`, `sunday-wedges`, `wednesday-chili`, `wednesday-rice`,
  `wednesday-chicken`, `wednesday-turkey`, `wednesday-wedges`
* `src/nutrition/types.ts`: `PrepStep.id` optional, neu `Recipe`
  (`stepId`, `device`, `instruction`, `temperatureC?`, `minutes`, `hold?`),
  `RecipeHold` (`afterMinutes`, `action`), `TEMPERATURE_DEVICES`
  (Airfryer, OptiGrill; Mikrowelle ohne Temperatur, Watt steht im Satz)
* `src/nutrition/recipes.ts`: `validateStepIds`, `validateRecipes` (Schritt
  existiert, ein Rezept je Schritt, Geraet aus `PREP_DEVICES` und gleich dem
  Schrittgeraet, Temperatur je Geraet, Halt vor Ende). Tests in
  `test/recipes.test.ts`. `recipes.json` wird bewusst nicht in `plan.ts`
  geladen, damit sie erst mit der Kochansicht im eigenen Chunk landet
* `src/generator/export.ts` gibt die `id` mit aus, sonst bricht der
  Vergleich mit dem Seed. Generierte Plaene haben weiter keine `id`
* `data/recipes.json`: zehn Eintraege, vom Nutzer am 26.10.2026 ohne
  Korrektur uebernommen. Unsicher und in 11.3 am Herd zu pruefen: OptiGrill
  210 °C (Stufe des Modells unbekannt), 800 W Mikrowelle geschaetzt, Chili
  (rund 3,4 kg) mit nur einem Halt

Phase 11.1 erledigt (26.10.2026, 353 Tests, `npm run check` und Build
sauber, Haupt Bundle unveraendert 107,8 kB gzip, weil `cook.ts` noch nirgends
importiert wird):
* `PrepStepResult.id` optional, `buildStep` reicht die Schritt `id` durch
* `src/config/cook.ts`: `COOK_STATE_KEY` (`fitness_cook_v1`),
  `MS_PER_SECOND`, `SECONDS_PER_MINUTE`, `MS_PER_MINUTE`,
  `MISE_EN_PLACE_POSITION` (0, Schritt N liegt auf Position N)
* `src/nutrition/cook.ts`, reine Funktionen, Zeit immer als `now` Parameter:
  `buildMiseEnPlace` (jede Zutat einmal, Summe, Gewuerze `null`),
  `attachRecipes` (Zuordnung ueber `step.id`, Feld `instructed` fuer
  `Anweisungen N von M Schritten`), Timer `startTimer`, `remainingMs`,
  `isFinished`, `dueEvents` (Halt vor Ende, bereits gemeldete stehen in
  `reported`, damit nach Neuladen nichts doppelt klingelt), `withReported`,
  `formatRemaining` (`m:ss`, aufgerundet). Zustand: `CookState` ist ein
  Objekt je Session `id` mit `checked`, `position`, `timers`;
  `parseCookState` verwirft einen Session Eintrag, sobald ein Feld
  unbrauchbar ist; `serializeCookState`, `sessionState`, `withSessionState`,
  `withoutSession` (Knopf Zuruecksetzen), `toggleChecked`, `withPosition`,
  `clampPosition`, `withTimer` (ein Timer je Schritt), `withoutTimer`
* Tests in `test/cook.test.ts`, darunter Mise en place gegen die Prep
  Checkliste mit und ohne Riegel Tag

Phase 11.2 erledigt (26.10.2026, 353 Tests, `npm run check` und Build
sauber). Haupt Bundle 108,05 kB gzip (+0,25 kB), Kochansicht eigener Chunk
`cook` 4,1 kB gzip mit `recipes.json`:
* `src/ui/plan.ts`: Knopf `Kochen` im Kopf jeder Prep Session, Zustand
  `cooking` (Session `id`, nur im Speicher, nach Neuladen wieder per Knopf).
  Die Kochansicht ersetzt in der Ansicht Prep die Checkliste, der Knopf
  `Abhaken zurücksetzen` ist dann ausgeblendet. Beim Oeffnen einmal nach oben
  gescrollt (`scrollToCook`)
* `src/ui/cook.ts`: zeichnet sich selbst neu, nicht den Reiter. Kopf mit
  `Zurücksetzen` (`withoutSession`) und `Schließen`, Zeilen
  `Anweisungen N von M Schritten` und `Wake Lock nicht verfügbar`. Timerleiste
  oben klebend, je Timer Name, Halt Handlung (orange) oder `Fertig` (gruen),
  Restzeit, `Stopp`. Mise en place mit `Zutaten N von M` und Haken. Schritt mit
  `Schritt N von M`, Geraet, °C, Minuten, Halt, Anweisung, Knopf
  `Timer 15 min` bzw. `Timer neu starten`, Zutaten mit Mengen je Gericht.
  `Zurück` und `Weiter` unten klebend
* Takt alle `TIMER_TICK_MS`: meldet faellige Ereignisse einmal (Ton,
  Vibration, `reported` gespeichert), haelt den Wake Lock nur bei sichtbarer
  Ansicht und sichtbarem Tab, raeumt auf, sobald die Ansicht nicht mehr im
  Dokument haengt. Nach Rueckkehr aus dem Hintergrund neuer Versuch
* Ton ueber Web Audio, freigeschaltet bei jeder Beruehrung der Ansicht
* Neue Konstanten in `src/config/cook.ts`: `TIMER_TICK_MS`, `TONE_MS`,
  `TONE_GAP_MS`, `TONE_FREQUENCY_HZ`, `TONE_GAIN`, `HOLD_TONE_COUNT`,
  `END_TONE_COUNT`, `HOLD_VIBRATION_PATTERN`, `END_VIBRATION_PATTERN`,
  `MIN_CONTROL_PX` (56, als `--ck-control` gesetzt)

Geprueft im Build (`vite preview`, `.claude/launch.json` untracked) bei 375 px:
kein waagerechter Lauf, kleinste Bedienflaeche 56 px, zwei Timer parallel,
Neuladen mit Restzeit, Halt und Ende getrennt gemeldet und als `reported`
gespeichert, Zuruecksetzen leert den Schluessel, Schliessen zurueck zur
Checkliste. Wake Lock im eingebetteten Browser nicht verfuegbar, Status
erscheint. Nicht geprueft: echter Ton und Vibration (brauchen echte
Beruehrung), Wake Lock am Handy, Kochansicht mit generiertem Plan (Pfad
`instructed` 0 ist durch Tests von `attachRecipes` abgedeckt).

Bewusst nicht umgesetzt: Stueckangaben neben Gramm (`gramsPerPiece`). Steht in
der Mustertabelle der Spec, aber in keinem Akzeptanzkriterium und nicht im
Auftrag fuer 11.2. Bei Bedarf in 11.3 nachziehen.

Laufende Timer melden sich nur bei offener Kochansicht. Nach Neuladen also
erst `Kochen` tippen, dann klingelt ein inzwischen abgelaufener Timer.

Naechster Schritt 11.3 laut Spec: Test am Handy in einer echten Prep Session
durch den Nutzer (Sonntag oder Mittwoch). Vorher Branch `recipes` auf Pages
bringen geht nicht ohne Merge, also Test lokal per `npm run dev -- --host`
im WLAN oder nach Merge von `plan-generator` und `recipes` auf `main`.
Korrekturen an `data/recipes.json` (OptiGrill 210 °C, 800 W, Chili Halt),
dann Merge, Retro Phase 11 in `specs/roadmap.md`.


## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.


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



## Phase 12, Notizen 12.0 bis 12.4 Kueche und Startprompt Rest 12.4 (archiviert 27.10.2026)

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

12.4 Kueche erledigt 26.10.2026 (`0cb300f`). Tokens aus `DESIGN.md` auf
`:root`, dunkel ueber `prefers-color-scheme`. Alte Variablennamen
(`--text-primary`, `--surface-primary` usw.) stehen als Aliase im Block
"Uebergang" und fliegen raus, wenn Verlauf umgestellt ist. Ebenso der
Uebergangsblock `.range-btns, .segmented` (Zeitraum und Gewichtsmodus im
Verlauf werden Filterkapseln `.chip` in `.chips`). Befunde des Documenters
behoben: `ink-3` hell `#636a6e`, dunkel `#959da1`, inaktive Navigation in
`ink-2`, Spuren `red-wash #fbefed` und `green-wash #ecf6f0`, Magnet
(`.nav-magnet`, im `index.html`) und Puck (`.segment-puck`) gleiten per
`transform`, gesetzt in `src/ui/shell.ts`. `DESIGN.md` nennt noch die alten
Werte und die Navigation in `ink-3`; beim Abschluss von 12.4 nachziehen.
Neue Bausteine im CSS: `.card`, `.card-label`, `.card-value` (`.is-hero`,
`.is-word`), `.card-basis`, `.refusal`, `.mark` mit `.is-off`/`.is-ok`,
`.bar`, `.grid2`, `.stack` (ab 900 px zweispaltig), `.list`, `.group-title`,
`.group-label`, `.btn`, `.btn-primary`, `.toolbar`, `.chips`/`.chip`.
`checkRow` in `src/ui/build.ts` kennt `aside`, `icon()` baut SVG Symbole.
Bundle gzip nach Kueche: Haupt Chunk 36,61 kB, CSS 6,98 kB (Grenze 8, beim
Umbau der anderen Ziele alte Regeln loeschen, nicht nur ergaenzen),
`charts` 74,32 kB. Geprueft bei 375 px hell und dunkel, 1280 px.
Pruefung im Dev Server: Eintrag `dev` in `.claude/launch.json`, ohne
Zugangsdaten oeffnet das Blatt beim Start (mit `#btn-close-settings`
schliessen). Fuer Heute, Training, Verlauf die Fixtures aus
`public/preview/*.json` nur in localStorage `fitness_cache_v1` legen.

Startprompt Rest 12.4 (neue Sitzung, Ordner dieses Worktrees, Branch
`claude/mobile-app-b71746`): Lies CLAUDE.md, specs/roadmap.md,
docs/uebergabe.md (Abschnitt Phase 12), `DESIGN.md`. Stelle die Ziele
Heute, Training, Verlauf in dieser Reihenfolge auf die Bausteine aus dem
Commit `0cb300f` um, je Ziel ein Commit mit Pruefung bei 375 px und
1280 px und Bundle Zahlen. Keine Tabelle, keine Zeilen Bezeichnung gegen
Wert, Verweigerungen als `.refusal` an der Stelle der Zahl. Diagrammfarben
in `COLORS` (`src/ui/dom.ts`) sind noch die alten dunklen, sie muessen hell
und dunkel aus den Custom Properties lesen. Chunk `charts` nicht statisch
importieren. Danach Aliase und Uebergangsregeln loeschen, `DESIGN.md`
nachziehen, Budget pruefen (Haupt Chunk 40 kB, CSS 8 kB), Uebergabe und
Roadmap, dann Phasenverkettung mit 12.5. Nicht pushen.

## Phase 12.5 PWA (aus der Uebergabe verschoben 27.10.2026)

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

## Rest 12.4 (aus der Uebergabe verschoben 27.10.2026)

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


## Aus der Uebergabe verschoben 27.10.2026 (Phase 13.3)

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

## Phase 13.1 und 13.2 (aus der Uebergabe verschoben 27.10.2026)

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

13.2 erledigt 27.10.2026: Aus `claude/daily-import-36c9f1` (`b5a8081`)
uebernommen `apps-script/daily-import-core.js`, `test/daily-import-core.test.ts`,
`test/fixtures/daily-import/`, ESLint Block fuer `apps-script/`. Neu
`apps-script/training-log-core.js` mit `validateTrainingRequest`,
`findDayHeader`, `findWeekBlock`, `findExerciseRow`, `planTrainingWrites`;
nutzt die Hilfsfunktionen des Daily Import Kerns (gemeinsamer globaler
Namensraum, Tests laden beide Dateien in einen vm Kontext). Synthetische Tabs
`test/fixtures/training-log/with-notes.json` und `without-notes.json`. 437 Tests.
Befund am Tab (in der Spec nachgetragen): Kopf hat zweimal `Reps`, Ist ist das
hinter `Load`; je Tag eine eigene Kopfzeile; doppelte Uebungszeilen, daher
`occurrence` je Eintrag; neuer Fehlercode `unknown_day`; nur Tabs `Mesocycle N`.
Annahmen: Hoechstlaenge `Reps Ist` 40 Zeichen (Spec nennt keine); die
Vorschau Fixture zeigt auch in `Mesocycle 1` eine Spalte `Notes`,
`specs/sheet-structure.md` sagt nein. Die Logik kommt mit beidem aus, das
Kriterium "Notes in Mesocycle 1 nicht angeboten" wird in 13.5 am echten Tab
geprueft.



<!-- verschoben 27.10.2026 aus uebergabe.md -->
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

