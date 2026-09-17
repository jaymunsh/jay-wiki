package cloud.leneu.jaywiki.blog.dto;

import java.time.OffsetDateTime;

/**
 * 검색 결과 한 줄. 목록과 같은 필드에 snippet 하나가 붙는다.
 *
 * 목록 DTO 를 그대로 쓰지 않는 이유는, 목록 응답 셋이 사이트맵·OG 이미지·위키 화면까지
 * 함께 쓰고 있어 거기에 검색에서만 채워지는 필드를 넣고 싶지 않기 때문이다.
 */
public record BlogSearchHitDto(
        Long id,
        String slug,
        String title,
        String summary,
        String categorySlug,
        String categoryName,
        String coverImageUrl,
        OffsetDateTime publishedAt,
        OffsetDateTime updatedAt,
        /** 본문에서 검색어가 걸린 자리. 제목·요약만 걸렸으면 null 이고 화면이 요약을 쓴다. */
        String snippet
) {
}
