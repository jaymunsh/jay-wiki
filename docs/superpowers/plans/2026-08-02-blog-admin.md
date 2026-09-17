# 블로그 관리자 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `portfolio.leneu.cloud/admin/blog/*` 에 글·카테고리·댓글·통계 관리 화면 다섯을 만들어, 블로그를 읽기 전용에서 **글을 쓸 수 있는 상태**로 바꾼다.

**Architecture:** 관리 화면은 블로그 host 가 아니라 기존 관리자 영역에 둔다(설계 3절의 쿠키 경계를 그대로 쓰기 위해). 백엔드는 `/api/admin/blog/**` 에 붙이고 **SecurityConfig 에 명시 규칙을 먼저 넣는다** — 지금 `GET /api/**` 가 전부 공개라 그대로 두면 draft 가 샌다. 웹은 서버 컴포넌트가 `jw_token` 쿠키를 실어 Spring 을 직접 읽는다.

**Tech Stack:** Spring Boot 3 + JPA, PostgreSQL 18, Next.js 15(App Router, Server Actions), TypeScript, vitest(node), Flyway.

## 선행 문서

- 설계(정본): [docs/superpowers/specs/2026-08-02-blog-admin-design.md](../specs/2026-08-02-blog-admin-design.md)
- 블로그 설계: [docs/superpowers/specs/2026-08-02-blog-leneu-cloud-design.md](../specs/2026-08-02-blog-leneu-cloud-design.md)
- 프론트 계획(완료): [docs/superpowers/plans/2026-08-02-blog-frontend.md](./2026-08-02-blog-frontend.md)
- 인수인계: [docs/blog-work-handoff.md](../../blog-work-handoff.md)

## 계획을 쓰면서 확인한 제약 — 설계 문서보다 이쪽이 정확하다

코드를 읽고 설계 문서 8절(API)을 두 군데 고쳐야 함을 확인했다.

**1. `GET /api/**` 가 전부 공개다.** `SecurityConfig` 44행이
`.requestMatchers(HttpMethod.GET, "/api/**").permitAll()` 이고, 53행의
`.requestMatchers("/api/**").hasRole("ADMIN")` 보다 **앞에 있다.**
그대로 두면 `/api/admin/blog/posts` 가 인증 없이 읽혀 **draft 가 공개된다.**
Task 1 에서 `/api/admin/blog/**` 규칙을 GET 공개 규칙 **위에** 넣는다.

**2. 규칙을 넓게 잡으면 기존 화면이 조용히 깨진다.** `getAdminServices()` 는
`web/src/lib/api.ts` 의 `get()` 을 쓰는데 **쿠키를 싣지 않는다.** 실패하면 `catch` 로 `[]` 를
돌려주므로 화면이 오류 없이 빈 목록이 된다. 그래서 `/api/admin/**` 을 통째로 잠그지 않고
**`/api/admin/blog/**` 만** 잠그고, 블로그 관리 화면은 처음부터 쿠키를 싣는 별도 클라이언트를 쓴다.

> **이번 범위 밖으로 남기는 기존 문제**: `GET /api/admin/services` 가 지금 공개다.
> 서비스 replica 수를 돌려주는 운영 패널용이라 민감도는 낮지만 열려 있는 것은 맞다.
> 닫으려면 `/admin/services` 서버 컴포넌트가 쿠키를 싣도록 같이 고쳐야 해서 이 라운드에서 건드리지 않는다.
> 인수인계 문서의 미뤄둔 목록에 올린다.

## Global Constraints

- **새 색·새 폰트 크기를 만들지 않는다.** `tokens.css` 의 토큰만 쓴다. 하한은 `--fs-2xs`(11px).
- 관리자 CSS 는 **기존 `web/src/app/styles/admin.css` 에 이어 붙인다.** 새 파일을 만들지 않는다.
  기존 `.editor-*` `.al-*` `.admin-*` 클래스를 최대한 재사용하고, 블로그 전용은 `.badm-` 접두사를 쓴다.
- **새 npm 의존성을 넣지 않는다.** 드래그는 HTML5 drag and drop, 차트는 div 높이로 그린다.
- 관리 화면의 서버 컴포넌트는 **반드시 `@/lib/blogAdmin` 을 쓴다**(쿠키를 싣는다).
  `@/lib/blog`(공개용)를 관리 화면에서 쓰지 않는다 — draft 가 안 보이고 조회수가 오른다.
- **관리자 단건 조회는 `recordView` 를 부르지 않는다.** 부르면 글을 열어볼 때마다 조회수가 오른다.
- `web` 테스트는 `npm test`(vitest, **node 환경 — DOM 이 없다**). 판정 로직을 순수 함수로 빼서 테스트한다.
- 검사: `cd web && npm run lint && npm run type-check && npm test`.
  **`lint` 는 `--max-warnings 8` 이고 지금 정확히 8개다. 새 경고를 하나라도 늘리면 실패한다.**
- Spring: `cd spring/jaywiki && ./gradlew test`. **기준선 141개 통과.**
- 커밋은 각 태스크의 마지막 스텝에서만. 브랜치는 `feat/blog-backend` 를 그대로 쓴다.
- Flyway 번호는 추가 직전에 `ls spring/jaywiki/src/main/resources/db/migration | sort -V | tail -3` 으로 실제 최대값을 확인한다. 이 계획을 쓰는 시점의 최대는 `V14` 다.

## 실행 전 확인

```bash
git branch --show-current                # feat/blog-backend
docker ps --format '{{.Names}}'          # pf-postgres, pf-redis, pf-opensearch
cd spring/jaywiki && ./gradlew test       # 141개
cd web && npm run lint && npm test        # 경고 8개, 테스트 44개
```

로컬 실행:

```bash
cd spring/jaywiki && SPRING_PROFILES_ACTIVE=local APP_KAFKA_DEMO_ENABLED=true ./gradlew bootRun
cd web && npm run dev    # 관리자는 http://localhost:3000/admin (블로그 host 아님)
```

관리자 로그인은 `admin` / `admin1234`(로컬 기본값).

## 파일 구조

| 파일 | 책임 |
|---|---|
| `spring/.../auth/SecurityConfig.java` | (수정) `/api/admin/blog/**` 규칙 |
| `spring/.../blog/BlogAdminController.java` | 글 관리 API |
| `spring/.../blog/BlogAdminCategoryController.java` | 카테고리 관리 API |
| `spring/.../blog/BlogAdminCommentController.java` | 댓글 관리 API |
| `spring/.../blog/BlogAdminStatsController.java` | 통계 조회 API |
| `spring/.../blog/dto/BlogPostSaveRequest.java` | 글 저장 요청 |
| `spring/.../blog/dto/BlogAdminPostDto.java` | 관리 목록·단건(draft 포함) |
| `spring/.../blog/BlogReferrerSource.java` | 유입 소스 세분화(기존 `BlogReferrerBucket` 대체 아님, 확장) |
| `spring/.../db/migration/V15__blog_stats_detail.sql` | 유입·디바이스 세로 테이블 |
| `web/src/lib/blogAdmin.ts` | 쿠키를 싣는 관리 API 클라이언트 |
| `web/src/lib/blogAdminActions.ts` | 저장·삭제 Server Action |
| `web/src/lib/blogAdminForm.ts` | 순수 함수(태그 파싱, 발행일 기본값 등) + 테스트 |
| `web/src/components/MarkdownBodyEditor.tsx` | 위키·블로그가 공유하는 본문 편집 코어 |
| `web/src/components/blog/admin/BlogPostForm.tsx` | 글 편집 폼 |
| `web/src/components/blog/admin/CategoryTreeEditor.tsx` | 드래그 정렬 트리 |
| `web/src/app/admin/blog/posts/**` | 글 목록·편집 화면 |
| `web/src/app/admin/blog/categories/page.tsx` | 카테고리 관리 |
| `web/src/app/admin/blog/comments/page.tsx` | 댓글 관리 |
| `web/src/app/admin/blog/stats/page.tsx` | 통계 대시보드 |
| `web/src/app/admin/layout.tsx` | (수정) 사이드바 두 묶음 |

---

### Task 1: 관리자 API 경계와 글 조회 API

가장 먼저 보안 규칙을 세운다. 뒤 태스크가 전부 이 경계 위에 얹힌다.

**Files:**
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/auth/SecurityConfig.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogAdminPostDto.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogAdminController.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostService.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostRepository.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogAdminApiTest.java`

**Interfaces:**
- Produces:
  - `GET /api/admin/blog/posts` → `List<BlogAdminPostDto>` (draft 포함)
  - `GET /api/admin/blog/posts/{id}` → `BlogAdminPostDto` (draft 포함, 조회수 안 오름)
  - `BlogAdminPostDto(id, slug, title, summary, body, categoryId, categorySlug, categoryName, coverAssetId, status, publishedAt, updatedAt, viewCount, tags)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogAdminApiTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 관리 API 는 ADMIN 만 읽는다. GET /api/** 가 전부 공개라 명시 규칙이 없으면 draft 가 샌다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogAdminApiTest {

    @Autowired MockMvc mvc;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;

    private Long draftId;

    @BeforeEach
    void setUp() {
        BlogPost draft = new BlogPost();
        draft.setSlug("admin-draft");
        draft.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        draft.setTitle("아직 공개하지 않은 글");
        draft.setBody("본문");
        draft.setStatus("draft");
        draft.setCreatedAt(OffsetDateTime.now());
        draft.setUpdatedAt(OffsetDateTime.now());
        draftId = posts.save(draft).getId();
    }

    @AfterEach
    void tearDown() {
        posts.deleteById(draftId);
    }

    @Test
    void 인증_없이는_관리_목록을_읽을_수_없다() throws Exception {
        mvc.perform(get("/api/admin/blog/posts"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 관리자는_draft_를_본다() throws Exception {
        mvc.perform(get("/api/admin/blog/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='admin-draft')].status").value("draft"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 관리자_단건_조회는_조회수를_올리지_않는다() throws Exception {
        long before = posts.findById(draftId).orElseThrow().getViewCount();
        mvc.perform(get("/api/admin/blog/posts/" + draftId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("아직 공개하지 않은 글"));
        long after = posts.findById(draftId).orElseThrow().getViewCount();
        org.assertj.core.api.Assertions.assertThat(after).isEqualTo(before);
    }

    @Test
    void 공개_목록에는_draft_가_없다() throws Exception {
        mvc.perform(get("/api/blog/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='admin-draft')]").isEmpty());
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test --tests '*BlogAdminApiTest'
```

기대: 네 개 중 셋 실패(404). `공개_목록에는_draft_가_없다` 만 통과.

- [ ] **Step 3: 보안 규칙을 넣는다**

`SecurityConfig.java` 에서 `.requestMatchers(HttpMethod.GET, "/api/**").permitAll()` **바로 위**에 추가한다. 순서가 핵심이다.

```java
                // 아래의 GET /api/** 공개 규칙보다 먼저 와야 한다.
                // 뒤에 두면 관리 목록이 인증 없이 읽혀 draft 가 공개된다.
                .requestMatchers("/api/admin/blog/**").hasRole("ADMIN")
```

- [ ] **Step 4: DTO 를 만든다**

`blog/dto/BlogAdminPostDto.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** 관리 화면용. 공개 DTO 와 달리 draft 와 본문·조회수를 함께 담는다. */
public record BlogAdminPostDto(
        Long id,
        String slug,
        String title,
        String summary,
        String body,
        Long categoryId,
        String categorySlug,
        String categoryName,
        String coverAssetId,
        String status,
        OffsetDateTime publishedAt,
        OffsetDateTime updatedAt,
        long viewCount,
        List<String> tags
) {
}
```

- [ ] **Step 5: 리포지토리와 서비스에 관리 조회를 넣는다**

`BlogPostRepository.java` 에 추가:

```java
    /** 관리 목록. draft 가 위로 오도록 상태 → 최신 순으로 준다. */
    @Query("""
        select p from BlogPost p
        order by case when p.status = 'draft' then 0 else 1 end,
                 coalesce(p.publishedAt, p.updatedAt) desc, p.id desc
        """)
    List<BlogPost> findAllForAdmin();
