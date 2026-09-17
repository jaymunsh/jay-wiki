# blog.leneu.cloud 프론트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 끝난 블로그 백엔드 위에 `blog.leneu.cloud` 공개 화면(목록·카테고리·글·댓글·태그)을 올리고, LAB 8편을 위키에서 블로그로 옮긴 뒤 기존 위키 주소를 301로 잇는다.

**Architecture:** Pod 를 늘리지 않는다. 기존 Next.js 앱의 `middleware.ts` 가 `blog.` 로 시작하는 host 를 `/blog/*` 라우트로 rewrite 한다. 화면은 서버 컴포넌트가 `lib/blog.ts` 로 Spring 을 직접 읽고, 댓글 입력처럼 브라우저에서 쓰는 곳만 클라이언트 컴포넌트가 `/api/bff/*` 를 거친다. LAB 8편 이관은 같은 PostgreSQL 안에서 `tb_article` → `tb_blog_post` 로 복사하는 일회성 SQL 이다.

**Tech Stack:** Next.js 15 (App Router, React 19), TypeScript, vitest(node 환경), Spring Boot 3 + JPA, PostgreSQL 18, Redis, psql.

## 선행 문서

- 설계(정본): [docs/superpowers/specs/2026-08-02-blog-leneu-cloud-design.md](../specs/2026-08-02-blog-leneu-cloud-design.md)
- 백엔드 계획(완료): [docs/superpowers/plans/2026-08-02-blog-backend.md](./2026-08-02-blog-backend.md)
- 인수인계: [docs/blog-work-handoff.md](../../blog-work-handoff.md)
- 서브도메인 runbook(이 계획 뒤에 실행): [docs/blog-subdomain-setup-runbook.md](../../blog-subdomain-setup-runbook.md)
- 레이아웃 정본: https://claude.ai/code/artifact/06524022-50d4-4c34-82fc-0b66565bffde
  — 이 계획의 CSS 는 그 아티팩트에서 그대로 옮긴 것이다. 값이 어긋나면 아티팩트가 맞다.

## 이 계획을 쓰기 전에 확정한 것

설계 12절의 열린 항목과 설계 내부의 모순 하나를 사용자와 확정했다.

| 항목 | 결정 | 근거 |
|---|---|---|
| 레일 `인기 글` 기준 | **`tb_blog_post.view_count` 내림차순** | 설계 시점엔 조회수가 없었으나 백엔드 V14 가 이미 올리고 있다. 노출 엔드포인트만 추가하면 된다(Task 1) |
| 이관 후 위키 검색 | **블로그 글은 검색 대상에서 뺀다** | 설계 §9 는 "검색이 전체를 찾는다"고 했으나 §10-3 은 8편을 `tb_article` 에서 지우라고 한다. 지우면 인덱스에서도 사라져 §9 가 성립하지 않는다. 블로그 전용 검색은 원래 이번 범위 밖이므로 §9 를 접는다 |
| 개인정보 처리방침 | **블로그 레일 하단에 링크, 본문은 `blog.leneu.cloud/privacy` 하나. 위키 푸터에서도 같은 주소를 링크** | IP 수집은 블로그 댓글에서만 일어난다. 관리 지점을 하나로 둔다 |

Task 11 에서 설계 문서 §9 와 §12 를 이 결정대로 고친다.

**설계 §10-5(최소 쓰기 API)는 이번 계획에서 뺀다.** 그것이 필요했던 이유는 LAB 8편 이관이었는데,
이관을 같은 DB 안의 SQL 로 하면 쓰기 API 를 거칠 이유가 없다(Task 2). 첫 글 작성은 관리자 화면과
같은 라운드에서 UI 와 함께 만드는 편이 API 를 두 번 그리지 않는다. 이 라운드가 끝나면 블로그는
**읽기 전용**이고 글을 새로 쓸 경로는 아직 없다.

## Global Constraints

- **새 색·새 폰트 크기를 만들지 않는다.** `web/src/app/styles/tokens.css` 의 `--bg-*`, `--text-*`, `--accent*`, `--border*`, `--r-*`, `--fs-*` 만 쓴다. 하한은 `--fs-2xs`(11px).
- 블로그 CSS 는 **`web/src/app/styles/blog.css` 한 파일**에 모으고 `web/src/app/globals.css` 의 `@import` 목록 **맨 끝**에 추가한다. 다른 화면의 CSS 파일을 고치지 않는다.
- 클래스 이름은 전부 `blog-` 접두사를 붙인다. 아티팩트의 `.post`, `.rail` 같은 이름은 기존 `board.css`·`home.css` 와 충돌하므로 그대로 쓰지 않는다.
- 서버 컴포넌트는 `@/lib/blog` 로 Spring 을 직접 읽는다. **클라이언트 컴포넌트는 반드시 `/api/bff/*`** 를 통한다(기존 규칙, `web/src/lib/api.ts` 머리말).
- `web` 테스트는 `npm test`(vitest, **node 환경 — DOM 이 없다**). 컴포넌트 렌더 테스트를 만들지 말고, 판정 로직을 순수 함수로 빼서 그 함수를 테스트한다. 화면은 각 태스크의 수동 확인 절차로 고정한다.
- Spring 테스트 기준선은 **138개 통과**다. 태스크마다 `cd spring/jaywiki && ./gradlew test` 로 확인한다.
- 웹 정적 검사는 `cd web && npm run lint && npm run type-check` 다. `lint` 는 `--max-warnings 8` 이므로 새 경고를 만들지 않는다.
- 커밋은 각 태스크의 마지막 스텝에서만 한다. 브랜치는 `feat/blog-backend` 를 그대로 쓴다.
- 블로그 공개 주소는 `NEXT_PUBLIC_BLOG_ORIGIN`, 기본값 `https://blog.leneu.cloud`.
- 로컬 확인은 `http://blog.localhost:3000` 으로 한다. hosts 파일을 고치지 않는다(대부분의 브라우저가 `*.localhost` 를 루프백으로 해석한다).

## 실행 전 확인

```bash
git branch --show-current          # feat/blog-backend
docker ps --format '{{.Names}}'    # pf-postgres, pf-redis 필요
cd spring/jaywiki && ./gradlew test # 138개 통과
```

로컬 백엔드:

```bash
cd spring/jaywiki && SPRING_PROFILES_ACTIVE=local APP_KAFKA_DEMO_ENABLED=true ./gradlew bootRun
```

로컬 프론트:

```bash
cd web && npm run dev
```

## 파일 구조

| 파일 | 책임 |
|---|---|
| `web/src/lib/blogHost.ts` | host → rewrite 경로 판정. **순수 함수.** middleware(edge)에서 쓰므로 `server-only` 를 import 하지 않는다 |
| `web/src/lib/blogLinks.ts` | 글 주소 조립, 날짜 표기. **순수 함수** |
| `web/src/lib/blog.ts` | Spring 블로그 API 클라이언트. `server-only` |
| `web/src/middleware.ts` | (수정) 기존 `/admin` 가드 + host rewrite |
| `web/src/app/blog/layout.tsx` | 2단 골격. 레일 + 본문 |
| `web/src/app/blog/page.tsx` | 목록 `/` |
| `web/src/app/blog/category/[slug]/page.tsx` | 카테고리 `/category/[slug]` |
| `web/src/app/blog/[id]/page.tsx` | `/[id]` → `/[id]/[slug]` 301 |
| `web/src/app/blog/[id]/[slug]/page.tsx` | 글 `/[id]/[slug]` |
| `web/src/app/blog/tag/[name]/page.tsx` | 태그 `/tag/[name]`, noindex |
| `web/src/app/blog/privacy/page.tsx` | 개인정보 처리방침 |
| `web/src/app/blog/sitemap.ts`, `web/src/app/blog/robots.ts` | 블로그 전용 sitemap·robots |
| `web/src/components/blog/BlogRail.tsx` | 레일 내용(서버). 프로필·카테고리·인기 글·태그·처리방침 |
| `web/src/components/blog/BlogShell.tsx` | 모바일 상단바·드로어·스크롤 상단바. `'use client'` |
| `web/src/components/blog/BlogPostList.tsx` | 목록 한 줄 렌더 |
| `web/src/components/blog/BlogComments.tsx` | 댓글 폼·삭제. `'use client'` |
| `web/src/app/styles/blog.css` | 블로그 전용 스타일 전부 |
| `scripts/migrate-lab-articles-to-blog.sql` | LAB 8편 복사(일회성, 재실행 안전) |
| `scripts/migrate-lab-articles-to-blog.sh` | 위 SQL 실행 래퍼 |
| `spring/.../blog/BlogController.java` | (수정) 인기 글·통계 엔드포인트 |

---

### Task 1: 인기 글·통계 엔드포인트 (백엔드)

레일의 `인기 글`과 모바일 드로어의 `통계`가 읽을 곳이 없다. `view_count`(V14)와 `BlogStatsService.summary()` 는 이미 있는데 노출되지 않았다.

**Files:**
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostRepository.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostService.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogController.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogApiIntegrationTest.java`

**Interfaces:**
- Consumes: 기존 `BlogPostService.toSummaries(List<BlogPost>)`(private), `BlogStatsService.Summary`
- Produces:
  - `GET /api/blog/posts/popular?limit=5` → `List<BlogPostSummaryDto>` (조회수 내림차순)
  - `GET /api/blog/stats` → `BlogStatsService.Summary`
    `{todayViews, yesterdayViews, totalViews, todayVisitors, yesterdayVisitors, totalVisitors, refSearch, refSns, refOther}`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`BlogApiIntegrationTest` 에 필드와 테스트를 추가한다. 이 클래스의 `@AfterEach` 는 자기가 만든 글만 지운다는 관례를 지켜야 하므로, 두 번째 글의 id 를 필드에 담고 정리한다.

기존 `private Long postId;` 아래에 추가:

```java
    /** 인기 글 테스트가 만드는 두 번째 글. @AfterEach 가 자기가 만든 것만 지우는 관례를 지킨다. */
    private Long popularPostId;
```

기존 `tearDown()` 의 `posts.deleteById(postId);` 바로 아래에 추가:

```java
        if (popularPostId != null) {
            posts.deleteById(popularPostId);
            popularPostId = null;
        }
