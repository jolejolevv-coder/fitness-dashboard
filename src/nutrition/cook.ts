import type { PrepSessionResult, PrepStepResult } from './prep';
import type { Recipe } from './types';
import { MISE_EN_PLACE_POSITION, MS_PER_MINUTE, MS_PER_SECOND, SECONDS_PER_MINUTE } from '../config/cook';

/**
 * Rechenkern der Kochansicht. Reine Funktionen ohne DOM und ohne Speicher,
 * die Zeit kommt immer als Parameter `now` in Millisekunden.
 */

// Mise en place

export interface MiseLine {
  foodId: string;
  name: string;
  /** Summe ueber alle Schritte der Session, null bei Gewuerzen. */
  grams: number | null;
}

/** Jede Zutat der Session genau einmal, in der Reihenfolge des ersten Auftretens. */
export function buildMiseEnPlace(session: PrepSessionResult): MiseLine[] {
  const byFood = new Map<string, MiseLine>();
  for (const step of session.steps) {
    for (const line of step.lines) {
      const entry = byFood.get(line.foodId) ?? { foodId: line.foodId, name: line.name, grams: line.grams === null ? null : 0 };
      if (entry.grams !== null && line.grams !== null) entry.grams += line.grams;
      byFood.set(line.foodId, entry);
    }
  }
  return [...byFood.values()];
}

// Schritt zu Rezept

export interface CookStep {
  step: PrepStepResult;
  /** Null, wenn der Schritt keine `id` hat oder `recipes.json` keinen Eintrag kennt. */
  recipe: Recipe | null;
}

export interface CookSession {
  id: string;
  title: string;
  steps: CookStep[];
  /** Zahl der Schritte mit Anweisung, fuer `Anweisungen N von M Schritten`. */
  instructed: number;
}

export function attachRecipes(session: PrepSessionResult, recipes: readonly Recipe[]): CookSession {
  const byStep = new Map(recipes.map((recipe) => [recipe.stepId, recipe]));
  const steps = session.steps.map((step) => ({ step, recipe: (step.id !== undefined ? byStep.get(step.id) : undefined) ?? null }));
  return {
    id: session.id,
    title: session.title,
    steps,
    instructed: steps.filter((s) => s.recipe !== null).length,
  };
}

// Timer

export type TimerEvent = 'hold' | 'end';
const TIMER_EVENTS: readonly TimerEvent[] = ['hold', 'end'];

/**
 * Ein laufender Timer. Gerechnet wird ueber Endzeitpunkte, nie ueber gezaehlte
 * Ticks, damit Neuladen und Hintergrund Tabs die Restzeit nicht verfaelschen.
 */
export interface CookTimer {
  stepId: string;
  endsAt: number;
  /** Zeitpunkt des Zwischenhalts, null ohne Halt. */
  holdAt: number | null;
  /** Bereits gemeldete Ereignisse, damit nach Neuladen nichts doppelt klingelt. */
  reported: TimerEvent[];
}

export function startTimer(recipe: Recipe, now: number): CookTimer {
  return {
    stepId: recipe.stepId,
    endsAt: now + recipe.minutes * MS_PER_MINUTE,
    holdAt: recipe.hold ? now + recipe.hold.afterMinutes * MS_PER_MINUTE : null,
    reported: [],
  };
}

export function remainingMs(timer: CookTimer, now: number): number {
  return Math.max(0, timer.endsAt - now);
}

export function isFinished(timer: CookTimer, now: number): boolean {
  return now >= timer.endsAt;
}

/** Erreichte, aber noch nicht gemeldete Ereignisse, Halt vor Ende. */
export function dueEvents(timer: CookTimer, now: number): TimerEvent[] {
  const due: TimerEvent[] = [];
  if (timer.holdAt !== null && now >= timer.holdAt && !timer.reported.includes('hold')) due.push('hold');
  if (isFinished(timer, now) && !timer.reported.includes('end')) due.push('end');
  return due;
}

export function withReported(timer: CookTimer, events: readonly TimerEvent[]): CookTimer {
  const reported = TIMER_EVENTS.filter((event) => timer.reported.includes(event) || events.includes(event));
  return { ...timer, reported };
}

/** Restzeit als `m:ss`, angebrochene Sekunden aufgerundet. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Zustand fitness_cook_v1

export interface CookSessionState {
  /** Abgehakte Zutaten der Mise en place als `foodId`. */
  checked: string[];
  /** 0 ist die Mise en place, N der Schritt N. */
  position: number;
  timers: CookTimer[];
}

