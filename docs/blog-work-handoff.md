# 블로그 작업 인수인계

작성일: 2026-08-02 (최종 갱신 2026-08-03)
목적: 세션이 바뀌어도 이 작업을 이어갈 수 있게, 대화에만 있던 판단과 상태를 남긴다.

## 새 세션에서 이어받는 법

**이 문서의 작업은 2026-08-03 에 전부 끝났다.** 아래는 기록이고, 이어서 할 일은 없다.
블로그를 다시 손볼 때 배경 지식으로 읽으면 된다.

후속 작업은 [docs/interview/](./interview/) 로 이어진다 — `/scenarios` 21편 면접 정리와
거기서 도출된 사이트 수정 목록이 있다.

**정확히 어디까지 왔나 (2026-08-03 최종)**

관리자 계획([docs/superpowers/plans/2026-08-02-blog-admin.md](./superpowers/plans/2026-08-02-blog-admin.md))의
**Task 1~11 전부 완료.** 코드로 할 일은 끝났고, **남은 것은 배포와 이관**이다(아래 "다음에 할 일").

| 태스크 | 상태 |
|---|---|
| 1 관리자 API 경계 + 글 조회 | 완료 |
| 2 글 저장 API + attachReferenced | 완료 |
| 3 카테고리 관리 API | 완료 |
| 4 댓글 관리 API | 완료 |
| 5 통계 보강 (V15) | 완료 |
| 6 웹 데이터 계층 + 사이드바 | 완료 |
| 7 MarkdownBodyEditor 분리 | 완료 — **상호작용 6개 브라우저로 검증됨** |
| 8 블로그 글 목록·편집 화면 | 완료 |
| 9 카테고리 관리 화면 | 완료 |
| 10 댓글 관리 화면 | 완료 |
| 11 통계 대시보드 | 완료 |

**블로그가 읽기 전용을 벗어났다.** 관리자 화면에서 글을 쓰고, 고치고, 지울 수 있다.

**dev 서버를 여러 개 띄우지 말 것.** 이번에 세 개가 겹쳐 돌면서 삭제된 `.next` 를 서빙해
사이트 CSS 가 통째로 빠져 보였다. 코드 문제로 착각하기 쉽다.

```bash
pkill -f "next-server"; pkill -f "next dev"; sleep 2
lsof -ti :3000    # 비어 있어야 한다
cd web && rm -rf .next && npm run dev
```

**먼저 확인할 것 네 가지.** 확인 전에는 코드를 건드리지 않는다.

```bash
git branch --show-current               # feat/blog-backend 여야 한다. 아니면 checkout
docker ps --format '{{.Names}}'         # pf-postgres, pf-redis, pf-opensearch 가 떠 있어야 한다
cd spring && ./gradlew test      # 166개 통과가 기준선
cd web && npm run lint && npm test       # lint 경고 8개(상한과 같다), 테스트 61개
```

**`.env.local` 을 고쳤으면 dev 를 다시 띄운다.** `NEXT_PUBLIC_*` 은 빌드 시점에 인라인돼서
hot reload 로 반영되지 않는다. 크로스 사이트 링크(위키 LAB 탭 ↔ 블로그 '위키로 돌아가기')가
이 값으로 결정된다 — 없으면 로컬에서 눌러도 운영 사이트로 튄다.

**`npm run build` 를 dev 서버가 떠 있는 채로 돌리지 말 것.** 빌드가 `.next` 를 갈아엎어서
dev 가 서빙하던 CSS 가 통째로 사라진다. 이번에 실제로 당했다. 돌렸다면 위의 재기동 절차를 그대로 밟는다.

로컬 관리자 로그인은 `admin` / `admin1234`.

`npm run lint` 는 `--max-warnings 8` 이고 지금 정확히 8개다. **새 경고를 하나라도 늘리면 빌드가 깨진다.**

**지금 상태를 한 줄로**: **이 작업은 끝났다.** `blog.leneu.cloud` 가 글 8편으로 살아 있고
다이어그램까지 정상이며, 읽기 화면·관리 화면·운영 이관·**위키 원본 삭제까지 전부 완료됐다**
(2026-08-03). 중복 색인 상태도 해소됐다.

**글은 운영 관리자 화면에서 쓴다** — `portfolio.leneu.cloud/admin/blog/posts/new`.
로컬에서 쓴 글을 운영으로 옮기는 경로는 없다(아래 "다음에 할 일 0번"에 이유를 적었다).

로컬 실행:

```bash
cd spring && SPRING_PROFILES_ACTIVE=local APP_KAFKA_DEMO_ENABLED=true ./gradlew bootRun
cd web && npm run dev     # http://blog.localhost:3000 이 블로그, http://localhost:3000 이 위키
```

middleware 를 고쳤는데 rewrite 가 안 먹으면 `.next` 캐시를 지우고 dev 를 다시 띄운다.
`config.matcher` 변경은 hot reload 로 반영되지 않는다.

