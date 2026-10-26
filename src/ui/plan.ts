import type { DayGoals } from '../parse/goals';
import { FOODS, indexById, validatePlan } from '../nutrition/plan';
import type { PlanData } from '../nutrition/plan';
import { addMacros, sumIngredients, ZERO_MACROS } from '../nutrition/macros';
import { effectivePlan, findBarMeal } from '../nutrition/rotation';
import type { Overrides, PlannedDay, PlannedSlot } from '../nutrition/rotation';
import { buildPrep } from '../nutrition/prep';
import type { PrepSessionResult } from '../nutrition/prep';
import { compareToGoals, dayMacros } from '../nutrition/totals';
import { berlinDay, berlinWeekday, longDate } from '../nutrition/dates';
import {
  PREP_DONE_KEY,
  hasOverrides,
  loadChecked,
  loadOverrides,
  saveChecked,
  saveOverrides,
  toggled,
  withBar,
  withSwap,
} from '../nutrition/state';
import type { Food, Ingredient, Macros, Meal, Slot, Weekday } from '../nutrition/types';
import type { PlanSource } from '../generator/source';
import { roundedDayValues } from '../generator/check';
import { byId } from './dom';
import { decimal, integer, signed, target } from './format';
import { FOCUS_ATTR, checkRow, el, focusedKey, icon, restoreFocus, span } from './build';
import type { PlanView } from './router';
import { getPlanSource, hasStoredPlan, onPlanSourceChange, returnToSeed } from './planSource';

type GeneratorModule = typeof import('./generator');

let generatorModule: Promise<GeneratorModule> | null = null;

/** Die Ansicht Vorschlag liegt in einem eigenen Chunk, der erste Seitenaufruf waechst nicht. */
function loadGenerator(): Promise<GeneratorModule> {
  generatorModule ??= import('./generator');
  return generatorModule;
}

type CookModule = typeof import('./cook');

let cookModule: Promise<CookModule> | null = null;

/** Die Kochansicht mit `recipes.json` liegt ebenfalls in einem eigenen Chunk. */
function loadCook(): Promise<CookModule> {
  cookModule ??= import('./cook');
  return cookModule;
}

const WEEKDAY_NAMES: Record<Weekday, string> = {
  Mo: 'Montag', Di: 'Dienstag', Mi: 'Mittwoch', Do: 'Donnerstag', Fr: 'Freitag', Sa: 'Samstag', So: 'Sonntag',
};

const FOODS_BY_ID = indexById(FOODS);

/** Was ein Durchlauf aus der Planquelle braucht. Neu je Zeichnen, die Quelle kann wechseln. */
interface PlanContext {
  source: PlanSource;
  plan: PlanData;
  mealsById: Map<string, Meal>;
  /** Bei aktivem Vorschlag `null`: generierte Plaene kennen keine Riegel Option. */
  barMeal: Meal | null;
}

function planContext(source: PlanSource): PlanContext {
  const plan = source.plan;
  return {
    source,
    plan,
    mealsById: indexById(plan.meals),
    barMeal: source.kind === 'active' ? null : findBarMeal(plan.meals),
  };
}

let view: PlanView = 'today';
/** Meldet Wechsel, die der Plan selbst ausloest, damit der Hash mitzieht. */
let viewListener: (next: PlanView) => void = () => undefined;
let overrides: Overrides = loadOverrides();
let prepDone: Set<string> = loadChecked(PREP_DONE_KEY);
let lastGoals: DayGoals | null = null;
/** Offene Mahlzeiten, damit ein Tausch das Aufgeklappte nicht schliesst. */
const openMeals = new Set<string>();
/** Session `id` der offenen Kochansicht, `null` zeigt die Prep Checkliste. */
let cooking: string | null = null;
/** Nur direkt nach dem Knopf `Kochen`, nicht bei jedem Neuzeichnen. */
let scrollToCook = false;
let context: PlanContext = planContext(getPlanSource(null));

// Uebernahme und Rueckkehr zum Seed haben den Speicher geleert.
onPlanSourceChange(() => {
  overrides = loadOverrides();
  prepDone = loadChecked(PREP_DONE_KEY);
});

/** Der aktuelle Stand der Aenderungen am Plan, auch fuer den Reiter Einkauf. */
export function getOverrides(): Overrides {
  return overrides;
}

// ── Zustand ──────────────────────────────────────────────────────────────────

function applyOverrides(next: Overrides): void {
  overrides = next;
  saveOverrides(overrides);
  rerender();
}

