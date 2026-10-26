## Goal

Die Prep Sessions Sonntag und Mittwoch als gefuehrte Kochansicht abspielen,
Schritt fuer Schritt mit skalierten Mengen, Timern und Mise en place, damit
beim Kochen nur noch das Handy neben dem Geraet liegt.

Status: freigegeben am 26.10.2026. Umsetzung als Phase 11 auf Branch `recipes`,
abgezweigt von `plan-generator`.

Vorbild: Kochmodus von cookwell.com, angesehen am 25.10.2026, nur lesend und
ohne Anmeldung. Uebernommen werden Muster, keine Inhalte.

## Muster aus dem Vorbild und ihre Uebertragung

| Muster im Vorbild | Uebertragung hier |
|---|---|
| Kochmodus mit einem Schritt pro Bildschirm, eigene Adresse je Schritt | Schritt Ansicht je Prep Session, vor und zurueck, Stand im localStorage |
| Je Schritt nur die Zutaten, die dieser Schritt braucht | Kommt fertig aus `buildPrep`: jeder `PrepStepResult` traegt seine `lines` |
| Mengen nach Portionen skaliert | Mengen ueber die Tage summiert, die der Schritt abdeckt. Ein Tausch im Plan wirkt sofort, Mengen stehen nie in der Datei |
| Mengen als Stueck und Gramm nebeneinander | Gramm aus dem Plan, Stueck nur wo `shopping_items.json` ein `gramsPerPiece` kennt |
| Zutaten nach Bestandteil gruppiert | Gruppierung nach Gericht ueber `uses` |
| Geschmacksrollen als Marken (salzig, sauer, Fett) | Nicht uebernommen, widerspricht der Regel ohne Erklaertexte |
| Glossar fuer Techniken, Begruendung je Schritt | Nicht uebernommen, gleiche Regel |
| Naehrwerte je Rezept | Gibt es schon im Reiter Plan, nicht doppelt |
| Planer, der die Einkaufsliste baut, Abhaken am Handy | Gibt es schon seit Phase 8 |
| Timer | Im Vorbild nicht sichtbar. Hier neu, aus Dauer je Schritt |

## Scope

* In scope:
  * Neue Datei `data/recipes.json`, handgepflegt, Pflege per Commit wie der
    Plan. Je Prep Schritt: eine kurze Anweisung (ein Satz), Temperatur in °C
    wo das Geraet eine hat, Dauer in Minuten, optional ein Zwischenhalt
    (Wenden nach N Minuten)
  * Stabile `id` je Schritt in `prep.json`, `recipes.json` verweist darauf.
    `PrepStep.id` ist im Typ optional, damit generierte Plaene aus Phase 9
    weiter gelten. Fuer den Seed ist sie Pflicht und per Test geprueft
  * Knopf `Kochen` je Prep Session im Reiter Plan, oeffnet die Kochansicht
    innerhalb des Reiters, kein neuer Reiter
  * Mise en place als erster Bildschirm: alle Zutaten der Session mit
    Gesamtmenge, zusammengefasst ueber alle Schritte, abhakbar
  * Schritt Ansicht: Titel, Geraet, Temperatur, Dauer, Anweisung, Zutaten des
    Schritts mit Mengen je Gericht. Fortschritt als Zahlenzeile `Schritt 2 von 5`
  * Timer je Schritt mit Dauer aus den Daten. Mehrere Timer laufen parallel
    (Airfryer und OptiGrill gleichzeitig) und bleiben in einer Leiste sichtbar,
    auch nach dem Weiterblaettern. Ende als Ton und Vibration
  * Timer rechnen ueber den Endzeitpunkt, nicht ueber gezaehlte Ticks, und
    ueberstehen Neuladen und Hintergrund Tabs
  * Bildschirm bleibt an ueber die Wake Lock API, solange die Kochansicht
    offen ist. Nach Rueckkehr aus dem Hintergrund wird die Sperre neu
    angefordert
  * Zustand (Mise en place Haken, aktueller Schritt, laufende Timer) im
    localStorage unter `fitness_cook_v1`, je Geraet
  * Darstellung bei 375 px, Bedienelemente gross genug fuer nasse Finger