/** Zustand je Prep Session, Schluessel ist die Session `id`. */
export type CookState = Record<string, CookSessionState>;

export const EMPTY_SESSION_STATE: CookSessionState = { checked: [], position: MISE_EN_PLACE_POSITION, timers: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function parseTimer(value: unknown): CookTimer | null {
  if (!isRecord(value)) return null;
  const { stepId, endsAt, holdAt, reported } = value;
  if (typeof stepId !== 'string' || stepId === '') return null;
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) return null;
  if (holdAt !== null && !(typeof holdAt === 'number' && Number.isFinite(holdAt) && holdAt < endsAt)) return null;
  if (!isStringArray(reported) || !reported.every((event) => (TIMER_EVENTS as readonly string[]).includes(event))) return null;
  return { stepId, endsAt, holdAt, reported: TIMER_EVENTS.filter((event) => reported.includes(event)) };
}

/** Ein Session Eintrag mit auch nur einem unbrauchbaren Feld gilt als beschaedigt. */
function parseSessionState(value: unknown): CookSessionState | null {
  if (!isRecord(value)) return null;
  const { checked, position, timers } = value;
  if (!isStringArray(checked)) return null;
  if (typeof position !== 'number' || !Number.isInteger(position) || position < MISE_EN_PLACE_POSITION) return null;
  if (!Array.isArray(timers)) return null;
  const parsed = timers.map(parseTimer);
  if (parsed.some((timer) => timer === null)) return null;
  const valid = parsed.filter((timer): timer is CookTimer => timer !== null);
  if (new Set(valid.map((timer) => timer.stepId)).size !== valid.length) return null;
  return { checked: [...new Set(checked)], position, timers: valid };
}

/** Liest den gespeicherten Zustand. Beschaedigte Session Eintraege werden verworfen, nie repariert. */
export function parseCookState(raw: string | null): CookState {
  if (raw === null) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isRecord(data)) return {};
  const entries: [string, CookSessionState][] = [];
  for (const [sessionId, value] of Object.entries(data)) {
    const parsed = parseSessionState(value);
    if (parsed) entries.push([sessionId, parsed]);
  }
  return Object.fromEntries(entries);
}

export function serializeCookState(state: CookState): string {
  const sorted = Object.entries(state).map(([id, s]): [string, CookSessionState] => [id, { ...s, checked: [...s.checked].sort() }]);
  return JSON.stringify(Object.fromEntries(sorted));
}

export function sessionState(state: CookState, sessionId: string): CookSessionState {
  return Object.hasOwn(state, sessionId) ? state[sessionId]! : EMPTY_SESSION_STATE;
}

export function withSessionState(state: CookState, sessionId: string, next: CookSessionState): CookState {
  return Object.fromEntries([...Object.entries(state).filter(([id]) => id !== sessionId), [sessionId, next]]);
}

/** Knopf Zuruecksetzen: Haken, Schritt und Timer der Session entfallen. */
export function withoutSession(state: CookState, sessionId: string): CookState {
  return Object.fromEntries(Object.entries(state).filter(([id]) => id !== sessionId));
}

export function toggleChecked(session: CookSessionState, foodId: string): CookSessionState {
  const checked = session.checked.includes(foodId) ? session.checked.filter((id) => id !== foodId) : [...session.checked, foodId];
  return { ...session, checked };
}

/** Haelt die Position innerhalb von Mise en place bis letztem Schritt, etwa nach einer Planaenderung. */
export function clampPosition(position: number, stepCount: number): number {
  return Math.min(Math.max(position, MISE_EN_PLACE_POSITION), stepCount);
}

export function withPosition(session: CookSessionState, position: number, stepCount: number): CookSessionState {
  return { ...session, position: clampPosition(position, stepCount) };
}

/** Ein Timer je Schritt, ein Neustart ersetzt den alten. */
export function withTimer(session: CookSessionState, timer: CookTimer): CookSessionState {
  return { ...session, timers: [...session.timers.filter((t) => t.stepId !== timer.stepId), timer] };
}

export function withoutTimer(session: CookSessionState, stepId: string): CookSessionState {
  return { ...session, timers: session.timers.filter((t) => t.stepId !== stepId) };
}
