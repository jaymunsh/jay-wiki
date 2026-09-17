package cloud.leneu.jaywiki.wiki;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 위키 문서 저장소.
 * JpaRepository 가 기본 CRUD(save/findById/findAll ...) 를 자동 제공하고,
 * 검색만 커스텀 JPQL 로 추가한다.
 */
public interface WikiArticleRepository extends JpaRepository<WikiArticle, String> {
    boolean existsByBodyContaining(String value);

    /**
     * OpenSearch 가 응답하지 않을 때 쓰는 위키 검색 fallback = 단순 LIKE
     * (published 문서의 제목/본문에서 부분일치).
     * - 느리지만 trigram GIN 인덱스(V1)가 어느 정도 보조.
     * - 워크북 03B에서 PG tsvector / OpenSearch nori 와 '검색 비교' 로 발전.
     *
     * 정렬은 예전에 lastReview 내림차순이었다. 그런데 lastReview 는 시드의 REVIEW_DATE 상수를
     * 일괄로 넣은 값이라 전체 문서의 대부분이 같은 날짜다. 정렬 기준이 있는 것처럼 보이지만
     * 실제로는 동률이라, 상위 결과의 순서를 PostgreSQL 이 반환하는 대로 두는 것과 같았다.
     *
     * 대신 제목 일치를 본문 일치보다 앞에 둔다. 점수 함수가 없는 fallback 에서
     * 이만큼이 근거를 갖고 말할 수 있는 최소한의 관련도다. 남은 동률은 최근 수정 순으로,
     * 그래도 같으면 slug 로 끊어 매 호출에 같은 순서가 나오게 한다.
     */
    @Query("""
        select a from WikiArticle a
        where a.status = 'published'
          and ( lower(a.title) like lower(concat('%', :q, '%'))
             or lower(a.body)  like lower(concat('%', :q, '%')) )
        order by
          case when lower(a.title) like lower(concat('%', :q, '%')) then 0 else 1 end,
          a.updatedAt desc,
          a.slug asc
        """)
    List<WikiArticle> search(@Param("q") String q);

    /**
     * 탭 안의 문서 순서 = 발행일(createdAt) 내림차순이 우선.
     *
     * 예전에는 updatedAt 을 썼다. 새로 고친 글이 위로 올라와 무엇이 살아 있는 문서인지 보이게 하려던
     * 것인데, 시드가 필드 diff 로 바뀐 글만 저장하므로 문체 하나만 고쳐도 그 글이 맨 위로 뛴다.
     * 60편을 한 번에 손댄 뒤에는 목록 전체가 같은 시각으로 뭉쳐 신호가 아예 사라졌다.
     *
     * 목록이 화면에 보여주는 값도 발행일이다. 표시와 정렬 기준이 다르면 날짜가 뒤죽박죽으로 보인다.
     *
     * createdAt 은 ArticleService 가 신규 분기에서만 채우므로 수정에도 흔들리지 않는다.
     * 다만 시드 파일 최초 커밋 날짜로 백필한 값이라 동률이 크다(verification 은 7편 중 5편이 동률).
     * 동률은 sortOrder 로 끊는다 — 손으로 정돈한 값이고 탭 안에 중복이 없어 결정적이다.
     */
    List<WikiArticle> findByParentIdOrderByCreatedAtDescSortOrderAsc(String parentId);

    /** 읽기 순서를 고정하는 탭의 정렬. sortOrder 가 1차이고 발행일은 tiebreak 로 내려간다. */
    List<WikiArticle> findByParentIdOrderBySortOrderAscCreatedAtDesc(String parentId);

    /**
     * 읽기 순서를 고정하는 탭.
     *
     * 대시보드는 첫 화면이라 '한눈에 보기'가 항상 맨 위여야 한다. 날짜 순으로 세우면
     * 나중에 쓴 글이 입구 앞에 서고, 글을 하나 더할 때마다 입구가 바뀐다.
     * 정렬을 뒤집은 커밋(5009e3d)이 "읽기 순서를 고정해야 하는 탭이 생기면 탭 속성으로 가른다"고
     * 적어 뒀는데, 그 탭이 지금 하나 생겼다.
     *
     * 탭 하나뿐이라 컬럼을 늘리지 않고 상수로 둔다. 둘째가 생기면 그때 탭 속성으로 옮긴다.
     */
    java.util.Set<String> READING_ORDER_TABS = java.util.Set.of("start");

    /**
     * 많이 쓰인 태그 순.
     *
     * 조회수(V21)는 사람이 고른 열람만 세므로 검색 추천에 쓰기엔 편중이 크다. 그래서 여기서 쓰는
     * 값은 태그가 몇 편에 붙었는지다. 검색 화면의 추천 키워드가 이 값을 쓴다 —
     * 손으로 고른 예시가 아니라 문서에서 나온 값이어야 눌러서 결과가 비지 않는다.
     *
     * tags 는 콤마 문자열이라(WikiArticle 참조) 쪼개서 센다. 동률은 이름순으로 끊어 매번 같은 답을 준다.
     */
    @Query(value = """
        select btrim(t.tag) as tag, count(*) as cnt
          from public.tb_article a
          cross join lateral unnest(string_to_array(a.tags, ',')) as t(tag)
         where a.status = 'published' and btrim(t.tag) <> ''
         group by btrim(t.tag)
         order by cnt desc, tag asc
         limit :limit
        """, nativeQuery = true)
    List<Object[]> countTags(@Param("limit") int limit);

    /**
     * 조회수 +1 (V21). 엔티티를 읽어 고치면 같은 순간의 다른 조회를 덮어쓰므로 UPDATE 한 문장으로 올린다.
     * 없는 slug 면 0 을 돌려준다. 전체 조회수는 따로 저장하지도, 따로 묻지도 않는다 —
     * 탭 트리 응답이 이미 글별 값을 싣고 있어 화면에서 더한다. 숫자의 출처는 이 컬럼 하나다.
     */
    @Modifying(clearAutomatically = true)
    @Query("update WikiArticle a set a.viewCount = a.viewCount + 1 where a.slug = :slug")
    int incrementViewCount(@Param("slug") String slug);

    /** 탭의 문서 목록. 탭 성격에 따라 정렬을 가른다 — 호출부는 이것만 쓴다. */
    default List<WikiArticle> findForTab(String parentId) {
        return READING_ORDER_TABS.contains(parentId)
                ? findByParentIdOrderBySortOrderAscCreatedAtDesc(parentId)
                : findByParentIdOrderByCreatedAtDescSortOrderAsc(parentId);
    }
}
