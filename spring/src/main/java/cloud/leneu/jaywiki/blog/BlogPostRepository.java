package cloud.leneu.jaywiki.blog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface BlogPostRepository extends JpaRepository<BlogPost, Long> {

    /**
     * 2차 기준으로 id 를 두는 이유: publishedAt 이 같은 글이 실제로 생긴다. 초안 머리말에
     * 발행일을 자정으로 손수 적으면 같은 날 올린 글끼리 정확히 같은 값이 된다. 그때
     * 기준이 하나뿐이면 순서가 DB 가 주는 대로라, 나중에 올린 글이 아래로 가고
     * 페이지를 넘길 때 같은 글이 두 번 나오거나 빠질 수 있다.
     * 아래 neighbors 질의가 이미 (publishedAt desc, id desc) 로 이웃을 찾으므로
     * 목록이 같은 기준을 써야 「목록의 다음」과 「글 아래의 다음」이 어긋나지 않는다.
     */
    List<BlogPost> findByStatusOrderByPublishedAtDescIdDesc(String status);

    /**
     * 위의 전체 조회와 같은 순서를 페이지 단위로 준다. 전체 조회를 남겨 두는 이유는
     * 사이트맵이 모든 글의 주소를 필요로 하기 때문이다 -- 그쪽은 페이지로 자르면 안 된다.
     */
    Page<BlogPost> findByStatusOrderByPublishedAtDescIdDesc(String status, Pageable pageable);

    /** 콘텐츠 싱크는 id 를 모른다. 초안이 아는 것은 slug 뿐이다. */
    Optional<BlogPost> findBySlug(String slug);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from BlogPost p where p.slug = :slug")
    Optional<BlogPost> findBySlugForUpdate(@Param("slug") String slug);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from BlogPost p where p.id = :id")
    Optional<BlogPost> findByIdForUpdate(@Param("id") Long id);

    List<BlogPost> findByCategoryIdAndStatusOrderByPublishedAtDescIdDesc(Long categoryId, String status);

    Page<BlogPost> findByCategoryIdAndStatusOrderByPublishedAtDescIdDesc(Long categoryId, String status, Pageable pageable);

    long countByCategoryId(Long categoryId);

    boolean existsByBodyContaining(String value);

    boolean existsByCoverAssetId(String coverAssetId);

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

    /** 관리 목록. draft 가 위로 오도록 상태 → 최신 순으로 준다. */
    @Query("""
        select p from BlogPost p
        order by case when p.status = 'draft' then 0 else 1 end,
                 coalesce(p.publishedAt, p.updatedAt) desc, p.id desc
        """)
    List<BlogPost> findAllForAdmin();

    /** 조회수 내림차순. 동률은 최신 → id 로 끊어 매 호출 결과를 같게 만든다. */
    @Query("""
        select p from BlogPost p
        where p.status = 'published'
        order by p.viewCount desc, p.publishedAt desc, p.id desc
        """)
    List<BlogPost> findPopular(Pageable pageable);

    /**
     * 태그 하나에 달린 published 글. 발행 순으로 준다.
     *
     * 전에는 전체 글을 읽어 메모리에서 `ids.contains(...)` 로 걸렀다. `ids` 가 List 라
     * 글 하나마다 선형 탐색이 돌아 글 수 × 태그 글 수만큼 비교했다. 글이 열댓 편일 때는
     * 티가 안 나지만, 늘어날수록 곱으로 커지는 자리를 남겨 둘 이유가 없다.
     */
    @Query("""
        select p from BlogPost p
        where p.status = 'published'
          and exists (
            select 1 from BlogPostTag pt, BlogTag t
            where pt.postId = p.id and pt.tagId = t.id and t.name = :name
          )
        order by p.publishedAt desc, p.id desc
        """)
    List<BlogPost> findPublishedByTagName(@Param("name") String name);

    @Query("""
        select p from BlogPost p
        where p.status = 'published'
          and exists (
            select 1 from BlogPostTag pt, BlogTag t
            where pt.postId = p.id and pt.tagId = t.id and t.name = :name
          )
        order by p.publishedAt desc, p.id desc
        """)
    Page<BlogPost> findPublishedByTagName(@Param("name") String name, Pageable pageable);

    /**
     * 제목·요약·본문에서 검색어를 찾는다. 부분 문자열(ILIKE)이라 한국어 활용형도 걸린다 -
     * tsvector 의 simple 토크나이저는 "캐시를" 을 한 덩어리로 잘라 "캐시" 로 못 찾는다.
     *
     * 제목이 걸린 글을 위로 올린다. ILIKE 에는 점수가 없어 정렬 기준을 직접 준다.
     * :q 는 호출부에서 LIKE 특수문자를 escape 해 넘긴다(escape 문자는 역슬래시).
     *
     * ponytail: 인덱스 없는 전체 스캔이다. 발행 글 16편 279KB 기준 3.4ms 였다.
     * 본문이 수 MB 가 되면 pg_trgm GIN 인덱스나 OpenSearch 로 옮긴다.
     */
    @Query(value = """
        select * from tb_blog_post p
        where p.status = 'published'
          and (p.title ilike '%' || :q || '%' escape '\\'
            or p.summary ilike '%' || :q || '%' escape '\\'
            or p.body ilike '%' || :q || '%' escape '\\')
        order by case when p.title ilike '%' || :q || '%' escape '\\' then 0 else 1 end,
                 p.published_at desc, p.id desc
        """, nativeQuery = true)
    List<BlogPost> searchPublished(@Param("q") String q);

    /**
     * 위 검색의 페이지 판. 네이티브 질의라 건수 세는 질의를 따로 준다 --
     * Spring Data 가 order by 가 붙은 native SQL 에서 count 를 안전하게 유도하지 못한다.
     */
    @Query(value = """
        select * from tb_blog_post p
        where p.status = 'published'
          and (p.title ilike '%' || :q || '%' escape '\\'
            or p.summary ilike '%' || :q || '%' escape '\\'
            or p.body ilike '%' || :q || '%' escape '\\')
        order by case when p.title ilike '%' || :q || '%' escape '\\' then 0 else 1 end,
                 p.published_at desc, p.id desc
        """, countQuery = """
        select count(*) from tb_blog_post p
        where p.status = 'published'
          and (p.title ilike '%' || :q || '%' escape '\\'
            or p.summary ilike '%' || :q || '%' escape '\\'
            or p.body ilike '%' || :q || '%' escape '\\')
        """, nativeQuery = true)
    Page<BlogPost> searchPublished(@Param("q") String q, Pageable pageable);

    /** 카테고리별 published 글 수. tree() 가 카테고리 수만큼 count 쿼리를 날리지 않도록 한 번에 센다. */
    @Query("select p.categoryId, count(p) from BlogPost p where p.status = 'published' group by p.categoryId")
    List<Object[]> countPublishedGroupByCategory();
}
