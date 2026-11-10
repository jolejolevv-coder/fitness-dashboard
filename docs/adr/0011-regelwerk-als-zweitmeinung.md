# ADR 0011: Regelwerk als Zweitmeinung, Parameter in einer Konfigurationsdatei

Status: angenommen (10.11.2026). Spec: `specs/features/coach.md`.

## Kontext

Mission und Roadmap schlossen Empfehlungen bisher aus (`Coaching zeigt
Beobachtungen, keine Anweisungen`). Der Nutzer will ab Phase 21 konkrete Zahlen
als Zweitmeinung neben der Vorgabe seines Trainers, abgeleitet aus Regeln, die
aus Lehrvideos stammen. `CLAUDE.md` verbietet Schwellen als Literal im
Berechnungscode und Erklaertexte in der Oberflaeche.

## Entscheidung 1: deterministisches Regelwerk, kein LLM

Reine Funktionen unter `src/coach/`, jede Regel mit Kennung, Mindestdatenlage
und Test.

* Gewinn: jede Zahl ist nachrechenbar, keine Kosten, kein Schluessel, laeuft ohne Netz
* Kosten: starr. Jede neue Quelle kostet eine Katalogaenderung und einen Deploy

Verworfen: Chat ueber die Anthropic API (ADR 0004). Nicht reproduzierbar, und
eine Zahl, mit der man einem Trainer widerspricht, darf nicht von der
Formulierung der Frage abhaengen.

## Entscheidung 2: Zweitmeinung als benannte Ausnahme

Die Entscheidung bleibt beim Trainer. Der Bereich `Zweitmeinung` zeigt je Zeile
eigene Zahl, Vorgabe, Differenz, Datenbasis und Regelkennung. Die bestehenden
Beobachtungen bleiben unveraendert. Herleitung steht in `docs/coach-regeln.md`,
nicht in der Oberflaeche, damit die Regel gegen Erklaertexte weiter gilt.

## Entscheidung 3: Parameter in `src/config/coachRules.ts`

Schwellen und Faktoren der Regeln stehen als benannte Konstanten an einer
Stelle, der Berechnungscode enthaelt kein Literal. Persoenliche Zielwerte
kommen weiter aus dem Sheet.

* Gewinn: versioniert, im Review sichtbar, durch Tests abgesichert
* Kosten: Aenderung nur ueber Deploy, der Trainer sieht die Parameter nicht

Verworfen: Tab `CoachRules` im Gym Logbuch. Ohne Deploy aenderbar, aber ein
Tippfehler im Sheet wuerde still jede Zahl verschieben, und die Tests koennten
die Werte nicht kennen.

## Entscheidung 4: Koerperdaten ueber einen von Hand gepflegten Tab `Body`

Tab im Gym Logbuch mit `date`, `bodyfat_pct`, `waist_cm`, `note`, nur lesend.

* Gewinn: kein vierter Schreibweg
* Kosten: Handarbeit, Werte koennen veralten. Dagegen steht die Hoechstdauer `BODY_MAX_AGE_DAYS`

## Folgen

Das Transkript wird nicht committet, nur eigene Regeln mit Quellenangabe.
Fotos bleiben ausserhalb der App.
