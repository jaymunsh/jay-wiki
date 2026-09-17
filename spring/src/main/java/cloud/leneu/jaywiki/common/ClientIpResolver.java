package cloud.leneu.jaywiki.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

/**
 * 클라이언트 IP 추출. Cloudflare Tunnel 뒤라서 remoteAddr 는 프록시 주소이므로
 * cf-connecting-ip 를 먼저 본다. 이 로직이 rate limit, 로그인 시도 제한, 블로그 댓글
 * 세 곳에 필요해서 한 곳에 모았다.
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        String cfIp = request.getHeader("cf-connecting-ip");
        if (StringUtils.hasText(cfIp)) {
            return cfIp.trim();
        }
        String forwardedFor = request.getHeader("x-forwarded-for");
        if (StringUtils.hasText(forwardedFor)) {
            return forwardedFor.split(",", 2)[0].trim();
        }
        return request.getRemoteAddr();
    }

    /** 화면에 보여줄 앞자리. 이것만으로는 개인을 특정하지 못한다. */
    public static String prefix(String ip) {
        if (!StringUtils.hasText(ip)) return "";
        if (ip.contains(":")) {
            String[] groups = ip.split(":");
            String candidate = groups.length >= 2 ? groups[0] + ":" + groups[1] : ip;
            // "::1" 같은 축약형은 앞 두 그룹이 비어서 후보가 ":" 하나로 남는다.
            // 그런 값을 그대로 보여주면 "홍길동(:)" 처럼 보이므로 원본 문자열로 대체한다.
            boolean degenerate = candidate.chars().allMatch(c -> c == ':');
            return degenerate ? ip : candidate;
        }
        String[] octets = ip.split("\\.");
        return octets.length >= 2 ? octets[0] + "." + octets[1] : ip;
    }
}
