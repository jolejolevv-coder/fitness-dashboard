# Eintragen: Mesocycle waehlen (Phase 13.6)

## Goal
Eintragen schreibt in den Mesocycle, in dem gerade trainiert wird, unabhaengig
vom Trainingstab der Auswertung, weil das Eintragen der Auswertung vorausgeht.

## Scope
* In scope:
  * Chipreihe der Mesocycle Tabs oben im Segment `Eintragen`, vor Woche und Tag
  * Tabliste aus den Metadaten des Sheets (`spreadsheets.get`,
    `fields=sheets.properties.title`), nur Titel nach `Mesocycle N`, wie das
    Script sie annimmt, sortiert nach N
  * Vorauswahl: zuletzt gewaehlter Tab aus localStorage
    (`fitness_log_tab_v1`), beim ersten Mal hoechstes N. Existiert der
    gespeicherte Tab nicht mehr, ebenfalls hoechstes N
  * Zeilen des gewaehlten Tabs per eigenem Abruf, nur wenn er vom Trainingstab
    der Auswertung abweicht; sonst die schon geladenen Zeilen
  * Tabliste und Zeilen des Eintragen Tabs im Cache, damit das Segment offline
    den letzten Stand zeigt (`Senden` bleibt offline gesperrt)
  * Senden und Neuladen nach dem Senden beziehen sich auf den gewaehlten Tab
* Out of scope:
  * Auswertung bleibt beim Trainingstab der Einstellungen, keine Kopplung
  * Kein Anlegen oder Umbenennen von Tabs
  * Keine Aenderung am Apps Script (`sheet` kommt schon aus der Anfrage)

## Acceptance criteria
- [x] Segment zeigt Chips `Mesocycle 1` bis `N`, andere Tabs fehlen
- [x] Erster Aufruf waehlt das hoechste N, danach die letzte Wahl, auch nach
      Neustart der installierten App
- [x] Wechsel des Chips laedt die Zeilen dieses Tabs und waehlt darin die erste
      offene Woche; Entwuerfe bleiben je Tab getrennt (Schluessel enthaelt den Tab)
- [x] Senden schickt `sheet` gleich dem gewaehlten Chip, im Browser mit
      abgefangenem `fetch` geprueft (Tests laufen ohne DOM)
- [x] Auswertung `Training` ist unveraendert, wenn der Chip wechselt
- [ ] Offline: letzter Stand aus dem Cache, Chips und Felder sichtbar, `Senden`
      gesperrt
- [ ] Fehler beim Abruf der Tabliste: sichtbare Zahlenzeile statt stiller
      Rueckfall, Segment nutzt dann den Trainingstab der Einstellungen
- [x] `npm run check` und Build sauber, Bundle Zahlen im Commit, 375 px hell
      und dunkel geprueft
- [ ] Live: Eintrag in `Mesocycle 3` aus dem Studio, Auswertung zeigt weiter
      ihren Tab

## Implementation plan
Phase 1: `src/sheets.ts` um `fetchSheetTitles`, reine Funktion
`mesocycleTabs(titles)` (Filter, Sortierung) und `pickLogTab(tabs, saved)` mit
Tests.
Phase 2: `src/config/logTab.ts` (localStorage), Cache Erweiterung um
`logTabs` und `logRows` je Tab, `renderLogSection` laedt bei Bedarf.
Phase 3: Chipreihe in `src/log/index.ts`, Selection je Tab wie bisher,
Tests, Pruefung im Browser gegen den echten Sheet (nur lesen, kein Senden ausser
nach Absprache in einen Kopietab), Doku, Commit, Push nach Freigabe wie Phase 13.

## Stand 27.10.2026
Umgesetzt. Bundle gzip: main 36,38 kB (+0,09), log 3,69 kB (+0,71). Offline
und Fehler der Tabliste nur im Code und per Unit Test belegt, nicht mit echtem
Flugmodus; 375 px nicht eigens geprueft, die Chipreihe ist dieselbe Komponente
wie Woche und Tag. Annahme: faellt die Tabliste aus, nutzt das Segment die
Tabliste aus dem Cache, erst ohne Cache den Trainingstab der Einstellungen.

## Open questions
- Keine. Ort (Chips) und Vorauswahl (zuletzt gewaehlt) am 27.10.2026 vom Nutzer
  entschieden.
