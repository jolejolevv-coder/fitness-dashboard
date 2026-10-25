# ADR 0002: Angebotspreise ueber GitHub Actions Cron

Status: angenommen (25.10.2026)

## Kontext

Der Reiter `Einkauf` soll je Artikel das guenstigste aktuelle Angebot bei Lidl,
Aldi Sued und Edeka zeigen. Die Seite ist statisch auf GitHub Pages, ohne
Backend. Muskelmarkt (`muskelmarkt.de/app1.php`) rendert die Angebote
serverseitig als HTML, ohne Login und ohne JSON API.

## Entscheidung

Ein Workflow `.github/workflows/prices.yml` laeuft Sonntag 18:00 Europe/Berlin
und auf Knopfdruck, ruft genau eine Seite ab, filtert auf die eigenen Artikel
und committet `data/prices.json` nur bei Aenderung. Fehler lassen den Lauf
scheitern, die alte Datei bleibt stehen.

## Verworfen

* Abruf im Browser: scheitert an CORS und wuerde bei jedem Seitenaufruf die
  fremde Seite belasten
* Azure Static Web Apps mit Functions: echte API und Entra Auth, aber Betrieb
  und Kosten fuer ein Werkzeug mit einem Nutzer
* Manuelle Pflege: keine Abhaengigkeit von fremdem HTML, aber woechentliche
  Handarbeit, die erfahrungsgemaess ausfaellt

## Folgen

* Preise sind nur so aktuell wie der letzte Lauf, Angebote ab Donnerstag fehlen
  bis Sonntag
* Actions Commits erscheinen im Verlauf von `main` und loesen jeweils einen
  Deploy aus
* Aendert Muskelmarkt das Markup, faellt der Lauf aus und zeigt das als
  fehlgeschlagenen Workflow
* Die Angebotsauswahl liegt oeffentlich im Repo. Sie verraet die Einkaufsliste
* Rechtlich: Privatnutzung, keine Weitergabe, vor dem Livegang Anfrage an
  Muskelmarkt durch den Nutzer

## WAF

* Reliability: Ausfall der Quelle beschaedigt nichts, die Liste bleibt ohne
  Preise nutzbar
* Security: kein Geheimnis im Workflow, nur `contents: write` fuer den Commit
* Cost: 0 Euro, ein Lauf pro Woche weit unter dem freien Actions Kontingent
