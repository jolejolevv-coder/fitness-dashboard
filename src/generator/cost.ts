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
