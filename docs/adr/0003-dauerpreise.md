# ADR 0003: Quelle fuer Dauerpreise

Status: angenommen (25.10.2026), Variante D plus E

## Kontext

ADR 0002 liefert Angebotspreise. Fuer Artikel ohne aktuelles Angebot zeigt der
Reiter `Einkauf` bisher keinen Preis, die Ersparnis laesst sich nur fuer
Angebote mit Normalpreis rechnen. Gesucht ist ein Normalpreis je Artikel fuer
Lidl, Aldi Sued und Edeka am Wohnort. Die Einkaufsliste hat rund 25
Artikel, Grundnahrungsmittel wie Haehnchenbrust, Haferflocken, Skyr, Reis,
Eier, Erdnussbutter. Geprueft am 25.10.2026, Belege unten.

## Kandidaten

### A: Open Prices (Open Food Facts)

* Abdeckung: in Deutschland insgesamt 1115 Orte und 17 439 Preise. Fuer alle
  Filialen von Lidl, Aldi und Edeka zusammen rund 1060 Preise in den letzten
  sechs Monaten, bundesweit. Am Wohnort: kein einziger Ort. Naechste Grossstadt: Lidl
  ein Ort mit 4 Preisen, Aldi 4 Orte mit 5 Preisen, Edeka keiner. Kategorien
  aus unserer Liste in sechs Monaten bundesweit: Haehnchenbrust 6, Skyr 7,
  Eier 4, Erdnussbutter 2, Haferflocken 1, Basmati 1, Rinderhack 0
* Rechtslage: Daten unter ODbL 1.0, Belegfotos CC BY SA 4.0. Nutzung erlaubt
  mit Namensnennung, abgeleitete Datenbanken unter gleicher Lizenz. Offene REST
  API (`prices.openfoodfacts.org/api/v1`), kein Schluessel noetig
* Aufwand: gering. Abfrage im Actions Lauf nach Kategorie oder Barcode, kein
  fremdes HTML. Matching braucht Barcodes oder Kategorien je Artikel
* Urteil: sauber und stabil, aber fuer unseren Bedarf praktisch leer. Ein
  Preis aus Muenster vom September ist kein Dauerpreis fuer den Wohnort

### B: Onlinesortiment Aldi Sued

* Abdeckung: `sitemap_products.xml` listet 5049 Produktseiten, darunter etwa
  "Haehnchenbrustfilet Teilstueck 1 kg". Der Preis steht aber nicht im HTML. Die
  Seite ist eine Nuxt Anwendung, im eingebetteten Datenblock steht
  `price: null` und "Dieses Produkt ist in deiner Filiale aktuell nicht
  verfügbar". Preise kommen erst nach Filialwahl aus `api.aldi-sued.de`
* Rechtslage: `robots.txt` erlaubt Produktseiten fuer alle (gesperrt nur
  `/tools` und Suche). Die Preis API ist intern und undokumentiert, die
  Nutzungsbedingungen zur automatischen Abfrage wurden nicht gefunden. Nach
  BGH I ZR 224/12 ist Auslesen oeffentlicher Daten ohne Umgehung technischer
  Schutzmassnahmen wettbewerbsrechtlich meist zulaessig, ein Freibrief fuer
  eine interne API ist das nicht
* Aufwand: hoch. Filial ID ermitteln, interne API nachbauen, je Artikel ein
  Request, zweite Markupabhaengigkeit neben Muskelmarkt. Faellt bei jeder
  Aenderung der App aus
* Urteil: einzige Quelle mit echter Abdeckung, aber nur fuer Aldi Sued und auf
  dem bruechigsten Weg

### C: Onlinesortiment Lidl und Edeka

* Lidl: die Produktsitemap listet 13 726 Seiten, Treffer fuer Haehnchenbrust,
  Haferflocken, Skyr, Basmati, Erdnussbutter: keiner. Lebensmittel sind aus dem
  Onlineshop genommen, laut Lebensmittelzeitung bleiben Wein und Kochboxen.
  Filialpreise gibt es nur im Prospekt und in Lidl Plus
* Edeka: `edeka.de` zeigt je Markt nur Wochenangebote, kein Dauersortiment mit
  Preis. `robots.txt` sperrt zudem `/lieferservice/`
* Urteil: keine Quelle vorhanden

### D: Normalpreis aus Muskelmarkt, gesammelt

