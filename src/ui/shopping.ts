import { FOODS, MEALS, ROTATION, SHOPPING_ITEMS } from '../nutrition/plan';
import { effectivePlan } from '../nutrition/rotation';
import { buildShoppingList, weeklyDemand } from '../nutrition/shopping';
import type { ShoppingLine } from '../nutrition/shopping';
import { choosePrice, REGULAR_PRICE_STALE_DAYS, summarizeSavings } from '../nutrition/prices';
import type { PriceChoice } from '../nutrition/prices';
import { berlinDay, longDate, shortDate } from '../nutrition/dates';
import { SHOPPING_DONE_KEY, loadChecked, saveChecked, toggled } from '../nutrition/state';
import { byId } from './dom';
import { decimal, integer } from './format';
import { FOCUS_ATTR, checkRow, el, focusedKey, restoreFocus, span } from './build';
import { getOverrides } from './plan';
import { loadPriceData } from './priceData';
import type { PriceData } from './priceData';

let done: Set<string> = loadChecked(SHOPPING_DONE_KEY);
let priceData: PriceData | null = null;
let priceRequested = false;

const euro = (value: number): string => `${decimal(value, 2)} €`;
const grams = (value: number): string => `${integer(value)} g`;

function quantityText(line: ShoppingLine): string {
  if (line.isSpice) return '';
  if (line.pieces !== null) return `${integer(line.pieces)} Stück`;
  if (line.packs !== null && line.packSizeG !== null) {
    return `${integer(line.packs)} ${line.packs === 1 ? 'Packung' : 'Packungen'} à ${grams(line.packSizeG)}`;
  }
  return line.buyG === null ? '' : grams(line.buyG);
}

function priceNode(choice: PriceChoice): HTMLElement | null {
  if (choice.kind === 'none') return null;

  if (choice.kind === 'offer') {
    const o = choice.offer;
    const parts = [`Angebot ${o.store} ${euro(o.price_eur)}`];
    if (o.size_g !== null) parts[0] += ` für ${grams(o.size_g)}`;
    if (o.price_per_kg !== null) parts.push(`${euro(o.price_per_kg)} je kg`);
    parts.push(`${shortDate(o.valid_from)} bis ${shortDate(o.valid_to)}`);
    if (o.regular_price_eur !== null) parts.push(`statt ${euro(o.regular_price_eur)}`);
    return el('span', { class: 'check-sub price-line' }, [
      span('', parts.join(', ')),
      ...choice.notes.map((note) => span('tag', note)),
    ]);
  }

  const e = choice.entry;
  const parts = [`Dauerpreis ${e.store} ${euro(e.regular_price_eur)}`];
  if (e.price_per_kg !== null) parts.push(`${euro(e.price_per_kg)} je kg`);
  parts.push(`Stand ${longDate(e.seen_at)}`);
  return el('span', { class: 'check-sub price-line' }, [
    span('', parts.join(', ')),
    choice.stale ? span('tag tag-warn', `älter als ${REGULAR_PRICE_STALE_DAYS} Tage`) : null,
  ]);
}

function lineDetail(line: ShoppingLine, choice: PriceChoice): HTMLElement | null {
  const rows: HTMLElement[] = [];
  const pieces = line.pieces !== null;
  const packed = line.packs !== null;
  if ((pieces || packed) && line.neededG > 0) rows.push(span('check-sub', `Bedarf ${grams(line.neededG)}`));
  if (line.pantry) rows.push(span('check-sub', 'Vorrat'));
  const price = priceNode(choice);
  if (price) rows.push(price);
  return rows.length > 0 ? el('span', { class: 'check-details' }, rows) : null;
}

function setDone(key: string): void {
  done = toggled(done, key);
  saveChecked(SHOPPING_DONE_KEY, done);
  renderShopping();
}

/** Zeichnet den Reiter Einkauf. Preise kommen nach, sobald die Dateien da sind. */
export function renderShopping(): void {
  const root = byId('shopping-content');
  if (!root) return;

  if (!priceRequested) {
    priceRequested = true;
    void loadPriceData().then((data) => {
      priceData = data;
      renderShopping();
    });
  }

  const focus = focusedKey();
  const plan = effectivePlan(ROTATION, getOverrides(), MEALS);
  const list = buildShoppingList(weeklyDemand(plan), SHOPPING_ITEMS, FOODS);
  const today = berlinDay(new Date());

  const priced = list.groups.map((group) => ({
    group,
    rows: group.lines.map((line) => ({
      line,
      choice: line.isSpice
        ? ({ kind: 'none' } as PriceChoice)
        : choosePrice(line.foodId, line.neededG, priceData?.prices ?? null, priceData?.regular ?? null, today),
    })),
  }));

  const allLines = list.groups.flatMap((g) => g.lines);
  const doneCount = allLines.filter((l) => done.has(l.foodId)).length;

  const content = el('div');
  const head = el('div', { class: 'pl-toolbar' }, [
    span('section-sub num', `${doneCount} von ${allLines.length} abgehakt`),
  ]);
  if (done.size > 0) {
    const reset = el('button', { class: 'btn btn-tap', text: 'Abhaken zurücksetzen', attrs: { type: 'button', [FOCUS_ATTR]: 'reset' } });
    reset.addEventListener('click', () => {
      done = new Set();
      saveChecked(SHOPPING_DONE_KEY, done);
      renderShopping();
    });
    head.appendChild(reset);
  }
  content.appendChild(head);

  for (const id of list.missingItems) content.appendChild(el('p', { class: 'err', text: `Einkauf: kein Eintrag für ${id}` }));

  const prices = priceData?.prices ?? null;
  if (prices) {
    const savings = summarizeSavings(priced.flatMap((p) => p.rows.map((r) => r.choice)));
    const lines = [`Angebote vom ${longDate(prices.fetched_at.slice(0, 10))}`];
    if (savings.withOffer > 0) {
      lines.push(`Ersparnis ${euro(savings.eur)}, Basis ${savings.counted} von ${savings.withOffer} Angeboten`);
    }
    content.appendChild(el('div', { class: 'pl-pricehead num', text: lines.join(', ') }));
  }

  for (const { group, rows } of priced) {
    const block = el('section', { class: 'sh-group' }, [el('h3', { class: 'metric-group-title', text: group.label })]);
    for (const { line, choice } of rows) {
      block.appendChild(checkRow({
        key: `item-${line.foodId}`,
        label: line.name,
        detail: lineDetail(line, choice),
        quantity: quantityText(line),
        checked: done.has(line.foodId),
        onChange: () => setDone(line.foodId),
      }));
    }
    content.appendChild(block);
  }

  root.replaceChildren(content);
  restoreFocus(root, focus);
}
