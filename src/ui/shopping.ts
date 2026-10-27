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
import { getPlanSource, onPlanSourceChange } from './planSource';
import type { DayGoals } from '../parse/goals';
import { loadPriceData } from './priceData';
import type { PriceData } from './priceData';

let done: Set<string> = loadChecked(SHOPPING_DONE_KEY);
let priceData: PriceData | null = null;
let priceRequested = false;
let lastGoals: DayGoals | null = null;

/** Bon einlesen: Knopf und Ansicht bleiben ueber das Neuzeichnen der Liste bestehen. */
const receiptView = el('div', { class: 'receipt' });
let receiptBar: HTMLElement | null = null;

// Uebernahme und Rueckkehr zum Seed haben den Speicher geleert.
onPlanSourceChange(() => {
  done = loadChecked(SHOPPING_DONE_KEY);
});

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

/** Unterzeile mit Herkunft des Preises. Angebote stehen gruen, Dauerpreise neutral. */
function priceSub(choice: PriceChoice): HTMLElement | null {
  if (choice.kind === 'none') return null;

  if (choice.kind === 'offer') {
    const o = choice.offer;
    const parts = [`Angebot ${o.store}`];
    if (o.size_g !== null) parts[0] += ` für ${grams(o.size_g)}`;
    if (o.price_per_kg !== null) parts.push(`${euro(o.price_per_kg)} je kg`);
    parts.push(`${shortDate(o.valid_from)} bis ${shortDate(o.valid_to)}`);
    return el('span', { class: 'check-sub is-ok' }, [
      span('', parts.join(', ')),
      ...choice.notes.map((note) => span('tag', note)),
    ]);
  }

  const e = choice.entry;
  const parts = [`Dauerpreis ${e.store}`];
  if (e.price_per_kg !== null) parts.push(`${euro(e.price_per_kg)} je kg`);
  parts.push(`Stand ${longDate(e.seen_at)}`);
  return el('span', { class: 'check-sub' }, [
    span('', parts.join(', ')),
    choice.stale ? span('tag', `älter als ${REGULAR_PRICE_STALE_DAYS} Tage`) : null,
  ]);
}

/** Preis rechts, bei Angeboten mit Streichpreis darunter. */
function priceAside(choice: PriceChoice): HTMLElement | null {
  if (choice.kind === 'none') return null;
  if (choice.kind === 'offer') {
    const regular = choice.offer.regular_price_eur;
    return el('span', { class: 'check-qty', text: euro(choice.offer.price_eur) }, [
      regular === null ? null : el('small', { text: euro(regular) }),
    ]);
  }
  return span('check-qty', euro(choice.entry.regular_price_eur));
}

function lineDetail(line: ShoppingLine, choice: PriceChoice): HTMLElement | null {
  const rows: HTMLElement[] = [];
  const quantity = quantityText(line);
  const needed = (line.pieces !== null || line.packs !== null) && line.neededG > 0 ? `Bedarf ${grams(line.neededG)}` : '';
  const amount = [quantity, needed].filter(Boolean).join(', ');
  if (amount) rows.push(span('check-sub', amount));
  if (line.pantry) rows.push(span('check-sub', 'Vorrat'));
  const price = priceSub(choice);
  if (price) rows.push(price);
  return rows.length > 0 ? el('span', { class: 'check-details' }, rows) : null;
}

function setDone(key: string): void {
  done = toggled(done, key);
  saveChecked(SHOPPING_DONE_KEY, done);
  rerender();
}

function rerender(): void {
  renderShopping(lastGoals);
}

/** Nach dem Speichern von Bonpreisen: Preise neu zusammenstellen und die Liste zeichnen. */
function refreshPrices(): void {
  void loadPriceData().then((data) => {
    priceData = data;
    rerender();
  });
}

/** Die Ansicht liegt in einem eigenen Chunk und wird erst beim ersten Bon geladen. */
async function scanFile(file: File, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  try {
    const module = await import('./receipt');
    await module.scanReceipt(file, { view: receiptView, onSaved: refreshPrices });
  } catch {
    receiptView.replaceChildren(el('p', { class: 'err', text: 'Bon Modul nicht geladen' }));
  } finally {
    button.disabled = false;
  }
}

