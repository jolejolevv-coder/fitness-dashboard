## Goal

Auf Knopfdruck einen neuen Wochenplan (Gerichte, Rotation, Prep) innerhalb der
Rahmenvorgabe des Trainers erzeugen, ueber die Anthropic API direkt aus dem
Browser, bezahlt aus dem API Guthaben des Nutzers.

Status: freigegeben am 25.10.2026, nachgeschaerft gegen den Stand von Phase 8.
Umsetzung beginnt mit Phase 9.0.

## Scope

* In scope:
  * Knopf im Reiter `Plan`, der einen Vorschlag anfordert
  * Anthropic API Key im localStorage, eigener Schluessel, getrennt von den
    Google Zugangsdaten
  * Ausschlussliste als Auswahl aus `foods.json` im Reiter `Plan`, gespeichert
    im localStorage je Geraet
  * Eingaben an das Modell: Tagesziele kcal, Protein, Fett, KH, Ballaststoffe
    aus dem Sheet, `foods.json`, `shopping_items.json` (Packungen), aktuelle
    `prices.json`, Geraete aus `PrepDevice`, Prep Tage Sonntag und Mittwoch,
    Wuensche als Freitext
  * Antwort als Structured Output mit einem Schema fuer Gerichte, Rotation, Prep
    und Wunschliste neuer Zutaten. Zutaten sind im Schema ein `enum` der
    erlaubten `foodId`s (alle mit Einkaufseintrag, ohne Ausschluesse)
  * Pruefung jeder Antwort mit dem Rechenkern aus Phase 8 plus einer neuen
    Tagespruefung (Toleranzen siehe unten). Ein Vorschlag, der reisst, wird mit
    dem Grund als Zahlenzeile angezeigt und ist nicht uebernehmbar
  * Vorschlag neben dem aktiven Plan anzeigen, Uebernahme nur per Klick, dann
    im localStorage als aktiver Plan. Knopf zurueck zum Seed Plan
  * Export als drei JSON Dateien im Format von `data/meals.json`,
    `data/rotation.json`, `data/prep.json` zum Committen
  * Content Security Policy fuer die gebaute Seite
* Out of scope:
  * Automatische Laeufe ohne Knopfdruck
  * Chat mit dem Modell ueber mehrere Runden
  * Neue Lebensmittel mit Naehrwerten aus dem Modell (nur Wunschliste)
  * Riegel Option fuer generierte Plaene: das Schema kennt kein `addToSlot`,
    der Riegel Schalter ist bei aktivem Vorschlag ausgeblendet
  * Geraeteuebergreifender aktiver Plan, dafuer gibt es den Export

## Pruefung des Entwurfs gegen Phase 8 und `CLAUDE.md`

1. Prep fehlte im Entwurf. `prep.json` verweist auf Gericht IDs, ein Vorschlag
   ohne Prep haette die Checkliste gebrochen. Entschieden: der Generator liefert
   Prep mit, `validatePlan` prueft alle Querverweise.
2. Die Tagespruefung "kcal ±40, Protein ≥ Ziel" existiert nur als Testkonstante
   (`DAY_KCAL_BAND` in `test/nutrition.test.ts`). Es gibt keine Produktfunktion,
   die einen Plan gegen Ziel und Toleranz prueft. Phase 9.1 baut sie, Toleranzen
   als benannte Konfiguration, nicht als Literal im Rechenkern.
3. Ausschlussliste hatte keine Quelle. Entschieden: localStorage.
4. `PLAN` ist eine gebuendelte Konstante, Reiter Plan und Einkauf lesen sie
   direkt. Ein aktiver Plan aus dem localStorage braucht eine Planquelle, die
   Seed oder Vorschlag liefert. Das ist der groesste Eingriff in Phase 8 Code.
5. Overrides und Abhakstatus zeigen auf Gericht IDs. Entschieden: bei Uebernahme
   und beim Zurueckkehren zum Seed werden sie geleert.
6. Mindestdatenlage: fehlt eines der Ziele kcal, Protein oder Fett im Sheet
   (`sheetDayGoals`), ist der Knopf deaktiviert und zeigt `Ziele 2 von 3`.
