import type { DailyEntry } from '../types';
import { targetRateKgPerWeek, type Goals } from '../parse/goals';
import { complianceOf } from '../analytics/compliance';
import { avg } from '../analytics/smoothing';
import { detectPlateau, weightTrend } from '../analytics/trend';
import { tdeeRange } from '../analytics/tdee';
import { byId } from './dom';
import { decimal, integer, signed } from './format';

/**
 * Beobachtungen zum aktuellen Stand.
 *
 * Bewusst keine Anweisungen. Die Kalorienvorgabe trifft der Trainer, und ein
 * Dashboard, das Gegenvorschlaege macht, ist genau das, was in der
 * Anforderungsklaerung ausgeschlossen wurde. Jede Aussage beschreibt einen
 * Zustand und nennt die Zahl, auf der sie beruht.
 *
 * Hoechstens drei Aussagen. Wer fuenf Hinweise gleichzeitig zeigt, zeigt keinen.
 */

const MAX_STATEMENTS = 3;

/** Ab dieser Abweichung von der Sollrate ist das Tempo eine Meldung wert. */
const RATE_TOLERANCE = 1.3;

/** Unterhalb dieser Compliance wird die schwaechste Saeule benannt. */
const COMPLIANCE_ATTENTION_PCT = 70;

type Tone = 'pos' | 'warn' | 'neutral';

/** Kategorie der Aussage, als Rubrik ueber dem Satz. */
type Kind = 'Tempo' | 'Trend' | 'Ernährung' | 'Bilanz';

interface Statement {
  tone: Tone;
  kind: Kind;
  text: string;
  note?: string;
  /** Hoehere Zahl gewinnt. Die staerkste Aussage fuehrt, zwei folgen kleiner. */
  weight: number;
}

const TONE_COLORS: Record<Tone, string> = {
  pos: 'var(--green)',
  warn: 'var(--orange)',
  neutral: 'var(--text-tertiary)',
};

export function buildStatements(
  daily: readonly DailyEntry[],
  goals: Goals,
): Statement[] {
  const statements: Statement[] = [];
  const trend = weightTrend(daily);

  // 1. Tempo gegen Vorgabe.
  if (trend.ok) {
    const soll = targetRateKgPerWeek(goals.rateOfLossPct, trend.currentSmoothed);
    if (soll !== null) {
      const ist = Math.abs(trend.ratePerWeek);
      const plan = Math.abs(soll);
      const note = `${decimal(ist, 2)} kg gegen ${decimal(plan, 2)} kg geplant · Basis ${integer(trend.basisDays)} Tage`;
      if (ist > plan * RATE_TOLERANCE) {
        statements.push({ tone: 'warn', kind: 'Tempo', weight: 90, note, text: 'Dein Gewichtsverlust liegt deutlich über dem geplanten Bereich.' });
      } else if (ist < plan / RATE_TOLERANCE) {
        statements.push({ tone: 'warn', kind: 'Tempo', weight: 80, note, text: 'Dein Gewichtsverlust liegt unter dem geplanten Bereich.' });
      } else {
        statements.push({ tone: 'pos', kind: 'Tempo', weight: 40, note, text: 'Dein Tempo liegt im geplanten Bereich.' });
      }
    }
  }

  // 2. Plateau der letzten zwei Wochen.
  const proteinTarget = goals.average.proteinG;
  const proteinCompliance = proteinTarget === null
    ? null
    : complianceOf(daily, (e) => e.protein, (v) => v >= proteinTarget).pct;
  const plateau = detectPlateau(daily, proteinCompliance);
  if (plateau.ok) {
    const note = `${decimal(Math.abs(plateau.ratePerWeek), 2)} kg pro Woche · Basis ${integer(plateau.basisDays)} Tage`;
    if (plateau.status === 'plateau') {
      statements.push({ tone: 'warn', kind: 'Trend', weight: 95, note, text: 'Die letzten 14 Tage zeigen ein Plateau, obwohl die Ausführung stimmt.' });
    } else if (plateau.status === 'ausfuehrung') {
      statements.push({ tone: 'warn', kind: 'Trend', weight: 85, note, text: 'Die letzten 14 Tage stehen still, bei gleichzeitig schwacher Compliance.' });
    } else {
      statements.push({ tone: 'pos', kind: 'Trend', weight: 35, note, text: 'Die letzten 14 Tage zeigen kein Plateau.' });
    }
  }

  // 3. Schwaechste Saeule der Ausfuehrung.
  const weakest = weakestPillar(daily, goals);
  if (weakest) statements.push(weakest);

  // 4. Erhaltungsbedarf, sobald er belastbar ist.
  const tdee = tdeeRange(daily);
  if (tdee.ok) {
    const spread = tdee.high - tdee.low;
    statements.push({
      tone: 'neutral',
      kind: 'Bilanz',
      weight: 30,
      note: `Fenster ${tdee.estimates.map((e) => e.windowDays).join(', ')} Tage`,
      text: spread > 400
        ? `Der geschätzte Erhaltungsbedarf streut deutlich, zwischen ${integer(tdee.low)} und ${integer(tdee.high)} kcal.`
        : `Der geschätzte Erhaltungsbedarf liegt bei ${integer(tdee.low)} bis ${integer(tdee.high)} kcal pro Tag.`,
    });
  }

  return statements.sort((a, b) => b.weight - a.weight).slice(0, MAX_STATEMENTS);
}

