# Roadmap

Vollstaendige Geschichte, alte Phasen und Retros: docs/historie.md (nur bei Bedarf lesen).

## Stand (27.10.2026)

Phasen 0 bis 6 sowie Redesign, Polish und Oberflaeche nach Systemvorbild sind abgeschlossen. Die neue Fassung (Vite, TypeScript strict, Chart.js als npm Abhaengigkeit) ist auf `main` gemergt und live auf GitHub Pages (me.nahobinoco.com/fitness-dashboard/), Deploy ueber GitHub Actions. Das Dashboard liest ein privates Google Sheet clientseitig, nur lesend. Rueckfallweg: Tag `v0-legacy` plus Pages Quelle auf `Deploy from a branch`, zusammen unter fuenf Minuten.

Stand der Qualitaet: 88 Tests, Lint, Typpruefung und Build sauber. Geprueft bei 1920 bis 375 px auf allen sechs Reitern, kein waagerechter Seitenlauf. Branchhistorie vor dem ersten Push bereinigt: Fixtures, Golden Values, Rohexport, Klarname, Startgewicht und Koerpergroesse stehen in keinem Commit.

## Phasen

* Phase 0 Baseline und Hygiene: abgeschlossen (ein Punkt offen, siehe unten)
* Phase 1 Migration auf Vite und TypeScript, Golden Values: abgeschlossen
* Phase 2 Korrektheit (15 Punkte, Lastnotation, Duplikate, Rest, Notizen, Zeitraumfilter): abgeschlossen
* Phase 3 Zielwerte aus dem Sheet: abgeschlossen
* Phase 4 Analytik (TDEE, Trend, Projektion, Plateau, Streaks, Korrelationen, Tab Analyse): abgeschlossen
* Phase 5 Antwortblock, Performance, Zugaenglichkeit: abgeschlossen (Lighthouse nicht gemessen)
* Redesign, Polish, Oberflaeche nach Systemvorbild: abgeschlossen
* Phase 6 Umstellung und Abschluss (README, ADR, Actions, Merge, Live Pruefung): abgeschlossen
* Phase 7 Blockuebergreifende Trainingshistorie: nicht gestartet
* Phase 8 Ernaehrung und Einkauf: live seit 25.10.2026, Cron aktiv. Spec `specs/features/nutrition-shopping.md`, ADR 0002 und 0003
* Phase 9 Plangenerator ueber die Anthropic API: Spec `specs/features/plan-generator.md`, ADR 0004. Gemergt und live seit 25.10.2026. Offen beim Nutzer: erster Live Lauf mit eigenem Key, Netzwerkpruefung, dann Retro. Bundle Grenze gzip gegen `main`
* Phase 10 Daily Import (Health, Shortcut, Apps Script fuellt leere Zellen in `Daily Tracking`): Spec `specs/features/daily-import.md` und ADR 0005 freigegeben 25.10.2026. 10.0 erledigt, 10.1 Kernlogik auf Branch `claude/daily-import-36c9f1`, nicht gemergt. Naechster Schritt 10.2 `doPost`
* Phase 11 Kochansicht: live seit 26.10.2026, Handytest bestanden. Einzelheiten in docs/historie.md
* Phase 12 Mobile App (PWA): live seit 27.10.2026. Offen beim Nutzer: iPhone Test. Einzelheiten in docs/historie.md
* Phase 13 Heute verdichtet und Training eintragen (ADR 0007): live auf main. Offen: Studio Test des Nutzers, Retro. Einzelheiten in docs/historie.md
* Phase 14 Kassenbon einlesen: Spec `specs/features/receipt-scan.md` freigegeben 27.10.2026 (Sonnet aus dem Browser, Bonpreise im localStorage, Knopf in `Einkauf`). 14.1 bis 14.3 gebaut, 505 Tests, naechster Schritt 14.4 Live Test
* Phase 15 Gewicht und Schritte automatisch: Spec `specs/features/daily-weight-steps.md` freigegeben 27.10.2026. 15.1 und 15.2 erledigt (Script unveraendert, Anleitung `docs/daily-import-setup.md`), 15.3 beim Nutzer
* Phase 16 Zubereitung je Gericht: live 27.10.2026 (`ec4d51a`), Retro offen
* Phase 17 Rezepte statt Prep, Vorschlag ausblenden: Spec `specs/features/recipes-section.md`, live 27.10.2026, Retro offen
* Phase 18 Training aus dem Gym Logbuch: Spec `specs/features/training-from-logbook.md` und ADR 0008 freigegeben 05.11.2026. Daily weiter aus dem alten Sheet, Training aus Tab `TrainingSets` der Logbuch Tabelle. 18.0 erledigt, 18.1 bis 18.3 gebaut 05.11.2026 auf Branch `claude/training-from-logbook` (571 Tests, Haupt Chunk 41,61 kB gzip), live auf main seit 05.11.2026, Tabelle per Link lesbar. Offen beim Nutzer: Sheet ID eintragen, Pruefung nach der ersten geloggten Einheit, Retro

