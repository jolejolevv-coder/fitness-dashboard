# Mobile App (Phase 12)

Status: freigegeben 26.10.2026, mit ADR 0006 Variante A (`vite-plugin-pwa`).
Icon und hell oder dunkel entscheidet der Vorschlag in 12.1. Entscheidungen des Nutzers vom
26.10.2026 sind eingearbeitet (PWA mit Service Worker, rein lesend, eine
Oberflaeche mobile first, Chart.js bleibt und wird nachgeladen). Architektur in
`docs/adr/0006-pwa-und-mobile-shell.md`.

## Goal

Das Dashboard wird eine installierbare Web App mit einer Oberflaeche, die fuer
das Handy gebaut ist und nicht mehr wie eine Tabelle wirkt, waehrend das Google
Sheet unveraendert die einzige Datenbank bleibt.

## Ausgangslage

Gemessen am 26.10.2026 auf `origin/main` (`5e3f3cd`):

* Acht Reiter in einer Zeile (Uebersicht, Ernaehrung, Wellness, Wochen,
  Training, Analyse, Plan, Einkauf), darueber Kopf mit drei Textknoepfen,
  Antwortblock, Insights und Tagesdurchschnitt, daneben vier Zeitraumknoepfe.
  Bei 375 px laeuft die Reiterzeile ueber die Breite hinaus
* Plan zeigt jede Mahlzeit mit allen Zutaten als Zeilen Name gegen Gramm,
  Training eine sechsspaltige Tabelle `t-table`, Analyse und Wochen Panels mit
  Zeilen aus Bezeichnung und Wert. Das ist der Tabellen Look, den der Nutzer
  meint
* Bundle gzip: Haupt Chunk 108,05 kB (davon Chart.js geschaetzt rund 65 kB,
  wird in 12.0 gemessen), CSS 5,23 kB, `index.html` 3,08 kB. Nachgeladen:
  `cook` 4,11 kB, `generator` 3,49 kB, `request` 3,30 kB, Anthropic SDK
  82,63 kB
* Sheet Daten liegen schon heute nach jedem Abruf im localStorage
  (`saveCache`, `loadCache`), Plan, Einkauf und Kochen funktionieren ohne Sheet

## Was Web App hier heisst

Eine Progressive Web App:

* Web App Manifest mit Name `Body Recomp`, `display: standalone`, Icons, Farbe
  des Hintergrunds und der Statusleiste. Auf dem iPhone ueber Teilen und Zum
  Home Bildschirm installiert, startet im Vollbild ohne Browserleiste
* Service Worker, der nur die App Huelle cached: `index.html`, die gehashten
  Assets, Icons, `data/prices.json` und `data/regular_prices.json`. Die App
  startet damit auch ohne Netz, die Sheet Werte kommen dann wie heute aus dem
  localStorage, das Alter der Daten steht sichtbar daneben
* Der Service Worker beruehrt Anfragen an `sheets.googleapis.com` und
  `api.anthropic.com` nicht. Die Sheets URL traegt den API Key im Query, ein
  Cache wuerde den Schluessel ausserhalb des localStorage ablegen
* Kein App Store, kein Wrapper, keine Push Mitteilungen, kein
  Hintergrundabruf

## Informationsarchitektur

Unten eine feste Navigationsleiste mit vier Zielen statt acht Reitern:

| Ziel | Inhalt heute | Unterteilung |
| --- | --- | --- |
| Heute | Antwortblock (Rate gegen Soll, Erhaltungsbedarf, Plateau, Compliance), Insights, Tagesdurchschnitt | keine, eine Spalte zum Scrollen |
| Verlauf | Uebersicht, Ernaehrung, Wellness, Wochen, Analyse | Segmente `Gewicht`, `Ernaehrung`, `Wellness`, `Wochen`, `Analyse`; Zeitraum als ein Steuerelement nur hier |
| Training | Training | Liste der Uebungen, Tippen oeffnet die Detailansicht mit Progression und 1RM |
| Kueche | Plan, Einkauf, Kochansicht | Segmente `Heute`, `Woche`, `Prep`, `Vorschlag`, `Einkauf`; Kochen wie heute als Vollbild aus dem Plan |

