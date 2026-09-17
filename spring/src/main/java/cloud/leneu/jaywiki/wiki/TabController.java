package cloud.leneu.jaywiki.wiki;

import cloud.leneu.jaywiki.wiki.dto.TabDto;
import cloud.leneu.jaywiki.wiki.dto.TabSaveRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 탭(1차 카테고리) API.
 *  GET    /api/tabs            네비게이션 트리(탭 + 문서 요약)
 *  POST   /api/tabs            생성/수정
 *  DELETE /api/tabs/{tabId}    삭제(문서 없을 때만)
 *  POST   /api/tabs/reorder    드래그 정렬 (["start","data",...] 순서)
 *
 * 변경 계열은 prod 에서 Cloudflare Access(admin) 보호. 로컬은 오픈.
 */
@RestController
@RequestMapping("/api/tabs")
@RequiredArgsConstructor
public class TabController {

    private final TabService service;

    @GetMapping
    public List<TabDto> tree() {
        return service.tree();
    }

    @PostMapping
    public ResponseEntity<Void> save(@Valid @RequestBody TabSaveRequest req) {
        service.save(req);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{tabId}")
    public ResponseEntity<Void> delete(@PathVariable String tabId) {
        service.delete(tabId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorder(@RequestBody List<String> orderedTabIds) {
        service.reorder(orderedTabIds);
        return ResponseEntity.ok().build();
    }
}
