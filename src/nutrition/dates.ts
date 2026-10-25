import type { Weekday } from './types';

/** Der Plan richtet sich nach dem Kalender in Berlin, nicht nach der Zeitzone des Geraets. */
const PLAN_TIME_ZONE = 'Europe/Berlin';

const MS_PER_DAY = 864e5;

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', { timeZone: PLAN_TIME_ZONE, weekday: 'short' });

const WEEKDAY_BY_ENGLISH: Record<string, Weekday> = {
  Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So',
};

/** Kalendertag in Berlin als `YYYY-MM-DD`. */
export function berlinDay(now: Date): string {
  return DAY_FORMAT.format(now);
}

export function berlinWeekday(now: Date): Weekday {
  const weekday = WEEKDAY_BY_ENGLISH[WEEKDAY_FORMAT.format(now)];
  if (!weekday) throw new Error('Wochentag nicht lesbar');
  return weekday;
}

/** Ganze Tage von `from` bis `to`, beide als `YYYY-MM-DD`. Negativ, wenn `to` frueher liegt. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** `2026-10-31` zu `31.10.`. Verlangt das ISO Format, auch mit Zeit dahinter. */
export function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

/** `2026-10-31` zu `31.10.2026`. */
export function longDate(iso: string): string {
  return `${shortDate(iso)}${iso.slice(0, 4)}`;
}
