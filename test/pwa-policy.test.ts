import { describe, expect, it } from 'vitest';
import { DATA_FILES, classifyRequest } from '../src/pwa/policy';

const SCOPE = 'https://me.nahobinoco.com/fitness-dashboard/';
const get = (url: string, mode = 'cors') => ({ url, method: 'GET', mode });

describe('classifyRequest', () => {
  it('nimmt Navigationen unter dem Basispfad', () => {
    expect(classifyRequest(get(SCOPE, 'navigate'), SCOPE)).toBe('page');
    expect(classifyRequest(get(`${SCOPE}index.html`, 'navigate'), SCOPE)).toBe('page');
  });

  it('nimmt gehashte Assets der eigenen Herkunft', () => {
    expect(classifyRequest(get(`${SCOPE}assets/charts-a1b2c3.js`), SCOPE)).toBe('asset');
    expect(classifyRequest(get(`${SCOPE}assets/index-d4e5f6.css`), SCOPE)).toBe('asset');
  });

  it('nimmt genau die beiden Preisdateien', () => {
    expect(DATA_FILES).toEqual(['data/prices.json', 'data/regular_prices.json']);
    expect(classifyRequest(get(`${SCOPE}data/prices.json`), SCOPE)).toBe('data');
    expect(classifyRequest(get(`${SCOPE}data/regular_prices.json`), SCOPE)).toBe('data');
    expect(classifyRequest(get(`${SCOPE}data/other.json`), SCOPE)).toBe('bypass');
  });

  it('laesst die Sheets API mit API Key im Query vorbei', () => {
    const sheets = 'https://sheets.googleapis.com/v4/spreadsheets/ID/values/Daily%20Tracking?key=SECRET';
    expect(classifyRequest(get(sheets), SCOPE)).toBe('bypass');
    expect(classifyRequest(get('https://www.googleapis.com/fitness-dashboard/assets/x.js'), SCOPE)).toBe('bypass');
  });

  it('laesst Anthropic vorbei, POST wie GET', () => {
    expect(classifyRequest({ url: 'https://api.anthropic.com/v1/messages', method: 'POST', mode: 'cors' }, SCOPE)).toBe('bypass');
    expect(classifyRequest(get('https://api.anthropic.com/v1/models'), SCOPE)).toBe('bypass');
  });

  it('laesst fremde Herkunft mit gleichem Pfad vorbei', () => {
    expect(classifyRequest(get('https://example.com/fitness-dashboard/assets/a.js'), SCOPE)).toBe('bypass');
    expect(classifyRequest(get('http://me.nahobinoco.com/fitness-dashboard/assets/a.js'), SCOPE)).toBe('bypass');
    expect(classifyRequest(get('https://example.com/fitness-dashboard/', 'navigate'), SCOPE)).toBe('bypass');
  });

  it('laesst eigene Herkunft ausserhalb des Basispfads vorbei', () => {
    expect(classifyRequest(get('https://me.nahobinoco.com/other/assets/a.js'), SCOPE)).toBe('bypass');
    expect(classifyRequest(get('https://me.nahobinoco.com/', 'navigate'), SCOPE)).toBe('bypass');
  });

  it('laesst alles ausser GET vorbei', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
      expect(classifyRequest({ url: `${SCOPE}assets/a.js`, method, mode: 'cors' }, SCOPE)).toBe('bypass');
    }
  });

  it('laesst uebrige eigene Dateien der Precache Route', () => {
    expect(classifyRequest(get(`${SCOPE}pwa-192x192.png`), SCOPE)).toBe('bypass');
    expect(classifyRequest(get(`${SCOPE}preview/daily-tracking.json`), SCOPE)).toBe('bypass');
  });
});
