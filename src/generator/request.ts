import type { BetaContentBlock, BetaMessage, BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  GENERATOR_EFFORT,
  GENERATOR_FALLBACK_BETA,
  GENERATOR_MAX_TOKENS,
  GENERATOR_MODEL,
  GENERATOR_TIMEOUT_MS,
  TOKEN_PRICES,
} from '../config/generator';
import type { PlanData } from '../nutrition/plan';
import type { DayGoals } from '../parse/goals';
import type { ProposalCheck } from './check';
import { checkProposal } from './check';
import type { RunCost } from './cost';
import { totalRunCost } from './cost';
import type { GeneratorInput } from './prompt';
import { buildPrompt } from './prompt';
import type { Proposal } from './response';
import { parseProposal } from './response';
import { buildPlanSchema } from './schema';

/**
 * API Aufruf des Plan Generators. Das SDK wird erst hier per dynamischem Import
 * geladen, damit es in einem eigenen Chunk liegt und der erste Seitenaufruf
 * nicht waechst. Jeder Ausgang des Laufs ist ein Status, nie ein stiller Abbruch.
 */

export type SdkModule = typeof import('@anthropic-ai/sdk');

export interface ProposalRequest {
  apiKey: string;
  /** Eingaben fuer den Prompt, `foods` sind die erlaubten Lebensmittel. */
  input: GeneratorInput;
  /** Lebensmittel und Einkaufseintraege, gegen die der Vorschlag geprueft wird. */
  base: PlanData;
  goals: DayGoals;
  exclusions: ReadonlySet<string>;
}

/** Tokenstand waehrend des Laufs, aus den Ereignissen des Streams. */
export interface TokenProgress {
  inputTokens: number;
  outputTokens: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  onTokens?: (progress: TokenProgress) => void;
  /** Fuer Tests austauschbar, sonst der dynamische Import des SDK. */
  loadSdk?: () => Promise<SdkModule>;
}

/** Was der Lauf geliefert hat. `model` ist das Modell, das die Antwort erzeugt hat. */
interface Served {
  model: string;
  fallback: boolean;
  cost: RunCost;
}

export type ProposalStatus =
  | ({ kind: 'checked'; proposal: Proposal; check: ProposalCheck } & Served)
  | ({ kind: 'invalid'; issues: string[] } & Served)
  | ({ kind: 'refused'; category: string | null } & Served)
  | ({ kind: 'max-tokens' } & Served)
  | ({ kind: 'stopped'; reason: string } & Served)
  | { kind: 'api-error'; status: number | null; errorType: string | null }
  | { kind: 'connection' }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | { kind: 'sdk-load' }
  | { kind: 'unknown'; message: string };

const defaultLoadSdk = (): Promise<SdkModule> => import('@anthropic-ai/sdk');

/** Warum der eigene AbortController ausgeloest hat. */
type AbortCause = 'user' | 'timeout' | null;

export async function requestProposal(request: ProposalRequest, options: RequestOptions = {}): Promise<ProposalStatus> {
  let sdk: SdkModule;
  try {
    sdk = await (options.loadSdk ?? defaultLoadSdk)();
  } catch {
    return { kind: 'sdk-load' };
  }

  const deadline = startDeadline(options.signal);
  try {
    const message = await streamMessage(sdk, request, deadline.signal, options.onTokens);
    return evaluateMessage(message, request);
  } catch (error) {
    return errorStatus(sdk, error, deadline.cause());
  } finally {
    deadline.stop();
  }
}

/** Verbindet den Abbruch durch den Nutzer mit der Gesamtfrist des Laufs. */
function startDeadline(userSignal: AbortSignal | undefined): {
  signal: AbortSignal;
  cause: () => AbortCause;
  stop: () => void;
} {
  const controller = new AbortController();
  let cause: AbortCause = null;
  const abort = (reason: Exclude<AbortCause, null>): void => {
    if (cause !== null) return;
    cause = reason;
    controller.abort();
  };
  const onUserAbort = (): void => abort('user');
  const timer = setTimeout(() => abort('timeout'), GENERATOR_TIMEOUT_MS);

  if (userSignal?.aborted) abort('user');
  userSignal?.addEventListener('abort', onUserAbort);
  return {
    signal: controller.signal,
    cause: () => cause,
    stop: () => {
      clearTimeout(timer);
      userSignal?.removeEventListener('abort', onUserAbort);
    },
  };
}

async function streamMessage(
  sdk: SdkModule,
  request: ProposalRequest,
  signal: AbortSignal,
  onTokens: ((progress: TokenProgress) => void) | undefined,
): Promise<BetaMessage> {
  const client = new sdk.default({ apiKey: request.apiKey, dangerouslyAllowBrowser: true, timeout: GENERATOR_TIMEOUT_MS });
  const prompt = buildPrompt(request.input);
  const foodIds = request.input.foods.map((food) => food.id).sort();

  const stream = client.beta.messages.stream(
    {
      model: GENERATOR_MODEL,
      max_tokens: GENERATOR_MAX_TOKENS,
      betas: [GENERATOR_FALLBACK_BETA],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: GENERATOR_EFFORT, format: { type: 'json_schema', schema: buildPlanSchema(foodIds) } },
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    },
    { signal },
  );

  const progress: TokenProgress = { inputTokens: 0, outputTokens: 0 };
  for await (const event of stream) {
    if (updateProgress(progress, event)) onTokens?.({ ...progress });
  }
  return stream.finalMessage();
}

