import type { RunCost } from '../generator/cost';
import { totalRunCost } from '../generator/cost';
import type { SdkModule } from '../generator/request';
import { TOKEN_PRICES } from '../config/generator';
import { RECEIPT_MAX_TOKENS, RECEIPT_MEDIA_TYPES, RECEIPT_MODEL, RECEIPT_TIMEOUT_MS } from '../config/receipt';
import type { ReceiptMediaType } from '../config/receipt';
import { parseReceipt } from './response';
import { buildReceiptSchema } from './schema';
import type { Receipt } from './types';

/**
 * API Aufruf des Bon Scans. Das SDK wird erst hier per dynamischem Import
 * geladen, wie beim Plan Generator (ADR 0004). Jeder Ausgang ist ein Status,
 * nie ein stiller Abbruch. Das Bild geht nur an die API und wird nicht abgelegt.
 */

/** Artikel, die das Modell zuordnen darf. */
export interface ReceiptItem {
  foodId: string;
  name: string;
  /** Suchbegriffe aus `shopping_items.json`, helfen beim Zuordnen abgekuerzter Bontexte. */
  terms: readonly string[];
}

export interface ReceiptImage {
  mediaType: string;
  /** Base64 ohne `data:` Praefix. */
  base64: string;
}

export interface ReceiptRequest {
  /** `null` ergibt den Status `no-key`, es geht nichts ueber das Netz. */
  apiKey: string | null;
  image: ReceiptImage;
  items: readonly ReceiptItem[];
}

export interface ReceiptRequestOptions {
  signal?: AbortSignal;
  /** Fuer Tests austauschbar, sonst der dynamische Import des SDK. */
  loadSdk?: () => Promise<SdkModule>;
}

export type ReceiptStatus =
  | { kind: 'read'; receipt: Receipt; model: string; cost: RunCost }
  | { kind: 'no-key' }
  | { kind: 'bad-image'; mediaType: string }
  | { kind: 'invalid'; issues: string[]; cost: RunCost }
  | { kind: 'refused'; category: string | null; cost: RunCost }
  | { kind: 'max-tokens'; cost: RunCost }
  | { kind: 'stopped'; reason: string; cost: RunCost }
  | { kind: 'api-error'; status: number | null; errorType: string | null }
  | { kind: 'connection' }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | { kind: 'sdk-load' }
  | { kind: 'unknown'; message: string };

const defaultLoadSdk = (): Promise<SdkModule> => import('@anthropic-ai/sdk');

const SYSTEM_PROMPT = [
  'Du liest das Foto eines deutschen Kassenbons und gibst die Artikelzeilen als JSON im vorgegebenen Schema zurueck.',
  'Erlaubte Maerkte: Lidl, Aldi Süd, Edeka. Bei einem anderen Markt oder einem unlesbaren Bon ist store null.',
  'date ist das Kaufdatum im Format YYYY-MM-DD, null wenn es nicht lesbar ist.',
  'Je gedruckter Artikelzeile genau ein Eintrag in lines, in der Reihenfolge des Bons. Keine Summenzeilen, keine Zahlungszeilen, keine Pfandrueckgabe.',
  'text ist der Bontext der Zeile, wie gedruckt. price_eur ist der Einzelpreis der Packung in Euro. Steht dort `3,29 x2`, ist price_eur 3.29 und quantity 2.',
  'Gewichtsware steht auf zwei Zeilen, etwa `Zucchini lose 0,51` mit `0,342 kg x 1,49 EUR/kg`. Dann ist price_eur der Zeilenbetrag 0.51, quantity 1 und price_per_kg_eur 1.49. Ohne gedruckten Kilopreis ist price_per_kg_eur null. Rechne nie selbst einen Kilopreis aus.',
  'size_g ist die im Bontext gedruckte Packungsgroesse in Gramm (`500g` gibt 500, `2.5kg` gibt 2500, `1kg` gibt 1000), sonst null. Schaetze keine Groesse.',
  'food_id waehlst du ausschliesslich aus der Liste der Artikel unten, wenn die Zeile eindeutig dazu passt, sonst null. Rate nicht.',
  'Gib keine Kartennummer, keine Autorisierungsdaten und keine Adresse aus. Das Schema hat dafuer keine Felder.',
].join('\n');

function itemList(items: readonly ReceiptItem[]): string {
  return items
    .map((item) => `${item.foodId}: ${item.name}${item.terms.length > 0 ? ` (${item.terms.join(', ')})` : ''}`)
    .join('\n');
}

function isMediaType(value: string): value is ReceiptMediaType {
  return RECEIPT_MEDIA_TYPES.some((type) => type === value);
}