## 지금 어디까지 왔나

| 산출물 | 위치 | 상태 |
|---|---|---|
| 설계 | [docs/superpowers/specs/2026-08-02-blog-leneu-cloud-design.md](./superpowers/specs/2026-08-02-blog-leneu-cloud-design.md) | 확정. 9절·12절은 프론트 라운드에서 수정됨 |
| 백엔드 구현 계획 | [docs/superpowers/plans/2026-08-02-blog-backend.md](./superpowers/plans/2026-08-02-blog-backend.md) | 태스크 10개 완료 |
| 프론트 구현 계획 | [docs/superpowers/plans/2026-08-02-blog-frontend.md](./superpowers/plans/2026-08-02-blog-frontend.md) | 태스크 11개 완료 |
| 관리자 설계 | [docs/superpowers/specs/2026-08-02-blog-admin-design.md](./superpowers/specs/2026-08-02-blog-admin-design.md) | 확정 |
| 관리자 구현 계획 | [docs/superpowers/plans/2026-08-02-blog-admin.md](./superpowers/plans/2026-08-02-blog-admin.md) | **태스크 11/11 완료** |
| 서브도메인 runbook | [docs/blog-subdomain-setup-runbook.md](./blog-subdomain-setup-runbook.md) | **2026-08-03 실행 완료** |
| 레이아웃 샘플 | https://claude.ai/code/artifact/06524022-50d4-4c34-82fc-0b66565bffde | 확정 |
| 코드 | `main` (merge·push 완료) | Spring 166개·web 61개 테스트. 배포됨 |
| 실행 기록 | `.superpowers/sdd/2026-08-02-blog-backend/progress.md` | git 무시 대상. 백엔드 라운드 것 |

`feat/blog-backend` 는 2026-08-03 에 `main` 으로 merge 되고 push 됐다. 위키 작업분도 함께 나갔다.

## 최종 리뷰가 잡은 것 — 태스크별 리뷰로는 구조적으로 못 보는 종류였다

두 건 다 **운영에서만 터지는** 문제였고, 원인은 계획서 자체가 틀렸다는 것이다.
각 태스크는 자기 브리프 안에서만 검증되므로 브리프가 틀린 지점은 전체 리뷰에서만 드러난다.

1. **익명 댓글에 rate limit 이 전혀 없었다.** 계획이 `shouldLimit()` 만 넓히라고 했는데,
   인터셉터는 `BoardWebConfig` 에서 `/api/board/**` 에만 등록돼 있어 넓힌 분기가 죽은 코드였다.
   운영에서는 limiter 가 켜져 있어(capacity 20) 게시판만 막히고 공개 댓글은 무제한이었다.
2. **IP salt 가 운영에서 조용히 기본값으로 떨어졌다.** `APP_BLOG_COMMENT_IP_SALT` 가
   `application-prod.yml` 에도 k8s 매니페스트에도 없었다. 그러면 공개 저장소에 적힌
   `local-dev-salt` 로 해싱돼 `ip_hash` 가 되돌릴 수 있는 원본 IP 가 된다.

둘 다 수정했다. salt 는 이제 JWT secret 과 동일하게 **운영에서 값이 없으면 기동이 실패**하고,
`scripts/ensure-blog-comment-salt-secret.sh` 로 Secret 을 만든다. **배포 전에 이 스크립트를 먼저 돌려야 한다.**

## 프론트 라운드에서 실제로 한 일 (2026-08-02)

읽기 화면 전부와 이관이 끝났다. 계획서에 태스크별 절차가 있고, 여기에는 **계획에 없던 판단**만 적는다.

**이관은 SQL 로 했다.** 설계 10절 5항의 "최소 쓰기 API" 는 만들지 않았다. 그게 필요했던 이유가
이관인데, 같은 PostgreSQL 안의 테이블 간 복사라 쓰기 API 를 거칠 이유가 없었다.
첫 글 작성은 관리자 화면과 같은 라운드에서 UI 와 함께 만드는 편이 API 를 두 번 그리지 않는다.
(그 판단대로 관리자 라운드에서 쓰기 API 와 화면을 함께 만들었다.)

**브라우저로 보기 전에는 못 잡았을 것 네 가지.** HTTP 응답만 봤으면 전부 200 이라 통과했다.

1. `public/` 정적 파일이 전부 rewrite 되어 **본문 이미지가 모두 깨졌다.** 본문 이미지가
   `/assets/...` 라 `/blog/assets/...` 로 옮겨져 404. 확장자로 일괄 제외하면 안 된다 —
   `/robots.txt` 와 `/sitemap.xml` 은 오히려 rewrite 되어야 한다. 통과 목록을 명시하고 테스트로 고정했다.
