import type { RegularPrice, StoreName } from '../../scripts/prices/types';
import { RECEIPT_PRICES_KEY, RECEIPT_SOURCE, WEIGHED_SIZE_G } from '../config/receipt';
import { bestRegularPrice, parseRegularPricesFile } from '../nutrition/prices';
import { readStorage, writeStorage } from '../nutrition/state';
import type { ShoppingItem } from '../nutrition/types';
import type { ReceiptLine } from './types';

/**
 * Vom Bon zu Dauerpreisen: Umrechnung, Zusammenfuehrung mit der Datei und
 * Ablage im localStorage. Reine Funktionen, nur `loadReceiptPrices` und
 * `saveReceiptPrices` beruehren den Speicher, und nur auf ausdruecklichen Aufruf.
 */

/** Was die Umrechnung vom Artikel braucht. */
export type ItemInfo = Pick<ShoppingItem, 'foodId' | 'unit' | 'packSizesG'>;

const CENTS = 100;
const GRAMS_PER_KG = 1000;

const round2 = (value: number): number => Math.round(value * CENTS) / CENTS;

/** Gewichtsware: der Bon druckt einen Kilopreis. */
export function isWeighed(line: ReceiptLine): boolean {
  return line.price_per_kg_eur !== null;
}

/**
 * Groesse als Vorschlag. Gewichtsware ist 1 kg, sonst gilt die gedruckte Groesse,
 * sonst bei Gramm Artikeln die erste Packungsgroesse, bei Stueckware `null`.
 */
export function suggestedSizeG(line: ReceiptLine, item: ItemInfo | null): number | null {
  if (isWeighed(line)) return WEIGHED_SIZE_G;
  if (line.size_g !== null) return line.size_g;
  if (item && item.unit === 'g') return item.packSizesG[0] ?? null;
  return null;
}

/**
 * Ein Kandidat aus einer Zeile. `line.size_g` ist hier die endgueltige Groesse,
 * also die gedruckte oder die in der Pruefansicht geaenderte. `null` ohne Artikel
 * oder ohne positiven Preis (Pfand, Rabattzeilen).
 */
export function lineToCandidate(line: ReceiptLine, store: StoreName, date: string): RegularPrice | null {
  if (line.food_id === null) return null;

  if (line.price_per_kg_eur !== null) {
    return {
      food_id: line.food_id,
      store,
      regular_price_eur: line.price_per_kg_eur,
      size_g: WEIGHED_SIZE_G,
      price_per_kg: line.price_per_kg_eur,
      seen_at: date,
      source: RECEIPT_SOURCE,
    };
  }
  if (line.price_eur <= 0) return null;

  const size = line.size_g !== null && line.size_g > 0 ? line.size_g : null;
  return {
    food_id: line.food_id,
    store,
    regular_price_eur: line.price_eur,
    size_g: size,
    price_per_kg: size === null ? null : round2((line.price_eur / size) * GRAMS_PER_KG),
    seen_at: date,
    source: RECEIPT_SOURCE,
  };
}

/**
 * Alle Kandidaten eines Bons, je Artikel genau einer. Kommt ein Artikel in
 * mehreren Zeilen vor, gilt der guenstigste (Kilopreis vor Packungspreis, wie
 * bei den Dauerpreisen). Die Zeilen tragen schon Zuordnung und Groesse, abgewaehlte
 * Zeilen gehoeren nicht hinein.
 */
export function toCandidates(lines: readonly ReceiptLine[], store: StoreName, date: string): RegularPrice[] {
  const all = lines.flatMap((line) => {
    const candidate = lineToCandidate(line, store, date);
    return candidate ? [candidate] : [];
  });
  const ids = [...new Set(all.map((entry) => entry.food_id))].sort();
  return ids.flatMap((id) => {
    const best = bestRegularPrice(all, id);
    return best ? [best] : [];
  });
}

// ── Zusammenfuehrung ─────────────────────────────────────────────────────────

const entryKey = (entry: RegularPrice): string => `${entry.food_id}|${entry.store}`;

/**
 * Je Artikel und Markt gewinnt der juengere `seen_at`. Bei gleichem Datum bleibt
 * der Wert aus `base`. Gleiche Regel wie `mergeRegularPrices` der Pipeline, ADR 0003.
 */
export function mergeRegularEntries(base: readonly RegularPrice[], incoming: readonly RegularPrice[]): RegularPrice[] {
  const byKey = new Map<string, RegularPrice>();
  for (const entry of base) byKey.set(entryKey(entry), entry);
  for (const entry of incoming) {
    const old = byKey.get(entryKey(entry));
    if (!old || entry.seen_at > old.seen_at) byKey.set(entryKey(entry), entry);
  }
  return [...byKey.values()].sort((a, b) => a.food_id.localeCompare(b.food_id) || a.store.localeCompare(b.store));
}

// ── Ablage und Export ────────────────────────────────────────────────────────

const JSON_INDENT = 2;

/** JSON im Format von `regular_prices.json`, so wie die Datei im Repo aussieht. */
export function exportRegularPricesJson(entries: readonly RegularPrice[]): string {
  const sorted = mergeRegularEntries([], entries);
  return `${JSON.stringify({ entries: sorted }, null, JSON_INDENT)}\n`;
}

export function parseStoredReceiptPrices(raw: string | null): RegularPrice[] {
  if (raw === null) return [];
  try {
    return parseRegularPricesFile(JSON.parse(raw))?.entries ?? [];
  } catch {
    return [];
  }
}

export function loadReceiptPrices(): RegularPrice[] {
  return parseStoredReceiptPrices(readStorage(RECEIPT_PRICES_KEY));
}

/**
 * Schreibt die Kandidaten in den Speicher, juengere Werte ersetzen aeltere. Der
 * einzige Schreibweg, die Pruefansicht ruft ihn erst nach dem Klick auf `Speichern`.
 */
export function saveReceiptPrices(candidates: readonly RegularPrice[]): RegularPrice[] {
  const merged = mergeRegularEntries(loadReceiptPrices(), candidates);
  writeStorage(RECEIPT_PRICES_KEY, merged.length > 0 ? JSON.stringify({ entries: merged }) : null);
  return merged;
}