export async function requestReceipt(request: ReceiptRequest, options: ReceiptRequestOptions = {}): Promise<ReceiptStatus> {
  if (request.apiKey === null) return { kind: 'no-key' };
  const mediaType = request.image.mediaType;
  if (!isMediaType(mediaType)) return { kind: 'bad-image', mediaType };

  let sdk: SdkModule;
  try {
    sdk = await (options.loadSdk ?? defaultLoadSdk)();
  } catch {
    return { kind: 'sdk-load' };
  }

  try {
    const client = new sdk.default({ apiKey: request.apiKey, dangerouslyAllowBrowser: true, timeout: RECEIPT_TIMEOUT_MS });
    const foodIds = request.items.map((item) => item.foodId);
    const message = await client.messages.create(
      {
        model: RECEIPT_MODEL,
        max_tokens: RECEIPT_MAX_TOKENS,
        output_config: { format: { type: 'json_schema', schema: buildReceiptSchema(foodIds) } },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: request.image.base64 } },
              { type: 'text', text: `Artikel:\n${itemList(request.items)}` },
            ],
          },
        ],
      },
      { signal: options.signal },
    );

    const cost = totalRunCost(message.usage, RECEIPT_MODEL, TOKEN_PRICES);
    switch (message.stop_reason) {
      case 'refusal':
        return { kind: 'refused', category: message.stop_details?.category ?? null, cost };
      case 'max_tokens':
        return { kind: 'max-tokens', cost };
      case 'end_turn':
        return parsedStatus(message.content, new Set(foodIds), cost);
      default:
        return { kind: 'stopped', reason: String(message.stop_reason), cost };
    }
  } catch (error) {
    return errorStatus(sdk, error, options.signal);
  }
}

function parsedStatus(content: readonly { type: string; text?: string }[], foodIds: ReadonlySet<string>, cost: RunCost): ReceiptStatus {
  const answer = content.flatMap((block) => (block.type === 'text' && block.text !== undefined ? [block.text] : [])).join('');
  let data: unknown;
  try {
    data = JSON.parse(answer);
  } catch {
    return { kind: 'invalid', issues: ['Antwort ist kein JSON'], cost };
  }
  const parsed = parseReceipt(data, foodIds);
  if (!parsed.ok) return { kind: 'invalid', issues: parsed.issues, cost };
  return { kind: 'read', receipt: parsed.receipt, model: RECEIPT_MODEL, cost };
}

/** Bildet Fehler auf Status ab, vom speziellsten zum allgemeinsten. */
function errorStatus(sdk: SdkModule, error: unknown, signal: AbortSignal | undefined): ReceiptStatus {
  if (signal?.aborted || error instanceof sdk.APIUserAbortError) return { kind: 'aborted' };
  if (error instanceof sdk.APIConnectionTimeoutError) return { kind: 'timeout' };
  if (error instanceof sdk.APIConnectionError) return { kind: 'connection' };
  if (error instanceof sdk.APIError) return { kind: 'api-error', status: error.status ?? null, errorType: error.type };
  return { kind: 'unknown', message: error instanceof Error ? error.message : String(error) };
}

/** Kostenzeile wie beim Generator: Betrag, Tokens. */
export function costLine(cost: RunCost, format: { usd: (value: number) => string; count: (value: number) => string }): string {
  const usd = cost.usd === null ? 'Kosten unbekannt' : `Kosten ${format.usd(cost.usd)}`;
  return `${usd}, ${format.count(cost.inputTokens)} Eingabe, ${format.count(cost.outputTokens)} Ausgabe Tokens`;
}

/** Eine Zahlenzeile je Status, ohne Erklaertext. */
export function receiptStatusLine(status: ReceiptStatus): string {
  switch (status.kind) {
    case 'read':
      return `Bon gelesen, ${status.receipt.lines.length} Zeilen`;
    case 'no-key':
      return 'Kein API Schlüssel hinterlegt';
    case 'bad-image':
      return `Bildtyp ${status.mediaType || 'unbekannt'} nicht lesbar`;
    case 'invalid':
      return `Antwort ungültig, ${status.issues.length} Funde: ${status.issues.slice(0, 3).join('; ')}`;
    case 'refused':
      return `Abgelehnt, Kategorie ${status.category ?? 'ohne'}`;
    case 'max-tokens':
      return `Abbruch max_tokens bei ${RECEIPT_MAX_TOKENS} Tokens`;
    case 'stopped':
      return `Abbruch ${status.reason}`;
    case 'api-error':
      return `API Fehler ${status.status ?? 'ohne Code'} ${status.errorType ?? ''}`.trim();
    case 'connection':
      return 'Keine Verbindung zur API';
    case 'timeout':
      return `Zeitüberschreitung nach ${RECEIPT_TIMEOUT_MS / 1000} s`;
    case 'aborted':
      return 'Abgebrochen';
    case 'sdk-load':
      return 'SDK nicht geladen';
    case 'unknown':
      return `Fehler ${status.message}`;
  }
}
