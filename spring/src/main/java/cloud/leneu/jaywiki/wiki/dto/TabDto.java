package cloud.leneu.jaywiki.wiki.dto;

import cloud.leneu.jaywiki.wiki.WikiTab;

import java.util.List;

/** 탭(1차) + 그 안의 문서(2차) 요약 — 사이트 네비게이션 트리. */
public record TabDto(
        String tabId,
        String title,
        int sortOrder,
        List<ArticleSummaryDto> articles
) {
    public static TabDto of(WikiTab t, List<ArticleSummaryDto> articles) {
        return new TabDto(t.getTabId(), t.getTitle(), t.getSortOrder(), articles);
    }
}