```

클래스 끝에 테스트 두 개를 추가:

```java
    @Test
    void 인기_글은_조회수_내림차순이다() throws Exception {
        BlogPost hot = new BlogPost();
        hot.setSlug("hot-post");
        hot.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        hot.setTitle("많이 읽힌 글");
        hot.setBody("본문");
        hot.setStatus("published");
        hot.setPublishedAt(OffsetDateTime.parse("2026-07-01T00:00:00Z")); // 최신순으로는 뒤에 온다
        hot.setViewCount(99);
        hot.setCreatedAt(OffsetDateTime.now());
        hot.setUpdatedAt(OffsetDateTime.now());
        popularPostId = posts.save(hot).getId();

        mvc.perform(get("/api/blog/posts/popular"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("hot-post"));
    }

    @Test
    void 인기_글_limit_은_범위를_벗어나면_400() throws Exception {
        mvc.perform(get("/api/blog/posts/popular").param("limit", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 통계는_인증_없이_읽힌다() throws Exception {
        mvc.perform(get("/api/blog/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalViews").isNumber())
                .andExpect(jsonPath("$.totalVisitors").isNumber());
    }
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test --tests '*BlogApiIntegrationTest'
```

기대: 세 테스트 모두 실패. `popular` 와 `stats` 는 404(핸들러 없음).

- [ ] **Step 3: 리포지토리에 조회수 정렬 쿼리를 넣는다**

`BlogPostRepository.java` 의 import 에 추가:

```java
import org.springframework.data.domain.Pageable;
```

인터페이스 안에 추가:

```java
    /** 조회수 내림차순. 동률은 최신 → id 로 끊어 매 호출 결과를 같게 만든다. */
    @Query("""
        select p from BlogPost p
        where p.status = 'published'
        order by p.viewCount desc, p.publishedAt desc, p.id desc
        """)
    List<BlogPost> findPopular(Pageable pageable);
```

- [ ] **Step 4: 서비스에 popular 를 넣는다**

`BlogPostService.java` 의 import 에 추가:

```java
import org.springframework.data.domain.PageRequest;
```

`published()` 아래에 추가:

```java
    /** 레일의 '인기 글'. 조회수 기준이며 limit 범위 검사는 컨트롤러가 한다. */
    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> popular(int limit) {
        return toSummaries(posts.findPopular(PageRequest.of(0, limit)));
    }
```

- [ ] **Step 5: 컨트롤러에 두 엔드포인트를 넣는다**

`BlogController.java` 의 import 에 추가:

```java
import cloud.leneu.jaywiki.common.BadRequestException;
import org.springframework.web.bind.annotation.RequestParam;
```

`posts()` 아래에 추가:

```java
    /** 레일의 '인기 글'. 화면은 3편만 쓰지만 기본 5편을 준다. */
    @GetMapping("/posts/popular")
    public List<BlogPostSummaryDto> popular(@RequestParam(defaultValue = "5") int limit) {
        if (limit < 1 || limit > 20) {
            throw new BadRequestException("limit must be between 1 and 20: " + limit);
        }
        return postService.popular(limit);
    }
```

클래스 끝(`byTag` 아래)에 추가:

```java
    /** 방문자·조회수 집계. 개별 식별자가 없는 숫자뿐이라 공개해도 된다. */
    @GetMapping("/stats")
    public BlogStatsService.Summary stats() {
        return stats.summary();
    }
```

`/posts/popular` 는 `/posts/{id}` 보다 먼저 선언하지 않아도 된다. Spring 은 정적 세그먼트를 변수 세그먼트보다 우선한다. 다만 `{id}` 가 `Long` 이라 `popular` 가 잘못 매칭되면 400 이 나므로, 위 테스트가 이 순서 문제까지 잡는다.

- [ ] **Step 6: 통과를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test
```

기대: 141개 통과, 실패 0.

- [ ] **Step 7: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): expose popular posts and stats endpoints"
```

---

### Task 2: LAB 8편 이관 스크립트 (복사만)

설계 §10 의 일회성 스크립트다. 같은 PostgreSQL 안의 테이블 간 복사이므로 SQL 이 가장 짧고 정확하다. **이 태스크에서는 `tb_article` 을 지우지 않는다.** 삭제는 화면이 전부 돌아가는 것을 확인한 Task 11 에서 한다.

로컬 DB 기준 대상 8편(모두 `published`, 본문에 이미지 참조 0건 → `cover_asset_id` 는 전부 null 이다):

| parent_id | slug |
|---|---|
| personal-projects | `mding-local-first-markdown-pwa`, `donts3p-macos-sleep-assertion-app`, `jaycron-local-first-calendar-dashboard` |
| team-projects | `gongsitoktok-team-rag-mvp-retrospective`, `quantinue-ai-mock-trading-team-project-retrospective` |
| tech-lab | `local-llm-qwen36-ollama-omlx-benchmark` |
| tools-workflow | `orca-mobile-agent-workflow-retrospective`, `cmux-workspace-freeze-session-restore-retrospective` |

`tb_blog_category` 의 slug 4개가 `tb_article.parent_id` 4개와 문자열이 같으므로 매핑을 하드코딩하지 않고 조인한다.

**Files:**
- Create: `scripts/migrate-lab-articles-to-blog.sql`
- Create: `scripts/migrate-lab-articles-to-blog.sh`

**Interfaces:**
- Produces: `tb_blog_post` 에 8행(슬러그 유지), `tb_blog_tag`/`tb_blog_post_tag` 에 태그. 이후 태스크가 이 데이터로 화면을 만든다.

- [ ] **Step 1: 이관 SQL 을 쓴다**

`scripts/migrate-lab-articles-to-blog.sql`:

```sql
-- LAB 4개 탭의 위키 글을 블로그로 옮긴다. 일회성이지만 재실행해도 안전하다(slug 로 중복을 막는다).
-- 시드가 아니다. 이 스크립트는 tb_article 을 읽기만 하고 지우지 않는다.
-- 원본 삭제는 화면 확인이 끝난 뒤 사람이 따로 실행한다.
--
--   scripts/migrate-lab-articles-to-blog.sh            로컬
--   scripts/migrate-lab-articles-to-blog.sh --dry-run  옮길 대상만 출력
begin;

-- 1) 글 본문. parent_id 와 카테고리 slug 가 같은 문자열이라 그대로 조인한다.
--    published_at 은 위키의 작성일(created_at)을 쓰고, 없으면 옮기지 않는다.
--    V13 의 chk_blog_post_published_at 이 published + published_at null 을 막기 때문이다.
insert into public.tb_blog_post
    (slug, category_id, title, summary, body, status, published_at, created_at, updated_at)
select a.slug,
       c.id,
       a.title,
       a.summary,
       a.body,
       'published',
       a.created_at,
       a.created_at,
       now()
from public.tb_article a
join public.tb_blog_category c on c.slug = a.parent_id
where a.parent_id in ('personal-projects', 'team-projects', 'tech-lab', 'tools-workflow')
  and a.status = 'published'
  and a.created_at is not null
  and not exists (select 1 from public.tb_blog_post p where p.slug = a.slug);

-- 2) 태그. 위키는 콤마 문자열이라 풀어서 정규화한다.
with pairs as (
    select p.id as post_id,
           trim(t.name) as tag_name
    from public.tb_article a
    join public.tb_blog_post p on p.slug = a.slug
    cross join lateral unnest(string_to_array(coalesce(a.tags, ''), ',')) as t(name)
    where a.parent_id in ('personal-projects', 'team-projects', 'tech-lab', 'tools-workflow')
      and trim(t.name) <> ''
)
insert into public.tb_blog_tag (name)
select distinct tag_name from pairs
on conflict (name) do nothing;

with pairs as (
    select p.id as post_id,
           trim(t.name) as tag_name
    from public.tb_article a
    join public.tb_blog_post p on p.slug = a.slug
    cross join lateral unnest(string_to_array(coalesce(a.tags, ''), ',')) as t(name)
    where a.parent_id in ('personal-projects', 'team-projects', 'tech-lab', 'tools-workflow')
      and trim(t.name) <> ''
)
insert into public.tb_blog_post_tag (post_id, tag_id)
select pairs.post_id, tg.id
from pairs
join public.tb_blog_tag tg on tg.name = pairs.tag_name
on conflict do nothing;

-- 3) 본문 안의 위키 내부 링크를 블로그 주소로 바꾼다.
--    조사된 것은 orca → donts3p 한 건뿐이지만, 이관 대상끼리의 링크는 전부 바꾼다.
update public.tb_blog_post src
set body = replace(src.body, '/wiki/' || dst.slug, '/' || dst.id || '/' || dst.slug)
from public.tb_blog_post dst
where src.id <> dst.id
  and src.body like '%/wiki/' || dst.slug || '%';

commit;

-- 확인용 출력
select p.id, p.slug, c.slug as category, p.published_at::date,
       (select count(*) from public.tb_blog_post_tag pt where pt.post_id = p.id) as tags
from public.tb_blog_post p
join public.tb_blog_category c on c.id = p.category_id
order by p.published_at desc, p.id desc;
```

- [ ] **Step 2: 실행 래퍼를 쓴다**

`scripts/migrate-lab-articles-to-blog.sh`:

```bash
#!/usr/bin/env bash
# LAB 8편을 tb_article 에서 tb_blog_post 로 복사한다. 일회성이지만 재실행해도 안전하다.
# 원본(tb_article)은 건드리지 않는다. 삭제는 화면 확인 뒤 사람이 따로 한다.
#
#   scripts/migrate-lab-articles-to-blog.sh              로컬(docker exec pf-postgres)
#   scripts/migrate-lab-articles-to-blog.sh --dry-run    옮길 대상만 센다
#   PGHOST=... PGUSER=... scripts/migrate-lab-articles-to-blog.sh --psql  psql 로 직접
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="$HERE/migrate-lab-articles-to-blog.sql"
DB_USER="${PGUSER:-portfolio}"
DB_NAME="${PGDATABASE:-portfolio}"
CONTAINER="${BLOG_MIGRATION_CONTAINER:-pf-postgres}"

run_sql() {
  if [[ "${1:-}" == "--psql" ]] || [[ -n "${PGHOST:-}" ]]; then
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
  else
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
  fi
}

if [[ "${1:-}" == "--dry-run" ]]; then
  run_sql <<'EOF'
select a.parent_id, a.slug, a.created_at::date,
       exists (select 1 from public.tb_blog_post p where p.slug = a.slug) as already_migrated
from public.tb_article a
where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
  and a.status = 'published'
order by a.parent_id, a.created_at;
EOF
  exit 0
fi

run_sql < "$SQL"
```

```bash
chmod +x scripts/migrate-lab-articles-to-blog.sh
```

- [ ] **Step 3: dry-run 으로 대상을 확인한다**

```bash
scripts/migrate-lab-articles-to-blog.sh --dry-run
```

기대: 8행. `already_migrated` 가 전부 `f`. `created_at` 이 null 인 행이 있으면 **멈추고** 그 slug 를 보고한다(그 글은 `published_at` 을 정할 근거가 없어 이관 대상에서 빠진다).

- [ ] **Step 4: 실행한다**

```bash
scripts/migrate-lab-articles-to-blog.sh
```

기대: 마지막 select 가 8행. 카테고리가 4종이고 `tags` 가 전부 1 이상.

- [ ] **Step 5: 재실행이 안전한지 확인한다**

```bash
scripts/migrate-lab-articles-to-blog.sh | tail -12
docker exec pf-postgres psql -U portfolio -d portfolio -Atc "select count(*) from public.tb_blog_post;"
```

기대: 두 번 돌려도 `8`. 늘어나면 `not exists` 조건이 깨진 것이다.

- [ ] **Step 6: API 로 데이터를 확인한다**

백엔드가 떠 있는 상태에서:

```bash
curl -s localhost:8080/api/blog/posts | head -c 400
curl -s localhost:8080/api/blog/tags | head -c 300
curl -s localhost:8080/api/blog/categories | head -c 400
```

기대: 목록 8편, 태그 목록에 `local-first`·`pwa` 등, 카테고리 4개의 `postCount` 합이 8.

- [ ] **Step 7: 커밋**

```bash
git add scripts/migrate-lab-articles-to-blog.sql scripts/migrate-lab-articles-to-blog.sh
git commit -m "feat(blog): add one-off LAB article migration script"
```

---

### Task 3: 웹 데이터 계층과 순수 함수

화면을 그리기 전에 읽기 경로와 주소 규칙을 먼저 고정한다. vitest 는 node 환경이라 여기서 만드는 순수 함수가 이 라운드에서 자동 테스트가 가능한 유일한 층이다.

**Files:**
- Create: `web/src/lib/blogLinks.ts`
- Create: `web/src/lib/blogLinks.test.ts`
- Create: `web/src/lib/blog.ts`

**Interfaces:**
- Consumes: Task 1 의 `/api/blog/posts/popular`, `/api/blog/stats`, 기존 `/api/blog/*`
- Produces:
  - `blogPostHref(id: number, slug: string): string` → `/6/donts3p-...`
  - `blogAbsoluteUrl(path: string): string` → `https://blog.leneu.cloud/6/...`
  - `formatBlogDate(value: string | null | undefined): string` → `2026.08.01`, 값이 없으면 `--`
  - `BLOG_ORIGIN: string`
  - 타입 `BlogCategory`, `BlogPostSummary`, `BlogPost`, `BlogTagCount`, `BlogComment`, `BlogStats`, `BlogNeighbors`
  - `getBlogCategories()`, `getBlogPosts()`, `getBlogPostsByCategory(slug)`, `getBlogPostsByTag(name)`, `getBlogPost(id)`, `getBlogNeighbors(id)`, `getBlogTags()`, `getPopularBlogPosts(limit)`, `getBlogStats()`, `getBlogComments(id)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`web/src/lib/blogLinks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { blogAbsoluteUrl, blogPostHref, formatBlogDate } from './blogLinks';

describe('blogPostHref', () => {
  it('id 를 정본으로 두고 slug 를 뒤에 붙인다', () => {
    expect(blogPostHref(6, 'donts3p-macos-sleep-assertion-app')).toBe(
      '/6/donts3p-macos-sleep-assertion-app',
    );
  });

  it('slug 를 URL 인코딩한다', () => {
    expect(blogPostHref(7, '한글 슬러그')).toBe(`/7/${encodeURIComponent('한글 슬러그')}`);
  });

  it('slug 가 비면 id 만 쓴다', () => {
    expect(blogPostHref(8, '')).toBe('/8');
  });
});

describe('blogAbsoluteUrl', () => {
  it('블로그 오리진을 앞에 붙인다', () => {
    expect(blogAbsoluteUrl('/6/slug')).toBe('https://blog.leneu.cloud/6/slug');
  });

  it('오리진 끝의 슬래시가 겹치지 않는다', () => {
    expect(blogAbsoluteUrl('/')).toBe('https://blog.leneu.cloud/');
  });
});

describe('formatBlogDate', () => {
  it('KST 기준 YYYY.MM.DD 로 적는다', () => {
    // 2026-08-01T15:00:00Z = KST 2026-08-02 00:00
    expect(formatBlogDate('2026-08-01T15:00:00Z')).toBe('2026.08.02');
  });

  it('값이 없거나 못 읽으면 -- 를 준다', () => {
    expect(formatBlogDate(null)).toBe('--');
    expect(formatBlogDate('nope')).toBe('--');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd web && npm test -- blogLinks
```

기대: FAIL — `Cannot find module './blogLinks'`.

- [ ] **Step 3: 순수 함수를 만든다**

`web/src/lib/blogLinks.ts`:

```ts
/**
 * 블로그 주소 규칙과 날짜 표기. 순수 함수만 둔다.
 * middleware(edge)와 클라이언트 컴포넌트에서도 import 하므로 server-only 를 넣지 않는다.
 */

/** 블로그 공개 오리진. 빌드 시점에 번들로 인라인된다(NEXT_PUBLIC_). */
export const BLOG_ORIGIN = (
  process.env.NEXT_PUBLIC_BLOG_ORIGIN ?? 'https://blog.leneu.cloud'
).replace(/\/+$/, '');

/** 글 주소. 숫자 id 가 정본이고 slug 는 읽기용이다. */
export function blogPostHref(id: number, slug: string): string {
  return slug ? `/${id}/${encodeURIComponent(slug)}` : `/${id}`;
}

