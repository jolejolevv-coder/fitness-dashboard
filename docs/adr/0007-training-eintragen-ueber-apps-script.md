# ADR 0007: Training aus der App eintragen, ueber das Apps Script

Status: angenommen (27.10.2026), mit eigenem Token `TRAINING_TOKEN`. Spec:
`specs/features/training-log.md`.

## Kontext

Das Dashboard ist rein lesend, `CLAUDE.md` verbietet jeden Schreibzugriff des
Dashboards auf das Sheet. ADR 0005 hat den Daily Import als einzigen
Schreibweg eingefuehrt und das Schreiben aus dem Dashboard dort ausdruecklich
verworfen, weil es OAuth im Browser einer oeffentlichen Seite braucht. Seit
Phase 12 ist das Dashboard eine installierte App, die der Nutzer im Studio
offen hat. Er will die Ist Werte eines Trainingstags dort eintippen statt im
Sheet.

Randbedingungen: kein Backend, GitHub Pages, API Key nur lesend, Zugangsdaten
nur im localStorage, Spalten ueber Kopfzeilen, Mesocycle Tabs mit schwankenden
Blockabstaenden.

## Entscheidung: Aktion `training` im Apps Script des Daily Import

Die App schickt einen POST an die Apps Script Web App aus ADR 0005. Das Script
laeuft als der Nutzer, findet Block, Spalte und Zeile ueber Kopfzeilen und
schreibt nur in leere Zellen `Load`, `Reps Ist`, `Notes`. Endpunkt URL und ein
eigenes Token liegen in den Script Properties und im localStorage der App.

* Gewinn: kein OAuth, keine Sheet ID im Code, Schreibrecht nur ueber das
  Konto, dem das Sheet gehoert. Ein Script, eine Bereitstellung fuer beide
  Schreibwege. Die Regel "nur leere Zellen" sitzt serverseitig und gilt auch
  bei einem Fehler in der App
* Kosten: Die harte Regel "kein Schreibzugriff des Dashboards" wird
  eingeschraenkt statt absolut. Token und URL liegen kuenftig auch auf dem
  Handy, ein verlorenes Handy heisst Token in den Script Properties tauschen.
  Antwortzeit mit Kaltstart einige Sekunden. Phase 10.2 muss mit fertig
  werden. CSP bekommt zwei Google Hosts in `connect-src`

## Verworfen

* Google Login mit OAuth und direktem Schreiben ueber die Sheets API: OAuth
  Client in der Cloud Console, ablaufende Anmeldung, das Token haette
  Schreibrecht auf jedes Sheet des Kontos. Die Regel "nur leere Zellen" laege
  allein im Browser Code
* Nicht schreiben, nur Tagesansicht zum Ablesen: haelt die Regel, loest aber
  das Abtippen nicht
* Eigenes Backend: widerspricht der Mission, siehe ADR 0005

## Folgen

* `CLAUDE.md` und `specs/mission.md`: Das Dashboard darf ueber das Apps Script
  leere Ist Zellen eines Mesocycle Tabs fuellen, sonst nichts. Kein anderer
  Schreibweg aus dem Dashboard
* `CLAUDE.md`: Token und Endpunkt URL liegen in Script Properties, Shortcut und
  localStorage, weiterhin in keiner Datei im Repo
* Der Service Worker beruehrt Anfragen an die Script Hosts nicht
* Rueckweg: Token in den Script Properties loeschen, das sperrt die Aktion
  sofort, ohne Deploy der App

## Nachtrag 27.10.2026: eigenstaendiges Projekt

Das Arbeitsblatt hat bereits ein gebundenes Apps Script Projekt mit eigenem
`doPost` (`Makros.gs`, Gewichtsimport aus Health Auto Export). Ein Projekt kennt
nur einen `doPost`. Entscheidung des Nutzers: unser Script laeuft als eigenes
Projekt auf script.google.com und oeffnet das Blatt per
`SpreadsheetApp.openById` mit der ID aus der Script Property `SHEET_ID`.
Tradeoff: die Berechtigung gilt fuer alle eigenen Tabellen statt nur fuer das
gebundene Blatt; dafuer bleibt der vorhandene Import unberuehrt. Die Sheet ID
steht wie das Token in keiner Datei im Repo. Fehlt `SHEET_ID`, antwortet das
Script `not_configured`.
