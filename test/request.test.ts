import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from '@anthropic-ai/sdk';
import type { BetaMessage, BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  DAY_TOLERANCE,
  GENERATOR_EFFORT,
  GENERATOR_FALLBACK_BETA,
  GENERATOR_MAX_TOKENS,
  GENERATOR_MODEL,
  GENERATOR_TIMEOUT_MS,
  PREP_DAYS,
  TOKEN_PRICES,
} from '../src/config/generator';
import type { PlanData } from '../src/nutrition/plan';
import type { Food, Meal, PrepSession, Rotation, ShoppingItem } from '../src/nutrition/types';
import { SLOTS, WEEKDAYS } from '../src/nutrition/types';
import type { DayGoals } from '../src/parse/goals';
import { totalRunCost } from '../src/generator/cost';
import type { GeneratorInput } from '../src/generator/prompt';
import type { Proposal } from '../src/generator/response';
import type { ProposalRequest, ProposalStatus, SdkModule } from '../src/generator/request';
import { requestProposal, statusLine } from '../src/generator/request';

// ── Gemocktes SDK ───────────────────────────────────────────────────────────
// Kein Test ruft die echte API. Die Fehlerklassen bleiben echt, damit die
// Abbildung auf Status gegen dieselben Klassen laeuft wie im Browser.

interface StreamScript {
  events?: BetaRawMessageStreamEvent[];
  final?: BetaMessage;
  /** Fehler beim Oeffnen oder waehrend des Streams. */
  error?: unknown;
  /** Stream haengt, bis das Signal abbricht. */
  hang?: boolean;
}

interface Recorded {
  clientOptions: Record<string, unknown>;
  body: Record<string, unknown>;
  requestOptions: { signal?: AbortSignal };
}

const sdkMock = vi.hoisted(() => ({ script: {} as StreamScript, calls: [] as Recorded[] }));

class FakeStream {
  constructor(
    private readonly script: StreamScript,
    private readonly signal: AbortSignal | undefined,
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<BetaRawMessageStreamEvent> {
    for (const event of this.script.events ?? []) yield event;
    if (this.script.error !== undefined) throw this.script.error;
    if (this.script.hang) {
      // Wie das SDK: ein schon abgebrochenes Signal bricht sofort ab.
      await new Promise((_, reject) => {
        if (this.signal?.aborted) reject(new APIUserAbortError());
        this.signal?.addEventListener('abort', () => reject(new APIUserAbortError()));
      });
    }
  }

  finalMessage(): Promise<BetaMessage> {
    if (!this.script.final) throw new Error('kein final im Skript');
    return Promise.resolve(this.script.final);
  }
}

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<SdkModule>();
  class FakeAnthropic {
    readonly beta;
    constructor(clientOptions: Record<string, unknown>) {
      this.beta = {
        messages: {
          stream: (body: Record<string, unknown>, requestOptions: { signal?: AbortSignal }) => {
            sdkMock.calls.push({ clientOptions, body, requestOptions });
            return new FakeStream(sdkMock.script, requestOptions.signal);
          },
        },
      };
    }
  }
  return { ...actual, default: FakeAnthropic };
});

// ── Synthetische Daten mit bekanntem Ergebnis ───────────────────────────────
// Food f: 1 kcal je g, 0,1 g Protein, 0,05 g Fett. 2300 g je Tag ergeben
// genau 2300 kcal, 230 g Protein, 115 g Fett.

const SYN_KCAL = 2300;
const SYN_PROTEIN = 230;
const SYN_FAT = 115;
const SLOT_GRAMS = [500, 600, 700, 500] as const;
const OVER_BAND_GRAMS = SLOT_GRAMS[0] + DAY_TOLERANCE.kcalBand + 1;
const API_KEY = 'test-key';
const FALLBACK_MODEL = 'claude-opus-5';
const INPUT_TOKENS = 12_000;
const OUTPUT_TOKENS = 8_000;
const DECLINED_OUTPUT_TOKENS = 300;
const HTTP_RATE_LIMIT = 429;

