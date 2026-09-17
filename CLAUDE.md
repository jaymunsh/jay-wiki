# jay-wiki 저장소 작업 지침

한 저장소에 사이트 둘이 들어 있다. host 로 갈린다.

| | 주소 | 라우트 |
|---|---|---|
| 위키 | `portfolio.leneu.cloud` | `web/src/app/**` |
| 블로그 | `blog.leneu.cloud` | `web/src/app/blog/**` |

로컬은 `localhost:3000` 이 위키, `blog.localhost:3000` 이 블로그다. `middleware.ts` 가 `blog.` 접두사를 보고 가른다.

## 브랜치와 배포 — 먼저 읽는다

**`main` 에 들어가는 순간 miniPC 운영에 배포된다.** `deploy.yml` 이 push 를 받아 테스트·빌드·rollout 까지
사람 없이 간다. 그래서 작업은 전부 `develop` 에 모으고, **배포는 `develop` → `main` 을 머지하는 행동으로만** 한다.

기본 브랜치는 `develop` 이다. `gh pr create` 는 base 를 develop 으로 자동 지정한다.

| 사용자가 이렇게 말하면 | 이렇게 한다 |
|---|---|
| **취합해줘** / 모아줘 / develop 에 올려줘 | 작업 브랜치 → `develop` PR 을 만들고 머지 |
| **서버에 반영해줘** / 배포해줘 / 운영에 올려줘 | `develop` → `main` PR 을 만들고 머지 (**이게 배포다**) |
| **글만 올려줘** / 글만 반영해줘 | 배포가 아니다. 블로그는 `node scripts/blog-sync.mjs --write`(양방향) 또는 `publish-blog-post.mjs <초안> --write`(한 편), 위키는 `/sync` 또는 `content-ops.mjs publish-*` |

**둘 중 어느 쪽이든 `deploying` 스킬을 먼저 연다** → `docs/deploy-runbook.md`. 배포 전 확인,
파이프라인 밖이라 사람이 따로 올려야 하는 것, 배포 후 검증 명령이 거기에 있다.

- **새 작업은 `develop` 에서 딴다.** `main` 에서 따지 않는다.
- **`main` 을 base 로 쓸 때는 `--base main` 을 명시하고, 그게 배포라는 것을 먼저 사용자에게 확인한다.**
- **`main` 에 직접 push 하지 않는다.** 무료 플랜 + 비공개 저장소라 브랜치 보호를 걸 수 없다
  (`gh api .../branches/main/protection` → 403). 구조가 아니라 규율로만 지켜진다.
- 배포에는 경로 필터가 있다. `web/**`, `spring/**`, `infra/k8s/**`, `infra/opensearch/**`,
  `scripts/**`, `content/wiki/**`, `services/**`, `.github/workflows/deploy.yml` 이 바뀔 때만 돈다.
  `docs/` 나 `posts/` 만 고친 커밋은 `main` 에 가도 배포가 안 걸린다.
- **위키 글도 두 번 머지해야 운영에 반영된다.** 배포가 시드를 자동 실행하므로 `develop` 까지만 가면
  화면이 안 바뀐다.
- **자동 발행은 `posts/jay-blog/publish-manifest.txt`에 명시한 초안만 대상으로 한다.** 목록은 기본적으로 비어 있다. 운영 기준 해시를 대조하고 발행할 파일을 선택한 뒤 목록에 넣는다.
  발행 뒤의 본문·그림 주소·반환된 syncHash를 저장소에 남긴다. Job 임시 디렉터리의 변경은 저장소로 돌아오지 않으므로 다음 발행 전 기준을 다시 대조한다.
- **글만 고쳤다면 배포를 안 해도 된다.** 블로그는 `blog-sync.mjs` 가 로컬과 운영을 대조해
  편마다 방향을 정하고 그림까지 옮긴다. 한 편만 올릴 때는 `publish-blog-post.mjs` 다
  (2026-09-02부터. GitHub Actions 도 TOTP 도 안 쓰고 `ssh miniPC` 로 내부 문을 쓴다).
  그림은 MinIO 로 가고 원본은 `posts/jay-blog/assets/` 에 남는다 — `web/public` 이 아니라
  컨테이너에 안 구워지므로 배포를 안 부른다. 위키는 여전히 `/sync` 판이다(TOTP 필요).
  **운영 관리 화면에서 고친 글은 초안이 덮지 않는다** — `blog-sync` 가 그때는 내리는 쪽으로 간다.
  로컬과 운영이 모두 바뀌면 충돌로 중단한다. 파일 수정 시각만으로 운영 덮어쓰기를 허용하지 않는다.

## 서버 띄우기

```bash
docker ps                      # pf-postgres, pf-redis, pf-opensearch 가 떠 있어야 한다
cd spring && SPRING_PROFILES_ACTIVE=local APP_KAFKA_DEMO_ENABLED=true ./gradlew bootRun
cd web && npm run dev
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
