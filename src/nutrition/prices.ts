import type { Offer, PricesFile, RegularPrice, RegularPricesFile } from '../../scripts/prices/types';
import { PACK_SHORTFALL_TOLERANCE } from './shopping';
import { daysBetween } from './dates';

/**
 * Preislogik des Reiters Einkauf: reine Funktionen ohne DOM und ohne Netz.
 *
 * Grundsatz: Preise sind eine Zugabe. Fehlt eine Datei oder ist sie kaputt,
 * bleibt die Liste ohne Preise bestehen, es gibt kein Fehlerbild.
 */

/** Ab dieser Zahl Tage gilt ein Dauerpreis als alt und traegt einen Vermerk. */
export const REGULAR_PRICE_STALE_DAYS = 90;

/** Vermerk fuer Edeka. Das Angebot kann von regionalen Maerkten stammen. */
export const EDEKA_NOTE = 'regional';

const EDEKA_STORE = 'Edeka';

const EPSILON = 1e-9;

// ── Dateien lesen ────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isNullableNumber = (value: unknown): value is number | null => value === null || isFiniteNumber(value);
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

function asOffer(value: unknown): Offer | null {
  if (!isRecord(value)) return null;
  const v = value;
  if (
    !isString(v['food_id']) || !isString(v['store']) || !isString(v['product']) ||
    !isFiniteNumber(v['price_eur']) || !isString(v['valid_from']) || !isString(v['valid_to']) ||
    !isNullableNumber(v['size_g'] ?? null) || !isNullableNumber(v['regular_price_eur'] ?? null) ||
    !isNullableNumber(v['price_per_kg'] ?? null) || !isNullableString(v['valid_days'] ?? null) ||
    !isNullableString(v['condition'] ?? null)
  ) {
    return null;
  }
  // Das Datum wird per Zeichenposition gelesen, also muss das ISO Format stimmen.
  if (!/^\d{4}-\d{2}-\d{2}/.test(v['valid_from']) || !/^\d{4}-\d{2}-\d{2}/.test(v['valid_to'])) return null;
  return {
    food_id: v['food_id'],
    store: v['store'] as Offer['store'],
    product: v['product'],
    size_g: (v['size_g'] ?? null) as number | null,
    price_eur: v['price_eur'],
    regular_price_eur: (v['regular_price_eur'] ?? null) as number | null,
    price_per_kg: (v['price_per_kg'] ?? null) as number | null,
    valid_days: (v['valid_days'] ?? null) as string | null,
    valid_from: v['valid_from'],
    valid_to: v['valid_to'],
    condition: (v['condition'] ?? null) as string | null,
  };
}

/** `null` bei allem, was nicht wie eine `prices.json` aussieht. Einzelne kaputte Angebote entfallen. */
export function parsePricesFile(data: unknown): PricesFile | null {
  if (!isRecord(data) || !Array.isArray(data['offers']) || !isString(data['fetched_at'])) return null;
  const offers = data['offers'].map(asOffer).filter((o): o is Offer => o !== null);
  return {
    fetched_at: data['fetched_at'],
    valid_from: typeof data['valid_from'] === 'string' ? data['valid_from'] : '',
    valid_to: typeof data['valid_to'] === 'string' ? data['valid_to'] : '',
    offers,
  };
}

function asRegular(value: unknown): RegularPrice | null {
  if (!isRecord(value)) return null;
  const v = value;
  if (
    !isString(v['food_id']) || !isString(v['store']) || !isFiniteNumber(v['regular_price_eur']) ||
    !isString(v['seen_at']) || !/^\d{4}-\d{2}-\d{2}$/.test(v['seen_at']) ||
    !isNullableNumber(v['size_g'] ?? null) || !isNullableNumber(v['price_per_kg'] ?? null)
  ) {
    return null;
  }
  return {
    food_id: v['food_id'],
    store: v['store'] as RegularPrice['store'],
    regular_price_eur: v['regular_price_eur'],
    size_g: (v['size_g'] ?? null) as number | null,
    price_per_kg: (v['price_per_kg'] ?? null) as number | null,
    seen_at: v['seen_at'],
    source: typeof v['source'] === 'string' ? v['source'] : '',
  };
}

export function parseRegularPricesFile(data: unknown): RegularPricesFile | null {
  if (!isRecord(data) || !Array.isArray(data['entries'])) return null;
  return { entries: data['entries'].map(asRegular).filter((e): e is RegularPrice => e !== null) };
}

// ── Angebote ─────────────────────────────────────────────────────────────────

/** Kalendertag des Endes, `YYYY-MM-DD`. Die Zeit in der Datei traegt schon den Berliner Offset. */
function offerEndDay(offer: Offer): string {
  return offer.valid_to.slice(0, 10);
}

/** Ein Angebot zaehlt bis einschliesslich seines letzten Tages. Kommende Angebote zaehlen mit. */
export function isOfferCurrent(offer: Offer, today: string): boolean {
  return offerEndDay(offer) >= today;
}

