## Goal

Festhalten, wie der Parser in Phase 8.4 Angebote aus `muskelmarkt.de/app1.php`
liest, belegt an einem einzigen Abruf vom 25.10.2026, damit niemand Selektoren
raten muss.

Status: Recherche Phase 8.0, Grundlage fuer Phase 8.4. Kein Mitschnitt der
Seite im Repo, die Testprobe wird in 8.4 von Hand gebaut.

## Abruf

* `robots.txt`: `GET https://www.muskelmarkt.de/robots.txt` am 25.10.2026
  14:09 UTC liefert `404 Not Found`. Es gibt keine robots Regeln, also keine
  Sperre. Der Workflow prueft trotzdem bei jedem Lauf neu: Status 200 mit einer
  `Disallow` Regel, die `/app1.php` fuer `*` oder unseren User Agent trifft,
  bricht den Lauf ab. 404 gilt als erlaubt, jeder andere Fehler als Abbruch
* Seite: ein `GET https://www.muskelmarkt.de/app1.php`, User Agent
  `fitness-dashboard-price-research/0.1 (+https://github.com/jolejolevv-coder/fitness-dashboard; private use, one request)`.
  Antwort 200, `text/html` UTF 8, rund 1,8 MB, 29 531 Zeilen, ohne Login.
  Der Server setzt ein `PHPSESSID` Cookie, gebraucht wird es nicht
* Kopf der Seite: `<meta name="ROBOTS" content="NOINDEX, FOLLOW">`. Das
  betrifft Suchmaschinen, nicht den Abruf
* Die Seite ist vollstaendig serverseitig gerendert. Alle Angebote stehen im
  HTML, Nachladen per AJAX gibt es nur fuer Details (Preisverlauf, Rezepte,
  Artikeltext), die der Parser nicht braucht

## Struktur

```
section.store-section#<slug>            ein Abschnitt je Markt
  h2.store-title                        Marktname
  div.store-subtitle                    Hinweis zur Regionalitaet
  div.store-offer-coverage              "Angebote bis Sa., 31.10."
  div.date-group                        eine Gruppe je Gueltigkeitszeitraum
    div.date-group-header               "Mo - Sa (26.10. - 31.10.)"
    div.offer-grid
      article.offer-card[data-id]       ein Angebot
```

Abschnitte am 25.10.2026: `aldi-nord`, `aldi-s-d`, `edeka`, `kaufland`, `lidl`,
`netto`, `netto-scottie`, `norma`, `penny`, `rewe`. Fuer uns zaehlen nur
`aldi-s-d`, `edeka` und `lidl`. Gefiltert wird ueber `data-store` am Artikel
mit den Werten `Aldi Süd`, `Edeka`, `Lidl`, die Abschnitts ID dient als
Gegenprobe.

## Selektoren

Die Daten stehen zweimal im Markup: als `data-*` Attribute am `article` und als
sichtbarer Text. Der Parser liest die Attribute, der sichtbare Text dient als
Gegenprobe.

| Feld | Primaer | Gegenprobe |
| --- | --- | --- |
| Markt | `article[data-store]` | `.offer-store > span`, Abschnitt `section#<slug>` |
| Produktname mit Menge | `article[data-name]` (HTML Entities dekodieren, etwa `&#039;`) | `.title-text` |
| Angebotspreis | `article[data-price]`, Punkt als Dezimaltrenner, etwa `6.99` | `.price-container .current-price` (Komma, etwa `6,99`) |
| Normalpreis | `article[data-normal-price]`, leer wenn keiner angegeben | `.price-container .original-price` (etwa `8,79 €`) |
| Gueltigkeit | `article[data-offer-start]`, `article[data-offer-end]` als ISO Zeit ohne Zone, etwa `2026-10-26T00:00:00` bis `2026-10-31T23:59:59` | `.date-badge`, `.date-group-header` |
| Grundpreis | `.unit-price` (etwa `8,74 €/kg`), fehlt bei 3 von 176 | eigene Rechnung aus Menge |
| Bedingung | `.membership-info .membership-icon-span` | siehe unten |
| Angebots ID | `article[data-id]` | `.price-insights-trigger[data-offer-id]` |

## Angebot gegen Normalpreis, Beleg

Die Unterscheidung steht im Markup, nicht in der Reihenfolge allein.

* Angebotspreis traegt die Klasse `current-price`, Normalpreis die Klasse
  `original-price`. Zusaetzlich getrennte Attribute `data-price` und
  `data-normal-price`
* Pruefung ueber alle 176 Produktkarten des Abrufs:
  * `current-price` gleich `data-price` in 176 von 176 Faellen
  * `data-normal-price` gefuellt in 115 Faellen, in genau diesen 115 steht ein
    `original-price` Element, in keinem Fall nur eines von beiden
  * `original-price` gleich `data-normal-price` in 115 von 115 Faellen
  * Normalpreis groesser als Angebotspreis in 115 von 115 Faellen
  * In der Reihenfolge steht `original-price` immer vor `current-price`. Das
    ist eine Beobachtung, der Parser stuetzt sich nicht darauf
* 61 Karten haben keinen Normalpreis. Dann ist `regular_price_eur` gleich
  `null`, nie ein geschaetzter Wert

## Was keine Produktkarte ist