* Abdeckung: am 25.10.2026 tragen 115 von 176 Angeboten einen Normalpreis
  (`data-normal-price`, siehe `specs/features/muskelmarkt-parser.md`). Fuer
  einen Artikel gibt es also nur dann einen Wert, wenn er irgendwann im Angebot
  war. Grundnahrungsmittel wie Haehnchenbrust und Skyr sind bei Discountern
  haeufig im Angebot, Reis oder Haferflocken selten. Aldi Sued gilt laut
  Muskelmarkt als bundesweit einheitlich, Edeka als stark regional
* Rechtslage: keine neue Quelle, derselbe Abruf wie in ADR 0002, dieselbe
  Anfrage an Muskelmarkt deckt es ab
* Aufwand: gering. Der Lauf merkt sich je Artikel und Markt den zuletzt
  gesehenen Normalpreis mit Datum in `data/regular_prices.json`
* Urteil: kostet fast nichts, beginnt aber leer und fuellt sich ueber Wochen

### E: Von Hand gepflegt

* Abdeckung: vollstaendig fuer die eigenen rund 25 Artikel, so genau wie der
  letzte Kassenbon
* Rechtslage: unproblematisch
* Aufwand: einmal etwa 30 Minuten, danach Nachpflege bei Preisaenderung.
  Dauerpreise bei Discountern aendern sich wenige Male im Jahr, nicht woechentlich.
  ADR 0002 hat Handpflege fuer woechentliche Angebote verworfen, fuer
  Dauerpreise ist die Frequenz eine andere

## Empfehlung

D plus E. Der Actions Lauf sammelt den Normalpreis aus Muskelmarkt je Artikel
und Markt mit Datum. Fuer Artikel ohne gesammelten Wert gilt ein Startwert aus
einer handgepflegten Liste. Gezeigt wird der juengere der beiden Werte, immer
mit Datum, aelter als 90 Tage mit Vermerk. Open Prices und Aldi Sued Online
werden nicht angebunden.

Tradeoff: keine neue Quelle, kein neues Rechtsrisiko, kein zweites fremdes
Markup. Dafuer ist der Dauerpreis nie tagesaktuell. Der Muskelmarkt Normalpreis
ist der Preis, den der Handzettel als "statt" nennt, und kann vom Regal
abweichen, bei Edeka stammt er nicht vom eigenen Markt. Die Handliste kostet
einmal eine halbe Stunde und danach Disziplin, die erfahrungsgemaess nachlaesst.
Der Datumsvermerk macht das sichtbar statt still falsch.

## Verworfen

* A Open Prices: rechtlich ideal, aber im Umkreis keine Daten. Wiedervorlage,
  wenn die Abdeckung waechst, oder als Rueckkanal, falls der Nutzer eigene
  Kassenbons dort einstellt
* B Aldi Sued Online: echte Daten, aber interne API, Filialbindung, unklare
  Nutzungsbedingungen und nur ein Markt von dreien. Waere eine eigene ADR wert,
  falls D plus E nicht reicht
* C Lidl und Edeka Online: keine Dauerpreise vorhanden

## Folgen

* Neue Datei `data/regular_prices.json`, oeffentlich im Repo wie
  `prices.json`, verraet ebenfalls die Einkaufsliste
* Neue Handliste, Ort und Format legt Phase 8.1 fest (Vorschlag: Feld
  `regular_price_eur` mit Datum je Artikel und Markt in `shopping_items.json`)
* Die Ersparnis im Reiter rechnet gegen den Normalpreis des Angebots, nicht
  gegen den Dauerpreis
* Fuer Phase 8.4 kommt ein Akzeptanzkriterium dazu: gesammelter Normalpreis
  ueberschreibt nur, wenn er juenger ist

## WAF

* Reliability: faellt Muskelmarkt aus, bleiben Startwerte und letzte
  gesammelte Werte stehen
* Security: keine neue Quelle, kein Geheimnis
* Cost: 0 Euro, kein zusaetzlicher Request

## Belege (25.10.2026)

* Open Prices API, Filter auf Orte in Deutschland mit Namen Lidl, Aldi, Edeka
  und Datum ab 25.04.2026; Laenderuebersicht `locations/osm/countries`
* `www.aldi-sued.de/robots.txt`, `sitemap_products.xml`, eine Produktseite
  (Haehnchenbrustfilet Teilstueck 1 kg), eingebetteter `__NUXT_DATA__` Block
* `www.lidl.de/robots.txt`, `product_sitemap.xml.gz`
* `www.edeka.de/robots.txt`
* Lebensmittelzeitung, "Lidl nimmt Lebensmittel aus dem Online Sortiment"
* BGH, Urteil vom 30.04.2014, I ZR 224/12 (Flugvermittlung, Screen Scraping)
