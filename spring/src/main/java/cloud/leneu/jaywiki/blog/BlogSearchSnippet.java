package cloud.leneu.jaywiki.blog;

/**
 * 검색 결과에 붙일 본문 한 줄.
 *
 * 본문에만 걸린 글은 목록의 요약에 검색어가 없어 왜 걸렸는지 보이지 않는다.
 * 걸린 자리 앞뒤를 잘라 그 자리를 보여 준다.
 *
 * 하이라이트 표시는 넣지 않는다. 본문이 마크다운이라 여기서 태그를 섞으면
 * 화면이 그것을 다시 escape 할지 렌더할지 정해야 하고, 그 경계를 늘릴 이유가 없다.
 */
public final class BlogSearchSnippet {

    /** 검색어 앞뒤로 남길 글자 수. */
    private static final int RADIUS = 60;

    private BlogSearchSnippet() {
    }

    /**
     * 본문에서 검색어가 처음 나오는 자리를 잘라 준다.
     * 본문에 없으면(제목·요약만 걸린 글) null 을 준다 - 화면이 원래 요약을 쓴다.
     */
    public static String of(String body, String query) {
        if (body == null || query == null) return null;
        String flat = flatten(body);
        String needle = query.trim();
        if (needle.isEmpty()) return null;

        int at = flat.toLowerCase().indexOf(needle.toLowerCase());
        if (at < 0) return null;

        int from = Math.max(0, at - RADIUS);
        int to = Math.min(flat.length(), at + needle.length() + RADIUS);
        String cut = flat.substring(from, to).trim();
        return (from > 0 ? "… " : "") + cut + (to < flat.length() ? " …" : "");
    }

    /**
     * 마크다운 본문을 한 줄로 편다. 코드 펜스·헤딩 기호·표 구분선처럼 잘라 놓으면
     * 뜻이 없는 기호를 걷어 내고 공백을 하나로 줄인다.
     */
    private static String flatten(String body) {
        return body
                .replaceAll("(?s)~~~.*?~~~", " ")   // 코드 블록(시드 규약상 물결 세 개)
                .replaceAll("(?s)```.*?```", " ")
                .replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", " ")  // 이미지
                .replaceAll("\\[([^\\]]*)\\]\\([^)]*\\)", "$1") // 링크는 글자만 남긴다
                .replaceAll("^[#>\\-*|\\s]+", " ")
                .replaceAll("(?m)^[#>]+\\s*", " ")
                .replaceAll("(?m)^\\|[-:\\s|]+\\|$", " ")       // 표 구분선
                .replaceAll("[*_`]", "")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