2. 이관 글이 `# 제목` 으로 시작해 **제목이 화면에 두 번** 나왔다. 이관 SQL 에서 첫 H1 을 뗀다.
   본문이 개행으로 시작하는 글이 있어 앞 공백을 턴 뒤 비교해야 했다.
3. 모바일 상단바가 `sticky` 라 grid 행에 갇혀 스크롤과 함께 밀려났고, `fixed` 인 드로어와 기준이
   어긋나 **드로어가 상단바를 덮었다.** 셋 다 뷰포트 기준으로 통일했다.
4. `app/blog/robots.ts` 는 아무것도 만들지 않는다. **Next 의 robots 규약은 app 루트에서만 동작한다.**
   요청이 동적 `[id]` 라우트로 흘러 404 였다. 라우트 핸들러(`robots.txt/route.ts`)로 바꿨다.
   `sitemap.ts` 는 중첩에서도 동작해서 그대로 뒀다 — 둘이 다르게 생긴 이유가 이것이다.

**SQL 로 지우면 OpenSearch 색인이 안 따라온다.** 애플리케이션 이벤트가 돌지 않기 때문이다.
`reindex` 엔드포인트는 upsert 만 해서 이걸 대신하지 못한다.
`scripts/remove-migrated-lab-articles.sh` 가 색인 문서(id = slug)까지 함께 지운다.

**설계 문서를 두 곳 고쳤다.** 9절은 "검색이 전체를 찾는다"고 했는데 10절 3항의 원본 삭제와
양립하지 않았다(지우면 색인에도 없다). 검색 범위를 줄이는 쪽으로 확정했다.
12절의 열린 항목 중 인기 글 기준(`view_count`)과 상단 바 구성(셋 다 유지)을 닫았다.

## 다음에 할 일 (순서대로)

> **2026-08-03 최종**: 서브도메인 연결 · 운영 이관 · 위키 원본 삭제가 **전부 끝났다.**
> **이 절에 남은 할 일은 없다.** 아래는 전부 기록이다.
>
> 후속 작업은 별도 문서로 이어진다 — [docs/interview/](./interview/) (시나리오 21편 면접 정리와
> 거기서 나온 사이트 수정 목록).

### 0. 글은 **운영 관리자 화면에서 바로 쓴다** — 로컬에서 쓰고 옮기지 않는다

`portfolio.leneu.cloud/admin/blog/posts/new` 에서 쓴다. 다섯 화면 모두 배포돼 있다.

**로컬에서 쓴 글을 운영으로 옮기는 경로는 없고, 만들지 않는 편이 낫다.** 이유가 셋이다.

1. **이미지가 따라오지 못한다.** 업로드한 이미지는 MinIO 에 들어가고 본문은 자산 id 만
   참조한다(`/api/wiki-assets/<id>`). 로컬 MinIO 와 운영 MinIO 는 별개라 행만 복사하면
   **본문 이미지가 전부 깨진다.** 이관 8편은 이미지가 `public/assets/` 정적 파일이라
   무사했던 것이고, 관리자 화면으로 새로 쓰는 글은 사정이 다르다.
2. **id 가 어긋난다.** 블로그 글 주소가 `/<id>/<slug>` 라 로컬 id 로 만든 링크가 운영에서
   다른 글을 가리킨다. 실제로 운영 id 는 1~8, 로컬은 3~10 으로 이미 다르다.
3. **설계가 그렇다.** 블로그에는 시드도 revision 도 두지 않고 PostgreSQL 이 유일한 원본이다
   (아래 "콘텐츠 수명주기" 절). 파일이나 로컬 DB 를 정본으로 두는 순간 그 결정이 무너진다.

로컬은 **화면을 고칠 때** 쓴다. 글을 쓰는 곳이 아니다.

### 1. ~~위키 원본 삭제~~ — **2026-08-03 완료**

**실행 결과 (검증됨)**

| 확인 항목 | 결과 |
|---|---|
| `tb_article` 의 이관 대상 잔여 행 | **0건** (8건 삭제) |
| OpenSearch `jaywiki-articles-v1` 문서 수 | **49 → 41** |
| `tb_blog_post` | **8편 그대로** |

이제 `/wiki/<slug>` 는 블로그로 301 되고 위키 검색에서도 사라졌다.
`tb_revision` 에는 8편의 과거 스냅샷이 남는데, 문서를 지워도 이력을 보존하는 기존 위키 정책이고
의도된 결과다. 본문 자체는 `posts/jay-wiki/` 의 md 8개와
`scripts/seed-portfolio-wiki.mjs` 에도 그대로 있어 유실되지 않았다.

아래는 실행했던 절차의 기록이다.

<details>
<summary>실행 절차 (기록용)</summary>

| 주소 | 당시 상태 |
|---|---|
| `portfolio.leneu.cloud/wiki/<slug>` | 위키 원본 8편 |
| `blog.leneu.cloud/<id>/<slug>` | 이관된 블로그 글 8편 |