Oben eine schmale Leiste mit dem Namen des Ziels, dem Alter der Daten und zwei
Symbolen: Aktualisieren und Einstellungen. Einstellungen ist ein Vollbild Blatt
mit dem heutigen Konfigurationsdialog, dazu CSV Export. Die heutigen
Textknoepfe im Kopf entfallen.

Jedes Ziel und jedes Segment hat einen Hash (`#heute`, `#verlauf/wellness`,
`#kueche/einkauf`), damit Zurueck Geste, Neuladen und Lesezeichen
funktionieren. Startziel mit Sheet ist `Heute`, ohne Sheet `Kueche`, wie heute
`overview` und `plan`. Ohne Sheet sind `Heute`, `Verlauf` und `Training`
ausgeblendet, die Leiste zeigt dann nur `Kueche`.

Am Desktop dieselbe Struktur: ab 900 px wandert die Navigation in eine linke
Leiste, Inhalte laufen in bis zu zwei Spalten. Keine zweite Navigation, kein
zweiter Code Pfad.

## Was vom Tabellen Look verschwindet

* Reiterzeile und Zeitraumknoepfe ueber allen Reitern. Der Zeitraum wirkt
  heute ohnehin nur auf Charts im Verlauf, nie auf die Analytik
* Zeilen aus Bezeichnung und Wert als Grundbaustein. Je Karte steht eine Zahl
  gross, darunter ihre Datenbasis klein. Trennlinien zwischen Zeilen entfallen,
  Gruppierung entsteht ueber Abstand und Flaechen
* Die Tabelle `t-table`. Jede Uebung wird eine Listenzeile mit Name, Start gegen
  Aktuell und Progression, Muskelgruppe und Tag als Filter oben statt als
  Spalten
* Mahlzeiten im Plan zeigen geschlossen Name, kcal und Protein. Die Zutaten
  klappen per Tippen auf. Die Auswahl des Gerichts bleibt ein `select`, wird
  aber als volle Zeile mit Tippflaeche von mindestens 44 px gesetzt
* Einkauf bleibt die abhakbare Liste von heute, gesetzt als Liste nach
  Kategorie mit grossen Tippflaechen, Preisangaben rechtsbuendig. Abhaken lebt
  weiter nur im localStorage
* Analyse Panels werden Karten mit je einer Aussage: Trend, Serien,
  Zusammenhaenge

Die Designrichtung (Farben, Schrift, Abstaende, Komponenten) entsteht in 12.1
mit dem Skill `impeccable:impeccable` und wird als statischer Entwurf der vier
Ziele bei 375 px vorgelegt. Das ist der einzige Halt innerhalb der Phase.

## Harte Regeln

| Regel | Wie die App sie haelt |
| --- | --- |
| Kein Schreibzugriff auf das Sheet | Die App bleibt rein lesend. Abhaken im Einkauf und Segmentwahl liegen im localStorage. Der Service Worker cached nur GET Anfragen der eigenen Herkunft |
| Keine Erklaertexte | Keine Einfuehrungsbildschirme, keine Hinweistexte zur Installation, keine Tooltips mit Erklaerung. Navigation traegt Symbol plus Wort. Leere Zustaende zeigen nur die Zahlenzeile |
| `textContent` statt `innerHTML` | Neue Bausteine (Navigation, Leiste, Karten, Blatt) entstehen ueber die Helfer in `src/ui/dom.ts`. Ein Test prueft, dass `src/` nichts an `innerHTML` zuweist |
| Mindestdatenlage | `src/analytics/` und `src/parse/` bleiben unveraendert. Die Verweigerungszeilen wie `Basis 11 von 14 Tagen` stehen auf der Karte an der Stelle der Zahl |
| Spalten ueber Kopfzeilen | unberuehrt, die Fehlermeldung bei fehlender Spalte erscheint als Karte auf `Heute` |
| Zugangsdaten nur im localStorage | Der Service Worker cached keine Anfrage an Google oder Anthropic. Auf dem iPhone hat die installierte App einen eigenen Speicher, die Zugangsdaten werden dort einmal neu eingetragen |
| Kein Klarname, `noindex` | Manifest Name `Body Recomp`, `noindex` bleibt im `index.html` |

