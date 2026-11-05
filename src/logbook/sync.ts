import type { LogbookAccess } from '../config/logbookAccess';
import type { PlanDay } from '../parse/plan';
import { buildRows, hasData, loadSessions, markSent, sessionId, type Session } from './session';

/**
 * Senden der Sitzungen an das Apps Script des Logbuchs (ADR 0010).
 *
 * Die Anfrage geht ohne Content Type raus, der Browser macht daraus
 * `text/plain`, eine einfache Anfrage ohne Preflight. Das Script ersetzt die
 * Zeilen der Einheit mit derselben `id`.
 */

export type SendResult = { ok: true } | { ok: false; error: string };

/** Fehlertext bei Netzausfall oder unlesbarer Antwort. */
export const NETWORK_ERROR = 'kein Netz';

export async function sendSession(access: LogbookAccess, session: Session, day: PlanDay): Promise<SendResult> {
  const body = JSON.stringify({
    token: access.token,
    id: sessionId(session.date, session.tag),
    data: session,
    rows: buildRows(session, day),
  });
  try {
    const response = await fetch(access.endpoint, { method: 'POST', body, redirect: 'follow' });
    const reply = (await response.json()) as { ok?: boolean; error?: string };
    if (reply.ok === true) return { ok: true };
    return { ok: false, error: typeof reply.error === 'string' ? reply.error : 'bad_response' };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

export interface FlushOutcome {
  /** Anzahl Sitzungen, die gesendet wurden. */
  sent: number;
  /** Letzter Fehler, null wenn alles durchging oder nichts offen war. */
  error: string | null;
  /** Offene Sitzungen, die nicht gesendet werden konnten. */
  remaining: number;
}

/**
 * Sendet alle offenen Sitzungen nacheinander. Bei einem Fehler endet der Lauf,
 * die Sitzungen bleiben offen. Sitzungen ohne Eintrag oder ohne Tag im Plan
 * werden nicht gesendet und gelten als erledigt.
 */
export async function flushPending(
  access: LogbookAccess,
  daysByTag: ReadonlyMap<string, PlanDay>,
): Promise<FlushOutcome> {
  const pending = Object.entries(loadSessions()).filter(([, s]) => s.pending);
  let sent = 0;
  for (const [id, session] of pending) {
    const day = daysByTag.get(session.tag);
    if (!day || !hasData(session)) {
      markSent(id, session.updated);
      continue;
    }
    const result = await sendSession(access, session, day);
    if (!result.ok) {
      return { sent, error: result.error, remaining: Object.values(loadSessions()).filter((s) => s.pending).length };
    }
    markSent(id, session.updated);
    sent++;
  }
  return { sent, error: null, remaining: Object.values(loadSessions()).filter((s) => s.pending).length };
}
