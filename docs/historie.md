# Roadmap

Stand: 29.07.2026. Alle Phasen abgeschlossen, die Seite laeuft in der neuen Fassung. Arbeit laeuft auf Branch
`rewrite`, `main` bleibt bis Phase 6 unangetastet live.

## Phase 0 — Baseline und Hygiene · ABGESCHLOSSEN

* [x] `.gitignore` angelegt, `.DS_Store` aus der Versionierung entfernt
* [x] Branch `rewrite` angelegt, Tag `v0-legacy` auf den letzten Stand von `main`
* [x] Vollstaendiger Sheet Export nach `testdata/`, versionsausgeschlossen
* [x] Sheet Struktur vollstaendig erhoben und in `specs/sheet-structure.md`
      festgehalten, einschliesslich sechs bisher unbekannter Befunde
* [ ] Google API Key in der Cloud Console auf HTTP Referrer `me.nahobinoco.com/*`
      und auf die Sheets API beschraenken. Offen, nur vom Nutzer erledigbar

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

## Phase 2 — Korrektheit · ABGESCHLOSSEN

Ziel: die Zahlen stimmen. Jede Abweichung von den Golden Values wird im Commit
begruendet. Reihenfolge nach Auswirkung.

1. **Lastnotation `55x2`.** Einunddreissig Werte werden heute zu Unsinn, `55x2`
   wird zu 552 kg. Betrifft Lastprogression, 1RM Schaetzung, Gesamtvolumen und
   Volumenverteilung. Die Bedeutung der Notation ist mit dem Nutzer zu klaeren, siehe
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
13. **Gesamtverlust** aus geglaetteten Wochenmitteln statt zweier Einzeltage.
    ZURUECKGENOMMEN nach Rueckmeldung. Der Gesamtverlust zeigt wieder die erste
    gegen die letzte Waegung, also 99.9 auf 89.7 kg. Die erste Waegung ist eine
    echte Messung und die Zahl, ueber die gesprochen wird. Geglaettet steht als
    Detail in der Unterzeile, die Analytik rechnet unveraendert geglaettet
14. **Abrufbereich waechst mit.** Gelesen wird heute `A1:AD300`. Ein Wochenblock
    belegt zwoelf Zeilen, die Daten beginnen in Zeile 31. Damit reicht der
    Bereich bis etwa Woche 22, also bis Anfang Oktober 2026. Danach fehlen neue
    Wochen kommentarlos. Der Bereich muss aus der Tabellengroesse abgeleitet
    oder grosszuegig bemessen werden

15. **Kennzahlen ueber alle erfassten Tage.** Nicht Teil der urspruenglichen
    Liste, ergab sich aus Punkt 5: Tage ohne Waegung zu behalten nuetzt nichts,
    solange Ernaehrung und Wellness weiterhin nur ueber Tage mit Waegung
    rechnen. Gewichtsbezogene Angaben nutzen weiter nur gewogene Tage

Akzeptanz:
* [x] Jeder Punkt hat einen Test, 34 Tests gruen
* [x] Jede Abweichung von der Ausgangsfassung ist im Test einzeln festgeschrieben,
      jede weitere laesst die Suite fallen
* [x] Kein `undefined` und kein irrefuehrendes `0` mehr in der Oberflaeche

## Phase 3 — Zielwerte aus dem Sheet · ABGESCHLOSSEN

Details in `specs/features/goals.md`. Vorgabeblock aus `Daily Tracking`, Sollrate
aus `ROL` im Mesocycle Tab, laufend auf das aktuelle Gewicht umgerechnet.

Akzeptanz:
* [x] Kein Zielwert mehr als Literal ausserhalb der Rueckfallwerte, per Test gegen
      den Quelltext abgesichert
* [x] Unlesbarer Vorgabeblock erzeugt einen sichtbaren Hinweis, keinen stillen Default
* [x] Beschriftungen und Referenzlinien folgen dem Sheet, `Protein ≥ 200 g` und
      `Kalorien ≤ 2300,5` stehen nicht mehr im Markup
* [x] Sollrate wird laufend aus dem aktuellen Gewicht gerechnet, bei 89.8 kg und
      0.25 Prozent sind das 0.22 kg pro Woche
