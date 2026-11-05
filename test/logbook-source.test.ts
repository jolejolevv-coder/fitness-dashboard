import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOGBOOK_SHEET,
  loadCache,
  logbookSource,
  logbookSourceKey,
  saveCache,
} from '../src/config/credentials';

/** Zweite Quelle aus den Einstellungen und ihr Cache (Phase 18.2). */

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
  removeItem(key: string): void { this.items.delete(key); }
}

beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('logbookSource', () => {
  it('fehlt ohne Logbuch Sheet ID, auch bei Leerzeichen', () => {
    expect(logbookSource({})).toBeNull();
    expect(logbookSource({ logbookSheetId: '   ', logbookSheetName: 'TrainingSets' })).toBeNull();
  });

  it('nimmt TrainingSets als Vorgabe fuer den Tab', () => {
    expect(DEFAULT_LOGBOOK_SHEET).toBe('TrainingSets');
    expect(logbookSource({ logbookSheetId: 'abc' })).toEqual({ sheetId: 'abc', sheetName: 'TrainingSets' });
    expect(logbookSource({ logbookSheetId: ' abc ', logbookSheetName: ' ' })).toEqual({ sheetId: 'abc', sheetName: 'TrainingSets' });
    expect(logbookSource({ logbookSheetId: 'abc', logbookSheetName: 'Saetze' })).toEqual({ sheetId: 'abc', sheetName: 'Saetze' });
  });

  it('bildet einen Schluessel aus Sheet ID und Tab', () => {
    expect(logbookSourceKey({ sheetId: 'abc', sheetName: 'TrainingSets' })).toBe('abc/TrainingSets');
  });
});

describe('Cache mit Logbuch', () => {
  it('haelt Logbuch Zeilen samt Quelle', () => {
    const logbook = { rows: [['date', 'tag']], source: 'abc/TrainingSets' };
    saveCache([['a']], [['b']], 'Mesocycle 1', logbook);
    expect(loadCache()).toMatchObject({ raw: [['a']], rawTraining: [['b']], trainingSheet: 'Mesocycle 1', logbook });
  });

  it('laesst das Feld ohne Logbuch weg, wie vor Phase 18', () => {
    saveCache([['a']], [['b']], 'Mesocycle 1');
    expect(loadCache()).not.toHaveProperty('logbook');
  });
});
