# Third-party notices

This document records major third-party material used directly by jay-wiki. It is a maintained
human-readable inventory, not a complete replacement for license texts or a generated SBOM.

## Web font

Both fonts below are self-hosted: the woff2 files live in `web/src/app/fonts/` and are served by
Next.js local fonts, with the OFL text kept next to each file.

- Pretendard 1.3.9, Copyright Kil Hyung-jin and contributors, SIL Open Font License 1.1.
  https://github.com/orioncactus/pretendard
- JetBrains Mono, Copyright 2020 The JetBrains Mono Project Authors, SIL Open Font License 1.1.
  https://github.com/JetBrains/JetBrainsMono

Font family names used only as CSS fallbacks do not mean that jay-wiki redistributes those font files.

## UI and technology icons

- Lucide, ISC License. https://github.com/lucide-icons/lucide
- Simple Icons SVG data, CC0-1.0. https://github.com/simple-icons/simple-icons

Names and logos of third parties may be trademarks of their respective owners. Their use in jay-wiki
identifies technologies used by the project and does not imply sponsorship or endorsement. Simple Icons'
license does not grant trademark permission; brand-specific guidelines still apply.

## Application dependencies

The application directly uses open-source packages including Next.js, React, Mermaid, marked,
highlight.js, sanitize-html, Spring Boot, Spring Kafka, Apache POI, OpenTelemetry, Micrometer, Flyway, JJWT,
MinIO Java SDK, PostgreSQL JDBC, FastAPI, Pydantic, Uvicorn and Prometheus clients.

Their exact versions are recorded in `web/package-lock.json`, Gradle dependency resolution and
`services/payment-api/uv.lock`. Most direct packages use MIT, Apache-2.0, BSD or ISC licenses, but
transitive and platform-specific artifacts can use different licenses. Generated image-level SBOMs
remain the source for a complete release inventory.

## Runtime services

PostgreSQL, Redis, Kafka, OpenSearch, Prometheus, Grafana, Loki, Tempo, OpenTelemetry Collector,
MinIO and cloudflared are deployed as separate runtime components. Each component and container image
retains its own copyright and license. Exact deployed tags must be reviewed before redistributing an
image or a modified build.

See `docs/open-source-and-content-license-audit.md` for scope, current findings and follow-up work.