**하기 전에 반드시**:

1. ~~블로그 8편 눈으로 확인~~ — **2026-08-03 완료.** 8편 모두 200, mermaid 를 쓰는 6편의
   다이어그램 12개가 전부 SVG 로 렌더되고 오류 0(운영 브라우저에서 확인). 고정폭 폰트도 적용됨.
2. `pg_dump` 를 뜬다. 배포 파이프라인이 매 배포 전에 뜨지만 시점을 직접 확인한다.
   (가장 최근: 2026-08-03 배포 직전 `jaywiki-postgres-backup-manual-*`)

**두 곳을 지워야 한다.** PostgreSQL 만 지우면 OpenSearch 위키 색인에 **유령 문서**가 남는다 —
애플리케이션을 거치지 않고 SQL 로 지우면 색인 갱신 이벤트가 돌지 않기 때문이다.
위키 검색 결과에 지운 글이 계속 뜬다(누르면 블로그로 301 되지만, 검색에는 옛 위키 본문이 보인다).
`reindex` 엔드포인트는 upsert 만 해서 이걸 대신하지 못한다. 문서 id 는 slug 다.

`scripts/remove-migrated-lab-articles.sh` 가 두 곳을 함께 지우지만 **`docker exec` 전제라
운영에서는 그대로 못 쓴다.** 운영 좌표는 아래와 같다(2026-08-03 확인).

| 대상 | 운영 좌표 |
|---|---|
| PostgreSQL | `kubectl -n data exec -i pg-postgresql-0` |
| OpenSearch | `kubectl -n data exec portfolio-search-master-0` (Service 는 `opensearch-cluster-master`) |
| 위키 색인 | `jaywiki-articles-v1` (문서 49개) |

```bash
# 1) 대상 확인 (읽기 전용). 지우기 전에 slug 를 손에 들고 있어야 한다 —
#    지운 뒤에는 tb_article 에서 찾을 수 없다.
ssh miniPC 'PW=$(kubectl -n backend get secret jaywiki-secrets -o jsonpath="{.data.SPRING_DATASOURCE_PASSWORD}" | base64 -d); kubectl -n data exec -i pg-postgresql-0 -- env PGPASSWORD="$PW" psql -U portfolio -d portfolio -At' <<'SQL'
select a.slug from public.tb_article a
where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
  and exists (select 1 from public.tb_blog_post p where p.slug = a.slug);
SQL

# 2) PostgreSQL 에서 지운다 (저장소 루트에서)
ssh miniPC 'PW=$(kubectl -n backend get secret jaywiki-secrets -o jsonpath="{.data.SPRING_DATASOURCE_PASSWORD}" | base64 -d); kubectl -n data exec -i pg-postgresql-0 -- env PGPASSWORD="$PW" psql -U portfolio -d portfolio -v ON_ERROR_STOP=1' < scripts/remove-migrated-lab-articles.sql

# 3) OpenSearch 색인에서도 지운다 — 1번에서 받은 slug 목록을 그대로 쓴다
ssh miniPC 'for s in <1번에서 나온 slug 8개>; do kubectl -n data exec portfolio-search-master-0 -- curl -s -o /dev/null -w "$s -> %{http_code}\n" -X DELETE "http://localhost:9200/jaywiki-articles-v1/_doc/$s"; done; kubectl -n data exec portfolio-search-master-0 -- curl -s -X POST "http://localhost:9200/jaywiki-articles-v1/_refresh" >/dev/null'

# 4) 확인 — 색인 문서가 49 → 41 이어야 한다
ssh miniPC 'kubectl -n data exec portfolio-search-master-0 -- curl -s "http://localhost:9200/_cat/indices/jaywiki-articles-v1?v"'
```

지우고 나면 `/wiki/<slug>` 가 블로그로 301 된다(slug 로 찾으므로 id 가 달라도 상관없다).

</details>

### 2. 끝난 것 (기록)

- ~~**서브도메인 연결**~~ — **2026-08-03 완료.** [runbook](./blog-subdomain-setup-runbook.md) 참고.
  1·2·3·5단계 완료, DNS(4단계)도 등록됐다. 6단계 검증 통과.
  `NEXT_PUBLIC_BLOG_ORIGIN` 은 **빌드 인자로 넘길 필요가 없다** — 기본값이 운영값과 같다.
  **salt Secret 도 생성됐다**(`APP_BLOG_COMMENT_IP_SALT`). 없으면 백엔드가 기동에 실패한다.
- ~~**운영 이관**~~ — **2026-08-03 완료.** 글 8편, 태그 54개, 연결 64건.
  H1 제거 8건, 내부 링크 치환 1건(orca → donts3p). 카테고리 분포 개인3·팀2·기술1·도구2.
  **운영 글 id 는 1~8 로 로컬(3~10)과 다르다.**
