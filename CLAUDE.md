# jay-wiki 저장소 작업 지침

한 저장소에 사이트 둘이 들어 있다. host 로 갈린다.

| | 주소 | 라우트 |
|---|---|---|
| 위키 | `portfolio.leneu.cloud` | `web/src/app/**` |
| 블로그 | `blog.leneu.cloud` | `web/src/app/blog/**` |

로컬은 `localhost:3000` 이 위키, `blog.localhost:3000` 이 블로그다. `middleware.ts` 가 `blog.` 접두사를 보고 가른다.

## 브랜치와 배포 — 먼저 읽는다

이 checkout은 공개 `jaymunsh/jay-wiki`다. 개발은 `develop`, 검토한 변경은 PR로 `main`에
반영한다. **공개 main 병합은 운영 배포가 아니다.** `.github/workflows/release.yml`은
GitHub-hosted runner에서 검사하고 전체 SHA의 이미지 7개를 GHCR에 만든 뒤 종료한다.
운영은 별도 비공개 `jaymunsh/jay-wiki-ops-private`가 선택한 SHA로 수행한다.

기본 브랜치는 `develop`이므로 운영용 소스 PR에는 `--base main`을 명시한다.

| 사용자 의도 | 실행 범위 |
|---|---|
| 취합 / develop에 모으기 | 변경 검토·테스트 후 공개 develop에 통합 |
| 운영 반영 / 배포 | main PR 검사·병합 → 성공한 SHA 이미지 7개 확인 → 비공개 ops release 선택 → preflight → deploy → 공개 smoke |
| 글만 반영 | 운영 DB와 대조한 개별 콘텐츠 발행. 앱 이미지 배포와 별개 |
| 문서 갱신 / 인계 | 문서와 링크 확인. 앱 재배포·글 발행을 시작하지 않는다 |

절차는 [공개 배포 안내](docs/deploy-runbook.md)를 따른다. 같은 로컬 작업 공간에서는
`private/docs/daily-operations.md`와
`private/skills/jay-wiki-production-deploy/SKILL.md`가
운영 실행의 정본이다. 오래된 `deploy.yml` 자동 배포 설명이나 보관 checkout을 사용하지 않는다.
이미 사용자가 요청한 운영 반영은 같은 권한을 재차 묻지 않되, 과거 인계 기록 자체를 새 작업의
배포 권한으로 해석하지 않는다.

- 새 작업은 develop 기준으로 한다. main에 직접 push하지 않는다.
- 공개 workflow에 miniPC self-hosted runner, private dispatch token, SSH key나 kubeconfig를 추가하지 않는다.
- 문서만 바뀐 main commit은 이미지 빌드의 경로 필터에 해당하지 않을 수 있다.
  소스 HEAD·문서 HEAD·운영 release SHA가 다르면 이유를 먼저 대조한다.
- 위키 기준 원본은 `content/wiki/`다. 운영 DB 반영은 비공개 배포의 백업·동기화 단계에서 수행한다.
  운영 `/sync`는 공개하지 않는다.
- 블로그는 `node scripts/blog-sync.mjs`로 대조하고 `publish-blog-post.mjs <초안>`으로 dry-run한다.
  대상 한 편을 검토한 뒤에만 `--write`로 발행한다. 운영 관리자 수정과 로컬 수정이 충돌하면 중단한다.
- 블로그 그림은 MinIO에 발행하고 원본은 `posts/jay-blog/assets/`에 남긴다.
- 자동 발행은 명시된 manifest와 비공개 운영 설정을 따른다.
  과거의 ‘모든 초안 발행’ 요청을 근거로 새 초안을 자동 발행하지 않는다.

## 서버 띄우기

먼저 3000·3100·8080 포트의 기존 프로세스를 확인한다. 실행 중이면 재사용한다.
Docker의 `pf-postgres`, `pf-redis`, `pf-opensearch`, `pf-kafka`, `pf-minio`도 확인한다.
아래 명령은 각각 **공개 저장소 루트에서 시작하는 별도 터미널**에서 실행한다.

```bash
# 터미널 1: Spring
cd spring
SPRING_PROFILES_ACTIVE=local APP_KAFKA_DEMO_ENABLED=true ./gradlew bootRun
```

```bash
# 터미널 2: Next.js
cd web
npm run dev
```

```bash
# 터미널 3: 오목
cd services/omok
PORT=3100 PUBLIC_ORIGIN=http://localhost:3100 npm run dev
```

**dev 서버를 여러 개 띄우지 않는다.** 겹쳐 돌면 삭제된 `.next` 를 서빙해 CSS 가 통째로 빠진 것처럼 보인다.
`npm run build` 도 dev 가 떠 있는 채로 돌리지 않는다.

**Spring 코드를 고쳤으면 `bootRun` 을 다시 띄운다.** 컴파일만 하고 재기동을 잊으면 화면이 옛 응답을 받는다.

## 검증 기준선

Spring/웹 수치는 [생성된 검증 기록](docs/test-summary.md)을 참고한다. `python3 scripts/update-test-summary.py`가 전체 테스트를 실행해 기록과 화면용 JSON을 함께 갱신한다. 부분 테스트 결과로 수치를 갱신하지 않는다.

```bash
cd spring && ./gradlew test      # Docker 필요 — Testcontainers
cd web && npx tsc --noEmit               # 통과
cd web && npm run lint                   # 경고 정확히 7개 (--max-warnings 7, 하나만 늘어도 빌드가 깨진다)
cd web && npm test                       # 통과
cd services/payment-api && uv run pytest -q     # 17개
cd services/shipping-api && uv run pytest -q    # 14개
```

시드를 고쳤으면 넷을 더 돌린다. **앞의 둘만 돌리고 끝내면 CI 가 export diff 로 잡는다.**

```bash
node scripts/seed-portfolio-wiki.mjs --dry-run    # 중복 slug·고아 글
node scripts/seed-portfolio-wiki.mjs              # 로컬 DB 반영
node scripts/check-wiki-consistency.mjs --seed-only
node scripts/export-portfolio-wiki.mjs            # 안 하면 CI 가 git diff 로 잡는다
```

**lint 경고 7건은 전부 `react-hooks/set-state-in-effect` 하나다.** 화면 다섯 개의 데이터 로딩
효과를 재구성해야 없앨 수 있는데, 그 화면들은 vitest 가 회귀를 못 잡는다. 줄이는 것보다
`--max-warnings 7` 로 새 경고를 막는 쪽이 남는 판단이다.

**웹 화면은 자동 테스트가 못 잡는다.** vitest 가 node 환경이라 DOM 이 없다. 순수 함수만 테스트로 고정돼 있고
정렬·줄바꿈·넘침은 브라우저에서 눈으로 봐야 한다.

---

# 글 작업

| 무엇을 쓰나 | 무엇을 읽나 |
|---|---|
| 위키 글 (`content/wiki/articles/*.md`, 메타데이터는 `content/wiki/manifest.json`) | `wiki-writing` 스킬 → `docs/wiki-writing-guide.md` |
| 블로그 글 (`posts/jay-blog/drafts/`) | `blog-writing` 스킬 → `docs/blog-writing-guide.md` |

형식·문체·함정은 전부 가이드에 있다. 글을 쓰거나 고치기 전에 해당 스킬을 연다.