/** Liest Tokenzahlen aus `message_start` und `message_delta`. Meldet, ob sich etwas geaendert hat. */
function updateProgress(progress: TokenProgress, event: BetaRawMessageStreamEvent): boolean {
  if (event.type === 'message_start') {
    progress.inputTokens = event.message.usage.input_tokens;
    progress.outputTokens = event.message.usage.output_tokens;
    return true;
  }
  if (event.type === 'message_delta') {
    progress.inputTokens = event.usage.input_tokens ?? progress.inputTokens;
    progress.outputTokens = event.usage.output_tokens;
    return true;
  }
  return false;
}

function served(message: BetaMessage): Served {
  const iterations = message.usage.iterations ?? [];
  return {
    model: message.model,
    fallback: iterations.some((iteration) => iteration.type === 'fallback_message'),
    cost: totalRunCost(message.usage, message.model, TOKEN_PRICES),
  };
}

function evaluateMessage(message: BetaMessage, request: ProposalRequest): ProposalStatus {
  const run = served(message);
  switch (message.stop_reason) {
    case 'refusal':
      return { kind: 'refused', category: message.stop_details?.category ?? null, ...run };
    case 'max_tokens':
      return { kind: 'max-tokens', ...run };
    case 'end_turn':
      return checkedStatus(message.content, request, run);
    default:
      return { kind: 'stopped', reason: String(message.stop_reason), ...run };
  }
}

/**
 * Text der Antwort. Nach einem Fallback mitten in der Ausgabe stehen Teile des
 * abgelehnten Modells vor dem letzten `fallback` Block, gezaehlt wird nur danach.
 */
function answerText(content: readonly BetaContentBlock[]): string {
  const lastFallback = content.map((block) => block.type).lastIndexOf('fallback');
  return content
    .slice(lastFallback + 1)
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
}

function checkedStatus(content: readonly BetaContentBlock[], request: ProposalRequest, run: Served): ProposalStatus {
  let data: unknown;
  try {
    data = JSON.parse(answerText(content));
  } catch {
    return { kind: 'invalid', issues: ['Antwort ist kein JSON'], ...run };
  }

  const allowed = new Set(request.input.foods.map((food) => food.id));
  const parsed = parseProposal(data, allowed);
  if (!parsed.ok) return { kind: 'invalid', issues: parsed.issues, ...run };

  const check = checkProposal(parsed.proposal, request.base, request.goals, request.exclusions, request.input.tolerance);
  return { kind: 'checked', proposal: parsed.proposal, check, ...run };
}

/** Bildet Fehler auf Status ab, vom speziellsten zum allgemeinsten. */
function errorStatus(sdk: SdkModule, error: unknown, cause: AbortCause): ProposalStatus {
  if (cause === 'timeout') return { kind: 'timeout' };
  if (cause === 'user') return { kind: 'aborted' };
  if (error instanceof sdk.APIUserAbortError) return { kind: 'aborted' };
  if (error instanceof sdk.APIConnectionTimeoutError) return { kind: 'timeout' };
  if (error instanceof sdk.APIConnectionError) return { kind: 'connection' };
  if (error instanceof sdk.APIError) return { kind: 'api-error', status: error.status ?? null, errorType: error.type };
  return { kind: 'unknown', message: error instanceof Error ? error.message : String(error) };
}

/** Eine Zahlenzeile je Status, fuer die Oberflaeche in 9.4. */
export function statusLine(status: ProposalStatus): string {
  switch (status.kind) {
    case 'checked':
      return status.check.passed ? 'Vorschlag geprüft' : `Vorschlag verworfen, ${status.check.issues.length} Funde`;
    case 'invalid':
      return `Antwort ungültig, ${status.issues.length} Funde`;
    case 'refused':
      return `Abgelehnt, Kategorie ${status.category ?? 'ohne'}`;
    case 'max-tokens':
      return `Abbruch max_tokens bei ${GENERATOR_MAX_TOKENS} Tokens`;
    case 'stopped':
      return `Abbruch ${status.reason}`;
    case 'api-error':
      return `API Fehler ${status.status ?? 'ohne Code'} ${status.errorType ?? ''}`.trim();
    case 'connection':
      return 'Keine Verbindung zur API';
    case 'timeout':
      return `Zeitüberschreitung nach ${GENERATOR_TIMEOUT_MS / 1000} s`;
    case 'aborted':
      return 'Abgebrochen';
    case 'sdk-load':
      return 'SDK nicht geladen';
    case 'unknown':
      return `Fehler ${status.message}`;
  }
}