function setSwap(day: Weekday, slot: Slot, mealId: string): void {
  const standard = context.plan.rotation[day][slot];
  let next = withSwap(overrides, day, slot, mealId === standard ? null : mealId);
  // Ein Tausch auf M3 ersetzt die Riegel Option, sonst gewaenne der Schalter still.
  if (slot === 'M3') next = withBar(next, day, false);
  applyOverrides(next);
}

function setBar(day: Weekday, active: boolean): void {
  applyOverrides(withBar(withSwap(overrides, day, 'M3', null), day, active));
}

function setPrepDone(key: string): void {
  prepDone = toggled(prepDone, key);
  saveChecked(PREP_DONE_KEY, prepDone);
  rerender();
}

// ── Bausteine ────────────────────────────────────────────────────────────────

const grams = (value: number): string => `${integer(value)} g`;

function macroLine(macros: Macros): string {
  return `${integer(macros.protein)} g Protein, ${integer(macros.carbs)} g KH, ${integer(macros.fat)} g Fett, ${decimal(macros.fiber, 0)} g Ballaststoffe`;
}

interface Grouped {
  items: { food: Food; grams: number }[];
  spices: Food[];
}

/** Gleiche Zutaten zusammengelegt, etwa Haehnchen aus dem Gericht und dem Riegel Zuschlag. */
function groupIngredients(ingredients: readonly Ingredient[]): Grouped {
  const items = new Map<string, { food: Food; grams: number }>();
  const spices = new Map<string, Food>();
  for (const ing of ingredients) {
    const food = FOODS_BY_ID.get(ing.foodId);
    if (!food) continue;
    if (food.kind === 'spice') {
      spices.set(food.id, food);
      continue;
    }
    const entry = items.get(food.id) ?? { food, grams: 0 };
    entry.grams += ing.grams;
    items.set(food.id, entry);
  }
  return { items: [...items.values()], spices: [...spices.values()] };
}

function seasoningText(grouped: Grouped): string | null {
  const sauces = grouped.items.filter((i) => i.food.kind === 'sauce');
  if (sauces.length === 0 && grouped.spices.length === 0) return null;
  const parts: string[] = [];
  for (const s of sauces) parts.push(`Soße ${s.food.name} ${grams(s.grams)}`);
  if (grouped.spices.length > 0) parts.push(`Gewürze ${grouped.spices.map((f) => f.name).join(', ')}`);
  return parts.join(', ');
}

const CHEVRON = ['M6 9l6 6 6-6'];
const UP_DOWN = ['M8 10l4-4 4 4', 'M8 14l4 4 4-4'];

/** Das Gericht bleibt ein `select`, gesetzt als Auswahlzeile mit voller Tippflaeche. */
function mealSelect(day: Weekday, planned: PlannedSlot): HTMLElement {
  const select = el('select', {
    attrs: { 'aria-label': `Gericht ${planned.slot} ${WEEKDAY_NAMES[day]}`, [FOCUS_ATTR]: `swap-${day}-${planned.slot}` },
  });
  for (const meal of context.plan.meals.filter((m) => m.slot === planned.slot)) {
    const option = el('option', { text: meal.name, attrs: { value: meal.id } });
    option.selected = meal.id === planned.mealId;
    select.appendChild(option);
  }
  select.addEventListener('change', () => setSwap(day, planned.slot, select.value));
  return el('div', { class: 'pick' }, [select, icon(UP_DOWN)]);
}

function barToggle(day: PlannedDay, planned: PlannedSlot): HTMLElement | null {
  const barMeal = context.barMeal;
  if (!barMeal || planned.slot !== barMeal.slot) return null;
  const detail = barMeal.addToSlot
    ? span('check-sub', `plus ${grams(barMeal.addToSlot.grams)} ${FOODS_BY_ID.get(barMeal.addToSlot.foodId)?.name ?? ''} auf ${barMeal.addToSlot.slot}`)
    : null;
  return checkRow({
    key: `bar-${day.day}`,
    label: 'Riegel Option',
    detail,
    checked: planned.mealId === barMeal.id,
    onChange: (checked) => setBar(day.day, checked),
  });
}

function mealName(planned: PlannedSlot): string {
  return context.mealsById.get(planned.mealId)?.name ?? planned.mealId;
}

