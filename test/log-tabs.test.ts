import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLogCache, saveLogCache, takeLegacyLogTab } from '../src/config/logTab';
import { mesocycleTabs } from '../src/log/tabs';
import { fetchSheetTitles } from '../src/sheets';

/** Tests der Tabwahl beim Eintragen (Phase 13.6). */

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
  removeItem(key: string): void { this.items.delete(key); }
}

describe('mesocycleTabs', () => {
  it('nimmt nur Mesocycle N, aufsteigend nach N', () => {
    const titles = ['Daily Tracking', 'Mesocycle 10', 'Mesocycle 3', 'Kopie von Mesocycle 3', 'Mesocycle 1', 'Mesocycle 2 alt'];
    expect(mesocycleTabs(titles)).toEqual(['Mesocycle 1', 'Mesocycle 3', 'Mesocycle 10']);
  });

  it('gibt eine leere Liste ohne Mesocycle Tab', () => {
    expect(mesocycleTabs(['Daily Tracking'])).toEqual([]);
  });
});

describe('Tabliste und alte Wahl im localStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('haelt die Tabliste', () => {
    saveLogCache({ titles: ['Mesocycle 1', 'Mesocycle 3'] });
    expect(loadLogCache()).toEqual({ titles: ['Mesocycle 1', 'Mesocycle 3'] });
  });

  it('verwirft einen Cache in falscher Form', () => {
    localStorage.setItem('fitness_log_cache_v1', JSON.stringify({ titles: 'x' }));
    expect(loadLogCache()).toBeNull();
  });

  it('uebernimmt die alte Wahl genau einmal', () => {
    localStorage.setItem('fitness_log_tab_v1', 'Mesocycle 3');
    expect(takeLegacyLogTab()).toBe('Mesocycle 3');
    expect(takeLegacyLogTab()).toBeNull();
  });
});

describe('fetchSheetTitles', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fragt nur die Titel ab und liefert sie in Reihenfolge', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({
      sheets: [{ properties: { title: 'Daily Tracking' } }, { properties: { title: 'Mesocycle 3' } }, { properties: {} }],
    })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchSheetTitles('id', 'key')).toEqual(['Daily Tracking', 'Mesocycle 3']);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/id?fields=sheets.properties.title&key=key');
  });

  it('meldet den Fehler der API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 })));
    await expect(fetchSheetTitles('id', 'key')).rejects.toThrow('API key not valid');
  });
});
