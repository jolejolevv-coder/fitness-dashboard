# Product

<!-- impeccable:product-schema 1 -->

Abgeleitet am 26.10.2026 aus den freigegebenen Dokumenten `specs/mission.md`,
`specs/features/mobile-app.md` und ADR 0006, ohne eigene Interviewrunde. Der
Nutzer bestaetigt oder korrigiert diese Fassung mit der Freigabe des Entwurfs
aus Phase 12.1.

## Platform

web

## Users

Eine Person, Body Recomposition im Cut, trackt taeglich Gewicht, Makros,
Schlaf, Stress, Energie, Verdauung und Schritte in einem Google Sheet, dazu
einen Mesozyklus mit Trainingsgewichten. Entscheidungen zu Kalorien und
Programmierung trifft ein Personal Trainer mit Schreibrechten am Sheet. Die
App wird vor allem am iPhone genutzt: Plan, Einkauf und Kochen in der Kueche,
die Wochenfrage unterwegs, gelegentlich am Desktop.

## Product Purpose

Kontrolle: erzeugt die Vorgabe des Trainers die Wirkung, die sie erzeugen soll.
Rechenschaft: haelt der Nutzer seinen Teil ein, bevor der Trainer es sagt.
Daneben Ernaehrungsplan, Einkaufsliste mit Angebotspreisen und eine
Kochansicht. Erfolg heisst: die Zahlen tragen ein Gespraech mit einem Fachmann.

## Positioning

Kennzahlen kennen ihre Mindestdatenlage und verweigern die Aussage darunter,
sichtbar als Zahlenzeile wie `Basis 11 von 14 Tagen`. Keine Empfehlungen, keine
Erklaertexte, nur Zahl und Datenbasis.

## Operating Context

Sheet als einzige Datenbank, App rein lesend. Einziger Schreibweg ist der Daily
Import (ADR 0005). Kueche: Handy auf der Arbeitsplatte, nasse Haende, Kochen im
Vollbild mit Timer und Wake Lock. Studio und unterwegs: kurzer Blick auf die
Wochenfrage, oft ohne Netz.

## Capabilities and Constraints

* Installierbare PWA, Start ohne Netz mit letzten Daten aus dem localStorage
* Vier Ziele: Heute, Verlauf, Training, Kueche. Ohne Sheet nur Kueche
* Vanilla TypeScript, kein Framework, Chart.js nachgeladen
* Sheet Inhalte nur per `textContent`, keine Zielwerte als Literal
* Oberflaeche Deutsch ohne Binde und Gedankenstriche
* Kein Klarname in der Oberflaeche, `noindex`

## Brand Commitments

Name `Body Recomp`. Ton sachlich, beobachtend, nie anordnend.

## Evidence on Hand

Lokale Fixtures `test/fixtures/` (nicht versioniert, enthalten echte Werte und
einen Klarnamen), `data/*.json` fuer Plan, Rezepte und Einkauf,
`public/data/prices.json` fuer Angebote.

## Product Principles

* Eine Zahl je Karte, darunter ihre Datenbasis
* Verweigern statt raten
* Beobachten statt anordnen
* Kueche zuerst: was am Herd gebraucht wird, braucht keinen zweiten Tipp

## Accessibility & Inclusion

Tippflaechen mindestens 44 px, Bedienung per Tastatur, `aria-current` fuer das
aktive Ziel, Lighthouse Accessibility mindestens 95.