* [x] Zielgewicht als einziges Feld im Konfigurationsdialog, optional

Verschoben: laufen High Day und Low Day auseinander, sollen die Referenzlinien
getrennt gezogen werden. In Mesocycle 1 sind beide identisch, die Trennung waere
an nichts pruefbar. Bis dahin nennt ein Hinweis die Abweichung.

## Phase 4 — Analytik · ABGESCHLOSSEN

Details in `specs/features/analytics.md`. TDEE Schaetzer, Trend und
Zielprojektion, Plateau Erkennung, Streaks und Korrelationen, dazu ein eigener
Tab `Analyse`.

Akzeptanz:
* [x] Jede Kennzahl hat Unit Tests gegen synthetische Verlaeufe mit bekanntem
      Ergebnis, 76 Tests gruen
* [x] Jede Kennzahl nennt ihre Datenbasis und verweigert die Aussage bei zu
      duenner Lage, mit Grund statt mit einem Strich
* [x] TDEE als Spanne ueber die verfuegbaren Fenster, verweigerte Fenster werden
      benannt
* [x] Projektion als Band aus dem Standardfehler der Rate, keine Punktprognose
* [x] Kein Grenzwert und keine Konstante als Literal im Berechnungscode

Die Analytik rechnet immer ueber den gesamten Zeitraum, nie ueber die Auswahl der
Zeitraumknoepfe. Ein Filter auf 14 Tage wuerde das 28 und das 56 Tage Fenster des
Erhaltungsbedarfs unmoeglich machen.

## Phase 5 — Antwortblock, Performance, Zugaenglichkeit · ABGESCHLOSSEN

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
* [x] Tab Wechsel im Browser loest hoechstens einen Abruf pro fuenfzehn Minuten aus
* [x] Bedienung komplett per Tastatur moeglich, Pfeiltasten, Pos1 und Ende auf der
      Tableiste, wanderndes tabindex, sichtbare Fokusringe
* [x] Beim Start werden drei Diagramme gezeichnet statt fuenfzehn. Die uebrigen
      entstehen, wenn ihr Tab zum ersten Mal geoeffnet wird
* [x] Textfarben auf WCAG AA gegen den Kartenhintergrund. Das bisherige `#64748b`
      lag bei 3.0 zu 1 und steckte in der gesamten Oberflaeche
* [x] Kein horizontaler Ueberlauf bis hinunter zu 360 px, Tabellen scrollen in
      ihrem eigenen Container
* [ ] Lighthouse Werte nicht gemessen, dafuer fehlt eine erreichbare Instanz mit
      echten Daten. Nachzuholen nach Phase 6

## Redesign — eigenstaendige Oberflaeche · ABGESCHLOSSEN

Nach Rueckmeldung, dass die Optik weiterhin nach Verwaltungsvorlage aussieht.
Kritik am alten Zustand: fuenfzehn gleich schwere Kaesten, sieben Farben ohne
Bedeutung, flache Typografie, Chart.js im Auslieferungszustand.

Geaendert wurde die Informationsarchitektur, nicht nur die Farben:

* **Hero.** Ein Satz, eine Fortschrittsstrecke von Start ueber Aktuell zum Ziel,
  drei primaere Kennzahlen. Ersetzt die vier getrennten Kacheln Start, Aktuell,
  Verlust und Tage, die zusammengehoeren und trotzdem wie vier Knoepfe aussahen
* **Coaching.** Bis zu drei Beobachtungen zum aktuellen Stand, nach Gewicht
  sortiert, jede mit der Zahl dahinter. Ausdruecklich Beobachtungen, keine
  Anweisungen: die Vorgabe trifft der Trainer
* **Kennzahlen.** Sekundaer und kleiner. Statt der Trefferquote je Tag steht dort
  die Abweichung des Schnitts vom Ziel, mit Vorzeichen in die gute Richtung.
  Protein und Schritte positiv wenn darueber, Kalorien positiv wenn darunter.
  Vorher zeigte die Kachel Rot, obwohl der Schnitt auf der guten Seite lag
