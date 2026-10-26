# Uebergabe Archiv 26.10.2026

Aus `docs/uebergabe.md` verschoben, als Phase 11.2 fertig war.

## Phase 9 Plangenerator

Spec `specs/features/plan-generator.md` am 25.10.2026 freigegeben. Phase 9.0
erledigt: ADR 0004 angenommen, `@anthropic-ai/sdk` 1.3.0 exakt gepinnt (Version
erst zwei Tage alt, Major 1.0 vom 21.10.2026, vor Updates Changelog lesen).

Gearbeitet wird im Worktree `/Users/jole/Downloads/fitness-dashboard-plan-generator`
auf Branch `plan-generator`, nicht im Projektordner. Sitzungen fuer Phase 9 dort
oeffnen. `test/fixtures/` und `test/golden/` sind lokal hineinkopiert, weil sie
nicht im Repo liegen.

Phasen 9.1 bis 9.3 erledigt (reine Funktionen in `src/generator/`, Planquelle
`src/ui/planSource.ts`, API Aufruf `src/generator/request.ts`). Details stehen
in `docs/historie.md` unter "Phase 9.1 bis 9.3".

Phase 9.4 umgesetzt (Stand 25.10.2026, 326 Tests, `npm run check` und Build
sauber). Auf Wunsch des Nutzers am 25.10.2026 vor dem Live Lauf nach `main`
gemergt und live (Commit `b436847`, Deploy gruen, CSP und Key Feld live). Neu:
* Konfigurationsdialog: Feld `input-anthropic-key`, gespeichert ueber
  `saveApiKey` beim Speichern, leer entfernt den Key
* Reiter Plan, vierte Ansicht `Vorschlag` (`src/ui/generator.ts`, eigener
  Chunk, erst beim Oeffnen geladen, `request.ts` und SDK erst beim Knopf):
  Ausschluesse als aufklappbare Liste `Ausschlüsse n von 49`, Wunschfeld, Knopf
  `Vorschlag erzeugen`, gesperrt mit Zahlenzeilen `API Key 0 von 1`,
  `Ziele 2 von 3`, `Lebensmittel 0 von 49`. Waehrend des Laufs `Abbrechen` und
  `Läuft 42 s, n Eingabe, m Ausgabe Tokens` (in place, ohne Neuzeichnen).
  Danach Statuszeile aus `statusLine`, Modell (mit `Fallback`), Kosten aus
  `usage` mit Preisstand, Fundliste, Tageswerte je Tag mit Zeile `Aktiv ...`
  des aktiven Plans darunter, Gerichte mit Tagen, Prep, Wunschliste.
  `Übernehmen` und `Export` nur bei bestandener Pruefung, Uebernahme ueber
  `adoptPlan`, danach Ansicht Woche
* `Export` auch in der Herkunftszeile des aktiven Plans. Drei Downloads
  `meals.json`, `rotation.json`, `prep.json` aus `src/generator/export.ts`,
  zeichengleich formatiert wie `data/` (Test gegen den Seed)
* `src/generator/input.ts`: `generateReadiness`, `buildGeneratorInput`,
  `currentOffers` (guenstigstes gueltiges Angebot mit Grundpreis)
* `src/config/csp.ts` und Plugin in `vite.config.ts`: CSP als `meta` nur im
  Build. `connect-src 'self' https://sheets.googleapis.com
  https://api.anthropic.com`, `script-src 'self'`, `style-src 'self'
  'unsafe-inline'`, `img-src 'self' data: blob:`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'none'`
* `roundedDayValues` aus `checkProposal` herausgezogen, auch fuer die Vorschau

Geprueft im Build (`vite preview`) bei 375 px mit lokalen Fixtures und einem im
Browser ersetzten `fetch` fuer `api.anthropic.com` (kein echter Aufruf): Lauf
mit Tokenzeile, verworfener und bestandener Vorschlag, Uebernahme, Einkauf
folgt, Ausschluss gespeichert, Verbindungsfehler als Status. Kein waagerechter
Seitenlauf im Reiter Plan, keine CSP Verstoesse in der Konsole. Chunks werden
erst beim Oeffnen der Ansicht bzw. beim Knopf geladen.

Bundle: Haupt Bundle 323,5 kB roh, 107,8 kB gzip. Gegen `main` +10,9 kB roh,
+3,7 kB gzip, davon 9.4 selbst +3,4 kB roh, +1,5 kB gzip (Rest aus 9.1 und 9.2,
Planquelle und Pruefung muessen beim Laden laufen). SDK 366 kB im eigenen
Chunk, `generator` 8,6 kB, `request` 7,0 kB. Die 5 kB Grenze gilt gzip gegen
`main` (Nutzerentscheidung 25.10.2026), damit eingehalten.

Bekannt: SDK 1.3.0 schickt den Key als `Authorization: Bearer`, nicht als
`x-api-key`. Bei der Netzwerkpruefung nach `authorization` suchen. Ein
Vorschlag lebt nur im Speicher, Neuladen verwirft ihn (Kosten sind dann weg).
Die Zeile `last-updated` im Kopf laeuft bei einer langen Fehlermeldung ueber
375 px hinaus (Bestand, nicht aus 9.4). Der Text im Konfigurationsdialog
"nie übertragen" stimmt fuer den Anthropic Key nicht mehr wortwoertlich.
`.claude/launch.json` (Konfiguration `preview-build`) liegt untracked.

Erster Live Lauf 25.10.2026: `Vorschlag geprueft`, 0,21 $, 6.267 Eingabe und
9.289 Ausgabe Tokens. Der Wunsch "vegetarisch" wurde ignoriert, weil der Prompt
Wuensche nur als Anregung fuehrte. Seitdem sind Wuensche im Prompt verbindlich
(`Wishes (binding)`, Regel gegen ausgeschlossene Lebensmittel). Garantiert
bleibt nur die Ausschlussliste, Freitext prueft niemand.

Naechster Schritt beim Nutzer (Live Lauf, danach Retro):
1. In der Anthropic Console eigenen Workspace mit monatlichem Ausgabelimit
   anlegen, darin einen Key erzeugen
2. Live Seite oeffnen, Key unter Einstellungen eintragen
3. Reiter Plan, Ansicht Vorschlag, `Vorschlag erzeugen`, Lauf abwarten
4. Netzwerkpruefung in den DevTools: Key nur in der Anfrage an
   `api.anthropic.com` (Kopfzeile `authorization`), an Google nur der Google Key
5. Danach Retro Phase 9 in `specs/roadmap.md`