Die CSP bekommt `worker-src 'self'` und `manifest-src 'self'`, sonst nichts.
`connect-src` bleibt gleich.

## Bundle Budget

Gemessen gzip gegen `origin/main` zum Start der Phase.

| Teil | Heute | Ziel |
| --- | --- | --- |
| Haupt Chunk, noetig fuer `Heute` | 108,05 kB | hoechstens 50 kB, weil Chart.js herausfaellt |
| Chunk `charts` mit Chart.js, nachgeladen bei `Verlauf` oder `Training` | im Haupt Chunk | Groesse von Chart.js plus hoechstens 2 kB |
| Neue Shell (Navigation, Router, Leiste, Blatt, Registrierung des Service Workers) | 0 | hoechstens 4 kB, zaehlt zum Haupt Chunk |
| CSS | 5,23 kB | hoechstens 8 kB |
| `sw.js` mit Workbox | 0 | hoechstens 8 kB, ausserhalb des Bundles, einmal je Version |
| Summe aller Chunks bei voller Nutzung | Stand heute | hoechstens 5 kB mehr als heute, die bestehende Grenze aus Phase 9 |

Die Zahlen werden nach jedem Unterschritt im Commit genannt.

## Scope

In scope:

* Manifest, Icons, Service Worker, Offlinestart mit letzten Daten
* Neue Navigation mit vier Zielen, Hash Routing, Einstellungen als Blatt
* Neues visuelles System fuer alle vier Ziele, mobile first, Desktop als
  breitere Fassung
* Chart.js als nachgeladener Chunk
* Anpassung von `specs/mission.md` und `specs/tech-stack.md` (dort steht heute
  kein PWA, kein Service Worker, mobil kein Ziel)

Out of scope:

* Jede Eingabe von Werten in der App, jeder Schreibweg zum Sheet. Der Daily
  Import aus Phase 10 bleibt der einzige Schreibweg
* Push Mitteilungen, Hintergrundabruf, Synchronisation zwischen Geraeten
* Neue Kennzahlen, neue Analytik, Aenderungen an Parsern
* Ersatz von Chart.js durch eigene Diagramme
* Phase 7 (Trainingshistorie ueber Bloecke)
* Native App, App Store, Capacitor oder aehnliche Wrapper

## Acceptance criteria

PWA

* [ ] Chrome DevTools Application zeigt ein gueltiges Manifest ohne Warnung,
  Icons 192 und 512 px plus maskable, `apple-touch-icon` 180 px
* [ ] Auf dem iPhone ueber Zum Home Bildschirm installiert, startet die App im
  Vollbild ohne Browserleiste, Statusleiste und Home Indikator verdecken nichts
  (`env(safe-area-inset-*)`)
* [ ] Im Flugmodus startet die installierte App, zeigt die letzten Sheet Werte
  mit ihrem Alter und Plan, Einkauf und Kochen voll
* [ ] Cache Storage enthaelt nach einem vollen Durchlauf keine URL von
  `googleapis.com` oder `anthropic.com` (in DevTools geprueft)
* [ ] Nach einem Deploy laedt die App beim naechsten Start mit Netz die neue
  Version, nachgeladene Chunks der alten Version brechen eine offene Sitzung
  nicht ab
* [ ] Wake Lock, Ton und Vibration der Kochansicht funktionieren in der
  installierten App (Test live unter HTTPS, nicht im WLAN)

Navigation und Oberflaeche

* [ ] Bei 375 px keine waagerechte Seitenbewegung auf keinem Ziel und keinem
  Segment
* [ ] Vier Ziele unten, Tippflaechen mindestens 44 mal 44 px, aktives Ziel
  per `aria-current` markiert, per Tastatur bedienbar
