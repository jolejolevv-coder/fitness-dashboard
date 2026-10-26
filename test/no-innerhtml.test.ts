import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(__dirname, '..', 'src');

/** Zuweisungen und Aufrufe, die Text als Markup ausfuehren. Kommentare zaehlen nicht. */
const MARKUP_SINKS = /\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\s*\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('Inhalte nur per textContent', () => {
  it('weist in src/ nichts an innerHTML zu', () => {
    const offenders = sourceFiles(SOURCE_ROOT).filter((file) => MARKUP_SINKS.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