/** Mahlzeit zum Aufklappen: geschlossen Name, Protein und Kalorien, offen Zutaten und Auswahl. */
function mealCard(day: PlannedDay, planned: PlannedSlot): HTMLElement {
  const macros = sumIngredients(planned.ingredients, FOODS_BY_ID);
  const grouped = groupIngredients(planned.ingredients);
  const key = `${day.day}-${planned.slot}`;

  const kcal = el('span', { class: 'meal-kcal', text: integer(macros.kcal) }, [el('small', { text: 'kcal' })]);
  const summary = el('summary', { class: 'meal-head', attrs: { [FOCUS_ATTR]: `meal-${key}` } }, [
    span('slot', planned.slot),
    el('span', {}, [span('meal-name', mealName(planned)), span('meal-sub', `${integer(macros.protein)} g Protein`)]),
    kcal,
    icon(CHEVRON, 'icon chev'),
  ]);

  const body = el('div', { class: 'meal-body' }, [el('div', { class: 'ing-note', text: macroLine(macros) })]);
  for (const item of grouped.items) {
    const name = item.food.kind === 'sauce' ? `${item.food.name} (Soße)` : item.food.name;
    body.appendChild(el('div', { class: 'ing' }, [span('', name), span('', grams(item.grams))]));
  }
  if (grouped.spices.length > 0) {
    body.appendChild(el('div', { class: 'ing-note', text: `Gewürze ${grouped.spices.map((f) => f.name).join(', ')}` }));
  }
  body.appendChild(mealSelect(day.day, planned));
  const bar = barToggle(day, planned);
  if (bar) body.appendChild(bar);

  const card = el('details', { class: 'card meal' }, [summary, body]);
  card.open = openMeals.has(key);
  card.addEventListener('toggle', () => {
    if (card.open) openMeals.add(key);
    else openMeals.delete(key);
  });
  return card;
}

/** Kompakte Mahlzeit im Wochenplan: Nummer, Auswahl und Kalorien in einer Zeile. */
function mealRow(day: PlannedDay, planned: PlannedSlot): HTMLElement[] {
  const macros = sumIngredients(planned.ingredients, FOODS_BY_ID);
  const nodes: HTMLElement[] = [el('div', { class: 'meal-row' }, [
    span('slot', planned.slot),
    mealSelect(day.day, planned),
    el('span', { class: 'meal-kcal', text: integer(macros.kcal) }, [el('small', { text: 'kcal' })]),
  ])];
  const seasoning = seasoningText(groupIngredients(planned.ingredients));
  if (seasoning) nodes.push(el('div', { class: 'meal-row-note', text: seasoning }));
  const bar = barToggle(day, planned);
  if (bar) nodes.push(bar);
  return nodes;
}

function goalText(c: { goal: number; diff: number } | null | undefined, unit: string): string {
  return c ? `Ziel ${target(c.goal)}${unit ? ` ${unit}` : ''}, ${signed(Math.round(c.diff), 0)}` : '';
}

/** Tageszahl gross, die Makros klein darunter. Ohne Ziel aus dem Sheet nur die Summe, nie ein Ersatzwert. */
function totalsCard(label: string, totals: Macros, goals: DayGoals | null, hero: boolean): HTMLElement {
  const cmp = goals ? compareToGoals(totals, goals) : null;
  const macro = (value: number, name: string, c: { goal: number } | null | undefined): HTMLElement =>
    el('div', { class: 'macro' }, [el('b', { text: grams(value) }), document.createTextNode(c ? `${name}, Ziel ${target(c.goal)}` : name)]);
  const kcalGoal = goalText(cmp?.caloriesKcal, '');
  return el('div', { class: 'card' }, [
    span('card-label', label),
    el('div', { class: hero ? 'card-value is-hero' : 'card-value', text: integer(totals.kcal) }, [el('small', { text: 'kcal' })]),
    kcalGoal ? el('div', { class: 'card-basis', text: kcalGoal }) : null,
    el('div', { class: 'macros' }, [
      macro(totals.protein, 'Protein', cmp?.proteinG),
      macro(totals.carbs, 'KH', cmp?.carbsG),
      macro(totals.fat, 'Fett', cmp?.fatG),
      macro(totals.fiber, 'Ballaststoffe', cmp?.fiberG),
    ]),
  ]);
}

// ── Ansichten ────────────────────────────────────────────────────────────────

function todayView(days: readonly PlannedDay[], goals: DayGoals | null): HTMLElement {
  const now = new Date();
  const today = berlinWeekday(now);
  const day = days.find((d) => d.day === today);
  const root = el('div', { class: 'stack' });
  if (!day) return root;

  root.appendChild(totalsCard(`${WEEKDAY_NAMES[today]}, ${longDate(berlinDay(now))}`, dayMacros(day, FOODS), goals, true));
  for (const slot of day.slots) root.appendChild(mealCard(day, slot));
  return root;
}

