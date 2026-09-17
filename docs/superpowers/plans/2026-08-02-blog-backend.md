# blog.leneu.cloud 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 블로그 전용 테이블 5개와 공개 읽기 API, 익명 댓글 API를 만들어 프론트가 붙을 수 있는 백엔드를 완성한다.

**Architecture:** 위키(`tb_article`)를 건드리지 않고 `tb_blog_*` 테이블을 새로 만든다. 시드도 revision도 두지 않고 PostgreSQL이 유일한 원본이다. 조회는 `GET /api/**`가 이미 공개이므로 자동으로 열리고, 익명 댓글만 `POST`를 명시적으로 허용한다. 클라이언트 IP 추출이 이미 두 곳에 중복돼 있어 공통 컴포넌트로 뽑아 재사용한다.

**Tech Stack:** Spring Boot 3.5, Java 21, JPA/Hibernate, Flyway, PostgreSQL 18, Lombok, JUnit5 + Testcontainers, AssertJ

## Global Constraints

- 설계 문서는 [2026-08-02-blog-leneu-cloud-design.md](../specs/2026-08-02-blog-leneu-cloud-design.md). 충돌하면 설계 문서가 기준이다.
- **블로그에 시드와 revision을 만들지 않는다.** 원본은 PostgreSQL 하나다.
- 패키지는 `cloud.leneu.jaywiki.blog`. 위키 패키지에 섞지 않는다.
- 엔티티는 `@Table(schema = "public", name = "tb_blog_*")`를 명시한다. 기존 엔티티가 모두 그렇게 한다.
- **JPA 연관 관계 매핑(`@ManyToOne`/`@OneToMany`/`@JoinColumn`)을 쓰지 않는다.** 이 저장소는 전체 코드에 0건이고, FK를 평범한 필드로 두고 호출부에서 조회를 통제한다.
- Lombok `@Getter/@Setter`, 서비스는 `@RequiredArgsConstructor`.
- 테스트 메서드명은 한글 스네이크. 예: `카테고리는_2단까지만_허용한다`.
- 통합 테스트는 `@SpringBootTest` + `@Import(TestcontainersConfiguration.class)`.
- Flyway 다음 번호는 **V13**이다. 현재 최대는 `V12__article_created_at.sql`. 새 마이그레이션을 추가하기 전 `ls | sort -V`로 실제 최대값을 다시 확인한다(사전순 `ls`는 V9 뒤에 V10을 놓지 않는다).
- 커밋 메시지는 이 저장소 형식을 따른다: `feat(blog): ...`, `refactor(auth): ...`.
- 각 태스크의 마지막 단계에서 `cd spring/jaywiki && ./gradlew test`로 **전체 테스트**를 돌린다. 현재 82개가 통과 중이며 하나도 깨뜨리지 않는다.

---

## File Structure

**신규 — `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/`**

| 파일 | 책임 |
|---|---|
| `BlogCategory.java` | `tb_blog_category` 엔티티 |
| `BlogCategoryRepository.java` | 카테고리 조회 |
| `BlogCategoryService.java` | 2단 제약 강제, 트리 조회, 카테고리별 글 수 |
| `BlogPost.java` | `tb_blog_post` 엔티티 |
| `BlogPostRepository.java` | 목록·카테고리별·태그별 조회 |
| `BlogPostService.java` | 목록/단건 조회, 이웃 글 |
| `BlogTag.java`, `BlogPostTag.java`, `BlogPostTagId.java` | 태그와 연결 |
| `BlogTagRepository.java`, `BlogPostTagRepository.java` | 태그 조회 |
| `BlogComment.java`, `BlogCommentRepository.java` | 댓글 |
| `BlogCommentService.java` | 댓글 작성·삭제, IP 가공 |
| `BlogController.java` | 공개 조회 API |
| `BlogCommentController.java` | 댓글 API |
| `dto/` | `BlogPostSummaryDto`, `BlogPostDto`, `BlogCategoryDto`, `BlogCommentDto`, `BlogCommentCreateRequest` |

**신규 — 공통**

| 파일 | 책임 |
|---|---|
| `common/ClientIpResolver.java` | `cf-connecting-ip` → `x-forwarded-for` → `remoteAddr` 순서로 클라이언트 IP를 뽑는다 |

**신규 — 마이그레이션**

`spring/jaywiki/src/main/resources/db/migration/V13__blog.sql`

**수정**

| 파일 | 변경 |
|---|---|
| `auth/SecurityConfig.java:45` 부근 | `POST /api/blog/**` permitAll 추가 |
| `board/BoardRateLimitInterceptor.java:50-61` | 중복 IP 추출 제거, `ClientIpResolver` 사용 |
| `auth/AuthController.java:158-165` | 동일 |
| `wiki/asset/WikiAssetService.java:73-78` | 자산 삭제 차단 검사에 블로그 본문 추가 |

**테스트**

| 파일 | 대상 |
|---|---|
| `blog/BlogCategoryServiceTest.java` | 2단 제약, 트리 정렬 |
| `blog/BlogPostQueryTest.java` | 목록·카테고리별·태그별·이웃 글 |
| `blog/BlogCommentServiceTest.java` | IP 가공, 암호 삭제 |
| `blog/BlogApiIntegrationTest.java` | 공개 조회, 익명 POST 허용, rate limit |
| `common/ClientIpResolverTest.java` | 헤더 우선순위 |
| `wiki/asset/WikiAssetBlogReferenceTest.java` | 블로그 본문이 자산을 붙잡는지 |

---

## Task 1: 스키마와 엔티티

**Files:**
- Create: `spring/jaywiki/src/main/resources/db/migration/V13__blog.sql`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCategory.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPost.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogTag.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostTag.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostTagId.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogComment.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCategoryRepository.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogSchemaTest.java`

**Interfaces:**
- Consumes: 없음
- Produces: 엔티티 6개와 `BlogCategoryRepository`. 이후 모든 태스크가 이 타입을 쓴다.
  - `BlogCategory`: `Long id`, `String slug`, `String name`, `String description`, `Long parentId`, `int sortOrder`, `OffsetDateTime createdAt`
  - `BlogPost`: `Long id`, `String slug`, `Long categoryId`, `String title`, `String summary`, `String body`, `String coverAssetId`, `String status`, `OffsetDateTime publishedAt`, `OffsetDateTime createdAt`, `OffsetDateTime updatedAt`
  - `BlogTag`: `Long id`, `String name`
  - `BlogPostTag`: `@IdClass(BlogPostTagId.class)`, `Long postId`, `Long tagId`
  - `BlogComment`: `Long id`, `Long postId`, `String authorName`, `String passwordHash`, `String body`, `String ipPrefix`, `String ipHash`, `OffsetDateTime createdAt`, `OffsetDateTime deletedAt`
  - `BlogCategoryRepository.findAllByOrderBySortOrderAsc()`, `findBySlug(String)`

- [ ] **Step 1: 마이그레이션 번호를 확인한다**

```bash
cd spring/jaywiki/src/main/resources/db/migration && ls | sort -V | tail -1
```

Expected: `V12__article_created_at.sql`. 다르면 그 다음 번호를 쓴다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogSchemaTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** V13 이 만든 테이블과 시드 카테고리를 확인한다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogSchemaTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired BlogCategoryRepository categories;

    @Test
    void 블로그_테이블_다섯개가_생성된다() {
        List<String> names = jdbc.queryForList("""
                select tablename from pg_tables
                where schemaname = 'public' and tablename like 'tb_blog%'
                order by tablename
                """, String.class);

        assertThat(names).containsExactly(
                "tb_blog_category", "tb_blog_comment", "tb_blog_post", "tb_blog_post_tag", "tb_blog_tag");
    }

    @Test
    void 카테고리_네개가_시드된다() {
        assertThat(categories.findAllByOrderBySortOrderAsc())
                .extracting(BlogCategory::getSlug)
                .containsExactly("personal-projects", "team-projects", "tech-lab", "tools-workflow");
    }

    @Test
    void 글이_있는_카테고리는_삭제되지_않는다() {
        Long categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
        jdbc.update("""
                insert into public.tb_blog_post
                    (slug, category_id, title, body, status, created_at, updated_at)
                values ('restrict-check', ?, '제목', '본문', 'draft', now(), now())
                """, categoryId);

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> jdbc.update("delete from public.tb_blog_category where id = ?", categoryId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);

        jdbc.update("delete from public.tb_blog_post where slug = 'restrict-check'");
    }
}
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogSchemaTest*'`
Expected: 컴파일 실패 — `BlogCategory`, `BlogCategoryRepository`를 찾을 수 없음

- [ ] **Step 4: 마이그레이션을 쓴다**

Create `spring/jaywiki/src/main/resources/db/migration/V13__blog.sql`:

```sql
-- ============================================================
-- V13: 블로그 (blog.leneu.cloud)
--   위키(tb_article)와 분리된 개인 글 저장소.
--   시드와 revision 을 두지 않는다. 원본은 이 테이블이고 안전망은 pg_dump 전체 백업이다.
--   카테고리는 최대 2단. 깊이 제약은 애플리케이션에서 강제한다(자기참조 깊이를 CHECK 로
--   표현하기 어렵고, 규칙이 코드에 있어야 오류 메시지를 낼 수 있다).
-- ============================================================

create table if not exists public.tb_blog_category (
    id          bigserial primary key,
    slug        text not null unique,            -- 영어. URL 에 그대로 쓴다
    name        text not null,                   -- 화면 표시명
    description text,
    parent_id   bigint references public.tb_blog_category(id) on delete restrict,
    sort_order  int  not null default 0,
    created_at  timestamptz not null default now()
);

create index if not exists idx_blog_category_parent
    on public.tb_blog_category (parent_id, sort_order);

create table if not exists public.tb_blog_post (
    id             bigserial primary key,        -- URL 의 숫자 id
    slug           text not null,                -- URL 뒤에 붙는 읽기용. 유일하지 않아도 된다
    category_id    bigint not null references public.tb_blog_category(id) on delete restrict,
    title          text not null,
    summary        text,
    body           text not null,
    cover_asset_id text,                         -- tb_article_asset.id. FK 없이 문자열로만 참조
    status         text not null default 'draft' check (status in ('draft', 'published')),
    published_at   timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_blog_post_published
    on public.tb_blog_post (status, published_at desc);
create index if not exists idx_blog_post_category
    on public.tb_blog_post (category_id, published_at desc);

create table if not exists public.tb_blog_tag (
    id   bigserial primary key,
    name text not null unique
);

create table if not exists public.tb_blog_post_tag (
    post_id bigint not null references public.tb_blog_post(id) on delete cascade,
    tag_id  bigint not null references public.tb_blog_tag(id)  on delete cascade,
    primary key (post_id, tag_id)
);

create index if not exists idx_blog_post_tag_tag
    on public.tb_blog_post_tag (tag_id, post_id);

create table if not exists public.tb_blog_comment (
    id            bigserial primary key,
    post_id       bigint not null references public.tb_blog_post(id) on delete cascade,
    author_name   text not null,
    password_hash text not null,                 -- BCrypt. 본인 삭제용
    body          text not null,
    ip_prefix     text not null,                 -- 표시용 앞 2옥텟. 예: 121.135
    ip_hash       text not null,                 -- 원본 IP + salt 의 hash. 원본은 저장하지 않는다
    created_at    timestamptz not null default now(),
    deleted_at    timestamptz
);

create index if not exists idx_blog_comment_post
    on public.tb_blog_comment (post_id, created_at);

-- 위키 LAB 탭과 같은 이름의 카테고리로 시작한다. 이관 대상이 이 넷이다.
insert into public.tb_blog_category (slug, name, description, sort_order) values
    ('personal-projects', '개인 프로젝트', '혼자 만들고 혼자 쓰는 것들.', 0),
    ('team-projects',     '팀 프로젝트',   '여럿이 만든 것과 그때 배운 것.', 1),
    ('tech-lab',          '기술 실험',     '재보고 확인한 기록.', 2),
    ('tools-workflow',    '도구·워크플로', '쓰는 도구와 일하는 방식.', 3)
on conflict (slug) do nothing;
```

