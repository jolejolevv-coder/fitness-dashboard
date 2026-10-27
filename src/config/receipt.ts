/**
 * Konfiguration des Kassenbon Scans (Phase 14). Modell und Grenzen stehen hier,
 * die Rechenfunktionen unter `src/receipt/` bekommen sie uebergeben.
 */

/** Sonnet reicht fuers Lesen eines Bons. Der Preis steht in `TOKEN_PRICES`. */
export const RECEIPT_MODEL = 'claude-sonnet-5-5';

/** Obergrenze der Ausgabe. Ein Bon mit 40 Zeilen braucht rund 4000 Tokens. */
export const RECEIPT_MAX_TOKENS = 8_000;

/** Frist des Aufrufs. Ein Bild mit Antwort dauert wenige Sekunden. */
export const RECEIPT_TIMEOUT_MS = 2 * 60 * 1000;

/** localStorage Schluessel der gespeicherten Bonpreise, je Geraet. */
export const RECEIPT_PRICES_KEY = 'fitness_receipt_prices_v1';

/** Wert von `RegularPrice.source` fuer Preise aus einem Bon. */
export const RECEIPT_SOURCE = 'receipt';

/** Laengste Kante des Fotos vor dem Senden. Haelt Bild und Kosten klein, der Text bleibt lesbar. */
export const RECEIPT_IMAGE_MAX_EDGE_PX = 2000;

/** JPEG Qualitaet beim Verkleinern. */
export const RECEIPT_IMAGE_QUALITY = 0.85;

/** Medientypen, die die API als Bild annimmt. */
export const RECEIPT_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export type ReceiptMediaType = (typeof RECEIPT_MEDIA_TYPES)[number];

/** Gewichtsware wird je kg gefuehrt, die Groesse ist dann 1 kg. */
export const WEIGHED_SIZE_G = 1000;