* **Gewichtsverlauf.** Groesstes Element, mit vier Ansichten: Gewicht mit
  hervorgehobenen Ausreissern, 7 Tage Trend mit Ausgleichsgeraden, Prognose mit
  Band bis zum Ziel, Veraenderung als Tagesbilanz. Legende darunter
* **Unterschiedliche Darstellungen statt gleichartiger Diagramme.** Zielbereiche
  fuer Makros, Sparklines fuer Wellness, Wochenmittel als Linie statt als Balken,
  weil Balken eine Nulllinie behaupten, die es bei Gewichten nicht gibt
* **Designsystem.** Warmes Dunkel statt Marineblau, ein Akzent, semantisches
  Gruen und Terrakotta, neutrale Datenfarben, Zahlen in Tabellenziffern,
  deutsches Dezimalkomma und echtes Minuszeichen
* **Ladezustand** als Skelett statt als Spinner, Zeitraum um 90 Tage erweitert

Akzeptanz:
* [x] Keine Funktion, keine Berechnung und kein Tab entfernt
* [x] 85 Tests gruen, Typpruefung und Build sauber
* [x] Kein horizontaler Ueberlauf bei 375 px, nur die Tableiste scrollt seitlich
* [x] Alle vier Ansichten des Gewichtsverlaufs geprueft, keine Konsolenfehler

## Polish — Kontrast, Hierarchie, Verstaendlichkeit · ABGESCHLOSSEN

Gezielter Durchgang nach dem Redesign, ohne Konzept oder Datenlogik anzufassen.

* **Kontrast.** Sekundaerer Text von 4.8 auf 6.2 zu 1, gedaempfter Text auf
  8.7 zu 1, Achsenbeschriftungen und Gitter angehoben. Der Abstand zwischen
  Seitengrund und Analyseflaeche war unter einem Prozentpunkt Helligkeit und ist
  jetzt sichtbar
* **Hero rund neunzehn Prozent flacher**, 243 statt 300 px. Auf 1440 mal 900
  sind 83 px des Gewichtsverlaufs sichtbar, vorher endete die Seite an der
  Tableiste
* **Coaching** mit einem fuehrenden Hinweis und zwei kleineren, dazu Rubriken
  Tempo, Ernaehrung und Trend. Vorher drei gleich schwere Zellen mit Trennlinien
* **Kennzahlen in drei Gruppen** statt sieben gleicher Spalten: Ernaehrung und
  Aktivitaet mit Zielbalken, Regeneration als Indikatorenreihe ohne Ziel
* **Navigation** als zusammenhaengende Leiste auf eigener Flaeche, aktiver
  Zustand als hellere Flaeche mit Akzentkante statt als einzelner gelber Knopf.
  Alle Bedienelemente exakt 30 px hoch
* **Zielbereiche** mit Zielkerbe, beschrifteter Marke, Skala und Legende
* **Protein und Kalorien** als eigenes Diagramm: Zielline, 7 Tage Mittel, Tage
  auf der falschen Seite farbig markiert, Tooltip mit Wochentag, Datum, Wert,
  Ziel und Differenz, Hoehe von 280 auf 190 px
* **Lint eingerichtet**, ESLint mit typescript-eslint. Die dabei gefundenen
  sechzehn `any` sind ersetzt, unter anderem durch eine typisierte veraenderbare
  Sicht auf die Diagrammoptionen

Ein Fehler dabei gefunden und behoben: die responsiven Regeln standen vor den
Basisregeln. Media Queries erhoehen die Spezifitaet nicht, deshalb gewann die
spaetere Basisregel und das Kennzahlraster behielt auf dem Handy drei Spalten.
Die responsiven Regeln stehen jetzt geschlossen am Dateiende.

Akzeptanz:
* [x] Geprueft bei 1920, 1440, 1024, 768, 430 und 375 px Breite
* [x] Kein Seitenueberlauf, nur die Tableiste scrollt seitlich
* [x] Keine abgeschnittenen Texte
* [x] Lint, Typecheck, 85 Tests und Build sauber

## Oberflaeche nach Systemvorbild · ABGESCHLOSSEN

Vollstaendiger Austausch der Praesentationsschicht. Datenlogik, Sheets Anbindung
und Berechnungen unveraendert, keine Funktion entfernt.

