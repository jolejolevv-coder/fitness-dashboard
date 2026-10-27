import type { StoreName } from '../../scripts/prices/types';

/**
 * Antwort des Modells auf ein Kassenbon Foto. Das Schema fragt nur ab, was die
 * Dauerpreise brauchen: Markt, Datum und je Zeile Text, Preis, Menge. Karten
 * nummer, Autorisierungsdaten und Filialadresse kommen nicht vor.
 */

export const RECEIPT_STORES: readonly StoreName[] = ['Lidl', 'Aldi Süd', 'Edeka'];

export interface ReceiptLine {
  /** Bontext der Zeile, wie gedruckt. */
  text: string;
  /** Einzelpreis der Packung, bei Gewichtsware der Zeilenbetrag. */
  price_eur: number;
  /** Gekaufte Stueckzahl, `2` bei `3,29 x2`. Bei Gewichtsware 1. */
  quantity: number;
  /** Gedruckter Kilopreis (`1,49 EUR/kg`), sonst `null`. */
  price_per_kg_eur: number | null;
  /** Gedruckte Packungsgroesse in Gramm (`500g`, `2.5kg`), sonst `null`. */
  size_g: number | null;
  /** Vorschlag aus `shopping_items.json`, `null` wenn kein Artikel passt. */
  food_id: string | null;
}

export interface Receipt {
  store: StoreName;
  /** Bondatum, `YYYY-MM-DD`. */
  date: string;
  lines: ReceiptLine[];
}
