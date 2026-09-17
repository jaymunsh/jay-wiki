package cloud.leneu.jaywiki.wiki;

import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.wiki.dto.ArticleSummaryDto;
import cloud.leneu.jaywiki.wiki.dto.TabDto;
import cloud.leneu.jaywiki.wiki.dto.TabSaveRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 1차 탭(카테고리) CRUD + 순서변경.
 * 사이트에서 코드 수정 없이 탭을 추가/수정/삭제/드래그 정렬.
 */
@Service
@RequiredArgsConstructor
public class TabService {

    private final WikiTabRepository tabRepo;
    private final WikiArticleRepository articleRepo;

    /** 네비게이션 트리: 탭 정렬순 + 각 탭의 문서 요약. */
    public List<TabDto> tree() {
        return tabRepo.findAllByOrderBySortOrderAsc().stream()
                .map(t -> TabDto.of(t,
                        articleRepo.findForTab(t.getTabId())
                                .stream().map(ArticleSummaryDto::from).toList()))
                .toList();
    }

    @Transactional
    public WikiTab save(TabSaveRequest req) {
        WikiTab t = tabRepo.findById(req.tabId()).orElseGet(() -> {
            WikiTab nt = new WikiTab();
            nt.setTabId(req.tabId());
            nt.setCreatedAt(OffsetDateTime.now());
            return nt;
        });
        t.setTitle(req.title());
        if (req.sortOrder() != null) t.setSortOrder(req.sortOrder());
        return tabRepo.save(t);
    }

    @Transactional
    public void delete(String tabId) {
        if (!tabRepo.existsById(tabId)) throw new NotFoundException("tab not found: " + tabId);
        // 문서가 남아있는 탭은 삭제 거부(고아 문서 방지)
        long count = articleRepo.findForTab(tabId).size();
        if (count > 0) {
            throw new IllegalStateException("문서가 " + count + "개 있는 탭은 삭제할 수 없습니다. 먼저 비우세요.");
        }
        tabRepo.deleteById(tabId);
    }

    /** 드래그 정렬: 받은 tabId 순서대로 sortOrder 재부여. */
    @Transactional
    public void reorder(List<String> orderedTabIds) {
        for (int i = 0; i < orderedTabIds.size(); i++) {
            String id = orderedTabIds.get(i);
            WikiTab t = tabRepo.findById(id)
                    .orElseThrow(() -> new NotFoundException("tab not found: " + id));
            t.setSortOrder(i);
            tabRepo.save(t);
        }
    }
}