const foodF: Food = { id: 'f', name: 'Fuel', kind: 'food', kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: 1 };
const foodX: Food = { ...foodF, id: 'x', name: 'Excluded' };

const shop = (foodId: string): ShoppingItem => ({
  foodId, category: 'dry', unit: 'g', packSizesG: [500, 1000], pantry: false, stock: false, match: { include: [], exclude: [] },
});

const meal = (id: string, slot: Meal['slot'], grams: number): Meal => ({
  id, slot, name: `Gericht ${id}`, ingredients: [{ foodId: 'f', grams }],
});

function rotation(firstMeal = 'g1'): Rotation {
  const result = {} as Rotation;
  for (const day of WEEKDAYS) result[day] = { M1: firstMeal, M2: 'g2', M3: 'g3', M4: 'g4' };
  return result;
}

const PREP: PrepSession[] = [
  { id: 'sunday', title: 'Sonntag', steps: [{ title: 'Kochen', device: 'Mikrowelle', covers: [{ slot: 'M1', days: ['Mo'], meals: ['g1'], foods: ['f'] }] }] },
];

function proposal(firstMealGrams: number = SLOT_GRAMS[0]): Proposal {
  const meals = SLOTS.map((slot, i) => meal(`g${i + 1}`, slot, i === 0 ? firstMealGrams : SLOT_GRAMS[i]!));
  return { meals, rotation: rotation(), prep: PREP, wishlist: ['Skyr'] };
}

const base: PlanData = { foods: [foodF, foodX], meals: [], rotation: rotation(), shoppingItems: [shop('f'), shop('x')], prep: [] };

const goals: DayGoals = {
  proteinG: SYN_PROTEIN, carbsG: null, fatG: SYN_FAT, fiberG: null, caloriesKcal: SYN_KCAL, proteinFeedings: null, steps: null,
};

const input: GeneratorInput = {
  goals: { caloriesKcal: SYN_KCAL, proteinG: SYN_PROTEIN, fatG: SYN_FAT, carbsG: null, fiberG: null },
  foods: [foodF],
  shoppingItems: [shop('f')],
  devices: ['Mikrowelle'],
  prepDays: PREP_DAYS,
  tolerance: DAY_TOLERANCE,
  wish: '',
};

const request: ProposalRequest = { apiKey: API_KEY, input, base, goals, exclusions: new Set(['x']) };

type Usage = BetaMessage['usage'];

function usage(over: Partial<Usage> = {}): Usage {
  return { input_tokens: INPUT_TOKENS, output_tokens: OUTPUT_TOKENS, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, iterations: null, ...over } as Usage;
}

function message(over: Partial<BetaMessage> = {}): BetaMessage {
  return {
    id: 'msg_test', type: 'message', role: 'assistant', model: GENERATOR_MODEL,
    content: [{ type: 'text', text: JSON.stringify(proposal()) }],
    stop_reason: 'end_turn', stop_details: null, usage: usage(), ...over,
  } as BetaMessage;
}