* [ ] Zurueck Geste und Neuladen fuehren auf dasselbe Ziel und Segment
* [ ] Ohne Sheet zeigt die Leiste nur `Kueche` und startet dort
* [ ] Kein Element mit `table`, keine Zeilenliste aus Bezeichnung gegen Wert
  als Grundbaustein auf `Heute`, `Verlauf` und `Training`
* [ ] Jede Kennzahl, die bisher eine Verweigerung zeigt, zeigt sie weiterhin
  als Zahlenzeile an derselben Stelle wie die Zahl
* [ ] Ab 900 px Navigation links, Inhalte zweispaltig, keine zweite Navigation
  im Markup
* [ ] Lighthouse mobil auf der Live Seite: Accessibility und Best Practices je
  mindestens 95, PWA installierbar (holt die offene Messung aus Phase 6 nach)

Regeln und Qualitaet

* [ ] `git diff origin/main -- src/analytics src/parse` ist leer
* [ ] Alle bestehenden Tests gruen, neue Tests fuer Router, Navigation ohne
  Sheet und die Liste der vom Service Worker erlaubten URLs
* [ ] Keine Zuweisung an `innerHTML` in `src/`, als Test
* [ ] CSP enthaelt `worker-src 'self'` und `manifest-src 'self'`, sonst
  unveraendert, als Test
* [ ] Bundle Budget aus der Tabelle eingehalten, Zahlen im Abschlusscommit
* [ ] `npm run check` und Build sauber

## Implementation plan

Gearbeitet wird auf einem eigenen Branch `mobile-app` ab `origin/main`, nicht
ab dem lokalen `main`.

Phase 12.0 Vorarbeit: Mission und Tech Stack anpassen, ADR 0006 auf
angenommen setzen. Anteil von Chart.js am Haupt Chunk messen und die Zielzahl
der Budget Tabelle festschreiben. `vite-plugin-pwa` und den Icon Generator in
einer zu Vite 6 passenden Version festlegen.

Phase 12.1 Designrichtung: Mit `impeccable:impeccable` die Richtung fuer eine
ruhige Handy App erarbeiten (Farben, Schrift, Abstaende, Karte, Liste,
Segmente, Navigationsleiste, Blatt) und als statischen Entwurf der vier Ziele
bei 375 px mit echten Zahlen aus den Fixtures vorlegen. Halt fuer die
Freigabe des Nutzers. Danach `DESIGN.md` im Projekt.

Phase 12.2 Shell: Router als reine Funktion (Hash zu Ziel und Segment, mit
Tests), Navigationsleiste, obere Leiste, Einstellungen als Blatt. Bestehende
Abschnitte ziehen ohne optischen Umbau in die vier Ziele, `tabs.ts` wird
ersetzt. Pruefen bei 375 px und am Desktop.

Phase 12.3 Charts nachladen: `src/charts/` hinter einen dynamischen Import,
erste Anzeige von `Verlauf` oder `Training` laedt den Chunk, `Heute` kommt
ohne aus. Bundle messen.

Phase 12.4 Oberflaeche: Ziel fuer Ziel auf das neue System, in dieser
Reihenfolge `Kueche`, `Heute`, `Training`, `Verlauf`. Jedes Ziel ein Commit
mit Pruefung bei 375 px.

Phase 12.5 PWA: Manifest, Icons, Service Worker ueber `vite-plugin-pwa`, CSP,
Updateweg, Test der erlaubten URLs. Live Test auf dem iPhone mit Installation,
Flugmodus und Kochansicht.

Phase 12.6 Abschluss: Merge nach `main`, Live Pruefung, Lighthouse, Bundle
Zahlen, Uebergabe und Retro.

## Open questions

1. Icon: Wortmarke `BR`, ein schlichtes Symbol oder etwas anderes? Ohne
   Vorgabe schlage ich in 12.1 zwei Entwuerfe vor
2. Hell, dunkel oder beides? Heute ist die Seite dunkel. Ohne Vorgabe bleibt
   dunkel, hell folgt der Systemeinstellung, wenn es im Entwurf ohne
   Mehraufwand geht
