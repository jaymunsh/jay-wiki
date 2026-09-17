package cloud.leneu.jaywiki.common;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.HandlerMapping;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 전역 예외 처리의 두 가지를 고정한다.
 *
 * 하나는 상태 코드다. 읽을 수 없는 본문은 보낸 쪽 잘못이라 400 이어야 한다.
 * 500 으로 두면 봇이 던진 아무 JSON 에도 운영 알림이 울린다.
 *
 * 다른 하나는 로그 한 줄의 형식이다. 이 줄은 사람만 읽는 게 아니라
 * infra/k8s/observability/loki-rules.yaml 의 정규식이 값을 뽑아 텔레그램 알림을 만든다.
 * 형식이 조용히 바뀌면 알림이 값 없이 오거나 아예 멈춘다. 실제로 두 번 다 겪었다.
 * 그래서 그 정규식을 여기 그대로 두고 테스트가 먼저 깨지게 한다.
 */
class GlobalExceptionHandlerTest {

    /**
     * loki-rules.yaml 의 규칙과 같은 정규식이다. 한쪽을 고치면 다른 쪽도 고친다.
     * 500 과 400 이 같은 꼬리를 쓰기 때문에 규칙 하나가 둘 다 잡는다.
     */
    private static final Pattern LOKI_RULE_PATTERN = Pattern.compile(
            "status=(?<status>[0-9]{3}) method=(?<method>[A-Z]+) path=(?<path>[^ ]+) route=(?<route>[^ ]+)");

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private ListAppender<ILoggingEvent> appender;
    private Logger logger;

    @BeforeEach
    void attachAppender() {
        logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        logger.detachAppender(appender);
    }

    @Test
    void 읽을_수_없는_본문은_400이다() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/blog/posts/24/comments");
        ProblemDetail pd = handler.handleUnreadableBody(unreadable(), request);

        assertThat(pd.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(pd.getDetail()).doesNotContain("broken");
    }

    /**
     * 오늘의 그 사고가 이제 400 이다. 관리자 화면이 발행일을 오프셋 없이 보낸 것도
     * 읽을 수 없는 본문이었다. 그러니 400 로그도 500 과 같은 값을 실어야 하고,
     * 같은 Loki 규칙이 잡아 trace_id 가 실린 알림이 나가야 한다.
     */
    @Test
    void 읽을_수_없는_본문의_로그도_같은_loki_규칙과_맞는다() {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/admin/blog/posts/24");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/admin/blog/posts/{id}");

        handler.handleUnreadableBody(unreadable(), request);

        Matcher m = LOKI_RULE_PATTERN.matcher(firstMessage());
        assertThat(m.find())
                .withFailMessage("400 로그 형식이 loki-rules.yaml 의 정규식과 어긋났다. 로그: %s", firstMessage())
                .isTrue();
        assertThat(m.group("status")).isEqualTo("400");
        assertThat(m.group("method")).isEqualTo("PUT");
        assertThat(m.group("path")).isEqualTo("/api/admin/blog/posts/24");
        assertThat(m.group("route")).isEqualTo("/api/admin/blog/posts/{id}");
    }

    /** 파서 예외 메시지가 여러 줄이면 로그 한 줄이 쪼개져 규칙이 값을 못 뽑는다. */
    @Test
    void 파서_메시지가_여러_줄이어도_로그는_한_줄이다() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/blog/posts/24/comments");
        handler.handleUnreadableBody(
                new HttpMessageNotReadableException("broken",
                        new IllegalStateException("line one\nline two\n at [Source: (String)\"x\"]"),
                        (org.springframework.http.HttpInputMessage) null),
                request);

        assertThat(firstMessage()).doesNotContain("\n");
        assertThat(LOKI_RULE_PATTERN.matcher(firstMessage()).find()).isTrue();
    }

    private static HttpMessageNotReadableException unreadable() {
        return new HttpMessageNotReadableException("broken", (org.springframework.http.HttpInputMessage) null);
    }

    private String firstMessage() {
        return appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .findFirst()
                .orElseThrow(() -> new AssertionError("로그가 없다"));
    }

    @Test
    void 처리하지_못한_예외의_로그가_loki_규칙과_맞는다() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/admin/blog/posts/24");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/admin/blog/posts/{id}");

        handler.handleUnexpected(new IllegalArgumentException("boom"), request);

        String line = appender.list.stream()
                .filter(e -> e.getLevel() == Level.ERROR)
                .map(ILoggingEvent::getFormattedMessage)
                .findFirst()
                .orElseThrow(() -> new AssertionError("ERROR 로그가 없다"));

        Matcher m = LOKI_RULE_PATTERN.matcher(line);
        assertThat(m.find())
                .withFailMessage("로그 형식이 loki-rules.yaml 의 정규식과 어긋났다. 로그: %s", line)
                .isTrue();
        assertThat(m.group("status")).isEqualTo("500");
        assertThat(m.group("method")).isEqualTo("PUT");
        assertThat(m.group("path")).isEqualTo("/api/admin/blog/posts/24");
        // route 는 알림 억제가 지표 라벨과 맞추는 값이라 라우트 패턴이어야 한다.
        assertThat(m.group("route")).isEqualTo("/api/admin/blog/posts/{id}");
    }

    @Test
    void 라우트_패턴이_없으면_실제_경로로_대신한다() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/unmatched");

        handler.handleUnexpected(new IllegalStateException("boom"), request);

        String line = appender.list.get(0).getFormattedMessage();
        Matcher m = LOKI_RULE_PATTERN.matcher(line);
        assertThat(m.find()).isTrue();
        assertThat(m.group("route")).isEqualTo("/api/unmatched");
    }
}
