# Uebergabe

Stand 26.10.2026, Phase 11.2 fertig.

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

## Phase 11 Kochansicht

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

## Phase 9 Plangenerator

Umgesetzt, gemergt und live seit 25.10.2026. Details, Bundle Zahlen und die
Schritte fuer den Live Lauf stehen in `docs/uebergabe-archiv-2026-10-26.md`.
Offen beim Nutzer: Netzwerkpruefung des Live Laufs, danach Retro Phase 9.

## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.