/** canonical·sitemap 처럼 절대 주소가 필요한 곳에서 쓴다. */
export function blogAbsoluteUrl(path: string): string {
  return `${BLOG_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

const KST = 'Asia/Seoul';

/** 목록·글머리의 날짜. 2026.08.01 형태. */
export function formatBlogDate(value: string | null | undefined): string {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  // en-CA 는 YYYY-MM-DD 를 준다. 구분자만 점으로 바꾼다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(parsed)
    .replace(/-/g, '.');
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd web && npm test -- blogLinks
```

기대: 7개 통과.

- [ ] **Step 5: API 클라이언트를 만든다**

`web/src/lib/blog.ts`:

```ts
import 'server-only';
import { BACKEND_BASE as BASE } from './backend';

/**
 * 블로그 API 클라이언트 (서버 컴포넌트 전용).
 * 클라이언트 컴포넌트는 이걸 부르지 말고 BFF(/api/bff/blog/*)를 쓴다.
 * 백엔드가 죽어도 사이트가 통째로 500 이 되지 않도록 목록류는 빈 배열로 떨어진다.
 */

export interface BlogCategory {
  id: number;
  slug: string;
  name: string;
  description?: string;
  sortOrder: number;
  postCount: number;
  children: BlogCategory[];
}

export interface BlogPostSummary {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  categorySlug?: string;
  categoryName?: string;
  coverAssetId?: string;
  publishedAt?: string;
}

export interface BlogPost extends BlogPostSummary {
  body: string;
  tags: string[];
}

export interface BlogNeighbors {
  prev: BlogPostSummary | null;
  next: BlogPostSummary | null;
}

export interface BlogTagCount {
  name: string;
  count: number;
}

export interface BlogComment {
  id: number;
  authorName: string;
  ipPrefix: string;
  body: string;
  createdAt: string;
}

export interface BlogStats {
  todayViews: number;
  yesterdayViews: number;
  totalViews: number;
  todayVisitors: number;
  yesterdayVisitors: number;
  totalVisitors: number;
  refSearch: number;
  refSns: number;
  refOther: number;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`blog API ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

/** 목록류는 백엔드가 죽어도 화면이 뜨도록 빈 값으로 떨어진다. */
async function getOrEmpty<T>(path: string, fallback: T): Promise<T> {
  try {
    return await get<T>(path);
  } catch {
    return fallback;
  }
}

export function getBlogCategories(): Promise<BlogCategory[]> {
  return getOrEmpty<BlogCategory[]>('/api/blog/categories', []);
}

export function getBlogPosts(): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>('/api/blog/posts', []);
}

export function getBlogPostsByCategory(slug: string): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>(
    `/api/blog/categories/${encodeURIComponent(slug)}/posts`,
    [],
  );
}

export function getBlogPostsByTag(name: string): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>(`/api/blog/tags/${encodeURIComponent(name)}/posts`, []);
}

export function getBlogTags(): Promise<BlogTagCount[]> {
  return getOrEmpty<BlogTagCount[]>('/api/blog/tags', []);
}

export function getPopularBlogPosts(limit = 5): Promise<BlogPostSummary[]> {
  return getOrEmpty<BlogPostSummary[]>(`/api/blog/posts/popular?limit=${limit}`, []);
}

export function getBlogStats(): Promise<BlogStats | null> {
  return getOrEmpty<BlogStats | null>('/api/blog/stats', null);
}

export function getBlogComments(id: number): Promise<BlogComment[]> {
  return getOrEmpty<BlogComment[]>(`/api/blog/posts/${id}/comments`, []);
}

