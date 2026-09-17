# blog.leneu.cloud 설계

작성일: 2026-08-02
상태: 설계 확정, 구현 전
레이아웃 샘플: https://claude.ai/code/artifact/06524022-50d4-4c34-82fc-0b66565bffde

## 1. 왜 나누는가

jay-wiki의 19개 탭 중 LAB 4개(`personal-projects`, `team-projects`, `tech-lab`, `tools-workflow`, 8편)는
나머지 47편과 성격이 다르다. BUILD·OPERATE·IMPROVE는 **이 사이트 하나**를 만들고 운영한 기록이고,
LAB은 **이 사이트 밖에서 만든 것들**이다. 대시보드 글이 이미 그렇게 쓰고 있다.

> 앞의 셋은 이 사이트 자체를 만들고 운영하고 개선한 기록이고, 마지막 하나는 이 사이트 밖에서 한 프로젝트와 실험이다.

분리로 얻으려는 것은 셋이다.

| 목표 | 지금 문제 |
|---|---|
| 성격 분리 | 같은 위키 문법·같은 목록 안에 성격이 다른 글이 섞여 있다 |
| 쌓을 공간 | 앞으로 개인 글을 계속 쓸 텐데 위키의 검토 절차가 무겁다 |
| 시각적 구분 | 55편이 전부 같은 모양이라 작업물이 살아나지 않는다 |

발견성(찾기 어려움)은 목표가 아니다. 진입 경로는 부수 효과로 좋아진다.

## 2. 범위

### 이번 범위

- `blog.leneu.cloud` 공개 동작 (읽기 전용, 전면 공개)
- 목록 / 카테고리 / 글 / 댓글 화면
- 블로그 전용 테이블과 API
- LAB 8편 이관과 기존 `/wiki/[slug]` 301
- jay-wiki의 LAB 대분류 → 블로그 진입

### 이번 범위 밖 (별도 라운드)

- **관리자 화면** — 카테고리 트리 편집, 드래그 순서 변경, 글 작성 UI
- 태그 페이지의 색인 정책 확정
- 블로그 전용 검색

관리자 화면은 이 설계가 확정한 데이터 모델 위에서 별도로 설계한다. 순서를 거꾸로 하면 두 번 그리게 된다.
다만 **이관과 첫 글 작성에 최소한의 쓰기 경로는 필요**하므로, 그 최소 범위는 8절에 적었다.

## 3. 배치 — 같은 앱, 호스트만 추가

Pod를 늘리지 않는다. `blog.leneu.cloud`를 **기존 Next.js Deployment**에 붙이고,
`web/src/middleware.ts`에서 호스트를 보고 `/blog/*`로 rewrite한다.

```
Cloudflare DNS  blog.leneu.cloud
  → Cloudflare Tunnel (기존 터널에 hostname 추가)
  → Traefik Ingress (host 규칙 추가, 기존 jaywiki-web Service)
  → Next.js middleware: host === 'blog.leneu.cloud' → /blog/* 로 rewrite
  → Next 라우트 /blog/...
  → BFF → Spring → PostgreSQL
```

선례가 있다. `grafana.leneu.cloud`가 이미 별도 hostname으로 뜬다.

**host 판정은 `blog.` 접두사로 한다.** `blog.leneu.cloud` 하나로 고정하면 로컬에서 rewrite를
확인할 방법이 없다. 로컬에는 그 hostname이 없기 때문이다. `blog.`로 시작하는 host를 모두
블로그로 보내면 `blog.localhost:3000`으로 브라우저에서 바로 볼 수 있고 hosts 파일을 건드릴
필요도 없다. 대부분의 브라우저가 `*.localhost`를 자동으로 루프백으로 해석한다.

**middleware의 matcher를 넓혀야 한다.** 지금 `web/src/middleware.ts`의 `config.matcher`는
`['/admin/:path*']`라서 관리자 경로에서만 실행된다. host 기반 rewrite는 모든 요청에서 host를
봐야 하므로 matcher를 넓히게 되는데, 그러면 정적 자산과 이미지까지 middleware를 타게 된다.
`_next/static`, `_next/image`, `favicon`, `api`는 matcher에서 제외한다.
기존 `/admin` 가드 동작은 그대로 유지한다.

