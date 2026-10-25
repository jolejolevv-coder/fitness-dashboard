import type { Quantity } from './types.ts';

/**
 * Mengen aus dem Produktnamen. Muster siehe `specs/features/muskelmarkt-parser.md`.
 * Reihenfolge zaehlt: Mehrfachpackung vor Spanne vor Einzelmenge.
 */

const UNIT = '(kg|g|ml|l)(?![a-zäöüß])';
const NUMBER = '(\\d+(?:[.,]\\d+)?)';
const MULTI = new RegExp(`(\\d+)\\s*x\\s*${NUMBER}\\s*${UNIT}`, 'i');
const RANGE = new RegExp(`(\\d+)\\s*/\\s*(\\d+)\\s*${UNIT}`, 'i');
const SINGLE = new RegExp(`${NUMBER}\\s*${UNIT}`, 'i');
const PIECES = /(\d+)\s*(?:Eier|Stück|Stk)(?![a-zäöüß])/i;

const GRAMS_PER_KG = 1000;
const ML_PER_L = 1000;

function toNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

/** Rechnet kg in g und l in ml um, damit nur zwei Basiseinheiten bleiben. */
function toBase(value: number, unit: string): Quantity {
  switch (unit.toLowerCase()) {
    case 'kg':
      return { amount: value * GRAMS_PER_KG, unit: 'g' };
    case 'g':
      return { amount: value, unit: 'g' };
    case 'l':
      return { amount: value * ML_PER_L, unit: 'ml' };
    default:
      return { amount: value, unit: 'ml' };
  }
}

/** Liefert die erste erkannte Menge oder `null`, wenn der Name keine nennt. */
export function parseQuantity(name: string): Quantity | null {
  const multi = MULTI.exec(name);
  if (multi) {
    const single = toBase(toNumber(multi[2]!), multi[3]!);
    return { amount: round(single.amount * Number(multi[1])), unit: single.unit };
  }
  // Spanne: der kleinste Wert zaehlt, damit der Grundpreis nicht geschoent wird.
  const range = RANGE.exec(name);
  if (range) {
    const low = Math.min(Number(range[1]), Number(range[2]));
    return toBase(low, range[3]!);
  }
  const single = SINGLE.exec(name);
  if (single) {
    const q = toBase(toNumber(single[1]!), single[2]!);
    return { amount: round(q.amount), unit: q.unit };
  }
  const pieces = PIECES.exec(name);
  if (pieces) return { amount: Number(pieces[1]), unit: 'piece' };
  return null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