interface Pillar {
  /** Bezeichnung im Satz, etwa `deine Kalorien`. */
  name: string;
  pct: number;
  hit: number;
  recorded: number;
  /** Abweichung des Schnitts vom Ziel in Prozent, positiv in die gute Richtung. */
  deviation: number | null;
}

/**
 * Die Zielgroesse mit der schlechtesten Trefferquote.
 *
 * Trefferquote und Schnitt sagen Verschiedenes, und beide gehoeren in den Satz.
 * Der Schnitt kann auf der guten Seite liegen, waehrend nur die Haelfte der Tage
 * trifft. Genau das ist bei den Kalorien der Fall: 0.8 Prozent unter der Vorgabe
 * im Mittel, aber nur 43 von 81 Tagen darunter. Ein Satz, der nur von der
 * schwaechsten Stelle spricht, widerspricht dann der Kachel daneben.
 */
function weakestPillar(daily: readonly DailyEntry[], goals: Goals): Statement | null {
  const candidates: Pillar[] = [];

  const add = (
    name: string,
    target: number | null,
    pick: (e: DailyEntry) => number | null,
    hit: (v: number) => boolean,
    direction: 'atLeast' | 'atMost',
  ): void => {
    if (target === null) return;
    const result = complianceOf(daily, pick, hit);
    if (result.pct === null || result.recorded < 14) return;
    const mean = avg(daily.map(pick));
    const raw = mean === null ? null : ((mean - target) / target) * 100;
    const deviation = raw === null ? null : direction === 'atMost' ? -raw : raw;
    candidates.push({ name, pct: result.pct, hit: result.hit, recorded: result.recorded, deviation });
  };

  add('deine Kalorien', goals.average.caloriesKcal, (e) => e.calories, (v) => v <= goals.average.caloriesKcal!, 'atMost');
  add('dein Protein', goals.average.proteinG, (e) => e.protein, (v) => v >= goals.average.proteinG!, 'atLeast');
  add('deine Schritte', goals.average.steps, (e) => e.steps, (v) => v >= goals.average.steps!, 'atLeast');

  if (!candidates.length) return null;
  const worst = candidates.reduce((a, b) => (a.pct <= b.pct ? a : b));
  const days = `${integer(worst.hit)} von ${integer(worst.recorded)} Tagen im Ziel`;

  if (worst.pct >= COMPLIANCE_ATTENTION_PCT) {
    return {
      tone: 'pos',
      kind: 'Ernährung',
      weight: 25,
      text: 'Alle Zielgrößen liegen über siebzig Prozent Trefferquote.',
      note: `Schwächste: ${worst.name} mit ${integer(worst.pct)} %`,
    };
  }

  // Schnitt auf der guten Seite, aber wenige Tage im Ziel: das ist Streuung,
  // keine zu hohe Zufuhr. Der Satz muss beides nennen, sonst widerspricht er
  // der Kennzahl daneben.
  if (worst.deviation !== null && worst.deviation >= 0) {
    return {
      tone: 'warn',
      kind: 'Ernährung',
      weight: 70,
      text: `Im Schnitt triffst du ${worst.name}, von Tag zu Tag schwanken sie aber stark.`,
      note: `${days} · Schnitt ${signed(worst.deviation, 1)} % gegenüber der Vorgabe`,
    };
  }

  return {
    tone: 'warn',
    kind: 'Ernährung',
    weight: 70,
    text: `Bei ${worst.name} liegst du im Schnitt und an den meisten Tagen neben der Vorgabe.`,
    note: worst.deviation === null
      ? days
      : `${days} · Schnitt ${signed(worst.deviation, 1)} % gegenüber der Vorgabe`,
  };
}

/**
 * Ein Insight als Zeile.
 *
 * Statuspunkt, Titel, ein bis zwei Zeilen Erklaerung. Kein eigener Container je
 * Hinweis, nur feine waagerechte Trenner. Drei gleich schwere Kaesten lasen sich
 * wie eine Tabelle und liessen offen, was zuerst zu lesen ist.
 */
function statementNode(statement: Statement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'insight';

  const dot = document.createElement('span');
  dot.className = 'insight-dot';
  dot.style.background = TONE_COLORS[statement.tone];

  const title = document.createElement('span');
  title.className = 'insight-title';
  title.textContent = statement.kind;

  const body = document.createElement('p');
  body.className = 'insight-body';
  body.textContent = statement.text;

  if (statement.note) {
    const note = document.createElement('span');
    note.className = 'num';
    note.style.color = 'var(--text-tertiary)';
    note.textContent = ` ${statement.note}`;
    body.append(note);
  }

  row.append(dot, title, body);
  return row;
}

export function renderCoach(daily: readonly DailyEntry[], goals: Goals): void {
  const container = byId('coach');
  if (!container) return;
  container.replaceChildren(...buildStatements(daily, goals).map(statementNode));
}
