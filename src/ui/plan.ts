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
import { FOCUS_ATTR, checkRow, el, focusedKey, restoreFocus, segmented, span } from './build';
import { getPlanSource, hasStoredPlan, onPlanSourceChange, returnToSeed } from './planSource';

type View = 'today' | 'week' | 'prep' | 'proposal';

const VIEW_CHOICES: readonly { value: View; text: string }[] = [
  { value: 'today', text: 'Heute' },
  { value: 'week', text: 'Woche' },
  { value: 'prep', text: 'Prep' },
  { value: 'proposal', text: 'Vorschlag' },
];

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

let view: View = 'today';
let overrides: Overrides = loadOverrides();
let prepDone: Set<string> = loadChecked(PREP_DONE_KEY);
let lastGoals: DayGoals | null = null;
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

function seasoningLine(grouped: Grouped): HTMLElement | null {
  const sauces = grouped.items.filter((i) => i.food.kind === 'sauce');
  if (sauces.length === 0 && grouped.spices.length === 0) return null;
  const parts: string[] = [];
  for (const s of sauces) parts.push(`Soße ${s.food.name} ${grams(s.grams)}`);
  if (grouped.spices.length > 0) parts.push(`Gewürze ${grouped.spices.map((f) => f.name).join(', ')}`);
  return el('div', { class: 'pl-season', text: parts.join(', ') });
}