function weekView(days: readonly PlannedDay[], goals: DayGoals | null): HTMLElement {
  const today = berlinWeekday(new Date());
  const root = el('div', { class: 'stack' });
  let week = ZERO_MACROS;

  const dayCount = days.length;
  for (const day of days) week = addMacros(week, dayMacros(day, FOODS));
  if (dayCount > 0) {
    root.appendChild(totalsCard('Tagesmittel der Woche', {
      kcal: week.kcal / dayCount, protein: week.protein / dayCount, carbs: week.carbs / dayCount, fat: week.fat / dayCount, fiber: week.fiber / dayCount,
    }, goals, false));
  }

  for (const day of days) {
    const totals = dayMacros(day, FOODS);
    const cmp = goals ? compareToGoals(totals, goals) : null;
    const basis = [goalText(cmp?.caloriesKcal, ''), `${integer(totals.protein)} g Protein${cmp?.proteinG ? `, Ziel ${target(cmp.proteinG.goal)}` : ''}`]
      .filter(Boolean)
      .join(', ');
    const title = day.day === today ? `${WEEKDAY_NAMES[day.day]}, heute` : WEEKDAY_NAMES[day.day];
    const card = el('section', { class: 'card' }, [
      span('card-label', title),
      el('div', { class: 'card-value', text: integer(totals.kcal) }, [el('small', { text: 'kcal' })]),
      el('div', { class: 'card-basis', text: basis }),
    ]);
    for (const slot of day.slots) card.append(...mealRow(day, slot));
    root.appendChild(card);
  }
  return root;
}

/** Platzhalter, bis der Chunk der Kochansicht geladen ist. */
function cookSlot(session: PrepSessionResult, focus: string | null): HTMLElement {
  const slot = el('div');
  loadCook()
    .then((module) => {
      const cook = module.cookView({
        session,
        mealName: (mealId) => context.mealsById.get(mealId)?.name ?? mealId,
        onClose: () => {
          cooking = null;
          rerender();
        },
      });
      slot.replaceChildren(cook);
      if (scrollToCook) cook.scrollIntoView({ block: 'start' });
      scrollToCook = false;
      const root = byId('plan-content');
      if (root) restoreFocus(root, focus);
    })
    .catch(() => slot.replaceChildren(el('p', { class: 'err', text: 'Kochansicht nicht geladen' })));
  return slot;
}

function cookButton(session: PrepSessionResult): HTMLButtonElement {
  const button = el('button', {
    class: 'btn-primary',
    attrs: { type: 'button', [FOCUS_ATTR]: `cook-${session.id}` },
  }, [icon(['M12 5.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z', 'M12 9.5V13l2.5 1.5M10 2.5h4']), document.createTextNode('Kochen')]);
  button.addEventListener('click', () => {
    cooking = session.id;
    scrollToCook = true;
    rerender();
  });
  return button;
}

function prepView(plan: ReturnType<typeof effectivePlan>, focus: string | null): HTMLElement {
  const sessions = buildPrep(context.plan.prep, plan, FOODS);
  const open = sessions.find((session) => session.id === cooking);
  if (open) return cookSlot(open, focus);
  cooking = null;

  const root = el('div');
  for (const session of sessions) {
    const done = session.steps.flatMap((step, stepIndex) => step.lines.map((line) => `${session.id}|${stepIndex}|${line.foodId}`))
      .filter((key) => prepDone.has(key)).length;
    const total = session.steps.reduce((sum, step) => sum + step.lines.length, 0);
    const list = el('div', { class: 'list' });
    session.steps.forEach((step, stepIndex) => {
      const block = el('div', {}, [el('div', { class: 'step-title' }, [el('b', { text: step.title }), span('', step.device)])]);
      if (step.lines.length === 0) block.appendChild(el('div', { class: 'step-empty', text: 'Keine Mengen in dieser Rotation' }));
      for (const line of step.lines) {
        const key = `${session.id}|${stepIndex}|${line.foodId}`;
        const uses = line.uses
          .map((u) => `${context.mealsById.get(u.mealId)?.name ?? u.mealId}: ${[...new Set(u.days)].join(' ')}`)
          .join(', ');
        block.appendChild(checkRow({
          key,
          label: line.name,
          detail: span('check-sub', uses),
          quantity: line.grams === null ? '' : grams(line.grams),
          checked: prepDone.has(key),
          onChange: () => setPrepDone(key),
        }));
      }
      list.appendChild(block);
    });
    root.append(
      el('h3', { class: 'group-title', text: session.title }),
      el('div', { class: 'group-sub', text: `${integer(done)} von ${integer(total)} abgehakt` }),
      cookButton(session),
      list,
    );
  }
  return root;
}

