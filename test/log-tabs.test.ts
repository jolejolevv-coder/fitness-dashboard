import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogTab, loadLogCache, saveLogCache, saveLogTab } from '../src/config/logTab';
import { mesocycleTabs, pickLogTab } from '../src/log/tabs';
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

describe('pickLogTab', () => {
  const tabs = ['Mesocycle 1', 'Mesocycle 2', 'Mesocycle 3'];

  it('waehlt die letzte Wahl, wenn es den Tab noch gibt', () => {
    expect(pickLogTab(tabs, 'Mesocycle 2')).toBe('Mesocycle 2');
  });

  it('waehlt sonst das hoechste N', () => {
    expect(pickLogTab(tabs, null)).toBe('Mesocycle 3');
    expect(pickLogTab(tabs, 'Mesocycle 99')).toBe('Mesocycle 3');
  });

  it('gibt null ohne Tabs', () => {
    expect(pickLogTab([], 'Mesocycle 1')).toBeNull();
  });
});

describe('Tabwahl und Cache im localStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merkt sich die Wahl', () => {
    expect(getLogTab()).toBeNull();
    saveLogTab('Mesocycle 3');
    expect(getLogTab()).toBe('Mesocycle 3');
  });

  it('haelt Tabliste und Zeilen des gewaehlten Tabs', () => {
    const cache = { titles: ['Mesocycle 3'], tab: 'Mesocycle 3', rows: [['Day 1', 'Excercise']] };
    saveLogCache(cache);
    expect(loadLogCache()).toEqual(cache);
  });

  it('verwirft einen Cache in falscher Form', () => {
    localStorage.setItem('fitness_log_cache_v1', JSON.stringify({ titles: 'x', tab: 1 }));
    expect(loadLogCache()).toBeNull();
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
