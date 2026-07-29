## Goal

Ein Bereich ganz oben auf der Seite, der die woechentliche Kontrollfrage in fuenf
Sekunden beantwortet, ohne dass ein Diagramm gelesen werden muss.

## Warum

Das Dashboard hat heute fuenf Tabs, vierzehn Diagramme und acht Kennzahlkacheln,
alle optisch gleichrangig. Mit den vier neuen Auswertungen waeren es rund zwanzig
Diagramme. Die wichtigste Zahl stuende dann zwischen Verdauung und Fruechten.
Der Antwortblock bildet die Rangordnung ab, die sich aus der Mission ergibt:
Kontrolle und Rechenschaft zuerst, Diagnose darunter.

## Scope

In scope: ein Block oberhalb der Kennzahlleiste, vier Aussagen, jeweils Zahl plus
Datenbasis. Bestehende Tabs und Diagramme bleiben unveraendert darunter erhalten.

Out of scope: Loeschen bestehender Ansichten, Erklaertexte, Empfehlungen.

## Inhalt

Vier Aussagen, in dieser Reihenfolge:

1. **Rate.** Aktuelle Veraenderung in kg pro Woche aus der Regression auf das
   7 Tage Mittel, daneben die Abweichung von `weight_rate_kg_per_week`. Fehlt die
   Sollrate, steht nur die Rate
2. **Erhaltungsbedarf.** TDEE als Spanne ueber die verfuegbaren Fenster, mit
   Angabe der Tagesbasis
3. **Plateau Status.** Einer von drei Zustaenden: kein Plateau, Plateau bei
   erfuellter Compliance, Stillstand bei unzureichender Compliance
4. **Compliance.** Protein und Kalorien als getroffene Tage von erfassten Tagen,
   nicht als Prozentwert. `24 von 28` ist ehrlicher als `86 Prozent`, weil die
   Datenbasis mitgeliefert wird

## Darstellung

Zahlen und knappe Bezeichner, keine Fliesstexte, keine Erklaerungen, keine
Fragezeichen zum Aufklappen. Jede Aussage traegt ihre Datenbasis in Tagen als
Zahl. Kann eine Aussage nicht getroffen werden, steht an ihrer Stelle der Grund
in einer Zeile, etwa `Basis 11 von 14 Tagen`, damit ein Strich nie mit einem
Defekt verwechselt wird.

Der Block muss auf einem schmalen Fenster umbrechen statt zu zerbrechen. Ein
eigenes mobiles Layout ist nicht vorgesehen.

## Acceptance criteria

* [ ] Der Block steht oberhalb der Kennzahlleiste und ist ohne Scrollen sichtbar
* [ ] Jede der vier Aussagen zeigt entweder Zahl plus Datenbasis oder einen Grund
* [ ] Keine Aussage erscheint mit erfundenem Wert bei zu duenner Datenlage
* [ ] Compliance wird als getroffene von erfassten Tagen ausgegeben
* [ ] Bei 360 px Fensterbreite bricht nichts aus dem Layout aus
* [ ] Kein bestehendes Diagramm und kein bestehender Tab wurde entfernt

## Nutzungszaehler

Zusaetzlich schreibt die Seite lokal mit, welcher Tab wie oft geoeffnet wurde,
nur im localStorage, ohne Uebertragung. Zweck ist, in einigen Monaten auf
Datenbasis entscheiden zu koennen, welche Ansichten nie benutzt werden und
gekuerzt werden koennen. Die Zahlen sind ueber die Einstellungen einsehbar und
zuruecksetzbar.
