/**
 * Wandelt eine Sheet Zelle in eine Zahl.
 *
 * PHASE 1: woertlich uebernommen aus der urspruenglichen index.html, inklusive
 * zweier bekannter Fehler. Beide werden erst in Phase 2 behoben, damit die
 * Migration gegen unveraenderte Golden Values geprueft werden kann.
 *
 * Fehler 1: `parseFloat(...) || null` macht aus einer echten 0 ein null.
 * Fehler 2: das Entfernen aller nicht numerischen Zeichen macht aus der
 *           Lastnotation `55x2` die Zahl 552. Siehe specs/sheet-structure.md.
 */
export function num(v: string | undefined | null): number | null {
  if (!v || v === '#REF!' || v === '#N/A' || v === '-' || v === '') return null;
  return parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, '')) || null;
}

/** Datum im Format `d.m.yyyy`, wie es die Sheets API in dieser Tabelle liefert. */
export function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const p = s.trim().split('.');
  if (p.length !== 3) return null;
  const d = parseInt(p[0]!), m = parseInt(p[1]!), y = parseInt(p[2]!);
  if (isNaN(d) || isNaN(m) || isNaN(y) || y < 2020) return null;
  return new Date(y, m - 1, d);
}
