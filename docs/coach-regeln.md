# Regelkatalog Zweitmeinung

Stand 10.11.2026. Spec `specs/features/coach.md`, ADR 0011. Parameter stehen in
`src/config/coachRules.ts`, hier steht die Herleitung. Alle Regeln sind in
eigenen Worten formuliert.

Quelle Q1: YouTube Video der Harley Twins, mehrstuendige Masterclass zu
Definition und Aufbau. Eine einzelne Quelle ist eine Lehrmeinung, kein Konsens.
Was mit `Eigene Annahme` markiert ist, stammt nicht aus der Quelle und wird vom
Nutzer bestaetigt oder geaendert. Themen zu Peptiden, Anabolika und
Medikamenten sind ausgeschlossen.

Rangfolge bei Stillstand (Q1): erst Kalorien, dann Makros, dann Lebensmittel,
dann Timing. Schlaf und Stress stehen daneben. Bewegt sich die Waage nicht,
liegt es fast immer an der Erfassung, nicht am zu kleinen Defizit. Deshalb
prueft A2 zuerst die Compliance.

## A Phase und Kalorien

| Kennung | Aussage | Formel | Parameter | Mindestdatenlage | Quelle |
| --- | --- | --- | --- | --- | --- |
| A1 | Kalorien Zweitmeinung | Mitte der TDEE Spanne plus Sollrate in kg pro Woche mal 7700 durch 7 | Sollrate aus `H3` | TDEE Spanne und Trend vorhanden (je 14 Tage) | Q1: Defizit vom Erhaltungsbedarf, Wochenmittel statt Einzeltage |
| A2 | Stillstand | Wochenmittel der letzten Wochen, Veraenderung unter der Plateau Schwelle | `STALL_WEEKS`, `STALL_MIN_WEIGH_INS_PER_WEEK`, `KCAL_TOLERANCE_PCT` | vier Wochen mit je vier Waegungen | Q1: ein bis zwei Wochen sind kein Plateau, reagiert wird nach etwa drei |
| A3 | Naechster Schritt | A1 gegen die Vorgabe, gekappt auf einen Schritt | `KCAL_STEP` | A1 und A2 | Q1: Kalorien schrittweise senken, nicht alle Hebel zugleich |
| A4 | FFMI | Magermasse durch Groesse zum Quadrat plus Korrektur auf 1.80 m | `FFMI_*`, `BODY_MAX_AGE_DAYS` | Koerperfett nicht aelter als die Hoechstdauer, Groesse aus `M7` | Q1 nennt FFMI als Mass, Formel ist die uebliche normalisierte |
| A5 | Phase | Tabelle unten | `FFMI_LOW_BELOW`, `FFMI_DEVELOPED_FROM`, `BF_*`, `BULK_*` | A4 | Q1 |
| A6 | Reverse | erster Schritt halbes Defizit zurueck, danach Wochenschritt bis leicht ueber Erhaltung | `REVERSE_*` | A1, Ziel erreicht | Q1: etwa 300 kcal unter Erhaltung starten, dann 100 bis 150 kcal je Woche |

Phase nach Koerperfett und Muskelmasse (A5):

| Koerperfett | FFMI gering | FFMI mittel | FFMI entwickelt |
| --- | --- | --- | --- |
| ueber 17 | Cut | Cut | Cut |
| ueber 14 bis 17 | Mini Cut | Cut | Cut |
| 10 bis 14 | Recomp | Mini Cut | bis 12 Halten, darueber Cut |
| unter 10 | Lean Bulk | Lean Bulk | Lean Bulk |

Ein Aufbau beginnt nie oberhalb von `BULK_START_MAX_BF_PCT` und endet bei
`BULK_STOP_BF_PCT`. Die Grenze `FFMI_DEVELOPED_FROM` ist eine eigene Annahme.

## B Makros je Tagestyp

