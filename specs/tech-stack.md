# Tech Stack

## Entscheidungen

| Bereich | Wahl | Begruendung |
| --- | --- | --- |
| Sprache | TypeScript, strict | Die Parser arbeiten mit teilweise fehlenden Sheet Zellen. Ein Typsystem mit `number \| null` faengt genau die Klasse Fehler, die heute im Code steckt |
| Build | Vite | Schnellster Weg zu Bundling, Typpruefung im Dev Server und einem einzigen deploybaren Ordner. Kein Framework noetig |
| UI | Vanilla DOM, keine Komponentenbibliothek | Fuenf Tabs und kein Zustand, der React rechtfertigen wuerde |
| Charts | Chart.js 4, lokal gebuendelt | Bleibt bei dem, was heute laeuft. Lokal statt CDN eliminiert Supply Chain Risiko und den fehlenden SRI Hash |
| Tests | Vitest | Laeuft ohne Zusatzkonfiguration mit Vite. Getestet werden Parser und Analytik, nicht das DOM |
| Datenquelle | Google Sheets API v4, lesend, API Key | Unveraendert. Kein OAuth, weil kein Backend existiert, das ein Token halten koennte |
| Spaltenzuordnung | ueber Spaltennamen, nicht ueber Spaltennummern | Der Trainer hat Schreibrechte am Sheet. Eine eingefuegte Spalte darf keine stille Fehlinterpretation erzeugen |
| Zielwerte | Konfigurationsdialog, localStorage | Das Sheet soll unangetastet bleiben. Details in `specs/features/goals-in-settings.md` |
| Hosting | GitHub Pages, Deploy ueber GitHub Actions | Ein Build Schritt schliesst das Ausliefern aus dem Repository Root aus |
| Styling | Plain CSS mit Custom Properties | Farben liegen heute an rund 60 Stellen im Markup |

## Tradeoffs, die damit eingekauft werden

**Vite und TypeScript statt einer Datei.** Kosten: ein Build Schritt, eine
Node Toolchain, ein Deploy Workflow, npm Abhaengigkeiten die gepflegt werden
wollen. Nutzen: Typsicherheit an genau den Stellen wo heute Bugs sitzen,
testbare Analytik, Bundling statt CDN. Bei rund 1000 Zeilen Logik mit
nichttrivialer Statistik ist der Schnitt vertretbar. Bei 200 Zeilen waere er es
nicht.

**Spaltennamen statt Spaltennummern.** Kosten: rund zwei Stunden mehr in Phase 1
und eine harte Fehlermeldung, wenn eine erwartete Spalte fehlt, wo heute
stillschweigend weitergerechnet wird. Nutzen: das Dashboard zeigt nie wieder
Stresslevel an der Stelle von Schritten, nur weil jemand eine Spalte eingefuegt
hat. Bei einem Sheet, an dem eine zweite Person arbeitet, ist das die wichtigste
Einzelmassnahme im Projekt.

**Chart.js lokal statt vom CDN.** Kosten: rund 200 KB im eigenen Bundle, Updates
laufen ueber npm statt ueber eine URL. Nutzen: die Seite laedt kein fremdes
Skript mehr aus und ist nicht von cdnjs Verfuegbarkeit abhaengig.

**API Key im Browser.** Der Key ist unvermeidbar clientseitig, solange kein
Backend existiert. Absicherung ueber die HTTP Referrer Beschraenkung des Keys in
der Google Cloud Console auf `me.nahobinoco.com/*` und die Beschraenkung auf die
Sheets API. Ein Key ohne diese Beschraenkung ist der groesste offene Punkt des
Projekts.

**Deploy ueber Actions statt Legacy Pages Build.** Kosten: die Pages Quelle muss
einmalig umgestellt werden, ein Fehler im Workflow legt das Deploy still.
Deshalb erfolgt die Umstellung erst in der letzten Phase, mit einem Git Tag als
Rueckfallweg. Nutzen: ohne Build Schritt kein Vite.

## Zielbrowser

Aktuelle Versionen von Safari, Chrome und Firefox auf dem Desktop. Mobiles Layout
ist kein Ziel, die Seite muss dort nur lesbar bleiben. Kein PWA, kein Service
Worker, kein Offlinebetrieb.

## Projektstruktur

```
/fitness-dashboard
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  /src
    main.ts            Einstiegspunkt, Verdrahtung
    types.ts
    /config
      credentials.ts   Sheet ID, API Key, Tabnamen, localStorage
      goals.ts         Zielwerte, Defaults, Validierung
      usage.ts         lokaler Tab Nutzungszaehler
    sheets.ts          Fetch gegen die Sheets API, Tabliste, Fehlerbehandlung
    /parse
      columns.ts       Spaltennamen auf Indizes, harte Fehler bei fehlender Spalte
      daily.ts         Daily Tracking Tab in DailyEntry[]
      training.ts      Mesocycle Tab in Exercise Map
    /analytics
      smoothing.ts     gleitende Mittel, Wochenbloecke
      tdee.ts          Erhaltungsbedarf aus Zufuhr und Gewichtsverlauf
      trend.ts         Regression, Projektion, Plateau
      compliance.ts    Streaks, Zielerreichung
      correlation.ts   Zusammenhaenge zwischen Wellness Metriken
    /charts            Chart Fabriken, ein Modul pro Charttyp
    /ui
      answer-block.ts  der Antwortblock oben
      tabs.ts
      kpi.ts
      tables.ts
    styles.css
  /scripts
    make-fixtures.ts   erzeugt Testfixtures aus dem lokalen Sheet Export
  /test
    fixtures/          committet, aus dem Export erzeugt
  /testdata            Rohexport, in .gitignore, nie committet
  /specs
  /docs/adr
  /.github/workflows/deploy.yml
```