- ~~관리자 화면 라운드~~ — 아래 "관리자 라운드에서 실제로 한 일" 참고.

<!-- 옛 항목 -->
<details>
<summary>연결 당시 절차 (참고용)</summary>

1. **서브도메인 연결** — [runbook](./blog-subdomain-setup-runbook.md) 실행.
   1·5단계는 **2026-08-03 에 끝났고** 2단계 매니페스트도 저장소에 들어갔다(적용은 CI 가 한다).
   **사람이 할 일은 3단계(cloudflared config.yml, sudo 필요)와 4단계(DNS) 둘뿐이다.**
   middleware 가 배포된 뒤에만 한다.

   `NEXT_PUBLIC_BLOG_ORIGIN` 은 **빌드 인자로 넘길 필요가 없다.** 기본값이
   `https://blog.leneu.cloud` 라 운영값과 같고, `deploy.yml` 도 이 값을 넘기지 않는다.
   (앞 라운드에 "넘겨야 한다"고 적혀 있었는데 실제로는 불필요했다.)

   **salt Secret 은 2026-08-03 에 생성됐다** — `kubectl -n backend get secret jaywiki-secrets`
   에 `APP_BLOG_COMMENT_IP_SALT` 가 있다. 없으면 백엔드가 기동에 실패한다(그렇게 설계했다).
2. **운영 이관** — 로컬에서 돌린 두 스크립트를 운영 DB 에도 돌려야 한다. 순서가 있다.
   `migrate-lab-articles-to-blog.sh` → 화면 확인 → `remove-migrated-lab-articles.sh`.
   두 번째 것은 되돌리기 어렵다. 먼저 `pg_dump` 를 뜬다.
   **운영의 글 id 는 로컬(3~10)과 다를 수 있다.** 301 은 slug 로 찾으므로 상관없다.
3. ~~관리자 화면 라운드~~ — 끝났다.

</details>

## 관리자 라운드에서 실제로 한 일 (2026-08-02~03)

계획서에 태스크별 절차가 있고, 여기에는 **계획에 없던 판단과 계획이 틀렸던 지점**만 적는다.

**브라우저 검증은 Orca 내장 브라우저로 했다.** Chrome 을 computer-use 로 몰려던 앞 세션이
막힌 이유가 여기 있다 — 접근성 트리로는 주소창 Enter 가 전달되지 않고, 탭이 여럿인 창에서
element index 가 금방 낡는다. `orca tab create` → `orca snapshot` → `orca eval` 이 훨씬 안정적이다.
`orca fill` 은 `--value` 를 쓴다(`--text` 는 없는 플래그다). 드래그·붙여넣기처럼 실제 이벤트가
필요한 것은 `orca eval` 로 `DataTransfer` 를 만들어 dispatch 했다.

**React 상태를 건드리는 dispatch 는 tick 을 나눠야 한다.** dragstart 와 drop 을 한 번의 eval 에서
연달아 쏘면 React 가 두 setState 를 배치해 drop 핸들러가 `dragFrom === null` 을 본다.
사람이 하는 드래그는 tick 이 나뉘므로 문제가 없다 — **검증 방식의 함정이지 코드 결함이 아니다.**

**Task 7 편집기 여섯 항목은 전부 통과했다.** 미리보기 연동, 드래그 삽입, 붙여넣기 삽입(커서 위치
기준), 파일 선택 업로드, 저장 전 삭제, 저장 반영. 앞 세션이 남긴 숙제를 닫았다.

**대시보드를 켜자 통계가 사실상 비어 있었다는 게 드러났다.** 유입이 전부 `direct`,
디바이스가 전부 `pc`, 방문자 수가 1 로 고정. 원인은 글 단건 조회가 서버-서버 fetch 라
방문자의 `referer`·`user-agent`·IP 가 Spring 까지 가지 않은 것이다. `recordView` 는 Next 서버의
요청만 보고 있었다. `getBlogPost` 가 그 세 헤더를 실어 보내도록 고쳤다.
**Task 5 백엔드는 처음부터 맞았고 호출부가 틀렸다** — 백엔드만 보는 태스크 리뷰로는 못 잡는 종류다.

**계획에 없어서 채운 것 셋.**

1. **카테고리 삭제 버튼.** 계획의 확인표가 "글 있는 카테고리 삭제 → 오류 문구" 를 요구하는데
   화면에 진입점이 없었다. API 는 Task 3 에 있었다.
2. **카테고리 트리의 `key`.** `initial` 을 `useState` 초기값으로 들고 있어서 추가·삭제 뒤 서버가
   새 목록을 줘도 트리가 낡은 채 남았다(헤더의 "N개" 만 바뀌어 더 헷갈린다).
   id 를 **정렬해** 만든 key 라 순서만 바뀌는 정렬 저장으로는 다시 마운트되지 않는다.
