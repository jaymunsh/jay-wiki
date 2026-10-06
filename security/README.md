# Current application assessment: CVE-2026-47884

Reviewed on 2026-10-06; reassessment required before 2026-10-20 00:00 UTC.

The packaged Spring Framework 6.2.19 remains an affected library version. This
assessment does not patch the library or apply to another application. The
[Spring advisory](https://spring.io/security/cve-2026-47884/) requires `XsltView`,
a catch-all MVC mapping that renders a view, and an implicit view name. The
public fix is 7.0.9; the 6.2.20 fix is available through Enterprise Support.

The current jay-wiki backend serves REST response bodies. Its application
context has no XSLT view or resolver; catch-all URL handlers serve static
resources. `MvcXsltReachabilityTest` verifies these preconditions against the
actual Spring context in CI. A future controller, view resolver, MVC
configuration or framework change requires a new assessment.

`jaywiki.openvex.json` records `not_affected` with justification
`vulnerable_code_not_in_execute_path` for this application only. The exact
finding and `spring-webmvc@6.2.19` package identifier are scoped to the Spring
runtime image and JAR scan commands. No general Trivy ignore rule is added.
Unfiltered reports still retain the library finding. Other findings remain
subject to the existing security gates.

The validator and its tests reject another finding, another package version,
broader product scope, code-absence claims and an expired assessment. The
scheduled security workflow also enforces the expiry. Remove the statement
when moving to a fixed framework version; recheck these preconditions before
enabling any MVC view rendering. A Spring Boot major migration needs its own
compatibility verification and is not represented here as completed.
