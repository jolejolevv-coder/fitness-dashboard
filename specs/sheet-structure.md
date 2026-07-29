# Sheet Struktur

Erhoben am 29.07.2026 aus einem vollstaendigen Export des Arbeitsblatts
`Makrocycle 1 - N. N. - 4 Day´s Body Recomposition`. Diese Datei ist die
Referenz fuer das Parsing. Der Rohexport liegt unter `testdata/` und ist
versionsausgeschlossen.

## Tabs

Das Arbeitsblatt hat 14 Tabs. Das Dashboard nutzt zwei davon.

| Tab | Zeilen | Genutzt | Anmerkung |
| --- | --- | --- | --- |
| Daily Tracking | 1086 | ja | Tagesdaten und Vorgabeblock |
| Mesocycle 1 | 324 | ja | abgeschlossener Trainingsblock |
| Mesocycle 2 | 324 | nein, noch nicht | bereits angelegt und vorbefuellt |
| Zeitverlauf | 116 | nein | 466 befuellte Zellen, ungeprueft |
| Sizes | 33 | nein | nur 21 befuellte Zellen, praktisch ungenutzt |
| Supplements | 91 | nein | ungeprueft |
| Kopie von Nutrition | 863 | nein | Ernaehrungsplan |
| Landing Page, Hilfe_Dropdown, Übungs Drop-Down, Exercise, Drop-Down Data, Prep-Verlaufsplan, Prep-Verlaufsplan Auto. | | nein | Vorlagen und Nachschlagewerke |

## Daily Tracking

### Vorgabeblock, Zeilen 16 bis 23

Hier stehen die Zielwerte des Trainers. Sie muessen nicht eingetippt werden.

| Zeile | Bedeutung | Protein | Carbs | Fat | Fiber | Calories | Proteinfeedings | Steps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 19 | High Day, 4 Tage pro Woche | 200 | 225 | 60 | 40 | 2300.5 | 4 | 10000 |
| 21 | Low Day, 3 Tage pro Woche | 200 | 225 | 60 | 40 | 2300.5 | 4 | 10000 |
| 23 | Average, 7 Tage | 200 | 225 | 60 | 40 | 2300.5 | 4 | 10000 |

High Day und Low Day tragen in diesem Block identische Werte. Das Parsing darf
das nicht voraussetzen, im naechsten Block koennen sie auseinanderlaufen.

Weitere Stammdaten: `G1` Name, `M1` Ziel, `G4` Beginn 04.05.2026, `M4`
Startgewicht, `G7` Geburtsdatum, `M7` Groesse. Der tatsaechliche
Trackingbeginn ist der 07.05.2026, die drei Zeilen davor sind leer.

### Kopfzeile, Zeile 29

Die Datenzeilen beginnen ab Zeile 31. Spaltenindizes null basiert, wie im Code.

| Index | Spalte | Kopf | Verwendung |
| --- | --- | --- | --- |
| 0 | A | Date | Datum, Format `d.m.yyyy` |
| 1 | B | Weight | Gewicht, teils Text, teils Zahl |
| 2 | C | Time | Uhrzeit der Einwaage |
| 4 | E | Protein | |
| 5 | F | Carbs | |
| 6 | G | Fat | |
| 7 | H | Fiber | in den Tagesdaten nie befuellt |
| 8 | I | Fruits & Vegetables | |
| 9 | J | Calories | |
| 10 | K | Proteinfeedings | heute ungenutzt |
| 11 | L | ohne Kopfzeile | Notizen, 7 Eintraege |
| 12 | M | Sleep | Stunden |
| 13 | N | Qualität | Schlafqualitaet |
| 14 | O | Verdauung | |
| 16 | Q | Stress | |
| 17 | R | Energylevel | |
| 18 | S | Steps | |
| 19 | T | Menstruation Cycle | irrelevant |
| 20 | U | Trainingday | Kodierung `D1 W1 M1` oder `Rest` |
| 25 | Z | Cardio | heute ungenutzt |
| 28 | AC | Comments | 4 Eintraege, vom Dashboard heute ignoriert |

Die heutigen fest verdrahteten Indizes stimmen alle. Die Umstellung auf
Spaltennamen ist trotzdem noetig, weil der Trainer Schreibrechte hat.

### Wochenbloecke

Nach jeweils sieben Datenzeilen folgen drei Auswertungszeilen und zwei
Leerzeilen:

