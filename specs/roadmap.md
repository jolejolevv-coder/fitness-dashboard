# Roadmap

Stand: 29.07.2026. Phase 0 abgeschlossen. Arbeit laeuft auf Branch `rewrite`,
`main` bleibt bis Phase 6 unangetastet live.

## Phase 0 — Baseline und Hygiene · ABGESCHLOSSEN

* [x] `.gitignore` angelegt, `.DS_Store` aus der Versionierung entfernt
* [x] Branch `rewrite` angelegt, Tag `v0-legacy` auf den letzten Stand von `main`
* [x] Vollstaendiger Sheet Export nach `testdata/`, versionsausgeschlossen
* [x] Sheet Struktur vollstaendig erhoben und in `specs/sheet-structure.md`
      festgehalten, einschliesslich sechs bisher unbekannter Befunde
* [ ] Google API Key in der Cloud Console auf HTTP Referrer `me.nahobinoco.com/*`
      und auf die Sheets API beschraenken. Offen, nur von der Nutzer erledigbar

## Phase 1 — Migration auf Vite und TypeScript, ohne Verhaltensaenderung

Ziel: gleiche Zahlen, gleiche Optik, neue Struktur.

* Vite Projekt, `base: '/fitness-dashboard/'`, tsconfig strict
* `scripts/make-fixtures.ts` erzeugt aus dem Export JSON Fixtures in der Datenform
  der Sheets API. Kommentarspalten werden dabei durch Platzhalter ersetzt
* Golden Values aus der heutigen Logik festhalten, siehe
  `specs/features/test-fixtures.md`
* Bestehende Logik in Module nach `specs/tech-stack.md` zerlegen, Typen definieren
* Spaltenzuordnung ueber Kopfzeilen statt fester Indizes, harte Fehlermeldung bei
  fehlender Spalte
* Chart.js als npm Abhaengigkeit statt CDN
* Vitest, Tests fuer `parse/daily.ts` und `parse/training.ts` gegen echte Zeilen

Bewusst noch **nicht** enthalten: Bugfixes. Phase 1 repliziert das heutige
Verhalten inklusive seiner Fehler, damit Phase 2 einen sauberen Diff hat.
Ausnahme ist die Spaltenzuordnung, weil sie das Fundament der Fehlerfreiheit ist
und keine Zahl veraendert, solange die Kopfzeilen unveraendert sind.

Akzeptanz:
* [ ] Alle Golden Values exakt reproduziert
* [ ] `npm run build` erzeugt `dist/`, `npm test` laeuft ohne Netzzugriff durch
* [ ] Parser Tests gruen, auch gegen einen Tab mit fehlender Spalte

## Phase 2 — Korrektheit

Ziel: die Zahlen stimmen. Jede Abweichung von den Golden Values wird im Commit
begruendet. Reihenfolge nach Auswirkung.

1. **Aktuelle Trainingswoche.** Heute immer 12, weil alle Lastspalten
   vorbefuellt sind. Quelle wird die Spalte `Trainingday` im Daily Tracking mit
   ihrer Kodierung `D1 W1 M1`. Der juengste Eintrag bestimmt Mesozyklus und Woche
2. **`Rest` ist kein Trainingstag.** Die Auswertung Trainingstag gegen Ruhetag
   zaehlt heute jeden nicht leeren Eintrag als Training, also auch `Rest`
3. **Tage ohne Gewicht bleiben erhalten.** Zwei Tage mit `?` in der
   Gewichtsspalte verlieren heute je 13 befuellte Felder. Ein Gewicht darf
   Bedingung fuer die Gewichtskurve sein, nicht fuer die gesamte Zeile
4. **Notizen aus beiden Spalten**, `L` und `AC`, statt nur aus `L`
5. **Zeitraumfilter** wirkt auch auf Wochenkarten, Wochenchart und Notizen
6. **`num()` erhaelt echte Nullwerte.** Betrifft zwei Werte im Bestand
7. **Uebungstabelle** prueft auf `undefined` statt nur auf `null`
8. **Mesozykluslaenge** aus der erkannten Wochenzahl statt hart verdrahteter 12
9. **Ø Schritte** faellt korrekt auf `–` zurueck statt auf 0
10. **Kommentare** per `textContent` statt `innerHTML`
11. **Gesamtverlust** aus geglaetteten Wochenmitteln statt zweier Einzeltage

Akzeptanz:
* [ ] Jeder Punkt hat einen fehlschlagenden Test vor und einen gruenen nach dem Fix
* [ ] Jede geaenderte Golden Value ist im Commit begruendet
* [ ] Kein `undefined` und kein irrefuehrendes `0` mehr in der Oberflaeche