* Out of scope:
  * Kochschritte aus dem Plangenerator. Phase 9 bleibt unberuehrt, ein
    generierter Plan hat keine Schritt `id`s und damit keine Anweisungen
  * Rezeptseite je Gericht mit Portionsregler
  * Geschmacksrollen, Glossar, Begruendungen, Videos, Fotos
  * Import fremder Rezepte, Chat zum Rezept
  * Benachrichtigungen ueber die Notifications API bei gesperrtem Geraet
  * Geraeteuebergreifender Kochstand

## Pruefung gegen `CLAUDE.md` und Phase 8 und 9

1. Keine Erklaertexte: Die Anweisung ist ein Satz, was zu tun ist, kein Warum.
   Alles andere steht als Zahl (°C, Minuten, Gramm, Schritt N von M).
   Entschieden 26.10.2026.
2. Keine Konstanten als Literal: Dauer und Temperatur kommen aus
   `recipes.json`. Tonlaenge, Vibrationsmuster und Mindestgroesse der
   Bedienelemente stehen als benannte Konstanten in `src/config/`.
3. Mindestdatenlage: Fehlt fuer einen Schritt der Eintrag in `recipes.json`,
   zeigt der Schritt Geraet und Mengen, aber keinen Timer, und die Session
   zeigt `Anweisungen 3 von 5 Schritten`. Kein stiller Ersatzwert.
4. `textContent`: Anweisungen stammen aus dem Repo, gehen trotzdem nur per
   `textContent` ins DOM, ebenso Namen aus einem generierten Plan.
5. Rahmen aus Phase 8: kein Herd. Erlaubte Geraete sind nur `PREP_DEVICES`
   (Mikrowelle, Airfryer, OptiGrill), die Pruefung verwirft andere.
6. Planquelle aus Phase 9.2: Die Kochansicht liest den aktiven Plan ueber die
   Planquelle, nicht die Konstante `PLAN`. Bei generiertem Plan gilt Punkt 3.
7. Oeffentliches Repo: `recipes.json` enthaelt nur Arbeitsschritte, keine
   Personendaten. Wer kann sie lesen: jeder mit dem Repo Link, das ist
   unkritisch.

## Acceptance criteria

* [ ] Jeder Schritt in `data/prep.json` (Seed) traegt eine eindeutige `id`,
      jeder Eintrag in `recipes.json` verweist auf eine existierende `id`, und
      jeder Eintrag nutzt nur Geraete aus `PREP_DEVICES`. Sonst schlaegt ein
      Test fehl
* [ ] Mengen der Kochansicht stimmen mit der Prep Checkliste aus Phase 8
      ueberein, auch nach einem Tausch im Plan und mit Riegel Schalter
* [ ] Mise en place zeigt jede Zutat der Session genau einmal mit der Summe
      ueber alle Schritte, Gewuerze ohne Menge
* [ ] Ein Timer, der bei 12 Minuten gestartet wurde, zeigt nach Neuladen der
      Seite die richtige Restzeit ±1 s und meldet das Ende per Ton und
      Vibration, wo das Geraet sie kann
* [ ] Zwei Timer laufen gleichzeitig und bleiben beim Blaettern sichtbar
* [ ] Schritt mit Zwischenhalt meldet den Halt und das Ende getrennt
* [ ] Wake Lock wird beim Oeffnen angefordert, beim Schliessen freigegeben und
      nach Rueckkehr aus dem Hintergrund neu angefordert. Ohne Unterstuetzung
      steht `Wake Lock nicht verfuegbar` als Status, die Ansicht funktioniert
      weiter
* [ ] Fehlende Anweisungen erscheinen als Zahlenzeile `Anweisungen N von M
      Schritten`, nie als leerer Platz ohne Hinweis