```

`BlogPostService.java` 에 추가(import 에 `BlogAdminPostDto` 추가):

```java
    /** 관리 목록. draft 를 포함한다. */
    @Transactional(readOnly = true)
    public List<BlogAdminPostDto> adminList() {
        Map<Long, BlogCategory> byId = categoryIndex();
        return posts.findAllForAdmin().stream().map(p -> toAdminDto(p, byId)).toList();
    }

    /** 관리 단건. 조회수를 올리지 않는다 — 열어볼 때마다 오르면 통계가 망가진다. */
    @Transactional(readOnly = true)
    public BlogAdminPostDto adminGet(Long id) {
        BlogPost post = posts.findById(id)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        return toAdminDto(post, categoryIndex());
    }

    private BlogAdminPostDto toAdminDto(BlogPost post, Map<Long, BlogCategory> byId) {
        BlogCategory category = byId.get(post.getCategoryId());
        return new BlogAdminPostDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(), post.getBody(),
                post.getCategoryId(),
                category == null ? null : category.getSlug(),
                category == null ? null : category.getName(),
                post.getCoverAssetId(), post.getStatus(), post.getPublishedAt(),
                post.getUpdatedAt(), post.getViewCount(), tagService.namesOf(post.getId()));
    }
```

- [ ] **Step 6: 컨트롤러를 만든다**

`blog/BlogAdminController.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminPostDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 블로그 글 관리. SecurityConfig 가 /api/admin/blog/** 를 ADMIN 으로 묶는다.
 * 그 규칙은 GET /api/** 공개 규칙보다 앞에 있어야 한다.
 */
@RestController
@RequestMapping("/api/admin/blog")
@RequiredArgsConstructor
public class BlogAdminController {

    private final BlogPostService postService;

    @GetMapping("/posts")
    public List<BlogAdminPostDto> posts() {
        return postService.adminList();
    }

    @GetMapping("/posts/{id}")
    public BlogAdminPostDto post(@PathVariable Long id) {
        return postService.adminGet(id);
    }
}
```

- [ ] **Step 7: 통과를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test
```

기대: 145개 통과, 실패 0.

- [ ] **Step 8: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog-admin): add admin post read API behind an explicit ADMIN rule"
```

---

### Task 2: 글 저장·삭제 API 와 자산 부착

**설계 5절의 선행 수정이 여기에 들어간다.** 저장 경로를 만드는 이 태스크에서 `attachReferenced()` 를 같이 넣는다. 나중으로 미루면 블로그 이미지가 `TEMP` 로 남는다.

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogPostSaveRequest.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostService.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogAdminController.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogAdminApiTest.java`