## Phase 3 — Zielwerte aus dem Sheet

Details in `specs/features/goals.md`. Vorgabeblock aus `Daily Tracking`, Sollrate
aus `ROL` im Mesocycle Tab, laufend auf das aktuelle Gewicht umgerechnet.

Akzeptanz:
* [ ] Kein Zielwert mehr als Literal ausserhalb der Fallbacks
* [ ] Unlesbarer Vorgabeblock erzeugt einen sichtbaren Hinweis, keinen stillen Default

## Phase 4 — Analytik

Details in `specs/features/analytics.md`. TDEE Schaetzer, Trend und
Zielprojektion, Plateau Erkennung, Streaks und Korrelationen.

Akzeptanz:
* [ ] Jede Kennzahl hat Unit Tests gegen synthetische Verlaeufe mit bekanntem Ergebnis
* [ ] Jede Kennzahl nennt ihre Datenbasis und verweigert die Aussage bei zu duenner Lage

## Phase 5 — Antwortblock, Performance, Zugaenglichkeit

* Antwortblock nach `specs/features/answer-block.md`, lokaler Tab Nutzungszaehler
* Charts nur fuer den sichtbaren Tab bauen, bei Refresh Daten aktualisieren statt
  vierzehn Instanzen zu zerstoeren und neu zu erzeugen
* Ladepolitik: beim Oeffnen, manuell, und bei Rueckkehr auf den Tab mit
  Fuenfzehnminutensperre. Kein Intervall mehr. Datenalter sichtbar
* `maintainAspectRatio: false` mit CSS Hoehen statt Canvas Hoehenattributen
* Dichteres Desktop Raster, Tastaturnavigation, `role="tablist"`, Fokusringe
* Kontraste auf WCAG AA, Farben in CSS Custom Properties
* `noindex`, Klarname aus Titel und Kopfbereich entfernen
* CSV Export der gefilterten Daten, PNG Export einzelner Charts

Akzeptanz:
* [ ] Tab Wechsel im Browser loest hoechstens einen Abruf pro fuenfzehn Minuten aus
* [ ] Lighthouse Performance und Accessibility jeweils mindestens 90
* [ ] Bedienung komplett per Tastatur moeglich

## Phase 6 — Umstellung und Abschluss

* README mit Setup, Sheet Struktur, Deploy
* ADR fuer die Stack Entscheidung
* GitHub Actions Workflow, Pages Quelle von Legacy auf Actions umstellen
* Merge auf `main`. Rueckfallweg ist Tag `v0-legacy` plus Umschalten der Pages
  Quelle, zusammen unter fuenf Minuten
* Retrospektive ausfuellen

## Phase 7 — Blockuebergreifende Trainingshistorie

Erst sinnvoll, wenn `Mesocycle 2` echte Ist Daten traegt, also ab Mitte August.
Automatische Erkennung aller `Mesocycle N` Tabs, Umschalter zwischen Bloecken,
blockuebergreifender Verlauf je Uebung. Die Zusammenfuehrung von Uebungsnamen
zwischen Bloecken wird an echten Daten entwickelt, nicht an ausgedachten.

## Zurueckgestellt

* `Zeitverlauf`, `Sizes` und `Supplements` werden vom Dashboard nicht gelesen.
  `Sizes` traegt derzeit 21 befuellte Zellen und lohnt nicht. `Zeitverlauf` mit
  466 Zellen ist ungeprueft und koennte spaeter Wert haben
* Wochenexport als Textblock fuer den Chat mit dem Trainer

## Retrospektive

### Phase 0

**Was lief gut.** Der Sheet Export war die mit Abstand ergiebigste Massnahme.
Sechs Befunde, die aus dem Quellcode allein nicht sichtbar waren, darunter zwei
echte Fehler mit spuerbarer Auswirkung.

**Wo lagen falsche Annahmen.** Drei Stueck. Erstens wurde die Tragweite des
`num()` Fehlers deutlich ueberschaetzt, tatsaechlich betrifft er zwei Werte.
Zweitens wurde angenommen, die Zielwerte muessten irgendwo neu erfasst werden,
obwohl sie seit jeher im Sheet stehen. Drittens galt die Ermittlung der aktuellen
Trainingswoche als korrekt, obwohl sie durch vorbefuellte Lastspalten immer 12
liefert.

**Was muss naechstes Mal genauer spezifiziert werden.** Die echten Daten gehoeren
an den Anfang, nicht in die Mitte. Vier der sieben Entscheidungen aus der
Anforderungsklaerung waeren anders ausgefallen, haette der Export vorher
vorgelegen.
