# Phase 15: Gewicht und Schritte automatisch eintragen

Status: freigegeben 27.10.2026.

## Goal

Gewicht, Uhrzeit der Messung und Schritte des Vortags landen jeden Morgen mit
einem Tippen vom iPhone in der Datumszeile von `Daily Tracking`.

Grundlage ist Phase 10 (`specs/features/daily-import.md`, ADR 0005). Das Script
mit der Aktion `daily` ist seit Phase 13.3 gebaut und seit 13.5 bereitgestellt.
Phase 15 zieht daraus den kleinsten nuetzlichen Teil vor: drei Felder statt
sechzehn, ohne Handwerte und ohne Yazio.

## Scope

In scope:

* Kurzbefehl auf dem iPhone, der fuer gestern `Weight`, `Time` und `Steps` aus
  Health liest und an das Script sendet
* Persoenliche Automation morgens um 8:00 Uhr mit Mitteilung, Start auf Tippen.
  Health ist bei gesperrtem iPhone nicht lesbar, deshalb kein stiller Lauf
* Start von Hand mit Datumsauswahl, Standard gestern, fuer Nachtraege
* Anleitung `docs/daily-import-setup.md`: Token, Kurzbefehl Schritt fuer
  Schritt, Automation, Pruefung
* Pruefung, ob das Script die drei Felder in der Form des Bestands schreibt
  (Open question 7 der Phase 10), sonst Anpassung im Script Kern mit Tests

Out of scope:

* Yazio Werte, Schlaf und alle Handwerte. Sie bleiben Phase 10
* Health Auto Export und `Makros.gs`. `Makros.gs` laeuft laut Nutzer nicht mehr
  und bleibt unberuehrt
* Anlegen fehlender Datumszeilen. Fehlt die Zeile, meldet das Script
  `date_missing`, wie in Phase 10

## Entscheidungen (27.10.2026)

* Ausloeser: Kurzbefehl mit Tippen. Tradeoff: ein Tippen am Morgen, dafuer
  kostenlos, kein Fremddienst und kein Adapter im Script. Verworfen: Health
  Auto Export, laeuft ohne Tippen, kostet aber und sendet ein eigenes Format
* Zeitpunkt: morgens fuer gestern. Tradeoff: das Gewicht von heute steht erst
  morgen im Sheet, dafuer sind die Schritte des Vortags vollstaendig. Ein Lauf
  am Abend verliert alles nach dem Lauf, weil befuellte Zellen geschuetzt sind
* Schritte: nur Quelle Zepp. Keine Doppelzaehlung mit dem iPhone. Ein Tag ohne
  Uhr bleibt leer, es wird keine Null gesendet
* Gewicht: erste Messung des Tages aus Health, Quelle Zepp, kg mit einer
  Nachkommastelle, `Time` als `HH:mm`. Kein Wiegen heisst: beide Felder fehlen
* Eigenes Token `DAILY_IMPORT_TOKEN` in den Script Properties, getrennt vom
  Training Token. Es steht nur dort und im Kurzbefehl

## Acceptance criteria

* [ ] Ein Lauf am Morgen fuellt `Weight`, `Time` und `Steps` der Zeile von
      gestern, Werte stimmen mit Zepp ueberein
* [ ] Ein zweiter Lauf fuer dasselbe Datum schreibt nichts und meldet die drei
      Felder als belegt
* [ ] Ein Tag ohne Wiegen laesst `Weight` und `Time` leer, `Steps` wird
      geschrieben
* [ ] Falsches Token ergibt `unauthorized`, im Sheet aendert sich nichts
* [ ] Ein Datum ohne Zeile ergibt `date_missing` im Kurzbefehl, es wird keine
      Zeile angehaengt
* [ ] Das Dashboard liest die importierten Werte ohne Aenderung am Parser
* [ ] Format von `Weight`, `Time` und `Steps` entspricht dem Bestand (Komma,
      Text oder Zahl), geprueft an einer Zeile vorher und nachher
* [ ] Token und Endpunkt URL stehen in keiner Datei im Repo
* [ ] Der Kurzbefehl zeigt die Antwort je Feld: geschrieben, belegt, fehlt

## Implementation plan

* 15.1 Script pruefen: Format des Bestands gegen den Schreibplan, ein Test mit
  den drei Feldern. Falls noetig Anpassung im Kern und neue Version im Editor
* 15.2 Anleitung `docs/daily-import-setup.md` schreiben
* 15.3 Mit dem Nutzer: Token setzen, Kurzbefehl bauen, erster Lauf fuer ein
  Datum mit leerer Zeile, Pruefung im Sheet und im Dashboard
* 15.4 Eine Woche Betrieb, Kriterien abhaken, Retro

## Open questions

* Keine. Die Datumszeilen reichen bis 28.02.2027 (Pruefung 27.10.2026 ueber
  den Cache des Dashboards)

## Stand

* 15.1 erledigt: Das Script braucht keine Aenderung. `planWrites` reicht Zahlen
  als Zahlen durch, `setValue` schreibt sie, die Anzeige folgt dem Gebietsschema
  des Blatts. Bestand: `Weight` wie `85,1`, `Time` wie `08:54`, `Steps` ganze
  Zahl. Neuer Test fuer den Morgenlauf mit den drei Feldern
* 15.2 erledigt: `docs/daily-import-setup.md`. Annahme: ein zweiter Kurzbefehl
  `Tageswerte Nachtrag` fragt das Datum ab, damit die Automation ohne Abfrage
  laeuft
* 15.3 beim Nutzer: Token, Kurzbefehl, Automation, Pruefung nach Anleitung