/** 글 단건. 없으면 null — 화면이 notFound() 를 부른다. */
export async function getBlogPost(id: number): Promise<BlogPost | null> {
  const r = await fetch(`${BASE}/api/blog/posts/${id}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`getBlogPost ${id} → ${r.status}`);
  return r.json();
}

export function getBlogNeighbors(id: number): Promise<BlogNeighbors> {
  return getOrEmpty<BlogNeighbors>(`/api/blog/posts/${id}/neighbors`, { prev: null, next: null });
}
```

- [ ] **Step 6: 정적 검사와 전체 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

기대: 전부 통과, 새 경고 0.

- [ ] **Step 7: 커밋**

```bash
git add web/src/lib/blog.ts web/src/lib/blogLinks.ts web/src/lib/blogLinks.test.ts
git commit -m "feat(blog): add blog data layer and link helpers"
```

---

### Task 4: host rewrite 와 `/blog` 껍데기

`blog.` 로 시작하는 host 를 `/blog/*` 로 rewrite 한다. matcher 를 넓히면서 정적 자산이 middleware 를 타지 않게 막고, 기존 `/admin` 가드를 그대로 유지한다.

**Files:**
- Create: `web/src/lib/blogHost.ts`
- Create: `web/src/lib/blogHost.test.ts`
- Modify: `web/src/middleware.ts`
- Create: `web/src/app/blog/layout.tsx`
- Create: `web/src/app/blog/page.tsx`
- Create: `web/src/app/styles/blog.css`
- Modify: `web/src/app/globals.css`
- Modify: `web/src/app/robots.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `isBlogHost(host: string | null): boolean`
  - `blogRewritePath(pathname: string): string | null` — 이미 `/blog` 로 시작하거나 rewrite 대상이 아니면 null

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`web/src/lib/blogHost.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { blogRewritePath, isBlogHost } from './blogHost';

describe('isBlogHost', () => {
  it('blog. 로 시작하면 블로그다', () => {
    expect(isBlogHost('blog.leneu.cloud')).toBe(true);
    expect(isBlogHost('blog.localhost:3000')).toBe(true);
  });

  it('그 밖의 host 는 아니다', () => {
    expect(isBlogHost('portfolio.leneu.cloud')).toBe(false);
    expect(isBlogHost('localhost:3000')).toBe(false);
    expect(isBlogHost('myblog.leneu.cloud')).toBe(false);
    expect(isBlogHost(null)).toBe(false);
  });

  it('대문자 host 도 같게 본다', () => {
    expect(isBlogHost('BLOG.leneu.cloud')).toBe(true);
  });
});

describe('blogRewritePath', () => {
  it('루트는 /blog 로 간다', () => {
    expect(blogRewritePath('/')).toBe('/blog');
  });

  it('나머지 경로는 앞에 /blog 를 붙인다', () => {
    expect(blogRewritePath('/category/tech-lab')).toBe('/blog/category/tech-lab');
    expect(blogRewritePath('/6/donts3p')).toBe('/blog/6/donts3p');
    expect(blogRewritePath('/sitemap.xml')).toBe('/blog/sitemap.xml');
  });

  it('이미 /blog 로 시작하면 다시 붙이지 않는다', () => {
    expect(blogRewritePath('/blog')).toBeNull();
    expect(blogRewritePath('/blog/6/x')).toBeNull();
  });

  it('관리자와 API 는 블로그 host 에서도 그대로 둔다', () => {
    expect(blogRewritePath('/api/bff/blog/posts')).toBeNull();
    expect(blogRewritePath('/admin/login')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd web && npm test -- blogHost
```

기대: FAIL — 모듈 없음.

- [ ] **Step 3: 판정 함수를 만든다**

`web/src/lib/blogHost.ts`:

```ts
/**
 * 블로그 host 판정과 rewrite 경로. middleware(edge)에서 쓰므로 순수 함수만 둔다.
 *
 * host 를 'blog.leneu.cloud' 하나로 고정하지 않는 이유: 로컬에는 그 이름이 없어서
 * rewrite 를 확인할 방법이 사라진다. 'blog.' 접두사로 보면 blog.localhost:3000 으로
 * 바로 확인할 수 있다(대부분의 브라우저가 *.localhost 를 루프백으로 해석한다).
 */

const BLOG_HOST_PREFIX = 'blog.';

/** rewrite 하지 않고 원래 라우트로 보내는 경로. */
const PASSTHROUGH_PREFIXES = ['/blog', '/api', '/admin', '/_next'] as const;

export function isBlogHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host.toLowerCase().startsWith(BLOG_HOST_PREFIX);
}

/** 블로그 host 에서 요청된 경로를 /blog/* 로 옮긴다. 옮길 필요가 없으면 null. */
export function blogRewritePath(pathname: string): string | null {
  if (PASSTHROUGH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return pathname === '/' ? '/blog' : `/blog${pathname}`;
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd web && npm test -- blogHost
```

기대: 8개 통과.

- [ ] **Step 5: middleware 를 고친다**

`web/src/middleware.ts` 전체를 아래로 바꾼다. 기존 `/admin` 가드 동작은 그대로다.

```ts
import { NextRequest, NextResponse } from 'next/server';

import { blogRewritePath, isBlogHost } from '@/lib/blogHost';

/**
 * 1) host 가 blog.* 이면 /blog/* 라우트로 rewrite 한다 (설계 3절).
 * 2) /admin/* 보호. jw_token 쿠키가 없으면 /admin/login 으로.
 *    (쿠키 '존재'만 체크 — 실제 유효성은 Spring 이 검증. 이 미들웨어는 UX용 가드)
 *    로컬 개발용 가벼운 가드. prod 에선 Cloudflare Access 가 앞단에서 한 번 더.
 *
 * matcher 를 전 경로로 넓혔으므로 정적 자산은 matcher 에서 제외한다.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBlogHost(req.headers.get('host'))) {
    const rewritten = blogRewritePath(pathname);
    if (rewritten) {
      const url = req.nextUrl.clone();
      url.pathname = rewritten;
      return NextResponse.rewrite(url);
    }
  }

  // 로그인 페이지는 통과
  if (pathname.startsWith('/admin/login')) return NextResponse.next();

  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('jw_token');
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // 정적 자산·이미지 최적화·파비콘·API 는 host 를 볼 필요가 없다.
  // 이것들까지 middleware 를 타면 모든 자산 요청마다 함수가 한 번씩 더 돈다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
```

- [ ] **Step 6: 블로그 CSS 파일을 만든다**

`web/src/app/styles/blog.css` — 이 태스크에서는 골격만 넣는다. 이후 태스크가 이 파일에 이어 붙인다.

```css
/* ============================================================
   블로그 (blog.leneu.cloud)
   레이아웃 정본: 설계 문서의 레이아웃 샘플 아티팩트.
   색·크기·모서리는 tokens.css 값만 쓴다. 새 값을 만들지 않는다.
   ============================================================ */

/* 스크롤바를 숨기되 스크롤은 살린다 */
.blog-hush { scrollbar-width: none; -ms-overflow-style: none; }
.blog-hush::-webkit-scrollbar { width: 0; height: 0; display: none; }

.blog-grid {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--bg-0);
}

.blog-main { min-width: 0; position: relative; }
.blog-main-inner { padding: 26px 30px 44px; }

@media (max-width: 820px) {
  .blog-grid { grid-template-columns: minmax(0, 1fr); }
  .blog-main-inner { padding: 16px 14px 28px; }
}

@media (prefers-reduced-motion: reduce) {
  .blog-grid *, .blog-grid *::before, .blog-grid *::after {
    transition: none !important; animation: none !important;
  }
}
```

`web/src/app/globals.css` 의 `@import` 목록 **맨 끝**에 한 줄 추가:

```css
@import './styles/blog.css';
```

- [ ] **Step 7: `/blog` 껍데기를 만든다**

`web/src/app/blog/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { BLOG_ORIGIN } from '@/lib/blogLinks';

export const metadata: Metadata = {
  metadataBase: new URL(BLOG_ORIGIN),
  title: {
    default: 'leneu — 만든 것과 그때의 판단',
    template: '%s · leneu',
  },
  description: '개인 프로젝트, 팀 프로젝트, 기술 실험, 도구와 워크플로에 대한 기록.',
};

/** 블로그 골격. 좌측 레일 + 우측 본문. 위키 Header/Footer 를 쓰지 않는다. */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className="blog-grid">{children}</div>;
}
```

`web/src/app/blog/page.tsx` (이 태스크에서는 rewrite 확인용 최소 화면. Task 6 에서 진짜 목록으로 바꾼다):

```tsx
export const dynamic = 'force-dynamic';

export default function BlogHomePage() {
  return (
    <main id="main-content" className="blog-main">
      <div className="blog-main-inner">
        <h1>blog.leneu.cloud</h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: 위키 robots 에서 `/blog` 를 뺀다**

같은 앱이라 `portfolio.leneu.cloud/blog/*` 로도 열린다. 두 주소가 같은 글을 내면 색인이 갈라지므로 위키 host 에서는 색인하지 않는다.

`web/src/app/robots.ts` 의 `disallow` 배열을 바꾼다:

```ts
        disallow: ['/admin', '/api', '/login', '/blog'],
```

- [ ] **Step 9: rewrite 를 눈으로 확인한다**

```bash
cd web && npm run dev
```

브라우저에서 확인:

| 주소 | 기대 |
|---|---|
| `http://blog.localhost:3000/` | `blog.leneu.cloud` 제목이 보인다 (주소창은 `/` 그대로) |
| `http://localhost:3000/` | 기존 위키 홈. 달라진 것이 없다 |
| `http://localhost:3000/admin` | 로그인 쿠키가 없으면 `/admin/login` 으로 이동 |
| `http://blog.localhost:3000/api/bff/blog/posts` | JSON 배열 8편 (rewrite 되지 않는다) |

- [ ] **Step 10: 정적 검사와 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

- [ ] **Step 11: 커밋**

```bash
git add web/src/lib/blogHost.ts web/src/lib/blogHost.test.ts web/src/middleware.ts \
        web/src/app/blog web/src/app/styles/blog.css web/src/app/globals.css web/src/app/robots.ts
git commit -m "feat(blog): rewrite blog.* host to /blog routes"
```

---

### Task 5: 레일과 모바일 드로어

설계 §7 의 좌측 레일. 헤더가 여기에만 있다. 데스크톱에서는 250px 고정 레일, 820px 아래에서는 상단바 + 드로어(화면의 75%, 나머지는 blur)로 바뀐다.

**Files:**
- Create: `web/src/components/blog/BlogRail.tsx`
- Create: `web/src/components/blog/BlogShell.tsx`
- Modify: `web/src/app/blog/layout.tsx`
- Modify: `web/src/app/styles/blog.css`

**Interfaces:**
- Consumes: `getBlogCategories()`, `getPopularBlogPosts()`, `getBlogTags()`, `getBlogStats()`, `blogPostHref`, `formatBlogDate`
- Produces:
  - `<BlogRail />` — 서버 컴포넌트. 인자 없음. 레일 내용을 렌더한다
  - `<BlogShell rail={ReactNode}>{children}</BlogShell>` — `'use client'`. 상단바·드로어·스크롤 감지를 맡고, 레일 내용을 데스크톱 레일과 모바일 드로어 양쪽에 꽂는다

- [ ] **Step 1: 레일 내용을 만든다**

`web/src/components/blog/BlogRail.tsx`:

```tsx
import Link from 'next/link';
import {
  getBlogCategories,
  getBlogStats,
  getBlogTags,
  getPopularBlogPosts,
} from '@/lib/blog';
import { blogPostHref, formatBlogDate } from '@/lib/blogLinks';

/**
 * 좌측 레일 = 블로그의 헤더다. 본문 쪽에는 헤더가 없다.
 * 프로필 → 전체 글 + 카테고리 → 인기 글 → 태그 → 처리방침 순으로 쌓인다.
 * 데스크톱 레일과 모바일 드로어가 같은 내용을 쓴다(BlogShell 이 양쪽에 꽂는다).
 */
export async function BlogRail() {
  const [categories, popular, tags, stats] = await Promise.all([
    getBlogCategories(),
    getPopularBlogPosts(3),
    getBlogTags(),
    getBlogStats(),
  ]);

  const total = categories.reduce(
    (sum, c) => sum + c.postCount + c.children.reduce((s, ch) => s + ch.postCount, 0),
    0,
  );

  return (
    <div className="blog-rail-body">
      <div className="blog-prof">
        <div className="blog-prof-id">
          <div className="blog-avatar" aria-hidden="true">
            JM
          </div>
          <div>
            <b>leneu</b>
            <span>@jaymunsh</span>
          </div>
        </div>
        <p className="blog-prof-bio">만든 것과 그때의 판단을 남깁니다.</p>
        {stats && (
          <div className="blog-prof-stat">
            <div>
              <b>{stats.todayVisitors.toLocaleString('ko-KR')}</b>
              <span>오늘 방문</span>
            </div>
            <div>
              <b>{stats.totalVisitors.toLocaleString('ko-KR')}</b>
              <span>누적 방문</span>
            </div>
          </div>
        )}
      </div>

      <nav className="blog-rail-sec" aria-label="카테고리">
        <h4>
          전체 글 <span className="n">({total})</span>
        </h4>
        <ul className="blog-cats">
          <li>
            <Link className="blog-cat-row" href="/">
              <span>전체</span>
              <span className="n">({total})</span>
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link className="blog-cat-row" href={`/category/${encodeURIComponent(category.slug)}`}>
                <span>{category.name}</span>
                <span className="n">({category.postCount})</span>
              </Link>
              {category.children.length > 0 && (
                <ul className="blog-subcats">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        className="blog-cat-row"
                        href={`/category/${encodeURIComponent(child.slug)}`}
                      >
                        <span>{child.name}</span>
                        <span className="n">({child.postCount})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {popular.length > 0 && (
        <div className="blog-rail-sec">
          <h4>인기 글</h4>
          <ul className="blog-pop">
            {popular.map((post) => (
              <li key={post.id}>
                <Link href={blogPostHref(post.id, post.slug)}>
                  <span className="t">
                    {post.title}
                    <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tags.length > 0 && (
        <div className="blog-rail-sec">
          <h4>태그</h4>
          <ul className="blog-taglist">
            {tags.map((tag) => (
              <li key={tag.name}>
                <Link href={`/tag/${encodeURIComponent(tag.name)}`}>{tag.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="blog-rail-foot">
        <Link href="/privacy">개인정보 처리방침</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 껍데기(상단바·드로어)를 만든다**

`web/src/components/blog/BlogShell.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * 데스크톱: 250px 레일 + 본문. 본문을 스크롤하면 상단 바가 서서히 나타난다.
 * 820px 아래: 상단 바(햄버거·이름·← wiki)가 생기고, 햄버거를 누르면 화면의 3/4 을
 * 덮는 드로어가 왼쪽에서 나온다. 남은 1/4 은 blur(6px) 로 뒤가 비친다.
 * 닫기는 햄버거 재클릭 / 바깥 클릭 / Esc.
 */
export function BlogShell({
  rail,
  title,
  category,
  children,
}: {
  readonly rail: React.ReactNode;
  readonly title: string;
  readonly category?: string;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // 경로가 바뀌면 드로어를 닫는다. 링크를 눌렀는데 드로어가 남아 있으면 안 된다.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={open ? 'blog-shell open' : 'blog-shell'}>
      <div className="blog-mtop">
        <button
          type="button"
          className="blog-burger"
          aria-label="메뉴 열기"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
        </button>
        <span className="blog-mtitle">leneu</span>
        <a className="blog-back" href="https://portfolio.leneu.cloud">
          ← wiki
        </a>
      </div>

      <aside className="blog-rail blog-hush">
        <div className="blog-rail-brand">
          <b>leneu</b>
          <span className="host">blog.leneu.cloud</span>
          <a className="back" href="https://portfolio.leneu.cloud">
            ← jay-wiki로 돌아가기
          </a>
        </div>
        {rail}
      </aside>

      <button
        type="button"
        className="blog-scrim"
        aria-label="메뉴 닫기"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <main id="main-content" className="blog-main" ref={mainRef}>
        <div className={scrolled ? 'blog-stickybar on' : 'blog-stickybar'}>
          {category && <span className="sb-cat">{category}</span>}
          <b>{title}</b>
          <button
            type="button"
            className="sb-top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            ↑ 위로
          </button>
        </div>
        <div className="blog-main-inner">{children}</div>
      </main>

      <Link className="blog-skip" href="#main-content">
        본문으로 건너뛰기
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: layout 을 껍데기로 바꾼다**

`web/src/app/blog/layout.tsx` 의 default export 를 바꾼다(`metadata` 는 그대로 둔다):

```tsx
/** 블로그 골격. 좌측 레일 + 우측 본문. 위키 Header/Footer 를 쓰지 않는다. */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div className="blog-grid">{children}</div>;
}
```

레일과 상단바 제목은 페이지마다 다르므로 `BlogShell` 은 layout 이 아니라 **각 페이지**가 쓴다. layout 은 grid 만 유지한다. 위 코드는 Task 4 와 같으므로 실제로는 파일을 고칠 것이 없다 — 확인만 하고 넘어간다.

- [ ] **Step 4: 레일 CSS 를 넣는다**

`web/src/app/styles/blog.css` 의 `.blog-main-inner` 규칙 **아래**, `@media (max-width: 820px)` **위**에 붙인다:

```css
/* ---- 좌측 레일: 헤더가 여기에만 있다 ---- */
.blog-shell { display: contents; }

.blog-rail {
  border-right: 1px solid var(--border); background: var(--bg-1);
  display: flex; flex-direction: column;
  position: sticky; top: 0; align-self: start;
  height: 100vh; overflow-y: auto; overscroll-behavior: contain;
}
.blog-rail-brand {
  padding: 18px 16px 14px; display: flex; flex-direction: column; gap: 3px;
  border-bottom: 1px solid var(--border);
}
.blog-rail-brand b { font-size: var(--fs-lg); letter-spacing: -.01em; }
.blog-rail-brand .host { font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute); }
.blog-rail-brand a.back { margin-top: 7px; font-size: var(--fs-xs); color: var(--accent); text-decoration: none; }
.blog-rail-brand a.back:hover { text-decoration: underline; }
.blog-rail-body { padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 4px; flex: 1; }

.blog-prof { display: flex; flex-direction: column; gap: 9px; padding-bottom: 12px; }
.blog-prof-id { display: flex; align-items: center; gap: 10px; }
.blog-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex: none;
  background: var(--grad-1); color: #fff; display: grid; place-items: center;
  font-family: var(--mono); font-size: var(--fs-sm); font-weight: 600;
}
.blog-prof-id b { display: block; font-size: var(--fs-md); }
.blog-prof-id span { display: block; font-size: var(--fs-2xs); color: var(--text-mute); font-family: var(--mono); }
.blog-prof-bio { font-size: var(--fs-xs); color: var(--text-dim); margin: 0; line-height: 1.6; }
.blog-prof-stat { display: flex; gap: 14px; font-variant-numeric: tabular-nums; }
.blog-prof-stat div { display: flex; flex-direction: column; }
.blog-prof-stat b { font-size: var(--fs-lg); line-height: 1.2; }
.blog-prof-stat span { font-size: var(--fs-2xs); color: var(--text-mute); }

.blog-rail-sec { padding: 14px 0; border-top: 1px solid var(--border); }
.blog-rail-sec:first-of-type { border-top: 0; padding-top: 0; }
.blog-rail-sec > h4 { margin: 0 0 8px; font-size: var(--fs-md); font-weight: 700; letter-spacing: -.01em; }
.blog-rail-sec > h4 .n { font-family: var(--mono); font-size: var(--fs-xs); color: var(--text-mute); font-weight: 500; }

.blog-cats, .blog-subcats { list-style: none; margin: 0; padding: 0; }
.blog-subcats { padding: 0 0 4px 14px; }
.blog-cat-row {
  display: flex; align-items: center; gap: 7px; padding: 7px 4px;
  text-decoration: none; color: var(--text-dim); font-size: var(--fs-sm); border-radius: var(--r-xs);
}
.blog-cat-row:hover { background: var(--hover); color: var(--text); }
.blog-cat-row[aria-current='page'] { color: var(--accent); font-weight: 600; }
.blog-cat-row .n { font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute); margin-left: auto; }
.blog-subcats .blog-cat-row { font-size: var(--fs-xs); }
.blog-subcats .blog-cat-row::before { content: '›'; font-family: var(--mono); color: var(--text-mute); }

.blog-pop { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
.blog-pop a { display: flex; gap: 9px; text-decoration: none; color: inherit; }
.blog-pop .t {
  flex: 1; min-width: 0; font-size: var(--fs-xs); color: var(--text-dim); line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.blog-pop a:hover .t { color: var(--accent); }
.blog-pop time { display: block; font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute); margin-top: 3px; }

.blog-taglist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.blog-taglist a {
  display: block; padding: 4px; text-decoration: none;
  color: var(--text-dim); font-size: var(--fs-sm); border-radius: var(--r-xs);
}
.blog-taglist a:hover { background: var(--hover); color: var(--accent); }
.blog-taglist a::before { content: '#'; color: var(--text-mute); margin-right: 6px; }

.blog-rail-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); }
.blog-rail-foot a { font-size: var(--fs-2xs); color: var(--text-mute); text-decoration: none; }
.blog-rail-foot a:hover { color: var(--accent); text-decoration: underline; }

/* ---- 우측 본문 위의 스크롤 바 ---- */
/* 스크롤하면 서서히 나타난다. 자리를 차지하지 않도록 음수 margin 으로 상쇄한다. */
.blog-stickybar {
  position: sticky; top: 0; z-index: 4;
  display: flex; align-items: center; gap: 10px;
  padding: 0 22px; height: 48px; margin-bottom: -48px;
  background: color-mix(in srgb, var(--bg-1) 72%, transparent);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--border);
  opacity: 0; transform: translateY(-6px); pointer-events: none;
  transition: opacity .22s ease, transform .22s ease;
}
.blog-stickybar.on { opacity: 1; transform: none; pointer-events: auto; }
.blog-stickybar b {
  font-size: var(--fs-sm); font-weight: 600; letter-spacing: -.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; text-align: center;
}
.blog-stickybar .sb-cat { font-size: var(--fs-2xs); color: var(--accent-2); font-weight: 600; flex: none; }
.blog-stickybar .sb-top {
  font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute);
  background: none; border: 0; cursor: pointer; flex: none; padding: 4px 6px; border-radius: var(--r-xs);
}
.blog-stickybar .sb-top:hover { background: var(--hover); color: var(--text); }

/* ---- 모바일 상단바와 드로어 ---- */
.blog-mtop { display: none; }
.blog-scrim { display: none; }
.blog-skip {
  position: absolute; left: -9999px;
  background: var(--bg-1); color: var(--text); padding: 8px 12px; border-radius: var(--r-xs);
}
.blog-skip:focus { left: 8px; top: 8px; z-index: 10; }
```

- [ ] **Step 5: 모바일 규칙을 넣는다**

`blog.css` 의 `@media (max-width: 820px)` 블록을 아래로 바꾼다:

```css
@media (max-width: 820px) {
  .blog-grid { grid-template-columns: minmax(0, 1fr); }
  .blog-main-inner { padding: 16px 14px 28px; }

  .blog-mtop {
    display: flex; align-items: center; gap: 10px;
    position: sticky; top: 0; z-index: 6; height: 55px; padding: 10px 12px;
    background: var(--bg-1); border-bottom: 1px solid var(--border);
    grid-column: 1;
  }
  .blog-mtop .blog-mtitle { flex: 1; text-align: center; font-size: var(--fs-md); font-weight: 600; }
  .blog-mtop .blog-back { font-size: var(--fs-xs); color: var(--accent); text-decoration: none; flex: none; }
  .blog-burger {
    flex: none; width: 34px; height: 34px; display: inline-flex;
    align-items: center; justify-content: center;
    background: none; border: 1px solid var(--border); border-radius: var(--r-xs);
    cursor: pointer; padding: 0;
  }
  .blog-burger span { display: block; position: relative; width: 15px; height: 1.5px; background: var(--text); border-radius: 2px; }
  .blog-burger span::before, .blog-burger span::after {
    content: ''; position: absolute; left: 0; width: 15px; height: 1.5px; background: var(--text); border-radius: 2px;
  }
  .blog-burger span::before { top: -5px; }
  .blog-burger span::after { top: 5px; }

  /* 드로어는 화면의 3/4 만 덮는다. 남은 1/4 로 뒤가 blur 되어 보인다. */
  .blog-rail {
    position: fixed; top: 55px; left: 0; bottom: 0; width: 75%; height: auto; z-index: 8;
    transform: translateX(-100%); transition: transform .24s ease; visibility: hidden;
  }
  .blog-rail-brand { display: none; }
  .blog-shell.open .blog-rail { transform: translateX(0); visibility: visible; }

  .blog-scrim {
    display: block; position: fixed; inset: 55px 0 0; z-index: 7;
    background: color-mix(in srgb, var(--bg-0) 42%, transparent);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    border: 0; padding: 0;
    opacity: 0; pointer-events: none; transition: opacity .24s ease;
  }
  .blog-shell.open .blog-scrim { opacity: 1; pointer-events: auto; }

  .blog-stickybar { display: none; }
}
```

`.blog-shell { display: contents; }` 때문에 `.blog-mtop` 이 grid 의 첫 칸에 놓인다. 모바일에서는 grid 가 한 칸이므로 상단바 → 본문 순으로 쌓인다.

- [ ] **Step 6: 눈으로 확인한다**

`http://blog.localhost:3000/` — 아직 목록이 없으므로 Task 6 이후에 완성된 모습이 된다. 이 태스크에서는 아래만 본다.

| 확인 | 방법 |
|---|---|
| 데스크톱 1440px 에서 레일이 250px 이고 가로 스크롤이 없다 | 개발자도구 → `document.documentElement.scrollWidth === window.innerWidth` |
| 레일이 화면 높이를 채우고 자체 스크롤한다. 스크롤바가 보이지 않는다 | 레일 안에서 휠 |
| 390px 에서 상단바가 나오고 햄버거로 드로어가 열린다. 드로어 폭이 화면의 75% 다 | 개발자도구 반응형 390×844 |
| 드로어 바깥 클릭 / Esc / 햄버거 재클릭으로 닫힌다 | 셋 다 해본다 |
| 390px 에서 `document.documentElement.scrollWidth` 가 390 이다 | 콘솔 |

목록 페이지가 아직 `BlogShell` 을 쓰지 않으므로, 확인을 위해 `web/src/app/blog/page.tsx` 를 임시로 바꾼다(Task 6 에서 다시 바뀐다):

```tsx
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';

export const dynamic = 'force-dynamic';

export default function BlogHomePage() {
  return (
    <BlogShell rail={<BlogRail />} title="전체 글">
      <h1>blog.leneu.cloud</h1>
    </BlogShell>
  );
}
```

- [ ] **Step 7: 정적 검사와 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

- [ ] **Step 8: 커밋**

```bash
git add web/src/components/blog web/src/app/blog web/src/app/styles/blog.css
git commit -m "feat(blog): add rail, mobile drawer and scroll title bar"
```

---

### Task 6: 목록과 카테고리 화면

**Files:**
- Create: `web/src/components/blog/BlogPostList.tsx`
- Modify: `web/src/app/blog/page.tsx`
- Create: `web/src/app/blog/category/[slug]/page.tsx`
- Modify: `web/src/app/styles/blog.css`

**Interfaces:**
- Consumes: `getBlogPosts()`, `getBlogPostsByCategory()`, `getBlogCategories()`, `BlogRail`, `BlogShell`
- Produces: `<BlogPostList posts={BlogPostSummary[]} />`

- [ ] **Step 1: 목록 컴포넌트를 만든다**

`web/src/components/blog/BlogPostList.tsx`:

```tsx
import Link from 'next/link';
import type { BlogPostSummary } from '@/lib/blog';
import { blogPostHref, formatBlogDate } from '@/lib/blogLinks';

/**
 * 목록 한 줄 = 카테고리 / 제목 / 날짜 / 요약(2줄).
 * 대표 이미지가 있는 글만 우측에 156×117 썸네일이 붙고, 없으면 본문이 폭을 다 쓴다.
 * 목록에 태그는 넣지 않는다 — 태그 탐색은 좌측 레일이 맡는다.
 */
export function BlogPostList({ posts }: { readonly posts: readonly BlogPostSummary[] }) {
  if (posts.length === 0) {
    return <p className="blog-empty">아직 글이 없습니다.</p>;
  }

  return (
    <div className="blog-posts">
      {posts.map((post) => (
        <Link
          key={post.id}
          className={post.coverAssetId ? 'blog-post has-thumb' : 'blog-post'}
          href={blogPostHref(post.id, post.slug)}
        >
          {post.coverAssetId && (
            <span className="blog-post-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/wiki-assets/${post.coverAssetId}`} alt="" loading="lazy" />
            </span>
          )}
          <span className="blog-post-cat">{post.categoryName}</span>
          <span className="blog-post-title">{post.title}</span>
          <time className="blog-post-date" dateTime={post.publishedAt}>
            {formatBlogDate(post.publishedAt)}
          </time>
          {post.summary && <span className="blog-post-sum">{post.summary}</span>}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 목록 화면을 만든다**

`web/src/app/blog/page.tsx` 전체를 바꾼다:

```tsx
import type { Metadata } from 'next';
import { BlogPostList } from '@/components/blog/BlogPostList';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogPosts } from '@/lib/blog';

export const dynamic = 'force-dynamic'; // 원본 SoT = DB. 항상 최신 목록

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function BlogHomePage() {
  const posts = await getBlogPosts();

  return (
    <BlogShell rail={<BlogRail />} title={`전체 글 · ${posts.length}편`} category="전체">
      <div className="blog-list-head">
        <h1>전체 글</h1>
        <span className="count">{posts.length}편</span>
      </div>
      <BlogPostList posts={posts} />
    </BlogShell>
  );
}
```

- [ ] **Step 3: 카테고리 화면을 만든다**

`web/src/app/blog/category/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { BlogPostList } from '@/components/blog/BlogPostList';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogCategories, getBlogPostsByCategory } from '@/lib/blog';

export const dynamic = 'force-dynamic';

type Params = { readonly slug: string };

// generateMetadata 와 본문이 같은 요청 안에서 트리를 두 번 읽지 않도록 memoize.
const getCategoriesCached = cache(getBlogCategories);

/** 2단이므로 부모와 자식만 훑으면 된다. */
async function findCategory(slug: string) {
  const tree = await getCategoriesCached();
  for (const parent of tree) {
    if (parent.slug === slug) return parent;
    const child = parent.children.find((c) => c.slug === slug);
    if (child) return child;
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) return { title: '없는 카테고리', robots: { index: false } };
  return {
    title: category.name,
    description: category.description ?? `${category.name} 카테고리의 글`,
    alternates: { canonical: `/category/${encodeURIComponent(category.slug)}` },
  };
}

export default async function BlogCategoryPage({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { slug } = await params;
  const [category, posts] = await Promise.all([findCategory(slug), getBlogPostsByCategory(slug)]);
  if (!category) notFound();

  return (
    <BlogShell rail={<BlogRail />} title={category.name} category={category.name}>
      <div className="blog-cat-head">
        <div className="blog-crumb">
          <Link href="/">전체 글</Link> · <b>{category.name}</b>
        </div>
        <h1>{category.name}</h1>
        {category.description && <p>{category.description}</p>}
        <span className="count">{posts.length}편</span>
      </div>
      <BlogPostList posts={posts} />
    </BlogShell>
  );
}
```

- [ ] **Step 4: 목록 CSS 를 넣는다**

`blog.css` 의 모바일 미디어쿼리 **위**에 붙인다:

```css
/* ---- 목록 ---- */
.blog-list-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 12px; margin-bottom: 18px; flex-wrap: wrap;
}
.blog-list-head h1 { font-size: var(--fs-2xl); margin: 0; letter-spacing: -.02em; }
.blog-list-head .count { font-family: var(--mono); font-size: var(--fs-xs); color: var(--text-mute); }

.blog-cat-head { margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--border); }
.blog-cat-head h1 { font-size: var(--fs-2xl); margin: 0 0 6px; letter-spacing: -.02em; }
.blog-cat-head p { margin: 0 0 10px; font-size: var(--fs-sm); color: var(--text-dim); max-width: 62ch; }
.blog-cat-head .count {
  font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute);
  border: 1px solid var(--border); border-radius: 999px; padding: 2px 10px;
}
.blog-crumb { font-size: var(--fs-xs); color: var(--text-mute); margin-bottom: 9px; }
.blog-crumb a { color: var(--text-mute); text-decoration: none; }
.blog-crumb a:hover { color: var(--accent); }
.blog-crumb b { color: var(--text-dim); font-weight: 600; }

.blog-empty { color: var(--text-mute); font-size: var(--fs-sm); padding: 30px 2px; }

.blog-posts { display: flex; flex-direction: column; }
.blog-post {
  display: grid; grid-template-columns: minmax(0, 1fr); column-gap: 26px;
  align-items: center; text-decoration: none; color: inherit;
  padding: 24px 2px; border-bottom: 1px solid var(--border);
}
.blog-post.has-thumb { grid-template-columns: minmax(0, 1fr) 156px; }
.blog-post > *:not(.blog-post-thumb) { grid-column: 1; }
.blog-post:hover .blog-post-title { color: var(--accent); }

/* grid-row: 1 / -1 은 암시적 행에서 첫 줄만 덮어 그 줄이 썸네일 높이만큼 부푼다.
   span 으로 적어야 썸네일이 글 덩어리 전체 높이에 걸쳐 가운데 정렬된다. */
.blog-post-thumb {
  grid-column: 2; grid-row: 1 / span 6; align-self: center;
  width: 156px; height: 117px; border-radius: var(--r-sm);
  border: 1px solid var(--border); overflow: hidden; background: var(--bg-2);
}
.blog-post-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }

.blog-post-cat { font-size: var(--fs-xs); font-weight: 500; color: var(--text-mute); margin-bottom: 3px; }
.blog-post-title { font-size: var(--fs-xl); margin: 0 0 7px; line-height: 1.4; font-weight: 600; letter-spacing: -.01em; }
.blog-post-date { font-family: var(--mono); font-size: var(--fs-xs); color: var(--text-mute); margin-bottom: 9px; }
.blog-post-sum {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; margin: 0; font-size: var(--fs-sm); color: var(--text-dim); line-height: 1.65;
}
```

모바일 미디어쿼리(`max-width: 820px`) 안에 추가:

```css
  .blog-post.has-thumb { grid-template-columns: minmax(0, 1fr) 96px; column-gap: 14px; }
  .blog-post-thumb { width: 96px; height: 72px; }
  .blog-post-title { font-size: var(--fs-lg); }
  .blog-list-head h1, .blog-cat-head h1 { font-size: var(--fs-xl); }
```

- [ ] **Step 5: 눈으로 확인한다**

| 주소 | 기대 |
|---|---|
| `http://blog.localhost:3000/` | 8편이 최신순. 각 줄에 카테고리·제목·날짜·요약 2줄. 이관 글에는 대표 이미지가 없으므로 썸네일이 없고 본문이 폭을 다 쓴다 |
| `http://blog.localhost:3000/category/tools-workflow` | 2편. 머리말에 카테고리 이름·설명·`2편` |
| `http://blog.localhost:3000/category/nope` | 404 |
| 1440px | 가로 스크롤 없음 |
| 390px | `scrollWidth === 390` |

썸네일 배치는 데이터로 확인할 수 없다(이관 8편에 이미지가 없다). 개발자도구에서 목록 첫 줄의 클래스에 `has-thumb` 를 임시로 넣고 `.blog-post-thumb` 를 확인한 뒤 되돌린다. 썸네일이 첫 줄만 부풀리면 `grid-row` 가 잘못된 것이다.

- [ ] **Step 6: 정적 검사와 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

- [ ] **Step 7: 커밋**

```bash
git add web/src/components/blog/BlogPostList.tsx web/src/app/blog web/src/app/styles/blog.css
git commit -m "feat(blog): add post list and category screens"
```

---

### Task 7: 글 화면과 `/[id]` 301

본문 → 태그 줄 → 이전·다음 글 → `'카테고리' 카테고리의 다른 글` → (댓글은 Task 8). `/6` 만 요청해도 `/6/slug` 로 301 한다.

**Files:**
- Create: `web/src/app/blog/[id]/[slug]/page.tsx`
- Create: `web/src/app/blog/[id]/page.tsx`
- Modify: `web/src/app/styles/blog.css`

**Interfaces:**
- Consumes: `getBlogPost()`, `getBlogNeighbors()`, `getBlogPostsByCategory()`, `renderMarkdownPreview()`(기존 `@/lib/markdown`)
- Produces: `/blog/[id]/[slug]` 화면, `/blog/[id]` 영구 리다이렉트

- [ ] **Step 1: 글 화면을 만든다**

`web/src/app/blog/[id]/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogNeighbors, getBlogPost, getBlogPostsByCategory } from '@/lib/blog';
import { blogPostHref, formatBlogDate } from '@/lib/blogLinks';
import { renderMarkdownPreview } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

type Params = { readonly id: string; readonly slug: string };

// generateMetadata 와 본문이 같은 요청 안에서 글을 두 번 읽지 않도록 memoize.
// 조회수는 이 API 가 올리므로 memoize 하지 않으면 한 번 열 때 2가 오른다.
const getPostCached = cache(getBlogPost);

function parseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const numeric = parseId(id);
  const post = numeric === null ? null : await getPostCached(numeric);
  if (!post) return { title: '글을 찾을 수 없습니다', robots: { index: false } };
  const canonical = blogPostHref(post.id, post.slug);
  return {
    title: post.title,
    description: post.summary ?? post.title,
    alternates: { canonical },
    openGraph: { title: post.title, description: post.summary ?? post.title, url: canonical },
  };
}

export default async function BlogPostPage({ params }: { readonly params: Promise<Params> }) {
  const { id, slug } = await params;
  const numeric = parseId(id);
  if (numeric === null) notFound();

  const post = await getPostCached(numeric);
  if (!post) notFound();

  // slug 는 읽기용이다. 제목이 바뀌어 slug 가 달라져도 정본 주소로 보낸다.
  if (decodeURIComponent(slug) !== post.slug) {
    permanentRedirect(blogPostHref(post.id, post.slug));
  }

  const [neighbors, sameCategory] = await Promise.all([
    getBlogNeighbors(post.id),
    post.categorySlug ? getBlogPostsByCategory(post.categorySlug) : Promise.resolve([]),
  ]);
  const others = sameCategory.filter((p) => p.id !== post.id).slice(0, 5);

  return (
    <BlogShell rail={<BlogRail />} title={post.title} category={post.categoryName}>
      <article>
        <header className="blog-art-head">
          <div className="blog-art-meta">
            {post.categorySlug && (
              <Link className="blog-chip" href={`/category/${encodeURIComponent(post.categorySlug)}`}>
                {post.categoryName}
              </Link>
            )}
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
          </div>
          <h1>{post.title}</h1>
          {post.summary && <p className="sum">{post.summary}</p>}
        </header>

        <div
          className="prose blog-art-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(post.body) }}
        />

        {post.tags.length > 0 && (
          <div className="blog-art-tags">
            <span aria-hidden="true">#</span>
            <span className="sr-label">태그</span>
            {post.tags.map((tag) => (
              <Link key={tag} href={`/tag/${encodeURIComponent(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
        )}

        <nav className="blog-art-nav" aria-label="이전 다음 글">
          {neighbors.prev ? (
            <Link href={blogPostHref(neighbors.prev.id, neighbors.prev.slug)}>
              <span>← 이전 글</span>
              <b>{neighbors.prev.title}</b>
            </Link>
          ) : (
            <span />
          )}
          {neighbors.next && (
            <Link className="next" href={blogPostHref(neighbors.next.id, neighbors.next.slug)}>
              <span>다음 글 →</span>
              <b>{neighbors.next.title}</b>
            </Link>
          )}
        </nav>

        {others.length > 0 && (
          <section className="blog-samecat">
            <h2>
              &apos;<em>{post.categoryName}</em>&apos; 카테고리의 다른 글
            </h2>
            <ul>
              {others.map((other) => (
                <li key={other.id}>
                  <Link href={blogPostHref(other.id, other.slug)}>
                    <span className="t">{other.title}</span>
                    <span className="d">{formatBlogDate(other.publishedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </BlogShell>
  );
}
```

- [ ] **Step 2: `/[id]` 리다이렉트를 만든다**

`web/src/app/blog/[id]/page.tsx`:

```tsx
import { notFound, permanentRedirect } from 'next/navigation';
import { getBlogPost } from '@/lib/blog';
import { blogPostHref } from '@/lib/blogLinks';

export const dynamic = 'force-dynamic';

/**
 * /6 → /6/donts3p-... 로 301. 숫자 id 가 정본이고 slug 는 읽기용이다.
 * category·tag·privacy 는 정적 세그먼트라 Next 가 이 동적 라우트보다 먼저 매칭한다.
 */
export default async function BlogPostIdPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const post = await getBlogPost(Number(id));
  if (!post) notFound();

  permanentRedirect(blogPostHref(post.id, post.slug));
}
```

- [ ] **Step 3: 글 화면 CSS 를 넣는다**

`blog.css` 의 모바일 미디어쿼리 **위**에 붙인다:

```css
/* ---- 글 ---- */
.blog-art-head { border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 24px; }
.blog-art-meta {
  display: flex; align-items: center; gap: 8px; margin-bottom: 11px;
  font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute);
}
.blog-chip {
  font-family: var(--font); font-size: var(--fs-2xs); font-weight: 600; text-decoration: none;
  color: var(--accent-2); background: color-mix(in srgb, var(--accent-2) 12%, transparent);
  border-radius: var(--r-xs); padding: 2px 8px;
}
.blog-art-head h1 {
  font-size: var(--fs-2xl); margin: 0 0 10px; letter-spacing: -.02em;
  line-height: 1.35; text-wrap: balance;
}
.blog-art-head .sum { color: var(--text-dim); margin: 0; font-size: var(--fs-sm); }

/* 태그 줄 — 아이콘 하나가 줄 전체의 라벨이고, 알약은 작게 붙는다 */
.blog-art-tags {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  margin-top: 26px; padding: 12px 14px;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--r-sm);
}
.blog-art-tags > span[aria-hidden] { color: var(--text-mute); font-family: var(--mono); margin-right: 3px; }
.blog-art-tags .sr-label {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
.blog-art-tags a {
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-xs);
  padding: 3px 10px; text-decoration: none; color: var(--text-dim); font-size: var(--fs-xs);
}
.blog-art-tags a:hover { color: var(--accent); border-color: var(--accent); }

.blog-art-nav {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-top: 34px; padding-top: 20px; border-top: 1px solid var(--border);
}
.blog-art-nav a {
  border: 1px solid var(--border); border-radius: var(--r-sm); padding: 12px 14px;
  text-decoration: none; color: inherit; background: var(--bg-1);
}
.blog-art-nav a:hover { border-color: var(--accent); }
.blog-art-nav span {
  display: block; font-family: var(--mono); font-size: var(--fs-2xs);
  color: var(--text-mute); margin-bottom: 4px;
}
.blog-art-nav b { font-size: var(--fs-sm); font-weight: 600; line-height: 1.45; }
.blog-art-nav .next { text-align: right; }

.blog-samecat {
  margin-top: 34px; border: 1px solid var(--border); border-radius: var(--r-md);
  background: var(--bg-1); overflow: hidden;
}
.blog-samecat h2 {
  margin: 0; padding: 14px 18px; border-bottom: 1px solid var(--border);
  font-size: var(--fs-sm); font-weight: 600;
}
.blog-samecat h2 em { font-style: normal; color: var(--accent); }
.blog-samecat ul { list-style: none; margin: 0; padding: 6px 0; }
.blog-samecat li a {
  display: flex; align-items: baseline; gap: 12px; padding: 8px 18px;
  text-decoration: none; color: var(--text-dim); font-size: var(--fs-sm);
}
.blog-samecat li a:hover { background: var(--hover); color: var(--text); }
.blog-samecat .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.blog-samecat .d {
  font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute);
  flex: none; font-variant-numeric: tabular-nums;
}
```

모바일 미디어쿼리 안에 추가:

```css
  .blog-art-nav { grid-template-columns: 1fr; }
  .blog-art-nav .next { text-align: left; }
  .blog-art-head h1 { font-size: var(--fs-xl); }
```

- [ ] **Step 4: 눈으로 확인한다**

id 는 이관 결과에 따라 다르다. 먼저 확인한다:

```bash
curl -s localhost:8080/api/blog/posts | python3 -c "import json,sys; [print(p['id'], p['slug']) for p in json.load(sys.stdin)]"
```

| 확인 | 기대 |
|---|---|
| `/{id}/{slug}` | 본문이 마크다운으로 렌더된다. 표·코드 블록이 깨지지 않는다 |
| `/{id}` | `/{id}/{slug}` 로 이동. 개발자도구 Network 에서 **308** (Next 의 `permanentRedirect`) |
| `/{id}/wrong-slug` | 정본 slug 로 이동 |
| `/999999` | 404 |
| `/category/tech-lab` | 여전히 카테고리 화면 (동적 `[id]` 가 가로채지 않는다) |
| 태그 줄 | 본문 아래에 알약으로. 클릭하면 `/tag/...` (다음 태스크에서 화면이 생긴다) |
| 이전·다음 글 | 목록 순서와 맞는다 |
| 조회수 | 새로고침 1회에 `select view_count from tb_blog_post where id=...` 가 **1** 만 오른다 |

조회수 확인:

```bash
docker exec pf-postgres psql -U portfolio -d portfolio -Atc "select id, view_count from public.tb_blog_post order by id;"
```

- [ ] **Step 5: 정적 검사와 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

- [ ] **Step 6: 커밋**

```bash
git add web/src/app/blog web/src/app/styles/blog.css
git commit -m "feat(blog): add post screen with slug canonicalization"
```

---

### Task 8: 댓글

로그인 없이 쓴다. 입력은 `내용`(좌측 넓게) + 우측에 `이름`/`암호`/`등록`이 같은 폭으로 쌓인 2열 그리드. 이름 옆에 IP 앞 2옥텟이 붙는다.

**Files:**
- Create: `web/src/components/blog/BlogComments.tsx`
- Modify: `web/src/app/blog/[id]/[slug]/page.tsx`
- Modify: `web/src/app/styles/blog.css`

**Interfaces:**
- Consumes: `getBlogComments()`, BFF `POST /api/bff/blog/posts/{id}/comments`, `POST /api/bff/blog/comments/{id}/delete`
- Produces: `<BlogComments postId={number} comments={BlogComment[]} />`

- [ ] **Step 1: 댓글 컴포넌트를 만든다**

`web/src/components/blog/BlogComments.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BlogComment } from '@/lib/blog';
import { formatBlogDate } from '@/lib/blogLinks';

/**
 * 로그인 없이 쓰는 댓글. 이름·암호를 함께 받고 암호는 본인 삭제용이다.
 * 이름 옆의 (121.135) 는 서버가 준 앞 2옥텟이다 — 원본 IP 는 DB 에도 없다.
 * 브라우저에서 쓰므로 BFF 를 거친다(백엔드 주소 비노출 + CF-Connecting-IP 전달).
 */
export function BlogComments({
  postId,
  comments,
}: {
  readonly postId: number;
  readonly comments: readonly BlogComment[];
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !authorName.trim() || !password) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch(`/api/bff/blog/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ authorName, password, body }),
      });
      if (r.status === 429) throw new Error('너무 자주 쓰셨습니다. 잠시 뒤 다시 시도해 주세요.');
      if (!r.ok) throw new Error('댓글 등록에 실패했습니다.');
      setBody('');
      setPassword('');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '댓글 등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const input = window.prompt('댓글 작성 시 입력한 암호를 넣어 주세요.');
    if (!input) return;
    const r = await fetch(`/api/bff/blog/comments/${id}/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: input }),
    });
    if (!r.ok) {
      window.alert('암호가 맞지 않습니다.');
      return;
    }
    router.refresh();
  }

  return (
    <section className="blog-cmt">
      <h2>
        댓글<span>{comments.length}</span>
      </h2>

      {comments.length > 0 && (
        <ul className="blog-cmt-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div className="blog-cmt-who">
                <b>{comment.authorName}</b>
                <span className="ip">({comment.ipPrefix})</span>
                <time dateTime={comment.createdAt}>{formatBlogDate(comment.createdAt)}</time>
                <button type="button" className="del" onClick={() => remove(comment.id)}>
                  삭제
                </button>
              </div>
              <p className="blog-cmt-body">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="blog-cmt-form" onSubmit={submit}>
        <textarea
          placeholder="댓글을 남겨 주세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          aria-label="댓글 내용"
        />
        <input
          placeholder="이름"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={30}
          aria-label="이름"
        />
        <input
          type="password"
          placeholder="암호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={60}
          aria-label="삭제용 암호"
        />
        <button className="submit" disabled={busy || !body.trim() || !authorName.trim() || !password}>
          {busy ? '등록 중…' : '등록'}
        </button>
      </form>
      {err && <p className="blog-cmt-err">{err}</p>}
    </section>
  );
}
```

- [ ] **Step 2: 글 화면에 붙인다**

`web/src/app/blog/[id]/[slug]/page.tsx` 에 import 를 추가:

```tsx
import { BlogComments } from '@/components/blog/BlogComments';
```

`getBlogComments` 를 `@/lib/blog` import 목록에 추가하고, `Promise.all` 을 바꾼다:

```tsx
  const [neighbors, sameCategory, comments] = await Promise.all([
    getBlogNeighbors(post.id),
    post.categorySlug ? getBlogPostsByCategory(post.categorySlug) : Promise.resolve([]),
    getBlogComments(post.id),
  ]);
```

`</article>` 바로 앞(같은 카테고리 박스 아래)에 추가:

```tsx
        <BlogComments postId={post.id} comments={comments} />
```

- [ ] **Step 3: 댓글 CSS 를 넣는다**

`blog.css` 의 모바일 미디어쿼리 **위**에 붙인다:

```css
/* ---- 댓글 ---- */
.blog-cmt { margin-top: 30px; padding-top: 18px; border-top: 1px solid var(--border); }
.blog-cmt h2 { margin: 0 0 10px; font-size: var(--fs-sm); color: var(--text-mute); font-weight: 600; }
.blog-cmt h2 span { font-family: var(--mono); color: var(--accent); margin-left: 4px; }
.blog-cmt-list { list-style: none; margin: 0 0 18px; padding: 0; }
.blog-cmt-list li { padding: 12px 0; border-bottom: 1px solid var(--border); }
.blog-cmt-list li:first-child { padding-top: 0; }
.blog-cmt-who { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.blog-cmt-who b { font-size: var(--fs-sm); }
.blog-cmt-who .ip { font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute); margin-left: -4px; }
.blog-cmt-who time { font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute); }
.blog-cmt-who .del {
  margin-left: auto; font-size: var(--fs-2xs); color: var(--text-mute);
  background: none; border: 0; cursor: pointer; padding: 1px 5px; border-radius: var(--r-xs);
}
.blog-cmt-who .del:hover { background: var(--hover); color: var(--danger); }
.blog-cmt-body { margin: 0; font-size: var(--fs-sm); color: var(--text-dim); line-height: 1.6; white-space: pre-wrap; }

/* 본문칸이 왼쪽을 다 쓰고, 오른쪽에 이름·암호·등록이 같은 폭으로 쌓인다.
   세로 span 은 -1 이 아니라 span 으로 적어야 암시적 행에서도 전체를 덮는다. */
.blog-cmt-form { display: grid; grid-template-columns: minmax(0, 1fr) 132px; gap: 8px; }
.blog-cmt-form textarea { grid-column: 1; grid-row: 1 / span 3; min-height: 92px; resize: vertical; }
.blog-cmt-form input, .blog-cmt-form .submit { grid-column: 2; }
.blog-cmt-form input, .blog-cmt-form textarea {
  font: inherit; font-size: var(--fs-sm); color: var(--text); line-height: 1.6;
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-xs);
  padding: 9px 11px; width: 100%; display: block;
}
.blog-cmt-form input::placeholder, .blog-cmt-form textarea::placeholder { color: var(--text-mute); }
.blog-cmt-form input:focus, .blog-cmt-form textarea:focus { outline: none; border-color: var(--accent); }
.blog-cmt-form .submit {
  font: inherit; font-size: var(--fs-sm); font-weight: 600; color: #fff;
  background: var(--accent); border: 1px solid var(--accent); border-radius: var(--r-xs);
  padding: 9px 11px; cursor: pointer; width: 100%;
}
.blog-cmt-form .submit:hover:not(:disabled) { filter: brightness(1.08); }
.blog-cmt-form .submit:disabled { opacity: .5; cursor: not-allowed; }
.blog-cmt-err { margin: 8px 0 0; font-size: var(--fs-xs); color: var(--danger); }
```

모바일 미디어쿼리 안에 추가:

```css
  .blog-cmt-form { grid-template-columns: minmax(0, 1fr) 104px; }
```

- [ ] **Step 4: 눈으로 확인한다**

| 확인 | 기대 |
|---|---|
| 댓글 등록 | 목록에 바로 나타난다. 이름 옆에 `(127.0)` 같은 앞 2옥텟 |
| 맞는 암호로 삭제 | 사라진다 |
| 틀린 암호로 삭제 | `암호가 맞지 않습니다.` |
| 빈 내용·빈 이름·빈 암호 | 등록 버튼이 비활성 |
| 원본 IP 미저장 | 아래 쿼리 |
| 연속 등록 | rate limit 이 걸리면 `너무 자주 쓰셨습니다` |

```bash
docker exec pf-postgres psql -U portfolio -d portfolio -Atc \
  "select author_name, ip_prefix, length(ip_hash) from public.tb_blog_comment;"
```

기대: `ip_prefix` 는 두 옥텟, `ip_hash` 는 64자. 원본 IP 컬럼이 애초에 없다.

- [ ] **Step 5: 정적 검사와 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

- [ ] **Step 6: 커밋**

```bash
git add web/src/components/blog/BlogComments.tsx web/src/app/blog web/src/app/styles/blog.css
git commit -m "feat(blog): add anonymous comments with password delete"
```

---

### Task 9: 태그 페이지 (noindex)

글 8편에 태그 40여 개면 태그당 1~2편이다. 내용이 거의 없는 페이지를 색인시키지 않는다. 글이 쌓이면 푼다.

**Files:**
- Create: `web/src/app/blog/tag/[name]/page.tsx`

**Interfaces:**
- Consumes: `getBlogPostsByTag()`, `BlogPostList`, `BlogRail`, `BlogShell`
- Produces: `/blog/tag/[name]` 화면. `robots: { index: false, follow: true }`

- [ ] **Step 1: 태그 화면을 만든다**

`web/src/app/blog/tag/[name]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostList } from '@/components/blog/BlogPostList';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogPostsByTag } from '@/lib/blog';

export const dynamic = 'force-dynamic';

type Params = { readonly name: string };

/**
 * 태그 페이지는 noindex 로 시작한다 (설계 9절).
 * 글 8편에 태그가 수십 개라 태그당 1~2편이고, 내용이 거의 없는 페이지가 수십 개 생기면
 * 검색엔진에 도움이 아니라 부담이다. follow 는 남겨 글로 가는 링크는 따라가게 둔다.
 * 글이 쌓이면 이 robots 만 지우면 된다.
 */
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { name } = await params;
  const tag = decodeURIComponent(name);
  return {
    title: `#${tag}`,
    robots: { index: false, follow: true },
  };
}

