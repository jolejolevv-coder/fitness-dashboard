# Mission

## Warum das existiert

Der Nutzer trackt taeglich Gewicht, Makros, Schlaf, Stress, Energie, Verdauung
und Schritte in einem Google Sheet, dazu einen Mesozyklus mit
Trainingsgewichten. Die Entscheidungen daraus, also Kalorienanpassung und
Programmierung, trifft sein Personal Trainer, der Schreibrechte auf demselben
Sheet hat.

Das Dashboard trifft diese Entscheidungen nicht nach. Es hat zwei Aufgaben:

**Kontrolle.** Erzeugt die Vorgabe des Trainers tatsaechlich die Wirkung, die sie
erzeugen soll. Nicht um zu widersprechen, sondern um frueh zu merken, wenn etwas
nicht aufgeht, und ihn dann gezielt anzusprechen statt vier Wochen zu warten.

**Rechenschaft.** Haelt der Nutzer seinen Teil der Abmachung ein, und zwar bevor
der Trainer es ihm sagt. Damit das Gespraech um Programmierung geht und nicht darum,
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
* Zeigt den eigenen Ernaehrungsplan innerhalb der Rahmenvorgabe des Trainers,
  die Einkaufsliste dazu und woechentliche Angebotspreise (seit Phase 8). Die
  Mahlzeiten stellt der Nutzer zusammen. Ab Phase 9 kann er auf Knopfdruck
  einen Vorschlag ueber die Anthropic API anfordern, aktiv wird nur, was er
  uebernimmt
* Laeuft als statische Seite ohne Backend auf GitHub Pages. Einzige zweite
  Datenquelle ist `data/prices.json`, einmal pro Woche von GitHub Actions
  geschrieben (ADR 0002)
* Ist ab Phase 12 eine installierbare Web App (PWA, ADR 0006): Start vom Home
  Bildschirm im Vollbild, ohne Netz mit den zuletzt geladenen Sheet Werten und
  deren Alter. Der Service Worker cached nur die eigene App Huelle, nie Anfragen
  an Google oder Anthropic

## Was es ausdruecklich nicht tut

* Keine Dateneingabe im Dashboard. Das Sheet bleibt die Eingabemaske, dazu ab
  Phase 10 der Daily Import (iOS Shortcut plus Apps Script, ADR 0005), der
  Werte aus Apple Health in leere Zellen vorhandener Datumszeilen schreibt
* Kein Schreibzugriff des Dashboards auf das Sheet, keine Aenderung an dessen
  Struktur, auch nicht durch den Daily Import
* Kein Zugang fuer den Trainer. Er hat die Rohdaten, ihm fehlt nichts
* Keine Empfehlungen. Die Seite zeigt Zahlen und benennt Zustaende, sie ordnet
  nichts an
* Keine Erklaertexte zu den Kennzahlen. Angezeigt werden Zahl und Datenbasis

## Wer es nutzt

Eine Person, vor allem am Handy: Plan, Einkauf und Kochen in der Kueche, die
Wochenfrage unterwegs. Ab Phase 12 ist die Oberflaeche mobile first und fuer
alle Ziele bei 375 px verbindlich. Am Desktop laeuft dieselbe Oberflaeche ab
900 px mit linker Navigation und zwei Spalten, ohne zweiten Code Pfad.

## Betrieb

* Repository jolejolevv-coder/fitness-dashboard, oeffentlich, ohne Geheimnisse
* Ausgeliefert unter https://me.nahobinoco.com/fitness-dashboard/
* Seite wird per `noindex` von Suchmaschinen ferngehalten, kein Klarname in Titel
  oder Kopfbereich
* Zugangsdaten und Zielwerte liegen ausschliesslich im localStorage des Browsers.
  Die auf dem iPhone installierte App hat einen eigenen localStorage, die
  Zugangsdaten werden dort einmal neu eingetragen
