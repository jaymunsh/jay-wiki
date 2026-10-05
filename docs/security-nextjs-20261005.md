# Next.js security patch, 2026-10-05

Next.js and eslint-config-next move from 15.5.25 to 15.5.27, following
[the September security release](https://nextjs.org/blog/september-2026-security-release).
React remains 19.2.7. Compatible lockfile updates fix brace-expansion, DOMPurify and
fast-uri advisories; react-doctor moves from 0.7.3 to 0.9.17 to remove its affected
glob dependency chain. No application routes or authentication rules change.

## One development dependency needs a temporary exception

- Advisory: [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Package: braces 3.0.3; no patched npm release exists as of 2026-10-05.
- Path: eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces.
- Exposure: every package in this chain is development-only in the lockfile. ESLint
  receives repository-controlled patterns, not public HTTP input. Production
  `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities.
- Decision: retain the finding and allow only this advisory and its development-only
  ancestors until **2026-10-19 00:00 UTC**. Owner: jay-wiki maintenance.
- Limits: a production dependency, new advisory, changed braces version, malformed
  audit report, unknown dependency chain, critical finding or expired exception
  still fails CI. Full npm audit JSON is retained for 30 days.
- Follow-up: remove the exception when an upstream patch is available; otherwise
  reassess before its expiry. It is not an assertion that braces is fixed.

The existing threshold remains High/Critical. Two Moderate development-only
Vitest findings remain reported; upgrading the test runner is separate work.
Runtime image scans continue to block fixable High/Critical vulnerabilities.

## Other runtime findings surfaced by the full release scan

The PR's full Security run also blocked pre-existing fixable vulnerabilities in
other services. The same release applies two focused dependency updates:

- Jackson BOM 2.21.5 → 2.21.7 on the existing 2.21 line. Runtime scans identified
  CVE-2026-89407, CVE-2026-89425, CVE-2026-68497, CVE-2026-91776 and
  CVE-2026-91777 in jackson-core/databind. See the
  [Jackson 2.21 release history](https://github.com/FasterXML/jackson/wiki/Jackson-Release-2.21).
- urllib3 2.7.0 → 2.8.0 in the payment and shipping lockfiles. This fixes HTTPS
  proxy TLS configuration, unbounded chunk-size buffering and a Deflate streaming
  loop; see the [upstream release](https://github.com/urllib3/urllib3/releases/tag/2.8.0).
  Only urllib3 changed in each lockfile. No new exception covers these findings.

The full PR CI must pass Java and both Python integration tests with disposable
databases, together with the runtime JAR/image scans, before production delivery.
