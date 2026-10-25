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

Branch `nutrition`, Stand 25.10.2026: Phase 8.0 bis 8.5 umgesetzt und
committet, 227 Tests gruen, Build sauber, Reiter Plan und Einkauf bei 375 px
ohne waagerechten Seitenlauf geprueft. Entscheidungen stehen in der Spec unter
"Entscheidungen zur Umsetzung", Retro in der Roadmap.

Offen:
1. Freigabe des Nutzers fuer Merge `nutrition` nach `main` und Push (loest Deploy aus, Cron ab dann aktiv)
2. Danach `prices.yml` einmal manuell starten, `public/data/prices.json` und Reiter Einkauf live pruefen
3. Beim Nutzer: Anfrage an info@muskelmarkt.de, Dauerpreis Startwerte in
   `public/data/regular_prices.json` mit `source: "manual"` eintragen
4. Nachzuholen aus Phase 6: Lighthouse Messung

## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.