export default async function BlogTagPage({ params }: { readonly params: Promise<Params> }) {
  const { name } = await params;
  const tag = decodeURIComponent(name);
  const posts = await getBlogPostsByTag(tag);
  if (posts.length === 0) notFound();

  return (
    <BlogShell rail={<BlogRail />} title={`#${tag}`} category="태그">
      <div className="blog-cat-head">
        <div className="blog-crumb">
          <Link href="/">전체 글</Link> · <b>#{tag}</b>
        </div>
        <h1>#{tag}</h1>
        <span className="count">{posts.length}편</span>
      </div>
      <BlogPostList posts={posts} />
    </BlogShell>
  );
}
```

- [ ] **Step 2: 눈으로 확인한다**

| 확인 | 기대 |
|---|---|
| 레일의 태그 클릭 | 해당 태그 글 목록 |
| 글 화면의 태그 알약 클릭 | 같은 화면 |
| 페이지 소스 | `<meta name="robots" content="noindex, follow">` |
| `/tag/없는태그` | 404 |

```bash
curl -s http://blog.localhost:3000/tag/pwa | grep -o '<meta name="robots"[^>]*>'
```

- [ ] **Step 3: 정적 검사와 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

- [ ] **Step 4: 커밋**

```bash
git add web/src/app/blog/tag
git commit -m "feat(blog): add noindex tag pages"
```

---

### Task 10: 개인정보 처리방침, sitemap·robots 분리

블로그와 위키는 호스트가 다르고 sitemap 이 갈라져야 한다. 기존 `sitemap.ts` 는 모든 published 글을 `/wiki/{slug}` 로 내는데, LAB 8편은 이제 블로그 주소다.

**Files:**
- Create: `web/src/app/blog/privacy/page.tsx`
- Create: `web/src/app/blog/sitemap.ts`
- Create: `web/src/app/blog/robots.ts`
- Modify: `web/src/app/sitemap.ts`
- Modify: `web/src/components/Footer.tsx`

**Interfaces:**
- Consumes: `getBlogPosts()`, `getBlogCategories()`, `blogAbsoluteUrl`, `BLOG_ORIGIN`
- Produces: `blog.leneu.cloud/privacy`, `blog.leneu.cloud/sitemap.xml`, `blog.leneu.cloud/robots.txt`

- [ ] **Step 1: 처리방침 화면을 만든다**

`web/src/app/blog/privacy/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  alternates: { canonical: '/privacy' },
};

