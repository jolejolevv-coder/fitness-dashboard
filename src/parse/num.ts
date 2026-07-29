/**
 * Wandelt eine Sheet Zelle in eine Zahl.
 *
 * Die Zellen sind uneinheitlich: `97,8` als Zahl mit Komma, `99.9` als Text mit
 * Punkt, `97,53 Kg` mit angehaengter Einheit, `?` und `#REF!` als Platzhalter.
 *
 * PHASE 2, zwei Aenderungen gegenueber der urspruenglichen Fassung:
 *
 * 1. Eine echte 0 bleibt erhalten. Vorher machte `parseFloat(...) || null`
 *    daraus null. Betraf im Bestand zwei Werte, je einen in Fruits & Vegetables
 *    und in Verdauung.
 * 2. Gelesen wird die Zahl am Anfang der Zelle, statt alle nicht numerischen
 *    Zeichen zu entfernen. Vorher wurde aus `55x2` die Zahl 552.
 */

/** Zahl am Anfang der Zelle, optional mit Vorzeichen und Dezimaltrenner. */
const LEADING_NUMBER = /^-?\d+(?:\.\d+)?/;

const PLACEHOLDERS = new Set(['', '-', '?', '#REF!', '#N/A', '#DIV/0!', '#VALUE!']);

export function num(v: string | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  const text = String(v).trim();
  if (PLACEHOLDERS.has(text)) return null;

  const match = LEADING_NUMBER.exec(text.replace(',', '.'));
  if (!match) return null;

  const value = parseFloat(match[0]);
  return Number.isFinite(value) ? value : null;
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
