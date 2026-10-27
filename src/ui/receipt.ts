import type { RegularPrice } from '../../scripts/prices/types';
import { RECEIPT_IMAGE_MAX_EDGE_PX, RECEIPT_IMAGE_QUALITY } from '../config/receipt';
import { loadApiKey } from '../generator/state';
import { longDate } from '../nutrition/dates';
import { FOODS, SHOPPING_ITEMS, indexById } from '../nutrition/plan';
import type { ShoppingItem } from '../nutrition/types';
import { exportRegularPricesJson, loadReceiptPrices, mergeRegularEntries, saveReceiptPrices, suggestedSizeG, toCandidates } from '../receipt/prices';
import type { ReceiptImage, ReceiptItem, ReceiptStatus } from '../receipt/request';
import { costLine, receiptStatusLine, requestReceipt } from '../receipt/request';
import type { Receipt, ReceiptLine } from '../receipt/types';
import { FOCUS_ATTR, el, restoreFocus, focusedKey, span } from './build';
import { decimal, integer } from './format';

/**
 * Bon einlesen im Segment Einkauf: Foto verkleinern, an die API schicken und
 * das Ergebnis als Pruefansicht zeigen. Gespeichert wird erst nach Klick auf
 * `Speichern`. Wird erst beim ersten Bon geladen.
 *
 * Alle Texte aus dem Bon und aus der Modellantwort gehen nur ueber `el` und
 * `span`, also per `textContent`, ins DOM.
 */

export interface ReceiptHost {
  /** Element, in das die Ansicht gezeichnet wird. */
  view: HTMLElement;
  /** Nach dem Speichern, damit die Einkaufsliste die neuen Preise nimmt. */
  onSaved: () => void;
}

/** Eine Zeile der Pruefansicht mit den Aenderungen des Nutzers. */
interface Row {
  line: ReceiptLine;
  foodId: string | null;
  sizeG: number | null;
  take: boolean;
}

const FOODS_BY_ID = indexById(FOODS);
const ITEMS_BY_ID: ReadonlyMap<string, ShoppingItem> = new Map(SHOPPING_ITEMS.map((item) => [item.foodId, item]));
const USD_DIGITS = 2;
const BASE64_MARKER = 'base64,';

const usd = (value: number): string => `${decimal(value, USD_DIGITS)} $`;
const euro = (value: number): string => `${decimal(value, 2)} €`;

function itemName(foodId: string): string {
  return FOODS_BY_ID.get(foodId)?.name ?? foodId;
}

/** Artikel fuer die Anfrage, mit Namen und Suchbegriffen als Zuordnungshilfe. */
export function receiptItems(): ReceiptItem[] {
  return SHOPPING_ITEMS.map((item) => ({ foodId: item.foodId, name: itemName(item.foodId), terms: item.match.include }));
}

const SORTED_ITEMS: readonly ShoppingItem[] = [...SHOPPING_ITEMS].sort((a, b) => itemName(a.foodId).localeCompare(itemName(b.foodId), 'de'));

// ── Bild ─────────────────────────────────────────────────────────────────────

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Lesen fehlgeschlagen'));
    reader.readAsDataURL(blob);
  });
}

/** Verkleinert auf die Hoechstkante und kodiert als JPEG. `null`, wenn der Browser das Bild nicht lesen kann. */
async function prepareImage(file: File): Promise<ReceiptImage | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, RECEIPT_IMAGE_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', RECEIPT_IMAGE_QUALITY));
    if (!blob) return null;
    const url = await readAsDataUrl(blob);
    return { mediaType: 'image/jpeg', base64: url.slice(url.indexOf(BASE64_MARKER) + BASE64_MARKER.length) };
  } catch {
    return null;
  }
}

// ── Ablauf ───────────────────────────────────────────────────────────────────

/** Liest einen Bon und zeichnet das Ergebnis. Jeder Ausgang landet als Zeile in der Ansicht. */
export async function scanReceipt(file: File, host: ReceiptHost): Promise<void> {
  host.view.replaceChildren(el('p', { class: 'toolbar-note', text: 'Liest Bon' }));

  const image = await prepareImage(file);
  if (!image) {
    showError(host, 'Bild nicht lesbar');
    return;
  }
  const status = await requestReceipt({ apiKey: loadApiKey(), image, items: receiptItems() });
  if (status.kind !== 'read') {
    showError(host, receiptStatusLine(status), status);
    return;
  }
  showReview(host, status.receipt, costLine(status.cost, { usd, count: integer }));
}

function showError(host: ReceiptHost, line: string, status?: ReceiptStatus): void {
  const cost = status && 'cost' in status ? costLine(status.cost, { usd, count: integer }) : null;
  host.view.replaceChildren(el('p', { class: 'err', text: line }));
  if (cost) host.view.appendChild(el('p', { class: 'toolbar-note', text: cost }));
}

// ── Pruefansicht ─────────────────────────────────────────────────────────────

function initialRows(receipt: Receipt): Row[] {
  return receipt.lines.map((line) => {
    const item = line.food_id ? (ITEMS_BY_ID.get(line.food_id) ?? null) : null;
    return { line, foodId: item ? item.foodId : null, sizeG: suggestedSizeG(line, item), take: item !== null };
  });
}

/** Die Zeilen, die in die Dauerpreise eingehen: angehakt und zugeordnet, mit der gewaehlten Groesse. */
function candidatesOf(rows: readonly Row[], receipt: Receipt): RegularPrice[] {
  const lines = rows
    .filter((row) => row.take && row.foodId !== null)
    .map((row) => ({ ...row.line, food_id: row.foodId, size_g: row.sizeG }));
  return toCandidates(lines, receipt.store, receipt.date);
}

