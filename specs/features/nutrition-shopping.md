## Goal

Ernaehrungsplan, Meal Prep, Einkaufsliste und woechentliche Angebotspreise als
zwei neue Reiter `Plan` und `Einkauf` in das bestehende Dashboard bringen, damit
Plan, Preise, Tracking und Training an einer Stelle zusammenlaufen.

Quelle: `docs/HANDOFF.md` (Stand 25.10.2026). Dort stehen Seed Daten, Rotation,
Preis Pipeline und Phasen im Detail. Diese Spec haelt nur fest, was davon gilt,
was abweicht und was vor dem ersten Code entschieden sein muss.

Status: freigegeben am 25.10.2026.

## Scope

* In scope (Phase 8, entspricht Handoff Phase 1):
  * Statische Plandaten `foods.json`, `meals.json`, `rotation.json`,
    `shopping_items.json`
  * Rechenkern als reine Funktionen: Makros je Gericht, Tag, Woche aus
    `foods.json`, nie hartcodiert
  * Reiter `Plan`: Heute Ansicht, Wochenansicht, Tausch je Slot per Dropdown,
    Riegel Option als Schalter fuer M3, Tagessumme gegen Ziel
  * Prep Ansicht Sonntag und Mittwoch als Checkliste mit Mengen und Geraeten
  * Reiter `Einkauf`: Wochenliste aus der Rotation, auf Packungsgroessen
    gerundet, nach Kategorie gruppiert, Abhaken im localStorage
  * Preis Pipeline: GitHub Actions Workflow `prices.yml`, ein Request pro Woche
    auf `muskelmarkt.de/app1.php`, schreibt `data/prices.json`
  * Guenstigstes Angebot je Artikel mit Markt und Gueltigkeit, Summe der
    Ersparnis, Liste funktioniert auch ohne `prices.json`
  * Mobile Darstellung der beiden neuen Reiter bei 375 px
  * Wuerzen und Soßen: je Gericht eine Wuerzung (Gewuerze, Kraeuter) und
    optional eine Soße als eigene Zutaten in `foods.json`. Soßen mit
    nennenswerten kcal gehen in die Makros ein, reine Gewuerze nicht. Beides
    landet in Einkaufsliste und Prep Checkliste. Rahmen: kein Herd, Stevia statt
    Zucker, kein Erythrit
* Out of scope (Handoff Phase 2 und 3, eigene Specs spaeter):
  * Plan gegen Ist aus dem Sheet, Kohlenhydratverschiebung an Trainingstagen,
    `.ics` Export
  * Rotation nach Preis optimieren, Lean Bulk Modus
  * UI Editor fuer den Plan, Plan Aenderung bleibt ein Commit
  * Geraeteuebergreifender Abhakstatus (siehe offene Frage 6)
  * Plangenerator ueber die Anthropic API: eigene Spec `specs/features/plan-generator.md`, Phase 9

## Konflikte mit bestehenden Festlegungen (entschieden 25.10.2026)

1. Oeffentliches Repo: Plandaten duerfen unveraendert ins oeffentliche Repo.
   Bedingung: nicht ueber Suchmaschinen auffindbar. Die neuen Reiter erben
   `noindex, nofollow` der Seite. Die JSON Dateien unter `data/` koennen keinen
   Meta Tag tragen, sie werden von keiner Seite verlinkt und nur per `fetch`
   geladen. Kein Klarname in den Daten.
2. Herkunft des Plans: Der Trainer gibt die Rahmenbedingungen vor (kcal, Makros),
   die Mahlzeiten stellt der Nutzer selbst zusammen. Damit bleibt die Mission
   gewahrt, der Plan ist eine Umsetzung der Vorgabe, keine Empfehlung der Seite.
3. Mobil: Die Reiter `Plan` und `Einkauf` sind fuer 375 px gebaut. Mission ist
   angepasst.
4. Zielwerte: Tagessumme laeuft gegen `src/config/targets.ts`, also gegen das
   Sheet. Die Werte im Handoff (2300 kcal, 200 g Protein, 38 g Ballaststoffe)
   dienen nur als Testerwartung.
5. Zweite Datenquelle: `data/prices.json` aus dem Actions Lauf ist zulaessig,
   ADR 0002 angenommen. Das Sheet bleibt unberuehrt.

## Acceptance criteria

* [ ] Makros aller 10 Gerichte werden aus `foods.json` berechnet und stimmen mit
      Handoff Abschnitt 4 ueberein. Toleranz ±2 kcal, ±1 g bei Makros (die
      Tabelle im Handoff ist auf ganze Gramm gerundet, m4a Fett 20,5 gegen 21
      und m4b KH 53,4 gegen 54 reissen ±0,5 g)
* [ ] `m3r` wird als Gericht plus Zuschlag 50 g Haehnchen auf M2 modelliert,
      gerechnet ergibt das 419 kcal und 38,6 g Protein
* [ ] Jeder Tag der Standardrotation liegt bei Ziel kcal ±40 und mindestens beim
      Proteinziel, beide aus dem Sheet (Vorpruefung: 2309 bis 2333 kcal, 202 bis
      210 g Protein)