**별도 앱을 만들지 않는 이유**: 이미지가 7개째가 되고, rollout·rollback·smoke가 두 벌이 되며,
단일 노드 miniPC에 워크로드가 하나 더 붙는다. 얻는 것은 배포 독립성뿐인데 지금 필요하지 않다.

**인증 경계**: 블로그는 전면 공개 읽기 전용이다. 관리자 편집은 계속 `portfolio.leneu.cloud/admin`에서 한다.
따라서 `jw_token` 쿠키의 Domain을 넓힐 필요가 없고, 현재 보안 경계가 그대로 유지된다.

## 4. 콘텐츠 수명주기 — 위키와 정반대

| 항목 | 위키 | 블로그 |
|---|---|---|
| SoT | 시드 파일(Git) → PostgreSQL | **PostgreSQL 단독** |
| 쓰는 곳 | `scripts/seed-portfolio-wiki.mjs` | **관리자 화면** |
| 수정 이력 | `tb_revision` 스냅샷 | **없음** |
| 배포 동기화 | GitOps content sync Job | **없음** |
| 안전망 | 백업 + Git | **백업** |

### 시드를 두지 않는 이유

시드는 파일이 정본이라 **관리자에서 고친 글을 다음 실행 때 되돌린다**. 위키는 검토된 기준 콘텐츠라
그 대가를 감수하지만, 블로그는 관리자에서 쓰는 것이 기본이므로 매번 충돌한다.

시드가 주는 셋 중 블로그에 필요한 것이 없다.

| 시드의 효용 | 블로그 |
|---|---|
| 빈 DB bootstrap | 불필요. 빈 블로그로 시작한다 |
| Git 리뷰·diff | 불필요. 검토 대상 콘텐츠가 아니다 |
| 결정적 재구축 | 백업이 대신한다 |

### revision을 두지 않는 이유

위키의 revision은 "누가 언제 무엇을 바꿨나"를 증거로 남기기 위한 장치다.
혼자 쓰는 블로그에 그 감사 추적은 과하다. 실수는 백업에서 복구한다. 필요해지면 나중에 붙인다.

### 백업은 추가 작업이 없다

`infra/k8s/backup/postgres-backup.yaml`의 CronJob은 `pg_dump --format=custom`으로 **DB 전체**를 뜬다.
테이블 필터가 없으므로 새 테이블은 만들자마자 백업·복구 대상이 된다.
`scripts/rehearse-postgres-restore.sh`도 그대로 적용된다.

### GitOps 경계

배포 workflow의 content sync는 위키 시드만 실행한다. 블로그 테이블을 건드리지 않으므로
경계가 자동으로 지켜진다.

## 5. 데이터 모델

블로그는 **별도 테이블**을 쓴다. `tb_article`은 위키용이라 `version`, `parent_id → tab`,
`last_review`, `synced_at` 같은 위키 문법을 강요한다(`synced_at`은 이미 죽은 컬럼이다).

### 테이블

`V13__blog.sql` 기준. Flyway 번호는 추가 직전에 `ls | sort -V`로 실제 최대값을 확인한다.

#### `tb_blog_category`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `slug` | text unique | 영어. URL에 그대로 쓴다 |
| `name` | text | 화면 표시명. 한글 가능 |
| `description` | text null | 카테고리 화면 머리말 |
| `parent_id` | bigint null → self | **최대 2단.** 부모가 있는 행은 부모를 다시 가질 수 없다 |
| `sort_order` | int | 형제 안에서의 순서 |
| `created_at` | timestamptz | |

2단 제약은 애플리케이션에서 강제한다(부모 지정 시 그 부모의 `parent_id`가 null인지 검사).
DB CHECK로는 자기참조 깊이를 표현하기 어렵고, 규칙이 코드에 있어야 오류 메시지를 낼 수 있다.

