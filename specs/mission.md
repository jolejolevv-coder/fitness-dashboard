# Mission

## Warum das existiert

der Nutzer trackt taeglich Gewicht, Makros, Schlaf, Stress, Energie, Verdauung und
Schritte in einem Google Sheet, dazu einen Mesozyklus mit Trainingsgewichten.
Die Entscheidungen daraus, also Kalorienanpassung und Programmierung, trifft sein
Personal Trainer, der Schreibrechte auf demselben Sheet hat.

Das Dashboard trifft diese Entscheidungen nicht nach. Es hat zwei Aufgaben:

**Kontrolle.** Erzeugt die Vorgabe des Trainers tatsaechlich die Wirkung, die sie
erzeugen soll. Nicht um zu widersprechen, sondern um frueh zu merken, wenn etwas
nicht aufgeht, und ihn dann gezielt anzusprechen statt vier Wochen zu warten.

**Rechenschaft.** Haelt der Nutzer seinen Teil der Abmachung ein, und zwar bevor der
Trainer es ihm sagt. Damit das Gespraech um Programmierung geht und nicht darum,
ob Protein getroffen wurde.

Verstehen, Motivation und die Faehigkeit zur begruendeten Zweitmeinung sind
erwuenschte Nebenwirkungen, keine eigenstaendigen Ziele.

## Was daraus folgt

Weil die Zahlen in ein Gespraech mit einem Fachmann getragen werden, ist die
Qualitaetslatte hoch. Eine Kennzahl, die nur fuer einen selbst gedacht ist, darf
danebenliegen. Eine Kennzahl, mit der man einem Trainer widerspricht, darf das
nicht. Deshalb gilt fuer jede abgeleitete Groesse: sie kennt ihre
Mindestdatenlage und verweigert die Aussage darunter, statt zu raten.

## Was es tut

* Liest zwei Tabs eines Google Sheets ueber die Sheets API v4, ausschliesslich lesend
* Beantwortet oben auf der Seite in einem Block die Wochenfrage: Rate gegen Soll,
  Erhaltungsbedarf, Plateau Status, Compliance
* Bietet darunter die bestehende Diagnoseebene aus Verlaufskurven, Wochenmitteln
  und Trainingsprogression
* Laeuft als statische Seite ohne Backend auf GitHub Pages

## Was es ausdruecklich nicht tut

* Keine Dateneingabe. Das Sheet bleibt die einzige Eingabemaske
* Kein Schreibzugriff auf das Sheet, keine Aenderung an dessen Struktur
* Kein Zugang fuer den Trainer. Er hat die Rohdaten, ihm fehlt nichts
* Keine Empfehlungen. Die Seite zeigt Zahlen und benennt Zustaende, sie ordnet
  nichts an
* Keine Erklaertexte zu den Kennzahlen. Angezeigt werden Zahl und Datenbasis

## Wer es nutzt

Eine Person, am Desktop. Mobil wurde die Seite nach eigener Aussage nie benutzt,
mobiles Layout ist deshalb kein Ziel.

## Betrieb

* Repository jolejolevv-coder/fitness-dashboard, oeffentlich, ohne Geheimnisse
* Ausgeliefert unter https://me.nahobinoco.com/fitness-dashboard/
* Seite wird per `noindex` von Suchmaschinen ferngehalten, kein Klarname in Titel
  oder Kopfbereich
* Zugangsdaten und Zielwerte liegen ausschliesslich im localStorage des Browsers
