package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.stats.SiteStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 블로그에만 있는 통계. 사이트 공용 집계는 SiteStatsService 가 한다.
 *
 * <p>여기 남는 것은 블로그 표를 직접 건드리는 둘뿐이다 -- 글 하나의 누적 조회수와,
 * 댓글이 어느 유입에서 나왔는지.
 */
@Service
@RequiredArgsConstructor
public class BlogStatsService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final JdbcTemplate jdbc;
    private final SiteStatsService siteStats;

    /** 글 한 번 조회를 기록한다. 글이 없으면 호출하지 않는다(컨트롤러가 조회 성공 뒤에만 부른다). */
    @Transactional
    public void recordView(Long postId, String clientIp, String referer, String userAgent) {
        jdbc.update("update public.tb_blog_post set view_count = view_count + 1 where id = ?", postId);
        siteStats.recordView(SiteStatsService.BLOG, clientIp, referer, userAgent);
    }

    /**
     * 유입 소스별 댓글 수. 댓글을 쓴 사람이 애초에 어디서 들어왔는지를 본다.
     *
     * <p>source 가 null 인 행은 이 기능이 생기기 전에 달린 댓글이라 unknown 으로 묶는다.
     */
    @Transactional(readOnly = true)
    public List<SiteStatsService.SourceCount> commentSources(int days) {
        LocalDate from = LocalDate.now(KST).minusDays(days - 1L);
        return jdbc.query("""
                select coalesce(source, 'unknown'), count(*) from public.tb_blog_comment
                where deleted_at is null and created_at >= ?
                group by 1 order by 2 desc
                """,
                (rs, i) -> new SiteStatsService.SourceCount(rs.getString(1), rs.getLong(2)),
                from.atStartOfDay(KST).toOffsetDateTime());
    }
}