#### `tb_blog_post`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | **URL의 숫자 id** |
| `slug` | text | URL 뒤에 붙는 읽기용. 유일하지 않아도 된다 |
| `category_id` | bigint → `tb_blog_category` | FK, `on delete restrict` |
| `title` | text | |
| `summary` | text null | 목록의 두 줄 |
| `body` | text | Markdown |
| `cover_asset_id` | text null | 목록 썸네일. `tb_article_asset.id` 참조(FK 없음, 문자열) |
| `status` | text | `draft` / `published` |
| `published_at` | timestamptz null | 목록 정렬 기준 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

`on delete restrict`인 이유: 글이 있는 카테고리를 실수로 지우면 글이 통째로 사라진다.
지우려면 먼저 글을 옮기게 만든다.

#### `tb_blog_tag`, `tb_blog_post_tag`

태그는 문자열 컬럼이 아니라 정규화한다. 태그 페이지와 태그별 글 수가 필요하기 때문이다.
위키의 `tags text` 콤마 문자열은 그 두 가지를 못 한다.

| `tb_blog_tag` | |
|---|---|
| `id` | bigserial PK |
| `name` | text unique |

| `tb_blog_post_tag` | |
|---|---|
| `post_id` | bigint → post, `on delete cascade` |
| `tag_id` | bigint → tag, `on delete cascade` |
| | PK(post_id, tag_id) |

#### `tb_blog_comment`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigserial PK | |
| `post_id` | bigint → post, `on delete cascade` | |
| `author_name` | text | 이름 |
| `password_hash` | text | BCrypt. 본인 삭제용 |
| `body` | text | |
| `ip_prefix` | text | **표시용 앞 2옥텟만.** 예: `121.135` |
| `ip_hash` | text | **원본 IP + salt의 hash.** 차단용. 원본은 저장하지 않는다 |
| `created_at` | timestamptz | |
| `deleted_at` | timestamptz null | soft delete |

### 인덱스

```
tb_blog_post   (status, published_at desc)      목록
tb_blog_post   (category_id, published_at desc) 카테고리 목록
tb_blog_comment(post_id, created_at)            글의 댓글
tb_blog_category(parent_id, sort_order)         트리 조회
```

### 자산은 공유한다

`tb_article_asset`과 MinIO는 그대로 쓴다. 본문의 `/api/wiki-assets/{id}` 참조 규칙도 같다.
자산 삭제 차단 검사는 현재 `tb_article.body`와 `tb_revision.body`만 본다.
**블로그 본문도 검사 대상에 추가해야 한다.** 넣지 않으면 블로그에서 쓰는 이미지가 삭제될 수 있다.

## 6. 주소 체계

| 화면 | 주소 |
|---|---|
| 목록 | `/` |
| 카테고리 | `/category/[slug]` (영어) |
| 글 | `/[id]/[slug]` |
| 태그 | `/tag/[name]` |

글 주소는 **숫자 id가 정본**이고 slug는 읽기용이다. `/6`만 요청해도 `/6/donts3p-...`로 301한다.
제목이 바뀌어 slug가 달라져도 링크가 깨지지 않고, URL에 키워드가 남아 공유·클릭에 유리하다.

### 기존 위키 주소 처리

LAB 8편의 `/wiki/[slug]`는 새 블로그 주소로 **301**한다. slug → id 매핑은 이관 시점에 확정된다.
조사 결과 **일반 위키 글에서 LAB 글로 가는 링크는 0건**이고, LAB 안에서 LAB을 가리키는 링크가 1건
(`orca-mobile-agent-workflow-retrospective` → `donts3p-macos-sleep-assertion-app`)뿐이라 이관 비용이 낮다.

### sitemap

`web/src/app/sitemap.ts`는 현재 모든 published 글을 `/wiki/{slug}`로 낸다.
LAB 글은 블로그 주소로 나가야 하고, 호스트도 다르다. 두 사이트의 sitemap을 분리한다.

## 7. 화면

레이아웃은 샘플 아티팩트가 정본이다. 색·타이포·모서리는 `web/src/app/styles/tokens.css`를 그대로 쓴다.
새 색을 만들지 않는다.

### 데스크톱 2단