| Kennung | Aussage | Formel | Parameter | Quelle |
| --- | --- | --- | --- | --- |
| B1 | Protein | g je kg Koerpergewicht, oberes Ende im Defizit | `PROTEIN_G_PER_KG_*` | Q1: 1.6 bis 2.2 g je kg |
| B2 | Fett | fester Wert je Tagestyp, nie unter dem Boden | `*_DAY_FAT_G`, `FAT_FLOOR_G` | Q1: meist 50 bis 60 g, am High Day so niedrig wie vertretbar |
| B3 | Carbs | Rest der Kalorien nach Protein und Fett | `KCAL_PER_G_*` | Q1: Carbs sind die Stellgroesse |
| B4 | Tagestypen | Low: Carbs 1 g je kg, Protein etwas hoeher. Die uebrigen Kalorien der Woche gehen in die Carbs der Trainingstage, der High Day bekommt das Doppelte eines Medium Day bei gesenktem Protein. Der Wochenschnitt trifft A1 | `LOW_DAY_*`, `HIGH_DAY_*`, `HIGH_DAYS_PER_WEEK_*` | Q1: Low an Ruhetagen, Medium an Trainingstagen, ein High Day je Woche im Cut, zwei im Aufbau, Carbs am High Day etwa doppelt, Wochenschnitt bleibt beim geplanten Defizit |
| B5 | Vergleich | je Tagestyp gegen den Vorgabeblock | | |

Mindestdatenlage: A1 und ein Trainingstag je Woche im Fenster
`DAY_TYPE_WINDOW_DAYS`. Der High Day liegt auf dem Plantag mit den meisten
Saetzen (Q1: haerteste Einheit). Ergibt die Rechnung am Medium Day weniger
Carbs als am Low Day, verweigert B4.

## C Training

| Kennung | Aussage | Formel | Parameter | Mindestdatenlage | Quelle |
| --- | --- | --- | --- | --- | --- |
| C1 | Frequenz | Trainingstage je Muskelgruppe und Woche, Mittel des Fensters | `FREQUENCY_TARGET_PER_WEEK`, `TRAINING_WINDOW_WEEKS` | `TRAINING_MIN_WEEKS` Wochen mit Daten | Q1: jede Muskelgruppe zweimal pro Woche |
| C2 | Progression | Wochen in Folge ohne neuen Bestwert im geschaetzten 1RM | `PROGRESSION_STALL_WEEKS`, `REGRESSION_PCT` | drei geloggte Wochen je Uebung | Q1: Progression ueber Last oder Wiederholungen |
| C3 | Wochensaetze | Saetze je Muskelgruppe und Woche, Mittel des Fensters | `MIN_WEEKLY_SETS` (eigene Annahme) | wie C1 | Q1 nennt keine allgemeine Untergrenze |
| C4 | Deload Signal | Anteil ruecklaeufiger Uebungen ueber der Schwelle und D3 aktiv | `DELOAD_*` | `DELOAD_MIN_EXERCISES` bewertbare Uebungen | Q1: Deload nach Symptomen, nicht vorgeplant |

## D Schlaf und Erholung

| Kennung | Aussage | Formel | Parameter | Mindestdatenlage | Quelle |
| --- | --- | --- | --- | --- | --- |
| D1 | Schlafdauer | Mittel der letzten Tage gegen den Korridor | `SLEEP_MIN_H`, `SLEEP_MAX_H` | `SLEEP_MIN_DAYS` von `SLEEP_WINDOW_DAYS` | Q1: 7 bis 9 Stunden |
| D2 | Regelmaessigkeit | Standardabweichung der Schlafdauer | `SLEEP_SPREAD_MAX_H` (eigene Annahme) | `SLEEP_SPREAD_MIN_DAYS` von `SLEEP_SPREAD_WINDOW_DAYS` | Q1 fordert eine feste Aufstehzeit. Das Sheet kennt nur die Dauer, die Streuung ist ein Ersatzmass |
| D3 | Erholungssignal | D1 unter Korridor und Energylevel fallend und Anteil ruecklaeufiger Uebungen ueber null | `ENERGY_DROP` (eigene Annahme) | D1, zwei Wochen Energylevel | Q1: anhaltende Muedigkeit und Kraftverlust als Zeichen |

## Nicht als Regel umgesetzt

Aus Q1 bekannt, aber ohne Datenbasis im Sheet oder ausserhalb des Scopes:
Verteilung der Carbs um das Training, Koffeingrenze, Raumtemperatur,
Bildschirmzeit, Wasser und Elektrolyte, Saettigung und Lebensmittelwahl,
Cardio Dauer.
