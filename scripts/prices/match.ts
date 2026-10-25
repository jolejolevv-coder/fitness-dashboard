import type { Offer, Quantity, RawOffer, ShoppingItem } from './types.ts';

/**
 * Ordnet Angebote den Artikeln aus `shopping_items.json` zu. Vergleich ohne
 * Beachtung der Gross und Kleinschreibung auf dem dekodierten Produktnamen.
 */

const GRAMS_PER_KG = 1000;
const CENT_FACTOR = 100;

/** Artikel, bei dem eine Fettangabe im Namen Pflicht ist (siehe Spec Rinderhack). */
const FAT_REQUIRED_FOOD_ID = 'beef_mince_5';
const FAT_HINT = /\d\s*%|fett/i;
/** Hackarten, die schon dem Namen nach mager sind und keine Fettangabe brauchen. */
const LEAN_BY_NAME = /tatar|beefsteakhack/i;

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => n.trim() !== '' && haystack.includes(n.toLowerCase()));
}

/** Trifft der Produktname die Include und keine Exclude Begriffe des Artikels? */
export function itemMatches(item: ShoppingItem, productName: string): boolean {
  if (item.stock || !item.match) return false;
  const name = productName.toLowerCase();
  if (!containsAny(name, item.match.include)) return false;
  if (containsAny(name, item.match.exclude)) return false;
  if (item.foodId === FAT_REQUIRED_FOOD_ID && !LEAN_BY_NAME.test(productName) && !FAT_HINT.test(productName)) {
    return false;
  }
  return true;
}

function round2(value: number): number {
  return Math.round(value * CENT_FACTOR) / CENT_FACTOR;
}

/**
 * Packungsgroesse in Gramm. Gramm gelten fuer alle Artikel, Stueckzahlen nur
 * fuer Artikel mit Stueckeinheit und bekanntem Stueckgewicht. Volumen wird nicht
 * umgerechnet, die Groesse bleibt dann unbekannt.
 */
export function sizeInGrams(
  item: ShoppingItem,
  quantity: Quantity | null,
): number | null {
  if (!quantity) return null;
  if (quantity.unit === 'g') return quantity.amount;
  if (quantity.unit === 'piece' && item.unit === 'piece' && item.gramsPerPiece) {
    return quantity.amount * item.gramsPerPiece;
  }
  return null;
}

export function pricePerKg(priceEur: number, sizeG: number | null): number | null {
  if (sizeG === null || sizeG <= 0) return null;
  return round2((priceEur / sizeG) * GRAMS_PER_KG);
}

/** Baut aus einem Rohangebot den Eintrag fuer `prices.json`. */
export function toOffer(
  item: ShoppingItem,
  raw: RawOffer,
  quantity: Quantity | null,
): Offer {
  const sizeG = sizeInGrams(item, quantity);
  return {
    food_id: item.foodId,
    store: raw.store,
    product: raw.product,
    size_g: sizeG,
    price_eur: raw.priceEur,
    regular_price_eur: raw.regularPriceEur,
    price_per_kg: pricePerKg(raw.priceEur, sizeG),
    valid_days: raw.validDays,
    valid_from: raw.validFrom,
    valid_to: raw.validTo,
    condition: raw.condition,
  };
}