Ausgangsproblem: 23 Flaechen mit demselben Radius und derselben Fuellung. Wenn
alles einen Container hat, hat nichts Vorrang, und das Ergebnis liest sich wie
eine Vorlage.

* **Container abgebaut.** Diagramme, Kennzahlen und Insights tragen keine eigene
  Flaeche mehr. Getrennt wird mit Abstand, Ausrichtung und Haarlinien. Uebrig
  bleiben zwei Flaechen: der Konfigurationsdialog und die segmentierten
  Steuerungen
* **Farbsystem ersetzt.** Systemfarben in der dunklen Variante auf schwarzem
  Grund. Der goldene Akzent ist weg. Blau fuer Bedienung und neutrale Datenzuege,
  Gruen Orange und Rot ausschliesslich fuer Bewertung
* **Typografie als Traeger.** Systemschriftfamilie, eine Zahl auf der Seite ist
  gross, alles andere klein. Tabellenziffern fuer jeden Messwert
* **Hero.** Eine Zahl, eine Zeile Kontext, eine vier Pixel hohe Strecke, drei
  Kennzahlen mit senkrechten Trennern, darunter das Zieldatum in Normalschrift
* **Insights** als Zeilen mit Statuspunkt, Rubrik und zwei Zeilen Erklaerung
* **Tageskennzahlen** wie eine Zusammenfassung: Bezeichnung, Wert, Zielwert,
  Abweichung, darunter ein drei Pixel hoher Balken
* **Navigation und Zeitraum** als segmentierte Steuerungen
* **Diagramme** mit waagerechten Hilfslinien, ohne Rahmen, ohne Flaeche. Punkte
  nur an auffaelligen Tagen, Zielgewicht als feine gestrichelte Linie

Dabei behoben: die Kopfzeile lief bei 960 px ueber, weil die Statuszeile im
Fehlerfall die Meldung der Schnittstelle traegt und beliebig lang wird. Sie wird
jetzt abgeschnitten. Die Reiterleiste lief bei 768 px ueber, sie stapelt jetzt ab
900 px und scrollt notfalls in sich.

Geprueft bei 1920, 1440, 1024 und 768 px auf allen sechs Reitern: kein
waagerechter Seitenlauf, keine abgeschnittenen Texte. Lint ohne Befund,
Typpruefung sauber, 88 Tests, Build erfolgreich.

## Phase 6 — Umstellung und Abschluss · ABGESCHLOSSEN

* [x] README mit Setup, Sheet Struktur, Deploy
* [x] ADR fuer die Stack Entscheidung
* [x] GitHub Actions Workflow, Pages Quelle von Legacy auf Actions umgestellt
* [x] Merge auf `main`, im Schnellvorlauf, weil `rewrite` direkt darauf aufsetzte
* [x] Live geprueft: HTTP 200, Buendel und Stilblatt unter dem Basispfad
      erreichbar, keine Konsolenfehler
* [x] Messwerte in keinem Commit, per Abruf gegen raw.githubusercontent bestaetigt

Rueckfallweg bleibt Tag `v0-legacy` plus Zuruecksetzen der Pages Quelle auf
`Deploy from a branch`, zusammen unter fuenf Minuten.

Vor dem ersten Push wurde die Branchhistorie umgeschrieben. Fixtures, Golden
Values und der Rohexport tauchen in keinem Commit auf, ebenso wenig Klarname,
Startgewicht und Koerpergroesse. Nach dem Push waere das nicht mehr moeglich
gewesen.

## Phase 7 — Blockuebergreifende Trainingshistorie

Erst sinnvoll, wenn `Mesocycle 2` echte Ist Daten traegt, also ab Mitte August.
Automatische Erkennung aller `Mesocycle N` Tabs, Umschalter zwischen Bloecken,
blockuebergreifender Verlauf je Uebung. Die Zusammenfuehrung von Uebungsnamen
zwischen Bloecken wird an echten Daten entwickelt, nicht an ausgedachten.

## Offene Fragen

* Zielgewicht fuer die Projektion. Einziger noch fehlender Wert, der nirgends im
  Sheet steht

## Geklaert

