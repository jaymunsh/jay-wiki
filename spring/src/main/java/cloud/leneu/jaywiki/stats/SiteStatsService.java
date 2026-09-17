package cloud.leneu.jaywiki.stats;

import cloud.leneu.jaywiki.blog.BlogCommentProperties;
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
import java.util.List;
import java.util.Locale;

/**
 * 사이트 유입 통계. 블로그와 위키가 site 값으로만 갈려 같은 표에 쌓는다.
 *
 * <p>방문자 중복 제거는 Redis 집합에서 하루치만 한다. 집합에 넣는 값은
 * hash(salt + 날짜 + IP) 라서 원본 IP 가 없고, 날짜가 섞여 있어 다음 날에는 같은
 * 사람인지 대조할 수 없다. TTL 로 사라지고 PostgreSQL 에는 숫자만 남는다.
 */
@Service
@RequiredArgsConstructor
public class SiteStatsService {

    public static final String BLOG = "blog";
    public static final String WIKI = "wiki";

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /*
     * 이 키는 <site>:visitors:<날짜> 라 덮어야 하는 것은 그날 하루뿐이다. 키는 그날 첫 방문 때
     * 만들어지고 그날 자정까지 남은 시간은 항상 24시간 미만이므로, 24시간이면 당일을 반드시 덮는다.
     */
    private static final Duration VISITOR_TTL = Duration.ofHours(24);

    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;
    /*
     * IP 해시용 소금은 댓글 쪽과 같은 값을 쓴다. 같은 목적(원본 IP 를 남기지 않는 대조값)이라
     * 소금을 하나 더 만들면 운영 Secret 과 기동 실패 조건만 두 벌이 된다.
     */
    private final BlogCommentProperties properties;

    public record Summary(
            long todayViews, long yesterdayViews, long totalViews,
            long todayVisitors, long yesterdayVisitors, long totalVisitors,
            long refSearch, long refSns, long refInternal, long refOther
    ) {
    }

    public record DailyPoint(LocalDate date, long views, long visitors) {
    }

    public record SourceCount(String source, long count) {
    }

    /** 한 번의 조회를 집계에 넣는다. 부르는 쪽이 "셀 만한 조회" 인지 이미 판단한 뒤에 부른다. */
    @Transactional
    public void recordView(String site, String clientIp, String referer, String userAgent) {
        LocalDate today = LocalDate.now(KST);
        boolean newVisitor = markVisitor(site, today, clientIp);
        Referrer referrer = Referrer.of(referer);
        String bucketColumn = switch (referrer.bucket()) {
            case SEARCH -> "ref_search";
            case SNS -> "ref_sns";
            case INTERNAL -> "ref_internal";
            case OTHER -> "ref_other";
        };

        jdbc.update("""
                insert into public.tb_site_daily_stat (site, stat_date, views, visitors, %s)
                values (?, ?, 1, ?, 1)
                on conflict (site, stat_date) do update set
                    views = public.tb_site_daily_stat.views + 1,
                    visitors = public.tb_site_daily_stat.visitors + excluded.visitors,
                    %s = public.tb_site_daily_stat.%s + 1
                """.formatted(bucketColumn, bucketColumn, bucketColumn),
                site, today, newVisitor ? 1 : 0);

        // 세부 집계. 컬럼을 늘리지 않고 세로 테이블에 쌓는다(V15).
        // referer 는 호스트만 보고, UA 는 모바일 여부만 본다. 원문은 어느 쪽도 저장하지 않는다.
        jdbc.update("""
                insert into public.tb_site_referrer_daily (site, stat_date, source, count)
                values (?, ?, ?, 1)
                on conflict (site, stat_date, source)
                do update set count = public.tb_site_referrer_daily.count + 1
                """, site, today, referrer.source());

        jdbc.update("""
                insert into public.tb_site_device_daily (site, stat_date, device, count)
                values (?, ?, ?, 1)
                on conflict (site, stat_date, device)
                do update set count = public.tb_site_device_daily.count + 1
                """, site, today, deviceOf(userAgent));
    }