3. **`formatIpPrefix`.** `.*.*` 를 고정으로 붙이면 IPv6 가 `::1.*.*` 로 보인다. 로컬 루프백에서
   바로 드러났다. 순수 함수로 빼서 테스트로 고정했다.

**사이드바 묶음 구분선.** 소제목만으로는 위키/블로그/공통 경계가 보이지 않아 카드 폭 전체로
선을 그었다. `.admin-nav` 의 padding 을 상쇄하는 좌우 `-10px` 가 그래서 있다.

**댓글 화면의 글 링크는 로컬에서 죽은 링크다.** `blogAbsoluteUrl` 이 `NEXT_PUBLIC_BLOG_ORIGIN`
기본값(`https://blog.leneu.cloud`)을 쓰는데 아직 연결 전이다. 서브도메인을 연결하면 살아난다.
로컬에서 눌러 보고 싶으면 `web/.env.local` 에 `NEXT_PUBLIC_BLOG_ORIGIN=http://blog.localhost:3000`
을 넣으면 된다 — 일부러 넣지 않았다.

## 배포·이관 라운드에서 드러난 것 (2026-08-03)

배포하고 나서야 보인 것들이다. **전부 코드 리뷰나 응답 코드로는 안 잡히는 종류였다.**

**mermaid 가 블로그에서 통째로 안 나오고 있었다.** (고쳐서 배포 완료 — 운영 12개 전부 렌더 확인) 위키는 `WikiShell` 이 `MermaidDiagrams` 를
렌더하는데 블로그 글 화면에는 그게 아예 없었다. 다이어그램이 코드 블록 그대로 남는다.
**이관 8편 중 6편이 mermaid 를 쓴다.** mermaid 는 브라우저에서 `.mermaid` 노드를 찾으므로 ref 가
필요한데 글 화면이 서버 컴포넌트라, 본문 조각만 `BlogArticleBody` 로 떼어 클라이언트로 만들었다.

**크로스 사이트 링크가 운영 주소를 하드코딩하고 있었다.** 위키의 LAB 탭과 블로그의
"위키로 돌아가기" 가 그랬다. 로컬에서 두 사이트를 오가면 **운영 사이트로 튀었다.**
`PUBLIC_SITE_ORIGIN` / `BLOG_ORIGIN` 상수로 바꾸고 `web/.env.local` 에 로컬 주소를 넣었다.
기본값이 운영값과 같아 운영 동작은 그대로다.

**고정폭 폰트가 OS 마다 달랐다.** `--mono` 스택에 자체 서빙 폰트가 하나도 없어서
macOS 는 `ui-monospace`(SF Mono), Windows 는 그 지원이 약해 **Courier New** 까지 내려갔다.
코드 블록·slug·배지·숫자가 전부 이 폰트다. JetBrains Mono 가변 woff2 하나(113KB)를
자체 서빙해 맞췄다. **본문(Pretendard)은 원래 자체 서빙이라 문제가 없었다.**
둘 다 SIL OFL 1.1 이고 라이선스 원문을 `web/src/app/fonts/` 에 함께 둔다. CDN 은 쓰지 않는다.

**runbook 의 cloudflared 절차가 실제 환경과 달랐다.** 문서는 `service: https://…` +
`originRequest` 복사를 안내했는데 실제 `portfolio` 규칙은 평문 `http://localhost:30220`
한 줄이었다. 그대로 따라 했으면 502 다. 또 `--config` 는 `tunnel` **바로 뒤**에 와야 한다 —
`ingress` 뒤에 붙이면 `flag provided but not defined` 로 죽는다. 둘 다 문서를 고쳤다.

**salt Secret 이 운영에 없었다.** push 했으면 백엔드가 CrashLoop 에 빠졌을 것이다
(`application-prod.yml` 에 기본값이 없고 `secretKeyRef` 로 걸려 있다 — 그렇게 설계했다).
**배포 전에 확인하는 습관이 이걸 막았다.**

### 새 주소가 안 열리면 DNS 네거티브 캐시를 먼저 의심한다

레코드를 만들기 **전에** 그 이름을 조회하면 "없음" 응답이 캐시된다. 유효기간은 존의
SOA `minimum` 이고 `leneu.cloud` 는 **1800초(30분)** 다. 그동안 그 기기에서만 안 열린다.

- `dig` 는 되는데 브라우저·`curl` 은 안 되면 이것이다. `dig` 는 네임서버에 직접 묻고
  나머지는 OS 리졸버를 거친다. `curl -w '%{time_namelookup}'` 이 **0.000s** 면 확정이다 —
  아무에게도 묻지 않고 캐시에서 답한 것이다.