function mealSelect(day: Weekday, planned: PlannedSlot): HTMLSelectElement {
  const select = el('select', {
    class: 'pl-select',
    attrs: { 'aria-label': `Gericht ${planned.slot} ${WEEKDAY_NAMES[day]}`, [FOCUS_ATTR]: `swap-${day}-${planned.slot}` },
  });
  for (const meal of context.plan.meals.filter((m) => m.slot === planned.slot)) {
    const option = el('option', { text: meal.name, attrs: { value: meal.id } });
    option.selected = meal.id === planned.mealId;
    select.appendChild(option);
  }
  select.addEventListener('change', () => setSwap(day, planned.slot, select.value));
  return select;
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

function mealBlock(day: PlannedDay, planned: PlannedSlot, compact: boolean): HTMLElement {
  const macros = sumIngredients(planned.ingredients, FOODS_BY_ID);
  const grouped = groupIngredients(planned.ingredients);

  const head = el('div', { class: 'pl-meal-head' }, [
    span('pl-slot', planned.slot),
    mealSelect(day.day, planned),
    span('pl-kcal num', `${integer(macros.kcal)} kcal`),
  ]);
  const block = el('section', { class: 'pl-meal' }, [head]);

  if (compact) {
    const seasoning = seasoningLine(grouped);
    if (seasoning) block.appendChild(seasoning);
  } else {
    block.appendChild(el('div', { class: 'pl-macros num', text: macroLine(macros) }));
    const list = el('ul', { class: 'pl-ing' });
    for (const item of grouped.items) {
      const name = item.food.kind === 'sauce' ? `${item.food.name} (Soße)` : item.food.name;
      list.appendChild(el('li', {}, [span('pl-ing-name', name), span('pl-ing-qty num', grams(item.grams))]));
    }
    block.appendChild(list);
    if (grouped.spices.length > 0) {
      block.appendChild(el('div', { class: 'pl-season', text: `Gewürze ${grouped.spices.map((f) => f.name).join(', ')}` }));
    }
  }
  const bar = barToggle(day, planned);
  if (bar) block.appendChild(bar);
  return block;
}

function metricRow(label: string, actual: number, unit: string, goalText: string | null): HTMLElement {
  return el('div', { class: 'metric' }, [
    span('metric-label', label),
    span('metric-value num', `${integer(actual)} ${unit}`),
    goalText ? span('metric-sub num', goalText) : null,
  ]);
}

/** Tagessumme. Ohne Ziel aus dem Sheet steht nur die Summe da, nie ein Ersatzwert. */
function totalsBlock(totals: Macros, goals: DayGoals | null): HTMLElement {
  const cmp = goals ? compareToGoals(totals, goals) : null;
  const sub = (c: { goal: number; diff: number } | null | undefined, unit: string): string | null =>
    c ? `Ziel ${target(c.goal)} ${unit}, ${signed(Math.round(c.diff), 0)}` : null;
  return el('div', { class: 'pl-totals' }, [
    metricRow('Kalorien', totals.kcal, 'kcal', sub(cmp?.caloriesKcal, 'kcal')),
    metricRow('Protein', totals.protein, 'g', sub(cmp?.proteinG, 'g')),
    metricRow('Kohlenhydrate', totals.carbs, 'g', sub(cmp?.carbsG, 'g')),
    metricRow('Fett', totals.fat, 'g', sub(cmp?.fatG, 'g')),
    metricRow('Ballaststoffe', totals.fiber, 'g', sub(cmp?.fiberG, 'g')),
  ]);
}

// ── Ansichten ────────────────────────────────────────────────────────────────

function todayView(days: readonly PlannedDay[], goals: DayGoals | null): HTMLElement {
  const now = new Date();
  const today = berlinWeekday(now);
  const day = days.find((d) => d.day === today);
  const root = el('div');
  if (!day) return root;

  root.appendChild(el('div', { class: 'pl-head' }, [
    el('h3', { class: 'panel-title', text: `Heute, ${WEEKDAY_NAMES[today]}` }),
    span('section-sub', longDate(berlinDay(now))),
  ]));
  for (const slot of day.slots) root.appendChild(mealBlock(day, slot, false));
  root.appendChild(el('h3', { class: 'panel-title pl-total-title', text: 'Tagessumme' }));
  root.appendChild(totalsBlock(dayMacros(day, FOODS), goals));
  return root;
}

function weekView(days: readonly PlannedDay[], goals: DayGoals | null): HTMLElement {
  const today = berlinWeekday(new Date());
  const root = el('div');
  let week = ZERO_MACROS;

  for (const day of days) {
    const totals = dayMacros(day, FOODS);
    week = addMacros(week, totals);
    const cmp = goals ? compareToGoals(totals, goals) : null;
    const goalText = cmp?.caloriesKcal ? `, Ziel ${target(cmp.caloriesKcal.goal)}` : '';
    const proteinText = cmp?.proteinG ? `, Ziel ${target(cmp.proteinG.goal)}` : '';

    const title = day.day === today ? `${WEEKDAY_NAMES[day.day]}, heute` : WEEKDAY_NAMES[day.day];
    const block = el('section', { class: day.day === today ? 'pl-day is-today' : 'pl-day' }, [
      el('div', { class: 'pl-head' }, [
        el('h3', { class: 'panel-title', text: title }),
        span('section-sub num', `${integer(totals.kcal)} kcal${goalText}, ${integer(totals.protein)} g Protein${proteinText}`),
      ]),
    ]);
    for (const slot of day.slots) block.appendChild(mealBlock(day, slot, true));
    root.appendChild(block);
  }

  const dayCount = days.length;
  if (dayCount > 0) {
    root.appendChild(el('h3', { class: 'panel-title pl-total-title', text: 'Tagesmittel der Woche' }));
    root.appendChild(totalsBlock(
      { kcal: week.kcal / dayCount, protein: week.protein / dayCount, carbs: week.carbs / dayCount, fat: week.fat / dayCount, fiber: week.fiber / dayCount },
      goals,
    ));
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
    class: 'btn btn-tap',
    text: 'Kochen',
    attrs: { type: 'button', [FOCUS_ATTR]: `cook-${session.id}` },
  });
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
    const panel = el('section', { class: 'panel' }, [
      el('div', { class: 'pl-head' }, [el('h3', { class: 'panel-title', text: session.title }), cookButton(session)]),
    ]);
    session.steps.forEach((step, stepIndex) => {
      const stepBlock = el('div', { class: 'pl-step' }, [
        el('div', { class: 'pl-step-head' }, [span('pl-step-title', step.title), span('pl-device', step.device)]),
      ]);
      if (step.lines.length === 0) stepBlock.appendChild(el('div', { class: 'pl-season', text: 'Keine Mengen in dieser Rotation' }));
      for (const line of step.lines) {
        const key = `${session.id}|${stepIndex}|${line.foodId}`;
        const uses = line.uses
          .map((u) => `${context.mealsById.get(u.mealId)?.name ?? u.mealId}: ${[...new Set(u.days)].join(' ')}`)
          .join(', ');
        const quantity = line.grams === null ? '' : grams(line.grams);
        stepBlock.appendChild(checkRow({
          key,
          label: line.name,
          detail: span('check-sub', uses),
          quantity,
          checked: prepDone.has(key),
          onChange: () => setPrepDone(key),
        }));
      }
      panel.appendChild(stepBlock);
    });
    root.appendChild(panel);
  }
  return root;
}

// ── Aufbau ───────────────────────────────────────────────────────────────────

function toolbar(): HTMLElement {
  const bar = el('div', { class: 'pl-toolbar' }, [
    segmented('Ansicht', VIEW_CHOICES, view, (next) => {
      view = next;
      rerender();
    }),
  ]);

  if (view === 'proposal') return bar;
  if (view === 'prep' && cooking !== null) return bar;
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
  }
  return bar;
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
  const bar = el('div', { class: 'pl-toolbar' }, [span('section-sub num', label), button]);
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
          rerender();
        },
      }));
      const root = byId('plan-content');
      if (root) restoreFocus(root, focus);
    })
    .catch(() => slot.replaceChildren(el('p', { class: 'err', text: 'Ansicht Vorschlag nicht geladen' })));
  return slot;
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
  content.appendChild(toolbar());
  for (const issue of issues) content.appendChild(el('p', { class: 'err', text: issue }));
  if (view === 'today') content.appendChild(todayView(plan.days, goals));
  else if (view === 'week') content.appendChild(weekView(plan.days, goals));
  else if (view === 'prep') content.appendChild(prepView(plan, focus));
  else content.appendChild(proposalSlot(plan.days, goals, focus));

  root.replaceChildren(content);
  restoreFocus(root, focus);
}