    /** User-Agent 원문은 저장하지 않는다. 모바일 여부 하나만 뽑아 센다. */
    public static String deviceOf(String userAgent) {
        if (userAgent == null) {
            return "pc";
        }
        String lower = userAgent.toLowerCase(Locale.ROOT);
        boolean mobile = lower.contains("mobi") || lower.contains("android")
                || lower.contains("iphone") || lower.contains("ipad");
        return mobile ? "mobile" : "pc";
    }

    @Transactional(readOnly = true)
    public List<DailyPoint> daily(String site, int days) {
        return jdbc.query("""
                select stat_date, views, visitors from public.tb_site_daily_stat
                where site = ? and stat_date >= ? order by stat_date
                """,
                (rs, i) -> new DailyPoint(rs.getObject(1, LocalDate.class), rs.getLong(2), rs.getLong(3)),
                site, from(days));
    }

    @Transactional(readOnly = true)
    public List<SourceCount> referrers(String site, int days) {
        return jdbc.query("""
                select source, sum(count) from public.tb_site_referrer_daily
                where site = ? and stat_date >= ? group by source order by sum(count) desc
                """,
                (rs, i) -> new SourceCount(rs.getString(1), rs.getLong(2)), site, from(days));
    }

    @Transactional(readOnly = true)
    public List<SourceCount> devices(String site, int days) {
        return jdbc.query("""
                select device, sum(count) from public.tb_site_device_daily
                where site = ? and stat_date >= ? group by device order by sum(count) desc
                """,
                (rs, i) -> new SourceCount(rs.getString(1), rs.getLong(2)), site, from(days));
    }

    @Transactional(readOnly = true)
    public Summary summary(String site) {
        LocalDate today = LocalDate.now(KST);
        DayRow todayRow = dayRow(site, today);
        DayRow yesterdayRow = dayRow(site, today.minusDays(1));
        return jdbc.queryForObject("""
                select coalesce(sum(views), 0), coalesce(sum(visitors), 0),
                       coalesce(sum(ref_search), 0), coalesce(sum(ref_sns), 0),
                       coalesce(sum(ref_internal), 0), coalesce(sum(ref_other), 0)
                from public.tb_site_daily_stat where site = ?
                """,
                (rs, i) -> new Summary(
                        todayRow.views(), yesterdayRow.views(), rs.getLong(1),
                        todayRow.visitors(), yesterdayRow.visitors(), rs.getLong(2),
                        rs.getLong(3), rs.getLong(4), rs.getLong(5), rs.getLong(6)),
                site);
    }

    private record DayRow(long views, long visitors) {
    }

    private DayRow dayRow(String site, LocalDate date) {
        return jdbc.query("""
                select views, visitors from public.tb_site_daily_stat
                where site = ? and stat_date = ?
                """,
                (rs, i) -> new DayRow(rs.getLong(1), rs.getLong(2)), site, date)
                .stream().findFirst().orElse(new DayRow(0, 0));
    }

    private static LocalDate from(int days) {
        return LocalDate.now(KST).minusDays(days - 1L);
    }

    /**
     * 오늘 처음 본 방문자면 true. 집합에는 hash 만 들어가고 하루 뒤 사라진다.
     * TTL 은 키가 처음 생길 때만 건다 -- 매 조회마다 갱신하면 트래픽이 계속되는 날은
     * 키가 마지막 조회로부터 24시간 뒤에야 사라져, "그 날짜로부터 하루 뒤 소멸"이라는
     * 설계 문서상 약속이 깨진다. 기존 TTL 이 없을 때(-1)만 새로 건다.
     */
    private boolean markVisitor(String site, LocalDate day, String clientIp) {
        String key = site + ":visitors:" + day;
        Long added = redis.opsForSet().add(key, visitorToken(day, clientIp));
        Long ttl = redis.getExpire(key);
        if (ttl == null || ttl < 0) {
            redis.expire(key, VISITOR_TTL);
        }
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
