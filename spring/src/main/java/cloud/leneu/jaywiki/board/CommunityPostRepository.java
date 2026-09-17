package cloud.leneu.jaywiki.board;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 게시글 저장소. 목록 페이징은 JpaRepository.findAll(Pageable) 로 충분
 * (정렬/페이지 크기는 BoardService 에서 PageRequest 로 지정).
 *
 * 검색 비교(03B Phase1): 같은 검색어를 두 방식(LIKE / tsvector)으로 조회해
 * 소요시간을 비교한다. tsv 컬럼은 엔티티에 매핑하지 않으므로 컬럼을 명시적으로 선택.
 */
public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {
    // findAll(Pageable), findById, save, delete... 는 기본 제공.
    // 명시적 예시(현재는 findAll(Pageable) 사용): 최신순 페이지.
    Page<CommunityPost> findAllByOrderByIdDesc(Pageable pageable);

    /** 방식 A — 순차 스캔 ILIKE(인덱스 없음). 대량에서 느린 대비군. */
    @Query(value = """
            select id, title, content, author_type, author_name, password_hash,
                   views, comment_count, created_at
            from public.tb_post
            where title ilike ('%' || :q || '%') or content ilike ('%' || :q || '%')
            order by id desc
            limit 20
            """, nativeQuery = true)
    List<CommunityPost> searchLike(@Param("q") String q);

    /** 방식 B — tsvector 전문검색(GIN 인덱스). plainto_tsquery 가 입력을 안전하게 파싱. */
    @Query(value = """
            select id, title, content, author_type, author_name, password_hash,
                   views, comment_count, created_at
            from public.tb_post
            where tsv @@ plainto_tsquery('simple', :q)
            order by id desc
            limit 20
            """, nativeQuery = true)
    List<CommunityPost> searchFts(@Param("q") String q);

    @Query(value = """
            select id, title, content, author_type, author_name, password_hash,
                   views, comment_count, created_at
            from public.tb_post
            where title ilike (:q || '%')
            order by id desc
            limit 8
            """, nativeQuery = true)
    List<CommunityPost> suggestTitlePrefix(@Param("q") String q);
}