* [ ] Einkaufsliste der Standardwoche entspricht den Mengen im Plan Dokument
* [ ] Ein manueller Lauf von `prices.yml` erzeugt `data/prices.json`, der Reiter
      zeigt die Preise. Ohne Datei zeigt er die Liste ohne Preise
* [ ] Parser Fehler oder null Treffer lassen den Workflow fehlschlagen, die alte
      `prices.json` bleibt stehen
* [ ] `robots.txt` wird vor dem Abruf geprueft und respektiert
* [ ] Rinderhack ohne Fettangabe wird nicht als `beef_mince_5` erkannt
* [ ] Beide Reiter funktionieren bei 375 px ohne waagerechten Seitenlauf
* [ ] `npm run check` und Build sauber, bestehende 88 Tests bleiben gruen

## Implementation plan

Phase 8.0 Recherche: Selektoren am Live HTML von Muskelmarkt ermitteln (ein
Abruf, nur lesen). Quelle fuer Dauerpreise pruefen und als ADR vorlegen. Die Anfrage an info@muskelmarkt.de schickt der Nutzer selbst.

Phase 8.1 Datenmodell und Rechenkern: JSON Schemas als TypeScript Typen, Seed
Daten, reine Funktionen in `src/nutrition/`, Unit Tests gegen die Handoff Werte.

Phase 8.2 Reiter Plan und Prep: Heute, Woche, Tausch, Riegel Schalter, Prep
Checklisten. Ziele aus `targets.ts`.

Phase 8.3 Einkaufsliste: Aggregation, Packungsgroessen, Kategorien, Abhaken im
localStorage, mobile Pruefung.

Phase 8.4 Preis Pipeline: Parser als Node Skript mit Tests gegen eine von Hand
gebaute HTML Probe (kein Mitschnitt fremder Seiten im Repo), Matching ueber
`shopping_items.json`, Workflow `prices.yml` mit Cron Sonntag 18:00 Europe/Berlin
und `workflow_dispatch`, Commit nur bei Aenderung.

Phase 8.5 Preise im Einkauf und Auslieferung: guenstigstes Angebot, Ersparnis,
Live Pruefung, Retro in der Roadmap.

## Entscheidungen (25.10.2026)

* Porridge mit Wasser ist Standard. Ausgleich +10 g Whey und +20 g Haferflocken,
  m1a wird entsprechend neu gerechnet, die Testerwartung aus dem Handoff fuer
  m1a gilt damit nicht mehr
* Riegel sind Lagerware. Sie stehen im Plan, aber nicht in der Einkaufsliste und
  brauchen keinen Preis
* Abhakstatus nur im localStorage, je Geraet
* Plangenerator ueber die Anthropic API im Browser, Phase 9, eigene Spec
* Wuerzen und Soßen schlaegt Claude in Phase 8.1 vor, der Nutzer waehlt aus

## Entscheidungen zur Umsetzung (25.10.2026)

* Wuerzen und Soßen, Vorschlag uebernommen. Gewuerze ohne kcal, Soßen mit kcal
  in den Makros:
  * m1a Zimt, Stevia
  * m1b Salz, Pfeffer, Paprika edelsuess, Schnittlauch TK
  * m1c Salz, Pfeffer, Chiliflocken, Soße Senf mittelscharf 10 g
  * m2a Curry, Kurkuma, Knoblauch granuliert, Salz, Soße Sojasauce 15 ml
  * m2b Kreuzkuemmel, Paprika edelsuess, Chili, Knoblauch, Salz
  * m3a Knoblauch, Kraeuter TK (Skyr wird Dip), Soße Sriracha 10 g
  * m3b Zitronensaft, Pfeffer, Schnittlauch, Soße Senf 10 g
  * m4a Dill TK, Zitronensaft, Salz, Pfeffer (Skyr wird Dill Dip)
  * m4b Paprika geraeuchert, Rosmarin, Knoblauch, Salz (Skyr wird Kraeuter Dip)
* Gearbeitet wird auf Branch `nutrition`, Merge auf `main` nach Freigabe
* Cron in `prices.yml` ist ab dem Merge aktiv
* Preise nur mit App oder Kundenkarte zaehlen beim guenstigsten Angebot mit und
  tragen einen Vermerk
* `docs/HANDOFF.md` bleibt lokal (`.gitignore`), weil es Klarname, Sheet ID und
  Filialadressen enthaelt. Massgeblich fuers Repo ist diese Spec
* Durch die Soßen steigt die Tagessumme um hoechstens rund 20 kcal. Das
  Kriterium Ziel kcal ±40 gilt weiter

## Open questions

1. Dauerpreise: entschieden 25.10.2026, ADR 0003 angenommen. Der Actions Lauf
   sammelt den Normalpreis aus Muskelmarkt je Artikel und Markt mit Datum in
   `data/regular_prices.json`, fehlende Werte kommen aus handgepflegten
   Startwerten. Gezeigt wird der juengere Wert mit Datum, aelter als 90 Tage
   mit Vermerk
