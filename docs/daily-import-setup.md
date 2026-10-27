# Gewicht und Schritte vom iPhone ins Sheet

Anleitung zu Phase 15, Spec `specs/features/daily-weight-steps.md`. Jeden Morgen
um 8 Uhr kommt eine Mitteilung, ein Tippen schreibt `Weight`, `Time` und
`Steps` von gestern in `Daily Tracking`. Nur leere Zellen werden beschrieben.

Token und Endpunkt URL stehen nur in den Script Properties und im Kurzbefehl,
nie im Repo, nie im Chat.

## 1. Token im Script

1. Im Terminal ein Token erzeugen und in die Zwischenablage legen:

```bash
openssl rand -hex 24 | pbcopy
```

2. script.google.com, Projekt der Schreibwege, Projekteinstellungen, Script
   Properties: `DAILY_IMPORT_TOKEN` mit diesem Wert anlegen
3. Keine neue Bereitstellung noetig. Die Properties liest das Script bei jedem
   Aufruf. Die Endpunkt URL ist dieselbe wie in der App unter Einstellungen
4. Token per AirDrop oder geteilter Zwischenablage aufs iPhone, nicht per Mail
   oder Chat

## 2. Kurzbefehl `Tageswerte`

App Kurzbefehle, neuer Kurzbefehl `Tageswerte`. Aktionen in dieser Reihenfolge,
Namen wie in iOS 18 auf Deutsch.

**Datum bestimmen**

1. `Wenn`: Kurzbefehlseingabe `hat einen Wert`
   * darin `Variable festlegen` `Tag` auf Kurzbefehlseingabe
   * `Sonst`: `Aktuelles Datum`, dann `Datum anpassen` `Subtrahieren` 1 Tag,
     dann `Variable festlegen` `Tag`
2. `Datum anpassen`: `Anfang von Tag` von `Tag`, Variable `Beginn`
3. `Datum anpassen`: `Hinzufuegen` 1 Tag zu `Beginn`, Variable `Ende`

**Gewicht**

4. `Health Beispiele suchen` (im Original mit Bindestrich): Typ `Gewicht`,
   Filter `Startdatum` `liegt zwischen` `Beginn` und `Ende`, `Quelle` `ist`
   Zepp (so wie die Quelle in Health unter Gewicht, Datenquellen heisst),
   Sortieren nach `Startdatum` `Aelteste zuerst`, Limit 1
5. `Wenn` Health Beispiele `hat einen Wert`:
   * `Details von Health Beispielen abrufen`: `Wert`, dann `Zahl runden` auf
     1 Nachkommastelle, Variable `Gewicht`
   * `Details von Health Beispielen abrufen`: `Startdatum`, dann
     `Datum formatieren` benutzerdefiniert `HH:mm`, Variable `Uhrzeit`

**Schritte**

6. `Health Beispiele suchen`: Typ `Schritte`, gleicher Zeitfilter, `Quelle`
   `ist` Zepp, `Gruppieren nach` `Tag`
7. `Statistik berechnen`: `Summe`, dann `Zahl runden` auf ganze Zahl,
   Variable `Schritte`. Ohne Uhr am Tag bleibt sie leer

**Werte zusammenstellen**

8. `Woerterbuch` leer anlegen, Variable `Werte`
9. `Wenn` `Gewicht` `hat einen Wert`: `Woerterbuchwert festlegen` `Weight` auf
   `Gewicht` und `Time` auf `Uhrzeit` in `Werte`
10. `Wenn` `Schritte` `hat einen Wert` und ist groesser 0:
    `Woerterbuchwert festlegen` `Steps` auf `Schritte` in `Werte`

Typ `Zahl` fuer `Weight` und `Steps`, `Text` fuer `Time`. Ein fehlender Wert
wird nicht gesendet, nie eine Null.

**Senden**

11. `Datum formatieren` `Tag` benutzerdefiniert `d.M.yyyy`, Variable `Datum`
12. `Inhalte von URL abrufen`: URL ist die Endpunkt URL (endet auf `/exec`),
    Methode `POST`, Anfragetext `JSON` mit den Feldern
    * `token` Text: das Token aus Schritt 1
    * `action` Text: `daily`
    * `date` Text: `Datum`
    * `values` Woerterbuch: `Werte`
13. `Woerterbuchwert abrufen` `ok`. `Wenn` er wahr ist:
    `Mitteilung anzeigen` mit `written` (geschrieben) und `skipped` (belegt).
    `Sonst`: `Mitteilung anzeigen` mit `error` und `detail`

## 3. Kurzbefehl `Tageswerte Nachtrag`

Fuer verpasste Tage. Zwei Aktionen:

1. `Nach Eingabe fragen`: Typ `Datum`, Standard gestern
2. `Kurzbefehl ausfuehren`: `Tageswerte` mit dieser Eingabe

## 4. Automation

Kurzbefehle, Automation, Neue Automation, `Tageszeit` 8:00, taeglich,
`Nach Bestaetigung ausfuehren`, Kurzbefehl `Tageswerte`. Die Mitteilung kommt
um 8 Uhr, der Lauf startet erst auf Tippen. Health ist bei gesperrtem iPhone
nicht lesbar, deshalb kein stiller Lauf.

## 5. Pruefung

1. Token im Kurzbefehl absichtlich falsch: Mitteilung `unauthorized`, im Sheet
   aendert sich nichts. Danach Token korrigieren
2. `Tageswerte` von Hand starten: fuer gestern erscheinen die drei Felder als
   geschrieben, schon befuellte als belegt. Im Sheet stehen `Weight` mit Komma,
   `Time` als `HH:mm` und `Steps` als ganze Zahl wie in den Zeilen davor
3. Gleich noch einmal starten: alle Felder belegt, nichts aendert sich
4. Das Dashboard zeigt den Tag nach dem Neuladen ohne Fehlermeldung
5. Eine Woche lang gegen die Zepp App vergleichen

## Antworten des Scripts

| Code | Bedeutung |
| --- | --- |
| `unauthorized` | Token fehlt, falsch, oder `DAILY_IMPORT_TOKEN` ist nicht gesetzt |
| `bad_request` | Datum nicht `d.M.yyyy` oder Wert weder Zahl noch Text |
| `header_missing` | Spalte nicht gefunden, mit Namen |
| `date_missing` | keine Zeile fuer das Datum. Die Vorlagezeilen reichen bis 28.02.2027 |
| `locked` | anderer Lauf aktiv, spaeter erneut |
