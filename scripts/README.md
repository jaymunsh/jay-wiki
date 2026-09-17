# 스크립트 지도

기존 호출 경로를 유지한다. 운영 쓰기 명령은 목적과 대상을 확인한 뒤 사용한다.

| 역할 | 도구 |
|---|---|
| CI 선택 | `ci-scope.py`, `test-ci-scope.py` |
| 문서·콘텐츠 검증 | `check-docs.mjs`, `check-blog-markdown.mjs`, `check-blog-links.mjs`, `check-wiki-consistency.mjs` |
| 위키 원고 변환 | `seed-portfolio-wiki.mjs`, `build-wiki-seed.mjs`, `export-portfolio-wiki.mjs` |
| 블로그 발행·동기화 | `blog-sync.mjs`, `publish-blog-post.mjs`, `publish-blog-drafts.mjs` |
| 벤치마크 공개 사본 | `sync-leneu-benchmark-public.py` |
| 배포·복구 | `deploy-ghcr-images.sh`, `capture-deployment-images.sh`, `rollback-deployment.sh` |
| 배포 권한 검증 | `check-deployer-boundary.sh`, `verify-deployment-bootstrap.sh` |
| 접근 경계 검사 | `check-public-security-boundary.py`, `check-origin-security-boundary.py` |
| 백업 | `run-offsite-backup.sh`, `pull-prod-backup.sh` |

위키 입력은 `content/wiki/`, 블로그 기본 원고는 `posts/jay-blog/drafts/`다.
운영 문서의 분리는 이 경로들을 변경하지 않는다. 배포 절차는 [런북](../docs/deploy-runbook.md)을 따른다.
