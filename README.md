# Body Recomp Dashboard

Auswertungsschicht ueber einem Google Sheet. Liest taegliche Koerper und
Ernaehrungsdaten sowie einen Trainingsmesozyklus, rechnet daraus Verlauf,
Erhaltungsbedarf, Trend und Compliance. Schreibt nie zurueck.

Warum es existiert und was es ausdruecklich nicht tut, steht in
[specs/mission.md](specs/mission.md).

## Betrieb

* Statische Seite, kein Backend
* Ausgeliefert unter https://me.nahobinoco.com/fitness-dashboard/
* Zugangsdaten und Zielgewicht liegen ausschliesslich im localStorage des
  Browsers und sind in keinem Commit enthalten

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver, Seite unter /fitness-dashboard/
npm run build      # Typpruefung und Produktionsbuild nach dist/
npm test           # Vitest, laeuft ohne Netzzugriff
npm run typecheck  # nur die Typpruefung
```

## Aufbau

Die Modulstruktur und die Begruendung der Stackentscheidungen stehen in
[specs/tech-stack.md](specs/tech-stack.md), die Entscheidung selbst als
[ADR](docs/adr/0001-vite-typescript-und-pages-via-actions.md).

Kurz:

* `src/parse/` liest das Sheet. Spalten werden ueber ihre Beschriftung gefunden,
  nie ueber feste Nummern
* `src/analytics/` rechnet, ohne das DOM zu kennen, und ist vollstaendig getestet
* `src/ui/` zeichnet, ohne zu rechnen
* `src/charts/` kapselt Chart.js

## Das Sheet

Die vollstaendige Struktur des Arbeitsblatts, einschliesslich aller Eigenheiten
der Daten, steht in [specs/sheet-structure.md](specs/sheet-structure.md).
**Vor jeder Aenderung an einem Parser dort nachlesen.** Die Datei erklaert unter
anderem, warum `55x2` als 110 kg zu lesen ist und warum ein Gewicht keine
Bedingung dafuer sein darf, eine Zeile zu verwerten.

Wichtig fuer den Betrieb: am Sheet arbeitet neben dem Besitzer auch der Trainer.
Eine eingefuegte Spalte darf deshalb nie zu einer stillen Fehlinterpretation
fuehren. Fehlt eine erwartete Spalte, bricht das Parsen mit einer sichtbaren
Meldung ab.

## Testdaten

Tests laufen gegen Fixtures aus einem echten Export, nicht gegen ausgedachte
Zeilen. Der Rohexport liegt unter `testdata/` und wird nie versioniert, die
daraus erzeugten Fixtures unter `test/fixtures/` schon.

```bash
python3 scripts/make_fixtures.py testdata/<export>.xlsx
```

Das Skript bildet die Darstellungsform der Sheets API nach, also formatierte
Zeichenketten mit deutschem Dezimalkomma, und ersetzt Notizen durch Platzhalter.
Benoetigt `openpyxl`.

## Deploy

Gebaut wird von GitHub Actions, ausgeliefert wird `dist/` ueber GitHub Pages.
Der Workflow liegt in `.github/workflows/deploy.yml`.

Damit er greift, muss die Pages Quelle des Repositories einmalig von
`Deploy from a branch` auf `GitHub Actions` umgestellt werden. Vor dieser
Umstellung liefert Pages weiterhin die alte einteilige `index.html` aus dem
Wurzelverzeichnis aus.

Rueckfallweg: Tag `v0-legacy` zeigt auf den letzten Stand vor dem Umbau.
Zuruecksetzen und die Pages Quelle zurueckstellen dauert zusammen unter fuenf
Minuten.

## Offener Punkt

Der Google API Key muss in der Cloud Console auf den HTTP Referrer
`me.nahobinoco.com/*` und auf die Sheets API beschraenkt sein. Ohne diese
Beschraenkung kann ihn jeder verwenden, der ihn einmal abgreift.