function buildReceiptBar(): HTMLElement {
  // Ohne `capture`, damit das Handy Kamera und Mediathek zur Wahl stellt.
  const input = el('input', { attrs: { type: 'file', accept: 'image/*', hidden: '' } });
  const button = el('button', { class: 'btn', text: 'Bon einlesen', attrs: { type: 'button' } });
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void scanFile(file, button);
  });
  return el('div', { class: 'toolbar' }, [button, input]);
}

/** Zeichnet den Reiter Einkauf. Preise kommen nach, sobald die Dateien da sind. */
export function renderShopping(goals: DayGoals | null): void {
  const root = byId('shopping-content');
  if (!root) return;
  lastGoals = goals;

  if (!priceRequested) {
    priceRequested = true;
    void loadPriceData().then((data) => {
      priceData = data;
      rerender();
    });
  }

  const focus = focusedKey();
  const source = getPlanSource(goals);
  const plan = effectivePlan(source.plan.rotation, getOverrides(), source.plan.meals);
  const list = buildShoppingList(weeklyDemand(plan), source.plan.shoppingItems, source.plan.foods);
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
  const progress = allLines.length > 0 ? (doneCount / allLines.length) * 100 : 0;
  const fill = el('span');
  fill.style.width = `${progress.toFixed(1)}%`;
  const doneCard = el('div', { class: 'card' }, [
    span('card-label', 'Abgehakt'),
    el('div', { class: 'card-value', text: integer(doneCount) }, [el('small', { text: `von ${integer(allLines.length)}` })]),
    el('div', { class: 'bar' }, [fill]),
  ]);
  const summary = el('div', { class: 'grid2' }, [doneCard]);

  const prices = priceData?.prices ?? null;
  if (prices) {
    const savings = summarizeSavings(priced.flatMap((p) => p.rows.map((r) => r.choice)));
    const stand = `Stand ${shortDate(prices.fetched_at.slice(0, 10))}`;
    summary.appendChild(el('div', { class: 'card' }, [
      span('card-label', 'Ersparnis'),
      savings.withOffer > 0
        ? el('div', { class: 'card-value is-ok', text: decimal(savings.eur, 2) }, [el('small', { text: '€' })])
        : el('div', { class: 'card-value is-word', text: 'Keine' }),
      el('div', { class: 'card-basis', text: savings.withOffer > 0 ? `${savings.counted} von ${savings.withOffer} Angeboten, ${stand}` : stand }),
    ]));
  }
  content.appendChild(summary);
  receiptBar ??= buildReceiptBar();
  content.append(receiptBar, receiptView);

  if (done.size > 0) {
    const reset = el('button', { class: 'btn', text: 'Abhaken zurücksetzen', attrs: { type: 'button', [FOCUS_ATTR]: 'reset' } });
    reset.addEventListener('click', () => {
      done = new Set();
      saveChecked(SHOPPING_DONE_KEY, done);
      rerender();
    });
    content.appendChild(el('div', { class: 'toolbar' }, [reset]));
  }

  for (const issue of source.issues) content.appendChild(el('p', { class: 'err', text: issue }));
  for (const id of list.missingItems) content.appendChild(el('p', { class: 'err', text: `Einkauf: kein Eintrag für ${id}` }));

  for (const { group, rows } of priced) {
    const block = el('div', { class: 'list' });
    for (const { line, choice } of rows) {
      block.appendChild(checkRow({
        key: `item-${line.foodId}`,
        label: line.name,
        detail: lineDetail(line, choice),
        aside: priceAside(choice),
        checked: done.has(line.foodId),
        onChange: () => setDone(line.foodId),
      }));
    }
    content.append(el('h3', { class: 'group-label', text: group.label }), block);
  }

  root.replaceChildren(content);
  restoreFocus(root, focus);
}
