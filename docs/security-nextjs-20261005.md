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
  ancestors until **2026-11-05 00:00 UTC**. Owner: jay-wiki maintenance.
- Reassessed 2026-10-22: braces is still 3.0.3 with no patched release, the chain is
  unchanged (`@next/eslint-plugin-next@16.4.2` still pins fast-glob 3.3.1) and
  `npm audit --omit=dev --audit-level=high` still reports zero. Extended by 14 days.
- Limits: a production dependency, new advisory, changed braces version, malformed
  audit report, unknown dependency chain, critical finding or expired exception
  still fails CI. Full npm audit JSON is retained for 30 days.
- Follow-up: remove the exception when an upstream patch is available; otherwise
  reassess before its expiry. It is not an assertion that braces is fixed.

The existing threshold remains High/Critical. The initial October 5 audit also
reported two Moderate development-only Vitest findings. The October 6 follow-up
upgraded Vitest to 4.1.11; see the current follow-up below rather than treating that
initial audit as the latest result.
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

## October 6–7 follow-up and resumption

The reviewed lockfile now contains Next.js 15.5.27, React/react-dom 19.2.7,
Vitest 4.1.11, source-map-js 1.2.2 and KaTeX 0.18.10. `gray-matter` was removed.
The October 7 recorded full web audit reports five High findings in the same
braces development-only chain and no Moderate/Critical findings. Those five are
retained under the existing narrowly scoped expiry, not declared patched.

sharp was upgraded to **0.35.5** on October 7 for
[GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
All declared optional native packages are included in the lockfile, including
Linux musl x64/arm64. The preceding production verification ran sharp 0.35.5 and
libvips 8.18.7 on Alpine and returned a PNG from the Next.js optimizer. The local
macOS build's librsvg 2.63.2 must not be represented as the production version:
that production runtime did not expose `sharp.versions.rsvg`.

The reviewed Spring Framework 6.2.19 remains a library finding for
CVE-2026-47884. [The application-scoped OpenVEX assessment](../security/README.md)
and `MvcXsltReachabilityTest` establish that this application's required XSLT
execution path is absent. This is not a Spring version upgrade or a general
library exemption. Reassess before **2026-10-20 00:00 UTC**, or immediately on
MVC/controller/view changes. The braces exception expires a day earlier,
**2026-10-19 00:00 UTC**; inspect `scripts/lib/npm-audit-policy.mjs` before then.

These dependency changes are included in source SHA
`602d69a06f535bae83d842c6326121930a3b972b`. Its
[release build](https://github.com/jaymunsh/jay-wiki/actions/runs/37506999823)
passed application verification and created all seven immutable images.
Production selection and delivery evidence belong to the private operations
record. This documentation update does not run another deployment or audit.