- [ ] **Step 5: 엔티티 6개를 쓴다**

Create `blog/BlogCategory.java`:

```java
package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 블로그 카테고리 = public.tb_blog_category (V13).
 * 최대 2단. parentId 가 있는 행은 다시 부모가 될 수 없다(BlogCategoryService 가 강제).
 */
@Entity
@Table(schema = "public", name = "tb_blog_category")
@Getter
@Setter
public class BlogCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String slug;
    private String name;
    private String description;
    private Long parentId;
    private int sortOrder;
    private OffsetDateTime createdAt;
}
```

Create `blog/BlogPost.java`:

```java
package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 블로그 글 = public.tb_blog_post (V13).
 * id 가 URL 의 정본이고 slug 는 읽기용으로 뒤에 붙는다.
 * 위키와 달리 version 과 revision 이 없다. 원본은 이 행 하나다.
 */
@Entity
@Table(schema = "public", name = "tb_blog_post")
@Getter
@Setter
public class BlogPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String slug;
    private Long categoryId;
    private String title;
    private String summary;

    @Column(columnDefinition = "text")
    private String body;

    private String coverAssetId;
    private String status = "draft";
    private OffsetDateTime publishedAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
```

Create `blog/BlogTag.java`:

```java
package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** 태그 = public.tb_blog_tag. 위키의 콤마 문자열과 달리 정규화한다(태그별 글 수와 태그 페이지 때문). */
@Entity
@Table(schema = "public", name = "tb_blog_tag")
@Getter
@Setter
public class BlogTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
}
```

Create `blog/BlogPostTagId.java`:

```java
package cloud.leneu.jaywiki.blog;

import java.io.Serializable;
import java.util.Objects;

/** tb_blog_post_tag 의 복합 키. */
public class BlogPostTagId implements Serializable {
    private Long postId;
    private Long tagId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BlogPostTagId other)) return false;
        return Objects.equals(postId, other.postId) && Objects.equals(tagId, other.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(postId, tagId);
    }
}
```

Create `blog/BlogPostTag.java`:

```java
package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** 글과 태그의 연결 = public.tb_blog_post_tag. */
@Entity
@Table(schema = "public", name = "tb_blog_post_tag")
@IdClass(BlogPostTagId.class)
@Getter
@Setter
public class BlogPostTag {

    @Id
    private Long postId;

    @Id
    private Long tagId;
}
```

Create `blog/BlogComment.java`:

```java
package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 댓글 = public.tb_blog_comment. 로그인 없이 쓴다.
 * 원본 IP 는 저장하지 않는다. 표시용 ipPrefix(앞 2옥텟)와 차단용 ipHash 만 남긴다.
 */
@Entity
@Table(schema = "public", name = "tb_blog_comment")
@Getter
@Setter
public class BlogComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long postId;
    private String authorName;
    private String passwordHash;
    private String body;
    private String ipPrefix;
    private String ipHash;
    private OffsetDateTime createdAt;
    private OffsetDateTime deletedAt;
}
```

- [ ] **Step 6: 카테고리 repository 를 쓴다**

Create `blog/BlogCategoryRepository.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BlogCategoryRepository extends JpaRepository<BlogCategory, Long> {

    List<BlogCategory> findAllByOrderBySortOrderAsc();

    Optional<BlogCategory> findBySlug(String slug);

    List<BlogCategory> findByParentIdOrderBySortOrderAsc(Long parentId);

    boolean existsByParentId(Long parentId);
}
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogSchemaTest*'`
Expected: PASS (3개)

- [ ] **Step 8: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL. 기존 82개 + 신규 3개 = 85개, 실패 0

- [ ] **Step 9: 커밋**

```bash
git add spring/jaywiki/src/main/resources/db/migration/V13__blog.sql \
        spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): add blog tables and entities

카테고리·글·태그·연결·댓글 5개 테이블을 V13 으로 추가한다.
위키와 분리된 저장소이며 시드와 revision 을 두지 않는다.
글이 있는 카테고리는 on delete restrict 로 삭제를 막는다."
```

---

## Task 2: 카테고리 2단 제약과 트리 조회

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCategoryService.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogCategoryDto.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogCategoryServiceTest.java`

**Interfaces:**
- Consumes: `BlogCategory`, `BlogCategoryRepository` (Task 1)
- Produces:
  - `BlogCategoryService.tree()` → `List<BlogCategoryDto>` (부모만, `children` 채워짐)
  - `BlogCategoryService.create(String slug, String name, String description, Long parentId, int sortOrder)` → `BlogCategory`
  - `BlogCategoryService.bySlug(String slug)` → `BlogCategory` (없으면 `NotFoundException`)
  - `record BlogCategoryDto(Long id, String slug, String name, String description, int sortOrder, long postCount, List<BlogCategoryDto> children)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogCategoryServiceTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
