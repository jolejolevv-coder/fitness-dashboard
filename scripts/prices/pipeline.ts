import { itemMatches, pricePerKg, toOffer } from './match.ts';
import { parseQuantity } from './quantity.ts';
import type {
  Offer,
  PricesFile,
  RawOffer,
  RegularPrice,
  RegularPricesFile,
  ShoppingItem,
} from './types.ts';

/**
 * Reine Zusammenfuehrung: Rohangebote, Artikelliste und alter Stand rein, neuer
 * Stand raus. Kein Netzwerk, keine Dateien, damit alles ohne Mocks testbar ist.
 */

export const REGULAR_SOURCE = 'muskelmarkt';

function compareNullableAscending(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareOffers(a: Offer, b: Offer): number {
  return (
    a.food_id.localeCompare(b.food_id) ||
    a.store.localeCompare(b.store) ||
    compareNullableAscending(a.price_per_kg, b.price_per_kg) ||
    a.price_eur - b.price_eur ||
    a.product.localeCompare(b.product)
  );
}

/** Ordnet alle Rohangebote den Artikeln zu. Ein Angebot kann mehreren Artikeln passen. */
export function matchOffers(raws: RawOffer[], items: ShoppingItem[]): Offer[] {
  const offers: Offer[] = [];
  for (const raw of raws) {
    const quantity = parseQuantity(raw.product);
    for (const item of items) {
      if (itemMatches(item, raw.product)) offers.push(toOffer(item, raw, quantity));
    }
  }
  return offers.sort(compareOffers);
}

/** Dateikopf: frueheste Gueltigkeit und spaeteste Ende aller Treffer. */
export function buildPricesFile(offers: Offer[], fetchedAt: string): PricesFile {
  // Verglichen wird ueber Date, weil der Offset zwischen Sommer und Winterzeit wechseln kann.
  const times = (pick: (o: Offer) => string) => offers.map((o) => ({ iso: pick(o), ms: Date.parse(pick(o)) }));
  const starts = times((o) => o.valid_from).sort((a, b) => a.ms - b.ms);
  const ends = times((o) => o.valid_to).sort((a, b) => b.ms - a.ms);
  const first = starts[0];
  const last = ends[0];
  if (!first || !last) throw new Error('Keine Angebote fuer den Dateikopf');
  return { fetched_at: fetchedAt, valid_from: first.iso, valid_to: last.iso, offers };
}

/** Besserer Kandidat fuer den Dauerpreis: kleinerer Grundpreis, sonst kleinerer Preis. */
function isBetterRegular(a: RegularPrice, b: RegularPrice): boolean {
  if (a.price_per_kg !== null && b.price_per_kg !== null) return a.price_per_kg < b.price_per_kg;
  if (a.price_per_kg !== null) return true;
  if (b.price_per_kg !== null) return false;
  return a.regular_price_eur < b.regular_price_eur;
}

/** Normalpreise dieses Laufs, je Artikel und Markt ein Kandidat. */
export function collectRegularPrices(offers: Offer[], seenAt: string): RegularPrice[] {
  const best = new Map<string, RegularPrice>();
  for (const o of offers) {
    if (o.regular_price_eur === null) continue;
    const candidate: RegularPrice = {
      food_id: o.food_id,
      store: o.store,
      regular_price_eur: o.regular_price_eur,
      size_g: o.size_g,
      price_per_kg: pricePerKg(o.regular_price_eur, o.size_g),
      seen_at: seenAt,
      source: REGULAR_SOURCE,
    };
    const key = `${o.food_id}|${o.store}`;
    const current = best.get(key);
    if (!current || isBetterRegular(candidate, current)) best.set(key, candidate);
  }
  return [...best.values()];
}

/**
 * Fuehrt neue Normalpreise in den Bestand ein (ADR 0003). Ein neuer Wert
 * ueberschreibt nur, wenn sein Datum juenger ist. Gleiches Datum laesst den
 * Bestand stehen, so aendert ein zweiter Lauf am selben Tag nichts.
 */
export function mergeRegularPrices(
  existing: RegularPricesFile,
  candidates: RegularPrice[],
): RegularPricesFile {
  const byKey = new Map<string, RegularPrice>();
  for (const e of existing.entries) byKey.set(`${e.food_id}|${e.store}`, e);
  for (const c of candidates) {
    const key = `${c.food_id}|${c.store}`;
    const old = byKey.get(key);
    if (!old || c.seen_at > old.seen_at) byKey.set(key, c);
  }
  const entries = [...byKey.values()].sort(
    (a, b) => a.food_id.localeCompare(b.food_id) || a.store.localeCompare(b.store),
  );
  return { entries };
}

/** Gleicher Inhalt, ohne den Abrufzeitpunkt. Verhindert Commits ohne Neuigkeit. */
export function samePrices(a: PricesFile | null, b: PricesFile): boolean {
  if (!a) return false;
  return JSON.stringify({ ...a, fetched_at: '' }) === JSON.stringify({ ...b, fetched_at: '' });
}