* [ ] Mit generiertem Plan aus Phase 9 oeffnet die Kochansicht ohne Fehler und
      zeigt Mengen und Geraete
* [ ] Haken, Schritt und Timer liegen unter `fitness_cook_v1`, ein Knopf setzt
      die Session zurueck. Ein beschaedigter Eintrag wird verworfen, nicht
      geladen
* [ ] Kochansicht bei 375 px ohne waagerechten Seitenlauf, Bedienelemente
      mindestens so gross wie die Konstante in `src/config/`
* [ ] Reine Funktionen (Mise en place Aggregation, Timer Restzeit,
      Zustand parsen) ohne DOM Zugriff, getestet gegen synthetische Faelle
* [ ] `npm run check` und Build sauber, alle bestehenden Tests bleiben gruen,
      Haupt Bundle waechst um weniger als 5 kB gzip

## Implementation plan

Phase 11.0 Daten: `id` je Schritt in `prep.json`, Typ `Recipe` in
`src/nutrition/types.ts`, `data/recipes.json` fuer die zehn Schritte der beiden
Sessions. Anweisung, Temperatur und Dauer schlaegt Claude vor, der Nutzer
waehlt aus und korrigiert (wie bei Wuerzen und Soßen in Phase 8). Validierung
der Querverweise mit Tests.

Phase 11.1 Reine Funktionen mit Tests: Mise en place aus `PrepSessionResult`,
Zuordnung Schritt zu Rezept mit Zaehlung fehlender Eintraege, Timer Zustand
(Start, Restzeit aus Endzeitpunkt, Zwischenhalt, Ende), Parsen und Serialisieren
von `fitness_cook_v1`.

Phase 11.2 Oberflaeche: Knopf `Kochen` je Session, Mise en place, Schritt
Ansicht mit vor und zurueck, Timerleiste, Ton ueber Web Audio ohne Audiodatei,
Vibration, Wake Lock. Pruefung bei 375 px.

Phase 11.3 Auslieferung: Test am Handy in einer echten Prep Session durch den
Nutzer, Korrekturen an `recipes.json`, Merge, Retro in der Roadmap.

## Risiken

* Ton und Vibration: iOS Safari unterstuetzt die Vibration API nicht, Ton
  braucht eine vorherige Beruehrung der Seite. Der Start Knopf des Timers gilt
  als diese Beruehrung. Am iPhone bleibt also nur der Ton
* Gesperrtes Geraet: ohne Wake Lock oder bei manuellem Sperren laeuft kein
  JavaScript, das Ende wird erst beim Entsperren gemeldet. Bewusst in Kauf
  genommen, Benachrichtigungen sind ausserhalb des Umfangs
* Abhaengigkeit von Phase 9.2: die Planquelle muss auf `main` sein, bevor die
  Kochansicht den aktiven Plan liest

## Entscheidungen (26.10.2026)

* Einheit ist die Prep Session, nicht das einzelne Gericht
* Kochschritte als handgepflegtes JSON, Phase 9 bleibt unberuehrt
* Im Umfang: Schritt Ansicht, Timer je Schritt, Mise en place, Wake Lock
* Texte: ein Satz Anweisung je Schritt, Rest als Zahlen

* Branch `recipes`, abgezweigt von `plan-generator` (Nutzer 26.10.2026: nicht
  auf den Merge warten). Merge auf `main` erst nach `plan-generator`
* Benennung: Knopf `Kochen`, Datei `data/recipes.json`, Schluessel
  `fitness_cook_v1`. Phasennummer 11, weil Phase 10 schon der Daily Import ist
* Stueckangaben neben Gramm nur, wo `shopping_items.json` ein `gramsPerPiece`
  kennt
* Kochansicht und Prep Checkliste (`fitness_prep_done_v1`) bleiben getrennt,
  ein Schritt in der Kochansicht setzt keinen Haken in der Checkliste

## Open questions

* Keine
