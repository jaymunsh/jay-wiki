package cloud.leneu.jaywiki.stats;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.auth.JwtService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BrowserAnalyticsTest {
    @Autowired BrowserAnalyticsService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JwtService jwt;
    String visitor, session;
    static String id() { return UUID.randomUUID().toString(); }
    BrowserAnalyticsService.Event event(String eventId, String type) {
        return new BrowserAnalyticsService.Event("wiki",eventId,visitor,session,"/", "https://example.org/private?q=secret","newsletter/email/launch",type);
    }
    @BeforeEach void setup() {
        for (String t : new String[]{"event","session","visitor","dimension","day"}) jdbc.update("delete from public.tb_analytics_"+t);
        jdbc.update("update public.tb_analytics_baseline set views=0, visitors=0");
        visitor=id();session=id();
    }
    @Test void deduplicatesRetriesAndCountsSessionEntryOnlyOnce() {
        var e=event(id(),"view");
        service.record(e,"Mozilla/5.0");service.record(e,"Mozilla/5.0");service.record(event(id(),"view"),"Mozilla/5.0");
        var report=service.report("wiki",7);
        assertThat(report.current()).isEqualTo(new BrowserAnalyticsService.Metrics(2,1,1,0));
        assertThat(report.sources().getFirst().label()).isEqualTo("example.org");
        assertThat(report.sources().getFirst().sessions()).isEqualTo(1);
        assertThat(report.daily()).hasSize(7);
        session=id();service.record(event(id(),"view"),"Mozilla/5.0");
        assertThat(service.report("wiki",7).current()).isEqualTo(new BrowserAnalyticsService.Metrics(3,1,2,0));
    }
    @Test void engagementRequiresViewElapsedTimeAndOnlyCountsOnce() {
        String event=id();service.record(event(event,"engaged"),"Mozilla/5.0");
        assertThat(service.report("wiki",7).current().views()).isZero();
        service.record(event(event,"view"),"Mozilla/5.0");service.record(event(event,"engaged"),"Mozilla/5.0");
        assertThat(service.report("wiki",7).current().engaged()).isZero();
        jdbc.update("update public.tb_analytics_event set created_at=now()-interval '40 seconds'");
        service.record(event(event,"engaged"),"Mozilla/5.0");service.record(event(event,"engaged"),"Mozilla/5.0");
        assertThat(service.report("wiki",7).current().engaged()).isEqualTo(1);
    }
    @Test void rejectsArbitraryPathsAndSanitizesAttribution() {
        var e=new BrowserAnalyticsService.Event("wiki",id(),visitor,session,"/admin/users","https://google.com/search?q=private","foo@example.com","view");
        assertThatThrownBy(()->service.record(e,"Mozilla/5.0")).isInstanceOf(RuntimeException.class);
        assertThat(BrowserAnalyticsService.campaign("foo@example.com")).isEqualTo("none");
        assertThat(BrowserAnalyticsService.source("https://google.com/search?q=private")).isEqualTo("google");
        assertThat(service.report("wiki",7).current().views()).isZero();
    }
    @Test void apiGuardsAdminBotsOriginsAndReports() throws Exception {
        String body=json.writeValueAsString(event(id(),"view"));
        mvc.perform(post("/api/analytics/events").contentType("application/json").content(body).header("User-Agent","Mozilla/5.0")).andExpect(status().isForbidden());
        mvc.perform(post("/api/analytics/events").contentType("application/json").content(body).header("Origin","https://evil.example").header("User-Agent","Mozilla/5.0")).andExpect(status().isForbidden());
        for(String agent:new String[]{"Googlebot","curl/8"}) mvc.perform(post("/api/analytics/events").contentType("application/json").content(body).header("Origin","http://localhost").header("User-Agent",agent)).andExpect(status().isNoContent());
        mvc.perform(post("/api/analytics/events").contentType("application/json").content(body).header("Origin","http://localhost").header("User-Agent","Mozilla/5.0").cookie(new Cookie("jw_token",jwt.issue("admin","ADMIN")))).andExpect(status().isNoContent());
        assertThat(service.report("wiki",7).current().views()).isZero();
        mvc.perform(get("/api/admin/stats/report")).andExpect(status().isForbidden());
        mvc.perform(post("/api/analytics/events").contentType("application/json").content(body).header("Origin","http://localhost").header("User-Agent","Mozilla/5.0")).andExpect(status().isNoContent());
        assertThat(service.report("wiki",7).current().views()).isEqualTo(1);
    }
    @Test void cleanupKeepsAggregates() {
        service.record(event(id(),"view"),"Mozilla/5.0");
        for(String t:new String[]{"event","session","visitor"}) jdbc.update("update public.tb_analytics_"+t+" set day=current_date-3");
        service.cleanup();
        assertThat(jdbc.queryForObject("select count(*) from public.tb_analytics_event",Long.class)).isZero();
        assertThat(service.report("wiki",7).current().views()).isEqualTo(1);
    }

    @Test void baselineOnlyAffectsCumulativeTotals() {
        jdbc.update("update public.tb_analytics_baseline set through_date=date '2026-09-21', views=8100, visitors=103 where site='wiki'");
        service.record(event(id(),"view"),"Mozilla/5.0");

        var report=service.report("wiki",7);
        assertThat(report.current()).isEqualTo(new BrowserAnalyticsService.Metrics(1,1,1,0));
        assertThat(report.daily().stream().mapToLong(BrowserAnalyticsService.Day::views).sum()).isEqualTo(1);
        assertThat(report.baseline()).isEqualTo(new BrowserAnalyticsService.Baseline(
                LocalDate.of(2026,9,21),8100,103));
        assertThat(report.cumulative()).isEqualTo(new BrowserAnalyticsService.Cumulative(8101,104));
        assertThat(service.publicSummary("wiki").totalViews()).isEqualTo(8101);
        assertThat(service.publicSummary("wiki").totalVisitors()).isEqualTo(104);
    }

    @Test void concurrentRetriesAreAtomic() throws Exception {
        var e=event(id(),"view");
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(6)) {
            var tasks=new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for(int n=0;n<12;n++) tasks.add(executor.submit(()->service.record(e,"Mozilla/5.0")));
            for(var result:tasks) result.get();
        }
        assertThat(service.report("wiki",7).current()).isEqualTo(new BrowserAnalyticsService.Metrics(1,1,1,0));
    }
    @Test void privacySignalsAndRateLimit() throws Exception {
        String body=json.writeValueAsString(event(id(),"view"));
        for(String signal:new String[]{"DNT","Sec-GPC"}) {
            mvc.perform(post("/api/analytics/events").contentType("application/json").content(body)
                .header("Origin","http://localhost").header("User-Agent","Mozilla/5.0").header(signal,"1"))
                .andExpect(status().isNoContent());
        }
        assertThat(service.report("wiki",7).current().views()).isZero();
        for(int n=0;n<120;n++) mvc.perform(post("/api/analytics/events").contentType("application/json").content(body)
            .header("Origin","http://localhost").header("User-Agent","Mozilla/5.0").header("cf-connecting-ip","203.0.113.220"))
            .andExpect(status().isNoContent());
        mvc.perform(post("/api/analytics/events").contentType("application/json").content(body)
            .header("Origin","http://localhost").header("User-Agent","Mozilla/5.0").header("cf-connecting-ip","203.0.113.220"))
            .andExpect(status().isTooManyRequests());
        assertThat(service.report("wiki",7).current().views()).isEqualTo(1);
    }
}
