import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Zugriff auf die lokalen Testdaten.
 *
 * Fixtures und Golden Values stammen aus dem echten Sheet und sind bewusst
 * nicht versioniert. Wer das Repository frisch auscheckt, hat sie nicht, und
 * die davon abhaengigen Suiten werden uebersprungen statt fehlzuschlagen.
 *
 * Erzeugen mit:
 *   python3 scripts/make_fixtures.py testdata/<export>.xlsx
 */

export const root = join(import.meta.dirname, '..');

const REQUIRED = [
  'test/fixtures/daily-tracking.json',
  'test/fixtures/mesocycle-1.json',
  'test/fixtures/mesocycle-2.json',
  'test/golden/daily.json',
  'test/golden/training.json',
];

export const hasFixtures = REQUIRED.every((p) => existsSync(join(root, p)));

export function load<T>(p: string): T {
  return JSON.parse(readFileSync(join(root, p), 'utf8')) as T;
}
