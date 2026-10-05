// See docs/security-nextjs-20261005.md. This is an expiring exception, not a fix.
const BRACES_ADVISORY = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const EXPIRES = Date.parse('2026-10-19T00:00:00Z');

export function evaluateAudit(report, lock, now = new Date()) {
  if (report?.auditReportVersion !== 2 || !report?.vulnerabilities || typeof report.vulnerabilities !== 'object' ||
      Array.isArray(report.vulnerabilities) || report.error || !lock?.packages) {
    throw new Error('Invalid npm audit report or lockfile');
  }
  const entries = report.vulnerabilities;
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const [name, v] of Object.entries(entries)) {
    if (!Object.hasOwn(counts, v?.severity) || v.severity === 'total' ||
        !Array.isArray(v.nodes) || v.nodes.length === 0 ||
        !v.nodes.every(node => typeof node === 'string' && Object.hasOwn(lock.packages, node)) ||
        !Array.isArray(v.via) || v.via.length === 0 ||
        !v.via.every(via => typeof via === 'string'
          ? Object.hasOwn(entries, via)
          : via && typeof via === 'object' && typeof via.url === 'string' &&
            via.url.startsWith('https://github.com/advisories/GHSA-'))) {
      throw new Error(`Invalid vulnerability entry for ${name}`);
    }
    counts[v.severity]++; counts.total++;
  }
  const reported = report.metadata?.vulnerabilities;
  if (!reported || typeof reported !== 'object' || Array.isArray(reported) ||
      !Object.entries(counts).every(([severity, count]) =>
        Number.isSafeInteger(reported[severity]) && reported[severity] === count)) {
    throw new Error('Invalid or inconsistent npm audit totals');
  }
  function isException(name, seen = new Set()) {
    const v = entries[name];
    if (!v || seen.has(name) || v.severity !== 'high' ||
        !Number.isFinite(now.getTime()) || now.getTime() >= EXPIRES ||
        !Array.isArray(v.nodes) || v.nodes.length === 0 ||
        !v.nodes.every(node => lock.packages[node]?.dev === true) ||
        !Array.isArray(v.via) || v.via.length === 0) return false;
    const nextSeen = new Set([...seen, name]);
    return v.via.every(via => typeof via === 'string'
      ? isException(via, nextSeen)
      : name === 'braces' && via?.url === BRACES_ADVISORY &&
        v.nodes.every(node => lock.packages[node]?.version === '3.0.3'));
  }
  const result = { blocked: [], exceptions: [] };
  for (const [name, vulnerability] of Object.entries(entries)) {
    if (['high', 'critical'].includes(vulnerability.severity)) {
      result[isException(name) ? 'exceptions' : 'blocked'].push(name);
    }
  }
  return result;
}