/**
 * 설계 8절: "악용 방지 목적의 접속 정보 사용"을 한 줄 명시한다.
 * 여기 적는 내용은 실제 구현과 일치해야 한다 —
 * 원본 IP 미저장, ip_prefix 2옥텟, ip_hash(salted SHA-256), 방문자 집합 48시간 TTL,
 * 유입 경로 3버킷. 구현이 바뀌면 이 문서도 같이 바꾼다.
 */
export default function BlogPrivacyPage() {
  return (
    <BlogShell rail={<BlogRail />} title="개인정보 처리방침">
      <article className="prose blog-art-body">
        <h1>개인정보 처리방침</h1>
        <p>
          이 블로그(blog.leneu.cloud)는 개인이 운영합니다. 회원 가입이 없고, 글을 읽는 데 어떤
          정보도 요구하지 않습니다.
        </p>

        <h2>1. 댓글을 쓸 때 남는 것</h2>
        <ul>
          <li>이름 — 입력하신 값 그대로 화면에 표시됩니다.</li>
          <li>암호 — 본인이 쓴 댓글을 삭제하기 위한 값이며, 되돌릴 수 없는 형태(BCrypt)로만 보관합니다.</li>
          <li>내용 — 입력하신 값 그대로 보관·표시됩니다.</li>
          <li>
            접속 IP — <b>원본을 저장하지 않습니다.</b> 화면 표시용으로 앞 두 자리(예: 121.135)만
            남기고, 악용 차단 목적의 대조를 위해 비밀 키를 섞어 되돌릴 수 없게 변환한 값을 함께
            보관합니다.
          </li>
        </ul>

        <h2>2. 방문 통계</h2>
        <p>
          하루 방문자 수를 세기 위해 접속 정보를 날짜와 비밀 키를 섞어 변환한 값으로 잠시(48시간)
          보관한 뒤 자동으로 지웁니다. 날짜가 섞여 있어 다음 날에는 같은 사람인지 대조할 수 없습니다.
          영구히 남는 것은 날짜별 방문 수·조회 수 같은 숫자뿐입니다.
        </p>
        <p>
          어디에서 들어왔는지는 받는 즉시 <b>검색 / SNS / 그 밖</b> 세 가지로만 분류하고 원래 주소는
          버립니다.
        </p>

        <h2>3. 보관 기간</h2>
        <p>
          댓글은 삭제하실 때까지 보관합니다. 방문자 대조용 값은 48시간 뒤 자동으로 사라집니다.
          집계 숫자는 기간 제한 없이 보관합니다.
        </p>

        <h2>4. 제3자 제공</h2>
        <p>제공하지 않습니다. 광고·분석 도구를 붙이지 않았습니다.</p>

        <h2>5. 문의</h2>
        <p>
          댓글 삭제나 문의는 <a href="https://portfolio.leneu.cloud/board">자유게시판</a>으로 남겨
          주세요.
        </p>
      </article>
    </BlogShell>
  );
}
```

- [ ] **Step 2: 블로그 sitemap·robots 를 만든다**

`web/src/app/blog/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';
import { getBlogCategories, getBlogPosts } from '@/lib/blog';
import { blogAbsoluteUrl, blogPostHref } from '@/lib/blogLinks';

