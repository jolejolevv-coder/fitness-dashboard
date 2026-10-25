/**
 * Minimale robots.txt Auswertung fuer genau einen Pfad. Konservativ: trifft eine
 * Disallow Regel zu und keine laengere Allow Regel, gilt der Pfad als gesperrt.
 */

interface Group {
  agents: string[];
  rules: { allow: boolean; pattern: string }[];
}

function parseGroups(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'disallow' || field === 'allow') && current) {
      current.rules.push({ allow: field === 'allow', pattern: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped.endsWith('\\$') ? escaped.slice(0, -2) + '$' : escaped}`);
}

/**
 * `userAgentToken` ist der Produktname vor dem Schraegstrich, etwa
 * `fitness-dashboard-prices`. Gruppen fuer unseren Token haben Vorrang vor `*`.
 */
export function isPathAllowed(robotsTxt: string, userAgentToken: string, path: string): boolean {
  const groups = parseGroups(robotsTxt);
  const token = userAgentToken.toLowerCase();
  const own = groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const applicable = own.length > 0 ? own : groups.filter((g) => g.agents.includes('*'));

  let longestDisallow = -1;
  let longestAllow = -1;
  for (const rule of applicable.flatMap((g) => g.rules)) {
    if (rule.pattern === '') continue;
    if (!patternToRegExp(rule.pattern).test(path)) continue;
    if (rule.allow) longestAllow = Math.max(longestAllow, rule.pattern.length);
    else longestDisallow = Math.max(longestDisallow, rule.pattern.length);
  }
  return longestDisallow < 0 || longestAllow >= longestDisallow;
}
