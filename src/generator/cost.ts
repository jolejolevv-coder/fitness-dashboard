import type { Usage } from '@anthropic-ai/sdk/resources/messages';
import type { TokenPrices } from '../config/generator';

/** Nur die Felder, die die Rechnung braucht. Fehlende Cache Felder zaehlen 0. */
export type RunUsage = Pick<Usage, 'input_tokens' | 'output_tokens'> &
  Partial<Pick<Usage, 'cache_read_input_tokens' | 'cache_creation_input_tokens'>>;

export interface RunCost {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** `null` bei unbekanntem Modell. */
  usd: number | null;
}

const TOKENS_PER_MILLION = 1_000_000;

export function runCost(usage: RunUsage, model: string, prices: Readonly<Record<string, TokenPrices>>): RunCost {
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  const price = prices[model];
  const usd = price
    ? (inputTokens * price.input + outputTokens * price.output + cacheReadTokens * price.cacheRead + cacheWriteTokens * price.cacheWrite) /
      TOKENS_PER_MILLION
    : null;
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, usd };
}

/** Ein Versuch innerhalb eines Laufs, etwa das abgelehnte Modell und der Fallback. */
export type IterationUsage = RunUsage & { model?: string | null };

/**
 * Kosten ueber alle Versuche eines Laufs. Nach einem Fallback deckt die oberste
 * `usage` nur den letzten Versuch ab, die Einzelversuche stehen in `iterations`
 * und werden zum Preis ihres eigenen Modells gerechnet.
 */
export function totalRunCost(
  usage: RunUsage & { iterations?: readonly IterationUsage[] | null },
  model: string,
  prices: Readonly<Record<string, TokenPrices>>,
): RunCost {
  const iterations = usage.iterations ?? [];
  if (iterations.length === 0) return runCost(usage, model, prices);

  const parts = iterations.map((iteration) => runCost(iteration, iteration.model ?? model, prices));
  const sum = (pick: (cost: RunCost) => number): number => parts.reduce((total, cost) => total + pick(cost), 0);
  const priced = parts.every((cost) => cost.usd !== null);
  return {
    inputTokens: sum((cost) => cost.inputTokens),
    outputTokens: sum((cost) => cost.outputTokens),
    cacheReadTokens: sum((cost) => cost.cacheReadTokens),
    cacheWriteTokens: sum((cost) => cost.cacheWriteTokens),
    usd: priced ? sum((cost) => cost.usd ?? 0) : null,
  };
}
