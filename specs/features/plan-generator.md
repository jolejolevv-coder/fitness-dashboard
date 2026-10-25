## Goal

Auf Knopfdruck einen neuen Wochenplan (Gerichte und Rotation) innerhalb der
Rahmenvorgabe des Trainers erzeugen, ueber die Anthropic API direkt aus dem
Browser, bezahlt aus dem API Guthaben des Nutzers.

Status: Entwurf fuer Phase 9, Freigabe erst nach Abschluss von Phase 8.

## Scope

* In scope:
  * Knopf im Reiter `Plan`, der einen Vorschlag anfordert
  * API Schluessel im localStorage, wie die Google Zugangsdaten
  * Eingaben an das Modell: Zielwerte aus dem Sheet, Ausschlussliste,
    Geraete, Prep Tage, `foods.json`, aktuelle `prices.json`, Wuensche als
    Freitext
  * Antwort als Structured Output nach dem Schema von `meals.json` und
    `rotation.json`
  * Pruefung jeder Antwort mit dem Rechenkern aus Phase 8: Tagesziel kcal,
    Protein, Fett, Ausschluesse. Ein Vorschlag, der reisst, wird mit dem Grund
    angezeigt und nicht uebernehmbar
  * Vorschlag neben dem aktiven Plan anzeigen, Uebernahme nur per Klick, dann
    im localStorage als aktiver Plan. Export als JSON zum Committen
* Out of scope:
  * Automatische Laeufe ohne Knopfdruck
  * Chat mit dem Modell ueber mehrere Runden

## Acceptance criteria

* [ ] Ohne Schluessel ist der Knopf deaktiviert, die Seite funktioniert sonst
      unveraendert
* [ ] Jeder uebernommene Plan besteht dieselben Pruefungen wie der Seed Plan
* [ ] Ausschluesse aus der Liste tauchen in keinem Vorschlag auf
* [ ] API Fehler, Ablehnung und Zeitueberschreitung erscheinen als Zahl oder
      Status, nie als stiller Abbruch
* [ ] Kosten je Lauf werden aus `usage` berechnet und angezeigt
* [ ] Der Schluessel verlaesst den Browser nur in Richtung `api.anthropic.com`

## Implementation plan

Phase 9.1 Schema, Prompt und Pruefung als reine Funktionen mit Tests.
Phase 9.2 API Aufruf ueber das offizielle TypeScript SDK im Browserbetrieb,
Streaming, Modell `claude-opus-5-5`, Effort `high`, Fallback bei Ablehnung.
Phase 9.3 Oberflaeche: Knopf, Vorschau neben dem aktiven Plan, Uebernahme,
Export.

## Risiken

* Jeder Skriptfehler auf der Seite, der fremden Code ausfuehrt, kann den
  Schluessel lesen. Gegenmittel: eigener Schluessel in einem eigenen Workspace
  mit Ausgabelimit, Content Security Policy, weiter `textContent` statt
  `innerHTML`
* Naehrwerte neuer Lebensmittel aus dem Modell sind unzuverlaessig, siehe
  offene Frage 1

## Entscheidungen (25.10.2026)

* Das Modell kombiniert nur aus `foods.json`. Neue Zutaten erscheinen als
  Wunschliste, Naehrwerte traegt der Nutzer von der Packung nach
* Modell `claude-opus-5-5`. Nur der Nutzer greift auf die Seite zu, die Kosten
  je Lauf sind vertretbar

## Open questions

* Keine. Freigabe der Spec nach Abschluss von Phase 8
