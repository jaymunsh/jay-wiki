# 공개 소스 작업 안내

이 checkout의 정본 원격은 `jaymunsh/jay-wiki`다. 먼저 [CLAUDE.md](CLAUDE.md),
[현재 상태](docs/current-project-status.md), [배포 경계](docs/deploy-runbook.md)를 읽는다.

- 새 코드·문서 작업은 `develop` 기준으로 한다. 공개 `main`에 직접 push하지 않는다.
- `main` PR의 CI·Security가 통과한 뒤 병합하면 공개 SHA 이미지 7개를 빌드한다.
  **이 병합만으로 운영 서비스가 바뀌지 않는다.** 운영 배포는 별도 비공개 ops의 수동 절차다.
- 일반 문서 갱신에는 앱 재배포나 콘텐츠 발행이 필요하지 않다.
- 블로그 글·그림은 [발행 안내](posts/jay-blog/README.md)로 개별 대조·발행한다.
- 비공개 운영 저장소는 이 폴더 안의 `private/`(ignore됨)에 있다. 운영 절차의 정본은 `private/docs/`와 `private/skills/`다.
- `~/Documents/ClaudeCode/jay-wiki-private-archive/`(옛 `visualStudy/`)의 이전 Git 이력과 다른 보존 checkout을 이 저장소에 병합·push하지 않는다.
- 미커밋 변경과 실행 중인 dev 서버를 먼저 확인한다. 기존 사용자 작업을 지우지 않는다.
  Next dev와 build를 동시에 실행하거나 포트 3000 dev 서버를 중복 실행하지 않는다.
- 이 저장소의 보안 평가에는 만료가 있다. [패치 기록](docs/security-nextjs-20261005.md)과
  [Spring 평가](security/README.md)를 읽고 제한을 유지한다.

문서 변경 후 `node scripts/check-docs.mjs`와 `git diff --check`를 실행한다.
오목 변경은 `services/omok/README.md`의 테스트·브라우저 검사와 저장·재접속 조건을 따른다.
