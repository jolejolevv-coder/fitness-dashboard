/**
 * Welche Tabs das Segment `Eintragen` als Chips anbietet
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