* Die Lastnotation `55x2` bedeutet 55 kg je Seite, also 110 kg gesamt. Gerechnet
  wird durchgehend mit der Gesamtlast, auch fuer die Progression. Der Grund liegt
  in den Daten: keine Uebung haelt eine Schreibweise ueber alle Wochen durch, und
  bei `Katana Extensions Unilateral` stehen `7,5x2` und `15` als Werte derselben
  Uebung nebeneinander. Die Zahl vor dem `x` waere damit nicht vergleichbar
* Die uneinheitliche Erfassung ist bekannt und wird nicht nachtraeglich
  bereinigt. Der Parser muss damit umgehen

## Zurueckgestellt

* `Zeitverlauf`, `Sizes` und `Supplements` werden vom Dashboard nicht gelesen.
  `Sizes` traegt derzeit 21 befuellte Zellen und lohnt nicht. `Zeitverlauf` mit
  466 Zellen ist ungeprueft und koennte spaeter Wert haben
* Wochenexport als Textblock fuer den Chat mit dem Trainer

## Retrospektive

### Phase 6

**Was lief gut.** Die Umstellung spaet zu machen war richtig. Zwischen dem Push
auf `main` und dem Umschalten der Pages Quelle lieferte die Seite kurz die
Vite Quelldatei aus, weil das Legacy Verfahren das Wurzelverzeichnis nimmt.
Waere das in Phase 1 passiert, haette es Wochen gedauert statt zwei Minuten.

**Wo lagen falsche Annahmen.** Bei der Frage, was in ein oeffentliches
Repository gehoert. Die Fixtures gegen echte Daten waren fachlich richtig und
haben mehrere Fehler gefunden, die synthetische Zeilen nie gezeigt haetten. Dass
diese Dateien damit auch 80 Tage Gesundheitsdaten in ein oeffentliches
Repository tragen wuerden, stand in keiner Spec und ist erst unmittelbar vor dem
Push aufgefallen.

**Was muss naechstes Mal genauer spezifiziert werden.** Bei jeder Datei, die
committet wird, gehoert die Frage dazu, wer sie am Ende lesen kann. Nicht erst
beim Deploy.

### Phase 5

**Was lief gut.** Die Aufteilung in Renderfunktionen je Abschnitt war kleiner als
befuerchtet und wirkt sofort: drei Diagramme beim Start statt fuenfzehn.

**Wo lagen falsche Annahmen.** Zwei. Erstens sollte das Diagrammraster auf
breiten Schirmen automatisch mehr Spalten bilden. Das sieht gut aus, solange ein
Abschnitt genug Diagramme hat, und hinterlaesst sonst Luecken. Zwei feste Spalten
sind hier richtig. Zweitens hat die Aufteilung eine Karte im Wellness Tab leer
laufen lassen, weil sie von der Analyse gefuellt wurde. Sie ist in den Analyse
Tab gewandert, wo sie ohnehin hingehoert, denn sie rechnet ueber den gesamten
Zeitraum.

**Was muss naechstes Mal genauer spezifiziert werden.** Wer welchen Bereich
zeichnet. Beim Umbau auf verzoegertes Zeichnen faellt sofort auf, wo die
Zustaendigkeiten vorher unklar waren, aber erst wenn etwas leer bleibt.

### Phase 4

**Was lief gut.** Synthetische Reihen mit analytisch bekanntem Ergebnis haben
sofort einen Fehler gezeigt, der sonst nie aufgefallen waere: auf einem exakt
linearen Verlust von 0.7 kg pro Woche lieferte die Regression 0.687. Ursache
waren die ersten Punkte des gleitenden Mittels, die ueber weniger als sieben Tage
mitteln und die Gerade verbiegen. Sie bleiben jetzt aussen vor.

**Wo lagen falsche Annahmen.** Die Entscheidung aus Phase 2, den Gesamtverlust
geglaettet zu zeigen, war falsch und wurde zurueckgenommen. Geglaettet ist richtig
fuer Rate, Plateau und Projektion, weil dort der Trend zaehlt. Fuer die
Titelzahl zaehlt die Messung, und die erste Waegung von 99.9 kg ist eine.

