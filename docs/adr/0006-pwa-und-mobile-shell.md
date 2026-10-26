# ADR 0006: PWA mit Service Worker und eine Oberflaeche mobile first

Status: vorgeschlagen (26.10.2026). Die Richtungsentscheidungen hat der Nutzer
am 26.10.2026 getroffen (PWA mit Service Worker, rein lesend, eine Oberflaeche,
Chart.js bleibt und wird nachgeladen). Offen zur Freigabe ist die Wahl des
Werkzeugs fuer den Service Worker. Spec: `specs/features/mobile-app.md`.

## Kontext

Das Dashboard ist eine statische Seite auf GitHub Pages (ADR 0001) und wird
zunehmend am Handy genutzt: Plan, Einkauf und Kochansicht in der Kueche, die
Wochenfrage unterwegs. Die Oberflaeche ist fuer den Desktop gebaut, mit acht
Reitern und Zeilen aus Bezeichnung und Wert. Der Nutzer will eine App am Handy,
das Sheet bleibt die Datenbank. `specs/tech-stack.md` schliesst PWA und Service
Worker bisher aus.

Randbedingungen: kein Backend, CSP per `meta` ohne eigene Kopfzeilen, Basispfad
`/fitness-dashboard/`, der Google API Key steht im Query der Sheets Anfragen,
das iPhone ist das Zielgeraet.

## Entscheidung 1: Installierbare PWA statt nur mobilem Layout

Manifest plus Service Worker, der die App Huelle cached.

* Gewinn: Start vom Home Bildschirm im Vollbild, Start ohne Netz in der Kueche
  oder im Studio, die Daten dazu liegen schon im localStorage
* Kosten: ein Updateweg, der falsch laufen kann (alte Version bleibt haengen,
  nachgeladener Chunk der alten Version fehlt). Zwei neue CSP Direktiven. Auf
  dem iPhone hat die installierte App einen eigenen localStorage, die
  Zugangsdaten muessen dort einmal neu eingetragen werden
* Verworfen: nur Manifest. Ohne Service Worker bleibt die App ohne Netz weiss,
  das ist am Handy der haeufigste Fall, in dem eine App enttaeuscht
* Verworfen: nur mobiles Layout. Loest den Tabellen Look, aber nicht den Start
  im Vollbild

Leitplanke: Der Service Worker beantwortet nur GET Anfragen der eigenen
Herkunft unter `/fitness-dashboard/`. Anfragen an `sheets.googleapis.com` und
`api.anthropic.com` gehen an ihm vorbei, damit kein API Key und keine
Sheet Daten im Cache Storage landen. `index.html` und `data/*.json` laufen
Netz zuerst mit Cache als Rueckfall, gehashte Assets Cache zuerst.

## Entscheidung 2: Werkzeug fuer den Service Worker

### A: `vite-plugin-pwa` mit Workbox (empfohlen)

* Erzeugt beim Build die Liste der gehashten Assets, das Manifest und
  `sw.js`, kennt den Basispfad von Vite
* Updatelogik und Aufraeumen alter Caches sind erprobt, das ist der heikle
  Teil
* Kosten: eine Entwicklungsabhaengigkeit mit Workbox darunter, `sw.js` rund
  5 bis 8 kB gzip. Laeuft nur im Build, das Haupt Bundle bekommt nur die
  Registrierung (unter 1 kB). Updates der Abhaengigkeit sind zu pflegen
* Dazu `@vite-pwa/assets-generator` fuer die Icons aus einer SVG Vorlage, auch
  nur zur Build Zeit

### B: Eigener Service Worker

* Rund 80 Zeilen plus ein kleines Vite Plugin, das die Asset Liste in `sw.js`
  schreibt. Keine Abhaengigkeit, `sw.js` unter 2 kB
* Kosten: Updateweg, Versionierung der Caches und Behandlung alter Chunks
  selbst schreiben und testen. Genau dort entstehen die Fehler, die man erst
  auf dem Handy nach dem dritten Deploy sieht

Empfehlung A. Die Abhaengigkeit bleibt im Build, die Laufzeit der Seite
waechst nicht, und der Teil mit dem hoechsten Fehlerrisiko kommt aus einer
verbreiteten Bibliothek statt aus eigenem Code.

## Entscheidung 3: Eine Oberflaeche, mobile first

Ein Layout fuer 375 px, am Desktop ab 900 px mit linker Navigation und zwei
Spalten. Vier Ziele (Heute, Verlauf, Training, Kueche) mit Hash Routing.

* Gewinn: ein Code Pfad, eine Navigation, keine doppelte Pflege
* Kosten: der heutige Desktop Look mit acht Reitern verschwindet, am Desktop
  sind Ernaehrung, Wellness und Analyse einen Tipp tiefer
* Verworfen: Desktop wie heute, Handy mit eigener Huelle. Zwei Navigationen,
  jede Aenderung an einem Abschnitt muss in beiden Huellen funktionieren

## Entscheidung 4: Chart.js bleibt, wird nachgeladen

`src/charts/` wandert hinter einen dynamischen Import. `Heute` zeigt Zahlen
ohne Diagramme und laedt ohne Chart.js.

* Gewinn: Haupt Chunk von 108 kB auf geschaetzt unter 50 kB gzip, schnellerer
  Start am Handy. Kein Neuschreiben der 15 Diagramme
* Kosten: erster Wechsel auf `Verlauf` oder `Training` wartet einmal auf den
  Chunk, offline kommt er aus dem Service Worker Cache
* Verworfen: eigene SVG Diagramme. Kleinstes Bundle, aber Achsen, Tooltips und
  Tests fuer alle Diagramme neu, ohne Gewinn an Aussage

## Folgen

* `specs/tech-stack.md` und `specs/mission.md` werden in 12.0 angepasst
* CSP bekommt `worker-src 'self'` und `manifest-src 'self'`
* Der Rueckfallweg bei einem kaputten Service Worker ist ein Deploy, der
  `sw.js` durch einen Service Worker ersetzt, der sich selbst abmeldet und die
  Caches leert. Das Plugin bietet dafuer `selfDestroying`