/** Antwort nach Fallback: Teilausgabe des abgelehnten Modells, Fallback Block, Antwort des Fallbacks. */
function fallbackMessage(answer: Proposal, over: Partial<BetaMessage> = {}): BetaMessage {
  return message({
    model: FALLBACK_MODEL,
    content: [
      { type: 'text', text: '{"meals": [' },
      { type: 'fallback', from: { model: GENERATOR_MODEL }, to: { model: FALLBACK_MODEL }, trigger: { type: 'refusal' } },
      { type: 'text', text: JSON.stringify(answer) },
    ] as unknown as BetaMessage['content'],
    usage: usage({
      iterations: [
        { type: 'message', model: GENERATOR_MODEL, input_tokens: INPUT_TOKENS, output_tokens: DECLINED_OUTPUT_TOKENS, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
        { type: 'fallback_message', model: FALLBACK_MODEL, input_tokens: INPUT_TOKENS, output_tokens: OUTPUT_TOKENS, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
      ],
    }),
    ...over,
  });
}

const call = (options = {}): Promise<ProposalStatus> => requestProposal(request, options);

function expectKind<K extends ProposalStatus['kind']>(status: ProposalStatus, kind: K): Extract<ProposalStatus, { kind: K }> {
  expect(status.kind).toBe(kind);
  return status as Extract<ProposalStatus, { kind: K }>;
}

beforeEach(() => {
  sdkMock.script = {};
  sdkMock.calls.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Aufbau der Anfrage ──────────────────────────────────────────────────────

describe('requestProposal Anfrage', () => {
  it('erzeugt den Client fuer den Browser und streamt mit Modell, Effort, Schema und Fallback', async () => {
    sdkMock.script = { final: message() };
    await call();
    expect(sdkMock.calls).toHaveLength(1);
    const { clientOptions, body, requestOptions } = sdkMock.calls[0]!;
    expect(clientOptions).toMatchObject({ apiKey: API_KEY, dangerouslyAllowBrowser: true, timeout: GENERATOR_TIMEOUT_MS });
    expect(body).toMatchObject({
      model: GENERATOR_MODEL,
      max_tokens: GENERATOR_MAX_TOKENS,
      betas: [GENERATOR_FALLBACK_BETA],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: GENERATOR_EFFORT, format: { type: 'json_schema' } },
    });
    expect(requestOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it('nimmt Ausschluesse nicht ins enum auf', async () => {
    sdkMock.script = { final: message() };
    await call();
    const schema = JSON.stringify(sdkMock.calls[0]!.body['output_config']);
    expect(schema).toContain('"enum":["f"]');
    expect(schema).not.toContain('"x"');
  });

  it('meldet den Tokenstand waehrend des Laufs', async () => {
    const progress: unknown[] = [];
    sdkMock.script = {
      events: [
        { type: 'message_start', message: message({ usage: usage({ input_tokens: INPUT_TOKENS, output_tokens: 1 }) }) },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { input_tokens: null, output_tokens: OUTPUT_TOKENS } },
      ] as unknown as BetaRawMessageStreamEvent[],
      final: message(),
    };
    await call({ onTokens: (p: unknown) => progress.push(p) });
    expect(progress).toEqual([
      { inputTokens: INPUT_TOKENS, outputTokens: 1 },
      { inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS },
    ]);
  });
});

// ── Erfolg und Pruefung ─────────────────────────────────────────────────────

describe('requestProposal Erfolg', () => {
  it('liefert einen geprueften Vorschlag mit Kosten aus usage', async () => {
    sdkMock.script = { final: message() };
    const status = expectKind(await call(), 'checked');
    expect(status.check.passed).toBe(true);
    expect(status.proposal.wishlist).toEqual(['Skyr']);
    expect(status.model).toBe(GENERATOR_MODEL);
    expect(status.fallback).toBe(false);
    const price = TOKEN_PRICES[GENERATOR_MODEL]!;
    expect(status.cost.usd).toBeCloseTo((INPUT_TOKENS * price.input + OUTPUT_TOKENS * price.output) / 1_000_000);
    expect(statusLine(status)).toBe('Vorschlag geprüft');
  });

  it('verwirft einen Vorschlag, der ein Tagesziel reisst, mit Zahlenzeile', async () => {
    sdkMock.script = { final: message({ content: [{ type: 'text', text: JSON.stringify(proposal(OVER_BAND_GRAMS)) }] as BetaMessage['content'] }) };
    const status = expectKind(await call(), 'checked');
    expect(status.check.passed).toBe(false);
    expect(status.check.issues[0]).toBe(`Mo kcal ${SYN_KCAL + DAY_TOLERANCE.kcalBand + 1} Ziel ${SYN_KCAL} ±${DAY_TOLERANCE.kcalBand}`);
    expect(statusLine(status)).toBe(`Vorschlag verworfen, ${WEEKDAYS.length} Funde`);
  });

  it('meldet eine Antwort, die kein JSON ist', async () => {
    sdkMock.script = { final: message({ content: [{ type: 'text', text: 'Hier ist dein Plan' }] as BetaMessage['content'] }) };
    const status = expectKind(await call(), 'invalid');
    expect(status.issues).toEqual(['Antwort ist kein JSON']);
  });

  it('meldet eine Antwort mit unbekannter Zutat als ungueltig', async () => {
    const bad = proposal();
    bad.meals[0]!.ingredients[0]!.foodId = 'x';
    sdkMock.script = { final: message({ content: [{ type: 'text', text: JSON.stringify(bad) }] as BetaMessage['content'] }) };
    const status = expectKind(await call(), 'invalid');
    expect(status.issues.some((issue) => issue.includes('unbekannte Zutat x'))).toBe(true);
  });
});

// ── Fallback ────────────────────────────────────────────────────────────────

describe('requestProposal Fallback', () => {
  it('prueft die Antwort des Fallback Modells und ignoriert die Teilausgabe davor', async () => {
    sdkMock.script = { final: fallbackMessage(proposal()) };
    const status = expectKind(await call(), 'checked');
    expect(status.check.passed).toBe(true);
    expect(status.fallback).toBe(true);
    expect(status.model).toBe(FALLBACK_MODEL);
  });

  it('rechnet jeden Versuch zum Preis seines Modells', async () => {
    sdkMock.script = { final: fallbackMessage(proposal()) };
    const status = expectKind(await call(), 'checked');
    const own = TOKEN_PRICES[GENERATOR_MODEL]!;
    const fallback = TOKEN_PRICES[FALLBACK_MODEL]!;
    const expected =
      (INPUT_TOKENS * own.input + DECLINED_OUTPUT_TOKENS * own.output + INPUT_TOKENS * fallback.input + OUTPUT_TOKENS * fallback.output) / 1_000_000;
    expect(status.cost.inputTokens).toBe(2 * INPUT_TOKENS);
    expect(status.cost.outputTokens).toBe(DECLINED_OUTPUT_TOKENS + OUTPUT_TOKENS);
    expect(status.cost.usd).toBeCloseTo(expected);
  });

  it('verwirft auch die Antwort des Fallbacks, wenn sie ein Ziel reisst', async () => {
    sdkMock.script = { final: fallbackMessage(proposal(OVER_BAND_GRAMS)) };
    const status = expectKind(await call(), 'checked');
    expect(status.fallback).toBe(true);
    expect(status.check.passed).toBe(false);
  });

  it('meldet Abgelehnt mit Kategorie, wenn die ganze Kette ablehnt', async () => {
    sdkMock.script = {
      final: fallbackMessage(proposal(), {
        content: [] as BetaMessage['content'],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: null } as BetaMessage['stop_details'],
      }),
    };
    const status = expectKind(await call(), 'refused');
    expect(status.category).toBe('cyber');
    expect(status.fallback).toBe(true);
    expect(statusLine(status)).toBe('Abgelehnt, Kategorie cyber');
  });

  it('meldet Abgelehnt ohne Kategorie', async () => {
    sdkMock.script = { final: message({ content: [], stop_reason: 'refusal', stop_details: null }) };
    expect(statusLine(await call())).toBe('Abgelehnt, Kategorie ohne');
  });
});

// ── Abbrueche und Fehler ────────────────────────────────────────────────────

describe('requestProposal Fehlerpfade', () => {
  it('meldet Abbruch durch max_tokens', async () => {
    sdkMock.script = { final: message({ stop_reason: 'max_tokens' }) };
    const status = expectKind(await call(), 'max-tokens');
    expect(status.cost.outputTokens).toBe(OUTPUT_TOKENS);
    expect(statusLine(status)).toBe(`Abbruch max_tokens bei ${GENERATOR_MAX_TOKENS} Tokens`);
  });

  it('meldet einen anderen Stopgrund statt still abzubrechen', async () => {
    sdkMock.script = { final: message({ stop_reason: 'pause_turn' }) };
    expect(statusLine(await call())).toBe('Abbruch pause_turn');
  });

  it('meldet API Fehler mit Code und Typ', async () => {
    sdkMock.script = {
      error: APIError.generate(HTTP_RATE_LIMIT, { error: { type: 'rate_limit_error', message: 'slow down' } }, 'slow down', new Headers()),
    };
    const status = expectKind(await call(), 'api-error');
    expect(status).toEqual({ kind: 'api-error', status: HTTP_RATE_LIMIT, errorType: 'rate_limit_error' });
    expect(statusLine(status)).toBe(`API Fehler ${HTTP_RATE_LIMIT} rate_limit_error`);
  });

  it('meldet fehlende Verbindung', async () => {
    sdkMock.script = { error: new APIConnectionError({ message: 'offline' }) };
    expect(expectKind(await call(), 'connection')).toEqual({ kind: 'connection' });
  });

  it('meldet die Zeitueberschreitung des SDK', async () => {
    sdkMock.script = { error: new APIConnectionTimeoutError() };
    expect(statusLine(await call())).toBe(`Zeitüberschreitung nach ${GENERATOR_TIMEOUT_MS / 1000} s`);
  });

  it('bricht nach der Gesamtfrist ab und meldet Zeitueberschreitung', async () => {
    vi.useFakeTimers();
    sdkMock.script = { hang: true };
    const pending = call();
    await vi.advanceTimersByTimeAsync(GENERATOR_TIMEOUT_MS);
    expectKind(await pending, 'timeout');
  });

  it('meldet Abbruch durch den Nutzer', async () => {
    sdkMock.script = { hang: true };
    const controller = new AbortController();
    const pending = call({ signal: controller.signal });
    controller.abort();
    expectKind(await pending, 'aborted');
  });

  it('meldet Abbruch, wenn das Signal schon vor dem Start abgebrochen ist', async () => {
    sdkMock.script = { hang: true };
    const controller = new AbortController();
    controller.abort();
    expect(statusLine(await call({ signal: controller.signal }))).toBe('Abgebrochen');
  });

  it('meldet ein SDK, das nicht geladen werden kann', async () => {
    const status = await call({ loadSdk: () => Promise.reject(new Error('Failed to fetch dynamically imported module')) });
    expect(statusLine(status)).toBe('SDK nicht geladen');
    expect(sdkMock.calls).toHaveLength(0);
  });

  it('meldet einen unbekannten Fehler mit Text', async () => {
    sdkMock.script = { error: new TypeError('kaputt') };
    expect(statusLine(await call())).toBe('Fehler kaputt');
  });
});

describe('totalRunCost', () => {
  it('rechnet ohne iterations wie runCost', () => {
    const cost = totalRunCost({ input_tokens: INPUT_TOKENS, output_tokens: OUTPUT_TOKENS }, GENERATOR_MODEL, TOKEN_PRICES);
    expect(cost.inputTokens).toBe(INPUT_TOKENS);
    expect(cost.usd).not.toBeNull();
  });

  it('liefert usd null, wenn ein Versuch ein unbekanntes Modell traegt', () => {
    const cost = totalRunCost(
      { input_tokens: 1, output_tokens: 1, iterations: [{ input_tokens: 1, output_tokens: 1, model: 'claude-unknown' }] },
      GENERATOR_MODEL,
      TOKEN_PRICES,
    );
    expect(cost.usd).toBeNull();
  });
});