/** Kleinerer Grundpreis gewinnt, ohne Grundpreis entscheidet der Packungspreis. Mit Grundpreis geht vor ohne. */
function compareByPrice(
  a: { price_per_kg: number | null; price: number },
  b: { price_per_kg: number | null; price: number },
): number {
  if (a.price_per_kg !== null && b.price_per_kg !== null && a.price_per_kg !== b.price_per_kg) {
    return a.price_per_kg - b.price_per_kg;
  }
  if (a.price_per_kg !== null && b.price_per_kg === null) return -1;
  if (a.price_per_kg === null && b.price_per_kg !== null) return 1;
  return a.price - b.price;
}

/** Das guenstigste noch gueltige Angebot eines Artikels, oder `null`. */
export function cheapestOffer(offers: readonly Offer[], foodId: string, today: string): Offer | null {
  let best: Offer | null = null;
  for (const offer of offers) {
    if (offer.food_id !== foodId || !isOfferCurrent(offer, today)) continue;
    if (!best || compareByPrice(
      { price_per_kg: offer.price_per_kg, price: offer.price_eur },
      { price_per_kg: best.price_per_kg, price: best.price_eur },
    ) < 0) {
      best = offer;
    }
  }
  return best;
}

/** Vermerke zum Angebot: Bedingung der Karte (App, Kundenkarte) und bei Edeka `regional`. */
export function offerNotes(offer: Offer): string[] {
  const notes: string[] = [];
  if (offer.condition && offer.condition.trim() !== '') notes.push(offer.condition.trim());
  if (offer.store === EDEKA_STORE) notes.push(EDEKA_NOTE);
  return notes;
}

/** Packungen dieses Angebots, die den Bedarf decken. `null`, wenn die Packungsgroesse fehlt. */
export function offerPacks(offer: Offer, neededG: number): number | null {
  if (offer.size_g === null || offer.size_g <= 0) return null;
  return Math.max(1, Math.ceil((neededG * (1 - PACK_SHORTFALL_TOLERANCE)) / offer.size_g - EPSILON));
}

/**
 * Ersparnis in Euro gegen den Normalpreis des Angebots selbst. `null`, wenn die
 * Seite keinen Normalpreis nennt oder die Packungsgroesse fehlt. Nie geschaetzt.
 */
export function offerSaving(offer: Offer, neededG: number): number | null {
  if (offer.regular_price_eur === null) return null;
  const packs = offerPacks(offer, neededG);
  if (packs === null) return null;
  return Math.max(0, offer.regular_price_eur - offer.price_eur) * packs;
}

// ── Dauerpreise ──────────────────────────────────────────────────────────────

/** Der guenstigste gesammelte Dauerpreis eines Artikels ueber alle Maerkte, oder `null`. */
export function bestRegularPrice(entries: readonly RegularPrice[], foodId: string): RegularPrice | null {
  let best: RegularPrice | null = null;
  for (const entry of entries) {
    if (entry.food_id !== foodId) continue;
    if (!best || compareByPrice(
      { price_per_kg: entry.price_per_kg, price: entry.regular_price_eur },
      { price_per_kg: best.price_per_kg, price: best.regular_price_eur },
    ) < 0) {
      best = entry;
    }
  }
  return best;
}

export function regularAgeDays(entry: RegularPrice, today: string): number {
  return Math.max(0, daysBetween(entry.seen_at, today));
}

export function isRegularStale(entry: RegularPrice, today: string): boolean {
  return regularAgeDays(entry, today) > REGULAR_PRICE_STALE_DAYS;
}

// ── Auswahl je Artikel ───────────────────────────────────────────────────────

export type PriceChoice =
  | { kind: 'offer'; offer: Offer; notes: string[]; packs: number | null; saving: number | null }
  | { kind: 'regular'; entry: RegularPrice; ageDays: number; stale: boolean }
  | { kind: 'none' };

/** Angebot vor Dauerpreis vor nichts. */
export function choosePrice(
  foodId: string,
  neededG: number,
  prices: PricesFile | null,
  regular: RegularPricesFile | null,
  today: string,
): PriceChoice {
  const offer = prices ? cheapestOffer(prices.offers, foodId, today) : null;
  if (offer) {
    return { kind: 'offer', offer, notes: offerNotes(offer), packs: offerPacks(offer, neededG), saving: offerSaving(offer, neededG) };
  }
  const entry = regular ? bestRegularPrice(regular.entries, foodId) : null;
  if (entry) {
    return { kind: 'regular', entry, ageDays: regularAgeDays(entry, today), stale: isRegularStale(entry, today) };
  }
  return { kind: 'none' };
}

export interface SavingsSummary {
  /** Summe der Ersparnis in Euro, nur aus Angeboten mit Normalpreis und Packungsgroesse. */
  eur: number;
  /** Artikel, die in die Summe eingehen. */
  counted: number;
  /** Artikel mit einem Angebot, auch ohne Normalpreis. */
  withOffer: number;
}

export function summarizeSavings(choices: readonly PriceChoice[]): SavingsSummary {
  let eur = 0;
  let counted = 0;
  let withOffer = 0;
  for (const choice of choices) {
    if (choice.kind !== 'offer') continue;
    withOffer += 1;
    if (choice.saving !== null) {
      eur += choice.saving;
      counted += 1;
    }
  }
  return { eur, counted, withOffer };
}