**Interfaces:**
- Consumes: `WikiAssetService.attachReferenced(String markdown)`, `BlogTagService.attach(Long, List<String>)`, `BlogCategoryService`
- Produces:
  - `POST /api/admin/blog/posts` → `BlogAdminPostDto`
  - `PUT /api/admin/blog/posts/{id}` → `BlogAdminPostDto`
  - `DELETE /api/admin/blog/posts/{id}` → 204
  - `BlogPostSaveRequest(slug, title, summary, body, categoryId, coverAssetId, status, publishedAt, tags)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`BlogAdminApiTest` 에 추가한다. import 에 `post`, `put`, `delete`, `MediaType` 를 더한다.

```java
    @Test
    @WithMockUser(roles = "ADMIN")
    void published_로_저장할_때_발행일이_비면_지금_시각을_넣는다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String created = mvc.perform(post("/api/admin/blog/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"auto-published-at","title":"발행일 없이 발행",
                                 "body":"본문","categoryId":%d,"status":"published","tags":["a","b"]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publishedAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        extraPostId = Long.parseLong(created.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 태그는_저장하면서_정규화된다() throws Exception {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String created = mvc.perform(post("/api/admin/blog/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"with-tags","title":"태그 글","body":"본문",
                                 "categoryId":%d,"status":"draft","tags":["kotlin","spring"]}
                                """.formatted(categoryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andReturn().getResponse().getContentAsString();
        extraPostId = Long.parseLong(created.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 없는_카테고리로_저장하면_404() throws Exception {
        mvc.perform(post("/api/admin/blog/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"bad-category","title":"제목","body":"본문",
                                 "categoryId":999999,"status":"draft"}
                                """))
                .andExpect(status().isNotFound());
    }
```

필드와 정리도 추가한다.

```java
    /** 저장 테스트가 만드는 글. 자기가 만든 것은 자기가 지운다. */
    private Long extraPostId;
```

`tearDown()` 에 추가:

```java
        if (extraPostId != null) {
            posts.deleteById(extraPostId);
            extraPostId = null;
        }
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test --tests '*BlogAdminApiTest'
```

기대: 새 테스트 셋이 405 또는 404 로 실패.

- [ ] **Step 3: 요청 DTO 를 만든다**

`blog/dto/BlogPostSaveRequest.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 글 저장 요청. publishedAt 은 비워 보낼 수 있다 —
 * status 가 published 인데 비어 있으면 서버가 지금 시각을 넣는다.
 * V13 의 chk_blog_post_published_at 이 published + null 을 막기 때문이다.
 */
public record BlogPostSaveRequest(
        String slug,
        String title,
        String summary,
        String body,
        Long categoryId,
        String coverAssetId,
        String status,
        OffsetDateTime publishedAt,
        List<String> tags
) {
}
```

- [ ] **Step 4: 서비스에 저장을 넣는다**

`BlogPostService.java` 의 import 에 추가:

```java
import cloud.leneu.jaywiki.blog.dto.BlogPostSaveRequest;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.wiki.asset.WikiAssetService;
```

생성자 주입 필드에 추가:

```java
    private final WikiAssetService assetService;
```

메서드를 추가한다:

```java
    private static final String DRAFT = "draft";

    @Transactional
    public BlogAdminPostDto create(BlogPostSaveRequest request) {
        BlogPost post = new BlogPost();
        post.setCreatedAt(OffsetDateTime.now());
        return save(post, request);
    }

    @Transactional
    public BlogAdminPostDto update(Long id, BlogPostSaveRequest request) {
        BlogPost post = posts.findById(id)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        return save(post, request);
    }

    @Transactional
    public void delete(Long id) {
        if (!posts.existsById(id)) {
            throw new NotFoundException("blog post not found: " + id);
        }
        posts.deleteById(id); // 댓글·태그 연결은 on delete cascade 로 함께 사라진다
    }

    private BlogAdminPostDto save(BlogPost post, BlogPostSaveRequest request) {
        if (request.title() == null || request.title().isBlank()) {
            throw new BadRequestException("title is required");
        }
        if (request.body() == null || request.body().isBlank()) {
            throw new BadRequestException("body is required");
        }
        String status = PUBLISHED.equals(request.status()) ? PUBLISHED : DRAFT;
        BlogCategory category = categories.findById(request.categoryId() == null ? -1L : request.categoryId())
                .orElseThrow(() -> new NotFoundException("blog category not found: " + request.categoryId()));

        post.setSlug(request.slug() == null || request.slug().isBlank()
                ? "post-" + OffsetDateTime.now().toEpochSecond() : request.slug().trim());
        post.setTitle(request.title().trim());
        post.setSummary(request.summary());
        post.setBody(request.body());
        post.setCategoryId(category.getId());
        post.setCoverAssetId(request.coverAssetId());
        post.setStatus(status);
        // published 인데 발행일이 비면 지금 시각을 넣는다.
        // 넣지 않으면 V13 의 CHECK 제약 위반이 그대로 500 으로 나간다.
        post.setPublishedAt(PUBLISHED.equals(status)
                ? (request.publishedAt() == null ? OffsetDateTime.now() : request.publishedAt())
                : request.publishedAt());
        post.setUpdatedAt(OffsetDateTime.now());

        BlogPost saved = posts.save(post);
        tagService.attach(saved.getId(), request.tags() == null ? List.of() : request.tags());
        // 본문이 참조하는 자산을 TEMP 에서 떼어낸다. 이걸 빠뜨리면 TEMP 정리 작업이
        // 생기는 순간 블로그 이미지가 쓸려나간다(관리자 설계 5절).
        assetService.attachReferenced(saved.getBody());
        return adminGet(saved.getId());
    }
```

- [ ] **Step 5: 컨트롤러에 쓰기 엔드포인트를 넣는다**

`BlogAdminController.java` 의 import 에 `BlogPostSaveRequest`, `PostMapping`, `PutMapping`, `DeleteMapping`, `RequestBody`, `ResponseEntity` 를 추가하고 메서드를 더한다.

```java
    @PostMapping("/posts")
    public BlogAdminPostDto create(@RequestBody BlogPostSaveRequest body) {
        return postService.create(body);
    }

    @PutMapping("/posts/{id}")
    public BlogAdminPostDto update(@PathVariable Long id, @RequestBody BlogPostSaveRequest body) {
        return postService.update(id, body);
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        postService.delete(id);
        return ResponseEntity.noContent().build();
    }
```

- [ ] **Step 6: 자산 부착을 눈으로 확인한다**

백엔드를 띄우고, 이미지를 하나 올린 뒤 그 경로를 본문에 넣어 저장한다.

```bash
docker exec pf-postgres psql -U portfolio -d portfolio -Atc \
  "select id, status from public.tb_article_asset order by created_at desc limit 5;"
```

기대: 방금 저장한 글이 참조하는 자산의 status 가 `TEMP` 가 아니다.

- [ ] **Step 7: 통과를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test
```

기대: 148개 통과, 실패 0.

- [ ] **Step 8: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog-admin): add post save API and attach referenced assets"
```

---

### Task 3: 카테고리 관리 API

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogAdminCategoryController.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCategoryService.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogAdminCategoryTest.java`

**Interfaces:**
- Consumes: 기존 `BlogCategoryService.create(slug, name, description, parentId, sortOrder)` — 2단 검증이 이미 들어 있다
- Produces:
  - `POST /api/admin/blog/categories` → `BlogCategoryDto`
  - `PUT /api/admin/blog/categories/{id}` → `BlogCategoryDto` (이름·설명만)
  - `POST /api/admin/blog/categories/reorder` — 본문 `{"ids":[3,1,2]}` 순서대로 `sort_order` 0..n
  - `DELETE /api/admin/blog/categories/{id}` → 204, 글이 있으면 400

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`BlogAdminCategoryTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogAdminCategoryTest {

    @Autowired MockMvc mvc;
    @Autowired BlogCategoryRepository categories;

    @Test
    @WithMockUser(roles = "ADMIN")
    void 글이_있는_카테고리는_지울_수_없다() throws Exception {
        // tech-lab 에는 이관된 글이 있다(로컬 기준). 없으면 이 테스트는 의미가 없으므로
        // 글이 있는 카테고리를 찾아 쓴다.
        Long id = categories.findBySlug("tech-lab").orElseThrow().getId();
        mvc.perform(delete("/api/admin/blog/categories/" + id))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 손자_카테고리는_만들_수_없다() throws Exception {
        Long parentId = categories.findBySlug("tech-lab").orElseThrow().getId();
        String child = mvc.perform(post("/api/admin/blog/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"child-cat","name":"자식","parentId":%d}
                                """.formatted(parentId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long childId = Long.parseLong(child.replaceAll(".*\"id\":(\\d+).*", "$1"));

        try {
            mvc.perform(post("/api/admin/blog/categories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"slug":"grandchild-cat","name":"손자","parentId":%d}
                                    """.formatted(childId)))
                    .andExpect(status().isBadRequest());
        } finally {
            categories.deleteById(childId);
        }
    }

    @Test
    void 인증_없이는_카테고리를_만들_수_없다() throws Exception {
        mvc.perform(post("/api/admin/blog/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"nope\",\"name\":\"아니오\"}"))
                .andExpect(status().is4xxClientError());
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test --tests '*BlogAdminCategoryTest'
```

기대: 404 로 실패.

- [ ] **Step 3: 서비스에 수정·정렬·삭제를 넣는다**

`BlogCategoryService.java` 에 추가한다(import 에 `BadRequestException` 이 없으면 추가).

```java
    @Transactional
    public BlogCategory rename(Long id, String name, String description) {
        BlogCategory category = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("blog category not found: " + id));
        if (name == null || name.isBlank()) {
            throw new BadRequestException("name is required");
        }
        category.setName(name.trim());
        category.setDescription(description);
        return repo.save(category);
    }

    /** 받은 순서대로 sort_order 를 0부터 다시 매긴다. 형제 안에서만 쓴다. */
    @Transactional
    public void reorder(List<Long> ids) {
        for (int i = 0; i < ids.size(); i++) {
            Long id = ids.get(i);
            BlogCategory category = repo.findById(id)
                    .orElseThrow(() -> new NotFoundException("blog category not found: " + id));
            category.setSortOrder(i);
            repo.save(category);
        }
    }

    @Transactional
    public void delete(Long id) {
        BlogCategory category = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("blog category not found: " + id));
        long postCount = posts.countByCategoryId(id);
        if (postCount > 0) {
            // on delete restrict 가 어차피 막지만, DB 오류 메시지를 그대로 내보내지 않는다.
            throw new BadRequestException(
                    "글 " + postCount + "편이 있어 지울 수 없습니다. 먼저 글을 옮겨 주세요.");
        }
        if (repo.findAllByOrderBySortOrderAsc().stream()
                .anyMatch(c -> id.equals(c.getParentId()))) {
            throw new BadRequestException("하위 카테고리가 있어 지울 수 없습니다.");
        }
        repo.delete(category);
    }
```

`BlogPostRepository.java` 에 추가:

```java
    long countByCategoryId(Long categoryId);
```

- [ ] **Step 4: 컨트롤러를 만든다**

`blog/BlogAdminCategoryController.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/blog/categories")
@RequiredArgsConstructor
public class BlogAdminCategoryController {

    private final BlogCategoryService service;

    public record CreateRequest(String slug, String name, String description, Long parentId, Integer sortOrder) {
    }

    public record RenameRequest(String name, String description) {
    }

    public record ReorderRequest(List<Long> ids) {
    }

    /** 생성. 2단 제약은 서비스가 강제한다(부모의 parentId 가 null 인지 검사). */
    @PostMapping
    public BlogCategory create(@RequestBody CreateRequest body) {
        return service.create(body.slug(), body.name(), body.description(), body.parentId(),
                body.sortOrder() == null ? 0 : body.sortOrder());
    }

    @PutMapping("/{id}")
    public BlogCategory rename(@PathVariable Long id, @RequestBody RenameRequest body) {
        return service.rename(id, body.name(), body.description());
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorder(@RequestBody ReorderRequest body) {
        service.reorder(body.ids());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** 관리 화면은 글 수까지 필요하므로 공개 트리를 그대로 쓴다. */
    @org.springframework.web.bind.annotation.GetMapping
    public List<BlogCategoryDto> tree() {
        return service.tree();
    }
}
```

- [ ] **Step 5: 통과를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test
```

기대: 151개 통과, 실패 0.

- [ ] **Step 6: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog-admin): add category create, rename, reorder and delete API"
```

---

### Task 4: 댓글 관리 API

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogAdminCommentController.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCommentService.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCommentRepository.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogAdminCommentDto.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogAdminCommentTest.java`

**Interfaces:**
- Produces:
  - `GET /api/admin/blog/comments?deleted=false` → `List<BlogAdminCommentDto>`
  - `DELETE /api/admin/blog/comments/{id}` → 204 (암호 없이, soft delete)
  - `POST /api/admin/blog/comments/{id}/restore` → 204
  - `BlogAdminCommentDto(id, postId, postTitle, authorName, ipPrefix, body, createdAt, deletedAt)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`BlogAdminCommentTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogAdminCommentTest {

    @Autowired MockMvc mvc;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired BlogCommentRepository comments;

    private Long postId;
    private Long commentId;

    @BeforeEach
    void setUp() {
        BlogPost post = new BlogPost();
        post.setSlug("comment-admin-post");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("댓글 관리 대상 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.now());
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();

        BlogComment comment = new BlogComment();
        comment.setPostId(postId);
        comment.setAuthorName("지나가던개발자");
        comment.setPasswordHash("{noop}x");
        comment.setBody("관리 대상 댓글");
        comment.setIpPrefix("121.135");
        comment.setIpHash("hash");
        comment.setCreatedAt(OffsetDateTime.now());
        commentId = comments.save(comment).getId();
    }

    @AfterEach
    void tearDown() {
        posts.deleteById(postId); // 댓글은 on delete cascade 로 함께 사라진다
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 관리자는_암호_없이_지우고_되살린다() throws Exception {
        mvc.perform(delete("/api/admin/blog/comments/" + commentId))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/blog/posts/" + postId + "/comments"))
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(get("/api/admin/blog/comments").param("deleted", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + commentId + ")]").isNotEmpty());

        mvc.perform(post("/api/admin/blog/comments/" + commentId + "/restore"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/blog/posts/" + postId + "/comments"))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void 목록은_글_제목을_함께_준다() throws Exception {
        mvc.perform(get("/api/admin/blog/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + commentId + ")].postTitle")
                        .value("댓글 관리 대상 글"));
    }

    @Test
    void 인증_없이는_관리_댓글_목록을_못_읽는다() throws Exception {
        mvc.perform(get("/api/admin/blog/comments"))
                .andExpect(status().is4xxClientError());
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test --tests '*BlogAdminCommentTest'
```

- [ ] **Step 3: DTO 와 리포지토리를 만든다**

`blog/dto/BlogAdminCommentDto.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;

/**
 * 관리 화면용 댓글. ipPrefix 는 앞 2옥텟이고 원본 IP 는 DB 에도 없다.
 * 화면은 121.135.*.* 형태로 보여준다 — 뒤 두 옥텟은 애초에 저장하지 않았다.
 */
public record BlogAdminCommentDto(
        Long id,
        Long postId,
        String postTitle,
        String authorName,
        String ipPrefix,
        String body,
        OffsetDateTime createdAt,
        OffsetDateTime deletedAt
) {
}
```

`BlogCommentRepository.java` 에 추가:

```java
    List<BlogComment> findByDeletedAtIsNullOrderByCreatedAtDesc();

    List<BlogComment> findByDeletedAtIsNotNullOrderByDeletedAtDesc();
```

- [ ] **Step 4: 서비스에 관리 동작을 넣는다**

`BlogCommentService.java` 에 추가한다(`BlogPostRepository` 주입이 없으면 필드에 더한다).

```java
    @Transactional(readOnly = true)
    public List<BlogAdminCommentDto> adminList(boolean deleted) {
        List<BlogComment> found = deleted
                ? repo.findByDeletedAtIsNotNullOrderByDeletedAtDesc()
                : repo.findByDeletedAtIsNullOrderByCreatedAtDesc();
        Map<Long, String> titles = posts.findAll().stream()
                .collect(Collectors.toMap(BlogPost::getId, BlogPost::getTitle));
        return found.stream()
                .map(c -> new BlogAdminCommentDto(
                        c.getId(), c.getPostId(), titles.get(c.getPostId()),
                        c.getAuthorName(), c.getIpPrefix(), c.getBody(),
                        c.getCreatedAt(), c.getDeletedAt()))
                .toList();
    }

    /** 관리자 삭제. 암호를 묻지 않는다. soft delete 라 휴지통에서 되살릴 수 있다. */
    @Transactional
    public void adminDelete(Long commentId) {
        BlogComment comment = repo.findById(commentId)
                .orElseThrow(() -> new NotFoundException("blog comment not found: " + commentId));
        comment.setDeletedAt(OffsetDateTime.now());
        repo.save(comment);
    }

    @Transactional
    public void restore(Long commentId) {
        BlogComment comment = repo.findById(commentId)
                .orElseThrow(() -> new NotFoundException("blog comment not found: " + commentId));
        comment.setDeletedAt(null);
        repo.save(comment);
    }
```

- [ ] **Step 5: 컨트롤러를 만든다**

`blog/BlogAdminCommentController.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminCommentDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/blog/comments")
@RequiredArgsConstructor
public class BlogAdminCommentController {

    private final BlogCommentService service;

    @GetMapping
    public List<BlogAdminCommentDto> list(@RequestParam(defaultValue = "false") boolean deleted) {
        return service.adminList(deleted);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.adminDelete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Void> restore(@PathVariable Long id) {
        service.restore(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 6: 통과를 확인하고 커밋**

```bash
cd spring/jaywiki && ./gradlew test
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog-admin): add comment moderation API with trash and restore"
```

---

### Task 5: 통계 보강 — 유입 세분화와 디바이스

설계 7절. **원본 URL 과 User-Agent 원문은 계속 저장하지 않는다.** 호스트에서 뽑은 소스 이름과 모바일 여부 boolean 만 센다.

**Files:**
- Create: `spring/jaywiki/src/main/resources/db/migration/V15__blog_stats_detail.sql`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogReferrerSource.java`
- Create: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogReferrerSourceTest.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogStatsService.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogController.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogAdminStatsController.java`

**Interfaces:**
- Produces:
  - `BlogReferrerSource.of(String referer)` → `"google" | "naver" | ... | "sns:x" | "direct" | "other"`
  - `BlogStatsService.recordView(postId, clientIp, referer, userAgent)` — **인자가 하나 늘어난다**
  - `GET /api/admin/blog/stats/daily?days=30` → `List<DailyPoint(date, views, visitors)>`
  - `GET /api/admin/blog/stats/referrers?days=30` → `List<SourceCount(source, count)>`
  - `GET /api/admin/blog/stats/devices?days=30` → `List<SourceCount(source, count)>`

- [ ] **Step 1: 마이그레이션 번호를 확인하고 파일을 만든다**

```bash
ls spring/jaywiki/src/main/resources/db/migration | sort -V | tail -3
```

`V14` 가 최대면 `V15__blog_stats_detail.sql`:

```sql
-- ============================================================
-- V15: 유입 소스와 디바이스 일별 집계
--   컬럼을 늘리지 않고 세로 테이블로 둔다. 소스가 늘 때마다 마이그레이션이 붙지 않는다.
--   원본 Referer URL 과 User-Agent 원문은 여전히 저장하지 않는다.
--   referer 는 호스트만 보고 소스 이름으로 줄이고, UA 는 모바일 여부 boolean 으로만 줄인다.
--
--   tb_blog_daily_stat 의 ref_search / ref_sns / ref_other 는 그대로 둔다.
--   이미 쌓인 값이 있고 지우면 과거 집계가 사라진다. 이 테이블은 이 시점부터 쌓인다.
-- ============================================================

