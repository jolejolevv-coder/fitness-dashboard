/**
 * Welche Anfragen der Service Worker anfasst. Reine Funktion, damit die Liste
 * der erlaubten URLs ohne Service Worker testbar ist (ADR 0006).
 *
 * Er beantwortet nur GET Anfragen der eigenen Herkunft unter dem Basispfad.
 * Alles andere, vor allem `sheets.googleapis.com` mit dem API Key im Query und
 * `api.anthropic.com`, geht an ihm vorbei und landet nie im Cache Storage.
 */

/** `page`: Navigation, `asset`: gehashte Datei unter `assets/`, `data`: Preisdatei, `bypass`: nicht anfassen. */
export type RequestKind = 'page' | 'asset' | 'data' | 'bypass';

export interface RequestInfo {
  readonly url: string;
  readonly method: string;
  readonly mode: string;
}

/** Relativ zum Basispfad. Nur diese beiden Dateien, keine weiteren unter `data/`. */
export const DATA_FILES: readonly string[] = ['data/prices.json', 'data/regular_prices.json'];

const ASSET_DIR = 'assets/';

/** `scope` ist die Registrierung des Service Workers, etwa `https://host/fitness-dashboard/`. */
export function classifyRequest(request: RequestInfo, scope: string): RequestKind {
  if (request.method !== 'GET') return 'bypass';
  const url = new URL(request.url);
  const base = new URL(scope);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return 'bypass';
  if (request.mode === 'navigate') return 'page';
  const path = url.pathname.slice(base.pathname.length);
  if (path.startsWith(ASSET_DIR)) return 'asset';
  if (DATA_FILES.includes(path)) return 'data';
  return 'bypass';
}
