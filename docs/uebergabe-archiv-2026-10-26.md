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

