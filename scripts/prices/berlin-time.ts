/**
 * Zeitangaben in Europe/Berlin. Die Quelle liefert lokale Zeiten ohne Zone, der
 * Actions Runner laeuft in UTC. Der Offset wird deshalb ueber Intl bestimmt und
 * nicht fest verdrahtet, damit die Sommerzeitumstellung stimmt.
 */

const BERLIN = 'Europe/Berlin';
const MS_PER_MINUTE = 60_000;
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

/** Offset von Berlin gegenueber UTC zum Zeitpunkt `at`, in Minuten. */
function berlinOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BERLIN,
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name);
  if (!m) throw new Error(`Zeitzonen Offset nicht lesbar: ${name}`);
  if (!m[1]) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -minutes : minutes;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Liest `2026-10-26T00:00:00` als Berlin Ortszeit und gibt dieselbe Zeit mit
 * Offset zurueck, etwa `2026-10-26T00:00:00+01:00`. `null` bei ungueltiger Form.
 */
export function localBerlinToIso(local: string): string | null {
  const m = LOCAL_DATETIME.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as [number, number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  if (new Date(asUtc).getUTCMonth() !== mo - 1) return null;
  // Zwei Naeherungen genuegen, auch rund um die Umstellung.
  let offset = berlinOffsetMinutes(new Date(asUtc));
  offset = berlinOffsetMinutes(new Date(asUtc - offset * MS_PER_MINUTE));
  return `${local}${formatOffset(offset)}`;
}

/** Aktuelle oder uebergebene Zeit als Berlin ISO mit Offset, ohne Millisekunden. */
export function nowBerlinIso(at: Date = new Date()): string {
  const offset = berlinOffsetMinutes(at);
  const shifted = new Date(at.getTime() + offset * MS_PER_MINUTE);
  const local = shifted.toISOString().slice(0, 19);
  return `${local}${formatOffset(offset)}`;
}

/** Kalendertag in Berlin, `YYYY-MM-DD`. */
export function berlinDay(at: Date = new Date()): string {
  return nowBerlinIso(at).slice(0, 10);
}
