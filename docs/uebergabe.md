# Uebergabe

Stand 25.10.2026.

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

## Phase 9 Plangenerator

Spec `specs/features/plan-generator.md` am 25.10.2026 freigegeben. Phase 9.0
erledigt: ADR 0004 angenommen, `@anthropic-ai/sdk` 1.3.0 exakt gepinnt (Version
erst zwei Tage alt, Major 1.0 vom 21.10.2026, vor Updates Changelog lesen).

Gearbeitet wird im Worktree `/Users/jole/Downloads/fitness-dashboard-plan-generator`
auf Branch `plan-generator`, nicht im Projektordner. Sitzungen fuer Phase 9 dort
oeffnen. `test/fixtures/` und `test/golden/` sind lokal hineinkopiert, weil sie
nicht im Repo liegen.

Phase 9.1 erledigt (Stand 25.10.2026, 266 Tests, `npm run check` und Build
sauber). Neu:
* `src/config/generator.ts`: Modell, Effort, `DAY_TOLERANCE` (kcal ±40,
  Fett ±10 g), Praefix `g`, `PREP_DAYS`, `TOKEN_PRICES` mit `PRICES_AS_OF`
* `src/generator/schema.ts`: `allowedFoodIds`, `buildPlanSchema` (enum der
  foodIds, `additionalProperties: false` ueberall)
* `src/generator/prompt.ts`: `buildPrompt(GeneratorInput)`, deterministisch.
  `offers` baut der Aufrufer aus `cheapestOffer`
* `src/generator/response.ts`: `parseProposal`, prueft von Hand, weist
  doppelte Gericht IDs ab
* `src/generator/check.ts`: `goalsReadiness`, `checkProposal`. Verglichen
  werden auf ganze Zahlen gerundete Tageswerte, also was die Zahlenzeile zeigt
* `src/generator/cost.ts`: `runCost` aus `usage`, unbekanntes Modell ergibt
  `usd: null`
* `src/generator/state.ts`: API Key, Ausschluesse, aktiver Plan im
  localStorage. `parseActivePlan` braucht die erlaubten foodIds
* `validatePlan` in `src/nutrition/plan.ts` prueft jetzt auch Prep
  (Gericht, Slot, Tag, Zutat). `PREP_DEVICES` in `src/nutrition/types.ts`

Naechster Schritt 9.2 Planquelle: Reiter Plan und Einkauf lesen den aktiven
Plan (`loadActivePlan`, gegen `validatePlan` und `checkProposal` geprueft,
sonst Seed mit Fund) statt der Konstante `PLAN`. Uebernahme leert
`OVERRIDES_KEY`, `PREP_DONE_KEY`, `SHOPPING_DONE_KEY`. Knopf zurueck zum Seed.
Riegel Schalter bei aktivem Vorschlag ausblenden. Danach 9.3 API Aufruf
(SDK dynamisch importieren, Streaming, `fallbacks: "default"`), 9.4
Oberflaeche, CSP im Build, Live Lauf durch den Nutzer.

Vor dem Live Lauf beim Nutzer: eigenen Anthropic Workspace mit Ausgabelimit
anlegen und Key erzeugen.

## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.
