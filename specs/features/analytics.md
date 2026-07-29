## Goal

Aus den vorhandenen Rohdaten vier Aussagen ableiten, die das Sheet nicht
hergibt: wo der Erhaltungsbedarf liegt, wohin der Trend zeigt, ob gerade ein
Plateau laeuft, und welche Gewohnheiten mit dem Befinden zusammenhaengen.

## Scope

In scope: TDEE Schaetzer, Trend und Zielprojektion, Plateau Erkennung,
Compliance Streaks und Wellness Korrelationen. Alle vier als reine Funktionen in
`src/analytics/`, unabhaengig vom DOM und einzeln testbar.

Out of scope: Empfehlungen, Erklaertexte in der Oberflaeche, Machine Learning,
Vorhersage von Trainingsleistung, Import aus Apple Health oder Garmin.

## Grundsatz fuer alle vier

Jede Kennzahl kennt ihre Mindestdatenlage und verweigert die Aussage darunter,
statt eine Zahl zu erfinden. Wo sie schweigt, steht der Grund als eine Zeile mit
Zahlen, etwa `Basis 11 von 14 Tagen`, damit ein Strich nie mit einem Defekt
verwechselt wird. Jede Anzeige nennt die Datenbasis in Tagen. Alle Berechnungen
laufen auf dem geglaetteten Gewichtsverlauf, nie auf Einzeltagen.

Erklaerungen zur Herleitung erscheinen nicht in der Oberflaeche. Die Annahmen
stehen hier in der Spec und im Quellcode.

## Datenlage, Stand Juli 2026

Das Tracking laeuft seit etwa acht bis zwoelf Wochen. Das 28 Tage Fenster ist
komfortabel erreichbar, das 56 Tage Fenster gerade so. Fenster, fuer die die
Daten nicht reichen, erscheinen nicht, statt auf eine kuerzere Basis
auszuweichen.

## 1. TDEE Schaetzer

Der Erhaltungsbedarf ergibt sich aus der tatsaechlichen Energiebilanz statt aus
einer Formel wie Harris Benedict:

```
TDEE = Ø Kalorienzufuhr im Fenster + (Gewichtsaenderung_kg * 7700) / Tage im Fenster
```

Gewichtsaenderung ist die Differenz der 7 Tage Mittel am Anfang und am Ende des
Fensters, nicht die Differenz zweier Einzeltage. Der Faktor 7700 kcal pro kg
Koerpermasse liegt als benannte Konstante `KCAL_PER_KG_BODYMASS` in
`analytics/tdee.ts`. Er ist eine Naeherung, die Fett und Magermasse nicht trennt,
was bei Body Recomposition die eigentlich interessante Trennung waere.

Fenster: 14, 28 und 56 Tage, ausgegeben als Spanne ueber die verfuegbaren Fenster.
Eine einzelne Zahl waere unehrlicher als die Streuung.

Verweigerung wenn: weniger als 14 Tage im Fenster, oder Kalorien fuer weniger als
80 Prozent der Tage erfasst.

Guenstiger Umstand: die Kalorienerfassung erfolgt abgewogen, nicht geschaetzt.
Damit misst der Schaetzer ueberwiegend Stoffwechsel und nicht Schaetzfehler.

## 2. Trend und Zielprojektion

Lineare Regression nach kleinsten Quadraten auf das 7 Tage Mittel des Gewichts
im gewaehlten Zeitraum.

Ausgabe:
* Rate in kg pro Woche, dazu die Abweichung von `weight_rate_kg_per_week`
* Bestimmtheitsmass R² als Verlaesslichkeitsmass
* Projiziertes Datum fuer `weight_target_kg`, sofern gesetzt und die Richtung stimmt
* Projektionsband aus dem Standardfehler der Steigung, keine Punktprognose

Verweigerung wenn: weniger als 14 Datenpunkte, oder R² unter 0.3. Zeigt die
Steigung vom Ziel weg, wird kein Datum berechnet.

