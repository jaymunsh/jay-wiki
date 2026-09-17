package cloud.leneu.jaywiki.stats;

import cloud.leneu.jaywiki.stats.Referrer.Bucket;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 호스트만 보고 분류한다. 경로와 쿼리는 보지 않는다 --
 * 검색어가 거기 있으므로, 보지 않는 한 어디에도 남지 않는다.
 */
class ReferrerTest {

    @Test
    void referer_가_없으면_직접_유입이다() {
        assertThat(Referrer.of(null).source()).isEqualTo("direct");
        assertThat(Referrer.of("  ").source()).isEqualTo("direct");
    }

    @Test
    void 검색엔진은_SEARCH_이고_이름으로_구분한다() {
        assertThat(Referrer.of("https://www.google.com/search?q=x"))
                .isEqualTo(new Referrer(Bucket.SEARCH, "google"));
        assertThat(Referrer.of("https://search.naver.com/search.naver?query=x"))
                .isEqualTo(new Referrer(Bucket.SEARCH, "naver"));
        assertThat(Referrer.of("https://search.daum.net/search?q=x").source()).isEqualTo("daum");
    }

    @Test
    void SNS_는_SNS_이고_sns_접두사를_붙인다() {
        assertThat(Referrer.of("https://x.com/someone/status/1"))
                .isEqualTo(new Referrer(Bucket.SNS, "sns:x"));
        assertThat(Referrer.of("https://www.facebook.com/").bucket()).isEqualTo(Bucket.SNS);
        assertThat(Referrer.of("https://www.linkedin.com/feed/").bucket()).isEqualTo(Bucket.SNS);
    }

    /**
     * 이것이 이번에 고친 결함이다. 예전에는 사이트 안에서의 이동이 OTHER 로 쌓여
     * 밖에서 온 유입과 섞였고, 안에서 도는 횟수가 훨씬 많아 OTHER 가 뜻을 잃었다.
     */
    @Test
    void 자기_사이트에서_온_이동은_INTERNAL_이다() {
        assertThat(Referrer.of("https://blog.leneu.cloud/6/some-post"))
                .isEqualTo(new Referrer(Bucket.INTERNAL, "internal"));
        assertThat(Referrer.of("https://portfolio.leneu.cloud/wiki/redis").bucket())
                .isEqualTo(Bucket.INTERNAL);
        assertThat(Referrer.of("http://blog.localhost:3000/6/x").bucket()).isEqualTo(Bucket.INTERNAL);
    }

    @Test
    void 모르는_호스트는_OTHER_이고_other_다() {
        assertThat(Referrer.of("https://example.com/post"))
                .isEqualTo(new Referrer(Bucket.OTHER, "other"));
    }

    @Test
    void 흉내낸_호스트는_other_다() {
        // 부분 문자열 매칭을 쓰면 이것들이 google 이나 internal 로 잘못 잡힌다.
        assertThat(Referrer.of("https://mygoogle.com/").source()).isEqualTo("other");
        assertThat(Referrer.of("https://google.evil.com/").source()).isEqualTo("other");
        assertThat(Referrer.of("https://leneu.cloud.evil.com/").source()).isEqualTo("other");
    }

    @Test
    void 깨진_주소는_direct_가_아니라_other_다() {
        // 어디선가 오기는 했다. direct 로 세면 직접 유입 숫자가 부푼다.
        assertThat(Referrer.of("h ttp://%%%").source()).isEqualTo("other");
        assertThat(Referrer.of("not a url").bucket()).isEqualTo(Bucket.OTHER);
    }

    @Test
    void 호스트만_주는_입구도_같게_분류한다() {
        // 쿠키에 담긴 값이 이 경로로 들어온다.
        assertThat(Referrer.ofHost("www.google.com").source()).isEqualTo("google");
        assertThat(Referrer.ofHost("blog.leneu.cloud").source()).isEqualTo("internal");
        assertThat(Referrer.ofHost(null).source()).isEqualTo("direct");
        assertThat(Referrer.ofHost("").source()).isEqualTo("direct");
    }

    @Test
    void 호스트만_뽑고_경로와_쿼리는_버린다() {
        assertThat(Referrer.hostOf("https://www.google.com/search?q=비밀검색어"))
                .isEqualTo("www.google.com");
        assertThat(Referrer.hostOf("not a url")).isNull();
    }
}