create table if not exists public.tb_blog_referrer_daily (
    stat_date date   not null,
    source    text   not null,          -- google, naver, daum, bing, sns:x, direct, other ...
    count     bigint not null default 0,
    primary key (stat_date, source)
);

create table if not exists public.tb_blog_device_daily (
    stat_date date   not null,
    device    text   not null check (device in ('pc', 'mobile')),
    count     bigint not null default 0,
    primary key (stat_date, device)
);
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`BlogReferrerSourceTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 호스트만 보고 소스를 정한다. 경로·쿼리는 보지 않는다(검색어를 남기지 않기 위해서다). */
class BlogReferrerSourceTest {

    @Test
    void referer_가_없으면_직접_유입이다() {
        assertThat(BlogReferrerSource.of(null)).isEqualTo("direct");
        assertThat(BlogReferrerSource.of("  ")).isEqualTo("direct");
    }

    @Test
    void 검색엔진은_이름으로_구분한다() {
        assertThat(BlogReferrerSource.of("https://www.google.com/search?q=x")).isEqualTo("google");
        assertThat(BlogReferrerSource.of("https://search.naver.com/search.naver?query=x")).isEqualTo("naver");
        assertThat(BlogReferrerSource.of("https://search.daum.net/search?q=x")).isEqualTo("daum");
    }

    @Test
    void SNS_는_sns_접두사를_붙인다() {
        assertThat(BlogReferrerSource.of("https://x.com/someone/status/1")).isEqualTo("sns:x");
        assertThat(BlogReferrerSource.of("https://www.facebook.com/")).isEqualTo("sns:facebook");
    }

    @Test
    void 흉내낸_호스트는_other_다() {
        // 부분 문자열 매칭을 쓰면 이것들이 google 로 잘못 잡힌다.
        assertThat(BlogReferrerSource.of("https://mygoogle.com/")).isEqualTo("other");
        assertThat(BlogReferrerSource.of("https://google.evil.com/")).isEqualTo("other");
    }

    @Test
    void 모르는_호스트는_other_다() {
        assertThat(BlogReferrerSource.of("https://example.com/post")).isEqualTo("other");
    }
}
```

- [ ] **Step 3: 실패를 확인한다**

```bash
cd spring/jaywiki && ./gradlew test --tests '*BlogReferrerSourceTest'
```

- [ ] **Step 4: 소스 분류를 만든다**

`blog/BlogReferrerSource.java`. **기존 `BlogReferrerBucket` 은 지우지 않는다** — 기존 컬럼 집계가 그걸 계속 쓴다.

```java
package cloud.leneu.jaywiki.blog;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 유입 소스를 이름 하나로 줄인다. BlogReferrerBucket 과 같은 호스트 매칭 규칙을 쓰되
 * 세 갈래가 아니라 소스 이름까지 남긴다.
 *
 * 원본 URL 은 저장하지 않는다 — 호스트만 본다. 검색어는 경로·쿼리에 있으므로
 * 여기서 보지 않는 한 어디에도 남지 않는다(관리자 설계 7절).
 */
public final class BlogReferrerSource {

    public static final String DIRECT = "direct";
    public static final String OTHER = "other";

    /** 삽입 순서가 곧 검사 순서다. 더 좁은 도메인을 앞에 둔다. */
    private static final Map<String, String> SOURCES = new LinkedHashMap<>();

    static {
        SOURCES.put("google.co.kr", "google");
        SOURCES.put("google.com", "google");
        SOURCES.put("naver.com", "naver");
        SOURCES.put("daum.net", "daum");
        SOURCES.put("bing.com", "bing");
        SOURCES.put("duckduckgo.com", "duckduckgo");
        SOURCES.put("yahoo.com", "yahoo");
        SOURCES.put("baidu.com", "baidu");
        SOURCES.put("yandex.com", "yandex");
        SOURCES.put("x.com", "sns:x");
        SOURCES.put("twitter.com", "sns:x");
        SOURCES.put("t.co", "sns:x");
        SOURCES.put("facebook.com", "sns:facebook");
        SOURCES.put("instagram.com", "sns:instagram");
        SOURCES.put("threads.net", "sns:threads");
        SOURCES.put("linkedin.com", "sns:linkedin");
        SOURCES.put("reddit.com", "sns:reddit");
        SOURCES.put("news.ycombinator.com", "sns:hackernews");
        SOURCES.put("discord.com", "sns:discord");
        SOURCES.put("kakao.com", "sns:kakao");
    }

    private BlogReferrerSource() {
    }

    public static String of(String referer) {
        if (referer == null || referer.isBlank()) {
            return DIRECT;
        }
        String host;
        try {
            host = URI.create(referer.trim()).getHost();
        } catch (IllegalArgumentException e) {
            return OTHER;
        }
        if (host == null || host.isBlank()) {
            return OTHER;
        }
        String lower = host.toLowerCase(Locale.ROOT);
        return SOURCES.entrySet().stream()
                .filter(e -> matches(lower, e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(OTHER);
    }

    /** 정확히 일치하거나 서브도메인이어야 한다. 부분 문자열 매칭은 mygoogle.com 을 잘못 잡는다. */
    private static boolean matches(String host, String domain) {
        return host.equals(domain) || host.endsWith("." + domain);
    }
}
```

- [ ] **Step 5: 디바이스 판정과 집계를 넣는다**

`BlogStatsService.java` 에 추가한다.

```java
    /** User-Agent 원문은 저장하지 않는다. 모바일 여부 하나만 뽑아 센다. */
    static String deviceOf(String userAgent) {
        if (userAgent == null) return "pc";
        String lower = userAgent.toLowerCase(java.util.Locale.ROOT);
        boolean mobile = lower.contains("mobi") || lower.contains("android")
                || lower.contains("iphone") || lower.contains("ipad");
        return mobile ? "mobile" : "pc";
    }
```

`recordView` 의 시그니처를 바꾸고(인자에 `String userAgent` 추가) 기존 집계 뒤에 두 줄을 더한다.

```java
        jdbc.update("""
                insert into public.tb_blog_referrer_daily (stat_date, source, count)
                values (?, ?, 1)
                on conflict (stat_date, source)
                do update set count = public.tb_blog_referrer_daily.count + 1
                """, today, BlogReferrerSource.of(referer));

        jdbc.update("""
                insert into public.tb_blog_device_daily (stat_date, device, count)
                values (?, ?, 1)
                on conflict (stat_date, device)
                do update set count = public.tb_blog_device_daily.count + 1
                """, today, deviceOf(userAgent));
```

조회 메서드도 더한다.

```java
    public record DailyPoint(java.time.LocalDate date, long views, long visitors) {
    }

    public record SourceCount(String source, long count) {
    }

    @Transactional(readOnly = true)
    public List<DailyPoint> daily(int days) {
        LocalDate from = LocalDate.now(KST).minusDays(days - 1L);
        return jdbc.query("""
                select stat_date, views, visitors from public.tb_blog_daily_stat
                where stat_date >= ? order by stat_date
                """,
                (rs, i) -> new DailyPoint(rs.getObject(1, LocalDate.class), rs.getLong(2), rs.getLong(3)),
                from);
    }

    @Transactional(readOnly = true)
    public List<SourceCount> referrers(int days) {
        LocalDate from = LocalDate.now(KST).minusDays(days - 1L);
        return jdbc.query("""
                select source, sum(count) from public.tb_blog_referrer_daily
                where stat_date >= ? group by source order by sum(count) desc
                """,
                (rs, i) -> new SourceCount(rs.getString(1), rs.getLong(2)), from);
    }

    @Transactional(readOnly = true)
    public List<SourceCount> devices(int days) {
        LocalDate from = LocalDate.now(KST).minusDays(days - 1L);
        return jdbc.query("""
                select device, sum(count) from public.tb_blog_device_daily
                where stat_date >= ? group by device order by sum(count) desc
                """,
                (rs, i) -> new SourceCount(rs.getString(1), rs.getLong(2)), from);
    }
```

`BlogController.post()` 의 호출을 바꾼다.

```java
        stats.recordView(id, ClientIpResolver.resolve(request), request.getHeader("referer"),
                request.getHeader("user-agent"));
```

- [ ] **Step 6: 통계 조회 컨트롤러를 만든다**

`blog/BlogAdminStatsController.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.common.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/blog/stats")
@RequiredArgsConstructor
public class BlogAdminStatsController {

    private final BlogStatsService stats;

    private int checked(int days) {
        if (days < 1 || days > 365) {
            throw new BadRequestException("days must be between 1 and 365: " + days);
        }
        return days;
    }

    @GetMapping("/daily")
    public List<BlogStatsService.DailyPoint> daily(@RequestParam(defaultValue = "30") int days) {
        return stats.daily(checked(days));
    }

    @GetMapping("/referrers")
    public List<BlogStatsService.SourceCount> referrers(@RequestParam(defaultValue = "30") int days) {
        return stats.referrers(checked(days));
    }

    @GetMapping("/devices")
    public List<BlogStatsService.SourceCount> devices(@RequestParam(defaultValue = "30") int days) {
        return stats.devices(checked(days));
    }
}
```

- [ ] **Step 7: 기존 테스트가 깨지지 않는지 본다**

`recordView` 시그니처가 바뀌었으므로 `BlogStatsServiceTest` 와 `BlogApiIntegrationTest` 의 호출부를 고쳐야 할 수 있다.

```bash
cd spring/jaywiki && ./gradlew test
```

기대: 156개 통과, 실패 0. **`@AfterEach` 에 새 테이블 정리를 추가해야 한다** — 기존 테스트가
`tb_blog_daily_stat` 만 지우고 있으면 새 테이블에 값이 남아 다음 테스트에 샌다.

