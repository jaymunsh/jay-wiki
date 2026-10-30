# Current application assessment: CVE-2026-47884

Reviewed on 2026-10-06 and reassessed on 2026-10-22 and 2026-10-30; reassessment
required before 2026-11-13 00:00 UTC. The 2026-10-22 reassessment found no change under
`spring/src/main` or `spring/build.gradle` since the original review, no public 6.2.x fix
on Maven Central (latest 6.2.19, Boot 3.5.16) and a passing `MvcXsltReachabilityTest`.

The 2026-10-30 reassessment found Maven Central unchanged for the 6.2 line (latest
6.2.19, Boot 3.5.16; public fixes remain 7.0.9+ and Boot 4). Changes since 2026-10-22
are dependency pins (lz4-java, guava, snappy-java) and one `@RestControllerAdvice`
handler that returns a `ProblemDetail` body for `MethodArgumentTypeMismatchException`.
No source under `spring/src/main` uses `XsltView`, a view resolver, `ModelAndView`,
`SseEmitter`, `ResponseBodyEmitter`, `FragmentsRendering`, `text/event-stream` or
`RouterFunction`; the only `Mono` is the outbound `PartnerApiClient`. Both
`MvcXsltReachabilityTest` and `MvcSseRouterReachabilityTest` pass.

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

# Current application assessment: CVE-2026-47890 and CVE-2026-47892

Assessed on 2026-10-22 under the same review deadline. Both advisories list
6.2.0 - 6.2.19 as affected; the public fix is 7.0.9 and 6.2.20 is Enterprise
Support only. Spring Boot 4 migration is not represented here as completed.

- [CVE-2026-47890](https://spring.io/security/cve-2026-47890) requires sending
  view fragments over Server-Sent Events. No application handler returns
  `SseEmitter`, `ResponseBodyEmitter`, a reactive `Publisher` or
  `FragmentsRendering`, none produces `text/event-stream`, and handlers write
  response bodies rather than views.
- [CVE-2026-47892](https://spring.io/security/cve-2026-47892) requires functional
  endpoints with header predicates. The context registers no servlet or reactive
  `RouterFunction`; every `RouterFunctionMapping` is empty.

WebFlux is on the classpath only for the outbound `WebClient`.
`MvcSseRouterReachabilityTest` verifies both preconditions against the actual
context. Adding SSE, view fragments or functional endpoints requires a new
assessment before merging. The validator accepts exactly these three statements
with their own product scope and evidence.