export const dynamic = 'force-dynamic'; // 원본 SoT = DB

/**
 * 블로그 전용 sitemap. 위키(portfolio) sitemap 과 분리한다 — 호스트가 다르고 담는 글도 다르다.
 * 태그 페이지는 noindex 이므로 넣지 않는다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const categorySlugs = categories.flatMap((c) => [c.slug, ...c.children.map((ch) => ch.slug)]);

  return [
    { url: blogAbsoluteUrl('/') },
    { url: blogAbsoluteUrl('/privacy') },
    ...categorySlugs.map((slug) => ({
      url: blogAbsoluteUrl(`/category/${encodeURIComponent(slug)}`),
    })),
    ...posts.map((post) => ({
      url: blogAbsoluteUrl(blogPostHref(post.id, post.slug)),
      lastModified: post.publishedAt ? new Date(post.publishedAt) : undefined,
    })),
  ];
}
```

`web/src/app/blog/robots.ts`:

```ts
import type { MetadataRoute } from 'next';
import { blogAbsoluteUrl } from '@/lib/blogLinks';

/** 블로그 host 의 robots.txt. middleware 가 /robots.txt → /blog/robots.txt 로 rewrite 한다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/tag/'], // 태그 페이지는 내용이 얇아 색인하지 않는다 (설계 9절)
      },
    ],
    sitemap: blogAbsoluteUrl('/sitemap.xml'),
  };
}
```

- [ ] **Step 3: 위키 sitemap 에서 LAB 탭을 뺀다**

`web/src/app/sitemap.ts` 를 고친다. import 에 추가:

```ts
import { WIKI_CATEGORY_GROUPS } from '@/lib/wikiCategories';
```

`STATIC_PATHS` 아래에 추가:

```ts
/** LAB 탭의 글은 블로그로 옮겨졌다. 위키 sitemap 에 남기면 죽은 주소를 내보내게 된다. */
const LAB_TAB_IDS: ReadonlySet<string> = new Set(
  WIKI_CATEGORY_GROUPS.find((group) => group.id === 'lab')?.tabIds ?? [],
);
```

`articles` 계산을 바꾼다:

```ts
  const articles = tabs
    .filter((tab) => !LAB_TAB_IDS.has(tab.tabId))
    .flatMap((tab) => tab.articles)
    .filter((article) => article.status === 'published');
