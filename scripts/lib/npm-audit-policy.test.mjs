import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAudit } from './npm-audit-policy.mjs';

const advisory = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
function fixture() {
  return {
    report: { vulnerabilities: {
      braces: { severity: 'high', nodes: ['node_modules/braces'], via: [{ url: advisory }] },
      tool: { severity: 'high', nodes: ['node_modules/tool'], via: ['braces'] },
    } },
    lock: { packages: {
      'node_modules/braces': { version: '3.0.3', dev: true },
      'node_modules/tool': { version: '1.0.0', dev: true },
    } },
    now: new Date('2026-10-05T00:00:00Z'),
  };
}
function totals(report) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const v of Object.values(report.vulnerabilities)) { counts[v.severity]++; counts.total++; }
  report.auditReportVersion = 2;
  report.metadata = { vulnerabilities: counts };
  return report;
}
function run(f = fixture()) { return evaluateAudit(totals(f.report), f.lock, f.now); }

test('permits only the documented development-only braces advisory and its ancestors', () => {
  assert.deepEqual(run(), { blocked: [], exceptions: ['braces', 'tool'] });
});
test('blocks a production ancestor of the excepted package', () => {
  const f = fixture(); f.lock.packages['node_modules/tool'].dev = false;
  assert.deepEqual(run(f).blocked, ['tool']);
});
test('blocks another advisory on the same dependency', () => {
  const f = fixture(); f.report.vulnerabilities.braces.via.push({ url: 'https://github.com/advisories/GHSA-new' });
  assert.deepEqual(run(f).blocked, ['braces', 'tool']);
});
test('expires the exception on October 19 even when the dependency is unchanged', () => {
  const f = fixture(); f.now = new Date('2026-10-19T00:00:00Z');
  assert.deepEqual(run(f).blocked, ['braces', 'tool']);
});
test('blocks changed or missing installed versions', () => {
  for (const version of ['3.0.4', undefined]) {
    const f = fixture(); f.lock.packages['node_modules/braces'].version = version;
    assert.deepEqual(run(f).blocked, ['braces', 'tool']);
  }
});
test('rejects missing dependency graph entries and empty advisory lists', () => {
  for (const via of [['unknown'], []]) {
    const f = fixture(); f.report.vulnerabilities.braces.via = via;
    assert.throws(() => run(f));
  }
});
test('blocks cycles in the exception dependency chain', () => {
  const f = fixture(); f.report.vulnerabilities.braces.via = ['tool'];
  assert.deepEqual(run(f).blocked, ['braces', 'tool']);
});
test('blocks an unrelated high or critical advisory regardless of the exception', () => {
  for (const severity of ['high', 'critical']) {
    const f = fixture(); f.report.vulnerabilities.other = { severity, nodes: ['node_modules/tool'], via: [{ url: 'https://github.com/advisories/GHSA-other' }] };
    assert.deepEqual(run(f).blocked, ['other']);
  }
});
test('rejects malformed audit reports rather than reporting success', () => {
  for (const report of [{}, { error: { message: 'registry unavailable' } }]) {
    assert.throws(() => evaluateAudit(report, fixture().lock, fixture().now));
  }
});
test('retains the existing high-severity threshold', () => {
  const f = fixture(); f.report.vulnerabilities.other = { severity: 'moderate', nodes: ['node_modules/tool'], via: [{ url: 'https://github.com/advisories/GHSA-other' }] };
  assert.deepEqual(run(f).blocked, []);
});
test('rejects malformed low and moderate entries as well as high entries', () => {
  for (const severity of ['low', 'moderate', 'high']) {
    for (const details of [{}, { nodes: [], via: [] }, { nodes: ['node_modules/tool'], via: [null] }]) {
      const f = fixture(); f.report.vulnerabilities.other = { severity, ...details };
      assert.throws(() => run(f));
    }
  }
});
test('rejects missing, malformed or inconsistent totals', () => {
  const f = fixture(); totals(f.report);
  for (const counts of [null, 'none', {}, { ...f.report.metadata.vulnerabilities, total: 0 },
    { ...f.report.metadata.vulnerabilities, high: -1 }, { ...f.report.metadata.vulnerabilities, high: '2' }]) {
    assert.throws(() => evaluateAudit({ ...f.report, metadata: { vulnerabilities: counts } }, f.lock, f.now));
  }
});
