# ADR 0009: Barlow selbst mitgeliefert statt Google Fonts

Status: angenommen (05.11.2026). Spec: `specs/features/logbook-look.md`.

## Kontext

Das Dashboard übernimmt den Look des Recomp Logbuchs. Das Logbuch lädt Barlow
und Barlow Condensed von Google Fonts. Das Dashboard ist eine PWA, die offline
laufen soll (ADR 0006), und hat eine strenge CSP mit `font-src 'self'`.

## Entscheidung: Schriftdateien im Repository

Die lateinischen woff2 Dateien von Barlow (400, 500, 600) und Barlow
Condensed (500, 600, 700) liegen unter `public/fonts/`, samt Lizenz (SIL Open
Font License 1.1). Quelle sind die npm Pakete `@fontsource/barlow` und
`@fontsource/barlow-condensed`, die Dateien werden einmal kopiert, keine
Abhängigkeit im `package.json`. Der Service Worker hält sie vor.

* Gewinn: Schrift auch offline, keine Anfrage an Google beim Öffnen, CSP
  bleibt unverändert
* Kosten: einmalig etwa 131 kB mehr beim ersten Laden (sechs woff2 Dateien, je etwa 22 kB; die Spec schaetzte 60 kB), Aktualisierungen der
  Schrift passieren nur von Hand

## Verworfen

* Google Fonts wie im Logbuch: CSP müsste `fonts.googleapis.com` und
  `fonts.gstatic.com` erlauben, offline fällt die Schrift auf Arial zurück
* npm Abhängigkeit mit Import im CSS: bringt alle Untermengen und Gewichte in
  den Build, mehr Gewicht als nötig

## Folgen

* Neue Gewichte oder Untermengen nur über einen bewussten Kopierschritt
* Rückweg: `@font-face` Regeln und `public/fonts/` löschen, Stack fällt auf
  Arial Narrow und System zurück
