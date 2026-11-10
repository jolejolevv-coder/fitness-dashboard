# Roadmap

Vollstaendige Geschichte, alte Phasen und Retros: docs/historie.md (nur bei Bedarf lesen). Die Fassung vom 05.11.2026 mit allen Langtexten steht am Ende von docs/historie.md.

## Stand (06.11.2026)

Alle Arbeit liegt auf `main` (letzter Phasen Commit `4791cad`, Phase 20.5, danach `2fc90db` Doku). Die Branches `claude/logbook-eins-zu-eins`, `claude/logbook-in-dashboard`, `claude/logbook-look` und `claude/training-from-logbook` sind in `main` enthalten, kein offener Feature Branch. Die Fassung (Vite, TypeScript strict, Chart.js) ist live auf GitHub Pages (me.nahobinoco.com/fitness-dashboard/), Deploy ueber GitHub Actions. Lesen aus privatem Google Sheet clientseitig. Schreibwege laufen nur ueber Apps Script (ADR 0005, 0007, 0010). Rueckfallweg: Tag `v0-legacy` plus Pages Quelle auf `Deploy from a branch`.

## Phasen

* Phase 0 bis 6 Baseline, Vite Migration, Korrektheit, Zielwerte, Analytik, Redesign, Umstellung: abgeschlossen (Phase 0 mit einem offenen Punkt, siehe historie)
* Phase 7 Blockuebergreifende Trainingshistorie: nicht gestartet, wartet auf echte Daten in `Mesocycle 2`
* Phase 8 Ernaehrung und Einkauf: live seit 25.10.2026, Cron aktiv (ADR 0002, 0003)
* Phase 9 Plangenerator ueber die Anthropic API: live seit 25.10.2026 (ADR 0004). Offen beim Nutzer: erster Live Lauf mit eigenem Key, Netzwerkpruefung
* Phase 10 Daily Import: Spec `specs/features/daily-import.md`, ADR 0005. 10.0 erledigt, 10.1 und 10.2 (Kern, `doPost`) mit 13.2 und 13.3 in `main` gelandet (`3e80c01`, `eb2163c`). Offen: 10.3 Bereitstellung und 10.4 Shortcut durch den Nutzer, Open questions 3 bis 6, 8, 9 und 10 der Spec
* Phase 11 Kochansicht: live seit 26.10.2026
* Phase 12 Mobile App (PWA): live seit 27.10.2026. Offen: iPhone Test
* Phase 13 Heute verdichtet, Training eintragen (ADR 0007): live. Offen: Studio Test
* Phase 14 Kassenbon einlesen (`receipt-scan.md`): 14.1 bis 14.3 live (`256b58c`). Offen: Live Test mit echtem Bon und Key (14.4)
* Phase 15 Gewicht und Schritte automatisch: 15.1 und 15.2 live (`ae91803`). Offen: 15.3 Einrichtung beim Nutzer
* Phase 16 Zubereitung je Gericht: live 27.10.2026
* Phase 17 Rezepte statt Prep: live 27.10.2026
* Phase 18 Training aus dem Gym Logbuch (ADR 0008): live seit 05.11.2026. Offen: Sheet ID eintragen, Pruefung nach der ersten geloggten Einheit
* Phase 19 Look des Recomp Logbuchs (ADR 0009): live seit 05.11.2026
* Phase 20 Logbuch im Dashboard (ADR 0010): 20.0 bis 20.5 live auf `main` (`ec7f2c4`, `4791cad`). Offen: Zugang in den Einstellungen, ein echter Satz live
* Phase 21 Trainer als Zweitmeinung (ADR 0011, `specs/features/coach.md`): live seit 10.11.2026 (`4410c57`, `e44b652`). Dabei TDEE Schaetzer korrigiert (teilt durch die Tage zwischen den Randmitteln, Werte steigen bei Abnahme). Offen: Tab `Body` im Gym Logbuch, Pruefung mit echten Daten

## Retros

Vorhanden in docs/historie.md: Phase 6, 8, 11, 12. Offen (nicht geschrieben): Phase 9 und Phase 13 bis 21. Sie werden mit dem Nutzer aus echter Erfahrung geschrieben, nicht nachtraeglich ausgedacht. Phase 7, 10 erst nach Abschluss.
Offene Frage: Die Aufgabe nannte Phase 11 und 12 als fehlend, in historie.md stehen beide. Bitte bestaetigen, ob sie genuegen.

## Naechste Schritte

Phase 7 erst sinnvoll, wenn `Mesocycle 2` echte Ist Daten traegt. Vorher Spec in `specs/features/` und Freigabe. Sonst wartet alles auf den Nutzer (unten).

## Offen beim Nutzer

* Im Sheet `Daily Tracking` Zellen M29:N30 zusammenfuehrung aufheben und in N29 `Qualität` eintragen (Open question 10 in `specs/features/daily-import.md`, Commit `2fc90db`).
* Google API Key in der Cloud Console auf HTTP Referrer `me.nahobinoco.com/*` und auf die Sheets API beschraenken.
* Zielgewicht fuer die Projektion (optional im Konfigurationsdialog).
* Phase 20: Logbuch Script URL, Token und Sheet ID in den Einstellungen, ein echter Satz.
* Phase 10 und 15: Bereitstellung des Apps Scripts nach `apps-script/README.md`, Shortcut nach `docs/daily-import-setup.md`.
* Phase 14: Live Test des Kassenbons. Phase 12: iPhone Test. Phase 13: Studio Test.
* Phase 21: Tab `Body` im Gym Logbuch anlegen (`date`, `bodyfat_pct`, `waist_cm`, `note`), Open questions 4 und 6 der Spec.
* Retros wie oben.

## Entscheidungen und Festlegungen

* Lastnotation `55x2` bedeutet 55 kg je Seite, gerechnet wird mit der Gesamtlast. Uneinheitliche Erfassung im Sheet wird nicht bereinigt.
* Gesamtverlust zeigt erste gegen letzte Waegung, geglaettet nur als Detail. Zahlen des Nutzers nie ohne Rueckfrage ersetzen.
* Analytik rechnet ueber den gesamten Zeitraum, nie ueber die Zeitraumknoepfe.
* Zwei feste Spalten im Diagrammraster.
* Coaching zeigt Beobachtungen, keine Anweisungen. Ausnahme seit 10.11.2026: der Bereich `Zweitmeinung` zeigt gerechnete Zahlen neben der Vorgabe des Trainers (ADR 0011).
* Zurueckgestellt: Tabs `Zeitverlauf`, `Sizes`, `Supplements`, Wochenexport als Textblock, getrennte Referenzlinien fuer High Day und Low Day.

## Harte Regeln

Stehen in `CLAUDE.md`. Bei jeder Datei, die committet wird, vorher fragen, wer sie am Ende lesen kann.
