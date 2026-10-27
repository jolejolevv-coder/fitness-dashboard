import type { StoreName } from '../../scripts/prices/types';
import type { Receipt, ReceiptLine } from './types';
import { RECEIPT_STORES } from './types';

/**
 * Pruefung der Modellantwort. Eine kaputte Antwort ergibt Funde mit Pfad, nie
 * eine halb gelesene Quittung.
 */

export type ParseReceiptResult = { ok: true; receipt: Receipt } | { ok: false; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isPositive = (value: unknown): value is number => isFiniteNumber(value) && value > 0;

/** Echtes Kalenderdatum im Format `YYYY-MM-DD`, `2026-02-30` faellt durch. */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isStore(value: unknown): value is StoreName {
  return RECEIPT_STORES.some((store) => store === value);
}

function readLine(value: unknown, path: string, foodIds: ReadonlySet<string>, issues: string[]): ReceiptLine | null {
  if (!isRecord(value)) {
    issues.push(`${path}: Objekt erwartet`);
    return null;
  }
  const before = issues.length;
  const text = value['text'];
  const price = value['price_eur'];
  const quantity = value['quantity'];
  const perKg = value['price_per_kg_eur'] ?? null;
  const size = value['size_g'] ?? null;
  const foodId = value['food_id'] ?? null;

  if (typeof text !== 'string' || text.trim() === '') issues.push(`${path}: Text fehlt`);
  if (!isFiniteNumber(price)) issues.push(`${path}: Preis ungueltig ${String(price)}`);
  if (!isPositive(quantity)) issues.push(`${path}: Menge ungueltig ${String(quantity)}`);
  if (perKg !== null && !isPositive(perKg)) issues.push(`${path}: Kilopreis ungueltig ${String(perKg)}`);
  if (size !== null && !isPositive(size)) issues.push(`${path}: Groesse ungueltig ${String(size)}`);
  if (foodId !== null && (typeof foodId !== 'string' || !foodIds.has(foodId))) {
    issues.push(`${path}: unbekannter Artikel ${String(foodId)}`);
  }
  if (issues.length > before) return null;

  return {
    text: (text as string).trim(),
    price_eur: price as number,
    quantity: quantity as number,
    price_per_kg_eur: perKg as number | null,
    size_g: size as number | null,
    food_id: foodId as string | null,
  };
}

/** `foodIds` sind die Artikel aus `shopping_items.json`, andere Zuordnungen sind ein Fund. */
export function parseReceipt(data: unknown, foodIds: ReadonlySet<string>): ParseReceiptResult {
  if (!isRecord(data)) return { ok: false, issues: ['Antwort ist kein Objekt'] };
  const issues: string[] = [];

  const store = data['store'] ?? null;
  const date = data['date'] ?? null;
  if (store === null) issues.push('Markt nicht erkannt');
  else if (!isStore(store)) issues.push(`Markt unbekannt ${String(store)}`);
  if (date === null) issues.push('Datum nicht erkannt');
  else if (!isIsoDay(date)) issues.push(`Datum ungueltig ${String(date)}`);

  const rawLines = data['lines'];
  const lines: ReceiptLine[] = [];
  if (!Array.isArray(rawLines)) issues.push('lines: Liste erwartet');
  else if (rawLines.length === 0) issues.push('Keine Zeilen gelesen');
  else {
    rawLines.forEach((raw, index) => {
      const line = readLine(raw, `lines[${index}]`, foodIds, issues);
      if (line) lines.push(line);
    });
  }

  if (issues.length > 0 || !isStore(store) || !isIsoDay(date)) return { ok: false, issues };
  return { ok: true, receipt: { store, date, lines } };
}