```java
        jdbc.update("delete from public.tb_blog_referrer_daily");
        jdbc.update("delete from public.tb_blog_device_daily");
```

- [ ] **Step 8: 커밋**

```bash
git add spring/jaywiki/src/main spring/jaywiki/src/test
git commit -m "feat(blog-admin): break down referrers by source and count devices"
```

---

### Task 6: 웹 관리 데이터 계층과 사이드바

**Files:**
- Create: `web/src/lib/blogAdmin.ts`
- Create: `web/src/lib/blogAdminForm.ts`
- Create: `web/src/lib/blogAdminForm.test.ts`
- Create: `web/src/lib/blogAdminActions.ts`
- Modify: `web/src/app/admin/layout.tsx`
- Modify: `web/src/app/styles/admin.css`

**Interfaces:**
- Produces:
  - `getAdminBlogPosts()`, `getAdminBlogPost(id)`, `getAdminBlogCategories()`, `getAdminBlogComments(deleted)`, `getBlogDaily(days)`, `getBlogReferrers(days)`, `getBlogDevices(days)` — 전부 쿠키를 싣는다
  - `parseTags(raw: string): string[]`, `formatTags(tags: readonly string[]): string`
  - Server Action: `saveBlogPostAction`, `deleteBlogPostAction`, `saveCategoryAction`, `reorderCategoriesAction`, `deleteCategoryAction`, `deleteCommentAction`, `restoreCommentAction`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`web/src/lib/blogAdminForm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { formatTags, parseTags } from './blogAdminForm';

describe('parseTags', () => {
  it('쉼표로 나누고 공백을 턴다', () => {
    expect(parseTags(' react , spring ')).toEqual(['react', 'spring']);
  });

  it('빈 조각과 중복을 버린다', () => {
    expect(parseTags('react,,react, ,spring')).toEqual(['react', 'spring']);
  });

  it('빈 문자열은 빈 배열이다', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags('   ')).toEqual([]);
  });
});

describe('formatTags', () => {
  it('입력칸에 되돌릴 수 있게 쉼표로 잇는다', () => {
    expect(formatTags(['react', 'spring'])).toBe('react, spring');
    expect(parseTags(formatTags(['react', 'spring']))).toEqual(['react', 'spring']);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd web && npm test -- blogAdminForm
```

- [ ] **Step 3: 순수 함수를 만든다**

`web/src/lib/blogAdminForm.ts`:

```ts
/** 관리 폼의 순수 변환. vitest 가 node 환경이라 여기만 자동 테스트가 가능하다. */

/** 쉼표로 나누고 공백·빈 조각·중복을 턴다. 순서는 입력한 순서를 지킨다. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(',')) {
    const tag = piece.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** 저장된 태그를 입력칸으로 되돌린다. parseTags 와 왕복이 성립해야 한다. */
export function formatTags(tags: readonly string[]): string {
  return tags.join(', ');
}
```

- [ ] **Step 4: 쿠키를 싣는 클라이언트를 만든다**

`web/src/lib/blogAdmin.ts`:

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { BACKEND_BASE as BASE } from './backend';
import type { BlogCategory } from './blog';

/**
 * 관리 API 클라이언트 (서버 컴포넌트 전용).
 *
 * 공개용 lib/blog.ts 와 달리 반드시 jw_token 쿠키를 싣는다.
 * SecurityConfig 가 /api/admin/blog/** 를 ADMIN 으로 묶기 때문이다.
 * 쿠키를 빠뜨리면 403 이 나고, 호출부가 catch 로 빈 값을 돌려주면
 * 화면이 오류 없이 비어 보인다 — 그래서 여기서는 삼키지 않고 던진다.
 */

export interface AdminBlogPost {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  body: string;
  categoryId: number;
  categorySlug?: string;
  categoryName?: string;
  coverAssetId?: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  updatedAt?: string;
  viewCount: number;
  tags: string[];
}

export interface AdminBlogComment {
  id: number;
  postId: number;
  postTitle?: string;
  authorName: string;
  ipPrefix: string;
  body: string;
  createdAt: string;
  deletedAt?: string;
}

