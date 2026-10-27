/**
 * Welche Tabs das Segment `Eintragen` anbietet und welcher vorausgewaehlt ist
 * (Phase 13.6, specs/features/log-tab-choice.md).
 */

/** Dasselbe Muster wie TRAINING_SHEET_PATTERN im Apps Script. */
const MESOCYCLE_PATTERN = /^Mesocycle (\d+)$/;

/** Nur `Mesocycle N`, aufsteigend nach N. */
export function mesocycleTabs(titles: readonly string[]): string[] {
  return titles
    .map((title) => ({ title, match: MESOCYCLE_PATTERN.exec(title) }))
    .filter((item) => item.match !== null)
    .sort((a, b) => Number(a.match![1]) - Number(b.match![1]))
    .map((item) => item.title);
}

/** Zuletzt gewaehlter Tab, sonst der mit dem hoechsten N. */
export function pickLogTab(tabs: readonly string[], saved: string | null): string | null {
  if (saved && tabs.includes(saved)) return saved;
  return tabs.at(-1) ?? null;
}