- 처음 접속하는 다른 기기는 멀쩡하다. 캐시할 "없음" 이 없기 때문이다.
- macOS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`. 놔둬도 30분이면 풀린다.

**교훈**: 열기 전에 미리 조회해 보지 않는다. 확인은 레코드를 만든 뒤에 한다.

## 반드시 알고 있어야 할 결정

### 콘텐츠 수명주기가 위키와 정반대다

블로그에는 **시드도 revision 도 두지 않는다.** PostgreSQL 이 유일한 원본이고 관리자 화면에서 쓴다.
시드는 파일이 정본이라 화면에서 고친 글을 되돌리기 때문이다. 안전망은 기존 `pg_dump` 전체 백업이
그대로 덮는다(테이블 필터가 없어 새 테이블이 자동 포함된다).

### 개인정보 설계가 이 기능의 축이다

원본 IP 를 저장하지 않는다. 댓글은 표시용 `ip_prefix`(앞 2옥텟)와 차단용 `ip_hash`(salted SHA-256)만
남긴다. 방문자 중복 제거는 Redis 집합에서 하루치만 하고, 넣는 값이 `hash(salt + 날짜 + IP)` 라
**날짜가 섞여 있어 다음 날에는 같은 사람인지 대조할 수 없다.** 유입 경로는 받는 즉시 세 버킷으로 줄이고
원본 URL 을 버린다.

**이 설계 전체가 salt 한 문자열의 비밀성에 달려 있다.** salt 가 새면 `ip_hash` 는 되돌릴 수 있는
원본 IP 를 영구 저장하는 것과 같아진다. 운영 Secret 이 반드시 먼저 있어야 한다.

### 예외 타입으로 사용자 오류와 코드 버그를 가른다

`common.BadRequestException` → 400, `common.NotFoundException` → 404,
그 밖의 `IllegalArgumentException` → 500(알림 대상). 계획은 원래 `IllegalArgumentException` 을
전역에서 400 으로 매핑하라고 했는데, 그러면 블로그와 무관한 도메인 랩 응답까지 바뀌어서 되돌렸다.
도메인 랩이 500 을 유지하는지 end-to-end 테스트가 고정하고 있다. **이 테스트를 지우지 말 것.**

### 정렬 규칙 (위키 쪽)

탭 안 문서 순서는 `sort_order` 오름차순이 1차 기준이다. 축적형 탭(운영 검증·회고·LAB 4개)은 최신순으로
새 글이 0번, 나머지는 흐름상 맞는 위치. 작성일로 정렬하지 않는 이유는 19개 탭 중 8개가 소속 글의
작성일이 전부 같은 날이라 구분력이 없기 때문이다.

## 미뤄둔 것 — 잊으면 사고 나는 순서대로

1. ~~`attachReferenced()` 가 블로그 저장에 안 불린다.~~ **해결됐다**(Task 2). 관리자 화면에서
   이미지를 올려 저장한 뒤 `tb_article_asset.status` 가 `ATTACHED` 인 것까지 눈으로 확인했다.
   TEMP 정리 스케줄 작업을 만들어도 이제 안전하다.
2. **게시판과 블로그가 같은 동작에 다른 응답 코드를 쓴다.** 익명 삭제 암호 오류가 게시판 409,
   블로그 400. 게시판을 바꾸면 기존 UI 가 깨져서 미뤘다.
3. **Google OAuth 의 `email` 컬럼.** 실제 사용처는 `BoardService` 의 표시 이름 fallback 한 줄뿐이라
   빼도 된다. 사용자는 "구글 로그인 자체를 빼자"고 했지만, 로그인은 위키 글 6편의 근거라
   **이메일만 빼는 쪽을 권했고 아직 결론이 안 났다.**
4. `"published"` 문자열이 6곳에 흩어져 있다. 공유 상수로 묶을 후보.
5. `BlogController.byTag()` 가 전체 목록을 읽어 메모리에서 거른다. 글이 수백 편이면 쿼리로 바꾼다.
6. `recordView` 가 GET 경로에서 동기로 돈다. Redis 장애가 페이지 조회를 500 으로 만든다.
7. `BoardRateLimitIntegrationTest` 에 자체 정리가 없다. 새 블로그 테스트의 `@AfterEach` 가
   공유 Redis 키를 치우면서 결과적으로 옛 테스트의 격리까지 떠받치고 있다. 순차 실행에서는
   무해하지만 병렬 실행을 켜면 문제가 된다.
8. **`/wiki/[slug]` 의 블로그 fallback 도 목록 전체를 읽는다.** 5번과 같은 이유고 같은 시점에 고친다.
   지금은 8편이라 무해하다.
9. **목록 썸네일은 코드만 있고 데이터가 없다.** 이관 8편에 이미지 참조가 0건이라 실제 렌더를
   확인하지 못했다. 관리자 화면에서 대표 이미지를 지정할 수 있게 되면 그때 눈으로 본다.
   `grid-row` 는 `1 / -1` 이 아니라 `1 / span 6` 으로 적혀 있어야 한다 — `-1` 은 첫 줄만 덮어
   그 줄이 썸네일 높이만큼 부푼다.
10. **`GET /api/admin/services` 가 공개다.** `SecurityConfig` 44행의 `GET /api/**` permitAll 이
    53행의 ADMIN 규칙보다 앞에 있기 때문이다. 블로그 쪽은 `/api/admin/blog/**` 명시 규칙을
    그 위에 넣어 막았지만 이건 남는다. 닫으려면 `/admin/services` 서버 컴포넌트가 쿠키를
    싣도록 같이 고쳐야 한다(`lib/api.ts` 의 `get()` 은 쿠키를 싣지 않고 실패를 catch 로 삼킨다).
11. **자식 카테고리 정렬 UI 가 없다.** 부모만 정렬한다. 자식이 생기면 같은 방식으로 붙인다.
12. **카테고리를 다른 부모로 옮길 수 없다.** 글이 딸린 카테고리 이동은 되돌리기 어려워 미뤘다.
13. **대표 이미지를 자산 id 문자열로 직접 입력한다.** 목록에서 고르는 UI 는 다음 라운드.
    지금은 본문에 올린 이미지 URL 의 마지막 조각을 손으로 옮겨 적어야 한다.
14. **예약 발행이 없다.** `published_at` 을 미래로 넣으면 공개 목록에 바로 뜬다.
    막으려면 공개 쿼리에 `published_at <= now()` 를 더해야 한다.
15. `tb_blog_daily_stat` 의 `ref_search/ref_sns/ref_other` 와 새 `tb_blog_referrer_daily` 가
    같은 것을 두 번 센다. 새 테이블이 충분히 쌓이면 옛 컬럼을 지울 수 있다.
16. **웹은 자동 테스트로 화면을 못 잡는다.** vitest 가 node 환경이라 DOM 이 없다.
    순수 함수(`blogHost`, `blogLinks`, `reorder`, `statsChart`, `blogAdminForm`)만 테스트로
    고정돼 있고 화면은 눈으로 봐야 한다. 브라우저에서만 잡힌 문제가 프론트 라운드 네 건,
    관리자 라운드 세 건이다.
17. **`api.leneu.cloud` 가 502 다.** cloudflared 의 `http://localhost:80` 규칙인데 80 포트에
    받는 것이 없어 보인다. 블로그 작업 전부터 있던 상태고 블로그·위키에는 영향이 없다.
    백엔드 API 를 밖에서 부를 일이 생기면 그때 손본다.
18. **세션 이미지 여러 개를 한 tick 안에 지우면 본문에서 하나가 안 지워진다.**
    `MarkdownBodyEditor.deleteSessionAsset` 이 `value` 를 클로저로 잡고 있어서, 두 번째 호출이
    첫 번째의 본문 수정을 덮는다. 자산은 둘 다 지워지고 본문에 깨진 참조가 남는다.
    사람이 클릭하면 렌더가 사이에 끼어 무해하다 — 자동화로 두 번 연속 클릭했을 때만 재현됐다.
    고치려면 `onChange` 대신 함수형 갱신이 필요한데 부모가 `value` 를 들고 있어 구조를 바꿔야 한다.

## 작업 방식에서 배운 것

- **구현 서브에이전트가 도는 동안 컨트롤러가 `git commit` 하지 말 것.** 한 번 커밋이 엉켜서
  구현자가 soft-reset 으로 되살렸다. 스테이징을 공유하기 때문이다.
- 태스크별 리뷰는 자기 브리프 안에서만 본다. **브리프가 틀린 지점은 최종 전체 리뷰에서만 잡힌다.**
  실제로 rate limit 인터셉터 미등록(Critical)과 salt 미설정이 거기서 나왔다.
- 서브에이전트에게 앞선 태스크의 함정을 미리 실어 보내면 같은 실수가 반복되지 않는다
  (테스트 격리, `published_at` CHECK 제약, 공유 DB 정리 관례).
- **화면을 켜 봐야 데이터 계층의 거짓말이 보인다.** 통계 API 는 200 을 주고 테이블에도 행이 쌓여
  있었지만 값이 전부 `direct`/`pc` 였다. 대시보드에 숫자로 그려 놓고서야 이상한 걸 알았다.
  집계는 **실패가 아니라 한쪽으로 쏠린 성공**으로 나타나므로 응답 코드로는 잡히지 않는다.
- 확인표에 있는데 화면에 진입점이 없으면 계획이 빠뜨린 것이다. 카테고리 삭제가 그랬다.
  **확인표를 그대로 실행해 보는 것만으로 계획의 구멍이 드러난다.**

## 실행 기록

`.superpowers/sdd/2026-08-02-blog-backend/progress.md` 에 태스크별 완료·수정 라운드·보류 판정이 남아 있다.
git 무시 대상이라 이 문서와 `git log` 가 정본이다. 브랜치를 merge 하고 나면 지워도 된다.