**Was muss naechstes Mal genauer spezifiziert werden.** Zahlen, die dem Nutzer
gehoeren, weil er sie kennt und weitergibt, duerfen nicht ohne Rueckfrage
ersetzt werden. Eine Verbesserung der Methodik ist kein Freibrief, die vertraute
Zahl auszutauschen. Im Zweifel beides zeigen.

### Phase 3

**Was lief gut.** Der Test, der den Quelltext selbst nach Zielzahlen durchsucht,
ist billig und faengt genau die Rueckfaelle, die sonst unbemerkt wieder
einziehen. Dass die Werte im Sheet standen, hat die Phase auf einen Bruchteil des
geplanten Aufwands gebracht.

**Wo lagen falsche Annahmen.** Keine nennenswerten. Die Struktur war aus Phase 0
bekannt, das Parsen lief auf Anhieb.

**Was muss naechstes Mal genauer spezifiziert werden.** Zahlenformate. Der
Kalorienwert 2300,5 wurde zuerst auf 2301 gerundet angezeigt, was eine Vorgabe
verfaelscht, die es so nicht gibt. Anzeigeformate gehoeren in die Spec, nicht in
die Umsetzung.

### Phase 2

**Was lief gut.** Die Umstellung des Golden Value Tests von "alles muss gleich
bleiben" auf "genau diese Abweichungen sind erlaubt" hat sich sofort bezahlt
gemacht. Am Ende waren es vier neue Tage und ein geaendertes Feld, alles andere
identisch. Ohne diese Fassung haette man die Aenderungen nur behaupten koennen.

**Wo lagen falsche Annahmen.** Zwei. Erstens war der Vorschlag, die Progression
auf der Zahl vor dem `x` zu rechnen, falsch. Erst der Blick in die Daten zeigte,
dass dieselbe Uebung mitten im Block auf Gesamtlast wechselt und `7,5x2` und `15`
als derselbe Wert nebeneinander stehen. Zweitens war ein Test falsch, nicht der
Code: am 25.06. stehen die Makros durchgaengig als `?`, dort war nie etwas zu
retten. Der Ertrag dieses Fixes liegt im 26.06.

**Was muss naechstes Mal genauer spezifiziert werden.** Ein Fehler im
Fixture Generator hat die Kopfzeile mit anonymisiert und damit die
Spaltenauflaesung fuer die zweite Notizspalte ins Leere laufen lassen. Aufgefallen
ist das nur, weil eine erwartete Abweichung ausblieb. Werkzeuge, die Testdaten
erzeugen, brauchen selbst eine Pruefung.

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


## Phase 9.1 bis 9.3, Details aus der Uebergabe (archiviert 25.10.2026)

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

## Retro Phase 6

1. Gut: Die Umstellung spaet zu machen war richtig. Zwischen Push und Umschalten der Pages Quelle lieferte die Seite kurz die Vite Quelldatei aus, ein Fehler, der in Phase 1 Wochen gekostet haette.
2. Falsche Annahme: Fixtures gegen echte Daten waeren unkritisch. Sie haetten 80 Tage Gesundheitsdaten in ein oeffentliches Repo getragen, aufgefallen erst unmittelbar vor dem Push.
3. Besser spezifizieren: Bei jeder committeten Datei die Frage "wer kann sie am Ende lesen" schon in der Spec stellen, nicht erst beim Deploy.

## Retro Phase 8

1. Gut: Die Recherche vor dem Code (ein Abruf, Belege fuer jeden Selektor) hat den Parser ohne Raten moeglich gemacht. Rechenkern und Pipeline liefen parallel, weil die Schnittstelle `shopping_items.json` vorher festgelegt war.
2. Falsche Annahme: "Soßen kosten hoechstens rund 20 kcal" stimmte fuer den Sonntag nicht, zwei Soßen an einem Tag rissen das Band. Ebenso war die Packungsrundung zu streng, das Plan Dokument hatte bewusst leicht abgerundet. Und der Handoff haette Klarname, Sheet ID und Filialadressen ins oeffentliche Repo getragen.
3. Besser spezifizieren: Toleranzen (Packungen, kcal Band) als Zahl in die Spec schreiben, nicht implizit aus einem Beispiel ableiten. Bei uebernommenen Dokumenten die Frage "wer kann das lesen" vor dem ersten Commit stellen.