* Aktionskarten: `article.offer-card` ohne `data-name`, mit `data-action-id`
  (etwa `campaign-237`, "20% Rabatt auf alle EDEKA Herzstücke"). 8 Stueck am
  25.10.2026. Ueberspringen, kein Fehler
* Vorlagen und Kopien in `<script>`: JavaScript Vorlagen mit
  `data-store="${storeName}"` und per `innerHTML` eingesetzte Kopien fuer
  Modale. Der Parser liest nur das DOM ausserhalb von `script` und nur
  `section.store-section article.offer-card`
* Einstellungen: `.sortable-store-item[data-store="<slug>"]` ist die
  Marktauswahl, keine Angebote

## Bedingte Preise

`.membership-info` markiert Preise, die nur mit App oder Kundenkarte gelten.
Am 25.10.2026 im Ausschnitt Lidl, Aldi Sued, Edeka: Edeka `Mit der App` 5 mal,
Lidl `Lidl Plus` 1 mal (Klasse `lidl-plus`), Aldi Sued keinmal. Der Parser
uebernimmt den Text als Feld `condition` (sonst `null`). Ob solche Preise in den
guenstigsten Preis eingehen, entscheidet die Oberflaeche in 8.5, Vorschlag:
ja, mit sichtbarem Vermerk.

## Menge aus dem Produktnamen

`data-name` beginnt fast immer mit der Menge. Muster im Abruf (176 Namen):

* `600g`, `1 kg`, `500ml`, `1L`, `2L`: Zahl, optional Leerzeichen, Einheit
  `g`, `kg`, `ml`, `l`, `L`
* `12x 265g`, `3x 125g`, `12x1l`: Packungszahl mal Einzelmenge, `size_g` ist
  das Produkt
* `450/500g`: Spanne, kleinster Wert zaehlt, damit der Grundpreis nicht
  geschoent wird
* `15 Eier`, `10 Eier`: Stueckzahl, nur fuer Artikel mit Stueckeinheit in
  `shopping_items.json`
* ohne Menge (`Avocado "Hass"`): kein Grundpreis, Treffer bleibt mit
  `size_g: null` und `price_per_kg: null`

Volumen wird nicht in Gramm umgerechnet. `ml` und `l` gelten nur fuer Artikel,
die in `shopping_items.json` als Volumen gefuehrt sind.

## Gueltigkeit

* `valid_from`, `valid_to` je Treffer aus `data-offer-start` und
  `data-offer-end`, gelesen als Europe/Berlin
* `valid_days` aus `.date-group-header`, Wochentagspanne wie `Mo - Sa`,
  `Do - Sa`, `Fr - Sa`, `Mi - Sa`, `Do - Mi`
* Datei weit: `valid_from` ist der frueheste Start, `valid_to` das spaeteste
  Ende aller Treffer

Der Abruf am Sonntag zeigt die Angebote der kommenden Woche (`Ab Morgen`).
Der Cron Sonntag 18:00 aus ADR 0002 passt dazu.

## Regionalitaet

Die Seite hat keine Filial oder PLZ Auswahl. Untertitel je Markt:

* Aldi Sued: "Bundesweit in der Regel einheitlich."
* Lidl: "Regionale Abweichungen möglich."
* Edeka: "Große regionale Abweichungen. Prüfe deinen Filialprospekt."

Fuer den eigenen Edeka Markt (Regionalgesellschaft Hessenring) koennen Angebote und
Preise also abweichen oder fehlen. Folge fuer 8.5: Edeka Treffer tragen einen
Vermerk, der Parser macht keinen Unterschied.

## Fehlerfaelle, die den Lauf scheitern lassen

* HTTP Status ungleich 200 oder Antwort ohne `section.store-section`
* keiner der drei Maerkte gefunden
* eine Produktkarte von Lidl, Aldi Sued oder Edeka ohne gueltiges
  `data-price` oder ohne `data-offer-start` und `data-offer-end`
* `data-price` und `.current-price` weichen ab, oder `data-normal-price` ohne
  `.original-price` (und umgekehrt). Das waere ein Zeichen fuer geaendertes
  Markup
* null Treffer nach dem Matching gegen `shopping_items.json`

## Beifang, nicht Teil von Phase 8

* Jede Karte traegt Naehrwerte je 100 g (`data-protein`, `data-carbs`,
  `data-fat`, `data-kcal`) und Haltbarkeit (`data-shelf-life`). Wird nicht
  uebernommen
* Es gibt einen Endpunkt `ajax_price_history.php?product_id=<id>` fuer den
  Preisverlauf. Nicht abgerufen, ein Abruf pro Lauf bleibt die Regel

## Acceptance criteria fuer 8.4

- [ ] Parser liest die handgebaute Probe mit Angebot mit Normalpreis, ohne
      Normalpreis, Aktionskarte, Vorlage in `script`, App Preis und Mehrfachpackung
- [ ] Abweichung zwischen Attribut und sichtbarem Preis laesst den Test
      scheitern
- [ ] `robots.txt` mit passender `Disallow` Regel bricht vor dem Seitenabruf ab

## Open questions

- Bedingte Preise (App, Lidl Plus) in den guenstigsten Preis einrechnen oder
  nur zeigen. Entscheidung in 8.5
