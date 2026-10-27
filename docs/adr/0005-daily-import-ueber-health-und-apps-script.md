# ADR 0005: Erster Schreibweg in das Sheet, Daily Import ueber Health und Apps Script

Status: angenommen (25.10.2026)

Nummer 0004 ist auf Branch `plan-generator` vergeben (Anthropic API aus dem
Browser), deshalb 0005.

## Kontext

Der Nutzer traegt jeden Abend `Daily Tracking` von Hand ein und tippt dabei
Werte aus Yazio (Kalorien, Makros, Ballaststoffe) und der Zepp App (Gewicht,
Schritte, Schlaf) ab. Am 25.10.2026 geprueft: beide Apps schreiben alle diese
Werte nach Apple Health. Bisher gilt "kein Schreibzugriff auf das Sheet, unter
keinen Umstaenden", gemeint war das Dashboard. Diese ADR fuehrt den ersten
Schreibweg ein, als eigenen Baustein neben dem Dashboard. Spec:
`specs/features/daily-import.md`.

## Entscheidung 1: Apple Health als Drehscheibe

Gewaehlt: Health ist die einzige Quelle fuer alle automatisch erfassten Werte.

Alternativen:

* Yazio direkt: keine oeffentliche API. Inoffizielle Endpunkte waeren mit dem
  Passwort des Nutzers anzusprechen, brechen ohne Ankuendigung und verstossen
  vermutlich gegen die Nutzungsbedingungen. Verworfen
* Zepp direkt: keine dokumentierte Endkunden API, nur ueber Umwege wie
  inoffizielle Clients. Verworfen
* Export als CSV aus den Apps: Handarbeit je Tag, kein Gewinn gegenueber dem
  Abtippen. Verworfen

Tradeoff: Ein Weg fuer beide Apps, Daten bleiben bis zum Senden auf dem Geraet.
Dafuer haengt der Import davon ab, dass beide Apps zuverlaessig nach Health
synchronisieren. Eine verspaetete Synchronisation fuehrt zu fehlenden Werten,
nicht zu falschen, weil leere Felder leer bleiben. Health ist nur bei
entsperrtem iPhone lesbar, ein Lauf im Hintergrund ist damit ausgeschlossen.

## Entscheidung 2: iOS Shortcut plus Apps Script Web App statt eigenem Backend

Gewaehlt: Ein Shortcut liest Health und sendet einen POST an ein Apps Script,
das an das Arbeitsblatt gebunden ist und als der Nutzer schreibt.

Alternativen:

* Eigenes Backend, etwa Azure Function mit Sheets API und Dienstkonto: volle
  Kontrolle ueber Authentifizierung und Logging, aber ein zweiter Cloud Account,
  ein Dienstkonto mit Schreibrecht auf ein privates Sheet und laufende Pflege fuer
  einen Ein Personen Anwendungsfall. Widerspricht "kein Backend" aus der Mission
* Sheets API direkt aus dem Shortcut mit OAuth: Shortcuts kann den OAuth Fluss
  nicht sauber abbilden, ein Refresh Token auf dem Geraet waere ein Schluessel
  mit Vollzugriff auf alle Sheets des Kontos. Verworfen
* Schreiben aus dem Dashboard: bricht die Lesegrenze des Dashboards und
  braeuchte OAuth im Browser einer oeffentlichen Seite. Verworfen
* Drittanbieter wie Zapier oder Health Auto Export: Gesundheitsdaten liefen ueber
  einen weiteren Anbieter, teils mit Abo. Verworfen

Tradeoff: Kein Server, keine Kosten, keine Sheet ID im Code, Schreibrecht nur
ueber das Konto, dem das Sheet ohnehin gehoert. Dafuer gelten die Grenzen von
Apps Script: Web App liefert immer HTTP 200, Fehler stehen nur im Rumpf;
Antwortzeit mit Kaltstart einige Sekunden; Quotas sind fuer einen Lauf am Tag
ohne Belang. Der Quelltext wird von Hand in den Editor kopiert, Repo und Editor
koennen auseinanderlaufen. Eine Versionskonstante in der Antwort macht das sichtbar.

## Entscheidung 3: Absicherung ueber ein geheimes Token

Gewaehlt: Web App mit Zugriff "Jeder", jede Anfrage traegt ein langes
zufaelliges Token im JSON Rumpf, das Script vergleicht es mit
`DAILY_IMPORT_TOKEN` aus den Script Properties. Fehlt die Property, wird jede
Anfrage abgelehnt.

Alternativen:

* Zugriff "Nur ich" mit Google Anmeldung: Shortcuts muesste ein OAuth Token
  mitschicken, siehe oben. Verworfen
* Token als URL Parameter: landet in Logs und Verlaeufen. Verworfen
* Signatur je Anfrage (HMAC mit Zeitstempel): schuetzt gegen Wiederholung, ist
  in Shortcuts aber nur muehsam zu bauen. Bei einem Endpunkt, der nur leere
  Zellen fuellt, bringt Wiederholungsschutz wenig. Zurueckgestellt

Tradeoff: Einfach und im Shortcut ohne Hilfsmittel umsetzbar. Wer URL und Token
kennt, kann leere Zellen fuellen, aber nichts lesen und nichts ueberschreiben,
weil das Script keine Werte zurueckgibt und befuellte Zellen schuetzt. Token
und URL liegen nur in den Script Properties und im Shortcut, nie im Repo, nie in
einer Antwort, in keiner Datei. Bei Verdacht wird das Token in den Properties
getauscht, der alte Shortcut faellt dann sofort aus.

## Entscheidung 4: Gesundheitsdaten laufen ueber einen Google Endpunkt

Gewaehlt: Die Tageswerte gehen per HTTPS an `script.google.com` und werden in
dem Google Sheet gespeichert, in dem sie heute schon von Hand stehen.

Alternative: lokal bleiben, etwa Kurzbefehl schreibt in eine Datei, die von Hand
uebertragen wird. Kein neuer Datenfluss, aber kein Gewinn gegenueber heute.

Tradeoff: Es entsteht kein neuer Speicherort, die Daten liegen schon heute bei
Google. Neu ist der Transportweg und die Ausfuehrung im Konto des Nutzers. Das
Script schreibt keine Gesundheitswerte ins Log, damit sie nicht zusaetzlich in
den Apps Script Ausfuehrungsprotokollen liegen. Der Trainer mit Schreibrecht
auf dem Sheet sieht dieselben Werte wie bisher.

## Folgen

* `CLAUDE.md` und `specs/mission.md` werden angepasst: "kein Schreibzugriff"
  gilt dem Dashboard, der Daily Import ist ein eigener Baustein mit eigenen Regeln
* Neuer Ordner `apps-script/` im oeffentlichen Repo (entschieden 25.10.2026),
  Tests unter `test/`
* Einrichtungsanleitung `docs/daily-import-setup.md` ohne Geheimnisse
* Vor jedem Push `git grep` auf Token, Endpunkt URL und Sheet ID

## WAF

* Reliability: Faellt die Automation aus, hilft der Nachtrag mit Standarddatum
  gestern. Faellt Apps Script aus, bleibt das Eintragen von Hand. Fehlende
  Spalte oder fehlendes Datum fuehren zu einer sichtbaren Fehlermeldung, nie zu
  einem Schreiben an falscher Stelle
* Security: Token in den Script Properties, kein Geheimnis im Repo, kein Lesen
  ueber den Endpunkt, befuellte Zellen geschuetzt, Logs ohne Gesundheitswerte
* Cost: 0 Euro, Apps Script und Shortcuts kostenfrei, ein Aufruf am Tag

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
