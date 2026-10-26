import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(__dirname, '..', 'src');
const CHARTS_DIR = join(SOURCE_ROOT, 'charts') + sep;

/**
 * Statischer Import, der Code mitbringt: `import { x } from '.../charts/...'` oder
 * `from 'chart.js'`. Reine Typimporte (`import type`) verschwinden im Build.
 */
const STATIC_CHART_IMPORT = /^import\s+(?!type\b)[^;]*from\s+['"](chart\.js|[^'"]*\/charts\/[^'"]*)['"]/m;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('Chunk charts', () => {
  it('wird ausserhalb von src/charts/ nur dynamisch importiert', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter((file) => !file.startsWith(CHARTS_DIR))
      .filter((file) => STATIC_CHART_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SOURCE_ROOT.length + 1));
    expect(offenders).toEqual([]);
  });

  it('erkennt einen statischen Import als Verstoss', () => {
    expect(STATIC_CHART_IMPORT.test("import { upsert } from '../charts/base';")).toBe(true);
    expect(STATIC_CHART_IMPORT.test("import { Chart } from 'chart.js';")).toBe(true);
    expect(STATIC_CHART_IMPORT.test("import type { WeightMode } from './charts/weight';")).toBe(false);
  });
});