* `Durchschnitt` mit Wochenmittel, Spalte B als Text der Form `97,53 Kg`
* `Gewichtsveränderung` mit dem Delta zur Vorwoche, ebenfalls Text mit Einheit.
  Im ersten Block steht dort kein Delta, sondern das Wochenmittel selbst
* `in %` mit dem relativen Delta

### Datenlage, Stand 29.07.2026

* 616 datierte Zeilen, davon 534 leere Vorlagezeilen bis zum 25.10.2026
* 82 verwertbare Einwaagen vom 07.05. bis 27.07.2026, also rund zwoelf Wochen
* Damit ist das 56 Tage Fenster des TDEE Schaetzers erreichbar
* Genau zwei echte Nullwerte im gesamten Bestand, je einer in
  `Fruits & Vegetables` und in `Verdauung`

## Mesocycle Tabs

Kopfzeile in Zeile 33. Wochenbloecke werden ueber Zellen mit dem Inhalt
`Excercise` erkannt, Schreibfehler im Original.

Innerhalb eines Blocks, relativ zur Startspalte: `+0` Excercise, `+2` Sets,
`+3` Reps Soll, `+4` RIR, `+5` Tempo, `+6` Load, `+7` Reps Ist, `+8` RIR Ist.
`Mesocycle 2` hat zusaetzlich `+9` Notes.

**Der Spaltenabstand unterscheidet sich zwischen den Bloecken.** `Mesocycle 1`
beginnt bei Spalte 8 mit einem Abstand von 12, danach 11. `Mesocycle 2` beginnt
ebenfalls bei 8, durchgehend mit Abstand 11. Feste Abstaende sind deshalb
unzulaessig, die Erkennung ueber `Excercise` bleibt.

Beide Tabs tragen in `H3` den Wert `ROL - 0,25%`, also eine angestrebte
Abnahmerate von 0.25 Prozent des Koerpergewichts pro Woche. Bei rund 93 kg sind
das etwa 0.23 kg pro Woche. Damit ist die Sollrate bekannt und muss nicht
gesetzt werden.

Das Feld `Mesocycle` in `H9` steht in beiden Tabs auf `1`. Es ist als Kennung
unbrauchbar, `Mesocycle 2` ist offenbar eine Kopie.

## Konsequenzen fuer das Parsing

Diese Punkte gehen als Anforderungen in Phase 2 ein.

**Die Lastspalten sind in allen zwoelf Wochen vorbefuellt**, in beiden Tabs. Die
heutige Ermittlung der aktuellen Woche nimmt die hoechste Woche mit einer Last
und liefert deshalb immer 12. Bei `Mesocycle 2` wuerde sie ab dem ersten Tag 12
melden. Der belastbare Hinweis auf den Stand steht stattdessen in der Spalte
`Trainingday` des Daily Tracking, kodiert als `D1 W1 M1`. Der juengste Eintrag
dort ist die Wahrheit. Am 03.08.2026 steht dort bereits `D1 W1 M2`.

**`Rest` ist ein gueltiger Wert in `Trainingday`.** Die heutige Auswertung
Trainingstag gegen Ruhetag prueft nur auf nicht leer und ungleich `-` und zaehlt
`Rest` damit als Trainingstag. Die Auswertung ist fuer alle so markierten Tage
falsch.

**Ein Tag ohne Gewicht faellt komplett aus.** Am 25.06. und 26.06.2026 steht in
der Gewichtsspalte ein `?`. Beide Tage tragen je 13 befuellte Felder, die das
Dashboard heute vollstaendig verwirft, weil ein gueltiges Gewicht Bedingung fuer
die Verwertung der Zeile ist. Makros, Schlaf, Stress und Schritte dieser Tage
fehlen in jeder Auswertung.

**Notizen stehen in zwei Spalten.** Das Dashboard liest nur `L`. Die vier
Eintraege in `AC`, der laut Kopfzeile eigentlichen Kommentarspalte, sind
unsichtbar. Beide Spalten muessen gelesen werden.

**Der `num()` Fehler ist real, aber klein.** Er betrifft genau zwei Werte im
gesamten Bestand. Die urspruengliche Einschaetzung, er betreffe die Wellness
Daten flaechendeckend, war falsch. Behoben wird er trotzdem, weil er mit jeder
kuenftigen Null wieder zuschlaegt.
