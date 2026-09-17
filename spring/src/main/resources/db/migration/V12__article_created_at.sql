-- 문서 작성일(created_at) 도입.
--
-- 기존 tb_article 에는 updated_at 만 있어 "언제 쓴 글인지" 를 알 수 없었다.
-- 백필 값은 추정치가 아니라 근거가 있는 값만 넣는다. 각 문서의 slug 가
-- scripts/seed-portfolio-wiki.mjs 에 처음 등장한 커밋 날짜(KST)를 작성일로 본다.
-- 근거를 찾지 못한 문서는 채우지 않고 null 로 남긴다. updated_at 으로 대신 채우면
-- 작성일이 아닌 값이 작성일 컬럼에 들어가므로 하지 않는다.

alter table public.tb_article
    add column if not exists created_at timestamptz;

update public.tb_article set created_at = timestamptz '2026-07-22 00:00:00+09' where slug = 'account-secret-least-privilege-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'admin-user-role-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-21 00:00:00+09' where slug = 'ai-agent-keychain-production-auth-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-15 00:00:00+09' where slug = 'ai-assisted-development-harness' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'api-error-contract' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'cicd-ghcr-runner' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'cloudflare-tunnel-config-postmortem' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-21 00:00:00+09' where slug = 'cmux-workspace-freeze-session-restore-retrospective' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-22 00:00:00+09' where slug = 'development-delivery-evidence-loop' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-20 00:00:00+09' where slug = 'donts3p-macos-sleep-assertion-app' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-22 00:00:00+09' where slug = 'evidence-maturity-and-claim-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-22 00:00:00+09' where slug = 'gitops-wiki-content-sync-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-20 00:00:00+09' where slug = 'gongsitoktok-team-rag-mvp-retrospective' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-22 00:00:00+09' where slug = 'hypothesis-driven-debugging-loop' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-21 00:00:00+09' where slug = 'jaycron-local-first-calendar-dashboard' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'jaywiki-main-map' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'k3s-manifest-boundaries' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-21 00:00:00+09' where slug = 'local-llm-qwen36-ollama-omlx-benchmark' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'markdown-security-and-admin-edit-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-20 00:00:00+09' where slug = 'mding-local-first-markdown-pwa' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'minio-portfolio-assets' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-21 00:00:00+09' where slug = 'minio-public-asset-governance' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'minipc-boundary-decision' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-15 00:00:00+09' where slug = 'minipc-hardware-capacity-design' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'minipc-k3s-cloudflare' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'minipc-reboot-recovery-drill' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'nextjs-frontend-redesign' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'oauth-public-origin-smoke' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'observability-loki-tempo-grafana' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-16 00:00:00+09' where slug = 'open-source-license-content-governance' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'opensearch-nori-image' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-21 00:00:00+09' where slug = 'orca-mobile-agent-workflow-retrospective' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-16 00:00:00+09' where slug = 'personal-service-legal-launch-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'portfolio-retrospective-map' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-12 00:00:00+09' where slug = 'postgres-backup-artifact-verification' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'postgres-backup-restore' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'postgres-db-wiki-revision' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'postgres-restore-drill-1' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-12 00:00:00+09' where slug = 'production-content-sync-and-rollout' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-12 00:00:00+09' where slug = 'production-static-asset-recovery' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'redis-random-chat-queue' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-12 00:00:00+09' where slug = 'responsive-navigation-regression-check' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'roadmap-after-content' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'saga-kafka-outbox-order' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-12 00:00:00+09' where slug = 'saga-trace-service-graph-verification' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'search-comparison-100k' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'search-comparison-results' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'spring-bff-auth-boundary' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'spring-fastapi-payment-contract' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-10 00:00:00+09' where slug = 'troubleshooting-log' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-16 00:00:00+09' where slug = 'wiki-content-asset-retention-governance' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-15 00:00:00+09' where slug = 'wiki-image-asset-lifecycle' and created_at is null;
update public.tb_article set created_at = timestamptz '2026-07-11 00:00:00+09' where slug = 'wiki-navigation-and-responsive-stability' and created_at is null;

-- Quantinue 글은 아직 커밋되지 않아 seed 파일 이력에 없다.
-- docs/current-project-status.md 의 "2026-08-01 Quantinue 팀 프로젝트 글을 추가해
-- 시드·로컬 DB 기준은 54편이다" 기록을 근거로 채운다.
update public.tb_article set created_at = timestamptz '2026-08-01 00:00:00+09'
    where slug = 'quantinue-ai-mock-trading-team-project-retrospective' and created_at is null;

create index if not exists idx_article_parent_created
    on public.tb_article (parent_id, created_at);
