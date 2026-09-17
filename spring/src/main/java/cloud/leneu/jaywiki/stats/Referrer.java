package cloud.leneu.jaywiki.stats;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 유입 경로를 호스트 하나로 줄여 분류한다. 블로그와 위키가 같이 쓴다.
 *
 * <p>원본 Referer URL 은 저장하지 않는다 -- 호스트만 본다. 검색어는 경로와 쿼리에 있으므로
 * 여기서 보지 않는 한 어디에도 남지 않는다(관리자 설계 7절).
 *
 * <p>버킷과 소스 이름을 한 번에 낸다. 예전에는 BlogReferrerBucket 과 BlogReferrerSource 가
 * 같은 도메인 목록을 각자 들고 있었는데, 한쪽에만 도메인을 더하면 두 집계가 조용히 어긋난다.
 *
 * <p>INTERNAL 은 사이트 안에서의 이동이다. 목록에서 글로 넘어가도 referer 는 자기 호스트라서
 * 예전에는 OTHER 로 쌓였고, 안에서 도는 횟수가 훨씬 많으므로 OTHER 가 외부 유입을 뜻하지
 * 못했다. 밖에서 온 것과 섞이지 않도록 따로 센다.
 *
 * <p>호스트 매칭은 정확히 일치하거나("google.com") 서브도메인이어야("www.google.com") 한다.
 * 부분 문자열 포함은 "mygoogle.com" 이나 "google.evil.com" 을 잘못 잡으므로 쓰지 않는다.
 */
public record Referrer(Bucket bucket, String source) {

    public enum Bucket {
        SEARCH, SNS, INTERNAL, OTHER
    }

    public static final String DIRECT = "direct";
    public static final String OTHER = "other";
    public static final String INTERNAL = "internal";

    /** 삽입 순서가 곧 검사 순서다. 더 좁은 도메인을 앞에 둔다. */
    private static final Map<String, Referrer> SOURCES = new LinkedHashMap<>();

    static {
        // 자기 호스트. leneu.cloud 는 blog/portfolio/grafana 등 서브도메인을 모두 덮는다.
        // localhost 는 로컬 개발용이며 blog.localhost 도 서브도메인 규칙으로 함께 걸린다.
        internal("leneu.cloud");
        internal("localhost");

        search("google.co.kr", "google");
        search("google.com", "google");
        search("naver.com", "naver");
        search("daum.net", "daum");
        search("bing.com", "bing");
        search("duckduckgo.com", "duckduckgo");
        search("yahoo.com", "yahoo");
        search("baidu.com", "baidu");
        search("yandex.com", "yandex");

        sns("x.com", "sns:x");
        sns("twitter.com", "sns:x");
        sns("t.co", "sns:x");
        sns("facebook.com", "sns:facebook");
        sns("instagram.com", "sns:instagram");
        sns("threads.net", "sns:threads");
        sns("linkedin.com", "sns:linkedin");
        sns("reddit.com", "sns:reddit");
        sns("news.ycombinator.com", "sns:hackernews");
        sns("discord.com", "sns:discord");
        sns("kakao.com", "sns:kakao");
    }

    private static void internal(String domain) {
        SOURCES.put(domain, new Referrer(Bucket.INTERNAL, INTERNAL));
    }

    private static void search(String domain, String source) {
        SOURCES.put(domain, new Referrer(Bucket.SEARCH, source));
    }

    private static void sns(String domain, String source) {
        SOURCES.put(domain, new Referrer(Bucket.SNS, source));
    }

    /**
     * Referer 헤더 원문으로 분류한다. 헤더가 아예 없으면 direct 이고, 형식이 깨져
     * 호스트를 못 뽑으면 other 다 -- 어디선가 오기는 했으므로 direct 로 세면 안 된다.
     */
    public static Referrer of(String referer) {
        if (referer == null || referer.isBlank()) {
            return new Referrer(Bucket.OTHER, DIRECT);
        }
        String host = hostOf(referer);
        if (host == null || host.isBlank()) {
            return new Referrer(Bucket.OTHER, OTHER);
        }
        return ofHost(host);
    }

    /**
     * 호스트만 가지고 분류한다. 방문 첫 순간에 담아 둔 쿠키 값처럼 이미 호스트만 남은
     * 입력을 위한 입구다. null 이나 빈 값은 referer 가 없었다는 뜻이라 direct 로 본다.
     */
    public static Referrer ofHost(String host) {
        if (host == null || host.isBlank()) {
            return new Referrer(Bucket.OTHER, DIRECT);
        }
        String lower = host.trim().toLowerCase(Locale.ROOT);
        return SOURCES.entrySet().stream()
                .filter(e -> matches(lower, e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(new Referrer(Bucket.OTHER, OTHER));
    }

    /** Referer 헤더에서 호스트만 뽑는다. 형식이 깨졌으면 null 이다. */
    public static String hostOf(String referer) {
        if (referer == null || referer.isBlank()) {
            return null;
        }
        try {
            return URI.create(referer.trim()).getHost();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** 정확히 일치하거나 서브도메인이어야 한다. 부분 문자열 매칭은 mygoogle.com 을 잘못 잡는다. */
    private static boolean matches(String host, String domain) {
        return host.equals(domain) || host.endsWith("." + domain);
    }
}