7. Es gibt bisher keine CSP. `index.html` traegt Inline Styles, Vite liefert im
   Dev Modus Inline Skripte. Die CSP kommt deshalb nur in den Build, Inline
   Styles bleiben vorerst ueber `style-src 'unsafe-inline'` erlaubt.
8. Kosten haengen an Preisen je Token. Sie liegen als benannte Konstanten mit
   Stand Datum in `src/config/`, nicht im Rechenkern.
9. Texte aus der Modellantwort (Gerichtnamen, Prep Titel, Wunschliste) gehen
   wie Sheet Inhalte nur per `textContent` ins DOM.

## Festlegungen

* Modell `claude-opus-5-5`, `output_config.effort: "high"`, adaptives Thinking
  (Standard des Modells), Streaming mit `finalMessage()`
* Ablehnung: serverseitiger Fallback `fallbacks: "default"` mit Beta
  `server-side-fallback-2026-07-01`. Auch die Antwort des Fallback Modells
  laeuft durch dieselbe Pruefung. Lehnt die ganze Kette ab, steht
  `Abgelehnt` mit Kategorie als Status
* Bibliothek `@anthropic-ai/sdk` mit `dangerouslyAllowBrowser: true`, per
  dynamischem Import erst beim Knopfdruck geladen, damit der erste Seitenaufruf
  nicht waechst
* Toleranzen je Tag: kcal Ziel ±40, Protein mindestens Ziel, Fett Ziel ±10 g.
  KH und Ballaststoffe werden angezeigt, nicht geprueft
* Schluessel: eigener Key in einem eigenen Workspace mit monatlichem
  Ausgabelimit, das der Nutzer in der Console setzt
* Daten an Anthropic: nur die Tagesziele aus dem Sheet, keine Tageswerte,
  kein Gewicht, keine Trainingsdaten
* Neue Gericht IDs tragen das Praefix `g`, damit sie nie mit Seed IDs
  kollidieren
* localStorage Schluessel `fitness_anthropic_v1` (API Key),
  `fitness_exclusions_v1`, `fitness_active_plan_v1` (Plan mit Zeitstempel und
  Modell). Ein gespeicherter Plan, der `validatePlan` oder die Tagespruefung
  nicht mehr besteht, wird nicht geladen, der Seed gilt und der Fund wird
  angezeigt
* Gearbeitet wird auf Branch `plan-generator`, Merge auf `main` nach Freigabe
* Tests rufen nie die echte API auf. Der erste Live Lauf macht der Nutzer mit
  seinem eigenen Key

## Kosten

Grobe Schaetzung je Lauf bei rund 12k Eingabe und 5k bis 15k Ausgabe inklusive
Thinking: 0,15 bis 0,35 $ (Opus 5.5, $4 Eingabe, $20 Ausgabe je MTok, Stand
06.10.2026). Angezeigt wird der echte Betrag aus `usage`.

## Acceptance criteria

* [ ] Ohne API Key oder ohne vollstaendige Ziele ist der Knopf deaktiviert, der
      Grund steht als Zahlenzeile, die Seite funktioniert sonst unveraendert
* [ ] Das SDK wird erst beim ersten Knopfdruck geladen, der Haupt Bundle waechst
      um weniger als 5 kB gzip gegen `main`
* [ ] Jeder Vorschlag besteht `validatePlan` (Gerichte, Rotation, Prep,
      Einkaufseintraege) oder wird mit Fundliste verworfen
* [ ] Jeder Tag eines uebernehmbaren Vorschlags liegt bei Ziel kcal ±40, Fett
      Ziel ±10 g und mindestens beim Proteinziel, alle Ziele aus dem Sheet
* [ ] Ausschluesse tauchen in keinem Vorschlag auf: sie fehlen im `enum`, und
      die Pruefung verwirft trotzdem jeden Treffer
* [ ] API Fehler, Ablehnung, Abbruch durch `max_tokens` und Zeitueberschreitung
      erscheinen als Status mit Code oder Kategorie, nie als stiller Abbruch
* [ ] Kosten je Lauf werden aus `usage` berechnet und mit Tokenzahlen angezeigt
* [ ] Uebernahme leert Overrides und Abhakstatus, Einkaufsliste und Prep
      Checkliste folgen dem aktiven Plan, der Knopf zurueck zum Seed stellt den
      Ausgangszustand her
