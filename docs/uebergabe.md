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

Branch `nutrition`, Stand 25.10.2026. Erledigt und committet: 8.0 Recherche,
8.1 Rechenkern (`data/`, `src/nutrition/`), 8.4 Preis Pipeline
(`scripts/prices/`, `.github/workflows/prices.yml`). 192 Tests gruen.
Entscheidungen stehen in der Spec unter "Entscheidungen zur Umsetzung"
(Soßen m1c und m3a auf 5 g, Cron ab Merge aktiv, App Preise mit Vermerk,
HANDOFF.md bleibt lokal, Parser mit node-html-parser).

Offen: 8.2 Reiter Plan und Prep, 8.3 Einkaufsliste, 8.5 Preise im Einkauf,
dann Merge auf `main` nach Freigabe des Nutzers. Laufzeitdaten liegen unter
`public/data/` (`prices.json`, `regular_prices.json` im Format
`{ entries: [{ food_id, store, regular_price_eur, size_g, price_per_kg,
seen_at, source }] }`, Startwerte von Hand mit `source: "manual"`).
Beim Nutzer: Anfrage an info@muskelmarkt.de vor dem Merge.

## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.