- 좌측 레일(250px): **헤더가 여기에만 있다.** 블로그 이름 / jay-wiki 링크 / 프로필 →
  `전체 글 (n)` + 카테고리 트리 → `인기 글`(썸네일) → `태그`(# 목록)
- **`인기 글`의 기준이 아직 없다.** 블로그에는 조회수가 없다. 게시판처럼 Redis 카운터를 붙이거나,
  기준이 생길 때까지 `최근 글`로 대체한다. 12절 참고
- 레일은 화면 높이를 채우고 자체 스크롤한다. 스크롤바는 숨긴다
- 우측 본문: 평소 헤더 없음. 스크롤하면 `카테고리 · 제목 · 위로` 바가 **opacity로 서서히** 나타난다.
  이 바는 자리를 차지하지 않는다(음수 margin으로 상쇄)

### 목록 한 줄

`카테고리 / 제목 / 날짜 / 요약(2줄)` + 대표 이미지가 있는 글만 우측 썸네일(156×117, 세로 중앙).
없으면 본문이 폭을 다 쓴다. 목록에 태그는 넣지 않는다.

> 구현 주의: 썸네일을 `grid-row: 1 / -1`로 span하면 암시적 행에서 첫 줄만 덮어
> 그 줄이 썸네일 높이만큼 부푼다. `grid-row: 1 / span N`으로 적어야 한다.

### 글 화면

본문 → **태그 줄**(아이콘 하나가 라벨, 알약은 컴팩트) → 이전·다음 글 →
`'카테고리' 카테고리의 다른 글` 박스 → 댓글.

### 모바일 390px

상단 바(`햄버거 · 이름 · ← wiki`)가 생긴다. 햄버거를 누르면 **화면의 3/4**를 덮는 드로어가
왼쪽에서 나오고 남은 1/4은 `blur(6px)`로 뒤가 비친다.
드로어 내용은 글 목록이 아니라 **메뉴**다: 프로필 → 통계 → `전체 글 (n)` + 카테고리 → 최근 글.
닫기는 햄버거 재클릭 / 바깥 클릭 / Esc.

## 8. 댓글

로그인 없이 쓴다. 입력은 `내용`(좌측 넓게) + 우측에 `이름` / `암호` / `등록`이 같은 폭으로 쌓인 2열 그리드.

### IP 처리

이름 옆에 `지나가던개발자(121.135)`처럼 앞 2옥텟을 표시한다.

**IP를 읽는 곳**: 이 사이트는 Cloudflare Tunnel → Traefik → Next → Spring을 거친다.
`getRemoteAddr()`를 쓰면 모든 댓글에 프록시 주소가 찍힌다. `CF-Connecting-IP`를 읽어야 하고,
그 헤더는 Cloudflare에서 온 요청일 때만 신뢰한다(클라이언트가 위조할 수 있다).

**저장 범위**: 원본 IP는 저장하지 않는다. 표시용 `ip_prefix`(앞 2옥텟)와
차단용 `ip_hash`(원본 + salt의 hash)만 남긴다. salt는 Kubernetes Secret으로 관리한다.
salt가 유출되면 IP 역산이 쉬워지므로 코드나 설정 파일에 두지 않는다.

IP는 개인정보보호법상 개인정보로 본다. 식별 가능한 형태로 보관하지 않는 것이 이 설계의 목적이며,
개인정보처리방침에 "악용 방지 목적의 접속 정보 사용"을 한 줄 명시한다.
법적 판단은 이 문서의 범위 밖이다.

### 스팸 대비

`BoardRateLimitInterceptor`가 이미 Redis 기반으로 존재한다. 블로그 댓글에 재사용한다.

## 9. 검색과 색인

- 위키 검색(`/search`)은 **위키 글만** 찾는다. LAB 8편은 `tb_article` 에서 지워지므로 색인에도 없다
- 블로그 전용 검색은 이번 범위 밖. 그때까지 블로그 글은 검색으로 찾을 수 없다

  > 2026-08-02 수정. 원래 이 절은 "검색이 계속 전체를 찾고 결과에서 LAB 글을 블로그 주소로
  > 보낸다"였으나, 10절 3항의 원본 삭제와 양립하지 않았다. 지우면 색인에서도 사라져 검색이
  > 찾을 대상 자체가 없다. 발견성은 이 설계의 목표가 아니므로(1절) 검색 범위를 줄이는 쪽을 택했다.
  >
  > SQL 로 직접 지우면 애플리케이션 이벤트가 돌지 않아 OpenSearch 색인에 지운 글이 남는다.
  > `reindex` 엔드포인트는 upsert 만 하므로 이걸 대신하지 못한다.
  > `scripts/remove-migrated-lab-articles.sh` 가 색인 문서(id = slug)까지 함께 지운다.
- **태그 페이지는 `noindex`로 시작한다.** 글 8편에 태그 21개면 태그당 1~2편이라
  내용이 거의 없는 페이지가 20개 넘게 생긴다. 검색엔진에는 도움이 아니라 부담이다.
  글이 쌓이면 푼다

## 10. 이관과 최소 쓰기 경로

관리자 화면 전체는 다음 라운드지만, LAB 8편을 옮기고 첫 글을 쓰려면 최소한이 필요하다.

1. 카테고리 4개를 `tb_blog_category`에 만든다 (마이그레이션에서 시드)
2. LAB 8편을 `tb_article` → `tb_blog_post`로 옮기는 **일회성 스크립트**
   (본문·요약·태그·작성일 이전, id 부여, slug 유지)
3. 이관 확인 후 `tb_article`에서 8편 삭제.
   이때 위키의 `tb_revision`에 그 8편의 과거 스냅샷이 남는다. 위키가 문서를 지워도 이력을 보존하는
   기존 정책 때문이며(로컬에 이미 삭제된 문서 5편의 revision 7건이 남아 있다), 의도된 결과다.
   블로그 쪽에 revision을 만드는 것과는 무관하다
4. `/wiki/[slug]` → `/[id]/[slug]` 301 매핑 등록
5. 최소 쓰기 API: 글 생성·수정, 카테고리 생성. UI는 다음 라운드

이관 스크립트는 시드가 아니다. 한 번 돌리고 버린다.

## 11. 테스트

| 대상 | 확인 |
|---|---|
| 호스트 rewrite | `blog.leneu.cloud/` 요청이 `/blog` 라우트로 가고, `portfolio...`는 영향 없음 |
| 301 | `/wiki/donts3p-...` → 새 주소, `/6` → `/6/slug` |
| 카테고리 2단 제약 | 손자 카테고리 생성 시도가 거부됨 |
| 카테고리 삭제 | 글이 있는 카테고리 삭제가 `restrict`로 막힘 |
| 댓글 IP | `CF-Connecting-IP`가 있을 때 그 값을, 없을 때 저장 안 함. 원본이 DB에 없음 |
| 댓글 삭제 | 맞는 암호만 삭제 성공 |
| 자산 삭제 차단 | 블로그 본문이 참조 중인 자산 삭제가 막힘 |
| 백업 | 새 테이블이 dump에 포함됨 (`pg_restore --list`) |
| 화면 | 1440px 가로 overflow 없음, 390px `390/390`, 드로어 75% + blur |

## 12. 열린 항목

| 항목 | 결정 시점 |
|---|---|
| 상단 제목 바 구성 (카테고리·제목·위로 유지 여부) | **확정: 셋 다 유지** (2026-08-02) |
| 태그 페이지 색인 해제 시점 | 글이 쌓인 뒤 |
| 관리자 화면 설계 | 별도 라운드 |
| 인기 글 기준 (조회수가 없으므로 무엇으로 정할지) | **확정: `view_count` 내림차순** (2026-08-02). 백엔드 V14 가 이미 올리고 있어 노출 엔드포인트만 추가했다 |
| 레일 태그 개수 | **확정: 상위 20개만** (2026-08-02). 글 8편에 태그가 54개라 전부 세우면 레일이 태그로만 채워진다. 머리에 전체 개수를 적어 잘린 것을 숨기지 않는다 |
