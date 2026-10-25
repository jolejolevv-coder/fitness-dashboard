# ADR 0004: Anthropic API direkt aus dem Browser

Status: angenommen (25.10.2026), Variante A. Die tragenden Entscheidungen hat
der Nutzer mit der Spec `specs/features/plan-generator.md` getroffen, diese ADR
haelt Begruendung und Alternativen fest.

## Kontext

Phase 9 soll auf Knopfdruck einen Wochenplan ueber ein Claude Modell erzeugen.
Die Seite ist statisch auf GitHub Pages, ohne Backend (ADR 0001), das Repo ist
oeffentlich. Es gibt eine Person als Nutzer. Bezahlt wird aus dem API Guthaben
des Nutzers. Die Eingaben enthalten die Tagesziele aus dem privaten Sheet, die
Antwort ist ein Plan, der erst nach Pruefung und Klick aktiv wird.

Die API erlaubt Aufrufe aus dem Browser, wenn der Header
`anthropic-dangerous-direct-browser-access: true` gesetzt ist. Das offizielle
TypeScript SDK setzt ihn mit der Option `dangerouslyAllowBrowser: true`. Der
Name ist eine Warnung: jeder, der den Seitencode kontrolliert, kann den
Schluessel lesen.

## Kandidaten

### A: Direkt aus dem Browser, Key im localStorage

* Ablauf: Nutzer traegt einen eigenen Key einmal im Konfigurationsdialog ein,
  der Browser ruft `api.anthropic.com` direkt
* Sicherheit: der Key liegt im localStorage wie schon der Google API Key.
  Lesbar fuer jedes Skript, das auf der Seite laeuft. Die Seite laedt keine
  fremden Skripte, Inhalte aus Sheet und Modell gehen nur per `textContent`
  ins DOM. Eine CSP mit `script-src 'self'` und `connect-src` nur fuer
  `'self'`, `sheets.googleapis.com` und `api.anthropic.com` begrenzt, wohin ein
  eingeschleustes Skript den Key schicken koennte. Ein eigener Workspace mit
  monatlichem Ausgabelimit begrenzt den Schaden, falls er doch abfliesst
* Aufwand: gering, kein neuer Dienst
* Kosten: nur die Tokens

### B: Eigener Proxy (Cloudflare Worker oder Azure Function)

* Ablauf: der Browser ruft den Proxy, der Proxy haelt den Key als Geheimnis und
  ruft die API
* Sicherheit: der Key verlaesst nie den Server. Dafuer braucht der Proxy eine
  eigene Anmeldung, sonst kann ihn jeder mit der URL auf Kosten des Nutzers
  aufrufen. Das verschiebt das Geheimnis nur: der Browser haelt dann ein
  Proxy Token statt eines API Keys
* Aufwand: mittel. Ein Dienst mehr mit Deployment, Logging, Laufzeitgrenzen
  (Streaming ueber mehrere Minuten) und Pflege. Widerspricht "kein Backend"
* Kosten: im Freikontingent meist 0 Euro, aber ein weiteres Konto

### C: GitHub Actions mit `workflow_dispatch`

* Ablauf: ein Knopf loest einen Workflow aus, der Key liegt als Actions Secret,
  das Ergebnis wird committet
* Sicherheit: Key sicher verwahrt. Aber der Workflow braucht die Tagesziele aus
  dem Sheet, also auch den Google Key als Secret, und das Ergebnis landet im
  oeffentlichen Repo, bevor der Nutzer es geprueft hat. Den Workflow ausloesen
  braucht im Browser ein GitHub Token mit Schreibrecht, ein staerkeres
  Geheimnis als der API Key
* Aufwand: mittel, Rueckmeldung erst nach Minuten

### D: Kein Aufruf, Claude Chat von Hand

* Ablauf: Prompt und Daten kopieren, Antwort als JSON zurueck einfuegen
* Sicherheit: kein Key auf der Seite
* Aufwand: fuer den Nutzer jedes Mal, Pruefung und Schema muesste er selbst
  sicherstellen
* Urteil: Status quo, genau das soll Phase 9 abloesen

## Entscheidung

A. Aufruf direkt aus dem Browser ueber `@anthropic-ai/sdk` mit
`dangerouslyAllowBrowser: true`, per dynamischem Import erst beim Knopfdruck
geladen. Key im localStorage unter `fitness_anthropic_v1`, getrennt von den
Google Zugangsdaten. Eigener Workspace mit Ausgabelimit. CSP im Build.

Tradeoff: die bequemste und einfachste Variante, aber der Key ist so sicher
wie der Seitencode. Ein Skriptfehler, der fremden Code ausfuehrt, kann ihn
lesen, und die CSP erlaubt `api.anthropic.com` als Ziel, ein gestohlener Key
liesse sich also dorthin missbrauchen. Das Ausgabelimit ist deshalb Pflicht,
nicht Kuer. B waere sicherer, kostet aber einen Dienst und loest das
Geheimnisproblem fuer eine Person nicht wirklich. C traegt ungepruefte Plaene
ins oeffentliche Repo und braucht ein GitHub Token im Browser.

## Verworfen

* B Proxy: Wiedervorlage, falls die Seite je mehr als einen Nutzer bekommt
* C Actions: falscher Ort fuer eine interaktive, private Anfrage
* D Handarbeit: bleibt als Rueckfall, wenn kein Key eingetragen ist

## Folgen

* Neue Abhaengigkeit `@anthropic-ai/sdk`, nur im nachgeladenen Teil des Bundles
* Erste CSP der Seite, als Meta Tag im Build. GitHub Pages kann keine Header
  setzen, `frame-ancestors` ist per Meta Tag nicht moeglich
* Inline Styles in `index.html` brauchen vorerst `style-src 'unsafe-inline'`
* Die Tagesziele aus dem Sheet gehen an Anthropic. Tageswerte, Gewicht und
  Trainingsdaten nicht
* Vor dem ersten Live Lauf legt der Nutzer den Workspace mit Ausgabelimit an

## WAF

* Reliability: ohne Key oder bei API Ausfall bleibt die Seite unveraendert, der
  Knopf zeigt Status statt still abzubrechen. Der aktive Plan liegt lokal und
  braucht die API nicht
* Security: Key nur im localStorage, nie im Repo. CSP begrenzt Skriptquellen
  und Ziele. Ausgabelimit begrenzt den Schaden. Modellausgabe nur per
  `textContent` und erst nach Pruefung aktiv
* Cost: geschaetzt 0,15 bis 0,35 $ je Lauf (Opus 5.5, Effort high), Anzeige je
  Lauf aus `usage`, Obergrenze durch das Workspace Limit