* [ ] Export liefert drei Dateien, die gegen die bestehenden Tests als Seed
      Daten bestehen wuerden
* [ ] Die gebaute Seite hat eine CSP mit `connect-src` nur fuer `'self'`,
      `sheets.googleapis.com` und `api.anthropic.com`. Netzwerkpruefung zeigt den
      Key nur in Anfragen an `api.anthropic.com`
* [ ] Texte aus der Antwort gehen nur per `textContent` ins DOM
* [ ] Reiter Plan funktioniert mit Vorschlag bei 375 px ohne waagerechten
      Seitenlauf
* [ ] `npm run check` und Build sauber, die 228 bestehenden Tests bleiben gruen

## Implementation plan

Phase 9.0 ADR 0004 "Anthropic API direkt aus dem Browser" (Key im localStorage,
CSP, Ausgabelimit, Alternativen Proxy und Actions verworfen). Branch anlegen,
SDK als Abhaengigkeit.

Phase 9.1 Reine Funktionen mit Tests: Schema Bau aus `foods.json` und
Ausschluessen, Prompt Bau, Parsen der Antwort in `PlanData`, Tagespruefung mit
Toleranzen aus `src/config/`, Kostenrechnung aus `usage`, Parsen und
Serialisieren von Ausschluessen und aktivem Plan. Synthetische Plaene mit
bekanntem Ergebnis (knapp drin, knapp draussen, Ausschluss enthalten, Prep
verweist ins Leere).

Phase 9.2 Planquelle: Reiter Plan und Einkauf lesen den aktiven Plan statt der
Konstante `PLAN`. Uebernahme, Zurueck zum Seed, Leeren der Overrides. Bestehende
Tests bleiben unveraendert gruen.

Phase 9.3 API Aufruf: dynamischer Import des SDK, Streaming, Fallback,
Fehlerabbildung auf Status, Tokenzaehler waehrend des Laufs. SDK in Tests
gemockt.

Phase 9.4 Oberflaeche und Auslieferung: Eingabe Key im Konfigurationsdialog,
Ausschlussauswahl, Wunschfeld, Knopf, Vorschau neben dem aktiven Plan,
Uebernahme, Export, CSP im Build, Pruefung bei 375 px und im Netzwerk. Erster
Live Lauf durch den Nutzer, dann Merge und Retro.

## Risiken

* Jeder Skriptfehler auf der Seite, der fremden Code ausfuehrt, kann den
  Schluessel lesen. Gegenmittel: eigener Workspace mit Ausgabelimit, CSP ohne
  fremde Skriptquellen, weiter `textContent` statt `innerHTML`
* Kombinatorik unter harten Toleranzen: das Modell kann wiederholt knapp
  reissen. Jeder verworfene Lauf kostet. Wird nach den ersten Live Laeufen
  bewertet, nicht vorher automatisch wiederholt
* Die Planquelle in 9.2 greift in Phase 8 Code ein. Abgesichert durch die
  bestehenden 228 Tests

## Entscheidungen (25.10.2026)

* Das Modell kombiniert nur aus `foods.json`. Neue Zutaten erscheinen als
  Wunschliste, Naehrwerte traegt der Nutzer von der Packung nach
* Generator liefert Prep mit
* Modell `claude-opus-5-5`, Effort `high`
* API Key im localStorage, eigener Workspace mit Ausgabelimit
* Ausschlussliste im localStorage je Geraet
* Bibliothek `@anthropic-ai/sdk`, lazy geladen
* Toleranzen kcal ±40, Protein ≥ Ziel, Fett ±10 g
* Uebernahme leert Overrides und Abhakstatus, Seed wiederherstellbar
* Spec freigegeben inklusive Branch `plan-generator`, ID Praefix `g`, Riegel
  Schalter bei Vorschlag ausgeblendet, CSP nur im Build mit
  `style-src 'unsafe-inline'`, ADR 0004 als Phase 9.0, Bundle Grenze 5 kB
* Bundle Grenze gemessen gzip gegen `main` (Nutzerentscheidung 25.10.2026)

## Open questions

* Keine
