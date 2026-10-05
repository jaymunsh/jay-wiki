import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluateAudit } from './lib/npm-audit-policy.mjs';

const audit = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
if (audit.error || ![0, 1].includes(audit.status)) throw new Error('npm audit did not complete');
const report = JSON.parse(audit.stdout);
if (!report.metadata?.vulnerabilities) throw new Error('npm audit returned no vulnerability totals');
writeFileSync('npm-audit.json', `${JSON.stringify(report, null, 2)}\n`);
const result = evaluateAudit(report, JSON.parse(readFileSync('package-lock.json', 'utf8')));
console.log('npm audit totals:', report.metadata.vulnerabilities);
for (const name of result.exceptions) console.log(`Temporary development exception until 2026-10-19: ${name} (GHSA-vfj7-8cjw-p6xm only)`);
for (const name of result.blocked) console.error(`Blocking vulnerability: ${name} (${report.vulnerabilities[name].severity})`);
process.exitCode = result.blocked.length ? 1 : 0;
