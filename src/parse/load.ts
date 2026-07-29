/**
 * Liest die Lastspalte der Mesocycle Tabs.
 *
 * Die Spalte wird nicht einheitlich gefuehrt. Vorkommende Formen:
 *
 *   `80`      Gesamtlast in kg
 *   `55x2`    55 kg je Seite einer Maschine, also 110 kg gesamt
 *   `7,5x2`   Komma als Dezimaltrenner
 *   `40-50`   Bereichsangabe
 *   `9-9`     mutmasslicher Tippfehler
 *
 * Dass `AxB` als Gesamtlast `A * B` zu lesen ist, ergibt sich aus dem Sheet
 * selbst: bei `Katana Extensions Unilateral` stehen `7,5x2` und `15` als Werte
 * derselben Uebung nebeneinander, bei `Wirst High Cable Lateral Raise` ebenso.
 * Keine Uebung haelt eine Schreibweise ueber alle Wochen durch.
 */

export type LoadKind = 'plain' | 'per-side' | 'range' | 'empty' | 'unparsable';

export interface ParsedLoad {
  /** Gesamtlast in kg. Null, wenn die Zelle nichts Verwertbares enthaelt. */
  kg: number | null;
  kind: LoadKind;
  /** Unveraenderter Zellinhalt, fuer Anzeige und Fehlersuche. */
  raw: string;
  /** Gesetzt, wenn der Wert geraten werden musste und nicht eindeutig ist. */
  uncertain: boolean;
}

const EMPTY_VALUES = new Set(['', '-', '#REF!', '#N/A', 'n/a']);

const PLAIN = /^(\d+(?:[.,]\d+)?)$/;
const PER_SIDE = /^(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+)$/;
const RANGE = /^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/;

function toNumber(text: string): number {
  return parseFloat(text.replace(',', '.'));
}

export function parseLoad(raw: string | undefined | null): ParsedLoad {
  const text = (raw ?? '').trim();
  const base = { raw: text, uncertain: false };

  if (EMPTY_VALUES.has(text) || EMPTY_VALUES.has(text.toLowerCase())) {
    return { ...base, kg: null, kind: 'empty' };
  }

  const plain = PLAIN.exec(text);
  if (plain) return { ...base, kg: toNumber(plain[1]!), kind: 'plain' };

  const perSide = PER_SIDE.exec(text);
  if (perSide) {
    return { ...base, kg: toNumber(perSide[1]!) * Number(perSide[2]!), kind: 'per-side' };
  }

  const range = RANGE.exec(text);
  if (range) {
    const low = toNumber(range[1]!);
    const high = toNumber(range[2]!);
    // Mitte des Bereichs, aber als unsicher gekennzeichnet. Bei `9-9` ist ohnehin
    // ein Tippfehler wahrscheinlicher als ein echter Bereich.
    return { ...base, kg: (low + high) / 2, kind: 'range', uncertain: true };
  }

  return { ...base, kg: null, kind: 'unparsable' };
}

/**
 * Faktor, ab dem ein Wert gegenueber dem Median derselben Uebung als
 * unplausibel gilt. Faengt Tippfehler wie `9-9` statt `90`, ohne echte
 * Progression zu verwerfen.
 */
export const IMPLAUSIBLE_FACTOR = 3;

/** Median der gueltigen Lasten, Grundlage der Plausibilitaetspruefung. */
function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Markiert Ausreisser innerhalb einer Uebung.
 *
 * Ein Wert gilt als unplausibel, wenn er den Median um mehr als den Faktor
 * ueber oder unterschreitet. Solche Werte bleiben sichtbar, gehen aber nicht in
 * Progression und Volumen ein, damit ein Tippfehler nicht als Zuwachs von 900
 * Prozent in der Kennzahlleiste landet.
 */
export function markImplausible(loads: readonly ParsedLoad[]): boolean[] {
  const valid = loads.map((l) => l.kg).filter((kg): kg is number => kg !== null && kg > 0);
  const center = median(valid);
  if (center === null || valid.length < 3) return loads.map(() => false);

  return loads.map((load) => {
    if (load.kg === null || load.kg <= 0) return false;
    return load.kg > center * IMPLAUSIBLE_FACTOR || load.kg < center / IMPLAUSIBLE_FACTOR;
  });
}
