// See docs/security-nextjs-20261005.md. No temporary exceptions remain: the braces
// exception was removed after GitHub withdrew GHSA-vfj7-8cjw-p6xm on 2026-10-23.
// Every High/Critical finding blocks; malformed reports fail rather than pass.
export function evaluateAudit(report, lock) {
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
  const blocked = Object.entries(entries)
    .filter(([, vulnerability]) => ['high', 'critical'].includes(vulnerability.severity))
    .map(([name]) => name);
  return { blocked };
}
