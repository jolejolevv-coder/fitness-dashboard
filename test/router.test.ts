import { describe, expect, it } from 'vitest';
import {
  DESTINATIONS,
  SEGMENTS,
  formatHash,
  kuecheRouteFor,
  parseHash,
  planViewFor,
  resolveRoute,
  sectionFor,
  startRoute,
  visibleDestinations,
  visibleSegments,
} from '../src/ui/router';

describe('parseHash', () => {
  it('liest Ziel ohne Segment', () => {
    expect(parseHash('#heute')).toEqual({ destination: 'heute', segment: null });
    expect(parseHash('#training')).toEqual({ destination: 'training', segment: 'eintragen' });
  });

  it('liest Ziel mit Segment', () => {
    expect(parseHash('#verlauf/wellness')).toEqual({ destination: 'verlauf', segment: 'wellness' });
    expect(parseHash('#kueche/einkauf')).toEqual({ destination: 'kueche', segment: 'einkauf' });
  });

  it('setzt das erste Segment, wenn keins oder ein unbekanntes angegeben ist', () => {
    expect(parseHash('#verlauf')).toEqual({ destination: 'verlauf', segment: 'gewicht' });
    expect(parseHash('#kueche/gibtsnicht')).toEqual({ destination: 'kueche', segment: 'heute' });
  });

  it('ignoriert ein Segment bei Zielen ohne Segmente', () => {
    expect(parseHash('#heute/woche')).toEqual({ destination: 'heute', segment: null });
  });

  it('akzeptiert Grossschreibung und fehlende Raute', () => {
    expect(parseHash('Verlauf/Analyse')).toEqual({ destination: 'verlauf', segment: 'analyse' });
  });

  it('gibt null fuer leeren oder unbekannten Hash', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
    expect(parseHash('#overview')).toBeNull();
  });
});

describe('formatHash', () => {
  it('ist die Umkehrung von parseHash fuer jede gueltige Route', () => {
    for (const destination of DESTINATIONS) {
      const segments = SEGMENTS[destination].length ? SEGMENTS[destination] : [null];
      for (const segment of segments) {
        const route = { destination, segment };
        expect(parseHash(formatHash(route))).toEqual(route);
      }
    }
  });

  it('schreibt die Beispiele der Spec', () => {
    expect(formatHash({ destination: 'heute', segment: null })).toBe('#heute');
    expect(formatHash({ destination: 'verlauf', segment: 'wellness' })).toBe('#verlauf/wellness');
    expect(formatHash({ destination: 'kueche', segment: 'einkauf' })).toBe('#kueche/einkauf');
  });
});

describe('Navigation ohne Sheet', () => {
  it('zeigt mit Sheet alle vier Ziele, ohne Sheet nur Kueche', () => {
    expect(visibleDestinations(true)).toEqual(['heute', 'verlauf', 'training', 'kueche']);
    expect(visibleDestinations(false)).toEqual(['kueche']);
  });

  it('startet mit Sheet auf Heute, ohne Sheet auf Kueche', () => {
    expect(startRoute(true)).toEqual({ destination: 'heute', segment: null });
    expect(startRoute(false)).toEqual({ destination: 'kueche', segment: 'heute' });
  });

  it('weicht ohne Sheet von Sheet Zielen auf Kueche aus', () => {
    expect(resolveRoute(parseHash('#verlauf/wellness'), false)).toEqual(startRoute(false));
    expect(resolveRoute(parseHash('#training'), false)).toEqual(startRoute(false));
  });

  it('behaelt Kueche Segmente ohne Sheet', () => {
    expect(resolveRoute(parseHash('#kueche/einkauf'), false)).toEqual({ destination: 'kueche', segment: 'einkauf' });
  });

  it('nimmt das Startziel bei leerem Hash', () => {
    expect(resolveRoute(null, true)).toEqual(startRoute(true));
    expect(resolveRoute(null, false)).toEqual(startRoute(false));
  });

  it('behaelt mit Sheet jede gueltige Route', () => {
    expect(resolveRoute(parseHash('#verlauf/analyse'), true)).toEqual({ destination: 'verlauf', segment: 'analyse' });
  });
});

describe('Abschnitte und Planansicht', () => {
  it('ordnet jedem Segment im Verlauf seinen alten Abschnitt zu', () => {
    const sections = SEGMENTS.verlauf.map((segment) => sectionFor({ destination: 'verlauf', segment }));
    expect(sections).toEqual(['overview', 'nutrition', 'wellness', 'weeks', 'analysis']);
  });

  it('zeigt auf Heute keinen Abschnitt, auf Training den Abschnitt Training', () => {
    expect(sectionFor({ destination: 'heute', segment: null })).toBeNull();
    expect(sectionFor({ destination: 'training', segment: 'auswertung' })).toBe('training');
    expect(sectionFor({ destination: 'training', segment: 'eintragen' })).toBe('log');
  });

  it('fuehrt die Kueche auf Plan mit Ansicht oder auf Einkauf', () => {
    expect(sectionFor({ destination: 'kueche', segment: 'prep' })).toBe('plan');
    expect(planViewFor({ destination: 'kueche', segment: 'prep' })).toBe('prep');
    expect(planViewFor({ destination: 'kueche', segment: 'vorschlag' })).toBe('proposal');
    expect(sectionFor({ destination: 'kueche', segment: 'einkauf' })).toBe('shopping');
    expect(planViewFor({ destination: 'kueche', segment: 'einkauf' })).toBeNull();
    expect(planViewFor({ destination: 'verlauf', segment: 'gewicht' })).toBeNull();
  });

  it('findet zu jeder Planansicht das Segment zurueck', () => {
    for (const segment of ['heute', 'woche', 'prep', 'vorschlag']) {
      const route = { destination: 'kueche' as const, segment };
      const view = planViewFor(route);
      expect(view).not.toBeNull();
      if (view) expect(kuecheRouteFor(view)).toEqual(route);
    }
  });
});

describe('Training eintragen', () => {
  it('zeigt eintragen nur mit Zugang zum Apps Script', () => {
    expect(visibleSegments('training', false)).toEqual(['auswertung']);
    expect(visibleSegments('training', true)).toEqual(['eintragen', 'auswertung']);
  });

  it('faellt ohne Zugang von eintragen auf auswertung zurueck', () => {
    const requested = parseHash('#training/eintragen');
    expect(resolveRoute(requested, true, false)).toEqual({ destination: 'training', segment: 'auswertung' });
    expect(resolveRoute(requested, true, true)).toEqual({ destination: 'training', segment: 'eintragen' });
  });

  it('oeffnet Training mit eintragen, ohne Zugang mit auswertung', () => {
    expect(resolveRoute(parseHash('#training'), true, true)).toEqual({ destination: 'training', segment: 'eintragen' });
    expect(resolveRoute(parseHash('#training'), true, false)).toEqual({ destination: 'training', segment: 'auswertung' });
  });
});
