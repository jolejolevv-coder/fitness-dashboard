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

## Phase 1 — Migration auf Vite und TypeScript · ABGESCHLOSSEN

Ziel: gleiche Zahlen, gleiche Optik, neue Struktur.

* Vite Projekt, `base: '/fitness-dashboard/'`, tsconfig strict
* `scripts/make_fixtures.py` erzeugt aus dem Export JSON Fixtures in der Datenform
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
* [x] Alle Golden Values exakt reproduziert, 12 Tests gruen
* [x] `npm run build` erzeugt `dist/`, `npm test` laeuft ohne Netzzugriff durch
* [x] Parser Tests gruen, auch gegen einen Tab mit fehlender Spalte

## Phase 2 — Korrektheit

Ziel: die Zahlen stimmen. Jede Abweichung von den Golden Values wird im Commit
begruendet. Reihenfolge nach Auswirkung.

1. **Lastnotation `55x2`.** Einunddreissig Werte werden heute zu Unsinn, `55x2`
   wird zu 552 kg. Betrifft Lastprogression, 1RM Schaetzung, Gesamtvolumen und
   Volumenverteilung. Die Bedeutung der Notation ist mit der Nutzer zu klaeren, siehe
   offene Frage unten. Ebenfalls zu behandeln: Bereichsangaben wie `40-50`
2. **Gleichnamige Uebungen an verschiedenen Tagen.** Acht von 36 Varianten in
   `Mesocycle 1` verschwinden, weil der Parser nach Namen entdoppelt. Der
   Schluessel muss aus Trainingstag und Name bestehen
3. **Unplausible Lasten kennzeichnen.** Ein `9-9` in der Lastspalte wird heute zu
   9 und erzeugt in der Kachel Top Progression einen Zuwachs von 900 Prozent
4. **`Rest` ist kein Trainingstag.** Die Auswertung Trainingstag gegen Ruhetag
   zaehlt heute jeden nicht leeren Eintrag als Training, also auch `Rest`
5. **Tage ohne Gewicht bleiben erhalten.** Zwei Tage mit `?` in der
   Gewichtsspalte verlieren heute je 13 befuellte Felder. Ein Gewicht darf
   Bedingung fuer die Gewichtskurve sein, nicht fuer die gesamte Zeile
6. **Notizen aus beiden Spalten**, `L` und `AC`, statt nur aus `L`
7. **Zeitraumfilter** wirkt auch auf Wochenkarten, Wochenchart und Notizen
8. **`num()` erhaelt echte Nullwerte.** Betrifft zwei Werte im Bestand
9. **Uebungstabelle** prueft auf `undefined` statt nur auf `null`
10. **Mesozykluslaenge** aus der erkannten Wochenzahl statt hart verdrahteter 12
11. **Ø Schritte** faellt korrekt auf `–` zurueck statt auf 0
12. **Kommentare** per `textContent` statt `innerHTML`
13. **Gesamtverlust** aus geglaetteten Wochenmitteln statt zweier Einzeltage

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

## Offene Fragen

* Was bedeutet die Lastnotation `55x2` genau. Zwei Kurzhanteln zu je 55 kg, oder
  55 kg je Seite an einer Maschine. Fuer die Progression je Uebung ist die Zahl
  vor dem `x` ausreichend und vergleichbar, fuer das Gesamtvolumen ist das
  Produkt richtig. Vorschlag: beide Werte parsen und speichern, Progression auf
  der Zahl vor dem `x`, Volumen auf dem Produkt
* Zielgewicht fuer die Projektion

## Zurueckgestellt

* `Zeitverlauf`, `Sizes` und `Supplements` werden vom Dashboard nicht gelesen.
  `Sizes` traegt derzeit 21 befuellte Zellen und lohnt nicht. `Zeitverlauf` mit
  466 Zellen ist ungeprueft und koennte spaeter Wert haben
* Wochenexport als Textblock fuer den Chat mit dem Trainer

## Retrospektive

### Phase 1

**Was lief gut.** Die Golden Values haben ihren Zweck sofort erfuellt. Zwoelf
Tests, alle gruen beim ersten Durchlauf, und der erste Durchlauf hat nebenbei
einen falschen Befund aus Phase 0 widerlegt. Die Fixtures in der Datenform der
API statt in einer bequemeren Form waren die richtige Entscheidung, die
Eigenheiten der Darstellung, Komma gegen Punkt und Text gegen Zahl im selben
Feld, waeren sonst nie in die Tests gekommen.

**Wo lagen falsche Annahmen.** Der Umfang der Trainingsfehler wurde unterschaetzt.
Erst der Blick auf die laufende Oberflaeche hat gezeigt, dass die Kachel Top
Progression 900 Prozent meldet und dass acht Uebungsvarianten fehlen. Beides
haette man am Code sehen koennen, hat man aber nicht.

**Was muss naechstes Mal genauer spezifiziert werden.** Eine Migration ohne
Verhaltensaenderung braucht neben den Golden Values einen Blick auf die laufende
Oberflaeche. Zahlen, die stimmen, koennen trotzdem Unsinn anzeigen.

### Phase 0

**Was lief gut.** Der Sheet Export war die mit Abstand ergiebigste Massnahme.
Sechs Befunde, die aus dem Quellcode allein nicht sichtbar waren, darunter zwei
echte Fehler mit spuerbarer Auswirkung.

**Wo lagen falsche Annahmen.** Drei Stueck. Erstens wurde die Tragweite des
`num()` Fehlers deutlich ueberschaetzt, tatsaechlich betrifft er zwei Werte.
Zweitens wurde angenommen, die Zielwerte muessten irgendwo neu erfasst werden,
obwohl sie seit jeher im Sheet stehen. Drittens wurde ein Fehler in der
Ermittlung der aktuellen Trainingswoche behauptet, den es nicht gibt. Ursache war
ein Spaltenversatz in der eigenen Erhebung, gelesen wurde `Tempo` statt `Load`.
Aufgefallen ist es erst, als die Golden Values mit der echten Logik erzeugt
wurden. Lehre daraus: Befunde aus einer Nebenrechnung gelten erst, wenn der
Produktivcode sie bestaetigt.

**Was muss naechstes Mal genauer spezifiziert werden.** Die echten Daten gehoeren
an den Anfang, nicht in die Mitte. Vier der sieben Entscheidungen aus der
Anforderungsklaerung waeren anders ausgefallen, haette der Export vorher
vorgelegen.
