import { RECEIPT_STORES } from './types';

/**
 * JSON Schema fuer `output_config.format`. Regeln der Structured Outputs: alles
 * Pflicht, nichts zusaetzlich. Fehlende Werte sind `null`.
 */

type JsonSchema = Record<string, unknown>;

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const text = (): JsonSchema => ({ type: 'string' });
const number = (): JsonSchema => ({ type: 'number' });
const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] });
const choice = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });

export function buildReceiptSchema(foodIds: readonly string[]): JsonSchema {
  const line = object({
    text: text(),
    price_eur: number(),
    quantity: number(),
    price_per_kg_eur: nullable(number()),
    size_g: nullable(number()),
    food_id: nullable(choice([...foodIds].sort())),
  });
  return object({
    store: nullable(choice(RECEIPT_STORES)),
    date: nullable(text()),
    lines: { type: 'array', items: line },
  });
}
