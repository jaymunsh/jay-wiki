package cloud.leneu.jaywiki.blog;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BlogSearchSnippetTest {

    @Test
    void 걸린_자리_앞뒤를_잘라_준다() {
        String body = "가".repeat(200) + "HikariCP" + "나".repeat(200);

        String snippet = BlogSearchSnippet.of(body, "HikariCP");

        assertThat(snippet).contains("HikariCP");
        assertThat(snippet).startsWith("… ").endsWith(" …");
        assertThat(snippet.length()).isLessThan(body.length());
    }

    @Test
    void 본문_맨_앞이_걸리면_앞쪽_말줄임을_붙이지_않는다() {
        String snippet = BlogSearchSnippet.of("HikariCP 로 연결을 관리한다.", "HikariCP");

        assertThat(snippet).isEqualTo("HikariCP 로 연결을 관리한다.");
    }

    @Test
    void 대소문자를_가리지_않는다() {
        assertThat(BlogSearchSnippet.of("본문에 hikaricp 가 있다", "HikariCP")).contains("hikaricp");
    }

    @Test
    void 한국어는_활용형_안에서도_걸린다() {
        assertThat(BlogSearchSnippet.of("캐시를 지웠는데 왜 안 바뀌지", "캐시")).contains("캐시를");
    }

    @Test
    void 코드블록과_마크다운_기호를_걷어_낸다() {
        String body = """
                ## 제목

                ~~~bash
                curl -sI https://example.com
                ~~~

                **본문**에서 캐시를 다룬다.
                """;

        String snippet = BlogSearchSnippet.of(body, "캐시");

        assertThat(snippet).contains("본문에서 캐시를 다룬다");
        assertThat(snippet).doesNotContain("curl").doesNotContain("**").doesNotContain("##");
    }

    @Test
    void 본문에_없으면_null_이다() {
        assertThat(BlogSearchSnippet.of("아무 말", "없는말")).isNull();
        assertThat(BlogSearchSnippet.of(null, "무엇")).isNull();
        assertThat(BlogSearchSnippet.of("본문", "  ")).isNull();
    }
}