Die Rate erscheint als erste Aussage im Antwortblock. Das projizierte Zieldatum
erscheint nachrangig, weil die Zielsetzung Sache des Trainers ist.

## 3. Plateau Erkennung

Ein Plateau liegt vor, wenn die Steigung des 7 Tage Mittels ueber die letzten 14
Tage betragsmaessig unter 0.15 kg pro Woche liegt. Die Schwelle ist eine gesetzte
Zahl und liegt als benannte Konstante im Modul.

Die Meldung unterscheidet zwei Faelle, weil die Konsequenz eine andere ist:
* Compliance ueber 80 Prozent bei Protein und Kalorien: echtes Plateau, die
  Vorgabe greift nicht mehr. Das ist der Anlass, den Trainer anzusprechen
* Compliance darunter: kein Plateau, sondern Ausfuehrung. Die Meldung nennt die
  getroffenen von den erfassten Tagen statt von Plateau zu sprechen

Verweigerung wenn: weniger als 14 Tage mit Gewichtsdaten.

## 4. Streaks und Korrelationen

**Streaks** je Ziel aus der Konfiguration: Protein erreicht, Kalorien eingehalten,
Schritte erreicht, Schlaf erreicht. Ausgegeben werden laufende Serie und
Bestserie. Ein Tag ohne erfassten Wert bricht die Serie nicht, verlaengert sie
aber auch nicht, und wird als Luecke gezaehlt.

**Compliance** wird durchgaengig als getroffene von erfassten Tagen ausgegeben,
nicht als Prozentwert allein, damit die Datenbasis nicht verschwindet.

**Korrelationen** als Pearson r ueber diese Paare:
* Schlafdauer und Energie am Folgetag
* Schlafqualitaet und Energie am Folgetag
* Stress und Schlafdauer in derselben Nacht
* Schritte und Gewichtsaenderung ueber sieben Tage
* Kalorien und Energie am Folgetag

Ausgegeben werden r und n. Verweigerung wenn n unter 20.

Die bestehende Auswertung Trainingstag gegen Ruhetag bleibt erhalten und wandert
unveraendert in `analytics/correlation.ts`.

## Acceptance criteria

* [ ] Jede der vier Kennzahlen ist eine reine Funktion ohne DOM Zugriff
* [ ] Unit Tests gegen synthetische Verlaeufe mit analytisch bekanntem Ergebnis:
      konstantes Gewicht, exakt linearer Verlust, verrauschter Verlust,
      Datenluecken, zu kurze Reihe
* [ ] Jede Kennzahl gibt bei zu duenner Datenlage einen strukturierten Grund
      zurueck, nicht `null`, und die Oberflaeche zeigt diesen Grund als Zahlenzeile
* [ ] Jede Anzeige nennt die Datenbasis in Tagen
* [ ] TDEE erscheint als Spanne ueber die verfuegbaren Fenster
* [ ] Die Projektion zeigt ein Band, keine Punktprognose
* [ ] Kein Grenzwert und keine Konstante als Literal im Berechnungscode
* [ ] Kein Erklaertext in der Oberflaeche

## Implementation plan

Phase 1: `analytics/smoothing.ts`, gleitende Mittel und Wochenbloecke, mit Tests.
Basis fuer alles andere
Phase 2: `analytics/trend.ts`, Regression, Projektion, Plateau. Groesster
Testaufwand, deshalb frueh
Phase 3: `analytics/tdee.ts`
Phase 4: `analytics/compliance.ts` und Erweiterung von `analytics/correlation.ts`
Phase 5: Anbindung an den Antwortblock, Streaks in die Kennzahlleiste,
Korrelationen in den Wellness Tab

## Open questions

* Zielgewicht und Sollrate fehlen. Ohne sie laufen Projektion und Sollabweichung
  nicht
* Gibt es Tage ganz ohne Zeile im Sheet, oder Zeilen mit leeren Feldern. Das
  entscheidet, ob Luecken als fehlend oder als Null interpretiert werden. Wird
  mit dem Export beantwortet
