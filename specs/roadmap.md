# Roadmap

Vollstaendige Geschichte, alte Phasen und Retros: docs/historie.md (nur bei Bedarf lesen).

## Stand (29.07.2026)

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
* Phase 8 Ernaehrung und Einkauf (Reiter Plan und Einkauf, Wuerzen und Soßen, Preis Pipeline): 8.0 Recherche erledigt 25.10.2026: Selektoren in `specs/features/muskelmarkt-parser.md`, ADR 0003 Dauerpreise angenommen 25.10.2026 (Normalpreis aus Muskelmarkt sammeln plus handgepflegte Startwerte). abgeschlossen und live seit 25.10.2026 (228 Tests), erster Preislauf erfolgreich, Cron aktiv. Spec `specs/features/nutrition-shopping.md`, Quelle `docs/HANDOFF.md`, ADR 0002 angenommen
* Phase 9 Plangenerator ueber die Anthropic API: Spec `specs/features/plan-generator.md` freigegeben 25.10.2026 (Opus 5.5 Effort high, Key im localStorage, Prep vom Generator, SDK lazy). 9.0 erledigt 25.10.2026: ADR 0004 angenommen, Branch `plan-generator` im Worktree `../fitness-dashboard-plan-generator`, `@anthropic-ai/sdk` 1.3.0 exakt gepinnt. Naechster Schritt 9.1

## Naechste Schritte

Phase 7 erst sinnvoll, wenn `Mesocycle 2` echte Ist Daten traegt (ab Mitte August 2026). Dann: automatische Erkennung aller `Mesocycle N` Tabs, Umschalter zwischen Bloecken, Verlauf je Uebung ueber Bloecke. Die Zusammenfuehrung von Uebungsnamen wird an echten Daten entwickelt, nicht an ausgedachten. Vorher Spec in `specs/features/` schreiben und Freigabe einholen.

Nach Phase 6 nachzuholen: Lighthouse Messung (braucht eine erreichbare Instanz mit echten Daten).

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

## Neueste Retro (Phase 8)

1. Gut: Die Recherche vor dem Code (ein Abruf, Belege fuer jeden Selektor) hat den Parser ohne Raten moeglich gemacht. Rechenkern und Pipeline liefen parallel, weil die Schnittstelle `shopping_items.json` vorher festgelegt war.
2. Falsche Annahme: "Soßen kosten hoechstens rund 20 kcal" stimmte fuer den Sonntag nicht, zwei Soßen an einem Tag rissen das Band. Ebenso war die Packungsrundung zu streng, das Plan Dokument hatte bewusst leicht abgerundet. Und der Handoff haette Klarname, Sheet ID und Filialadressen ins oeffentliche Repo getragen.
3. Besser spezifizieren: Toleranzen (Packungen, kcal Band) als Zahl in die Spec schreiben, nicht implizit aus einem Beispiel ableiten. Bei uebernommenen Dokumenten die Frage "wer kann das lesen" vor dem ersten Commit stellen.

## Retro Phase 6

1. Gut: Die Umstellung spaet zu machen war richtig. Zwischen Push und Umschalten der Pages Quelle lieferte die Seite kurz die Vite Quelldatei aus, ein Fehler, der in Phase 1 Wochen gekostet haette.
2. Falsche Annahme: Fixtures gegen echte Daten waeren unkritisch. Sie haetten 80 Tage Gesundheitsdaten in ein oeffentliches Repo getragen, aufgefallen erst unmittelbar vor dem Push.
3. Besser spezifizieren: Bei jeder committeten Datei die Frage "wer kann sie am Ende lesen" schon in der Spec stellen, nicht erst beim Deploy.