export interface DailyPoint {
  date: string;
  views: number;
  visitors: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

async function adminGet<T>(path: string): Promise<T> {
  const jar = await cookies();
  const token = jar.get('jw_token');
  const r = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: token ? { cookie: `${token.name}=${token.value}` } : {},
  });
  if (!r.ok) throw new Error(`admin blog API ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export function getAdminBlogPosts(): Promise<AdminBlogPost[]> {
  return adminGet<AdminBlogPost[]>('/api/admin/blog/posts');
}

export function getAdminBlogPost(id: number): Promise<AdminBlogPost> {
  return adminGet<AdminBlogPost>(`/api/admin/blog/posts/${id}`);
}

export function getAdminBlogCategories(): Promise<BlogCategory[]> {
  return adminGet<BlogCategory[]>('/api/admin/blog/categories');
}

export function getAdminBlogComments(deleted = false): Promise<AdminBlogComment[]> {
  return adminGet<AdminBlogComment[]>(`/api/admin/blog/comments?deleted=${deleted}`);
}

export function getBlogDaily(days = 30): Promise<DailyPoint[]> {
  return adminGet<DailyPoint[]>(`/api/admin/blog/stats/daily?days=${days}`);
}

export function getBlogReferrers(days = 30): Promise<SourceCount[]> {
  return adminGet<SourceCount[]>(`/api/admin/blog/stats/referrers?days=${days}`);
}

export function getBlogDevices(days = 30): Promise<SourceCount[]> {
  return adminGet<SourceCount[]>(`/api/admin/blog/stats/devices?days=${days}`);
}
```

- [ ] **Step 5: Server Action 을 만든다**

`web/src/lib/blogAdminActions.ts`. 기존 `lib/actions.ts` 의 형태를 따른다.

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { BACKEND_BASE as BASE } from './backend';
import { parseTags } from './blogAdminForm';

export type BlogSaveResult = { error?: string };

async function send(path: string, init: RequestInit): Promise<Response> {
  const jar = await cookies();
  const token = jar.get('jw_token');
  return fetch(`${BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `${token.name}=${token.value}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

/** 저장 뒤 목록으로 보낸다. redirect 는 예외를 던지므로 try 블록 밖에서 부른다. */
export async function saveBlogPostAction(
  _prev: BlogSaveResult | null,
  formData: FormData,
): Promise<BlogSaveResult> {
  const id = String(formData.get('id') ?? '').trim();
  const payload = {
    slug: String(formData.get('slug') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim() || null,
    body: String(formData.get('body') ?? ''),
    categoryId: Number(formData.get('categoryId')),
    coverAssetId: String(formData.get('coverAssetId') ?? '').trim() || null,
    status: formData.get('status') === 'published' ? 'published' : 'draft',
    publishedAt: String(formData.get('publishedAt') ?? '').trim() || null,
    tags: parseTags(String(formData.get('tags') ?? '')),
  };

  const r = id
    ? await send(`/api/admin/blog/posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await send('/api/admin/blog/posts', { method: 'POST', body: JSON.stringify(payload) });

  if (!r.ok) {
    const detail = await r.text();
    return { error: `저장에 실패했습니다 (${r.status}). ${detail.slice(0, 200)}` };
  }
  revalidatePath('/admin/blog/posts');
  redirect('/admin/blog/posts');
}

export async function deleteBlogPostAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await send(`/api/admin/blog/posts/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/blog/posts');
}

export async function saveCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const body = JSON.stringify({
    slug: String(formData.get('slug') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    parentId: formData.get('parentId') ? Number(formData.get('parentId')) : null,
  });
  await (id
    ? send(`/api/admin/blog/categories/${id}`, { method: 'PUT', body })
    : send('/api/admin/blog/categories', { method: 'POST', body }));
  revalidatePath('/admin/blog/categories');
}

export async function reorderCategoriesAction(ids: number[]): Promise<void> {
  await send('/api/admin/blog/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
  revalidatePath('/admin/blog/categories');
}

export async function deleteCategoryAction(formData: FormData): Promise<BlogSaveResult> {
  const id = String(formData.get('id') ?? '');
  const r = await send(`/api/admin/blog/categories/${id}`, { method: 'DELETE' });
  if (!r.ok) {
    // 글이 있으면 400 과 안내 문구가 온다. DB 오류를 그대로 내보내지 않는다.
    const detail = await r.text();
    return { error: detail.slice(0, 200) || '삭제하지 못했습니다.' };
  }
  revalidatePath('/admin/blog/categories');
  return {};
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await send(`/api/admin/blog/comments/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/blog/comments');
}

export async function restoreCommentAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await send(`/api/admin/blog/comments/${id}/restore`, { method: 'POST' });
  revalidatePath('/admin/blog/comments');
}
```

- [ ] **Step 6: 사이드바를 두 묶음으로 나눈다**

`web/src/app/admin/layout.tsx` 의 `<nav className="admin-nav">` 안을 바꾼다. 기존 링크는 그대로 두고 소제목과 블로그 묶음을 더한다.

```tsx
          <nav className="admin-nav" aria-label="관리자 메뉴">
            <span className="admin-nav-group">위키</span>
            <Link href="/admin/articles"><span>📝</span><span>글 목록</span></Link>
            <Link href="/admin/articles/new"><span>＋</span><span>새 글</span></Link>
            <Link href="/admin/tabs"><span>⚙</span><span>탭 관리</span></Link>

            <span className="admin-nav-group">블로그</span>
            <Link href="/admin/blog/posts"><span>📄</span><span>글 목록</span></Link>
            <Link href="/admin/blog/posts/new"><span>＋</span><span>새 글</span></Link>
            <Link href="/admin/blog/categories"><span>🗂</span><span>카테고리</span></Link>
            <Link href="/admin/blog/comments"><span>💬</span><span>댓글</span></Link>
            <Link href="/admin/blog/stats"><span>📊</span><span>통계</span></Link>

            <span className="admin-nav-group">공통</span>
            <Link href="/admin/services"><span>S</span><span>서비스</span></Link>
            <Link href="/admin/guide"><span><BookOpenText aria-hidden="true" /></span><span>편집 가이드</span></Link>
            <Link href="/" className="admin-nav-bottom"><span>←</span><span>사이트로</span></Link>
          </nav>
```

`web/src/app/styles/admin.css` 끝에 추가한다.

```css
/* 관리 메뉴 소제목 — 위키와 블로그의 '글 목록' 이 구분되어야 한다. */
.admin-nav-group {
  display: block; margin: 14px 0 4px; padding: 0 10px;
  font-size: var(--fs-2xs); font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--text-mute);
}
.admin-nav-group:first-child { margin-top: 0; }
```

- [ ] **Step 7: 검사와 커밋**

```bash
cd web && npm run lint && npm run type-check && npm test
```

기대: 경고 8개 그대로, 테스트 50개 통과.

```bash
git add web/src/lib web/src/app/admin/layout.tsx web/src/app/styles/admin.css
git commit -m "feat(blog-admin): add cookie-bearing admin client, actions and grouped sidebar"
```

---

### Task 7: 본문 편집 코어 분리

`ArticleEditor` 에서 마크다운 편집 부분만 떼어낸다. **위키 편집기의 동작이 바뀌면 안 된다.**

**Files:**
- Create: `web/src/components/MarkdownBodyEditor.tsx`
- Modify: `web/src/components/ArticleEditor.tsx`

**Interfaces:**
- Produces: `<MarkdownBodyEditor name="body" value={string} onChange={(v: string) => void} />`
  — 내부에 이미지 업로드·미리보기·커서 삽입·세션 자산 목록을 담는다

- [ ] **Step 1: 옮길 범위를 확인한다**

`ArticleEditor.tsx` 에서 옮길 것은 **242~330행의 `<div className="editor-body">` 블록 전체**와
그것이 쓰는 상태·함수·ref 다.

| 옮긴다 | 남긴다 |
|---|---|
| 상태 `assetMessage` `uploading` `dragging` `sessionAssets` | 상태 `body` `title` `slug` |
| ref `previewRef` `textareaRef` `fileInputRef` | `useActionState` 폼 상태 |
| 함수 `uploadImage` `insertAtCursor` `deleteSessionAsset` `formatBytes` | `onTitleChange`, `slugTouched` |
| `previewHtml` (useMemo) | `editor-meta` 의 필드 전부 |
| import `ImagePlus` `LoaderCircle` `Trash2` `MermaidDiagrams` `renderMarkdownPreview` `uploadWikiAssetAction` `deleteWikiAssetAction` | `KINDS` `STATUSES` `Field` |

`body` 상태는 **남긴다.** 폼 전송과 `MarkdownBodyEditor` 양쪽이 쓰므로 위에서 내려준다.

- [ ] **Step 2: `MarkdownBodyEditor` 를 만든다**

`web/src/components/MarkdownBodyEditor.tsx` — `'use client'`.
Step 1 표의 왼쪽 열을 그대로 옮기고, 바깥과의 접점 셋만 바꾼다.

1. `body` → `value` (prop)
2. `setBody(...)` → `onChange(...)` — `onChange` 핸들러와 `insertAtCursor` 안 두 곳
3. `name="body"` → `name={name}`

껍데기는 이렇다. 본문 JSX 는 `ArticleEditor.tsx` 242~330행을 그대로 붙이고 위 셋만 바꾼다.

```tsx
'use client';

import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { MermaidDiagrams } from './MermaidDiagrams';
import { renderMarkdownPreview } from '@/lib/markdown';
import {
  deleteWikiAssetAction,
  uploadWikiAssetAction,
  type WikiAssetUpload,
} from '@/lib/actions';

type SessionAsset = { asset: WikiAssetUpload };

/**
 * 마크다운 본문 편집 코어. 위키 편집기와 블로그 편집기가 함께 쓴다.
 * 자산은 tb_article_asset 을 공유하므로 업로드 액션도 그대로 쓴다.
 *
 * 폼 메타 필드는 이 컴포넌트 밖에 둔다 — 위키와 블로그의 필드가 다르기 때문이다.
 * body 상태도 밖에 둔다. 폼 전송과 여기 양쪽이 쓴다.
 */
export function MarkdownBodyEditor({
  name,
  value,
  onChange,
}: {
  readonly name: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sessionAssets, setSessionAssets] = useState<readonly SessionAsset[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewHtml = useMemo(() => renderMarkdownPreview(value), [value]);

  // uploadImage / insertAtCursor / deleteSessionAsset / formatBytes 를
  // ArticleEditor 에서 그대로 옮긴다. insertAtCursor 안의 setBody 만 onChange 로 바꾼다.

  return (
    <div className="editor-body">
      {/* ArticleEditor.tsx 242~330행을 그대로. textarea 는 아래 셋만 바뀐다. */}
      {/*   name={name}  value={value}  onChange={(e) => onChange(e.target.value)} */}
    </div>
  );
}
```

**주의 둘.**
- `MermaidDiagrams` 의 `signal` 이 `body` 였다 → `value` 로 바꾼다. 안 바꾸면 미리보기의
  다이어그램이 갱신되지 않는다.
- `pane-hint` 의 글자 수 계산도 `body.length` → `value.length` 다.

- [ ] **Step 3: `ArticleEditor` 가 그걸 쓰게 바꾼다**

옮긴 상태·함수·JSX 를 지우고 그 자리에 넣는다.

```tsx
        <MarkdownBodyEditor name="body" value={body} onChange={setBody} />
```

`body` 상태는 `ArticleEditor` 에 남는다(폼 전송과 미리보기 양쪽이 쓴다).

- [ ] **Step 4: 위키 편집기 회귀를 눈으로 확인한다**

이 태스크의 성패는 여기서 갈린다.

| 확인 | 방법 |
|---|---|
| 기존 글 편집이 열린다 | `/admin/articles` 에서 아무 글이나 클릭 |
| 본문 수정 후 저장이 된다 | 한 글자 고치고 저장 → 목록에서 확인 |
| 이미지 드래그 업로드 | 이미지를 textarea 에 끌어다 놓기 → 마크다운이 커서 위치에 삽입 |
| 붙여넣기 업로드 | 클립보드 이미지 붙여넣기 |
| 미리보기 | 타이핑하는 동안 오른쪽이 따라 바뀐다 |
| 세션 자산 삭제 | 방금 올린 이미지를 저장 전에 지우기 |

- [ ] **Step 5: 검사와 커밋**

```bash
cd web && npm run lint && npm run type-check && npm test
git add web/src/components
git commit -m "refactor(admin): extract MarkdownBodyEditor shared by wiki and blog"
```

---

### Task 8: 블로그 글 목록과 편집 화면

**Files:**
- Create: `web/src/app/admin/blog/posts/page.tsx`
- Create: `web/src/app/admin/blog/posts/new/page.tsx`
- Create: `web/src/app/admin/blog/posts/[id]/page.tsx`
- Create: `web/src/components/blog/admin/BlogPostForm.tsx`
- Modify: `web/src/app/styles/admin.css`

**Interfaces:**
- Consumes: `getAdminBlogPosts()`, `getAdminBlogPost(id)`, `getAdminBlogCategories()`, `saveBlogPostAction`, `deleteBlogPostAction`, `MarkdownBodyEditor`, `parseTags`/`formatTags`
- Produces: `<BlogPostForm initial={AdminBlogPost | null} categories={BlogCategory[]} />`

- [ ] **Step 1: 목록 화면을 만든다**

`web/src/app/admin/blog/posts/page.tsx`:

```tsx
import Link from 'next/link';
import { getAdminBlogPosts } from '@/lib/blogAdmin';
import { deleteBlogPostAction } from '@/lib/blogAdminActions';
import { formatBlogDate } from '@/lib/blogLinks';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPostsPage() {
  const items = await getAdminBlogPosts();

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Blog</div>
          <h1>블로그 글 — {items.length}편</h1>
          <p className="admin-desc">
            원본은 <code>tb_blog_post</code> 하나다. 위키와 달리 revision 을 남기지 않는다.
          </p>
        </div>
        <Link className="btn btn-primary" href="/admin/blog/posts/new">＋ 새 글</Link>
      </div>

      {items.length === 0 ? (
        <div className="placeholder" style={{ marginTop: 18 }}>
          아직 글이 없습니다. <Link href="/admin/blog/posts/new">첫 글 작성 →</Link>
        </div>
      ) : (
        <ul className="article-list">
          {items.map((it) => (
            <li key={it.id} className="al-item">
              <Link href={`/admin/blog/posts/${it.id}`} className="al-row">
                <div className="al-meta">
                  <span className={`badge ${it.status === 'published' ? 'green' : ''}`}>
                    ● {it.status}
                  </span>
                  <span className="badge">{it.categoryName}</span>
                  <span className="badge">{formatBlogDate(it.publishedAt ?? it.updatedAt)}</span>
                  <span className="badge">조회 {it.viewCount}</span>
                </div>
                <div className="al-title">{it.title}</div>
                {it.summary && <div className="al-desc">{it.summary}</div>}
                <div className="al-foot"><code>{it.categorySlug}/{it.slug}</code></div>
              </Link>
              <form action={deleteBlogPostAction} className="al-delete">
                <input type="hidden" name="id" value={it.id} />
                <button type="submit" className="btn btn-danger" title="삭제">🗑</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 2: 편집 폼을 만든다**

`web/src/components/blog/admin/BlogPostForm.tsx` — `'use client'`.

```tsx
'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { MarkdownBodyEditor } from '@/components/MarkdownBodyEditor';
import type { BlogCategory } from '@/lib/blog';
import type { AdminBlogPost } from '@/lib/blogAdmin';
import { saveBlogPostAction, type BlogSaveResult } from '@/lib/blogAdminActions';
import { formatTags } from '@/lib/blogAdminForm';

/** 제목에서 slug 후보를 만든다. 사용자가 직접 고치면 더 이상 따라가지 않는다. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/** 평탄한 카테고리 목록. 자식은 '부모/자식' 으로 보여준다(관리자 설계 6.1). */
function flatten(categories: readonly BlogCategory[]) {
  return categories.flatMap((parent) => [
    { id: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ id: child.id, label: `${parent.name}/${child.name}` })),
  ]);
}

export function BlogPostForm({
  initial,
  categories,
}: {
  readonly initial: AdminBlogPost | null;
  readonly categories: readonly BlogCategory[];
}) {
  const [state, formAction, pending] = useActionState<BlogSaveResult | null, FormData>(
    saveBlogPostAction,
    null,
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [body, setBody] = useState(initial?.body ?? '');
  const options = flatten(categories);

  return (
    <form action={formAction} className="editor">
      <div className="editor-head">
        <div>
          <div className="eyebrow">{initial ? 'Admin · Blog · Edit' : 'Admin · Blog · New'}</div>
          <h1>{initial ? `편집 — ${initial.title}` : '새 글 작성'}</h1>
        </div>
        <div className="editor-actions">
          <Link href="/admin/blog/posts" className="btn">취소</Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {state?.error && <div className="editor-error" role="alert">⚠ {state.error}</div>}

      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="editor-meta">
        <label className="field">
          <span className="field-label">제목</span>
          <input
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">slug</span>
          {/* 블로그 slug 는 unique 가 아니다(설계 5절). 중복 검사를 하지 않는다. */}
          <input
            name="slug"
            value={slug}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
          />
        </label>
        <label className="field">
          <span className="field-label">카테고리</span>
          <select name="categoryId" defaultValue={initial?.categoryId ?? options[0]?.id} required>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">상태</span>
          <select name="status" defaultValue={initial?.status ?? 'draft'}>
            <option value="draft">draft — 공개 안 함</option>
            <option value="published">published — 공개</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">발행일</span>
          {/* 비워 두고 published 로 저장하면 서버가 지금 시각을 넣는다. */}
          <input
            name="publishedAt"
            type="datetime-local"
            defaultValue={initial?.publishedAt?.slice(0, 16) ?? ''}
          />
        </label>
        <label className="field">
          <span className="field-label">대표 이미지 자산 id</span>
          {/* 본문에 이미 올린 자산 중에서 고른다. 별도 업로드 칸을 두지 않는다. */}
          <input name="coverAssetId" defaultValue={initial?.coverAssetId ?? ''} />
        </label>
        <label className="field field-full">
          <span className="field-label">요약</span>
          <input name="summary" defaultValue={initial?.summary ?? ''} />
        </label>
        <label className="field field-full">
          <span className="field-label">태그</span>
          <input name="tags" defaultValue={formatTags(initial?.tags ?? [])} placeholder="react, spring" />
        </label>
      </div>

      <MarkdownBodyEditor name="body" value={body} onChange={setBody} />
    </form>
  );
}
```

`field` / `field-label` / `field-full` 클래스가 `admin.css` 에 없으면 기존 `Field` 컴포넌트의
마크업을 확인해 같은 클래스를 쓴다. **새 클래스를 만들지 않는다.**

- [ ] **Step 3: 새 글·편집 화면을 만든다**

`web/src/app/admin/blog/posts/new/page.tsx`:

```tsx
import { BlogPostForm } from '@/components/blog/admin/BlogPostForm';
import { getAdminBlogCategories } from '@/lib/blogAdmin';

export const dynamic = 'force-dynamic';

export default async function NewBlogPostPage() {
  const categories = await getAdminBlogCategories();
  return <BlogPostForm initial={null} categories={categories} />;
}
```

`web/src/app/admin/blog/posts/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { BlogPostForm } from '@/components/blog/admin/BlogPostForm';
import { getAdminBlogCategories, getAdminBlogPost } from '@/lib/blogAdmin';

export const dynamic = 'force-dynamic';

export default async function EditBlogPostPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [post, categories] = await Promise.all([
    getAdminBlogPost(Number(id)),
    getAdminBlogCategories(),
  ]);
  return <BlogPostForm initial={post} categories={categories} />;
}
```

- [ ] **Step 4: 눈으로 확인한다**

`http://localhost:3000/admin/blog/posts` — 로그인 필요.

| 확인 | 기대 |
|---|---|
| 목록 | 이관된 8편 + draft. draft 가 위에, 회색 배지 |
| 새 글 → draft 저장 | 목록에 뜨고 **공개 블로그에는 안 보인다** |
| draft → published 로 바꿔 저장 | 발행일을 비워도 저장된다. 공개 블로그에 뜬다 |
| 태그 | 쉼표로 입력 → 저장 후 되돌아온다. 공개 글 화면의 태그 줄에도 반영 |
| 이미지 업로드 | 본문에 삽입되고, 저장 뒤 자산이 `TEMP` 가 아니다 |
| 삭제 | 목록에서 사라지고 공개 블로그에서도 사라진다 |

- [ ] **Step 5: 검사와 커밋**

```bash
cd web && npm run lint && npm run type-check && npm test
git add web/src/app/admin/blog web/src/components/blog/admin web/src/app/styles/admin.css
git commit -m "feat(blog-admin): add post list and editor screens"
```

---

### Task 9: 카테고리 관리 화면

드래그 정렬을 **새 의존성 없이** 만든다. 접근성을 위해 위/아래 버튼을 함께 둔다.

**Files:**
- Create: `web/src/app/admin/blog/categories/page.tsx`
- Create: `web/src/components/blog/admin/CategoryTreeEditor.tsx`
- Create: `web/src/lib/reorder.ts`
- Create: `web/src/lib/reorder.test.ts`
- Modify: `web/src/app/styles/admin.css`

**Interfaces:**
- Produces: `moveItem<T>(items: readonly T[], from: number, to: number): T[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`web/src/lib/reorder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { moveItem } from './reorder';

describe('moveItem', () => {
  it('앞으로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('뒤로 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('제자리면 그대로다', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('범위를 벗어나면 그대로다', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('원본을 바꾸지 않는다', () => {
    const original = ['a', 'b', 'c'];
    moveItem(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd web && npm test -- reorder
```

- [ ] **Step 3: 순수 함수를 만든다**

`web/src/lib/reorder.ts`:

```ts
/** 배열에서 한 항목을 다른 자리로 옮긴다. 원본을 바꾸지 않는다. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) {
    return next;
  }
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
```

- [ ] **Step 4: 트리 편집기를 만든다**

`web/src/components/blog/admin/CategoryTreeEditor.tsx` — `'use client'`.

```tsx
'use client';

import { useState } from 'react';
import type { BlogCategory } from '@/lib/blog';
import { reorderCategoriesAction } from '@/lib/blogAdminActions';
import { moveItem } from '@/lib/reorder';

/**
 * 2단 카테고리 트리. 같은 부모 안에서만 순서를 바꾼다(설계 6.3).
 * 드래그는 HTML5 drag and drop 으로 한다 — 카테고리가 열 개 안팎이라 라이브러리가 필요없다.
 * 드래그만 두면 키보드로는 순서를 못 바꾸므로 위/아래 버튼을 함께 둔다.
 */
export function CategoryTreeEditor({ initial }: { readonly initial: readonly BlogCategory[] }) {
  const [rows, setRows] = useState<readonly BlogCategory[]>(initial);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function commit(next: readonly BlogCategory[]) {
    setRows(next);
    setSaving(true);
    try {
      await reorderCategoriesAction(next.map((c) => c.id));
    } finally {
      setSaving(false);
    }
  }

  function move(from: number, to: number) {
    const next = moveItem(rows, from, to);
    if (next !== rows) void commit(next);
  }

  return (
    <ul className="badm-tree">
      {rows.map((category, index) => (
        <li
          key={category.id}
          draggable
          onDragStart={() => setDragFrom(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom !== null) move(dragFrom, index);
            setDragFrom(null);
          }}
        >
          <div className="badm-row">
            <span className="badm-handle" aria-hidden="true">≡</span>
            <span className="badm-name">{category.name}</span>
            <span className="badm-count">({category.postCount})</span>
            <span className="badm-actions">
              <button type="button" disabled={index === 0 || saving}
                      onClick={() => move(index, index - 1)} aria-label={`${category.name} 위로`}>↑</button>
              <button type="button" disabled={index === rows.length - 1 || saving}
                      onClick={() => move(index, index + 1)} aria-label={`${category.name} 아래로`}>↓</button>
            </span>
          </div>
          {category.children.length > 0 && (
            <ul className="badm-children">
              {category.children.map((child) => (
                <li key={child.id}>
                  <div className="badm-row">
                    <span className="badm-name">{child.name}</span>
                    <span className="badm-count">({child.postCount})</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
```

**자식 정렬은 이번 범위 밖이다.** 자식이 생기면 같은 방식으로 붙인다.

- [ ] **Step 5: 화면과 CSS 를 만든다**

`web/src/app/admin/blog/categories/page.tsx`:

```tsx
import { CategoryTreeEditor } from '@/components/blog/admin/CategoryTreeEditor';
import { getAdminBlogCategories } from '@/lib/blogAdmin';
import { saveCategoryAction } from '@/lib/blogAdminActions';

export const dynamic = 'force-dynamic';

export default async function AdminBlogCategoriesPage() {
  const categories = await getAdminBlogCategories();

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Blog</div>
          <h1>카테고리 — {categories.length}개</h1>
          <p className="admin-desc">
            드래그하거나 ↑↓ 로 순서를 바꿉니다. 최대 2단이고, 글이 있는 카테고리는 지울 수 없습니다.
          </p>
        </div>
      </div>

      <CategoryTreeEditor initial={categories} />

      <form action={saveCategoryAction} className="badm-new">
        <input name="slug" placeholder="slug (영문)" required pattern="[a-z0-9][a-z0-9-]*" />
        <input name="name" placeholder="표시 이름" required />
        <input name="description" placeholder="설명 (선택)" />
        <button type="submit" className="btn btn-primary">＋ 추가</button>
      </form>
    </>
  );
}
```

`admin.css` 끝에 추가한다. 색은 토큰만 쓴다.

```css
/* 블로그 카테고리 트리 */
.badm-tree, .badm-children { list-style: none; margin: 0; padding: 0; }
.badm-children { padding-left: 22px; }
.badm-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; margin-bottom: 6px;
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-sm);
}
.badm-row:hover { border-color: var(--border-strong); }
.badm-handle { cursor: grab; color: var(--text-mute); font-family: var(--mono); }
.badm-name { font-size: var(--fs-sm); font-weight: 600; }
.badm-count { font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute); }
.badm-actions { margin-left: auto; display: flex; gap: 4px; }
.badm-actions button {
  width: 26px; height: 26px; border: 1px solid var(--border); border-radius: var(--r-xs);
  background: var(--bg-2); color: var(--text-dim); cursor: pointer; font-size: var(--fs-xs);
}
.badm-actions button:disabled { opacity: .4; cursor: not-allowed; }
.badm-new { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
.badm-new input {
  flex: 1 1 160px; padding: 8px 10px; font: inherit; font-size: var(--fs-sm);
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-xs); color: var(--text);
}
```

- [ ] **Step 6: 눈으로 확인한다**

| 확인 | 기대 |
|---|---|
| ↑↓ 버튼 | 순서가 바뀌고 **공개 블로그 레일의 순서도 바뀐다** |
| 드래그 | 같은 결과 |
| 첫 항목의 ↑, 마지막의 ↓ | 비활성 |
| 새 카테고리 추가 | 목록에 뜬다 |
| 글 있는 카테고리 삭제 | "글 n편이 있어 지울 수 없습니다" |

- [ ] **Step 7: 검사와 커밋**

```bash
cd web && npm run lint && npm run type-check && npm test
git add web/src/app/admin/blog web/src/components/blog/admin web/src/lib/reorder.ts web/src/lib/reorder.test.ts web/src/app/styles/admin.css
git commit -m "feat(blog-admin): add category tree editor with drag and keyboard reorder"
```

---

### Task 10: 댓글 관리 화면

**Files:**
- Create: `web/src/app/admin/blog/comments/page.tsx`
- Modify: `web/src/app/styles/admin.css`

- [ ] **Step 1: 화면을 만든다**

`web/src/app/admin/blog/comments/page.tsx`:

```tsx
import Link from 'next/link';
import { getAdminBlogComments } from '@/lib/blogAdmin';
import { deleteCommentAction, restoreCommentAction } from '@/lib/blogAdminActions';
import { blogAbsoluteUrl, blogPostHref, formatBlogDate } from '@/lib/blogLinks';

export const dynamic = 'force-dynamic';

export default async function AdminBlogCommentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const inTrash = deleted === 'true';
  const items = await getAdminBlogComments(inTrash);

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Blog</div>
          <h1>{inTrash ? '댓글 휴지통' : '댓글'} — {items.length}개</h1>
          <p className="admin-desc">
            IP 는 앞 두 자리까지만 남습니다. 원본 주소는 DB 에도 없습니다.
          </p>
        </div>
        <Link className="btn" href={inTrash ? '/admin/blog/comments' : '/admin/blog/comments?deleted=true'}>
          {inTrash ? '← 댓글 목록' : '휴지통 →'}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="placeholder" style={{ marginTop: 18 }}>
          {inTrash ? '휴지통이 비어 있습니다.' : '아직 댓글이 없습니다.'}
        </div>
      ) : (
        <ul className="badm-comments">
          {items.map((c) => (
            <li key={c.id}>
              <div className="badm-cmt-who">
                <b>{c.authorName}</b>
                <span className="ip">({c.ipPrefix}.*.*)</span>
                <time dateTime={c.createdAt}>{formatBlogDate(c.createdAt)}</time>
                <form action={inTrash ? restoreCommentAction : deleteCommentAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={inTrash ? 'btn' : 'btn btn-danger'}>
                    {inTrash ? '복구' : '삭제'}
                  </button>
                </form>
              </div>
              <p className="badm-cmt-body">{c.body}</p>
              <a
                className="badm-cmt-post"
                href={blogAbsoluteUrl(blogPostHref(c.postId, ''))}
              >
                {c.postTitle}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 2: CSS 를 넣는다**

`admin.css` 끝에 추가:

```css
/* 블로그 댓글 관리 */
.badm-comments { list-style: none; margin: 18px 0 0; padding: 0; }
.badm-comments li {
  padding: 14px 16px; margin-bottom: 8px;
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-sm);
}
.badm-cmt-who { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.badm-cmt-who b { font-size: var(--fs-sm); }
.badm-cmt-who .ip, .badm-cmt-who time {
  font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute);
}
.badm-cmt-who form { margin-left: auto; }
.badm-cmt-body { margin: 0 0 8px; font-size: var(--fs-sm); color: var(--text-dim); white-space: pre-wrap; }
.badm-cmt-post { font-size: var(--fs-2xs); color: var(--text-mute); text-decoration: none; }
.badm-cmt-post:hover { color: var(--accent); text-decoration: underline; }
```

- [ ] **Step 3: 눈으로 확인하고 커밋**

| 확인 | 기대 |
|---|---|
| 목록 | 공개 블로그에 쓴 댓글이 보인다. IP 가 `121.135.*.*` |
| 삭제 | 목록에서 사라지고 **공개 글에서도 사라진다** |
| 휴지통 | 지운 댓글이 있다 |
| 복구 | 공개 글에 다시 나타난다 |

```bash
cd web && npm run lint && npm run type-check && npm test
git add web/src/app/admin/blog/comments web/src/app/styles/admin.css
git commit -m "feat(blog-admin): add comment moderation screen with trash"
```

---

### Task 11: 통계 대시보드

차트는 **라이브러리 없이 div 높이로** 그린다.

**Files:**
- Create: `web/src/app/admin/blog/stats/page.tsx`
- Create: `web/src/lib/statsChart.ts`
- Create: `web/src/lib/statsChart.test.ts`
- Modify: `web/src/app/styles/admin.css`

**Interfaces:**
- Produces: `barHeights(values: readonly number[], maxPercent?: number): number[]` — 최대값을 100% 로 둔 백분율

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`web/src/lib/statsChart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { barHeights } from './statsChart';

describe('barHeights', () => {
  it('최대값이 100 이 된다', () => {
    expect(barHeights([1, 2, 4])).toEqual([25, 50, 100]);
  });

  it('전부 0 이면 전부 0 이다 — 0 으로 나누지 않는다', () => {
    expect(barHeights([0, 0])).toEqual([0, 0]);
  });

  it('빈 배열은 빈 배열이다', () => {
    expect(barHeights([])).toEqual([]);
  });

  it('음수는 0 으로 본다', () => {
    expect(barHeights([-5, 10])).toEqual([0, 100]);
  });
});
```

- [ ] **Step 2: 실패를 확인하고 만든다**

```bash
cd web && npm test -- statsChart
```

`web/src/lib/statsChart.ts`:

```ts
/** 막대 높이를 백분율로 바꾼다. 최대값이 100 이 된다. 값이 전부 0 이면 전부 0 이다. */
export function barHeights(values: readonly number[]): number[] {
  const safe = values.map((v) => (v > 0 ? v : 0));
  const max = Math.max(0, ...safe);
  if (max === 0) return safe.map(() => 0);
  return safe.map((v) => Math.round((v / max) * 100));
}
```

- [ ] **Step 3: 대시보드를 만든다**

`web/src/app/admin/blog/stats/page.tsx`:

```tsx
import { getBlogDaily, getBlogDevices, getBlogReferrers } from '@/lib/blogAdmin';
import { getBlogStats } from '@/lib/blog';
import { barHeights } from '@/lib/statsChart';

export const dynamic = 'force-dynamic';

/** sns:x 처럼 접두사가 붙은 소스를 사람이 읽는 이름으로 바꾼다. */
function label(source: string): string {
  return source.startsWith('sns:') ? source.slice(4) : source;
}

export default async function AdminBlogStatsPage() {
  const [summary, daily, referrers, devices] = await Promise.all([
    getBlogStats(),
    getBlogDaily(30),
    getBlogReferrers(30),
    getBlogDevices(30),
  ]);

  const viewBars = barHeights(daily.map((d) => d.views));
  const deviceTotal = devices.reduce((sum, d) => sum + d.count, 0);

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Blog</div>
          <h1>통계</h1>
          <p className="admin-desc">
            방문자 대조값은 48시간 뒤 사라지고 숫자만 남습니다. 유입은 호스트만 보고 분류하며
            검색어는 어디에도 저장하지 않습니다.
          </p>
        </div>
      </div>

      {summary && (
        <div className="badm-kpi">
          {[
            ['오늘 조회', summary.todayViews],
            ['어제 조회', summary.yesterdayViews],
            ['누적 조회', summary.totalViews],
            ['오늘 방문', summary.todayVisitors],
            ['어제 방문', summary.yesterdayVisitors],
            ['누적 방문', summary.totalVisitors],
          ].map(([name, value]) => (
            <div key={String(name)}>
              <b>{Number(value).toLocaleString('ko-KR')}</b>
              <span>{name}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="badm-h2">최근 30일 조회수</h2>
      {daily.length === 0 ? (
        <div className="placeholder">아직 집계된 날이 없습니다.</div>
      ) : (
        <div className="badm-chart">
          {daily.map((point, i) => (
            <div key={point.date} className="badm-bar" title={`${point.date} · 조회 ${point.views} · 방문 ${point.visitors}`}>
              <i style={{ height: `${viewBars[i]}%` }} />
              <span>{point.date.slice(8)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="badm-two">
        <section>
          <h2 className="badm-h2">유입 경로</h2>
          {referrers.length === 0 ? <div className="placeholder">아직 없습니다.</div> : (
            <ul className="badm-rank">
              {referrers.map((r) => (
                <li key={r.source}><span>{label(r.source)}</span><b>{r.count}</b></li>
              ))}
            </ul>
          )}
          <p className="admin-desc">
            검색어(유입 키워드)는 만들지 않습니다 — referrer policy 때문에 대부분 비고,
            검색어는 민감할 수 있어 저장하지 않기로 했습니다.
          </p>
        </section>
        <section>
          <h2 className="badm-h2">디바이스</h2>
          {deviceTotal === 0 ? <div className="placeholder">아직 없습니다.</div> : (
            <ul className="badm-rank">
              {devices.map((d) => (
                <li key={d.source}>
                  <span>{d.source === 'mobile' ? '모바일' : 'PC'}</span>
                  <b>{Math.round((d.count / deviceTotal) * 100)}%</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 4: CSS 를 넣는다**

`admin.css` 끝에 추가:

```css
/* 블로그 통계 */
.badm-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-top: 18px; }
.badm-kpi > div {
  background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-sm);
  padding: 12px 14px; display: flex; flex-direction: column; gap: 2px;
}
.badm-kpi b { font-size: var(--fs-xl); font-variant-numeric: tabular-nums; }
.badm-kpi span { font-size: var(--fs-2xs); color: var(--text-mute); }

.badm-h2 { font-size: var(--fs-md); margin: 26px 0 10px; }
.badm-chart {
  display: flex; align-items: flex-end; gap: 3px; height: 180px;
  padding: 12px; background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-sm);
}
.badm-bar { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 4px; }
.badm-bar i { display: block; width: 100%; min-height: 2px; background: var(--accent); border-radius: 2px 2px 0 0; }
.badm-bar span { font-family: var(--mono); font-size: var(--fs-2xs); color: var(--text-mute); }

.badm-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
.badm-rank { list-style: none; margin: 0; padding: 0; }
.badm-rank li {
  display: flex; justify-content: space-between; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: var(--fs-sm);
}
.badm-rank b { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 5: 눈으로 확인한다**

공개 블로그에서 글을 몇 번 열어 데이터를 만든 뒤 `/admin/blog/stats` 를 본다.

| 확인 | 기대 |
|---|---|
| 숫자 줄 | 조회·방문 수가 오른다 |
| 30일 차트 | 오늘 막대가 선다. 값이 0 인 날은 최소 높이 |
| 유입 경로 | referer 없이 열면 `direct` 가 오른다 |
| 디바이스 | 브라우저를 모바일 UA 로 바꿔 열면 `모바일` 이 오른다 |

- [ ] **Step 6: 전체 검사와 커밋**

```bash
cd web && npm run lint && npm run type-check && npm test
cd ../spring/jaywiki && ./gradlew test
git add web/src/app/admin/blog web/src/lib/statsChart.ts web/src/lib/statsChart.test.ts web/src/app/styles/admin.css
git commit -m "feat(blog-admin): add stats dashboard without a chart library"
```

---

## 이 계획을 마치면

- 블로그가 **읽기 전용을 벗어난다.** 관리자 화면에서 글을 쓰고 고치고 지울 수 있다.
- **아직 안 된 것**: `blog.leneu.cloud` 연결과 운영 DB 이관.
  [runbook](../../blog-subdomain-setup-runbook.md) 실행 전에
  `scripts/ensure-blog-comment-salt-secret.sh` 를 먼저 돌린다.
- 인수인계 문서를 갱신한다 — 특히 아래 새 항목들.

### 이 라운드에서 새로 미뤄두는 것

1. **`GET /api/admin/services` 가 공개다.** `SecurityConfig` 의 `GET /api/**` permitAll 때문이다.
   닫으려면 `/admin/services` 서버 컴포넌트가 쿠키를 싣도록 같이 고쳐야 한다.
   블로그 쪽은 `/api/admin/blog/**` 명시 규칙으로 막았지만 이건 남는다.
2. **자식 카테고리 정렬 UI 가 없다.** 부모만 정렬한다. 자식이 생기면 같은 방식으로 붙인다.
3. **카테고리를 다른 부모로 옮길 수 없다.** 글이 딸린 카테고리 이동은 되돌리기 어려워 미뤘다.
4. **대표 이미지를 자산 id 문자열로 직접 입력한다.** 목록에서 고르는 UI 는 다음 라운드.
5. **예약 발행이 없다.** `published_at` 을 미래로 넣으면 공개 목록에 바로 뜬다 —
   막으려면 공개 쿼리에 `published_at <= now()` 를 더해야 한다.
6. `tb_blog_daily_stat` 의 `ref_search/ref_sns/ref_other` 와 새 `tb_blog_referrer_daily` 가
   같은 것을 두 번 센다. 새 테이블이 충분히 쌓이면 옛 컬럼을 지울 수 있다.
