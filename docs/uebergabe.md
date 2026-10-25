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

Phase 8.0 erledigt am 25.10.2026, nichts committet:
* `specs/features/muskelmarkt-parser.md`: Selektoren belegt an einem Abruf.
  `robots.txt` liefert 404. Angebot und Normalpreis sind per Klasse
  (`current-price`, `original-price`) und Attribut (`data-price`,
  `data-normal-price`) getrennt, in 176 von 176 Karten konsistent
* `docs/adr/0003-dauerpreise.md`, angenommen am 25.10.2026. Empfehlung: Normalpreis aus
  Muskelmarkt sammeln plus handgepflegte Startwerte. Open Prices hat am
  Wohnort keine Daten, Aldi Sued nur ueber interne API je Filiale, Lidl und
  Edeka haben online keine Dauerpreise

Naechster Schritt: Phase 8.1 Datenmodell und Rechenkern in einer neuen
Sitzung. Dabei Ort und Format der handgepflegten Startwerte festlegen
(Vorschlag aus ADR 0003: Feld mit Datum je Artikel und Markt in
`shopping_items.json`). Offen fuer 8.5: App Preise (Lidl Plus, Edeka App) einrechnen
oder nur zeigen. Phase 9 Plangenerator ist als Entwurf in
`specs/features/plan-generator.md`.

## Pruefung des Handoffs

Rechnung aus `foods.json` bestaetigt die Gerichte bis auf Rundung und alle sieben
Tage (2309 bis 2333 kcal, 202 bis 210 g Protein). Akzeptanztoleranz fuer Makros
auf ±1 g gesetzt, weil die Handoff Tabelle ganzzahlig gerundet ist.

## Nicht committet

Aeltere Aenderungen an `CLAUDE.md` und `specs/roadmap.md` (Roadmap gekuerzt,
Archiv nach `docs/historie.md`) lagen schon vor dieser Sitzung uncommittet vor.
