import { DAY_TOLERANCE, PRICES_AS_OF } from '../config/generator';
import { FOODS, PLAN, indexById } from '../nutrition/plan';
import { berlinDay } from '../nutrition/dates';
import { WEEKDAYS } from '../nutrition/types';
import type { Meal, Weekday } from '../nutrition/types';
import type { DayGoals } from '../parse/goals';
import type { DayCheck } from '../generator/check';
import type { RunCost } from '../generator/cost';
import { exportPlanFiles } from '../generator/export';
import { buildGeneratorInput, generateReadiness } from '../generator/input';
import type { ProposalStatus, TokenProgress } from '../generator/request';
import type { Proposal } from '../generator/response';
import { allowedFoodIds } from '../generator/schema';
import { loadApiKey, loadExclusions, saveExclusions } from '../generator/state';
import { FOCUS_ATTR, checkRow, el, span } from './build';
import { downloadText } from './export';
import { decimal, integer } from './format';
import { adoptPlan } from './planSource';
import { loadPriceData } from './priceData';

/**
 * Ansicht Vorschlag im Reiter Plan: Ausschluesse, Wunsch, Knopf, Status des
 * Laufs und Vorschau neben dem aktiven Plan. Wird erst beim Oeffnen der Ansicht
 * geladen, `request.ts` und das SDK erst beim Knopfdruck.
 *
 * Texte aus der Modellantwort gehen nur ueber `el` und `span`, also per
 * `textContent`, ins DOM.
 */

export interface GeneratorContext {
  goals: DayGoals | null;
  /** Tageswerte des aktiven Plans, gerundet wie die Pruefung. */
  activeDays: readonly DayCheck[];
  rerender: () => void;
  /** Nach der Uebernahme, etwa um auf die Wochenansicht zu wechseln. */
  onAdopted: () => void;
}

interface Run {
  controller: AbortController;
  startedAt: number;
  tokens: TokenProgress;
  timer: ReturnType<typeof setInterval>;
}

interface Result {
  status: ProposalStatus;
  line: string;
}

const NO_EXCLUSIONS: ReadonlySet<string> = new Set();
const MS_PER_SECOND = 1000;
const USD_DIGITS = 2;

const FOODS_BY_ID = indexById(FOODS);

let exclusions: Set<string> = loadExclusions();
let wish = '';
let exclusionsOpen = false;
let run: Run | null = null;
let result: Result | null = null;
let context: GeneratorContext | null = null;
/** Zeile, die waehrend des Laufs ohne Neuzeichnen fortgeschrieben wird. */
let liveLine: HTMLElement | null = null;

// ── Lauf ─────────────────────────────────────────────────────────────────────

function liveText(current: Run): string {
  const seconds = Math.floor((Date.now() - current.startedAt) / MS_PER_SECOND);
  return `Läuft ${seconds} s, ${integer(current.tokens.inputTokens)} Eingabe, ${integer(current.tokens.outputTokens)} Ausgabe Tokens`;
}

function updateLive(): void {
  if (run && liveLine) liveLine.textContent = liveText(run);
}

async function loadRequestModule(): Promise<typeof import('../generator/request') | null> {
  try {
    return await import('../generator/request');
  } catch {
    return null;
  }
}

async function startRun(goals: DayGoals): Promise<void> {
  const apiKey = loadApiKey();
  if (apiKey === null || run !== null) return;

  const prices = (await loadPriceData()).prices;
  const runExclusions = new Set(exclusions);
  const input = buildGeneratorInput({
    plan: PLAN,
    goals,
    exclusions: runExclusions,
    wish,
    offers: prices?.offers ?? null,
    today: berlinDay(new Date()),
    tolerance: DAY_TOLERANCE,
  });
  // Der Knopf ist ohne vollstaendige Ziele gesperrt, hier nur zur Sicherheit.
  if (!input) return;

  const controller = new AbortController();
  run = { controller, startedAt: Date.now(), tokens: { inputTokens: 0, outputTokens: 0 }, timer: setInterval(updateLive, MS_PER_SECOND) };
  result = null;
  context?.rerender();

  const module = await loadRequestModule();
  if (!module) {
    finishRun({ status: { kind: 'sdk-load' }, line: 'SDK nicht geladen' });
    return;
  }
  const status = await module.requestProposal(
    { apiKey, input, base: PLAN, goals, exclusions: runExclusions },
    {
      signal: controller.signal,
      onTokens: (tokens) => {
        if (run) run.tokens = tokens;
        updateLive();
      },
    },
  );
  finishRun({ status, line: module.statusLine(status) });
}