## Naechste Schritte

Phase 7 erst sinnvoll, wenn `Mesocycle 2` echte Ist Daten traegt (ab Mitte August 2026). Dann: automatische Erkennung aller `Mesocycle N` Tabs, Umschalter zwischen Bloecken, Verlauf je Uebung ueber Bloecke. Die Zusammenfuehrung von Uebungsnamen wird an echten Daten entwickelt, nicht an ausgedachten. Vorher Spec in `specs/features/` schreiben und Freigabe einholen.

Lighthouse aus Phase 6 nachgeholt am 27.10.2026, mobil je 100.

## Offen beim Nutzer

* Google API Key in der Cloud Console auf HTTP Referrer `me.nahobinoco.com/*` und auf die Sheets API beschraenken. Nur der Nutzer kann das erledigen.
* Zielgewicht fuer die Projektion. Einziger fehlender Wert, steht nirgends im Sheet. Eingabe optional im Konfigurationsdialog.

## Entscheidungen und Festlegungen

* Lastnotation `55x2` bedeutet 55 kg je Seite, also 110 kg gesamt. Gerechnet wird durchgehend mit der Gesamtlast. Die uneinheitliche Erfassung im Sheet ist bekannt und wird nicht bereinigt, der Parser muss damit umgehen.
* Gesamtverlust zeigt erste gegen letzte Waegung (99.9 auf 89.7 kg), geglaettet steht nur als Detail in der Unterzeile. Rate, Plateau und Projektion rechnen geglaettet. Zahlen, die dem Nutzer gehoeren, nie ohne Rueckfrage ersetzen, im Zweifel beides zeigen.
* Die Analytik rechnet immer ueber den gesamten Zeitraum, nie ueber die Zeitraumknoepfe.
* Zwei feste Spalten im Diagrammraster, kein automatisches Mehrspaltenraster.
* Coaching zeigt Beobachtungen, keine Anweisungen: die Vorgabe trifft der Trainer.
* Zurueckgestellt: Tabs `Zeitverlauf`, `Sizes`, `Supplements` werden nicht gelesen. Wochenexport als Textblock fuer den Chat mit dem Trainer. Getrennte Referenzlinien fuer High Day und Low Day, sobald sie in einem Block auseinanderlaufen.

## Harte Regeln

Die harten Regeln stehen in `CLAUDE.md` (kein Schreibzugriff aufs Sheet, keine Zielwerte als Literal, Spaltenzuordnung ueber Kopfzeilen, `textContent` statt `innerHTML`, keine Zugangsdaten im Repo, `testdata/` nie committen). Dazu aus der Roadmap: Bei jeder Datei, die committet wird, vorher fragen, wer sie am Ende lesen kann.

Retros ab Phase 11: `docs/historie.md`.