// ── Aufbau ───────────────────────────────────────────────────────────────────

function toolbar(): HTMLElement | null {
  // Die Wahl der Ansicht sitzt in der Segmentleiste der Shell.
  const bar = el('div', { class: 'toolbar' });

  if (view === 'proposal') return null;
  if (view === 'prep' && cooking !== null) return null;
  const resetsPrep = view === 'prep';
  const needed = resetsPrep ? prepDone.size > 0 : hasOverrides(overrides);
  if (needed) {
    const reset = el('button', {
      class: 'btn btn-tap',
      text: resetsPrep ? 'Abhaken zurücksetzen' : 'Plan zurücksetzen',
      attrs: { type: 'button', [FOCUS_ATTR]: 'reset' },
    });
    reset.addEventListener('click', () => {
      if (resetsPrep) {
        prepDone = new Set();
        saveChecked(PREP_DONE_KEY, prepDone);
        rerender();
      } else {
        applyOverrides({ swaps: {}, bar: {} });
      }
    });
    bar.appendChild(reset);
    return bar;
  }
  return null;
}

/** Herkunft des Plans. Steht nur da, wenn ein Plan gespeichert ist, gueltig oder nicht. */
function sourceBar(): HTMLElement | null {
  if (!hasStoredPlan()) return null;
  const source = context.source;
  const label = source.kind === 'active'
    ? `Vorschlag ${longDate(source.active.createdAt.slice(0, 10))}, ${source.active.model}`
    : 'Seed';
  const button = el('button', {
    class: 'btn btn-tap',
    text: 'Zurück zum Seed',
    attrs: { type: 'button', [FOCUS_ATTR]: 'seed' },
  });
  button.addEventListener('click', () => {
    returnToSeed();
    rerender();
  });
  const bar = el('div', { class: 'toolbar' }, [span('toolbar-note', label), button]);
  if (source.kind === 'active') {
    const active = source.active;
    const exportButton = el('button', { class: 'btn btn-tap', text: 'Export', attrs: { type: 'button', [FOCUS_ATTR]: 'export' } });
    exportButton.addEventListener('click', () => void loadGenerator().then((module) => module.downloadPlanFiles(active)));
    bar.appendChild(exportButton);
  }
  return bar;
}

/** Platzhalter, bis der Chunk der Ansicht Vorschlag geladen ist. */
function proposalSlot(days: readonly PlannedDay[], goals: DayGoals | null, focus: string | null): HTMLElement {
  const slot = el('div');
  const activeDays = days.map((day) => roundedDayValues(day, FOODS));
  loadGenerator()
    .then((module) => {
      slot.replaceChildren(module.generatorView({
        goals,
        activeDays,
        rerender,
        onAdopted: () => {
          view = 'week';
          viewListener(view);
          rerender();
        },
      }));
      const root = byId('plan-content');
      if (root) restoreFocus(root, focus);
    })
    .catch(() => slot.replaceChildren(el('p', { class: 'err', text: 'Ansicht Vorschlag nicht geladen' })));
  return slot;
}

/** Setzt die Ansicht aus der Route. `true`, wenn sie sich geaendert hat und neu gezeichnet werden muss. */
export function setPlanView(next: PlanView): boolean {
  if (next === view) return false;
  view = next;
  return true;
}

export function onPlanViewChange(listener: (next: PlanView) => void): void {
  viewListener = listener;
}

function rerender(): void {
  renderPlan(lastGoals);
}

/** Zeichnet den Reiter Plan. `goals` sind die Sheet Ziele, `null` ohne Sheet. */
export function renderPlan(goals: DayGoals | null): void {
  const root = byId('plan-content');
  if (!root) return;
  lastGoals = goals;
  const focus = focusedKey();

  context = planContext(getPlanSource(goals));
  const plan = effectivePlan(context.plan.rotation, overrides, context.plan.meals);
  const issues = [...context.source.issues, ...validatePlan(context.plan), ...plan.issues];

  const content = el('div');
  const source = sourceBar();
  if (source) content.appendChild(source);
  const bar = toolbar();
  if (bar) content.appendChild(bar);
  for (const issue of issues) content.appendChild(el('p', { class: 'err', text: issue }));
  if (view === 'today') content.appendChild(todayView(plan.days, goals));
  else if (view === 'week') content.appendChild(weekView(plan.days, goals));
  else if (view === 'prep') content.appendChild(prepView(plan, focus));
  else content.appendChild(proposalSlot(plan.days, goals, focus));

  root.replaceChildren(content);
  restoreFocus(root, focus);
}
