/**
 * Gemeinsame Typen der Preis Pipeline. Reine Typen, keine Laufzeitlogik, damit
 * Node sie beim Type Stripping ohne Rest entfernen kann.
 */

/** Die drei Maerkte, die der Parser uebernimmt. Werte wie in `data-store`. */
export type StoreName = 'Lidl' | 'Aldi Süd' | 'Edeka';

/** Ein Angebot, wie es aus der Seite gelesen wird, noch ohne Zuordnung zu einem Artikel. */
export interface RawOffer {
  store: StoreName;
  /** Dekodierter Produktname inklusive Mengenangabe. */
  product: string;
  priceEur: number;
  /** `null`, wenn die Seite keinen Normalpreis angibt. Nie geschaetzt. */
  regularPriceEur: number | null;
  /** ISO Zeit mit Europe/Berlin Offset. */
  validFrom: string;
  validTo: string;
  /** Wochentagspanne wie `Mo bis Sa`, `null` wenn die Gruppenueberschrift fehlt. */
  validDays: string | null;
  /** Text aus `.membership-info`, etwa `Mit der App`. Sonst `null`. */
  condition: string | null;
}

/** Menge aus dem Produktnamen, vor der Umrechnung in Gramm. */
export interface Quantity {
  amount: number;
  unit: 'g' | 'ml' | 'piece';
}

/** Eintrag aus `data/shopping_items.json`. Nur die Felder, die die Pipeline braucht. */
export interface ShoppingItem {
  foodId: string;
  unit: 'g' | 'piece';
  gramsPerPiece?: number;
  stock?: boolean;
  match?: { include: string[]; exclude: string[] };
}

/** Ein zugeordnetes Angebot, so wie es in `prices.json` steht. */
export interface Offer {
  food_id: string;
  store: StoreName;
  product: string;
  size_g: number | null;
  price_eur: number;
  regular_price_eur: number | null;
  price_per_kg: number | null;
  valid_days: string | null;
  valid_from: string;
  valid_to: string;
  condition: string | null;
}

export interface PricesFile {
  fetched_at: string;
  valid_from: string;
  valid_to: string;
  offers: Offer[];
}

/** Zuletzt gesehener Normalpreis je Artikel und Markt (ADR 0003). */
export interface RegularPrice {
  food_id: string;
  store: StoreName;
  regular_price_eur: number;
  size_g: number | null;
  price_per_kg: number | null;
  /** Kalendertag des Abrufs, Europe/Berlin, `YYYY-MM-DD`. */
  seen_at: string;
  /** `muskelmarkt` fuer gesammelte Werte, `manual` fuer handgepflegte Startwerte. */
  source: string;
}

export interface RegularPricesFile {
  entries: RegularPrice[];
}
