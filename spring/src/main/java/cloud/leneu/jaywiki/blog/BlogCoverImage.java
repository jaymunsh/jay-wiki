package cloud.leneu.jaywiki.blog;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 목록 썸네일과 og:image 가 쓸 대표 이미지 URL 을 정한다.
 * 지정한 자산이 있으면 그것, 없으면 본문의 첫 이미지, 그것도 없으면 null.
 *
 * 자산 id 대신 URL 을 내보내는 이유: 자산은 MinIO 이고 본문 이미지는 public/ 정적 파일이라
 * 경로 규칙이 다르다. 화면이 둘을 구분하지 않아도 되게 여기서 URL 로 맞춘다.
 */
public final class BlogCoverImage {

    /** ![alt](url "title") 에서 url 만. 제목 속성이 붙으므로 공백 앞까지 끊는다. */
    private static final Pattern IMAGE = Pattern.compile("!\\[[^\\]]*]\\(\\s*([^\\s)]+)");

    /** ``` 또는 ~~~ 로 열고 닫는 코드펜스. 안의 이미지는 예제이지 대표 이미지가 아니다. */
    private static final Pattern FENCE = Pattern.compile("(?ms)^(```|~~~).*?^\\1\\s*$");

    /**
     * 백틱으로 감싼 인라인 코드. 펜스만 걷어내면 문장 안에 `![...](/assets/...)` 라고 적은
     * 예시가 대표 이미지로 뽑혀 목록에 깨진 썸네일이 뜬다. 2026-09-02 에 실제로 그랬다.
     */
    private static final Pattern INLINE_CODE = Pattern.compile("`[^`\n]*`");

    private BlogCoverImage() {
    }

    public static String resolve(String coverAssetId, String body) {
        if (coverAssetId != null && !coverAssetId.isBlank()) {
            return "/api/wiki-assets/" + coverAssetId.trim();
        }
        if (body == null || body.isBlank()) {
            return null;
        }
        String prose = INLINE_CODE.matcher(FENCE.matcher(body).replaceAll("")).replaceAll("");
        Matcher m = IMAGE.matcher(prose);
        return m.find() ? m.group(1) : null;
    }
}
