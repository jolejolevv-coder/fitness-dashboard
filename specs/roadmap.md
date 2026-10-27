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
* Phase 8 Ernaehrung und Einkauf: abgeschlossen und live seit 25.10.2026 (228 Tests), Cron aktiv. Spec `specs/features/nutrition-shopping.md`, ADR 0002 und 0003 angenommen, Selektoren in `specs/features/muskelmarkt-parser.md`
* Phase 9 Plangenerator ueber die Anthropic API: Spec `specs/features/plan-generator.md`, ADR 0004. Gemergt und live seit 25.10.2026. Offen beim Nutzer: erster Live Lauf mit eigenem Key, Netzwerkpruefung, dann Retro. Bundle Grenze gzip gegen `main`
* Phase 10 Daily Import (Health, Shortcut, Apps Script fuellt leere Zellen in `Daily Tracking`): Spec `specs/features/daily-import.md` und ADR 0005 freigegeben 25.10.2026. 10.0 erledigt, 10.1 Kernlogik auf Branch `claude/daily-import-36c9f1`, nicht gemergt. Naechster Schritt 10.2 `doPost`
* Phase 11 Kochansicht: Spec `specs/features/recipes.md` freigegeben 26.10.2026. Abgeschlossen und live seit 26.10.2026 (353 Tests, Chunk `cook` 4,1 kB gzip, Haupt Bundle +0,25 kB). Handytest in echter Prep Session bestanden: Ton, Vibration, Wake Lock, `data/recipes.json` ohne Korrektur (OptiGrill 210 °C, 800 W, Chili mit einem Halt). Nicht umgesetzt: Stueckangaben neben Gramm
* Phase 12 Mobile App (PWA, vier Ziele mit Navigation unten, mobile first): Spec `specs/features/mobile-app.md` und ADR 0006 freigegeben 26.10.2026 (PWA mit Service Worker ueber `vite-plugin-pwa`, rein lesend, eine Oberflaeche, Chart.js nachgeladen). Abgeschlossen und live seit 27.10.2026 (Merge `9baa8af`, 361 Tests, Haupt Chunk 35,82 kB, `sw.js` 6,78 kB gzip, Lighthouse mobil je 100). Offen beim Nutzer: iPhone Test (Installation, Statusleiste, Flugmodus, Kochansicht), Schritte in `docs/uebergabe.md`

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

## Retro Phase 12

1. Gut: Budget mit Messwerten aus 12.0, jeder Unterschritt pruefte dagegen. URL Regel als reine Funktion, Deploy im gebauten Stand simuliert.
2. Falsche Annahmen: `generateSW` haette `index.html` immer aus dem Cache geliefert, gegen ADR 0006. Ohne `viewport-fit=cover` waeren die Safe Area Regeln wirkungslos geblieben. Schemawechsel und iPhone Verhalten liessen sich im Browser Pane nicht pruefen.
3. Besser spezifizieren: Strategie des Service Workers je Dateiart schon in der Spec, und welche Kriterien nur auf dem Geraet pruefbar sind.

Retro Phase 11 und aeltere Retros: `docs/historie.md`.
