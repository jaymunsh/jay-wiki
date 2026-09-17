package cloud.leneu.jaywiki.search;

import cloud.leneu.jaywiki.wiki.WikiArticle;

/**
 * 검색 결과 1건의 응답 DTO (record).
 * 엔티티(WikiArticle)를 그대로 노출하지 않고 필요한 필드만 추려 반환.
 * - body(본문 전체)는 검색 결과에 안 실음(목록은 가벼워야).
 */
public record SearchHit(
        String slug,
        String parentId,
        String title,
        String summary,
        String kind
) {
    public static SearchHit from(WikiArticle a) {
        return new SearchHit(a.getSlug(), a.getParentId(), a.getTitle(), a.getSummary(), a.getKind());
    }
}
