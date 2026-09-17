package cloud.leneu.jaywiki.stats;

import cloud.leneu.jaywiki.account.AccountUserRepository;
import cloud.leneu.jaywiki.blog.BlogStatsService;
import cloud.leneu.jaywiki.common.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 통계 조회. 집계 숫자만 돌려주며 원본 식별자는 애초에 저장돼 있지 않다.
 *
 * <p>이전 경로는 /api/admin/blog/stats 였다. 위키도 같은 집계를 쓰게 되면서 site 질의값으로
 * 갈리는 편이 맞아 한 단계 위로 옮겼다.
 */
@RestController
@RequestMapping("/api/admin/stats")
@RequiredArgsConstructor
public class SiteAdminStatsController {

    private final SiteStatsService stats;
    private final BlogStatsService blogStats;
    private final AccountUserRepository users;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private int checkedDays(int days) {
        if (days < 1 || days > 365) {
            throw new BadRequestException("days must be between 1 and 365: " + days);
        }
        return days;
    }

    /** 질의값을 그대로 SQL 로 넘기지 않는다. 아는 사이트 이름 둘만 받는다. */
    private String checkedSite(String site) {
        if (!SiteStatsService.BLOG.equals(site) && !SiteStatsService.WIKI.equals(site)) {
            throw new BadRequestException("unknown site: " + site);
        }
        return site;
    }

    @GetMapping("/summary")
    public SiteStatsService.Summary summary(@RequestParam(defaultValue = "blog") String site) {
        return stats.summary(checkedSite(site));
    }

    @GetMapping("/daily")
    public List<SiteStatsService.DailyPoint> daily(@RequestParam(defaultValue = "blog") String site,
                                                   @RequestParam(defaultValue = "30") int days) {
        return stats.daily(checkedSite(site), checkedDays(days));
    }

    @GetMapping("/referrers")
    public List<SiteStatsService.SourceCount> referrers(@RequestParam(defaultValue = "blog") String site,
                                                        @RequestParam(defaultValue = "30") int days) {
        return stats.referrers(checkedSite(site), checkedDays(days));
    }

    @GetMapping("/devices")
    public List<SiteStatsService.SourceCount> devices(@RequestParam(defaultValue = "blog") String site,
                                                      @RequestParam(defaultValue = "30") int days) {
        return stats.devices(checkedSite(site), checkedDays(days));
    }

    /** 댓글은 블로그에만 있다. site 를 받지 않는 이유가 그것이다. */
    @GetMapping("/comment-sources")
    public List<SiteStatsService.SourceCount> commentSources(@RequestParam(defaultValue = "30") int days) {
        return blogStats.commentSources(checkedDays(days));
    }

    /**
     * 유입 소스별 가입 수. 계정은 사이트마다 나뉘지 않고 하나이므로 site 를 받지 않는다.
     * 가입 화면(/login)은 위키 쪽에 있다.
     */
    @GetMapping("/signup-sources")
    public List<SiteStatsService.SourceCount> signupSources(@RequestParam(defaultValue = "30") int days) {
        LocalDate from = LocalDate.now(KST).minusDays(checkedDays(days) - 1L);
        return users.countBySource(from.atStartOfDay(KST).toOffsetDateTime()).stream()
                .map(r -> new SiteStatsService.SourceCount(r.getSource(), r.getTotal()))
                .toList();
    }
}
