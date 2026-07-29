import type { SheetValues } from './types';

/**
 * Lesender Zugriff auf die Google Sheets API v4.
 *
 * Der API Key wandert als Query Parameter in die URL. Das ist bei einer Seite
 * ohne Backend unvermeidbar. Abgesichert wird er ueber die HTTP Referrer
 * Beschraenkung in der Google Cloud Console, nicht durch den Code hier.
 */

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Bereiche exakt wie bisher, damit sich am gelieferten Datenumfang nichts aendert. */
export const DAILY_RANGE = 'A1:AD300';
export const TRAINING_RANGE = 'A1:FZ200';

interface SheetsErrorBody {
  error?: { message?: string };
}

async function fetchRange(
  sheetId: string,
  apiKey: string,
  sheetName: string,
  range: string,
): Promise<SheetValues> {
  const target = encodeURIComponent(`'${sheetName}'!${range}`);
  const url = `${API_BASE}/${sheetId}/values/${target}?key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as SheetsErrorBody;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Antwort ohne verwertbaren Fehlerkoerper, die Statuszeile muss reichen.
    }
    throw new Error(message);
  }

  const body = (await response.json()) as { values?: SheetValues };
  return body.values ?? [];
}

export function fetchDailySheet(sheetId: string, apiKey: string, sheetName: string): Promise<SheetValues> {
  return fetchRange(sheetId, apiKey, sheetName, DAILY_RANGE);
}

export function fetchTrainingSheet(sheetId: string, apiKey: string, sheetName: string): Promise<SheetValues> {
  return fetchRange(sheetId, apiKey, sheetName, TRAINING_RANGE);
}
