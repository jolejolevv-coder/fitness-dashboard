# ADR 0001: Vite und TypeScript, Auslieferung ueber GitHub Actions

Datum: 29.07.2026
Status: angenommen, Umstellung der Pages Quelle steht noch aus

## Kontext

Das Dashboard bestand aus einer einzelnen `index.html` mit 822 Zeilen, Chart.js
vom CDN und der gesamten Logik in einem Skriptblock. Es lief. Anlass fuer den
Umbau war nicht der Zustand des Codes, sondern was hineinsollte: eine Analytik
aus Regression, Energiebilanz und Plateau Erkennung, die belastbar sein muss,
weil ihre Zahlen in ein Gespraech mit einem Personal Trainer getragen werden.

Zusaetzlich hat sich beim Sichten der echten Daten gezeigt, dass die
bestehenden Parser mehrere stille Fehlinterpretationen enthielten, unter anderem
`55x2` als 552 kg und den Verlust ganzer Tage, sobald ein Gewicht fehlte. Solche
Fehler entstehen dort, wo Werte ohne Typen und ohne Tests durchgereicht werden.

## Entscheidung

TypeScript im strict Modus, gebuendelt mit Vite, getestet mit Vitest,
ausgeliefert als statisches `dist/` ueber GitHub Pages, gebaut von einem
GitHub Actions Workflow.

Chart.js wandert vom CDN in das eigene Bundle.

Kein Framework. Die Oberflaeche hat sechs Tabs und keinen Zustand, der React
oder Vergleichbares rechtfertigen wuerde.

## Begruendung

**Typen.** Die Parser arbeiten durchgehend mit `number | null`. Genau an diesen
Uebergaengen sassen die gefundenen Fehler. `strict` mit
`noUncheckedIndexedAccess` faengt sie zur Uebersetzungszeit.

**Tests.** Die Analytik ist Statistik. Eine Regression, die auf einem exakt
linearen Verlauf 0.687 statt 0.7 liefert, faellt ohne synthetische Testreihen
niemandem auf. Genau das ist passiert und wurde nur durch einen Test entdeckt.

**Buendelung.** Ein fremdes Skript vom CDN ohne Integritaetspruefung in einer
oeffentlichen Seite ist vermeidbares Risiko, und die Seite haengt an der
Verfuegbarkeit von cdnjs.

**Actions.** Ein Buendelschritt schliesst aus, dass Pages das Repository
Wurzelverzeichnis ausliefert. Damit ist der Workflow keine Wahl, sondern Folge.

## Preis

* Eine Node Toolchain und npm Abhaengigkeiten, die gepflegt werden wollen
* Ein Deploy Workflow, dessen Ausfall die Seite stilllegt
* Rund 200 KB Chart.js im eigenen Bundle statt aus einem fremden Cache
* Eine einmalige Umstellung der Pages Quelle mit kurzer Ausfallgefahr

Bei rund 1000 Zeilen Logik mit nichttrivialer Statistik ist das vertretbar. Bei
200 Zeilen Anzeigecode waere es das nicht gewesen.

## Verworfene Alternativen

**Alles in einer Datei lassen.** Maximal einfach und ohne Werkzeugkette, aber
ohne Tests fuer die Analytik. Verworfen, weil die Zahlen belastbar sein muessen.

**Gebautes `dist/` mitcommitten und Pages im Legacy Verfahren lassen.** Kein
Workflow, kein Umstellungsrisiko, aber gebaute Dateien in der Versionsverwaltung
und ein Bauschritt, an den vor jedem Deploy jemand denken muss. Verworfen.

**Fruehe Umstellung der Auslieferung.** Der Fortschritt waere jederzeit live
sichtbar gewesen. Verworfen, weil das laufende Dashboard waehrend eines
laufenden Mesozyklus zur Baustelle geworden waere. Die Umstellung erfolgt am
Ende, mit Tag `v0-legacy` als Rueckfallweg.

## Folgen

Die Migration lief in getrennten Phasen: erst ohne Verhaltensaenderung gegen
eingefrorene Golden Values, danach die Fehlerbehebungen einzeln und begruendet.
Dadurch ist jede geaenderte Zahl im Nachhinein einer Entscheidung zuzuordnen.
