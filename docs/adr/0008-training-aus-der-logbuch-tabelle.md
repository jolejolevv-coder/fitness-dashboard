# ADR 0008: Trainingsdaten aus der Tabelle des Gym Logbuchs

Status: angenommen (05.11.2026). Spec: `specs/features/training-from-logbook.md`.

## Kontext

Im Studio nutzt der Nutzer seit November 2026 das Gym Logbuch
(`jolejolevv-coder/gym-logbook`). Dessen Apps Script schreibt in eine eigene
Google Tabelle, Tab `TrainingSets`, eine Zeile je Satz. Die Mesocycle Tabs des
grossen Sheets werden nicht mehr gepflegt. Daily Tracking bleibt im grossen
Sheet. Das Dashboard soll beides zeigen: Daily aus dem alten Sheet, Training
aus der Logbuch Tabelle.

## Entscheidung: zweite Tabelle, gelesen ueber die Sheets API

Das Dashboard bekommt in den Einstellungen eine zweite Sheet ID (Logbuch) und
einen Tabnamen (Vorgabe `TrainingSets`). Gelesen wird mit demselben API Key
wie bisher, nur lesend. Ein eigener Parser bildet die Saetze auf das
vorhandene Modell `ParsedTraining` ab (Woche = Kalenderwoche ab der ersten
Einheit, Schluessel `tag||exercise`). Die Mesocycle Quelle bleibt ueber einen
Umschalter lesbar.

* Gewinn: gleicher Leseweg wie bisher, keine neue Abhaengigkeit, kein Token
  des Logbuchs im Dashboard, Oberflaeche und Analytik bleiben unveraendert
* Kosten: Die Logbuch Tabelle muss per Link lesbar sein, wie das alte Sheet.
  Zwei Quellen heisst zwei Fehlerbilder (eine Tabelle erreichbar, die andere
  nicht). Der API Key braucht weiterhin die Referrer Beschraenkung, die beim
  Nutzer offen ist

## Verworfen

* Lesen ueber `doGet` des Logbuch Scripts mit dessen Token: keine Freigabe per
  Link noetig, liefert aber nur `TrainingLog` als JSON ohne Uebungsnamen und
  legt ein zweites Token aufs Handy
* Logbuch schreibt in die Mesocycle Tabs: Logbuch muesste die Blockstruktur
  mit schwankenden Spaltenabstaenden kennen, doppelter Schreibweg
* Logbuch Tabs in das grosse Sheet umziehen: Eingriff in das Logbuch Script
  und in vorhandene Daten, vom Nutzer nicht gewuenscht

## Folgen

* `Training > Eintragen` wird ausgeblendet, sobald eine Logbuch Sheet ID
  eingetragen ist. Der Schreibweg nach ADR 0007 bleibt im Code
* Ohne Logbuch Sheet ID verhaelt sich das Dashboard wie vorher
* Rueckweg: Sheet ID in den Einstellungen leeren