function priceText(line: ReceiptLine): string {
  if (line.price_per_kg_eur !== null) return `${euro(line.price_per_kg_eur)} je kg`;
  return line.quantity === 1 ? euro(line.price_eur) : `${euro(line.price_eur)} × ${decimal(line.quantity, Number.isInteger(line.quantity) ? 0 : 1)}`;
}

function showReview(host: ReceiptHost, receipt: Receipt, cost: string): void {
  const rows = initialRows(receipt);
  let message: HTMLElement | null = null;
  const entryCount = el('span', { class: 'toolbar-note' });

  const draw = (): void => {
    const focus = focusedKey();
    const candidates = candidatesOf(rows, receipt);
    const mapped = rows.filter((row) => row.foodId !== null).length;

    const list = el('div', { class: 'list' });
    rows.forEach((row, index) => list.appendChild(rowView(row, index, draw, updateCount)));

    const save = el('button', { class: 'btn', text: 'Speichern', attrs: { type: 'button', [FOCUS_ATTR]: 'receipt-save' } });
    save.disabled = candidates.length === 0;
    save.addEventListener('click', () => {
      const current = candidatesOf(rows, receipt);
      saveReceiptPrices(current);
      message = el('p', { class: 'toolbar-note', text: `Gespeichert, ${integer(current.length)} Einträge` });
      host.onSaved();
      draw();
    });

    const exportButton = el('button', { class: 'btn', text: 'Export', attrs: { type: 'button', [FOCUS_ATTR]: 'receipt-export' } });
    exportButton.addEventListener('click', () => {
      void copyExport(candidatesOf(rows, receipt)).then((line) => {
        message = el('p', { class: line.ok ? 'toolbar-note' : 'err', text: line.text });
        draw();
      });
    });

    const discard = el('button', { class: 'btn', text: 'Verwerfen', attrs: { type: 'button', [FOCUS_ATTR]: 'receipt-discard' } });
    discard.addEventListener('click', () => host.view.replaceChildren());

    host.view.replaceChildren(
      el('p', { class: 'toolbar-note', text: `${receipt.store}, ${longDate(receipt.date)}, ${integer(receipt.lines.length)} Zeilen, ${integer(mapped)} zugeordnet` }),
      el('p', { class: 'toolbar-note', text: cost }),
      list,
      el('div', { class: 'toolbar' }, [entryCount, el('span', {}, [save, exportButton, discard])]),
    );
    if (message) host.view.appendChild(message);
    updateCount();
    restoreFocus(host.view, focus);
  };

  function updateCount(): void {
    entryCount.textContent = `${integer(candidatesOf(rows, receipt).length)} Einträge zum Speichern`;
  }

  draw();
}

/** Kopiert die Eintraege im Format der `regular_prices.json`: gespeicherte Werte plus die Zeilen der Ansicht. */
async function copyExport(candidates: readonly RegularPrice[]): Promise<{ ok: boolean; text: string }> {
  const entries = mergeRegularEntries(loadReceiptPrices(), candidates);
  try {
    await navigator.clipboard.writeText(exportRegularPricesJson(entries));
    return { ok: true, text: `Export kopiert, ${integer(entries.length)} Einträge` };
  } catch {
    return { ok: false, text: 'Kopieren nicht möglich' };
  }
}

function rowView(row: Row, index: number, redraw: () => void, updateCount: () => void): HTMLElement {
  const take = el('input', { attrs: { type: 'checkbox', 'aria-label': 'Übernehmen', [FOCUS_ATTR]: `receipt-take-${index}` } });
  take.checked = row.take;
  take.disabled = row.foodId === null;
  take.addEventListener('change', () => {
    row.take = take.checked;
    redraw();
  });

  const select = el('select', { attrs: { 'aria-label': 'Artikel', [FOCUS_ATTR]: `receipt-item-${index}` } });
  select.appendChild(el('option', { text: 'Keine Zuordnung', attrs: { value: '' } }));
  for (const item of SORTED_ITEMS) select.appendChild(el('option', { text: itemName(item.foodId), attrs: { value: item.foodId } }));
  select.value = row.foodId ?? '';
  select.addEventListener('change', () => {
    const item = ITEMS_BY_ID.get(select.value) ?? null;
    row.foodId = item ? item.foodId : null;
    row.sizeG = suggestedSizeG(row.line, item);
    row.take = item !== null;
    redraw();
  });

  const size = el('input', {
    attrs: { type: 'number', inputmode: 'numeric', min: '1', step: '1', 'aria-label': 'Größe in Gramm', [FOCUS_ATTR]: `receipt-size-${index}` },
  });
  size.value = row.sizeG === null ? '' : String(row.sizeG);
  size.disabled = row.foodId === null || row.line.price_per_kg_eur !== null;
  size.addEventListener('input', () => {
    const value = Number(size.value);
    row.sizeG = size.value !== '' && Number.isFinite(value) && value > 0 ? value : null;
    updateCount();
  });

  return el('div', { class: row.take ? 'receipt-row' : 'receipt-row is-off' }, [
    el('span', { class: 'receipt-take' }, [take]),
    el('span', { class: 'receipt-main' }, [span('receipt-text', row.line.text), span('receipt-price', priceText(row.line))]),
    el('span', { class: 'receipt-controls' }, [select, el('label', { class: 'receipt-size' }, [size, span('', 'g')])]),
  ]);
}