function finishRun(next: Result): void {
  if (run) clearInterval(run.timer);
  run = null;
  result = next;
  context?.rerender();
}

function adopt(status: Extract<ProposalStatus, { kind: 'checked' }>): void {
  adoptPlan({ ...status.proposal, createdAt: new Date().toISOString(), model: status.model });
  result = null;
  context?.onAdopted();
}

/** Laedt die drei Plandateien herunter, fuer einen Vorschlag wie fuer den aktiven Plan. */
export function downloadPlanFiles(plan: Pick<Proposal, 'meals' | 'rotation' | 'prep'>): void {
  for (const file of exportPlanFiles(plan)) downloadText(file.name, file.content, 'application/json');
}

// ── Eingaben ─────────────────────────────────────────────────────────────────

function setExcluded(foodId: string, excluded: boolean): void {
  exclusions = new Set(exclusions);
  if (excluded) exclusions.add(foodId);
  else exclusions.delete(foodId);
  saveExclusions(exclusions);
  context?.rerender();
}

function exclusionPicker(): HTMLElement {
  const candidates = allowedFoodIds(PLAN, NO_EXCLUSIONS)
    .map((id) => FOODS_BY_ID.get(id))
    .filter((food) => food !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const chosen = candidates.filter((food) => exclusions.has(food.id)).length;

  const details = el('details', { class: 'gen-exclusions' }, [
    el('summary', { class: 'gen-summary num', text: `Ausschlüsse ${chosen} von ${candidates.length}`, attrs: { [FOCUS_ATTR]: 'gen-exclusions' } }),
  ]);
  details.open = exclusionsOpen;
  details.addEventListener('toggle', () => {
    exclusionsOpen = details.open;
  });
  for (const food of candidates) {
    details.appendChild(checkRow({
      key: `exclude-${food.id}`,
      label: food.name,
      checked: exclusions.has(food.id),
      onChange: (checked) => setExcluded(food.id, checked),
    }));
  }
  return details;
}

function wishField(): HTMLTextAreaElement {
  const field = el('textarea', {
    class: 'gen-wish',
    attrs: { rows: '2', placeholder: 'Wünsche', 'aria-label': 'Wünsche', [FOCUS_ATTR]: 'gen-wish' },
  });
  field.value = wish;
  field.addEventListener('input', () => {
    wish = field.value;
  });
  return field;
}

function runControls(goals: DayGoals | null): HTMLElement {
  const box = el('div', { class: 'toolbar' });
  if (run) {
    const current = run;
    const cancel = el('button', { class: 'btn btn-tap', text: 'Abbrechen', attrs: { type: 'button', [FOCUS_ATTR]: 'gen-run' } });
    cancel.addEventListener('click', () => current.controller.abort());
    liveLine = span('toolbar-note', liveText(current));
    box.append(cancel, liveLine);
    return box;
  }

  liveLine = null;
  const readiness = generateReadiness(loadApiKey(), goals, PLAN, exclusions);
  const button = el('button', { class: 'btn btn-tap', text: 'Vorschlag erzeugen', attrs: { type: 'button', [FOCUS_ATTR]: 'gen-run' } });
  button.disabled = !readiness.enabled;
  if (readiness.enabled && goals) button.addEventListener('click', () => void startRun(goals));
  box.appendChild(button);
  for (const reason of readiness.reasons) box.appendChild(span('toolbar-note', reason));
  return box;
}

// ── Ergebnis ─────────────────────────────────────────────────────────────────

function costLine(cost: RunCost): string {
  const usd = cost.usd === null ? 'Kosten unbekannt' : `Kosten ${decimal(cost.usd, USD_DIGITS)} $`;
  return `${usd}, ${integer(cost.inputTokens)} Eingabe, ${integer(cost.outputTokens)} Ausgabe Tokens, Preise ${PRICES_AS_OF}`;
}

function servedLines(status: ProposalStatus): HTMLElement[] {
  if (!('cost' in status)) return [];
  const model = status.fallback ? `${status.model}, Fallback` : status.model;
  return [el('p', { class: 'card-basis', text: model }), el('p', { class: 'card-basis', text: costLine(status.cost) })];
}

function dayValues(day: DayCheck): string {
  return `${integer(day.kcal)} kcal, ${integer(day.protein)} g Protein, ${integer(day.fat)} g Fett, ${integer(day.carbs)} g KH, ${integer(day.fiber)} g Ballaststoffe`;
}

/** Tageswerte des Vorschlags, darunter die des aktiven Plans. */
function dayComparison(days: readonly DayCheck[], active: readonly DayCheck[]): HTMLElement {
  const activeByDay = new Map(active.map((day) => [day.day, day]));
  const list = el('div', { class: 'gen-days' });
  for (const day of days) {
    const current = activeByDay.get(day.day);
    list.appendChild(el('div', { class: 'gen-day' }, [
      span('gen-day-name', day.day),
      el('div', {}, [
        el('div', { class: 'num', text: dayValues(day) }),
        current ? el('div', { class: 'card-basis', text: `Aktiv ${dayValues(current)}` }) : null,
      ]),
    ]));
  }
  return list;
}

function mealDays(meal: Meal, proposal: Proposal): Weekday[] {
  return WEEKDAYS.filter((day) => proposal.rotation[day][meal.slot] === meal.id);
}

function mealList(proposal: Proposal): HTMLElement {
  const root = el('div', { class: 'card stack' });
  for (const meal of proposal.meals) {
    const ingredients = meal.ingredients
      .map((ing) => {
        const name = FOODS_BY_ID.get(ing.foodId)?.name ?? ing.foodId;
        return ing.grams > 0 ? `${name} ${integer(ing.grams)} g` : name;
      })
      .join(', ');
    root.appendChild(el('section', { class: 'gen-meal' }, [
      span('slot', meal.slot),
      el('div', {}, [span('meal-name', meal.name), span('meal-sub', mealDays(meal, proposal).join(' '))]),
      el('p', { text: ingredients }),
    ]));
  }
  return root;
}

function prepList(proposal: Proposal): HTMLElement {
  const root = el('div', { class: 'card stack' });
  for (const session of proposal.prep) {
    root.appendChild(el('h4', { class: 'gen-subtitle', text: session.title }));
    for (const step of session.steps) {
      root.appendChild(el('div', { class: 'step-title' }, [el('b', { text: step.title }), span('', step.device)]));
    }
  }
  return root;
}

function issueList(issues: readonly string[]): HTMLElement[] {
  return issues.map((issue) => el('p', { class: 'err', text: issue }));
}

function checkedView(status: Extract<ProposalStatus, { kind: 'checked' }>, active: readonly DayCheck[]): HTMLElement {
  const root = el('div');
  if (status.check.passed) {
    const adoptButton = el('button', { class: 'btn btn-tap', text: 'Übernehmen', attrs: { type: 'button', [FOCUS_ATTR]: 'gen-adopt' } });
    adoptButton.addEventListener('click', () => adopt(status));
    const exportButton = el('button', { class: 'btn btn-tap', text: 'Export', attrs: { type: 'button', [FOCUS_ATTR]: 'gen-export' } });
    exportButton.addEventListener('click', () => downloadPlanFiles(status.proposal));
    root.appendChild(el('div', { class: 'toolbar' }, [adoptButton, exportButton]));
  }
  root.append(...issueList(status.check.issues));
  if (status.check.days.length > 0) root.appendChild(dayComparison(status.check.days, active));

  root.appendChild(el('h3', { class: 'group-title', text: 'Gerichte' }));
  root.appendChild(mealList(status.proposal));
  root.appendChild(el('h3', { class: 'group-title', text: 'Prep' }));
  root.appendChild(prepList(status.proposal));
  if (status.proposal.wishlist.length > 0) {
    root.appendChild(el('h3', { class: 'group-title', text: 'Wunschliste' }));
    const list = el('ul', { class: 'card gen-list stack' });
    for (const entry of status.proposal.wishlist) list.appendChild(el('li', { text: entry }));
    root.appendChild(list);
  }
  return root;
}

function resultView(current: Result, active: readonly DayCheck[]): HTMLElement {
  const status = current.status;
  const passed = status.kind === 'checked' && status.check.passed;
  const root = el('section', { class: 'gen-result' }, [
    el('p', { class: passed ? 'gen-status num' : 'gen-status err num', text: current.line }),
    ...servedLines(status),
  ]);
  if (status.kind === 'checked') root.appendChild(checkedView(status, active));
  if (status.kind === 'invalid') root.append(...issueList(status.issues));
  return root;
}

// ── Aufbau ───────────────────────────────────────────────────────────────────

export function generatorView(ctx: GeneratorContext): HTMLElement {
  context = ctx;
  const form = el('section', { class: 'card gen-form' }, [exclusionPicker(), wishField(), runControls(ctx.goals)]);
  const root = el('div', {}, [form]);
  if (result) root.appendChild(resultView(result, ctx.activeDays));
  return root;
}