```

- [ ] **Step 4: 위키 푸터에 처리방침 링크를 넣는다**

`web/src/components/Footer.tsx` 전체를 바꾼다:

```tsx
import { blogAbsoluteUrl } from '@/lib/blogLinks';

export function Footer() {
  return (
    <footer>
      © 2026 jay-wiki · 위키 · 블로그 · 자유게시판 · 라이브 데모 ·{' '}
      <a href={blogAbsoluteUrl('/privacy')}>개인정보 처리방침</a> · <code>web-0.4</code>
    </footer>
  );
}
```

- [ ] **Step 5: 눈으로 확인한다**

```bash
curl -s http://blog.localhost:3000/sitemap.xml | head -30
curl -s http://blog.localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml | grep -c 'donts3p'   # 0 이어야 한다
curl -s http://localhost:3000/robots.txt | grep blog            # Disallow: /blog
```

| 확인 | 기대 |
|---|---|
| 블로그 sitemap | `https://blog.leneu.cloud/...` 만. 태그 주소 없음. 글 8편 + 카테고리 4 + `/` + `/privacy` |
| 블로그 robots | `Disallow: /tag/`, `Sitemap: https://blog.leneu.cloud/sitemap.xml` |
| 위키 sitemap | LAB 8편의 `/wiki/...` 가 없다 |
| `/privacy` 화면 | 레일이 그대로 있고 본문이 읽힌다. 레일 하단 링크로도 도달 |
| 위키 푸터 | `개인정보 처리방침` 링크가 블로그 주소로 나간다 |

- [ ] **Step 6: 정적 검사와 테스트**

```bash
cd web && npm run lint && npm run type-check && npm test
```

- [ ] **Step 7: 커밋**

```bash
git add web/src/app/blog web/src/app/sitemap.ts web/src/components/Footer.tsx
git commit -m "feat(blog): add privacy policy and split sitemap/robots per host"
```

---

### Task 11: 위키 쪽 마무리 — 301, LAB 진입, 원본 삭제

블로그가 전부 도는 것을 확인했으므로 이제 위키에서 8편을 지우고 기존 주소를 잇는다. **이 태스크는 되돌리기 어렵다.** Step 5 전에 백업을 뜬다.

**Files:**
- Modify: `web/src/app/wiki/[slug]/page.tsx`
- Modify: `web/src/lib/wikiCategories.ts`
- Modify: 위키 홈에서 LAB 카드를 렌더하는 곳 (Step 3 에서 찾는다)
- Create: `scripts/remove-migrated-lab-articles.sql`
- Modify: `docs/superpowers/specs/2026-08-02-blog-leneu-cloud-design.md`

**Interfaces:**
- Consumes: `getBlogPosts()`, `blogAbsoluteUrl`, `blogPostHref`
- Produces: `/wiki/{lab-slug}` → `https://blog.leneu.cloud/{id}/{slug}` 301

- [ ] **Step 1: 위키 글 화면에 블로그 fallback 을 넣는다**

slug → id 매핑을 하드코딩하지 않는다. 이관이 slug 를 그대로 유지했으므로 블로그 목록에서 찾으면 된다. 글이 수백 편이 되면 전용 조회 API 로 바꾼다.

`web/src/app/wiki/[slug]/page.tsx` 의 import 에 추가:

```tsx
import { permanentRedirect } from 'next/navigation';
import { getBlogPosts } from '@/lib/blog';
import { blogAbsoluteUrl, blogPostHref } from '@/lib/blogLinks';
```

파일 안(컴포넌트 위)에 헬퍼를 추가:

```tsx
/**
 * 위키에 없는 slug 면 블로그로 옮겨진 글인지 본다. LAB 8편이 그렇다.
 * 이관이 slug 를 유지했으므로 목록에서 찾는다. 매핑을 코드에 박으면 글이 늘 때마다 손대야 한다.
 */
async function migratedBlogUrl(slug: string): Promise<string | null> {
  const posts = await getBlogPosts();
  const found = posts.find((p) => p.slug === slug);
  return found ? blogAbsoluteUrl(blogPostHref(found.id, found.slug)) : null;
}
```

`generateMetadata` 의 not-found 분기를 바꾼다:

```tsx
  if (!article) {
    // 옮겨진 글이면 색인을 블로그 쪽으로 넘긴다. 여기서 제목은 알 수 없다.
    const moved = await migratedBlogUrl(slug);
    if (moved) return { title: '블로그로 옮긴 글', alternates: { canonical: moved } };
    return { title: '문서를 찾을 수 없습니다', robots: { index: false } };
  }
```

`WikiArticlePage` 의 `if (!article) notFound();` 를 바꾼다:

```tsx
  if (!article) {
    const moved = await migratedBlogUrl(slug);
    if (moved) permanentRedirect(moved);
    notFound();
  }
```

- [ ] **Step 2: 위키 카테고리에서 LAB 을 뺀다**

8편이 사라지면 LAB 그룹은 빈 껍데기가 된다. 그룹을 지우지 말고 **블로그로 보내는 진입점**으로 바꾼다. `acceptsUnmapped: true` 때문에 그룹을 지우면 매핑되지 않은 새 탭이 갈 곳을 잃는다.

`web/src/lib/wikiCategories.ts` 의 `WikiCategoryGroup` 타입에 필드를 추가:

```ts
  /** 이 그룹의 글이 다른 사이트로 옮겨졌으면 그 주소. 홈에서 카드 대신 링크로 낸다. */
  readonly externalHref?: string;
```

`lab` 그룹에 추가:

```ts
    externalHref: 'https://blog.leneu.cloud',
```

- [ ] **Step 3: 위키 대분류의 LAB 버튼을 블로그 링크로 바꾼다**

LAB 대분류는 `web/src/components/WikiShell.tsx` 의 `WIKI_CATEGORY_GROUPS.map(...)` 안에서 `<button>` 으로 그려진다(파일 235행 부근). `externalHref` 가 있는 그룹만 `<a>` 로 바꾼다. 새 CSS 를 만들지 않고 기존 클래스를 그대로 쓴다.

`{WIKI_CATEGORY_GROUPS.map((group) => { ... })}` 블록의 `return` 을 아래로 바꾼다:

```tsx
        {WIKI_CATEGORY_GROUPS.map((group) => {
          const count = articleCountForCategoryGroup(items, group);
          // 글이 다른 사이트로 옮겨진 그룹(LAB)은 탭을 펼치지 않고 그 사이트로 보낸다.
          if (group.externalHref) {
            return (
              <a key={group.id} href={group.externalHref}>
                <span className="tabs-major-code">{group.code}</span>
                <span className="tabs-major-title">{group.title} ↗</span>
              </a>
            );
          }
          return (
            <button
              key={group.id}
              type="button"
              className={activeGroup?.id === group.id ? 'active' : ''}
              aria-pressed={activeGroup?.id === group.id}
              onClick={() => selectGroup(group)}
            >
              <span className="tabs-major-code">{group.code}</span>
              <span className="tabs-major-title">{group.title}</span>
              {count > 0 && <span className="num">{count}</span>}
            </button>
          );
        })}
```

같은 파일 95~97행의 `for (const group of WIKI_CATEGORY_GROUPS)` 루프는 각 그룹의 첫 글을 찾는다. LAB 은 글이 0편이 되어 `firstSlug` 가 `undefined` 가 되는데 기존 코드가 이미 `?.` 로 처리하고 있다. 손대지 않는다.

`.tabs-primary nav > a` 에 버튼과 같은 모양이 적용되는지 확인한다. `web/src/app/styles/tabs.css` 의 선택자가 `button` 만 지정하고 있으면 그 규칙에 `, .tabs-primary a` 를 더한다. 색·크기 값은 건드리지 않는다.

- [ ] **Step 4: 삭제 전 백업**

```bash
docker exec pf-postgres pg_dump -U portfolio -d portfolio --format=custom \
  > /tmp/portfolio-before-lab-removal.dump
ls -lh /tmp/portfolio-before-lab-removal.dump
```

기대: 파일이 생기고 크기가 0 이 아니다.

- [ ] **Step 5: 원본 삭제 SQL 을 쓴다**

`scripts/remove-migrated-lab-articles.sql`:

```sql
-- 이관이 끝난 LAB 글을 위키에서 지운다. migrate-lab-articles-to-blog.sql 다음에만 실행한다.
-- 블로그에 같은 slug 가 있는 글만 지운다 — 이관되지 않은 글을 실수로 지우지 않기 위해서다.
--
-- tb_revision 에는 이 8편의 과거 스냅샷이 남는다. 위키가 문서를 지워도 이력을 보존하는
-- 기존 정책 때문이며 의도된 결과다. 블로그에 revision 을 만드는 것과는 무관하다.
begin;

select a.slug from public.tb_article a
where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
  and exists (select 1 from public.tb_blog_post p where p.slug = a.slug);

delete from public.tb_article a
where a.parent_id in ('personal-projects','team-projects','tech-lab','tools-workflow')
  and exists (select 1 from public.tb_blog_post p where p.slug = a.slug);

commit;
```

실행:

```bash
docker exec -i pf-postgres psql -U portfolio -d portfolio -v ON_ERROR_STOP=1 \
  < scripts/remove-migrated-lab-articles.sql
```

기대: select 가 8행, `DELETE 8`.

- [ ] **Step 6: 301 과 위키 화면을 확인한다**

```bash
curl -sI http://localhost:3000/wiki/donts3p-macos-sleep-assertion-app | head -5
```

기대: `308` 과 `location: https://blog.leneu.cloud/...`.

| 확인 | 기대 |
|---|---|
| `/wiki/donts3p-macos-sleep-assertion-app` | 블로그 주소로 이동 |
| `/wiki/없는슬러그` | 404 그대로 |
| `/wiki/redis` 같은 일반 글 | 정상 |
| 위키 홈 | LAB 카드가 blog.leneu.cloud 링크가 되어 있고 글 수 0 으로 남지 않는다 |
| `/search` 에서 `donts3p` | 결과 없음(설계 결정대로 블로그 글은 검색 대상 밖) |
| 블로그 목록 | 여전히 8편 |
| 블로그 글 본문의 내부 링크 | orca 글 안의 donts3p 링크가 `/{id}/donts3p-...` 로 간다 |

- [ ] **Step 7: 설계 문서를 결정대로 고친다**

`docs/superpowers/specs/2026-08-02-blog-leneu-cloud-design.md`:

- §9 첫 두 줄을 바꾼다:

```markdown
- 위키 검색(`/search`)은 **위키 글만** 찾는다. LAB 8편은 `tb_article` 에서 지워지므로 인덱스에도 없다
- 블로그 전용 검색은 이번 범위 밖. 그때까지 블로그 글은 검색으로 찾을 수 없다
  (2026-08-02 결정. 원래 §9 는 "검색이 전체를 찾는다"였으나 §10-3 의 원본 삭제와 양립하지 않았다)
```

- §12 표의 두 행을 바꾼다:

```markdown
| 상단 제목 바 구성 (카테고리·제목·위로 유지 여부) | **확정: 셋 다 유지** (2026-08-02) |
| 인기 글 기준 | **확정: `view_count` 내림차순** (2026-08-02). V14 가 이미 올리고 있다 |
```

- [ ] **Step 8: 전체 검사**

```bash
cd web && npm run lint && npm run type-check && npm test
cd ../spring/jaywiki && ./gradlew test
```

기대: 웹 전부 통과, Spring 141개 통과.

- [ ] **Step 9: 커밋**

```bash
git add web/src/app/wiki web/src/lib/wikiCategories.ts web/src/app scripts/remove-migrated-lab-articles.sql \
        docs/superpowers/specs/2026-08-02-blog-leneu-cloud-design.md
git commit -m "feat(blog): redirect migrated wiki URLs and retire LAB tabs"
```

---

## 이 계획을 마치면

- `blog.localhost:3000` 에서 블로그 전체가 돌고, 위키는 그대로다.
- **아직 안 된 것**: 실제 `blog.leneu.cloud` 연결. [docs/blog-subdomain-setup-runbook.md](../../blog-subdomain-setup-runbook.md) 를 실행한다.
  **middleware 가 배포된 뒤에만** runbook 2~4단계를 한다.
- **배포 전에 반드시**: `scripts/ensure-blog-comment-salt-secret.sh` 를 먼저 돌린다. salt 가 없으면 운영 기동이 실패한다(그렇게 설계했다).
- **다음 라운드(관리자 화면)**: 카테고리 트리 편집(드래그 정렬), 글 작성, 통계 대시보드.
  그때 먼저 고쳐야 할 것 — `attachReferenced()` 가 블로그 저장에 안 불린다. 블로그 전용 자산이 `TEMP` 로 남고,
  TEMP 정리 작업을 먼저 만들면 블로그 이미지가 쓸려나간다. 자세한 미뤄둔 목록은 인수인계 문서에 있다.
- 이 라운드에서 새로 미뤄둔 것:
  - `BlogController.byTag()` 가 전체 목록을 읽어 메모리에서 거른다(기존 항목). 태그 화면이 이제 그 경로를 쓴다.
  - `/wiki/[slug]` 의 블로그 fallback 도 목록 전체를 읽는다. 글이 수백 편이 되면 slug 조회 API 로 바꾼다.
  - 목록 썸네일 경로는 만들었지만 데이터가 없다(이관 8편에 이미지가 0건). 관리자 화면에서 대표 이미지를
    지정할 수 있게 되면 그때 실제 렌더를 확인한다.