import cloud.leneu.jaywiki.common.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogCategoryServiceTest {

    @Autowired BlogCategoryService service;

    @Test
    void 하위_카테고리를_한_단계까지_만들_수_있다() {
        BlogCategory parent = service.bySlug("tools-workflow");

        BlogCategory child = service.create("editors", "에디터", null, parent.getId(), 0);

        assertThat(child.getParentId()).isEqualTo(parent.getId());
    }

    @Test
    void 카테고리는_2단까지만_허용한다() {
        BlogCategory parent = service.bySlug("tech-lab");
        BlogCategory child = service.create("depth-child", "자식", null, parent.getId(), 0);

        // 자식을 부모로 지정하면 3단이 되므로 거부한다.
        assertThatThrownBy(() -> service.create("depth-grandchild", "손자", null, child.getId(), 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("2단");
    }

    @Test
    void 트리는_부모만_돌려주고_자식을_안에_담는다() {
        BlogCategory parent = service.bySlug("personal-projects");
        service.create("apps", "앱", null, parent.getId(), 0);

        BlogCategoryDto found = service.tree().stream()
                .filter(c -> c.slug().equals("personal-projects"))
                .findFirst()
                .orElseThrow();

        assertThat(found.children()).extracting(BlogCategoryDto::slug).contains("apps");
        assertThat(service.tree()).extracting(BlogCategoryDto::slug).doesNotContain("apps");
    }

    @Test
    void 없는_slug_는_NotFound_다() {
        assertThatThrownBy(() -> service.bySlug("nope")).isInstanceOf(NotFoundException.class);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogCategoryServiceTest*'`
Expected: 컴파일 실패 — `BlogCategoryService`, `BlogCategoryDto` 없음

- [ ] **Step 3: DTO 를 쓴다**

Create `blog/dto/BlogCategoryDto.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

import java.util.List;

/** 레일과 카테고리 화면이 쓰는 카테고리 표현. children 은 2단이므로 항상 잎이다. */
public record BlogCategoryDto(
        Long id,
        String slug,
        String name,
        String description,
        int sortOrder,
        long postCount,
        List<BlogCategoryDto> children
) {
}
```

- [ ] **Step 4: 서비스를 쓴다**

Create `blog/BlogCategoryService.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
import cloud.leneu.jaywiki.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 카테고리는 최대 2단이다. 깊이를 DB CHECK 로 표현하기 어려워 여기서 강제한다.
 * 규칙이 코드에 있어야 왜 거부됐는지 메시지로 설명할 수 있다.
 */
@Service
@RequiredArgsConstructor
public class BlogCategoryService {

    private final BlogCategoryRepository repo;
    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public BlogCategory bySlug(String slug) {
        return repo.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("blog category not found: " + slug));
    }

    @Transactional
    public BlogCategory create(String slug, String name, String description, Long parentId, int sortOrder) {
        if (parentId != null) {
            BlogCategory parent = repo.findById(parentId)
                    .orElseThrow(() -> new NotFoundException("parent category not found: " + parentId));
            if (parent.getParentId() != null) {
                throw new IllegalArgumentException("카테고리는 2단까지만 만들 수 있다: " + parent.getSlug());
            }
        }
        BlogCategory category = new BlogCategory();
        category.setSlug(slug);
        category.setName(name);
        category.setDescription(description);
        category.setParentId(parentId);
        category.setSortOrder(sortOrder);
        category.setCreatedAt(OffsetDateTime.now());
        return repo.save(category);
    }

    @Transactional(readOnly = true)
    public List<BlogCategoryDto> tree() {
        List<BlogCategory> all = repo.findAllByOrderBySortOrderAsc();
        return all.stream()
                .filter(c -> c.getParentId() == null)
                .map(parent -> toDto(parent, all))
                .toList();
    }

    private BlogCategoryDto toDto(BlogCategory parent, List<BlogCategory> all) {
        List<BlogCategoryDto> children = all.stream()
                .filter(c -> parent.getId().equals(c.getParentId()))
                .map(c -> new BlogCategoryDto(
                        c.getId(), c.getSlug(), c.getName(), c.getDescription(),
                        c.getSortOrder(), publishedCount(c.getId()), List.of()))
                .toList();
        return new BlogCategoryDto(
                parent.getId(), parent.getSlug(), parent.getName(), parent.getDescription(),
                parent.getSortOrder(), publishedCount(parent.getId()), children);
    }

    /**
     * 카테고리별 published 글 수.
     * BlogPostRepository 는 Task 3 에서 생기므로 여기서는 JdbcTemplate 로 센다.
     * 이 한 줄을 위해 인터페이스를 만들지 않는다.
     */
    private long publishedCount(Long categoryId) {
        Long count = jdbc.queryForObject("""
                select count(*) from public.tb_blog_post
                where category_id = ? and status = 'published'
                """, Long.class, categoryId);
        return count == null ? 0L : count;
    }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogCategoryServiceTest*'`
Expected: PASS (4개)

- [ ] **Step 6: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0

- [ ] **Step 7: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): enforce two-level category depth and expose tree

부모의 parentId 가 이미 있으면 거부해서 3단을 막는다.
깊이 제약을 DB CHECK 로 표현하기 어렵고, 코드에 있어야 거부 이유를 메시지로 낼 수 있다."
```

---

## Task 3: 글 조회

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostRepository.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostService.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogPostSummaryDto.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogPostDto.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogPostQueryTest.java`

**Interfaces:**
- Consumes: `BlogPost`, `BlogCategory`, `BlogCategoryRepository` (Task 1–2)
- Produces:
  - `BlogPostRepository.findByStatusOrderByPublishedAtDesc(String status)` → `List<BlogPost>`
  - `BlogPostRepository.findByCategoryIdAndStatusOrderByPublishedAtDesc(Long, String)` → `List<BlogPost>`
  - `BlogPostService.published()` → `List<BlogPostSummaryDto>`
  - `BlogPostService.byCategory(String slug)` → `List<BlogPostSummaryDto>`
  - `BlogPostService.get(Long id)` → `BlogPostDto` (없거나 draft면 `NotFoundException`)
  - `BlogPostService.neighbors(Long id)` → `Neighbors(BlogPostSummaryDto prev, BlogPostSummaryDto next)`
  - `record BlogPostSummaryDto(Long id, String slug, String title, String summary, String categorySlug, String categoryName, String coverAssetId, OffsetDateTime publishedAt)`
  - `record BlogPostDto(Long id, String slug, String title, String summary, String body, String categorySlug, String categoryName, String coverAssetId, OffsetDateTime publishedAt, List<String> tags)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogPostQueryTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import cloud.leneu.jaywiki.common.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogPostQueryTest {

    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired BlogPostService service;

    private Long labId;

    @BeforeEach
    void setUp() {
        posts.deleteAll();
        labId = categories.findBySlug("tech-lab").orElseThrow().getId();
    }

    private BlogPost save(String slug, String title, String status, String publishedAt) {
        BlogPost post = new BlogPost();
        post.setSlug(slug);
        post.setCategoryId(labId);
        post.setTitle(title);
        post.setSummary("요약");
        post.setBody("본문");
        post.setStatus(status);
        post.setPublishedAt(publishedAt == null ? null : OffsetDateTime.parse(publishedAt));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        return posts.save(post);
    }

    @Test
    void 목록은_발행된_글만_최신순으로_돌려준다() {
        save("old", "이전 글", "published", "2026-07-01T00:00:00Z");
        save("new", "최신 글", "published", "2026-08-01T00:00:00Z");
        save("hidden", "초안", "draft", null);

        assertThat(service.published()).extracting(BlogPostSummaryDto::slug)
                .containsExactly("new", "old");
    }

    @Test
    void 카테고리_목록은_그_카테고리_글만_돌려준다() {
        save("in", "여기 글", "published", "2026-08-01T00:00:00Z");

        BlogPost other = save("other", "다른 카테고리", "published", "2026-08-02T00:00:00Z");
        other.setCategoryId(categories.findBySlug("team-projects").orElseThrow().getId());
        posts.save(other);

        assertThat(service.byCategory("tech-lab")).extracting(BlogPostSummaryDto::slug)
                .containsExactly("in");
    }

    @Test
    void 단건_조회는_카테고리_이름을_함께_준다() {
        BlogPost saved = save("one", "글 하나", "published", "2026-08-01T00:00:00Z");

        BlogPostDto dto = service.get(saved.getId());

        assertThat(dto.title()).isEqualTo("글 하나");
        assertThat(dto.categorySlug()).isEqualTo("tech-lab");
        assertThat(dto.categoryName()).isEqualTo("기술 실험");
    }

    @Test
    void 초안은_공개_조회에서_보이지_않는다() {
        BlogPost draft = save("draft-one", "초안", "draft", null);

        assertThatThrownBy(() -> service.get(draft.getId())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void 이웃_글은_발행일_기준_앞뒤다() {
        BlogPost older = save("a", "이전", "published", "2026-07-01T00:00:00Z");
        BlogPost middle = save("b", "가운데", "published", "2026-07-15T00:00:00Z");
        BlogPost newer = save("c", "다음", "published", "2026-08-01T00:00:00Z");

        BlogPostService.Neighbors neighbors = service.neighbors(middle.getId());

        assertThat(neighbors.prev().id()).isEqualTo(older.getId());
        assertThat(neighbors.next().id()).isEqualTo(newer.getId());
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogPostQueryTest*'`
Expected: 컴파일 실패 — `BlogPostRepository`, `BlogPostService` 없음

- [ ] **Step 3: repository 를 쓴다**

Create `blog/BlogPostRepository.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface BlogPostRepository extends JpaRepository<BlogPost, Long> {

    List<BlogPost> findByStatusOrderByPublishedAtDesc(String status);

    List<BlogPost> findByCategoryIdAndStatusOrderByPublishedAtDesc(Long categoryId, String status);

    boolean existsByBodyContaining(String value);

    /** 발행일이 더 오래된 글 중 가장 최신. 동률은 id 로 끊어 매 호출 결과를 같게 만든다. */
    @Query("""
        select p from BlogPost p
        where p.status = 'published'
          and (p.publishedAt < :at or (p.publishedAt = :at and p.id < :id))
        order by p.publishedAt desc, p.id desc
        """)
    List<BlogPost> findPrev(@Param("at") OffsetDateTime at, @Param("id") Long id);

    @Query("""
        select p from BlogPost p
        where p.status = 'published'
          and (p.publishedAt > :at or (p.publishedAt = :at and p.id > :id))
        order by p.publishedAt asc, p.id asc
        """)
    List<BlogPost> findNext(@Param("at") OffsetDateTime at, @Param("id") Long id);

    Optional<BlogPost> findByIdAndStatus(Long id, String status);
}
```

- [ ] **Step 4: DTO 두 개를 쓴다**

Create `blog/dto/BlogPostSummaryDto.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;

/** 목록 한 줄. 본문을 담지 않는다. */
public record BlogPostSummaryDto(
        Long id,
        String slug,
        String title,
        String summary,
        String categorySlug,
        String categoryName,
        String coverAssetId,
        OffsetDateTime publishedAt
) {
}
```

Create `blog/dto/BlogPostDto.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** 글 화면. 본문과 태그를 포함한다. */
public record BlogPostDto(
        Long id,
        String slug,
        String title,
        String summary,
        String body,
        String categorySlug,
        String categoryName,
        String coverAssetId,
        OffsetDateTime publishedAt,
        List<String> tags
) {
}
```

- [ ] **Step 5: 서비스를 쓴다**

Create `blog/BlogPostService.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import cloud.leneu.jaywiki.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BlogPostService {

    private static final String PUBLISHED = "published";

    private final BlogPostRepository posts;
    private final BlogCategoryRepository categories;
    private final BlogCategoryService categoryService;

    /** 이전 글과 다음 글. 없으면 null 이다. */
    public record Neighbors(BlogPostSummaryDto prev, BlogPostSummaryDto next) {
    }

    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> published() {
        return toSummaries(posts.findByStatusOrderByPublishedAtDesc(PUBLISHED));
    }

    @Transactional(readOnly = true)
    public List<BlogPostSummaryDto> byCategory(String categorySlug) {
        BlogCategory category = categoryService.bySlug(categorySlug);
        return toSummaries(posts.findByCategoryIdAndStatusOrderByPublishedAtDesc(category.getId(), PUBLISHED));
    }

    @Transactional(readOnly = true)
    public BlogPostDto get(Long id) {
        BlogPost post = posts.findByIdAndStatus(id, PUBLISHED)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        BlogCategory category = categories.findById(post.getCategoryId())
                .orElseThrow(() -> new NotFoundException("blog category not found: " + post.getCategoryId()));
        return new BlogPostDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(), post.getBody(),
                category.getSlug(), category.getName(), post.getCoverAssetId(), post.getPublishedAt(),
                List.of());
    }

    @Transactional(readOnly = true)
    public Neighbors neighbors(Long id) {
        BlogPost post = posts.findByIdAndStatus(id, PUBLISHED)
                .orElseThrow(() -> new NotFoundException("blog post not found: " + id));
        Map<Long, BlogCategory> byId = categoryIndex();
        BlogPostSummaryDto prev = posts.findPrev(post.getPublishedAt(), post.getId())
                .stream().findFirst().map(p -> toSummary(p, byId)).orElse(null);
        BlogPostSummaryDto next = posts.findNext(post.getPublishedAt(), post.getId())
                .stream().findFirst().map(p -> toSummary(p, byId)).orElse(null);
        return new Neighbors(prev, next);
    }

    private List<BlogPostSummaryDto> toSummaries(List<BlogPost> found) {
        Map<Long, BlogCategory> byId = categoryIndex();
        return found.stream().map(p -> toSummary(p, byId)).toList();
    }

    /** 목록마다 카테고리를 한 번에 읽어 N+1 을 만들지 않는다. */
    private Map<Long, BlogCategory> categoryIndex() {
        return categories.findAll().stream()
                .collect(Collectors.toMap(BlogCategory::getId, Function.identity()));
    }

    private BlogPostSummaryDto toSummary(BlogPost post, Map<Long, BlogCategory> byId) {
        BlogCategory category = byId.get(post.getCategoryId());
        return new BlogPostSummaryDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(),
                category == null ? null : category.getSlug(),
                category == null ? null : category.getName(),
                post.getCoverAssetId(), post.getPublishedAt());
    }
}
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogPostQueryTest*'`
Expected: PASS (5개)

- [ ] **Step 7: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0

- [ ] **Step 8: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): add post queries for list, category and neighbors

published 만 공개하고 draft 는 NotFound 로 막는다.
목록은 카테고리를 한 번에 읽어 N+1 을 만들지 않는다."
```

---

## Task 4: 태그

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogTagRepository.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostTagRepository.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogTagService.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPostService.java` (`get()` 의 `List.of()` 를 실제 태그로)
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogTagServiceTest.java`

**Interfaces:**
- Consumes: `BlogPost`, `BlogTag`, `BlogPostTag`, `BlogPostService` (Task 1, 3)
- Produces:
  - `BlogTagService.attach(Long postId, List<String> names)` → `void` (없는 태그는 만들고, 빠진 연결은 지운다)
  - `BlogTagService.namesOf(Long postId)` → `List<String>` (이름 오름차순)
  - `BlogTagService.postIdsOf(String tagName)` → `List<Long>`
  - `record TagCount(String name, long count)`, `BlogTagService.counts()` → `List<TagCount>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogTagServiceTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogTagServiceTest {

    @Autowired BlogTagService tags;
    @Autowired BlogPostRepository posts;
    @Autowired BlogPostTagRepository postTags;
    @Autowired BlogCategoryRepository categories;

    private Long postId;

    @BeforeEach
    void setUp() {
        postTags.deleteAll();
        posts.deleteAll();
        BlogPost post = new BlogPost();
        post.setSlug("tagged");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("태그 붙은 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    @Test
    void 없는_태그는_만들고_이름순으로_돌려준다() {
        tags.attach(postId, List.of("swift", "macos", "iokit"));

        assertThat(tags.namesOf(postId)).containsExactly("iokit", "macos", "swift");
    }

    @Test
    void 다시_붙이면_빠진_태그의_연결이_사라진다() {
        tags.attach(postId, List.of("swift", "macos"));

        tags.attach(postId, List.of("swift"));

        assertThat(tags.namesOf(postId)).containsExactly("swift");
    }

    @Test
    void 같은_태그를_두_글에_붙여도_태그_행은_하나다() {
        tags.attach(postId, List.of("pwa"));

        assertThat(tags.postIdsOf("pwa")).containsExactly(postId);
        assertThat(tags.counts()).anySatisfy(c -> {
            assertThat(c.name()).isEqualTo("pwa");
            assertThat(c.count()).isEqualTo(1L);
        });
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogTagServiceTest*'`
Expected: 컴파일 실패 — `BlogTagService` 등 없음

- [ ] **Step 3: repository 두 개를 쓴다**

Create `blog/BlogTagRepository.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BlogTagRepository extends JpaRepository<BlogTag, Long> {
    Optional<BlogTag> findByName(String name);
    List<BlogTag> findByIdIn(List<Long> ids);
}
```

Create `blog/BlogPostTagRepository.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BlogPostTagRepository extends JpaRepository<BlogPostTag, BlogPostTagId> {

    List<BlogPostTag> findByPostId(Long postId);

    List<BlogPostTag> findByTagId(Long tagId);

    void deleteByPostId(Long postId);

    /** 태그별 published 글 수. 화면의 태그 목록에 쓴다. */
    @Query("""
        select t.name, count(pt.postId)
        from BlogPostTag pt, BlogTag t, BlogPost p
        where pt.tagId = t.id and pt.postId = p.id and p.status = 'published'
        group by t.name
        order by count(pt.postId) desc, t.name asc
        """)
    List<Object[]> countByTag();
}
```

- [ ] **Step 4: 서비스를 쓴다**

Create `blog/BlogTagService.java`:

```java
package cloud.leneu.jaywiki.blog;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * 태그는 정규화한다. 위키의 콤마 문자열로는 태그별 글 수와 태그 페이지를 만들 수 없다.
 */
@Service
@RequiredArgsConstructor
public class BlogTagService {

    private final BlogTagRepository tags;
    private final BlogPostTagRepository postTags;

    public record TagCount(String name, long count) {
    }

    /** 글의 태그를 주어진 목록으로 맞춘다. 없는 태그는 만들고, 빠진 연결은 지운다. */
    @Transactional
    public void attach(Long postId, List<String> names) {
        postTags.deleteByPostId(postId);
        names.stream().map(String::strip).filter(n -> !n.isEmpty()).distinct().forEach(name -> {
            BlogTag tag = tags.findByName(name).orElseGet(() -> {
                BlogTag created = new BlogTag();
                created.setName(name);
                return tags.save(created);
            });
            BlogPostTag link = new BlogPostTag();
            link.setPostId(postId);
            link.setTagId(tag.getId());
            postTags.save(link);
        });
    }

    @Transactional(readOnly = true)
    public List<String> namesOf(Long postId) {
        List<Long> tagIds = postTags.findByPostId(postId).stream().map(BlogPostTag::getTagId).toList();
        if (tagIds.isEmpty()) return List.of();
        return tags.findByIdIn(tagIds).stream()
                .map(BlogTag::getName)
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Long> postIdsOf(String tagName) {
        return tags.findByName(tagName)
                .map(tag -> postTags.findByTagId(tag.getId()).stream().map(BlogPostTag::getPostId).toList())
                .orElse(List.of());
    }

    @Transactional(readOnly = true)
    public List<TagCount> counts() {
        return postTags.countByTag().stream()
                .map(row -> new TagCount((String) row[0], ((Number) row[1]).longValue()))
                .toList();
    }
}
```

- [ ] **Step 5: 단건 조회가 실제 태그를 담게 고친다**

Modify `blog/BlogPostService.java`:

의존성에 `BlogTagService` 를 추가한다.

```java
    private final BlogPostRepository posts;
    private final BlogCategoryRepository categories;
    private final BlogCategoryService categoryService;
    private final BlogTagService tagService;
```

`get()` 의 마지막 인자를 바꾼다.

```java
        return new BlogPostDto(
                post.getId(), post.getSlug(), post.getTitle(), post.getSummary(), post.getBody(),
                category.getSlug(), category.getName(), post.getCoverAssetId(), post.getPublishedAt(),
                tagService.namesOf(post.getId()));
```

- [ ] **Step 6: 태그가 단건 조회에 담기는지 테스트를 추가한다**

Modify `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogTagServiceTest.java` — 아래 필드와 테스트를 추가한다.

```java
    @Autowired BlogPostService postService;

    @Test
    void 단건_조회에_태그가_담긴다() {
        tags.attach(postId, List.of("swift", "macos"));

        assertThat(postService.get(postId).tags()).containsExactly("macos", "swift");
    }
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogTagServiceTest*'`
Expected: PASS (4개)

- [ ] **Step 8: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0

- [ ] **Step 9: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): normalize tags and expose tag counts

위키의 콤마 문자열로는 태그별 글 수와 태그 페이지를 만들 수 없어 정규화한다.
attach 는 주어진 목록으로 연결을 맞추므로 빠진 태그의 연결이 사라진다."
```

---

## Task 5: 클라이언트 IP 추출 공통화

이 태스크는 새 기능이 아니라 **댓글이 IP를 다루기 전에 중복을 없애는 정리**다.
`BoardRateLimitInterceptor`와 `AuthController`에 같은 로직이 복사돼 있고, 댓글이 세 번째가 된다.

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/common/ClientIpResolver.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/board/BoardRateLimitInterceptor.java:50-61`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/auth/AuthController.java:158-165`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/common/ClientIpResolverTest.java`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `ClientIpResolver.resolve(HttpServletRequest)` → `String` (static)
  - `ClientIpResolver.prefix(String ip)` → `String` (IPv4는 앞 2옥텟, IPv6는 앞 2그룹, 그 외는 원본)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/common/ClientIpResolverTest.java`:

```java
package cloud.leneu.jaywiki.common;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cloudflare Tunnel 뒤라서 remoteAddr 는 프록시 주소다.
 * cf-connecting-ip 를 먼저 보지 않으면 모든 요청이 같은 IP 로 보인다.
 */
class ClientIpResolverTest {

    @Test
    void cf_connecting_ip_가_가장_우선이다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("cf-connecting-ip", "121.135.1.2");
        request.addHeader("x-forwarded-for", "10.0.0.1, 10.0.0.2");
        request.setRemoteAddr("172.16.0.1");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("121.135.1.2");
    }

    @Test
    void cf_헤더가_없으면_x_forwarded_for_의_첫_값을_쓴다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-forwarded-for", "203.0.113.7, 10.0.0.2");
        request.setRemoteAddr("172.16.0.1");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void 헤더가_없으면_remoteAddr_로_떨어진다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.16.0.1");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("172.16.0.1");
    }

    @Test
    void 표시용_앞자리는_IPv4_는_두_옥텟_IPv6_는_두_그룹이다() {
        assertThat(ClientIpResolver.prefix("121.135.1.2")).isEqualTo("121.135");
        assertThat(ClientIpResolver.prefix("2001:0db8:85a3::8a2e")).isEqualTo("2001:0db8");
        assertThat(ClientIpResolver.prefix("unknown")).isEqualTo("unknown");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*ClientIpResolverTest*'`
Expected: 컴파일 실패 — `ClientIpResolver` 없음

- [ ] **Step 3: 구현한다**

Create `common/ClientIpResolver.java`:

```java
package cloud.leneu.jaywiki.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

/**
 * 클라이언트 IP 추출. Cloudflare Tunnel 뒤라서 remoteAddr 는 프록시 주소이므로
 * cf-connecting-ip 를 먼저 본다. 이 로직이 rate limit, 로그인 시도 제한, 블로그 댓글
 * 세 곳에 필요해서 한 곳에 모았다.
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        String cfIp = request.getHeader("cf-connecting-ip");
        if (StringUtils.hasText(cfIp)) {
            return cfIp.trim();
        }
        String forwardedFor = request.getHeader("x-forwarded-for");
        if (StringUtils.hasText(forwardedFor)) {
            return forwardedFor.split(",", 2)[0].trim();
        }
        return request.getRemoteAddr();
    }

    /** 화면에 보여줄 앞자리. 이것만으로는 개인을 특정하지 못한다. */
    public static String prefix(String ip) {
        if (!StringUtils.hasText(ip)) return "";
        if (ip.contains(":")) {
            String[] groups = ip.split(":");
            return groups.length >= 2 ? groups[0] + ":" + groups[1] : ip;
        }
        String[] octets = ip.split("\\.");
        return octets.length >= 2 ? octets[0] + "." + octets[1] : ip;
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*ClientIpResolverTest*'`
Expected: PASS (4개)

- [ ] **Step 5: 기존 두 곳의 중복을 없앤다**

Modify `board/BoardRateLimitInterceptor.java` — `clientIp` private 메서드를 지우고 호출부를 바꾼다.

지울 것:

```java
    private String clientIp(HttpServletRequest request) {
        String cfIp = request.getHeader("cf-connecting-ip");
        if (StringUtils.hasText(cfIp)) {
            return cfIp.trim();
        }
        String forwardedFor = request.getHeader("x-forwarded-for");
        if (StringUtils.hasText(forwardedFor)) {
            return forwardedFor.split(",", 2)[0].trim();
        }
        return request.getRemoteAddr();
    }
```

`clientIp(request)` 호출을 `ClientIpResolver.resolve(request)` 로 바꾸고
`import cloud.leneu.jaywiki.common.ClientIpResolver;` 를 추가한다.
`StringUtils` import 가 더 쓰이지 않으면 지운다.

Modify `auth/AuthController.java` — `clientKey` private 메서드를 같은 방식으로 지우고
호출부를 `ClientIpResolver.resolve(request)` 로 바꾼다.

- [ ] **Step 6: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0.
`BoardRateLimitIntegrationTest`와 `AdminTotpIntegrationTest`가 통과하면 교체가 안전하다.

- [ ] **Step 7: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/common/ClientIpResolver.java \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/common/ClientIpResolverTest.java \
        spring/jaywiki/src/main/java/cloud/leneu/jaywiki/board/BoardRateLimitInterceptor.java \
        spring/jaywiki/src/main/java/cloud/leneu/jaywiki/auth/AuthController.java
git commit -m "refactor(common): extract ClientIpResolver from two duplicated copies

Cloudflare Tunnel 뒤라 remoteAddr 는 프록시 주소이므로 cf-connecting-ip 를 먼저 본다.
같은 로직이 rate limit 과 로그인 시도 제한에 복사돼 있었고 블로그 댓글이 세 번째가 된다.
표시용 앞자리 추출도 같이 둔다."
```

---

## Task 6: 댓글

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCommentRepository.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCommentService.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCommentProperties.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogConfig.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogCommentDto.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/dto/BlogCommentCreateRequest.java`
- Modify: `spring/jaywiki/src/main/resources/application.yml` (salt 기본값)
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogCommentServiceTest.java`

**Interfaces:**
- Consumes: `BlogPost`, `BlogPostRepository` (Task 1, 3), `ClientIpResolver` (Task 5)
- Produces:
  - `BlogCommentService.list(Long postId)` → `List<BlogCommentDto>` (삭제된 것 제외, 오래된 순)
  - `BlogCommentService.create(Long postId, BlogCommentCreateRequest req, String clientIp)` → `BlogCommentDto`
  - `BlogCommentService.delete(Long commentId, String password)` → `void` (틀리면 `IllegalArgumentException`)
  - `record BlogCommentDto(Long id, String authorName, String ipPrefix, String body, OffsetDateTime createdAt)`
  - `record BlogCommentCreateRequest(String authorName, String password, String body)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogCommentServiceTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogCommentCreateRequest;
import cloud.leneu.jaywiki.blog.dto.BlogCommentDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogCommentServiceTest {

    @Autowired BlogCommentService comments;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired JdbcTemplate jdbc;

    private Long postId;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from public.tb_blog_comment");
        posts.deleteAll();
        BlogPost post = new BlogPost();
        post.setSlug("commented");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("댓글 달릴 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    private BlogCommentCreateRequest req(String name, String password, String body) {
        return new BlogCommentCreateRequest(name, password, body);
    }

    @Test
    void 표시용_앞자리만_남고_원본_IP_는_저장되지_않는다() {
        comments.create(postId, req("지나가던개발자", "pw1234", "잘 봤습니다"), "121.135.99.7");

        List<BlogCommentDto> found = comments.list(postId);
        assertThat(found).hasSize(1);
        assertThat(found.get(0).ipPrefix()).isEqualTo("121.135");

        List<String> stored = jdbc.queryForList(
                "select ip_prefix || '|' || ip_hash from public.tb_blog_comment", String.class);
        assertThat(stored.get(0)).doesNotContain("121.135.99.7");
    }

    @Test
    void 같은_IP_는_같은_hash_다른_IP_는_다른_hash_다() {
        comments.create(postId, req("a", "pw1234", "첫째"), "121.135.99.7");
        comments.create(postId, req("b", "pw1234", "둘째"), "121.135.99.7");
        comments.create(postId, req("c", "pw1234", "셋째"), "203.0.113.7");

        List<String> hashes = jdbc.queryForList(
                "select ip_hash from public.tb_blog_comment order by id", String.class);
        assertThat(hashes.get(0)).isEqualTo(hashes.get(1));
        assertThat(hashes.get(2)).isNotEqualTo(hashes.get(0));
    }

    @Test
    void 암호가_맞아야_지워지고_목록에서_사라진다() {
        BlogCommentDto created = comments.create(postId, req("작성자", "pw1234", "지울 댓글"), "121.135.99.7");

        assertThatThrownBy(() -> comments.delete(created.id(), "wrong"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(comments.list(postId)).hasSize(1);

        comments.delete(created.id(), "pw1234");
        assertThat(comments.list(postId)).isEmpty();
    }

    @Test
    void 목록은_오래된_순이다() {
        comments.create(postId, req("첫째", "pw1234", "1"), "121.135.99.7");
        comments.create(postId, req("둘째", "pw1234", "2"), "121.135.99.7");

        assertThat(comments.list(postId)).extracting(BlogCommentDto::authorName)
                .containsExactly("첫째", "둘째");
    }

    @Test
    void 발행되지_않은_글에는_댓글을_달_수_없다() {
        BlogPost draft = new BlogPost();
        draft.setSlug("draft-post");
        draft.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        draft.setTitle("초안");
        draft.setBody("본문");
        draft.setStatus("draft");
        draft.setCreatedAt(OffsetDateTime.now());
        draft.setUpdatedAt(OffsetDateTime.now());
        Long draftId = posts.save(draft).getId();

        assertThatThrownBy(() -> comments.create(draftId, req("x", "pw1234", "안 됨"), "121.135.99.7"))
                .isInstanceOf(cloud.leneu.jaywiki.common.NotFoundException.class);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogCommentServiceTest*'`
Expected: 컴파일 실패 — `BlogCommentService` 없음

- [ ] **Step 3: DTO 두 개를 쓴다**

Create `blog/dto/BlogCommentDto.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;

/** 화면에 나가는 댓글. ipPrefix 는 앞 2옥텟이고 원본 IP 는 어디에도 담기지 않는다. */
public record BlogCommentDto(
        Long id,
        String authorName,
        String ipPrefix,
        String body,
        OffsetDateTime createdAt
) {
}
```

Create `blog/dto/BlogCommentCreateRequest.java`:

```java
package cloud.leneu.jaywiki.blog.dto;

/** 로그인 없이 쓰므로 이름과 암호를 함께 받는다. 암호는 본인 삭제용이다. */
public record BlogCommentCreateRequest(String authorName, String password, String body) {
}
```

- [ ] **Step 4: repository 와 설정을 쓴다**

Create `blog/BlogCommentRepository.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BlogCommentRepository extends JpaRepository<BlogComment, Long> {
    List<BlogComment> findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(Long postId);
}
```

Create `blog/BlogCommentProperties.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * salt 가 유출되면 IP 역산이 쉬워진다. 운영에서는 Kubernetes Secret 으로 주입하고
 * 코드나 설정 파일에 실제 값을 두지 않는다.
 */
@ConfigurationProperties(prefix = "app.blog-comment")
public record BlogCommentProperties(String ipSalt) {

    public BlogCommentProperties {
        if (ipSalt == null || ipSalt.isBlank()) {
            ipSalt = "local-dev-salt";
        }
    }
}
```

Modify `spring/jaywiki/src/main/resources/application.yml` — `app:` 키(47행)가 이미 있으므로
그 아래 `minio:` 와 같은 깊이에 추가한다. 환경변수 이름은 기존 `APP_MINIO_*` 관례를 따른다.

```yaml
app:
  # ... 기존 minio, admin, jwt 등은 그대로 두고 아래를 추가한다
  blog-comment:
    # salt 가 유출되면 IP 역산이 쉬워진다. 운영에서는 Secret 으로 주입한다.
    ip-salt: ${APP_BLOG_COMMENT_IP_SALT:local-dev-salt}
```

이 저장소는 `@ConfigurationPropertiesScan` 을 쓰지 않고 패키지마다 `@Configuration` 클래스에
`@EnableConfigurationProperties` 를 붙인다(`KafkaDemoConfig`, `ChatConfig`, `SagaConfig`, `OpenSearchConfig`).
같은 방식으로 `blog/BlogConfig.java` 를 만든다.

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(BlogCommentProperties.class)
class BlogConfig {
}
```

- [ ] **Step 5: 서비스를 쓴다**

Create `blog/BlogCommentService.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCommentCreateRequest;
import cloud.leneu.jaywiki.blog.dto.BlogCommentDto;
import cloud.leneu.jaywiki.common.ClientIpResolver;
import cloud.leneu.jaywiki.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;

/**
 * 로그인 없이 쓰는 댓글.
 * 원본 IP 는 저장하지 않는다. 표시용 앞 2옥텟과 차단용 salted hash 만 남긴다.
 * 식별 가능한 형태로 보관하지 않는 것이 목적이다.
 */
@Service
@RequiredArgsConstructor
public class BlogCommentService {

    private static final int MAX_NAME = 30;
    private static final int MAX_BODY = 1000;

    private final BlogCommentRepository comments;
    private final BlogPostRepository posts;
    private final BlogCommentProperties properties;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Transactional(readOnly = true)
    public List<BlogCommentDto> list(Long postId) {
        return comments.findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(postId).stream()
                .map(c -> new BlogCommentDto(
                        c.getId(), c.getAuthorName(), c.getIpPrefix(), c.getBody(), c.getCreatedAt()))
                .toList();
    }

    @Transactional
    public BlogCommentDto create(Long postId, BlogCommentCreateRequest request, String clientIp) {
        posts.findByIdAndStatus(postId, "published")
                .orElseThrow(() -> new NotFoundException("blog post not found: " + postId));
        require(request.authorName(), "이름을 입력해 주세요.");
        require(request.password(), "암호를 입력해 주세요.");
        require(request.body(), "내용을 입력해 주세요.");

        BlogComment comment = new BlogComment();
        comment.setPostId(postId);
        comment.setAuthorName(trim(request.authorName(), MAX_NAME));
        comment.setPasswordHash(passwordEncoder.encode(request.password()));
        comment.setBody(trim(request.body(), MAX_BODY));
        comment.setIpPrefix(ClientIpResolver.prefix(clientIp));
        comment.setIpHash(hash(clientIp));
        comment.setCreatedAt(OffsetDateTime.now());
        BlogComment saved = comments.save(comment);
        return new BlogCommentDto(
                saved.getId(), saved.getAuthorName(), saved.getIpPrefix(), saved.getBody(), saved.getCreatedAt());
    }

    @Transactional
    public void delete(Long commentId, String password) {
        BlogComment comment = comments.findById(commentId)
                .orElseThrow(() -> new NotFoundException("blog comment not found: " + commentId));
        if (comment.getDeletedAt() != null) {
            throw new NotFoundException("blog comment not found: " + commentId);
        }
        if (password == null || !passwordEncoder.matches(password, comment.getPasswordHash())) {
            throw new IllegalArgumentException("암호가 맞지 않습니다.");
        }
        comment.setDeletedAt(OffsetDateTime.now());
    }

    private static void require(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    private static String trim(String value, int max) {
        String stripped = value.strip();
        return stripped.length() <= max ? stripped : stripped.substring(0, max);
    }

    private String hash(String clientIp) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] out = digest.digest((properties.ipSalt() + "|" + clientIp).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogCommentServiceTest*'`
Expected: PASS (5개)

- [ ] **Step 7: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0

- [ ] **Step 8: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog \
        spring/jaywiki/src/main/resources/application.yml \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): add anonymous comments without storing raw IP

표시용 앞 2옥텟과 차단용 salted hash 만 남기고 원본 IP 는 저장하지 않는다.
식별 가능한 형태로 보관하지 않는 것이 목적이다. salt 는 운영에서 Secret 으로 주입한다.
삭제는 soft delete 이며 암호가 맞아야 한다."
```

---

## Task 7: 공개 API 와 rate limit

**Files:**
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogController.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogCommentController.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/auth/SecurityConfig.java:45` 부근
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/board/BoardRateLimitInterceptor.java` (`shouldLimit`)
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogApiIntegrationTest.java`

**Interfaces:**
- Consumes: `BlogCategoryService`, `BlogPostService`, `BlogTagService`, `BlogCommentService` (Task 2–6)
- Produces: 공개 HTTP API
  - `GET /api/blog/categories` → `List<BlogCategoryDto>`
  - `GET /api/blog/posts` → `List<BlogPostSummaryDto>`
  - `GET /api/blog/categories/{slug}/posts` → `List<BlogPostSummaryDto>`
  - `GET /api/blog/posts/{id}` → `BlogPostDto`
  - `GET /api/blog/posts/{id}/neighbors` → `BlogPostService.Neighbors`
  - `GET /api/blog/tags` → `List<BlogTagService.TagCount>`
  - `GET /api/blog/tags/{name}/posts` → `List<BlogPostSummaryDto>`
  - `GET /api/blog/posts/{id}/comments` → `List<BlogCommentDto>`
  - `POST /api/blog/posts/{id}/comments` → `BlogCommentDto`
  - `POST /api/blog/comments/{id}/delete` → 204

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogApiIntegrationTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 조회는 누구나, 댓글 작성도 로그인 없이 되어야 한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlogApiIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;

    private Long postId;

    @BeforeEach
    void setUp() {
        posts.deleteAll();
        BlogPost post = new BlogPost();
        post.setSlug("api-post");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("API 로 읽을 글");
        post.setSummary("요약");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    @Test
    void 카테고리와_목록은_인증_없이_읽힌다() throws Exception {
        mvc.perform(get("/api/blog/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("personal-projects"));

        mvc.perform(get("/api/blog/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("api-post"));
    }

    @Test
    void 단건_조회는_카테고리_이름을_준다() throws Exception {
        mvc.perform(get("/api/blog/posts/" + postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryName").value("기술 실험"));
    }

    @Test
    void 없는_글은_404_다() throws Exception {
        mvc.perform(get("/api/blog/posts/999999")).andExpect(status().isNotFound());
    }

    @Test
    void 댓글은_로그인_없이_작성되고_앞자리만_노출된다() throws Exception {
        mvc.perform(post("/api/blog/posts/" + postId + "/comments")
                        .header("cf-connecting-ip", "121.135.99.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"지나가던개발자","password":"pw1234","body":"잘 봤습니다"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ipPrefix").value("121.135"));

        mvc.perform(get("/api/blog/posts/" + postId + "/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].authorName").value("지나가던개발자"));
    }

    @Test
    void 암호가_틀리면_댓글이_지워지지_않는다() throws Exception {
        String created = mvc.perform(post("/api/blog/posts/" + postId + "/comments")
                        .header("cf-connecting-ip", "121.135.99.7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"작성자","password":"pw1234","body":"지울 댓글"}
                                """))
                .andReturn().getResponse().getContentAsString();
        long commentId = Long.parseLong(created.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mvc.perform(post("/api/blog/comments/" + commentId + "/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"wrong\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/blog/comments/" + commentId + "/delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"pw1234\"}"))
                .andExpect(status().isNoContent());
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogApiIntegrationTest*'`
Expected: 404 또는 401. 컨트롤러가 없다.

- [ ] **Step 3: 조회 컨트롤러를 쓴다**

Create `blog/BlogController.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSummaryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 블로그 공개 조회. GET /api/** 는 SecurityConfig 에서 이미 공개다. */
@RestController
@RequestMapping("/api/blog")
@RequiredArgsConstructor
public class BlogController {

    private final BlogCategoryService categoryService;
    private final BlogPostService postService;
    private final BlogTagService tagService;

    @GetMapping("/categories")
    public List<BlogCategoryDto> categories() {
        return categoryService.tree();
    }

    @GetMapping("/posts")
    public List<BlogPostSummaryDto> posts() {
        return postService.published();
    }

    @GetMapping("/categories/{slug}/posts")
    public List<BlogPostSummaryDto> byCategory(@PathVariable String slug) {
        return postService.byCategory(slug);
    }

    @GetMapping("/posts/{id}")
    public BlogPostDto post(@PathVariable Long id) {
        return postService.get(id);
    }

    @GetMapping("/posts/{id}/neighbors")
    public BlogPostService.Neighbors neighbors(@PathVariable Long id) {
        return postService.neighbors(id);
    }

    @GetMapping("/tags")
    public List<BlogTagService.TagCount> tags() {
        return tagService.counts();
    }

    @GetMapping("/tags/{name}/posts")
    public List<BlogPostSummaryDto> byTag(@PathVariable String name) {
        List<Long> ids = tagService.postIdsOf(name);
        return postService.published().stream().filter(p -> ids.contains(p.id())).toList();
    }
}
```

- [ ] **Step 4: 댓글 컨트롤러를 쓴다**

Create `blog/BlogCommentController.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCommentCreateRequest;
import cloud.leneu.jaywiki.blog.dto.BlogCommentDto;
import cloud.leneu.jaywiki.common.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/blog")
@RequiredArgsConstructor
public class BlogCommentController {

    private final BlogCommentService service;

    /** 삭제 요청 본문. DELETE 는 본문을 싣기 애매해 POST 로 받는다. */
    public record DeleteRequest(String password) {
    }

    @GetMapping("/posts/{id}/comments")
    public List<BlogCommentDto> list(@PathVariable Long id) {
        return service.list(id);
    }

    @PostMapping("/posts/{id}/comments")
    public BlogCommentDto create(@PathVariable Long id,
                                 @RequestBody BlogCommentCreateRequest body,
                                 HttpServletRequest request) {
        return service.create(id, body, ClientIpResolver.resolve(request));
    }

    @PostMapping("/comments/{id}/delete")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestBody DeleteRequest body) {
        service.delete(id, body.password());
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 5: 익명 POST 를 허용한다**

Modify `auth/SecurityConfig.java` — `POST /api/board/**` permitAll 줄 바로 아래에 추가한다.

```java
                .requestMatchers(HttpMethod.POST, "/api/board/**").permitAll() // 익명 게시판(작성/댓글/본인삭제)
                .requestMatchers(HttpMethod.POST, "/api/blog/**").permitAll()  // 익명 블로그 댓글(작성/본인삭제)
```

- [ ] **Step 6: rate limit 을 블로그로 넓힌다**

Modify `board/BoardRateLimitInterceptor.java` — `shouldLimit` 을 바꾼다.

```java
    private boolean shouldLimit(HttpServletRequest request) {
        if (!properties.isEnabled() || !HttpMethod.POST.matches(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        // 블로그 댓글도 로그인이 없으므로 같은 제한을 건다.
        return uri.startsWith("/api/board/") || uri.startsWith("/api/blog/");
    }
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogApiIntegrationTest*'`
Expected: PASS (5개)

- [ ] **Step 8: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0.
`BoardRateLimitIntegrationTest`가 통과하는지 특히 본다.

- [ ] **Step 9: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog \
        spring/jaywiki/src/main/java/cloud/leneu/jaywiki/auth/SecurityConfig.java \
        spring/jaywiki/src/main/java/cloud/leneu/jaywiki/board/BoardRateLimitInterceptor.java \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): expose public read API and anonymous comment endpoints

GET /api/** 는 이미 공개라 조회는 자동으로 열리고, 댓글 POST 만 명시적으로 허용한다.
로그인이 없으므로 기존 게시판 rate limit 을 /api/blog/ 로 넓혔다."
```

---

## Task 8: 자산 삭제 차단에 블로그 본문 추가

설계 자체 검토에서 발견한 결함이다. 지금 검사는 `tb_article.body`와 `tb_revision.body`만 본다.
블로그를 넣지 않으면 **블로그에서 쓰는 이미지가 삭제될 수 있다.**

**Files:**
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/wiki/asset/WikiAssetService.java:73-78`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/wiki/asset/WikiAssetBlogReferenceTest.java`

**Interfaces:**
- Consumes: `BlogPostRepository.existsByBodyContaining(String)` (Task 3)
- Produces: 없음 (기존 동작 확장)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/wiki/asset/WikiAssetBlogReferenceTest.java`:

```java
package cloud.leneu.jaywiki.wiki.asset;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.BlogCategoryRepository;
import cloud.leneu.jaywiki.blog.BlogPost;
import cloud.leneu.jaywiki.blog.BlogPostRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** 블로그 본문이 참조하는 자산은 지워지면 안 된다. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WikiAssetBlogReferenceTest {

    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired WikiAssetService assets;

    @Test
    void 블로그_본문이_참조하는_자산은_사용중으로_본다() {
        String assetId = "11111111-2222-3333-4444-555555555555";

        BlogPost post = new BlogPost();
        post.setSlug("with-image");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("이미지 있는 글");
        post.setBody("![구성도](" + WikiAssetReferences.path(assetId) + ")");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        posts.save(post);

        assertThat(assets.isReferencedAnywhere(assetId)).isTrue();

        posts.delete(post);
        assertThat(assets.isReferencedAnywhere(assetId)).isFalse();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*WikiAssetBlogReferenceTest*'`
Expected: 컴파일 실패 — `isReferencedAnywhere` 없음

- [ ] **Step 3: 참조 검사를 공개 메서드로 뽑고 블로그를 추가한다**

Modify `wiki/asset/WikiAssetService.java` — 의존성에 `BlogPostRepository` 를 추가하고,
현재 `delete` 안에 있는 참조 검사를 메서드로 뽑는다.

지금 코드:

```java
        String reference = WikiAssetReferences.path(id);
        if (articles.existsByBodyContaining(reference) || revisions.existsByBodyContaining(reference)) {
```

바꿀 코드:

```java
        if (isReferencedAnywhere(id)) {
```

그리고 아래 메서드를 추가한다.

```java
    /**
     * 이 자산을 참조하는 본문이 하나라도 있으면 true.
     * 위키 현재 본문, 위키 revision, 블로그 본문을 모두 본다.
     * revision 까지 보는 이유는 과거 버전으로 되돌렸을 때 깨진 이미지가 나오지 않게 하기 위해서다.
     */
    public boolean isReferencedAnywhere(String assetId) {
        String reference = WikiAssetReferences.path(assetId);
        return articles.existsByBodyContaining(reference)
                || revisions.existsByBodyContaining(reference)
                || blogPosts.existsByBodyContaining(reference);
    }
```

`private final BlogPostRepository blogPosts;` 를 필드에 추가한다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*WikiAssetBlogReferenceTest*'`
Expected: PASS

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0

- [ ] **Step 6: 커밋**

```bash
git add spring/jaywiki/src/main/java/cloud/leneu/jaywiki/wiki/asset/WikiAssetService.java \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/wiki/asset
git commit -m "fix(assets): block deletion of assets referenced by blog posts

참조 검사가 위키 본문과 revision 만 봐서 블로그에서 쓰는 이미지가 삭제될 수 있었다.
설계 자체 검토에서 발견했다."
```

---

## Task 9: 로컬 수동 확인

여기까지 오면 API가 완성된다. 프론트 작업 전에 실제로 응답하는지 사람이 한 번 본다.

**Files:** 없음 (검증만)

- [ ] **Step 1: 로컬 Spring 을 재기동한다**

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
# 기존 프로세스가 있으면 kill 한 뒤
cd spring/jaywiki && SPRING_PROFILES_ACTIVE=local APP_KAFKA_DEMO_ENABLED=true ./gradlew bootRun
```

- [ ] **Step 2: Flyway V13 이 적용됐는지 확인한다**

```bash
docker exec pf-postgres psql -U portfolio -d portfolio -c \
  "select version, description, success from flyway_schema_history order by installed_rank desc limit 2;"
```

Expected: `13 | blog | t`

- [ ] **Step 3: 테이블과 시드 카테고리를 확인한다**

```bash
docker exec pf-postgres psql -U portfolio -d portfolio \
  -c "\dt public.tb_blog*" \
  -c "select id, slug, name, parent_id, sort_order from tb_blog_category order by sort_order;"
```

Expected: 테이블 5개, 카테고리 4개

- [ ] **Step 4: 공개 API 를 호출한다**

```bash
curl -s http://localhost:8080/api/blog/categories | head -c 300; echo
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/blog/posts
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/blog/posts/999999
```

Expected: 카테고리 JSON, `200`, `404`

- [ ] **Step 5: 글 하나를 넣고 댓글을 달아 본다**

```bash
CAT=$(docker exec pf-postgres psql -U portfolio -d portfolio -tA -c \
  "select id from tb_blog_category where slug='tech-lab'")
POST=$(docker exec pf-postgres psql -U portfolio -d portfolio -tA -c \
  "insert into tb_blog_post (slug, category_id, title, summary, body, status, published_at, created_at, updated_at)
   values ('smoke','$CAT','스모크 글','요약','본문','published', now(), now(), now()) returning id")

curl -s -X POST "http://localhost:8080/api/blog/posts/$POST/comments" \
  -H 'content-type: application/json' \
  -H 'cf-connecting-ip: 121.135.99.7' \
  -d '{"authorName":"확인","password":"pw1234","body":"댓글 테스트"}'
echo
curl -s "http://localhost:8080/api/blog/posts/$POST/comments"; echo
```

Expected: 응답의 `ipPrefix` 가 `121.135`

- [ ] **Step 6: 원본 IP 가 저장되지 않았는지 직접 확인한다**

```bash
docker exec pf-postgres psql -U portfolio -d portfolio -c \
  "select author_name, ip_prefix, left(ip_hash, 16) as hash_head from tb_blog_comment;"
```

Expected: `ip_prefix` 는 `121.135`, 어디에도 `121.135.99.7` 이 없다

- [ ] **Step 7: 스모크 데이터를 지운다**

```bash
docker exec pf-postgres psql -U portfolio -d portfolio -c \
  "delete from tb_blog_post where slug = 'smoke';"
```

댓글은 `on delete cascade` 로 같이 사라진다. 확인:

```bash
docker exec pf-postgres psql -U portfolio -d portfolio -c "select count(*) from tb_blog_comment;"
```

Expected: `0`

- [ ] **Step 8: 결과를 기록한다**

`진행상황.md` 맨 위에 절을 추가한다. 확인한 항목과 실제 출력값을 적는다.
추정값을 쓰지 않는다.

- [ ] **Step 9: 커밋**

```bash
git add 진행상황.md
git commit -m "docs: record blog backend local verification

Flyway V13 적용, 테이블 5개와 카테고리 4개 시드, 공개 조회 200/404,
익명 댓글 작성과 ip_prefix 121.135 노출, 원본 IP 미저장을 로컬에서 확인했다."
```

---

---

## Task 10: 조회수와 일일 통계

관리자 화면에서 볼 통계의 **데이터 계층만** 만든다. 화면은 관리자 라운드로 미룬다.

설계 원칙은 하나다. **개별 식별자를 영구 저장하지 않는다.** 방문자 중복 제거는 Redis에서 하루치만
하고 TTL로 사라지게 하며, PostgreSQL에는 날짜별 집계 숫자만 남는다. 유입 경로는 받는 즉시
버킷으로 분류하고 원본 URL은 버린다.

**Files:**
- Create: `spring/jaywiki/src/main/resources/db/migration/V14__blog_stats.sql`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogDailyStat.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogDailyStatRepository.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogStatsService.java`
- Create: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogReferrerBucket.java`
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogPost.java` (viewCount 필드)
- Modify: `spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog/BlogController.java` (단건 조회 시 기록)
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogStatsServiceTest.java`
- Test: `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogReferrerBucketTest.java`

**Interfaces:**
- Consumes: `BlogPostRepository`, `BlogPostService` (Task 3), `ClientIpResolver` (Task 5),
  `BlogCommentProperties.ipSalt()` (Task 6), `BlogController` (Task 7)
- Produces:
  - `BlogReferrerBucket.classify(String referer)` → `BlogReferrerBucket` (`SEARCH` / `SNS` / `OTHER`)
  - `BlogStatsService.recordView(Long postId, String clientIp, String referer)` → `void`
  - `BlogStatsService.summary()` → `Summary`
  - `record Summary(long todayViews, long yesterdayViews, long totalViews, long todayVisitors, long yesterdayVisitors, long totalVisitors, long refSearch, long refSns, long refOther)`

> **마이그레이션 번호**: V13 을 다시 고치지 않고 **V14** 로 추가한다. V13 은 이미 두 번 리뷰를 거쳤고,
> 통계는 블로그 핵심 스키마와 별개 기능이다. 추가 전에 `ls spring/jaywiki/src/main/resources/db/migration | sort -V | tail -1`
> 로 실제 최대 번호를 확인한다.

- [ ] **Step 1: 유입 분류 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogReferrerBucketTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 유입 경로는 받는 즉시 버킷으로 줄인다. 원본 URL 은 저장하지 않는다. */
class BlogReferrerBucketTest {

    @Test
    void 검색엔진은_SEARCH_다() {
        assertThat(BlogReferrerBucket.classify("https://www.google.com/search?q=blog"))
                .isEqualTo(BlogReferrerBucket.SEARCH);
        assertThat(BlogReferrerBucket.classify("https://search.naver.com/search.naver?query=x"))
                .isEqualTo(BlogReferrerBucket.SEARCH);
    }

    @Test
    void 소셜은_SNS_다() {
        assertThat(BlogReferrerBucket.classify("https://x.com/someone/status/1"))
                .isEqualTo(BlogReferrerBucket.SNS);
        assertThat(BlogReferrerBucket.classify("https://www.linkedin.com/feed/"))
                .isEqualTo(BlogReferrerBucket.SNS);
    }

    @Test
    void 없거나_모르는_곳은_OTHER_다() {
        assertThat(BlogReferrerBucket.classify(null)).isEqualTo(BlogReferrerBucket.OTHER);
        assertThat(BlogReferrerBucket.classify("")).isEqualTo(BlogReferrerBucket.OTHER);
        assertThat(BlogReferrerBucket.classify("https://example.com/page"))
                .isEqualTo(BlogReferrerBucket.OTHER);
    }

    @Test
    void 깨진_URL_은_예외를_던지지_않고_OTHER_다() {
        assertThat(BlogReferrerBucket.classify("not a url")).isEqualTo(BlogReferrerBucket.OTHER);
    }

    @Test
    void 자기_사이트에서_온_이동은_OTHER_다() {
        assertThat(BlogReferrerBucket.classify("https://blog.leneu.cloud/6/some-post"))
                .isEqualTo(BlogReferrerBucket.OTHER);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogReferrerBucketTest*'`
Expected: 컴파일 실패 — `BlogReferrerBucket` 없음

- [ ] **Step 3: 분류기를 쓴다**

Create `blog/BlogReferrerBucket.java`:

```java
package cloud.leneu.jaywiki.blog;

import java.net.URI;
import java.util.List;
import java.util.Locale;

/**
 * 유입 경로를 세 갈래로만 줄인다. Referer 원본 URL 은 저장하지 않는다.
 * 방문자가 어디서 왔는지의 통계는 필요하지만, 어떤 페이지에서 왔는지까지 남길 이유가 없다.
 */
public enum BlogReferrerBucket {
    SEARCH,
    SNS,
    OTHER;

    private static final List<String> SEARCH_HOSTS = List.of(
            "google.", "naver.", "daum.", "bing.", "duckduckgo.", "yahoo.", "baidu.", "yandex.");
    private static final List<String> SNS_HOSTS = List.of(
            "x.com", "twitter.", "t.co", "facebook.", "instagram.", "threads.",
            "linkedin.", "reddit.", "news.ycombinator.com", "discord.");

    public static BlogReferrerBucket classify(String referer) {
        if (referer == null || referer.isBlank()) {
            return OTHER;
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
        if (SEARCH_HOSTS.stream().anyMatch(lower::contains)) {
            return SEARCH;
        }
        if (SNS_HOSTS.stream().anyMatch(lower::contains)) {
            return SNS;
        }
        return OTHER;
    }
}
```

- [ ] **Step 4: 분류 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogReferrerBucketTest*'`
Expected: PASS (5개)

- [ ] **Step 5: 통계 서비스 테스트를 쓴다**

Create `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogStatsServiceTest.java`:

```java
package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogStatsServiceTest {

    @Autowired BlogStatsService stats;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired JdbcTemplate jdbc;
    @Autowired StringRedisTemplate redis;

    private Long postId;

    @BeforeEach
    void setUp() {
        jdbc.update("delete from public.tb_blog_daily_stat");
        jdbc.update("delete from public.tb_blog_post where slug like 'stats-%'");
        Set<String> keys = redis.keys("blog:visitors:*");
        if (keys != null && !keys.isEmpty()) redis.delete(keys);

        BlogPost post = new BlogPost();
        post.setSlug("stats-post");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("통계용 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    @AfterEach
    void tearDown() {
        jdbc.update("delete from public.tb_blog_daily_stat");
        jdbc.update("delete from public.tb_blog_post where slug like 'stats-%'");
        Set<String> keys = redis.keys("blog:visitors:*");
        if (keys != null && !keys.isEmpty()) redis.delete(keys);
    }

    @Test
    void 조회하면_글과_오늘_조회수가_함께_증가한다() {
        stats.recordView(postId, "121.135.1.1", null);
        stats.recordView(postId, "121.135.1.1", null);

        assertThat(posts.findById(postId).orElseThrow().getViewCount()).isEqualTo(2L);
        assertThat(stats.summary().todayViews()).isEqualTo(2L);
    }

    @Test
    void 같은_방문자는_하루에_한_번만_센다() {
        stats.recordView(postId, "121.135.1.1", null);
        stats.recordView(postId, "121.135.1.1", null);
        stats.recordView(postId, "121.135.1.1", null);

        assertThat(stats.summary().todayViews()).isEqualTo(3L);
        assertThat(stats.summary().todayVisitors()).isEqualTo(1L);
    }

    @Test
    void 다른_방문자는_따로_센다() {
        stats.recordView(postId, "121.135.1.1", null);
        stats.recordView(postId, "203.0.113.9", null);

        assertThat(stats.summary().todayVisitors()).isEqualTo(2L);
    }

    @Test
    void 유입_채널이_버킷별로_쌓인다() {
        stats.recordView(postId, "121.135.1.1", "https://www.google.com/search?q=x");
        stats.recordView(postId, "203.0.113.9", "https://x.com/a/status/1");
        stats.recordView(postId, "198.51.100.4", null);

        BlogStatsService.Summary summary = stats.summary();
        assertThat(summary.refSearch()).isEqualTo(1L);
        assertThat(summary.refSns()).isEqualTo(1L);
        assertThat(summary.refOther()).isEqualTo(1L);
    }

    @Test
    void 방문자_식별자는_원본_IP_로_저장되지_않는다() {
        stats.recordView(postId, "121.135.1.1", null);

        Set<String> keys = redis.keys("blog:visitors:*");
        assertThat(keys).isNotEmpty();
        for (String key : keys) {
            Set<String> members = redis.opsForSet().members(key);
            assertThat(members).isNotNull();
            assertThat(members).noneMatch(m -> m.contains("121.135.1.1"));
        }
    }

    @Test
    void 방문자_집합에는_만료가_걸려_있다() {
        stats.recordView(postId, "121.135.1.1", null);

        Set<String> keys = redis.keys("blog:visitors:*");
        assertThat(keys).isNotEmpty();
        for (String key : keys) {
            Long ttl = redis.getExpire(key);
            assertThat(ttl).isNotNull();
            assertThat(ttl).isGreaterThan(0L);
        }
    }
}
```

- [ ] **Step 6: 테스트가 실패하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogStatsServiceTest*'`
Expected: 컴파일 실패 — `BlogStatsService`, `BlogPost.getViewCount()` 없음

- [ ] **Step 7: 마이그레이션을 쓴다**

Create `spring/jaywiki/src/main/resources/db/migration/V14__blog_stats.sql`:

```sql
-- ============================================================
-- V14: 블로그 조회수와 일일 통계
--   개별 식별자를 영구 저장하지 않는다. 방문자 중복 제거는 Redis 에서 하루치만 하고
--   TTL 로 사라지며, 여기에는 날짜별 집계 숫자만 남는다.
--   유입 경로는 받는 즉시 버킷으로 분류하고 원본 URL 은 버린다.
-- ============================================================

alter table public.tb_blog_post
    add column if not exists view_count bigint not null default 0;

create table if not exists public.tb_blog_daily_stat (
    stat_date  date primary key,
    views      bigint not null default 0,
    visitors   bigint not null default 0,
    ref_search bigint not null default 0,
    ref_sns    bigint not null default 0,
    ref_other  bigint not null default 0
);
```

- [ ] **Step 8: 엔티티와 repository 를 쓴다**

Modify `blog/BlogPost.java` — 필드를 추가한다.

```java
    /** 글별 누적 조회수. 게시판과 달리 Redis 에 쌓아두지 않고 바로 올린다(flush 배치가 없어 유실되던 문제를 피한다). */
    private long viewCount;
```

Create `blog/BlogDailyStat.java`:

```java
package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/** 날짜별 집계 = public.tb_blog_daily_stat. 개별 방문자 식별자는 여기에 없다. */
@Entity
@Table(schema = "public", name = "tb_blog_daily_stat")
@Getter
@Setter
public class BlogDailyStat {

    @Id
    private LocalDate statDate;

    private long views;
    private long visitors;
    private long refSearch;
    private long refSns;
    private long refOther;
}
```

Create `blog/BlogDailyStatRepository.java`:

```java
package cloud.leneu.jaywiki.blog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Optional;

public interface BlogDailyStatRepository extends JpaRepository<BlogDailyStat, LocalDate> {

    Optional<BlogDailyStat> findByStatDate(LocalDate statDate);

    @Query("select coalesce(sum(s.views), 0) from BlogDailyStat s")
    long totalViews();

    @Query("select coalesce(sum(s.visitors), 0) from BlogDailyStat s")
    long totalVisitors();

    @Query("select coalesce(sum(s.refSearch), 0) from BlogDailyStat s")
    long totalSearch();

    @Query("select coalesce(sum(s.refSns), 0) from BlogDailyStat s")
    long totalSns();

    @Query("select coalesce(sum(s.refOther), 0) from BlogDailyStat s")
    long totalOther();
}
```

- [ ] **Step 9: 통계 서비스를 쓴다**

Create `blog/BlogStatsService.java`:

```java
package cloud.leneu.jaywiki.blog;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HexFormat;

/**
 * 조회수와 일일 통계.
 *
 * 방문자 중복 제거는 Redis 집합에서 하루치만 한다. 집합에 넣는 값은
 * hash(salt + 날짜 + IP) 라서 원본 IP 가 없고, 날짜가 섞여 있어 다음 날에는 같은 사람인지
 * 대조할 수 없다. 48시간 TTL 로 사라지고 PostgreSQL 에는 숫자만 남는다.
 */
@Service
@RequiredArgsConstructor
public class BlogStatsService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Duration VISITOR_TTL = Duration.ofHours(48);

    private final JdbcTemplate jdbc;
    private final BlogDailyStatRepository dailyStats;
    private final StringRedisTemplate redis;
    private final BlogCommentProperties properties;

    public record Summary(
            long todayViews, long yesterdayViews, long totalViews,
            long todayVisitors, long yesterdayVisitors, long totalVisitors,
            long refSearch, long refSns, long refOther
    ) {
    }

    /** 글 한 번 조회를 기록한다. 글이 없으면 호출하지 않는다(컨트롤러가 조회 성공 뒤에만 부른다). */
    @Transactional
    public void recordView(Long postId, String clientIp, String referer) {
        LocalDate today = LocalDate.now(KST);
        jdbc.update("update public.tb_blog_post set view_count = view_count + 1 where id = ?", postId);

        boolean newVisitor = markVisitor(today, clientIp);
        String bucketColumn = switch (BlogReferrerBucket.classify(referer)) {
            case SEARCH -> "ref_search";
            case SNS -> "ref_sns";
            case OTHER -> "ref_other";
        };

        jdbc.update("""
                insert into public.tb_blog_daily_stat (stat_date, views, visitors, %s)
                values (?, 1, ?, 1)
                on conflict (stat_date) do update set
                    views = public.tb_blog_daily_stat.views + 1,
                    visitors = public.tb_blog_daily_stat.visitors + excluded.visitors,
                    %s = public.tb_blog_daily_stat.%s + 1
                """.formatted(bucketColumn, bucketColumn, bucketColumn),
                today, newVisitor ? 1 : 0);
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        LocalDate today = LocalDate.now(KST);
        BlogDailyStat todayRow = dailyStats.findByStatDate(today).orElse(null);
        BlogDailyStat yesterdayRow = dailyStats.findByStatDate(today.minusDays(1)).orElse(null);
        return new Summary(
                todayRow == null ? 0 : todayRow.getViews(),
                yesterdayRow == null ? 0 : yesterdayRow.getViews(),
                dailyStats.totalViews(),
                todayRow == null ? 0 : todayRow.getVisitors(),
                yesterdayRow == null ? 0 : yesterdayRow.getVisitors(),
                dailyStats.totalVisitors(),
                dailyStats.totalSearch(), dailyStats.totalSns(), dailyStats.totalOther());
    }

    /** 오늘 처음 본 방문자면 true. 집합에는 hash 만 들어가고 48시간 뒤 사라진다. */
    private boolean markVisitor(LocalDate day, String clientIp) {
        String key = "blog:visitors:" + day;
        Long added = redis.opsForSet().add(key, visitorToken(day, clientIp));
        redis.expire(key, VISITOR_TTL);
        return added != null && added == 1L;
    }

    private String visitorToken(LocalDate day, String clientIp) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String material = properties.ipSalt() + "|" + day + "|" + clientIp;
            return HexFormat.of().formatHex(digest.digest(material.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

- [ ] **Step 10: 테스트가 통과하는지 확인한다**

Run: `cd spring/jaywiki && ./gradlew test --tests '*BlogStatsServiceTest*'`
Expected: PASS (6개)

- [ ] **Step 11: 단건 조회에서 기록하도록 컨트롤러를 연결한다**

Modify `blog/BlogController.java` — `BlogStatsService` 를 주입하고 단건 조회를 바꾼다.
글을 찾지 못하면 `postService.get` 이 먼저 던지므로, 기록은 성공한 뒤에만 일어난다.

```java
    @GetMapping("/posts/{id}")
    public BlogPostDto post(@PathVariable Long id, HttpServletRequest request) {
        BlogPostDto found = postService.get(id);
        stats.recordView(id, ClientIpResolver.resolve(request), request.getHeader("referer"));
        return found;
    }
```

필요한 import 는 `jakarta.servlet.http.HttpServletRequest`, `cloud.leneu.jaywiki.common.ClientIpResolver` 다.

- [ ] **Step 12: 없는 글 조회가 통계에 안 잡히는지 확인하는 테스트를 추가한다**

Modify `spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog/BlogApiIntegrationTest.java` — 아래를 추가한다.
`BlogStatsService` 를 `@Autowired` 로 주입하고, 기존 `@BeforeEach` 는 그대로 둔다.

```java
    @Autowired BlogStatsService stats;

    @Test
    void 없는_글_조회는_통계에_잡히지_않는다() throws Exception {
        long before = stats.summary().totalViews();

        mvc.perform(get("/api/blog/posts/999999")).andExpect(status().isNotFound());

        assertThat(stats.summary().totalViews()).isEqualTo(before);
    }

    @Test
    void 글을_조회하면_조회수가_올라간다() throws Exception {
        long before = stats.summary().totalViews();

        mvc.perform(get("/api/blog/posts/" + postId).header("cf-connecting-ip", "121.135.1.1"))
                .andExpect(status().isOk());

        assertThat(stats.summary().totalViews()).isEqualTo(before + 1);
    }
```

`import static org.assertj.core.api.Assertions.assertThat;` 가 필요하다.
이 테스트가 남기는 통계 행은 `@AfterEach` 에서 지운다.

- [ ] **Step 13: 전체 테스트를 돌린다**

Run: `cd spring/jaywiki && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0

- [ ] **Step 14: 커밋**

```bash
git add spring/jaywiki/src/main/resources/db/migration/V14__blog_stats.sql \
        spring/jaywiki/src/main/java/cloud/leneu/jaywiki/blog \
        spring/jaywiki/src/test/java/cloud/leneu/jaywiki/blog
git commit -m "feat(blog): count views and daily stats without storing identifiers

방문자 중복 제거는 Redis 집합에서 하루치만 하고 48시간 TTL 로 사라진다.
집합에 넣는 값은 hash(salt + 날짜 + IP) 라 원본 IP 가 없고 날짜가 섞여 있어
다음 날에는 같은 사람인지 대조할 수 없다. PostgreSQL 에는 날짜별 숫자만 남는다.
유입 경로는 받는 즉시 검색/SNS/기타로 분류하고 원본 URL 은 버린다.
조회수는 게시판과 달리 Redis 에 쌓지 않고 컬럼을 바로 올린다(flush 배치가 없어 유실되던 문제를 피한다)."
```


## Self-Review

**Spec coverage**

| 설계 문서 절 | 이 계획의 태스크 |
|---|---|
| 4. 콘텐츠 수명주기 (시드·revision 없음) | Task 1 — 시드 스크립트도 revision 테이블도 만들지 않는다 |
| 5. 데이터 모델 (테이블 5개, 인덱스) | Task 1 |
| 5. 카테고리 최대 2단 | Task 2 |
| 5. 태그 정규화 | Task 4 |
| 5. 자산 삭제 차단에 블로그 추가 | Task 8 |
| 8. 댓글, IP 앞 2옥텟 + salted hash | Task 5, 6 |
| 8. rate limit 재사용 | Task 7 |
| 11. 테스트 표의 백엔드 항목 | Task 1(카테고리 restrict), 2(2단), 6(IP·암호), 8(자산) |
| 7. 레일의 `인기 글` 기준 (설계 12절 열린 항목) | Task 10 — 글별 조회수로 해소 |

**설계 문서 이후 추가된 것** — Task 10(조회수·일일 통계)은 설계 확정 뒤 사용자가 요청한 범위다.
설계 12절의 "인기 글 기준이 없다"는 열린 항목을 닫는다. 관리자 통계 **화면**은 관리자 라운드로 남는다.

**이 계획에 없는 것** — 설계 문서의 아래 항목은 **프론트 계획**에서 다룬다.
3절 호스트 rewrite, 6절 주소·301·sitemap, 7절 화면, 9절 검색·noindex, 10절 이관 스크립트.
백업(4절)은 추가 작업이 없어 태스크가 없다.

**Placeholder scan** — TBD·TODO 없음. 모든 코드 단계에 실제 코드가 있다.
Task 6 Step 4의 `application.yml`은 기존 `app:` 키 존재 여부에 따라 달라지므로
확인 방법을 함께 적었다.

**Type consistency** — `BlogPostSummaryDto`, `BlogPostDto`, `BlogCategoryDto`,
`BlogCommentDto`, `BlogCommentCreateRequest`, `Neighbors`, `TagCount` 의 필드명이
정의된 태스크와 사용하는 태스크에서 일치한다. `existsByBodyContaining` 은 Task 3에서
`BlogPostRepository` 에 정의하고 Task 8에서 쓴다. `ClientIpResolver.resolve/prefix` 는
Task 5에서 정의하고 Task 6·7에서 쓴다.

**알려진 위험**

- 사전 점검에서 해소한 것: `application.yml` 의 `app:` 키 존재(47행), Properties 등록 방식
  (`@EnableConfigurationProperties`), 그리고 Task 2 에서 인터페이스 하나짜리 추상화를
  없애고 `JdbcTemplate` 직접 조회로 바꾼 것.
- Task 7의 `byTag` 는 전체 목록을 읽고 필터링한다. 글이 수백 편이 되면 쿼리로 바꿔야 한다.
  지금은 8편이라 문제되지 않으며, 바꿔야 할 시점을 여기 적어 둔다.
