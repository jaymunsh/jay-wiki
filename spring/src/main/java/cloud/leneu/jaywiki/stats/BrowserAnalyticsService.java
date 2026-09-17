package cloud.leneu.jaywiki.stats;

import cloud.leneu.jaywiki.blog.BlogCommentProperties;
import cloud.leneu.jaywiki.common.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class BrowserAnalyticsService {
    private final JdbcTemplate jdbc;
    private final BlogCommentProperties properties;
    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    public record Event(String site, String eventId, String visitorId, String sessionId, String page,
                        String referrer, String campaign, String type) {}
    public record Metrics(long views, long visitors, long sessions, long engaged) {}
    public record Baseline(LocalDate throughDate, long views, long visitors) {}
    public record Cumulative(long views, long visitors) {}
    public record Day(LocalDate date, long views, long visitors, long sessions, long engaged) {}
    public record Dimension(String label, long views, long sessions, long engaged, String title) {}
    public record Report(String startedAt, Metrics current, Metrics previous, List<Day> daily,
                         Baseline baseline, Cumulative cumulative, List<Dimension> sources,
                         List<Dimension> campaigns, List<Dimension> pages, List<Dimension> landings,
                         List<Dimension> devices) {}
    private record Session(String visitor, String source, String campaign, String device, String landing, int views) {}

    public String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                    (properties.ipSalt() + "|analytics-v2|" + LocalDate.now(ZONE) + "|" + value).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    static String campaign(String input) {
        // Explicit campaign labels only: no term/content, URL, email, or arbitrary free text.
        return input != null && input.matches("[a-zA-Z0-9_-]{1,40}(/[a-zA-Z0-9_-]{1,40}){0,2}") ? input : "none";
    }
    static String source(String referrer) {
        String host = Referrer.hostOf(referrer);
        if (host == null || host.length() > 160 || !host.matches("[a-zA-Z0-9.-]+")) return "direct";
        Referrer known = Referrer.ofHost(host);
        // Keep the host for referrals that previously disappeared into 'other'.
        return known.source().equals("other") ? host.toLowerCase(Locale.ROOT) : known.source();
    }
    private String checkedPage(String site, String page) {
        if (page == null || page.length() > 220) throw new BadRequestException("invalid page");
        if (page.equals("/")) return page;
        if (site.equals("blog") && page.matches("/[0-9]+/[a-zA-Z0-9_-]+")) {
            String[] bits = page.split("/");
            if (jdbc.queryForObject("select count(*) from public.tb_blog_post where id::text=? and slug=? and status='published'", Long.class, bits[1], bits[2]) > 0) return page;
        }
        if (site.equals("wiki") && page.matches("/wiki/[a-zA-Z0-9_-]+")) {
            if (jdbc.queryForObject("select count(*) from public.tb_article where slug=? and status='published'", Long.class, page.substring(6)) > 0) return page;
        }
        // Public landing pages: no search terms, arbitrary paths or user-generated identifiers.
        if (site.equals("blog") && Set.of("/search", "/tags", "/categories").contains(page)) return page;
        if (site.equals("wiki") && Set.of("/wiki", "/scenarios", "/services", "/board").contains(page)) return page;
        throw new BadRequestException("untracked page");
    }
    @Transactional
    public void record(Event e, String userAgent) {
        if (!Set.of("blog", "wiki").contains(e.site() == null ? "" : e.site()) ||
            !Set.of("view", "engaged").contains(e.type() == null ? "" : e.type())) throw new BadRequestException("invalid event");
        for (String id : new String[]{e.eventId(), e.visitorId(), e.sessionId()}) {
            if (id == null || !id.matches("[a-fA-F0-9-]{36}")) throw new BadRequestException("invalid id");
        }
        String page = checkedPage(e.site(), e.page());
        LocalDate day = LocalDate.now(ZONE);
        String visitor = hash(e.visitorId()), session = hash(e.sessionId()), event = hash(e.eventId());
        if (e.type().equals("engaged")) {
            // Engagement cannot create a view; bind it to the same session and page and enforce elapsed time.
            int changed = jdbc.update("""
                update public.tb_analytics_event set engaged=true where site=? and day=? and token=? and session=?
                and page=? and engaged=false and created_at <= now() - interval '29 seconds'
                """, e.site(), day, event, session, page);
            if (changed == 0) return;
            jdbc.update("update public.tb_analytics_day set engaged=engaged+1 where site=? and day=?", e.site(), day);
            dimension(e.site(), day, "page", page, 0, 0, 1);
            return;
        }
        jdbc.update("""
            insert into public.tb_analytics_session(site,day,token,visitor,source,campaign,device,landing)
            values(?,?,?,?,?,?,?,?) on conflict do nothing
            """, e.site(), day, session, visitor, source(e.referrer()), campaign(e.campaign()),
            userAgent == null || userAgent.isBlank() ? "unknown" : SiteStatsService.deviceOf(userAgent), page);
        Session s = jdbc.queryForObject("""
            select visitor,source,campaign,device,landing,views from public.tb_analytics_session
            where site=? and day=? and token=? for update
            """, (rs,n) -> new Session(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getInt(6)), e.site(),day,session);
        if (!s.visitor().equals(visitor)) throw new BadRequestException("session mismatch");
        int accepted = jdbc.update("""
            insert into public.tb_analytics_event(site,day,token,session,page) values(?,?,?,?,?) on conflict do nothing
            """, e.site(),day,event,session,page);
        if (accepted == 0) return;
        int newVisitor = jdbc.update("insert into public.tb_analytics_visitor values(?,?,?) on conflict do nothing",e.site(),day,visitor);
        int newSession = s.views() == 0 ? 1 : 0;
        jdbc.update("update public.tb_analytics_session set views=views+1 where site=? and day=? and token=?", e.site(),day,session);
        jdbc.update("""
            insert into public.tb_analytics_day(site,day,views,visitors,sessions) values(?,?,1,?,?)
            on conflict(site,day) do update set views=tb_analytics_day.views+1,
            visitors=tb_analytics_day.visitors+excluded.visitors,sessions=tb_analytics_day.sessions+excluded.sessions
            """,e.site(),day,newVisitor,newSession);
        dimension(e.site(),day,"page",page,1,0,0);
        dimension(e.site(),day,"source",s.source(),1,newSession,0);
        dimension(e.site(),day,"campaign",s.campaign(),1,newSession,0);
        dimension(e.site(),day,"device",s.device(),1,newSession,0);
        dimension(e.site(),day,"landing",s.landing(),0,newSession,0);
        if (e.site().equals("blog") && page.matches("/[0-9]+/.*"))
            jdbc.update("update public.tb_blog_post set view_count=view_count+1 where id::text=?",page.split("/")[1]);
        if (e.site().equals("wiki") && page.startsWith("/wiki/"))
            jdbc.update("update public.tb_article set view_count=view_count+1 where slug=?",page.substring(6));
    }
    private void dimension(String site, LocalDate day, String kind, String label, int views, int sessions, int engaged) {
        jdbc.update("""
            insert into public.tb_analytics_dimension values(?,?,?,?,?,?,?)
            on conflict(site,day,kind,label) do update set views=tb_analytics_dimension.views+excluded.views,
            sessions=tb_analytics_dimension.sessions+excluded.sessions,engaged=tb_analytics_dimension.engaged+excluded.engaged
            """,site,day,kind,label,views,sessions,engaged);
    }
    private Metrics metrics(String site, LocalDate from, LocalDate to) {
        return jdbc.queryForObject("""
            select coalesce(sum(views),0),coalesce(sum(visitors),0),coalesce(sum(sessions),0),coalesce(sum(engaged),0)
            from public.tb_analytics_day where site=? and day between ? and ?
            """,(rs,n)->new Metrics(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getLong(4)),site,from,to);
    }
    private Baseline baseline(String site) {
        return jdbc.query("""
            select through_date,views,visitors from public.tb_analytics_baseline where site=?
            """,(rs,n)->new Baseline(rs.getObject(1,LocalDate.class),rs.getLong(2),rs.getLong(3)),site)
            .stream().findFirst().orElse(new Baseline(LocalDate.of(2000,1,1),0,0));
    }
    private List<Dimension> dimensions(String site, LocalDate from, LocalDate to, String kind) {
        return jdbc.query("""
            select d.label,sum(d.views),sum(d.sessions),sum(d.engaged),max(coalesce(b.title,a.title,d.label))
            from public.tb_analytics_dimension d
            left join public.tb_blog_post b on d.site='blog' and d.kind in ('page','landing') and d.label='/'||b.id||'/'||b.slug
            left join public.tb_article a on d.site='wiki' and d.kind in ('page','landing') and d.label='/wiki/'||a.slug
            where d.site=? and d.day between ? and ? and d.kind=? group by d.label order by sum(d.sessions) desc,sum(d.views) desc,d.label limit 50
            """,(rs,n)->new Dimension(rs.getString(1),rs.getLong(2),rs.getLong(3),rs.getLong(4),rs.getString(5)),site,from,to,kind);
    }
    @Transactional(readOnly=true)
    public Report report(String site, int days) {
        if (!Set.of("blog","wiki").contains(site) || !Set.of(7,30,90).contains(days)) throw new BadRequestException("invalid period");
        LocalDate to=LocalDate.now(ZONE), from=to.minusDays(days-1L);
        Map<LocalDate,Day> points = new HashMap<>();
        jdbc.query("select day,views,visitors,sessions,engaged from public.tb_analytics_day where site=? and day between ? and ?",
            (rs,n)->new Day(rs.getObject(1,LocalDate.class),rs.getLong(2),rs.getLong(3),rs.getLong(4),rs.getLong(5)),site,from,to)
            .forEach(d->points.put(d.date(),d));
        List<Day> daily=from.datesUntil(to.plusDays(1)).map(d->points.getOrDefault(d,new Day(d,0,0,0,0))).toList();
        Metrics current=metrics(site,from,to), total=metrics(site,LocalDate.of(2000,1,1),to);
        Baseline baseline=baseline(site);
        return new Report(jdbc.queryForObject("select started_at::text from public.tb_analytics_meta where version=2",String.class),
            current,metrics(site,from.minusDays(days),from.minusDays(1)),daily,baseline,
            new Cumulative(baseline.views()+total.views(),baseline.visitors()+total.visitors()),
            dimensions(site,from,to,"source"),dimensions(site,from,to,"campaign"),dimensions(site,from,to,"page"),
            dimensions(site,from,to,"landing"),dimensions(site,from,to,"device"));
    }
    @Transactional(readOnly=true)
    public SiteStatsService.Summary publicSummary(String site) {
        LocalDate today=LocalDate.now(ZONE);
        Metrics current=metrics(site,today,today), yesterday=metrics(site,today.minusDays(1),today.minusDays(1));
        Metrics total=metrics(site,LocalDate.of(2000,1,1),today);
        Baseline baseline=baseline(site);
        return new SiteStatsService.Summary(current.views(),yesterday.views(),baseline.views()+total.views(),
            current.visitors(),yesterday.visitors(),baseline.visitors()+total.visitors(),0,0,0,0);
    }
    @Scheduled(fixedDelay=3600000)
    @Transactional
    public void cleanup() {
        // Keep only today and yesterday; aggregates have no visitor/session identifiers.
        LocalDate cutoff=LocalDate.now(ZONE).minusDays(1);
        for(String table:List.of("event","session","visitor")) jdbc.update("delete from public.tb_analytics_"+table+" where day < ?",cutoff);
    }
}
