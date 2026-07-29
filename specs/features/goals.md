## Goal

Alle Zielwerte des Dashboards stammen aus dem Sheet statt aus Literalen im
Quellcode, ohne dass am Sheet etwas geaendert werden muss.

## Woher

Der Vorgabeblock des Trainers steht bereits im `Daily Tracking` Tab, Zeilen 16
bis 23, und die angestrebte Abnahmerate steht in `H3` der Mesocycle Tabs. Die
urspruenglich geplante Loesung, einen eigenen `Goals` Tab anzulegen, entfaellt
damit, ebenso die Zwischenloesung ueber den Konfigurationsdialog. Beide waren
Notloesungen fuer ein Problem, das nicht existiert.

Details der Fundstellen in `specs/sheet-structure.md`.

## Zuordnung

| Zielwert | Quelle | Fallback |
| --- | --- | --- |
| protein_g | Daily Tracking, Average Zeile, Spalte C | 200 |
| carbs_g | Daily Tracking, Average Zeile, Spalte D | 225 |
| fat_g | Daily Tracking, Average Zeile, Spalte E | 60 |
| fiber_g | Daily Tracking, Average Zeile, Spalte F | 40 |
| calories_kcal | Daily Tracking, Average Zeile, Spalte G | 2300.5 |
| protein_feedings | Daily Tracking, Average Zeile, Spalte H | 4 |
| steps | Daily Tracking, Average Zeile, Spalte U | 10000 |
| rate_of_loss_pct | Mesocycle Tab, `H3`, Form `ROL - 0,25%` | leer |
| start_weight_kg | Daily Tracking, `M4` | leer |
| height_cm | Daily Tracking, `M7` | leer |

High Day und Low Day werden zusaetzlich gelesen, weil sie in kuenftigen Bloecken
auseinanderlaufen koennen. Solange sie identisch sind, wird nur der Average Wert
angezeigt. Weichen sie ab, werden die Referenzlinien nach Trainingstag und
Ruhetag getrennt gezogen.

## Sollrate

`rate_of_loss_pct` ist eine Prozentangabe auf das Koerpergewicht pro Woche, nicht
eine absolute Menge. Die Sollrate in kg pro Woche ergibt sich laufend aus dem
aktuellen geglaetteten Gewicht:

```
soll_kg_pro_woche = aktuelles_gewicht_kg * rate_of_loss_pct / 100
```

Bei 93 kg und 0.25 Prozent sind das 0.2325 kg pro Woche. Der Wert sinkt mit dem
Gewicht, das ist beabsichtigt und der Grund, warum der Trainer in Prozent vorgibt.

## Zielgewicht

Ein Zielgewicht steht nicht im Sheet und wird auch nicht erfunden. Die
Zielprojektion aus `specs/features/analytics.md` bleibt dunkel, solange keines
vorliegt. Es ist das einzige Feld, das im Konfigurationsdialog eingegeben werden
kann, und es ist optional.

## Verhalten bei Aenderungen am Sheet

Findet der Parser den Vorgabeblock nicht, weil der Trainer die Vorlage umbaut,
gilt der Fallback aus der Tabelle oben und im Kopfbereich erscheint ein Hinweis,
welche Werte nicht gelesen werden konnten. Es wird nie stillschweigend mit einem
Default gerechnet.

## Acceptance criteria

* [ ] Kein Zielwert als Literal in `src/` ausserhalb der Fallbacks in `parse/goals.ts`
* [ ] Vorgabeblock wird ueber die Beschriftungen `High Day`, `Low Day` und
      `Average` in Spalte B gefunden, nicht ueber feste Zeilennummern
* [ ] `ROL` wird aus dem Text der Form `ROL - 0,25%` geparst, Komma als
      Dezimaltrenner, Prozentzeichen optional
* [ ] Die Sollrate wird laufend aus dem aktuellen Gewicht berechnet, nicht einmalig
* [ ] Fehlende oder unlesbare Werte erzeugen einen sichtbaren Hinweis, keinen
      stillen Default
* [ ] Zielgewicht bleibt optional und im Konfigurationsdialog eingebbar
* [ ] Unit Tests gegen die echten Fixtures sowie gegen einen Tab ohne Vorgabeblock
