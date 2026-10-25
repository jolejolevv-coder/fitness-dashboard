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

Phase 9.2 erledigt (Stand 25.10.2026, 280 Tests, `npm run check` und Build
sauber, Reiter Plan bei 375 px ohne waagerechten Seitenlauf geprueft, mit Seed
und mit eingesetztem Vorschlag). Neu:
* `src/generator/source.ts`: `resolvePlanSource(raw, seed, goals, tolerance)`,
  rein. Liefert `seed` oder `active`. Gespeicherter Plan gilt nur nach
  `parseActivePlan` und `checkProposal`, sonst Seed mit Fundzeilen
  `Gespeicherter Plan nicht geladen: ...`. Ohne Ziele aus dem Sheet gilt der
  Seed (`Ziele 0 von 3`), der Plan bleibt gespeichert und gilt wieder, sobald
  die Ziele da sind
* Entscheidung in 9.2: Ausschluesse werden beim Laden des aktiven Plans nicht
  geprueft, sie steuern nur den naechsten Vorschlag. Sonst wuerde das Pflegen
  der Ausschlussliste den laufenden Plan still verwerfen
* `src/generator/state.ts`: `PLAN_STATE_KEYS`, `adoptActivePlan`,
  `resetToSeed`, `readActivePlanRaw`. Beide leeren Overrides, Prep und Einkauf
  Abhakstatus
* `src/ui/planSource.ts`: `getPlanSource(goals)`, `adoptPlan` (fuer 9.4),
  `returnToSeed`, `onPlanSourceChange`. Plan und Einkauf laden darueber ihren
  Speicherzustand neu, `main.ts` markiert Einkauf als neu zu zeichnen
* `src/ui/plan.ts`: Kontext je Zeichnen statt Modulkonstanten, Zeile
  `Vorschlag <Datum>, <Modell>` oder `Seed` mit Knopf `Zurück zum Seed`, nur
  wenn ein Plan gespeichert ist. Riegel Schalter bei aktivem Vorschlag aus
* `src/ui/shopping.ts`: `renderShopping(goals)`, liest die Planquelle, zeigt
  die Fundzeilen ebenfalls

Bekannt, nicht behoben: ein Tausch im Reiter Plan markiert den Reiter Einkauf
nicht als neu zu zeichnen (`dirty` in `main.ts`), die Liste ist bis zum
naechsten Laden veraltet. Bestand aus Phase 8, nur fuer den Wechsel der
Planquelle in 9.2 geloest.

Phase 9.3 erledigt (Stand 25.10.2026, 304 Tests, `npm run check` und Build
sauber, nicht committet). Neu:
* `src/generator/request.ts`: `requestProposal(request, { signal, onTokens })`
  laedt das SDK per `import()`, streamt ueber `client.beta.messages.stream`
  mit `fallbacks: "default"`, adaptivem Thinking, Effort und Schema, holt
  `finalMessage()` und gibt `parseProposal`, `checkProposal` und Kosten weiter.
  Ergebnis ist immer ein `ProposalStatus`: `checked` (mit `check.passed`),
  `invalid`, `refused` (Kategorie), `max-tokens`, `stopped`, `api-error`
  (Code, Typ), `connection`, `timeout`, `aborted`, `sdk-load`, `unknown`.
  `statusLine(status)` liefert die Zahlenzeile fuer 9.4. `model` und
  `fallback` nennen, wer geantwortet hat, das gehoert in `ActivePlan.model`
* Nach einem Fallback zaehlt nur der Text nach dem letzten `fallback` Block,
  die Teilausgabe des abgelehnten Modells wird verworfen
* `src/generator/cost.ts`: `totalRunCost` rechnet jeden Versuch aus
  `usage.iterations` zum Preis seines Modells. `TOKEN_PRICES` kennt jetzt
  auch `claude-opus-5` und `claude-opus-4-8` als Fallback Ziele
* `src/config/generator.ts`: `GENERATOR_FALLBACK_BETA`,
  `GENERATOR_MAX_TOKENS` 64000, `GENERATOR_TIMEOUT_MS` 10 min als Gesamtfrist
  ueber alle Wiederholungen (Nutzerentscheidung, ebenso der Name `request.ts`)
* `test/request.test.ts`: SDK per `vi.mock` ersetzt, echte Fehlerklassen

Bundle (Probe Build mit kurz verdrahtetem Modul, danach zurueckgesetzt): SDK
liegt in einem eigenen Chunk, 366 kB roh, 82,6 kB gzip, keine SDK Quelle im
Haupt Bundle. Statisch importiert waechst der Haupt Bundle um 8,2 kB roh
(3,3 kB gzip), alles eigener Code (request, prompt, schema). Fuer 9.4
empfohlen: auch `request.ts` erst beim Knopfdruck per `import()` laden, dann
waechst der Haupt Bundle um 1,7 kB roh, `request` ist ein eigener Chunk von
7,7 kB.

Naechster Schritt 9.4 Oberflaeche (Key Eingabe, Ausschluesse, Wunsch, Knopf
mit Tokenzaehler und Abbrechen, Vorschau, Uebernahme ueber `adoptPlan`,
Export, CSP im Build), Live Lauf durch den Nutzer.

Vor dem Live Lauf beim Nutzer: eigenen Anthropic Workspace mit Ausgabelimit
anlegen und Key erzeugen.

## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.
