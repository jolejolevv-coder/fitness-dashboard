import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { rangeCaption } from '../src/ui/format';

/**
 * Phase 13.1: `Heute` traegt nur noch die drei Karten in `#hero`, alles andere
 * steht am Anfang von `Verlauf` `Analyse`.
 */

const html = parse(readFileSync('index.html', 'utf8'));

describe('Heute verdichtet', () => {
  it('Heute enthaelt nur Kopf und Hero', () => {
    const today = html.getElementById('view-heute')!;
    const ids = today.querySelectorAll('[id]').map((node) => node.id);
    expect(ids).toEqual(['header-sub', 'goals-hint', 'hero']);
  });

  it('Fortschritt, Insights und Tagesdurchschnitt stehen am Anfang von Analyse', () => {
    const analysis = html.getElementById('analysis')!;
    const ids = analysis.querySelectorAll('[id]').map((node) => node.id);
    expect(ids.slice(0, 5)).toEqual(['a-progress', 'coach', 'metrics-range', 'metrics', 'a-kpis']);
  });
});

describe('rangeCaption', () => {
  it('nennt ersten und letzten datierten Tag', () => {
    const entries = [
      { dateObj: null },
      { dateObj: new Date(2026, 7, 3) },
      { dateObj: new Date(2026, 9, 27) },
    ];
    expect(rangeCaption(entries)).toBe('3. Aug. bis 27. Okt.');
  });

  it('bleibt ohne Datum leer', () => {
    expect(rangeCaption([{ dateObj: null }])).toBe('');
  });
});
